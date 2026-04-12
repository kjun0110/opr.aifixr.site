import { API_PREFIX } from "./paths";
import { apiFetch } from "./client";

export const PCF_BASE = API_PREFIX.PCF;

export type PcfRunExecuteBody = {
  project_id: number;
  product_id: number;
  product_variant_id: number;
  reporting_year: number;
  reporting_month: number;
  calculation_mode: "partial" | "final";
};

export type PcfReadinessOprSupplierItem = {
  supplier_id: number;
  supplier_name?: string | null;
  supply_chain_node_id: number;
  ready: boolean;
};

export type PcfReadinessOprResponse = {
  project_id: number;
  product_id: number;
  product_variant_id: number;
  reporting_year: number;
  reporting_month: number;
  tier1_supplier_total: number;
  tier1_transfer_complete_count: number;
  all_tier1_transferred_to_opr: boolean;
  can_run_calculation: boolean;
  suppliers: PcfReadinessOprSupplierItem[];
};

export type PcfScopeItem = { scope: string; co2e_kg: number | null };

export type PcfRunExecuteResponse = {
  calculation_run_id: number;
  display_id: string;
  status: string;
  total_co2e_kg: number | null;
  pcf_per_declared_unit_kg?: number | null;
  pcf_per_product_mass_kg?: number | null;
  executed_by_name?: string | null;
  product_result_id: number | null;
  scopes: PcfScopeItem[];
  message?: string | null;
  /** 원청 자사 구간 총배출(부분산정과 동일 기준, kg) */
  opr_own_total_co2e_kg?: number | null;
  /** 최종 산정 시 1차 협력사 총배출 합(kg); 부분이면 0 */
  opr_tier1_upstream_total_co2e_kg?: number | null;
};

export type PcfRunListItem = {
  id: number;
  display_id: string;
  project_id: number;
  product_id: number;
  product_name?: string | null;
  product_variant_id?: number | null;
  bom_label?: string | null;
  reporting_year: number;
  reporting_month: number;
  run_kind: string;
  status: string;
  total_co2e_kg?: number | null;
  pcf_per_declared_unit_kg?: number | null;
  pcf_per_product_mass_kg?: number | null;
  triggered_by_user_id?: number | null;
  executed_by_name?: string | null;
  created_at?: string | null;
  finished_at?: string | null;
};

export type GetOprPcfRunsQuery = {
  project_id: number;
  product_id?: number;
  product_variant_id?: number;
  reporting_year?: number;
  reporting_month?: number;
  limit?: number;
  offset?: number;
};

export async function postOprPcfRunExecute(
  body: PcfRunExecuteBody,
): Promise<PcfRunExecuteResponse> {
  return apiFetch<PcfRunExecuteResponse>(`${PCF_BASE}/runs/execute/opr`, {
    method: "POST",
    json: body,
  });
}

export async function getOprPcfRuns(query: GetOprPcfRunsQuery): Promise<PcfRunListItem[]> {
  const params = new URLSearchParams();
  params.set("project_id", String(query.project_id));
  if (typeof query.product_id === "number") params.set("product_id", String(query.product_id));
  if (typeof query.product_variant_id === "number") params.set("product_variant_id", String(query.product_variant_id));
  if (typeof query.reporting_year === "number") params.set("reporting_year", String(query.reporting_year));
  if (typeof query.reporting_month === "number") params.set("reporting_month", String(query.reporting_month));
  params.set("limit", String(query.limit ?? 100));
  params.set("offset", String(query.offset ?? 0));
  return apiFetch<PcfRunListItem[]>(`${PCF_BASE}/runs?${params.toString()}`);
}

export async function getOprPcfReadinessForNotify(query: {
  project_id: number;
  product_id: number;
  product_variant_id: number;
  reporting_year: number;
  reporting_month: number;
}): Promise<PcfReadinessOprResponse> {
  const params = new URLSearchParams({
    project_id: String(query.project_id),
    product_id: String(query.product_id),
    product_variant_id: String(query.product_variant_id),
    reporting_year: String(query.reporting_year),
    reporting_month: String(query.reporting_month),
  });
  return apiFetch<PcfReadinessOprResponse>(`${PCF_BASE}/readiness/opr?${params.toString()}`);
}

