import {
  AIFIXR_SESSION_UPDATED_EVENT,
  actorStorageKey,
  apiFetch,
  apiUrl,
  OPR_DEPARTMENT_STORAGE_KEY,
  postOprLogout,
} from "./client";
import { setOprAccessToken } from "./sessionAccessToken";
import { PATH_AUTH_OPR_GOOGLE_LINK_START, PATH_AUTH_OPR_LOGIN } from "./paths";

export type OprLoginUser = {
  id: string;
  email: string;
  userType: string;
  department?: string | null;
  provider?: string;
};

export type OprLoginResponse = {
  accessToken: string;
  user: OprLoginUser;
};

export class OprLoginFailedError extends Error {
  constructor(message = "이메일 또는 비밀번호가 올바르지 않습니다.") {
    super(message);
    this.name = "OprLoginFailedError";
  }
}

export async function loginOprAndStoreSession(
  email: string,
  password: string,
): Promise<OprLoginResponse> {
  const res = await fetch(apiUrl(PATH_AUTH_OPR_LOGIN), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: email.trim(), password }),
  });

  if (res.status === 401) {
    throw new OprLoginFailedError();
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `로그인 실패 (${res.status})`);
  }

  const data = (await res.json()) as OprLoginResponse;
  if (typeof window !== "undefined") {
    setOprAccessToken(data.accessToken);
    localStorage.setItem(actorStorageKey(), data.user.id);
    const dept = data.user.department?.trim();
    if (dept) {
      localStorage.setItem(OPR_DEPARTMENT_STORAGE_KEY, dept);
    } else {
      localStorage.removeItem(OPR_DEPARTMENT_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(AIFIXR_SESSION_UPDATED_EVENT));
  }
  return data;
}

/** DB 로그인 후 JWT로 Google 연동(동의) 화면으로 보낼 URL 조회 */
export async function getOprGoogleLinkAuthUrl(): Promise<string> {
  const data = await apiFetch<{ authUrl?: string; error?: string }>(
    PATH_AUTH_OPR_GOOGLE_LINK_START,
  );
  if (data.error) {
    throw new Error(data.error);
  }
  if (!data.authUrl) {
    throw new Error("Google 연동 URL을 받지 못했습니다.");
  }
  return data.authUrl;
}

export async function clearOprSession(): Promise<void> {
  if (typeof window === "undefined") return;
  setOprAccessToken(null);
  await postOprLogout();
  localStorage.removeItem(actorStorageKey());
  localStorage.removeItem(OPR_DEPARTMENT_STORAGE_KEY);
  // 구버전 토큰 키 정리
  try {
    localStorage.removeItem("aifixr-access-token");
    localStorage.removeItem("aifixr-refresh-token");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(AIFIXR_SESSION_UPDATED_EVENT));
}
