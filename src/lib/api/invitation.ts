import { apiFetch } from "./client";
import type { ContractRevisionCurrentResponse } from "./data-contract";
import { API_PREFIX } from "./paths";

const BASE = API_PREFIX.INVITATION;

/** 초대 모듈 살아 있는지 확인 */
export async function getInvitationHealth(): Promise<{
  module?: string;
  status?: string;
}> {
  return apiFetch(`${BASE}/public/health`);
}

export type OprInvitePayload = {
  project_id: number;
  product_variant_id: number;
  supplier_id: number;
  invitee: {
    company_name: string;
    contact_name: string;
    email: string;
  };
  expire_days?: number;
  email_subject?: string;
  email_body?: string;
};

export type InvitationCreatedItem = {
  id: number;
  invitee_email?: string | null;
  invitee_company_hint?: string | null;
  invitee_name?: string | null;
  status: string;
  sent_at?: string | null;
  expires_at?: string | null;
  public_token: string;
};

export type InvitationHistoryItem = {
  id: number;
  project_id: number;
  product_id: number;
  product_variant_id: number;
  invitee_company_hint?: string | null;
  invitee_name?: string | null;
  invitee_email?: string | null;
  status: string;
  sent_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  last_signup_request_id?: number | null;
  /** 승인 대기(pending_approval) 가입 신청 id — 있을 때만 직상위 승인/반려 UI */
  pending_signup_request_id?: number | null;
};

export async function postOprInvitation(
  payload: OprInvitePayload,
): Promise<InvitationCreatedItem> {
  return apiFetch<InvitationCreatedItem>(`${BASE}/opr/invitations`, {
    method: "POST",
    json: payload,
  });
}

/** 초대 메일에 실제 첨부되는 DATA CONTRACT 개정 (is_current·active) */
export async function getInvitationAttachmentDataContractRevision(): Promise<ContractRevisionCurrentResponse> {
  return apiFetch<ContractRevisionCurrentResponse>(
    `${BASE}/invitations/attachment-data-contract-revision`,
  );
}

export async function getInvitationHistory(params?: {
  project_id?: number;
  limit?: number;
  offset?: number;
}): Promise<InvitationHistoryItem[]> {
  const q = new URLSearchParams();
  if (params?.project_id != null) q.set("project_id", String(params.project_id));
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiFetch<InvitationHistoryItem[]>(`${BASE}/invitations/history${suffix}`);
}

/** 발송 취소: 초대 `status` → revoked, 공개 링크·토큰 무효 */
export async function postRevokeInvitation(invitationId: number): Promise<{ id: number; status: string }> {
  return apiFetch<{ id: number; status: string }>(`${BASE}/invitations/${invitationId}/revoke`, {
    method: "POST",
  });
}

