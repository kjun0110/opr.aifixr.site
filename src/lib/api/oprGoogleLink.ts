import { apiFetch } from "./client";
import { PATH_AUTH_OPR_GOOGLE_LINK_START } from "./paths";

/** OAuth 완료 후 돌아올 경로 (sessionStorage) */
export const OPR_GOOGLE_LINK_RETURN_STORAGE_KEY = "aifix_opr_google_link_return";

/** 초대 모달이 있는 페이지로 복귀 + 모달 자동 오픈용 쿼리 */
const TIER1_INVITE_REOPEN_QUERY = "tier1Invite=1";

/**
 * Gmail 연동(초대 발송 428) 직전 현재 화면으로 돌아가며, 1차 초대 모달을 다시 연다.
 * (예: /dashboard/project-supply-chain → 동일 경로?tier1Invite=1)
 */
export function buildPathForOprInviteGoogleLinkReturn(): string {
  if (typeof window === "undefined") {
    return `/dashboard/project-supply-chain?${TIER1_INVITE_REOPEN_QUERY}`;
  }
  const u = new URL(window.location.href);
  u.searchParams.set("tier1Invite", "1");
  return `${u.pathname}${u.search}`;
}

export async function fetchOprGoogleLinkAuthUrl(): Promise<string> {
  const data = await apiFetch<{ authUrl?: string; error?: string }>(
    PATH_AUTH_OPR_GOOGLE_LINK_START,
    { method: "GET" },
  );
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(data.error);
  }
  if (!data || typeof data !== "object" || !data.authUrl) {
    throw new Error("Google 연동 URL을 받지 못했습니다.");
  }
  return data.authUrl;
}

/**
 * 게이트웨이 `frontend-after-link`는 기본 `/dashboard?google_linked=1`.
 * 복귀 핸들러가 실제 업무 경로로 교체한다.
 */
export function rememberReturnPathForOprGoogleLink(fromInvite?: boolean): void {
  if (typeof window === "undefined") return;
  const path = fromInvite
    ? buildPathForOprInviteGoogleLinkReturn()
    : `${window.location.pathname}${window.location.search}`;
  sessionStorage.setItem(OPR_GOOGLE_LINK_RETURN_STORAGE_KEY, path);
}

export type StartOprGoogleLinkFlowOptions = {
  /** true면 연동 후 초대 모달이 있던 페이지로 복귀(모달 자동 오픈) */
  fromInvite?: boolean;
};

/**
 * Gmail 초대 발송용 Google 연동 시작 (전체 페이지 이동).
 */
export async function startOprGoogleLinkFlow(
  opts?: StartOprGoogleLinkFlowOptions,
): Promise<void> {
  rememberReturnPathForOprGoogleLink(opts?.fromInvite === true);
  const authUrl = await fetchOprGoogleLinkAuthUrl();
  window.location.assign(authUrl);
}
