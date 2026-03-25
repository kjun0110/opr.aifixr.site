/**
 * 액세스 JWT는 브라우저 메모리에만 둡니다 (localStorage 미사용).
 * 새로고침 후에는 HttpOnly 리프레시 쿠키로 /api/auth/opr/refresh 를 호출해 복구합니다.
 */
let accessTokenMemory: string | null = null;

export function getOprAccessToken(): string | null {
  return accessTokenMemory;
}

export function setOprAccessToken(token: string | null): void {
  accessTokenMemory = token;
}
