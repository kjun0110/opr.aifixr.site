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
  /** opr_supply_contracts.supplied_item_name (해당 세부제품·프로젝트, 중복 제거) */
  tier1_contract_supplied_item_names?: string[];
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

export type OprPcfReadinessResponse = {
  product_variant_id: number;
  reporting_year: number;
  reporting_month: number;
  cust_branch_id: number;
  operator_data_ready: boolean;
  operator_tier0_rows: boolean;
  operator_process_activity_rows: boolean;
  supplier_total: number;
  supplier_submitted: number;
  all_suppliers_submitted: boolean;
};

export async function getOprPcfReadiness(
  productVariantId: number,
  reportingYear: number,
  reportingMonth: number,
  custBranchId: number,
): Promise<OprPcfReadinessResponse> {
  const q = new URLSearchParams({ cust_branch_id: String(custBranchId) });
  return apiFetch<OprPcfReadinessResponse>(
    `/api/data-mgmt/opr/product-variants/${productVariantId}/months/${reportingYear}/${reportingMonth}/pcf-readiness?${q}`,
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

/** Tier0 상세 — tier0_row_context·IAM·DB 기준 시트 (탭 1~3·8·4~7, 시트 2는 X-Actor-User-Id 필요) */
export async function downloadOprTier0ExportXlsx(params: {
  custBranchId: number;
  productVariantId: number;
  reportingYear: number;
  reportingMonth: number;
  sheetTabIds: number[];
}): Promise<Blob> {
  const q = new URLSearchParams({
    cust_branch_id: String(params.custBranchId),
    product_variant_id: String(params.productVariantId),
    reporting_year: String(params.reportingYear),
    reporting_month: String(params.reportingMonth),
    sheets: params.sheetTabIds.join(","),
  });
  return apiFetchBlob(`/api/data-mgmt/opr/tier0/export.xlsx?${q.toString()}`, {
    method: "GET",
  });
}

/** Tier0 공장 입력(탭 4~7) — API snake_case */
export type OprTier0WorkplaceContactRowApi = {
  site_name?: string;
  department?: string;
  position?: string;
  job_title?: string;
  name?: string;
  email?: string;
  phone?: string;
};

export type OprTier0MaterialRowApi = {
  detail_product_name?: string;
  process_name?: string;
  input_material_name?: string;
  input_amount?: string;
  input_amount_unit?: string;
  material_emission_factor?: string;
  material_emission_factor_unit?: string;
  mineral_type?: string;
  mineral_amount?: string;
  mineral_amount_unit?: string;
  mineral_origin?: string;
  mineral_emission_factor?: string;
  mineral_emission_factor_unit?: string;
};

export type OprTier0EnergyRowApi = {
  detail_product_name?: string;
  process_name?: string;
  energy_type?: string;
  energy_usage?: string;
  energy_unit?: string;
  energy_emission_factor?: string;
  energy_emission_factor_unit?: string;
};

export type OprTier0ProductionRowApi = {
  detail_product_name?: string;
  site_name?: string;
  production_qty?: string;
  production_qty_unit?: string;
  waste_qty?: string;
  waste_qty_unit?: string;
  waste_emission_factor?: string;
  waste_emission_factor_unit?: string;
};

export type OprTier0TransportRowApi = {
  detail_product_name?: string;
  origin_country?: string;
  origin_address_detail?: string;
  destination_country?: string;
  destination_address_detail?: string;
  transport_mode?: string;
  transport_qty?: string;
  transport_qty_unit?: string;
  transport_emission_factor?: string;
  transport_emission_factor_unit?: string;
};

export type OprTier0FactoryDataResponse = {
  warnings?: string[];
  workplace_contacts: OprTier0WorkplaceContactRowApi[];
  materials: OprTier0MaterialRowApi[];
  energy_rows: OprTier0EnergyRowApi[];
  production_rows: OprTier0ProductionRowApi[];
  transport_rows?: OprTier0TransportRowApi[];
};

export type OprTier0ImportPreviewResponse = OprTier0FactoryDataResponse;

export type OprTier0FactoryDataSaveRequest = {
  workplace_contacts: OprTier0WorkplaceContactRowApi[];
  materials: OprTier0MaterialRowApi[];
  energy_rows: OprTier0EnergyRowApi[];
  production_rows: OprTier0ProductionRowApi[];
  transport_rows?: OprTier0TransportRowApi[];
};

export type OprTier0FactoryDataSaveResponse = {
  saved: boolean;
  message?: string;
  warnings?: string[];
};

export async function postOprTier0ImportPreview(file: File): Promise<OprTier0ImportPreviewResponse> {
  const fd = new FormData();
  fd.append("file", file);
  return apiFetch<OprTier0ImportPreviewResponse>("/api/data-mgmt/opr/tier0/import-preview", {
    method: "POST",
    body: fd,
  });
}

export async function getOprTier0FactoryData(params: {
  custBranchId: number;
  productVariantId: number;
  reportingYear: number;
  reportingMonth: number;
}): Promise<OprTier0FactoryDataResponse> {
  const q = new URLSearchParams({
    cust_branch_id: String(params.custBranchId),
    product_variant_id: String(params.productVariantId),
    reporting_year: String(params.reportingYear),
    reporting_month: String(params.reportingMonth),
  });
  return apiFetch<OprTier0FactoryDataResponse>(`/api/data-mgmt/opr/tier0/factory-data?${q}`);
}

export async function putOprTier0FactoryData(params: {
  custBranchId: number;
  productVariantId: number;
  reportingYear: number;
  reportingMonth: number;
  team: "esg" | "pcf";
  body: OprTier0FactoryDataSaveRequest;
}): Promise<OprTier0FactoryDataSaveResponse> {
  const q = new URLSearchParams({
    cust_branch_id: String(params.custBranchId),
    product_variant_id: String(params.productVariantId),
    reporting_year: String(params.reportingYear),
    reporting_month: String(params.reportingMonth),
    team: params.team,
  });
  return apiFetch<OprTier0FactoryDataSaveResponse>(
    `/api/data-mgmt/opr/tier0/factory-data?${q}`,
    { method: "PUT", json: params.body },
  );
}

export type OprDataRequestCreateBody = {
  project_id: number;
  product_id: number;
  product_variant_id: number;
  reporting_year: number;
  reporting_month: number;
  requester_supply_chain_node_id?: number | null;
  requested_by_user_id?: number | null;
  request_mode?: "chain" | "direct";
  message?: string | null;
  due_date?: string | null;
  target_supply_chain_node_ids: number[];
};

export type OprDataRequestCreateResponse = {
  request_id: number;
  status: string;
  target_count: number;
  message: string;
};

export async function postOprDataRequest(
  body: OprDataRequestCreateBody,
): Promise<OprDataRequestCreateResponse> {
  return apiFetch<OprDataRequestCreateResponse>("/api/data-mgmt/opr/data-requests", {
    method: "POST",
    json: body,
  });
}
