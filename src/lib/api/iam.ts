import { apiFetch } from "./client";
import { API_PREFIX } from "./paths";

/** IAM 베이스 경로 — 가입·승인·로그인 등 */
export const IAM_BASE = API_PREFIX.IAM;

/**
 * 협력사 가입 신청 승인
 */
export async function approveSignupRequest(signupRequestId: number): Promise<void> {
  await apiFetch(`${IAM_BASE}/signup-requests/${signupRequestId}/approve`, {
    method: "POST",
  });
}

/**
 * 협력사 가입 신청 반려
 */
export async function rejectSignupRequest(
  signupRequestId: number,
  reason?: string
): Promise<void> {
  await apiFetch(`${IAM_BASE}/signup-requests/${signupRequestId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

