import { PATH_API_TEST, PATH_HEALTH } from "./paths";

const DEFAULT_ACTOR_STORAGE_KEY = "x-actor-user-id";

/** 게이트웨이 JWT (원청 로그인 성공 시 저장) */
export const ACCESS_TOKEN_STORAGE_KEY = "aifixr-access-token";
export const REFRESH_TOKEN_STORAGE_KEY = "aifixr-refresh-token";

/** 로그인 응답 `user.department` (예: purchase | esg). 구매 직무 고정 시 관점 토글에 사용 */
export const OPR_DEPARTMENT_STORAGE_KEY = "aifixr-opr-department";

/** 로그인 직후 세션을 다시 읽도록 알림 */
export const AIFIXR_SESSION_UPDATED_EVENT = "aifixr-session-updated";

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
};

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const { json, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);

  if (typeof window !== "undefined") {
    const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const actor = localStorage.getItem(actorStorageKey());
    if (actor && !headers.has("X-Actor-User-Id")) {
      headers.set("X-Actor-User-Id", actor);
    }
  }

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(apiUrl(path), {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : (rest as RequestInit).body,
  });

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

export async function getHealth(): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(PATH_HEALTH);
}

export async function getApiTest(): Promise<unknown> {
  return apiFetch(PATH_API_TEST);
}

