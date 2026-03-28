import { apiFetch, apiFetchBlob } from "./client";
import { API_PREFIX } from "./paths";

export const DATA_CONTRACT_BASE = API_PREFIX.DATA_CONTRACT;

export type ContractRevisionListItem = {
  id: number;
  version_code: string;
  title: string;
  summary: string | null;
  effective_from: string;
  effective_until: string | null;
  retired_at: string | null;
  status: string;
  is_current: boolean;
  approver_label: string | null;
  document_storage_key: string;
  document_preview_url: string | null;
  document_download_url: string | null;
};

export type ContractRevisionCurrentResponse = {
  id: number;
  version_code: string;
  title: string;
  summary: string | null;
  effective_from: string;
  status: string;
  is_current: boolean;
  approver_label: string | null;
  document_storage_key: string;
  document_preview_url: string | null;
  document_download_url: string | null;
};

export type RevisionStatusCountsResponse = {
  draft: number;
  review: number;
  approved: number;
  active: number;
  retired: number;
};

export function dataContractRevisionPreviewPath(revisionId: number): string {
  return `${DATA_CONTRACT_BASE}/revisions/${revisionId}/preview`;
}

export function dataContractRevisionDownloadPath(revisionId: number): string {
  return `${DATA_CONTRACT_BASE}/revisions/${revisionId}/download`;
}

export async function listContractRevisions(params?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<ContractRevisionListItem[]> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetch<ContractRevisionListItem[]>(
    `${DATA_CONTRACT_BASE}/revisions${qs ? `?${qs}` : ""}`,
  );
}

export async function getCurrentContractRevision(): Promise<ContractRevisionCurrentResponse> {
  return apiFetch<ContractRevisionCurrentResponse>(
    `${DATA_CONTRACT_BASE}/revisions/current`,
  );
}

export async function getContractRevisionStatusCounts(): Promise<RevisionStatusCountsResponse> {
  return apiFetch<RevisionStatusCountsResponse>(
    `${DATA_CONTRACT_BASE}/revisions/status-counts`,
  );
}

export async function fetchContractRevisionPdfBlob(revisionId: number): Promise<Blob> {
  return apiFetchBlob(dataContractRevisionPreviewPath(revisionId));
}

export async function downloadContractRevisionPdf(
  revisionId: number,
  fallbackFileName: string,
): Promise<void> {
  const blob = await apiFetchBlob(dataContractRevisionDownloadPath(revisionId));
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fallbackFileName.endsWith(".pdf") ? fallbackFileName : `${fallbackFileName}.pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 화면 표시용: DC-2026-03 → 3P-2026-03 */
export function displayVersionCode(versionCode: string): string {
  return versionCode.replace(/^DC/i, "3P");
}
