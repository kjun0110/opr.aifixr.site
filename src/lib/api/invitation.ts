import { apiFetch } from "./client";
import { API_PREFIX } from "./paths";

const BASE = API_PREFIX.INVITATION;

/** 초대 모듈 살아 있는지 확인 */
export async function getInvitationHealth(): Promise<{
  module?: string;
  status?: string;
}> {
  return apiFetch(`${BASE}/public/health`);
}

// TODO: POST /sup/invitations, POST /opr/invitations 등

