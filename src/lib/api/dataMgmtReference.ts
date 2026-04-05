import { apiFetch } from "./client";

export type RefEprCo2eFactorItem = {
  id: number;
  dataset_key: string;
  major_category: string;
  sub_category: string;
  item_name: string;
  activity_unit: string;
  co2e_factor: string;
};

export type RefEprCo2eFactorListResponse = {
  items: RefEprCo2eFactorItem[];
  total: number;
};

export type RefEprCo2eDatasetItem = {
  dataset_key: string;
  row_count: number;
};

export type RefEprCo2eDatasetListResponse = {
  items: RefEprCo2eDatasetItem[];
  default_dataset_key: string | null;
};

export async function getEprCo2eDatasets(): Promise<RefEprCo2eDatasetListResponse> {
  return apiFetch<RefEprCo2eDatasetListResponse>("/api/data-mgmt/reference/epr-co2e/datasets", {
    method: "GET",
  });
}

export async function searchEprCo2eFactors(params: {
  datasetKey?: string | null;
  q?: string;
  majorCategory?: string;
  subCategory?: string;
  limit?: number;
  offset?: number;
}): Promise<RefEprCo2eFactorListResponse> {
  const q = new URLSearchParams();
  if (params.datasetKey) q.set("dataset_key", params.datasetKey);
  if (params.q?.trim()) q.set("q", params.q.trim());
  if (params.majorCategory?.trim()) q.set("major_category", params.majorCategory.trim());
  if (params.subCategory?.trim()) q.set("sub_category", params.subCategory.trim());
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return apiFetch<RefEprCo2eFactorListResponse>(
    `/api/data-mgmt/reference/epr-co2e/factors${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  );
}

export async function getEprCo2eMajors(datasetKey?: string | null): Promise<string[]> {
  const q = datasetKey ? `?dataset_key=${encodeURIComponent(datasetKey)}` : "";
  return apiFetch<string[]>(`/api/data-mgmt/reference/epr-co2e/filters/majors${q}`, {
    method: "GET",
  });
}

export async function getEprCo2eSubs(
  datasetKey: string | null | undefined,
  majorCategory: string | null | undefined,
): Promise<string[]> {
  const q = new URLSearchParams();
  if (datasetKey) q.set("dataset_key", datasetKey);
  if (majorCategory?.trim()) q.set("major_category", majorCategory.trim());
  const qs = q.toString();
  return apiFetch<string[]>(`/api/data-mgmt/reference/epr-co2e/filters/subs${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

/** 배출계수 단위 표기 (활동 단위 기준) */
export function formatEprCo2eFactorUnit(activityUnit: string): string {
  const u = (activityUnit || "").trim();
  return u ? `kg CO2 eq./${u}` : "kg CO2 eq.";
}
