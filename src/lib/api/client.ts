import {
  PATH_API_TEST,
  PATH_AUTH_OPR_LOGOUT,
  PATH_AUTH_OPR_REFRESH,
  PATH_HEALTH,
} from "./paths";
import { setOprAccessToken, getOprAccessToken } from "./sessionAccessToken";

const DEFAULT_ACTOR_STORAGE_KEY = "x-actor-user-id";

/** @deprecated 토큰은 메모리(sessionAccessToken)만 사용 */
export const ACCESS_TOKEN_STORAGE_KEY = "aifixr-access-token";
/** @deprecated 리프레시는 HttpOnly 쿠키 */
export const REFRESH_TOKEN_STORAGE_KEY = "aifixr-refresh-token";

/** 로그인 응답 `user.department` (예: purchase | esg). 구매 직무 고정 시 관점 토글에 사용 */
export const OPR_DEPARTMENT_STORAGE_KEY = "aifixr-opr-department";

/** 로그인 직후 세션을 다시 읽도록 알림 */
export const AIFIXR_SESSION_UPDATED_EVENT = "aifixr-session-updated";

/** @deprecated JWT 식별로 전환됨. 신규 코드에서 사용하지 마세요. */
export function actorStorageKey(): string {
  return (
    process.env.NEXT_PUBLIC_ACTOR_STORAGE_KEY?.trim() ||
    DEFAULT_ACTOR_STORAGE_KEY
  );
}

/** trailing slash 제거 */
export function getApiBase(): string {
  const configured = (process.env.NEXT_PUBLIC_API_BASE || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  // 로컬 개발 기본값: same-origin (/api) + next.config.ts rewrite -> gateway(8080)
  if (process.env.NODE_ENV !== "production") return "";
  return "";
}

/** base + path (이중 슬래시 방지) */
export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

export type ApiClientOptions = Omit<RequestInit, "body"> & {
  json?: unknown;
  /** FormData·URLSearchParams 등 — `json`과 함께 쓰지 마세요(우선 `json`이 본문이 됨) */
  body?: RequestInit["body"];
  /** true면 401 시 리프레시 1회 후 원 요청 재시도 (기본 true) */
  retryOn401?: boolean;
};

let refreshInFlight: Promise<boolean> | null = null;

async function postOprRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(apiUrl(PATH_AUTH_OPR_REFRESH), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setOprAccessToken(null);
        return false;
      }
      const data = (await res.json()) as {
        accessToken: string;
        user?: { id?: string; department?: string | null };
      };
      if (!data.accessToken) {
        setOprAccessToken(null);
        return false;
      }
      setOprAccessToken(data.accessToken);
      if (typeof window !== "undefined") {
        const dept = data.user?.department?.trim();
        if (dept) {
          localStorage.setItem(OPR_DEPARTMENT_STORAGE_KEY, dept);
        } else {
          localStorage.removeItem(OPR_DEPARTMENT_STORAGE_KEY);
        }
      }
      return true;
    } catch {
      setOprAccessToken(null);
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const { json, headers: initHeaders, retryOn401 = true, ...rest } = options;
  const headers = new Headers(initHeaders);

  if (typeof window !== "undefined") {
    const token = getOprAccessToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const doFetch = () =>
    fetch(apiUrl(path), {
      ...rest,
      credentials: rest.credentials ?? "include",
      headers,
      body: json !== undefined ? JSON.stringify(json) : (rest as RequestInit).body,
    });

  let res = await doFetch();

  if (
    res.status === 401 &&
    retryOn401 &&
    typeof window !== "undefined" &&
    !path.startsWith(PATH_AUTH_OPR_REFRESH) &&
    path !== PATH_AUTH_OPR_LOGOUT
  ) {
    const ok = await postOprRefresh();
    if (ok) {
      const h2 = new Headers(initHeaders);
      const t2 = getOprAccessToken();
      if (t2 && !h2.has("Authorization")) {
        h2.set("Authorization", `Bearer ${t2}`);
      }
      if (json !== undefined) {
        h2.set("Content-Type", "application/json");
      }
      res = await fetch(apiUrl(path), {
        ...rest,
        credentials: rest.credentials ?? "include",
        headers: h2,
        body: json !== undefined ? JSON.stringify(json) : (rest as RequestInit).body,
      });
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) {
    return (await res.json()) as T;
  }

  return (await res.text()) as T;
}

/** Content-Disposition에서 저장 파일명 추출 (filename*=UTF-8 우선) */
export function parseContentDispositionFilename(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const star = /filename\*=(?:UTF-8''|utf-8'')([^;\n]+)/i.exec(headerValue);
  if (star) {
    const raw = star[1].trim().replace(/^"+|"+$/g, "");
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw || null;
    }
  }
  const quoted = /filename="((?:\\.|[^"\\])*)"/i.exec(headerValue);
  if (quoted) {
    return quoted[1].replace(/\\(.)/g, "$1");
  }
  const unquoted = /filename=([^;\n]+)/i.exec(headerValue);
  if (unquoted) {
    return unquoted[1].trim().replace(/^"+|"+$/g, "");
  }
  return null;
}

/** PDF 등 바이너리 응답 (Authorization·401 재시도 동일) */
export async function apiFetchBlob(
  path: string,
  options: ApiClientOptions = {},
): Promise<{ blob: Blob; filename: string | null }> {
  const { json, headers: initHeaders, retryOn401 = true, ...rest } = options;
  const headers = new Headers(initHeaders);

  if (typeof window !== "undefined") {
    const token = getOprAccessToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const doFetch = () =>
    fetch(apiUrl(path), {
      ...rest,
      credentials: rest.credentials ?? "include",
      headers,
      body: json !== undefined ? JSON.stringify(json) : (rest as RequestInit).body,
    });

  let res = await doFetch();

  if (
    res.status === 401 &&
    retryOn401 &&
    typeof window !== "undefined" &&
    !path.startsWith(PATH_AUTH_OPR_REFRESH) &&
    path !== PATH_AUTH_OPR_LOGOUT
  ) {
    const ok = await postOprRefresh();
    if (ok) {
      const h2 = new Headers(initHeaders);
      const t2 = getOprAccessToken();
      if (t2 && !h2.has("Authorization")) {
        h2.set("Authorization", `Bearer ${t2}`);
      }
      if (json !== undefined) {
        h2.set("Content-Type", "application/json");
      }
      res = await fetch(apiUrl(path), {
        ...rest,
        credentials: rest.credentials ?? "include",
        headers: h2,
        body: json !== undefined ? JSON.stringify(json) : (rest as RequestInit).body,
      });
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  const filename = parseContentDispositionFilename(res.headers.get("Content-Disposition"));
  const blob = await res.blob();
  return { blob, filename };
}

/** 앱 로드 시 리프레시 쿠키가 있으면 액세스 토큰·actor 복구 */
export async function restoreOprSessionFromCookie(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return postOprRefresh();
}

export async function postOprLogout(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch(apiUrl(PATH_AUTH_OPR_LOGOUT), {
      method: "POST",
      credentials: "include",
    });
  } catch {
    /* 네트워크 실패해도 클라이언트 세션은 정리 */
  }
}

export async function getHealth(): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(PATH_HEALTH);
}

export async function getApiTest(): Promise<unknown> {
  return apiFetch(PATH_API_TEST);
}
