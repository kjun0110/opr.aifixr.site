import { apiFetch, apiFetchBlob } from "./client";

/** 스코프: `cust_branch_id` 또는 `opr_customer_id` 중 하나만 설정 */
export type OprQueryRequest = {
  cust_branch_id?: number;
  opr_customer_id?: number;
  product_id?: number | null;
  product_variant_id?: number | null;
  period_start?: string | null;
  period_end?: string | null;
  selected_months?: number[][] | null;
};

export type OprProductVariantResultItem = {
  product_variant_id: number;
  product_variant_name: string;
  product_variant_code: string | null;
  product_id: number;
  product_name: string;
  bom_code: string | null;
  month_count: number;
  cust_branch_id: number;
  project_id: number;
};

export type OprQueryResponse = {
  project_id: number | null;
  cust_branch_id: number | null;
  opr_customer_id?: number | null;
  product_variants: OprProductVariantResultItem[];
  summary_text: string;
};

export type OprMonthlyTierRow = {
  tier: number;
  tier_label: string;
  company_name: string;
  country: string | null;
  company_type: string | null;
  delivery_qty: string | null;
  product_type: string | null;
  pcf_result_kg_co2e: string | null;
  status_code: string;
  status_message: string | null;
  detail_key: string | null;
};

export type OprMonthlyOverviewResponse = {
  product_variant_id: number;
  reporting_year: number;
  reporting_month: number;
  rows: OprMonthlyTierRow[];
  outlier_review_phase: string;
};

export type BomAndPeriodBrief = {
  bom_code: string | null;
  project_start: string;
  project_end: string;
};

export type OprTier0WorkplaceRow = {
  workplace_name: string;
  business_reg_no?: string | null;
  workplace_no?: string | null;
  country?: string | null;
  address?: string | null;
  rep_name?: string | null;
  rep_email?: string | null;
  rep_contact?: string | null;
};

export type OprTier0EquipmentRow = {
  workplace_name: string;
  equipment_type?: string | null;
  process_name?: string | null;
  equipment_name: string;
  equipment_no: string;
};

export type OprTier0RowContextResponse = {
  opr_customer_id: number;
  customer_name: string;
  cust_branch_id: number;
  branch_name: string;
  project_id: number;
  product_id: number;
  product_name: string;
  product_variant_id: number;
  product_variant_name: string;
  product_variant_code?: string | null;
  bom_code?: string | null;
  project_start: string;
  project_end: string;
  workplaces: OprTier0WorkplaceRow[];
  equipments?: OprTier0EquipmentRow[];
};

/** 본법인 opr_company_orgs (snake_case / camelCase 혼용 가능) */
export type OprAnchorCompanyResponse = {
  company_name?: string | null;
  business_reg_no?: string | null;
  country?: string | null;
  address?: string | null;
  duns_number?: string | null;
  tax_id?: string | null;
  website_url?: string | null;
  rep_name?: string | null;
  rep_email?: string | null;
  rep_contact?: string | null;
};

export async function postOprQuery(body: OprQueryRequest): Promise<OprQueryResponse> {
  return apiFetch<OprQueryResponse>("/api/data-mgmt/opr/query", {
    method: "POST",
    json: body,
  });
}

export async function getOprAnchorCompany(): Promise<OprAnchorCompanyResponse> {
  return apiFetch<OprAnchorCompanyResponse>("/api/data-mgmt/opr/anchor-company");
}

export async function getOprTier0RowContext(
  custBranchId: number,
  productVariantId: number,
): Promise<OprTier0RowContextResponse> {
  const q = new URLSearchParams({
    cust_branch_id: String(custBranchId),
    product_variant_id: String(productVariantId),
  });
  return apiFetch<OprTier0RowContextResponse>(
    `/api/data-mgmt/opr/tier0-row-context?${q}`,
  );
}

export async function getOprBomPeriod(
  productVariantId: number,
  custBranchId: number,
): Promise<BomAndPeriodBrief> {
  const q = new URLSearchParams({ cust_branch_id: String(custBranchId) });
  return apiFetch<BomAndPeriodBrief>(
    `/api/data-mgmt/opr/product-variants/${productVariantId}/bom-period?${q}`,
  );
}

export async function getOprMonthlyOverview(
  productVariantId: number,
  reportingYear: number,
  reportingMonth: number,
  custBranchId: number,
): Promise<OprMonthlyOverviewResponse> {
  const q = new URLSearchParams({ cust_branch_id: String(custBranchId) });
  return apiFetch<OprMonthlyOverviewResponse>(
    `/api/data-mgmt/opr/product-variants/${productVariantId}/months/${reportingYear}/${reportingMonth}/overview?${q}`,
  );
}

export async function downloadOprExport(
  format: "csv" | "xlsx",
  body: OprQueryRequest,
): Promise<Blob> {
  const path =
    format === "csv" ? "/api/data-mgmt/opr/export/csv" : "/api/data-mgmt/opr/export/xlsx";
  return apiFetchBlob(path, { method: "POST", json: body });
}
