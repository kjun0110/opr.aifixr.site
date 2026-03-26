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

export type OprInvitePayload = {
  product_variant_id: number;
  supplier_id: number;
  invitee: {
    company_name: string;
    contact_name: string;
    email: string;
  };
  expire_days?: number;
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
};

export async function postOprInvitation(
  payload: OprInvitePayload,
): Promise<InvitationCreatedItem> {
  return apiFetch<InvitationCreatedItem>(`${BASE}/opr/invitations`, {
    method: "POST",
    json: payload,
  });
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

