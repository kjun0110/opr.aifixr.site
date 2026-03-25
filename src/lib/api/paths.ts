/**
 * KJ main.py 마운트와 동일한 API prefix (게이트웨이 Base 뒤에 이어붙임)
 */
export const API_PREFIX = {
  IAM: "/api/iam",
  SUPPLY_CHAIN: "/api/supply-chain",
  DATA_MGMT: "/api/data-mgmt",
  INVITATION: "/api/invitation",
  DATA_CONTRACT: "/api/data-contract",
  NOTIFICATION: "/api/notification",
  PCF: "/api/pcf",
} as const;

/** 루트 헬스 (KJ main) */
export const PATH_HEALTH = "/health";

/** 스모크용 (KJ main) */
export const PATH_API_TEST = "/api/test";

/** 원청 이메일 로그인 (게이트웨이 JAR auth.opr) */
export const PATH_AUTH_OPR_LOGIN = "/api/auth/opr/login";

/** 리프레시 쿠키로 새 액세스 발급 */
export const PATH_AUTH_OPR_REFRESH = "/api/auth/opr/refresh";

/** 리프레시 세션 폐기 + 쿠키 삭제 */
export const PATH_AUTH_OPR_LOGOUT = "/api/auth/opr/logout";

/** 원청 Google OAuth 연동 시작 URL (Bearer 필요, 게이트웨이) */
export const PATH_AUTH_OPR_GOOGLE_LINK_START = "/api/auth/opr/google/link/start";

