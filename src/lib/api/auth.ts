import {
  ACCESS_TOKEN_STORAGE_KEY,
  AIFIXR_SESSION_UPDATED_EVENT,
  OPR_DEPARTMENT_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  actorStorageKey,
  apiUrl,
} from "./client";
import { PATH_AUTH_OPR_LOGIN } from "./paths";

export type OprLoginUser = {
  id: string;
  email: string;
  userType: string;
  department?: string | null;
  provider?: string;
};

export type OprLoginResponse = {
  accessToken: string;
  refreshToken: string;
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
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, data.refreshToken);
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

export function clearOprSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(actorStorageKey());
  localStorage.removeItem(OPR_DEPARTMENT_STORAGE_KEY);
  window.dispatchEvent(new Event(AIFIXR_SESSION_UPDATED_EVENT));
}

