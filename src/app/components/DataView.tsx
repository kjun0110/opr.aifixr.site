'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Search, Download, Upload, FileText, Filter, AlertTriangle, CheckCircle, Clock, MapPin, Folder, Info, Settings, Edit2, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import ExportReportModal from './ExportReportModal';
import ProcurementDetailModal from './ProcurementDetailModal';
import PcfDetailModal from './PcfDetailModal';
import MonthRangePicker from './MonthRangePicker';
import SupplyChainVersionModal from './SupplyChainVersionModal';
import { useMode } from '../context/ModeContext';
import { apiFetch, restoreOprSessionFromCookie } from '@/lib/api/client';
import { getOprAccessToken } from '@/lib/api/sessionAccessToken';
import type { OprDataRequestCreateBody, OprMonthlyTierRow, OprQueryRequest } from '@/lib/api/dataMgmtOpr';
import {
  downloadOprExport,
  getOprBomPeriod,
  getOprMonthlyOverview,
  postOprDataRequest,
  postOprQuery,
} from '@/lib/api/dataMgmtOpr';
import { saveSupplierDetailSnapshot } from '@/lib/dataViewSupplierSnapshot';

/** 월별 공급망 트리 그리드. 회사명 열에 0.5fr만 주면 min-w-0과 맞물려 폭이 0으로 붕괴해 텍스트가 안 보일 수 있음 */
const DATA_VIEW_MONTH_TREE_GRID_COLS =
  'minmax(150px, 180px) minmax(70px, 90px) minmax(160px, 1.2fr) minmax(0, 1fr) minmax(100px, 130px) minmax(90px, 120px) minmax(115px, 150px) minmax(0, 1fr) minmax(115px, 150px) minmax(0, 1fr) minmax(90px, 110px) minmax(0, 1fr)';

// Unified data structure - contains both procurement and PCF data
interface DataNode {
  id: string;
  supplyChainNodeId?: number | null;
  tier: string;
  companyName: string;
  companyNameEn: string;
  // Company info
  country: string;
  companyType: 'Operator' | 'Supplier' | 'Customer';
  // Supply data
  deliveryVolume: number; // 납품량 (kg)
  rawMaterialInput: number; // 원재료 투입량 (kg)
  productType: string; // 제품 유형
  // Carbon data
  emissionSource: string; // 배출계수 DB
  pcfResult: number | null; // PCF 결과 (kg CO₂e) - null이면 미산정
  emissionIntensity: number | null; // 배출 강도 (kg CO₂e/kg) - null이면 미산정
  // Status - 분리된 3가지 상태
  dataSubmissionStatus: 'submitted' | 'not-submitted'; // 데이터 제출 상태
  verificationStatus: 'verified' | 'not-verified'; // 검증 상태
  riskLevel: 'high' | 'medium' | 'low'; // 리스크 상태
  // Additional fields for compatibility
  dataInputStatus: 'completed' | 'in-progress' | 'pending';
  pcfCalculationStatus: 'verified' | 'calculated' | 'pending' | 'submitted';
  submissionStatus: 'verified' | 'submitted' | 'pending';
  lastUpdate: string;
  children?: DataNode[];
}

// Result card: one per 세부제품. Blue header shows customer, branch, product, detail product, BOM.
interface DetailProductCard {
  id: string;
  customer: string;
  branch: string;
  product: string;
  detailProduct: string;
  bomCode: string;
  custBranchId: number;
  productVariantId: number;
  projectId: number;
  productId: number;
}

/** 공급망 캐스케이드 1행 (고객→지사→프로젝트→제품→세부제품) */
type ScaffoldVariantRow = {
  customerId: number;
  customerName: string;
  branchId: number;
  branchName: string;
  projectId: number;
  projectStartIso: string;
  projectEndIso: string;
  productId: number;
  productName: string;
  variantId: number;
  variantName: string;
  variantCode: string | null;
};

function parseIsoToYearMonth(iso: string): { y: number; m: number } {
  const d = new Date(iso);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function enumerateMonthsBetweenYm(startYm: string, endYm: string): string[] {
  if (!startYm || !endYm || startYm > endYm) return [];
  const [sy, sm] = startYm.split('-').map(Number);
  const [ey, em] = endYm.split('-').map(Number);
  const out: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

function monthsFromProjectIso(startIso: string, endIso: string): string[] {
  const s = parseIsoToYearMonth(startIso);
  const e = parseIsoToYearMonth(endIso);
  const startYm = `${s.y}-${String(s.m).padStart(2, '0')}`;
  const endYm = `${e.y}-${String(e.m).padStart(2, '0')}`;
  return enumerateMonthsBetweenYm(startYm, endYm);
}

function intersectMonthLists(a: string[], b: string[]): string[] {
  const setA = new Set(a);
  return b.filter((x) => setA.has(x));
}

function lastDayOfMonth(y: number, mo: number): number {
  return new Date(y, mo, 0).getDate();
}

function periodEndDate(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = lastDayOfMonth(y, m);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function periodStartDate(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

/** 고객사 전체 조회 시: 각 지사 프로젝트 기간 ∩ 사용자 기간의 월 합집합(정렬) */
function unionIntersectedMonthsForCustomerBranches(
  customerId: number,
  generalStart: string,
  generalEnd: string,
  scaffold: ScaffoldVariantRow[],
): string[] {
  const userMonths = enumerateMonthsBetweenYm(generalStart, generalEnd);
  const branchIds = [
    ...new Set(
      scaffold.filter((r) => r.customerId === customerId).map((r) => r.branchId),
    ),
  ];
  const acc = new Set<string>();
  for (const bid of branchIds) {
    const row = scaffold.find((r) => r.branchId === bid && r.customerId === customerId);
    if (!row) continue;
    const pm = monthsFromProjectIso(row.projectStartIso, row.projectEndIso);
    intersectMonthLists(pm, userMonths).forEach((m) => acc.add(m));
  }
  return Array.from(acc).sort();
}

function parsePcfKg(s: string | null | undefined): number | null {
  if (s == null || String(s).trim() === '') return null;
  const n = parseFloat(String(s).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** 응답이 snake_case 또는 camelCase일 때 월별 overview 문자열 필드 정규화 */
function pickMonthlyRowString(
  row: OprMonthlyTierRow,
  snake: keyof OprMonthlyTierRow,
  camel: string,
): string | undefined {
  const rec = row as unknown as Record<string, unknown>;
  const raw = row[snake] ?? rec[camel];
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s === '' ? undefined : s;
}

function rowToDataNode(row: OprMonthlyTierRow, id: string): DataNode {
  const pcfRaw = pickMonthlyRowString(row, 'pcf_result_kg_co2e', 'pcfResultKgCo2e') ?? row.pcf_result_kg_co2e;
  const pcf = parsePcfKg(pcfRaw);
  const tierLabel =
    pickMonthlyRowString(row, 'tier_label', 'tierLabel')?.trim() || `Tier ${row.tier}`;
  const statusCode = pickMonthlyRowString(row, 'status_code', 'statusCode') ?? row.status_code;
  let dataSubmissionStatus: DataNode['dataSubmissionStatus'] = 'submitted';
  if (statusCode === 'pending') dataSubmissionStatus = 'not-submitted';

  const companyTypeRaw =
    pickMonthlyRowString(row, 'company_type', 'companyType') ?? row.company_type ?? '';
  const companyType: DataNode['companyType'] =
    companyTypeRaw === 'Operator' || row.tier === 0 ? 'Operator' : 'Supplier';

  let companyName = pickMonthlyRowString(row, 'company_name', 'companyName');
  if ((companyName == null || companyName === '') && row.tier === 0) {
    companyName = '우리회사';
  }
  if (companyName == null || companyName === '') {
    companyName = '-';
  }
  const productType = pickMonthlyRowString(row, 'product_type', 'productType') ?? '-';

  const detailKey = pickMonthlyRowString(row, 'detail_key', 'detailKey') ?? '';
  const nodeMatch = /^node:(\d+):/.exec(detailKey);
  const supplyChainNodeId = nodeMatch ? Number(nodeMatch[1]) : null;
  return {
    id,
    supplyChainNodeId,
    tier: tierLabel,
    companyName,
    companyNameEn: '',
    country: pickMonthlyRowString(row, 'country', 'country') ?? row.country ?? '',
    companyType,
    deliveryVolume: 0,
    rawMaterialInput: 0,
    productType,
    emissionSource: '',
    pcfResult: pcf,
    emissionIntensity: null,
    dataSubmissionStatus,
    verificationStatus: statusCode === 'ok' ? 'verified' : 'not-verified',
    riskLevel: statusCode === 'warning_lower_tier' ? 'medium' : 'low',
    dataInputStatus: 'completed',
    pcfCalculationStatus: pcf != null ? 'verified' : 'pending',
    submissionStatus: statusCode === 'ok' ? 'verified' : 'pending',
    lastUpdate: '',
  };
}

/** 백엔드 월별 평면 행 → 티어 부모 스택으로 트리 구성 (API 행 순서 전제) */
function monthlyRowsToTree(rows: OprMonthlyTierRow[], cardId: string, month: string): DataNode {
  const prefix = `${cardId}-${month}`;
  if (!rows.length) {
    return {
      id: `${prefix}-empty-tier0`,
      tier: 'Tier 0',
      companyName: '데이터 없음',
      companyNameEn: '',
      country: '',
      companyType: 'Operator',
      deliveryVolume: 0,
      rawMaterialInput: 0,
      productType: '-',
      emissionSource: '',
      pcfResult: null,
      emissionIntensity: null,
      dataSubmissionStatus: 'not-submitted',
      verificationStatus: 'not-verified',
      riskLevel: 'low',
      dataInputStatus: 'pending',
      pcfCalculationStatus: 'pending',
      submissionStatus: 'pending',
      lastUpdate: '',
    };
  }

  const i0 = rows.findIndex((r) => r.tier === 0);
  const rootSource = i0 >= 0 ? rows[i0]! : rows[0]!;
  const root = rowToDataNode(rootSource, `${prefix}-tier0`);
  const rest = i0 >= 0 ? rows.filter((_, idx) => idx !== i0) : rows.slice(1);

  const lastAtTier = new Map<number, DataNode>();
  lastAtTier.set(rootSource.tier, root);

  let seq = 0;
  for (const r of rest) {
    // URL·sessionStorage 키에 `:` 포함 시 라우터/인코딩과 어긋날 수 있어 제거
    const safeKey = (r.detail_key ?? `seq-${seq++}`).replace(/[^\w-]/g, '_');
    const node = rowToDataNode(r, `${prefix}-n-${safeKey}`);
    const pt = r.tier - 1;
    const parent = lastAtTier.get(pt) ?? root;
    if (!parent.children) parent.children = [];
    parent.children.push(node);
    lastAtTier.set(r.tier, node);
    for (const k of [...lastAtTier.keys()]) {
      if (k > r.tier) lastAtTier.delete(k);
    }
  }
  return root;
}

// Supply Chain Group & Version for matching
interface SupplyChainGroup {
  id: string;
  groupCode: string;
  groupName: string;
  productId: string;
}

interface SupplyChainVersion {
  id: string;
  groupId: string;
  versionCode: string;
  versionNumber: string;
  baseDate: string;
  isStructureChanged: boolean;
  changeType: 'structure-created' | 'info-modified' | 'structure-changed';
  changeReason: string;
  supplierCount: number;
  status: 'active' | 'inactive';
}

// Mock Supply Chain Groups
const mockSupplyChainGroups: SupplyChainGroup[] = [
  { id: 'sg1', groupCode: 'SC-1', groupName: '표준 공급망', productId: 'prod1' },
  { id: 'sg2', groupCode: 'SC-2', groupName: '친환경 공급망', productId: 'prod1' },
  { id: 'sg3', groupCode: 'SC-3', groupName: '차세대 공급망', productId: 'prod2' },
];

// Mock Supply Chain Versions
const mockSupplyChainVersions: SupplyChainVersion[] = [
  { id: 'v1', groupId: 'sg1', versionCode: 'SC-1.2', versionNumber: '1.2', baseDate: '2026-03-01', isStructureChanged: false, changeType: 'info-modified', changeReason: '협력사 담당자 정보 업데이트', supplierCount: 14, status: 'active' },
  { id: 'v2', groupId: 'sg1', versionCode: 'SC-1.1', versionNumber: '1.1', baseDate: '2026-02-15', isStructureChanged: true, changeType: 'structure-changed', changeReason: '1차 협력사 변경 (한국배터리 추가)', supplierCount: 13, status: 'inactive' },
  { id: 'v5', groupId: 'sg1', versionCode: 'SC-1.0', versionNumber: '1.0', baseDate: '2026-01-01', isStructureChanged: false, changeType: 'structure-created', changeReason: '표준 공급망 초기 구성', supplierCount: 12, status: 'inactive' },
  { id: 'v3', groupId: 'sg2', versionCode: 'SC-2.1', versionNumber: '2.1', baseDate: '2026-02-20', isStructureChanged: false, changeType: 'info-modified', changeReason: '친환경 소재 협력사 정보 갱신', supplierCount: 12, status: 'active' },
  { id: 'v6', groupId: 'sg2', versionCode: 'SC-2.0', versionNumber: '2.0', baseDate: '2026-01-15', isStructureChanged: true, changeType: 'structure-created', changeReason: '친환경 공급망 신규 구성', supplierCount: 11, status: 'inactive' },
  { id: 'v4', groupId: 'sg3', versionCode: 'SC-3.1', versionNumber: '3.1', baseDate: '2026-01-30', isStructureChanged: false, changeType: 'structure-created', changeReason: '차세대 전고체 배터리 공급망 구축', supplierCount: 9, status: 'active' },
];

// 조회조건 복원용 (상세보기→뒤로가기 시에만 복원)
const DATA_VIEW_FILTER_STORAGE_KEY = 'aifix_data_view_filters_v1';
const DATA_VIEW_BACK_FLAG_KEY = 'aifix_data_view_from_back_v1';

export default function DataView() {
  const { mode } = useMode();
  const router = useRouter();

  // Calculate default period: last completed 4-month range (월 단위)
  const getDefaultMonthRange = () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    // Determine current quarter (to derive 4-month window)
    let currentQuarter = Math.ceil(currentMonth / 3);
    
    // Use last completed quarter as default end
    let endQuarter = currentQuarter - 1;
    let endYear = currentYear;
    
    if (endQuarter === 0) {
      endQuarter = 4;
      endYear = currentYear - 1;
    }
    
    // Start quarter is 3 quarters before (=> 4 quarters, 12 months total)
    let startQuarter = endQuarter - 3;
    let startYear = endYear;
    
    if (startQuarter <= 0) {
      startQuarter += 4;
      startYear -= 1;
    }
    
    return {
      startMonth: `${startYear}-${String((startQuarter - 1) * 3 + 1).padStart(2, '0')}`,
      endMonth: `${endYear}-${String(endQuarter * 3).padStart(2, '0')}`,
    };
  };

  const defaultMonthRange = getDefaultMonthRange();

  const [scaffoldVariants, setScaffoldVariants] = useState<ScaffoldVariantRow[]>([]);
  const [scaffoldLoading, setScaffoldLoading] = useState(false);
  const [bomPeriodBrief, setBomPeriodBrief] = useState<{
    bom_code: string | null;
    project_start: string;
    project_end: string;
  } | null>(null);

  const [queriedCards, setQueriedCards] = useState<DetailProductCard[]>([]);
  const [queriedPeriodMonths, setQueriedPeriodMonths] = useState<string[]>([]);
  const [queriedSummaryText, setQueriedSummaryText] = useState('');
  const lastQueryBodyRef = useRef<OprQueryRequest | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  const [overviewByKey, setOverviewByKey] = useState<Record<string, DataNode>>({});
  const [overviewLoadingKey, setOverviewLoadingKey] = useState<string | null>(null);
  const [overviewErrorKey, setOverviewErrorKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let loadAttempted = false;

    const loadScaffold = async () => {
      if (loadAttempted) return;
      loadAttempted = true;
      setScaffoldLoading(true);
      try {
        // OprSessionRestore 와 경쟁 시 첫 요청이 토큰 없이 나가 401 나는 것 방지
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const customers = await apiFetch<{ id: number; name: string }[]>(
          '/api/supply-chain/project-supply-chain/customers',
        );
        const allBranchesNested = await Promise.all(
          customers.map(async (customer) => {
            try {
              const branches = await apiFetch<{ id: number; name?: string }[]>(
                `/api/supply-chain/project-supply-chain/customers/${customer.id}/branches`,
              );
              return branches.map((b) => ({ customer, branch: b }));
            } catch {
              return [];
            }
          }),
        );
        const allBranches = allBranchesNested.flat();

        const allProjectsResults = await Promise.all(
          allBranches.map(async ({ customer, branch }) => {
            try {
              const project = await apiFetch<{
                id: number;
                start_date: string;
                end_date: string;
              }>(`/api/supply-chain/project-supply-chain/branches/${branch.id}/project`);
              return { customer, branch, project };
            } catch {
              return null;
            }
          }),
        );
        const allProjects = allProjectsResults.filter(
          (x): x is NonNullable<typeof x> => x !== null,
        );

        const allProductsNested = await Promise.all(
          allProjects.map(async ({ customer, branch, project }) => {
            try {
              const products = await apiFetch<{ id: number; name: string }[]>(
                `/api/supply-chain/project-supply-chain/projects/${project.id}/products`,
              );
              return products.map((prod) => ({ customer, branch, project, product: prod }));
            } catch {
              return [];
            }
          }),
        );
        const allProductsFlat = allProductsNested.flat();

        const allVariantsNested = await Promise.all(
          allProductsFlat.map(async (item) => {
            try {
              const variants = await apiFetch<
                { id: number; name: string; code?: string | null }[]
              >(
                `/api/supply-chain/project-supply-chain/projects/${item.project.id}/products/${item.product.id}/product-variants`,
              );
              return variants.map((v) => ({ ...item, variant: v }));
            } catch {
              return [];
            }
          }),
        );
        const allVariants = allVariantsNested.flat();

        const rows: ScaffoldVariantRow[] = allVariants.map((item) => ({
          customerId: item.customer.id,
          customerName: item.customer.name || `고객 #${item.customer.id}`,
          branchId: item.branch.id,
          branchName: item.branch.name ?? `지사 #${item.branch.id}`,
          projectId: item.project.id,
          projectStartIso: item.project.start_date,
          projectEndIso: item.project.end_date,
          productId: item.product.id,
          productName: item.product.name,
          variantId: item.variant.id,
          variantName: item.variant.name,
          variantCode: item.variant.code ?? null,
        }));

        if (mounted) setScaffoldVariants(rows);
      } catch (e) {
        console.error('DataView scaffold load failed', e);
        if (mounted) {
          toast.error('고객사·제품 목록을 불러오지 못했습니다. 공급망 API를 확인해 주세요.');
        }
      } finally {
        if (mounted) setScaffoldLoading(false);
      }
    };

    void loadScaffold();
    return () => {
      mounted = false;
    };
  }, []);

  // Filter states (공통)
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedDetailProduct, setSelectedDetailProduct] = useState('');
  const [periodMode, setPeriodMode] = useState<'auto' | 'manual'>('auto');
  const [selectedPeriodStart, setSelectedPeriodStart] = useState(defaultMonthRange.startMonth);
  const [selectedPeriodEnd, setSelectedPeriodEnd] = useState(defaultMonthRange.endMonth);
  const [periodError, setPeriodError] = useState('');
  // 기간 선택: 고객사·지사만 선택했을 때 등, 세부제품 없이 조회할 때 사용하는 독립 기간 필터
  const [generalPeriodStart, setGeneralPeriodStart] = useState<string | null>(defaultMonthRange.startMonth);
  const [generalPeriodEnd, setGeneralPeriodEnd] = useState<string | null>(defaultMonthRange.endMonth);
  const [generalPeriodError, setGeneralPeriodError] = useState('');
  const [selectedProcess, setSelectedProcess] = useState('ALL');

  const customerOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const r of scaffoldVariants) {
      if (!byId.has(r.customerId)) byId.set(r.customerId, r.customerName);
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [scaffoldVariants]);

  const branchOptions = useMemo(() => {
    if (!selectedCustomer) return [];
    const cid = Number(selectedCustomer);
    if (!Number.isFinite(cid)) return [];
    const byId = new Map<number, string>();
    for (const r of scaffoldVariants) {
      if (r.customerId === cid && !byId.has(r.branchId)) byId.set(r.branchId, r.branchName);
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [scaffoldVariants, selectedCustomer]);

  const productOptions = useMemo(() => {
    if (!selectedCustomer) return [];
    const cid = Number(selectedCustomer);
    if (!Number.isFinite(cid)) return [];
    const byId = new Map<number, string>();
    for (const r of scaffoldVariants) {
      if (r.customerId !== cid) continue;
      if (selectedBranch) {
        const bid = Number(selectedBranch);
        if (!Number.isFinite(bid) || r.branchId !== bid) continue;
      }
      if (!byId.has(r.productId)) byId.set(r.productId, r.productName);
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [scaffoldVariants, selectedCustomer, selectedBranch]);

  const detailProductOptions = useMemo(() => {
    if (!selectedCustomer || !selectedProduct) return [];
    const cid = Number(selectedCustomer);
    const pid = Number(selectedProduct);
    if (!Number.isFinite(cid) || !Number.isFinite(pid)) return [];
    const bid = selectedBranch ? Number(selectedBranch) : NaN;
    const hasBranch = selectedBranch && Number.isFinite(bid);
    return scaffoldVariants
      .filter((r) => {
        if (r.customerId !== cid || r.productId !== pid) return false;
        if (hasBranch) return r.branchId === bid;
        return true;
      })
      .sort((a, b) => a.variantName.localeCompare(b.variantName));
  }, [scaffoldVariants, selectedCustomer, selectedBranch, selectedProduct]);

  const selectedDetailMeta = useMemo(() => {
    if (!selectedDetailProduct) return null;
    const vid = Number(selectedDetailProduct);
    if (!Number.isFinite(vid)) return null;
    const fromList = detailProductOptions.find((row) => row.variantId === vid);
    if (fromList) return fromList;
    return scaffoldVariants.find((r) => r.variantId === vid) ?? null;
  }, [detailProductOptions, selectedDetailProduct, scaffoldVariants]);

  const projectPeriodLabelDisplay = useMemo(() => {
    const startIso = bomPeriodBrief?.project_start ?? selectedDetailMeta?.projectStartIso;
    const endIso = bomPeriodBrief?.project_end ?? selectedDetailMeta?.projectEndIso;
    if (!startIso || !endIso) return '';
    const s = parseIsoToYearMonth(startIso);
    const e = parseIsoToYearMonth(endIso);
    return `${s.y}.${String(s.m).padStart(2, '0')} ~ ${e.y}.${String(e.m).padStart(2, '0')}`;
  }, [bomPeriodBrief, selectedDetailMeta]);

  useEffect(() => {
    const vid = selectedDetailProduct ? Number(selectedDetailProduct) : NaN;
    const bidFromBranch = selectedBranch ? Number(selectedBranch) : NaN;
    const bidFromVariant = selectedDetailMeta?.branchId;
    const bid = Number.isFinite(bidFromBranch)
      ? bidFromBranch
      : typeof bidFromVariant === 'number'
        ? bidFromVariant
        : NaN;
    if (!Number.isFinite(vid) || !Number.isFinite(bid)) {
      setBomPeriodBrief(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const b = await getOprBomPeriod(vid, bid);
        if (!cancelled) setBomPeriodBrief(b);
      } catch {
        if (!cancelled) setBomPeriodBrief(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDetailProduct, selectedBranch, selectedDetailMeta]);

  /** 세부제품 선택 시 계약(프로젝트) 기간 내 월만 월 선택 UI에서 활성화 */
  const contractMonths = useMemo((): string[] | undefined => {
    const startIso = bomPeriodBrief?.project_start ?? selectedDetailMeta?.projectStartIso;
    const endIso = bomPeriodBrief?.project_end ?? selectedDetailMeta?.projectEndIso;
    if (!startIso || !endIso) return selectedDetailMeta ? [] : undefined;
    return monthsFromProjectIso(startIso, endIso);
  }, [bomPeriodBrief, selectedDetailMeta]);

  // 세부제품·월 선택 모드: 조회 월 범위를 계약기간 안으로 보정
  useEffect(() => {
    if (!selectedDetailMeta || periodMode !== 'manual') return;
    const months = contractMonths;
    if (!months?.length) return;
    const minM = months[0];
    const maxM = months[months.length - 1];
    let s = selectedPeriodStart;
    let e = selectedPeriodEnd;
    if (!s || !months.includes(s)) s = minM;
    if (!e || !months.includes(e)) e = maxM;
    if (s > e) {
      const t = s;
      s = e;
      e = t;
    }
    if (s < minM) s = minM;
    if (e > maxM) e = maxM;
    if (s > e) e = s;
    if (s !== selectedPeriodStart || e !== selectedPeriodEnd) {
      setSelectedPeriodStart(s);
      setSelectedPeriodEnd(e);
    }
  }, [selectedDetailMeta, periodMode, contractMonths, selectedPeriodStart, selectedPeriodEnd]);

  // Months in selected period (for month grouping inside each blue card)
  const periodMonths = useMemo((): string[] => {
    if (selectedDetailProduct) {
      if (periodMode === 'auto' && selectedDetailMeta) {
        const startIso = bomPeriodBrief?.project_start ?? selectedDetailMeta.projectStartIso;
        const endIso = bomPeriodBrief?.project_end ?? selectedDetailMeta.projectEndIso;
        if (!startIso || !endIso) return [];
        return monthsFromProjectIso(startIso, endIso);
      }
      const start = selectedPeriodStart || null;
      const end = selectedPeriodEnd || null;
      if (!start || !end || start > end) return [];
      return enumerateMonthsBetweenYm(start, end);
    }
    const start = generalPeriodStart;
    const end = generalPeriodEnd;
    if (!start || !end || start > end) return [];
    return enumerateMonthsBetweenYm(start, end);
  }, [
    selectedDetailProduct,
    periodMode,
    selectedDetailMeta,
    bomPeriodBrief,
    selectedPeriodStart,
    selectedPeriodEnd,
    generalPeriodStart,
    generalPeriodEnd,
  ]);

  // Advanced filter states
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedMaterialType, setSelectedMaterialType] = useState('ALL');
  const [selectedMaterialName, setSelectedMaterialName] = useState('ALL');
  const [selectedPcfStatus, setSelectedPcfStatus] = useState('ALL'); // New PCF status filter

  // 자재/부품명 옵션 (검색 가능 드롭다운용)
  const materialNameOptions = useMemo(() => [
    { value: 'ALL', label: 'ALL (전체)' },
    { value: '배터리 셀', label: '배터리 셀' },
    { value: '전극', label: '전극' },
    { value: '리튬 원료', label: '리튬 원료' },
    { value: 'BMS 모듈', label: 'BMS 모듈' },
    { value: '팩 하우징', label: '팩 하우징' },
    { value: '양극재', label: '양극재' },
    { value: '음극재', label: '음극재' },
    { value: '전해액', label: '전해액' },
    { value: '분리막', label: '분리막' },
  ], []);

  // UI states
  const [hasQueried, setHasQueried] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  /** 월(YYYY-MM) 정렬: 최신순(기본) = 큰 달 먼저, 오래된순 = 작은 달 먼저 */
  const [sortBy, setSortBy] = useState<'latest' | 'oldest'>('latest');
  const sortedQueriedPeriodMonths = useMemo(() => {
    const m = [...queriedPeriodMonths];
    m.sort((a, b) => a.localeCompare(b));
    if (sortBy === 'latest') m.reverse();
    return m;
  }, [queriedPeriodMonths, sortBy]);
  const displayCards = useMemo(() => {
    let cards = [...queriedCards];
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      cards = cards.filter(
        (c) =>
          c.detailProduct.toLowerCase().includes(q) ||
          c.product.toLowerCase().includes(q) ||
          c.customer.toLowerCase().includes(q) ||
          c.branch.toLowerCase().includes(q) ||
          c.bomCode.toLowerCase().includes(q),
      );
    }
    return cards;
  }, [queriedCards, searchTerm]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<DataNode | null>(null);
  // Card and node expansion states (expandedProjects = expanded card IDs)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedMonthSections, setExpandedMonthSections] = useState<Set<string>>(new Set()); // "cardId-month"
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // 조회 완료 시 카드(파란 헤더)와 월별 섹션 모두 접힌 상태가 기본
  const hasExpandedForQueryRef = useRef(false);
  useEffect(() => {
    if (!hasQueried) {
      hasExpandedForQueryRef.current = false;
      return;
    }
    if (queriedCards.length > 0 && !hasExpandedForQueryRef.current) {
      hasExpandedForQueryRef.current = true;
      setExpandedProjects(new Set()); // 파란색 카드(고객사·지사·제품·BOM 등) 접힌 상태
      setExpandedMonthSections(new Set()); // 월별 섹션 접힌 상태
    }
  }, [hasQueried, queriedCards, periodMonths]);

  // 뒤로가기 시에만 조회조건 복원 (상세보기→뒤로가기). 새로고침/다른 탭 이동 시에는 복원하지 않음
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const fromBack = typeof window !== 'undefined' ? sessionStorage.getItem(DATA_VIEW_BACK_FLAG_KEY) : null;
      const raw = typeof window !== 'undefined' ? sessionStorage.getItem(DATA_VIEW_FILTER_STORAGE_KEY) : null;
      if (!raw || !fromBack) {
        sessionStorage.removeItem(DATA_VIEW_FILTER_STORAGE_KEY);
        sessionStorage.removeItem(DATA_VIEW_BACK_FLAG_KEY);
        return;
      }
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (s.selectedCustomer != null) setSelectedCustomer(String(s.selectedCustomer));
      if (s.selectedBranch != null) setSelectedBranch(String(s.selectedBranch));
      if (s.selectedProduct != null) setSelectedProduct(String(s.selectedProduct));
      if (s.selectedDetailProduct != null) setSelectedDetailProduct(String(s.selectedDetailProduct));
      if (s.periodMode === 'auto' || s.periodMode === 'manual') setPeriodMode(s.periodMode);
      if (s.selectedPeriodStart != null) setSelectedPeriodStart(String(s.selectedPeriodStart));
      if (s.selectedPeriodEnd != null) setSelectedPeriodEnd(String(s.selectedPeriodEnd));
      if (s.generalPeriodStart != null) setGeneralPeriodStart(String(s.generalPeriodStart));
      if (s.generalPeriodEnd != null) setGeneralPeriodEnd(String(s.generalPeriodEnd));
      if (s.selectedProcess != null) setSelectedProcess(String(s.selectedProcess));
      if (s.selectedTier != null) setSelectedTier(String(s.selectedTier));
      if (s.selectedSupplier != null) setSelectedSupplier(String(s.selectedSupplier));
      if (s.selectedMaterialType != null) setSelectedMaterialType(String(s.selectedMaterialType));
      if (s.selectedMaterialName != null) setSelectedMaterialName(String(s.selectedMaterialName));
      if (s.selectedPcfStatus != null) setSelectedPcfStatus(String(s.selectedPcfStatus));
      if (s.hasQueried === true) setHasQueried(true);
      if (s.searchTerm != null) setSearchTerm(String(s.searchTerm));
      if (s.sortBy === 'oldest' || s.sortBy === 'latest') {
        setSortBy(s.sortBy);
      }
      if (Array.isArray(s.expandedProjects)) setExpandedProjects(new Set(s.expandedProjects as string[]));
      if (Array.isArray(s.expandedMonthSections)) setExpandedMonthSections(new Set(s.expandedMonthSections as string[]));
      if (Array.isArray(s.expandedNodes)) setExpandedNodes(new Set(s.expandedNodes as string[]));
    } catch {
      // ignore parse errors
    }
    sessionStorage.removeItem(DATA_VIEW_FILTER_STORAGE_KEY);
    sessionStorage.removeItem(DATA_VIEW_BACK_FLAG_KEY);
  }, []);

  // Supply chain matching states
  const [appliedSupplyChainVersion, setAppliedSupplyChainVersion] = useState<SupplyChainVersion>(mockSupplyChainVersions[0]);
  const [matchingMode, setMatchingMode] = useState<'auto' | 'manual'>('auto');
  const [showSupplyChainModal, setShowSupplyChainModal] = useState(false);
  const [selectedGroupInModal, setSelectedGroupInModal] = useState<string>(mockSupplyChainGroups[0].id);
  const [showLowerTierRequestModal, setShowLowerTierRequestModal] = useState(false);
  const [requestModalMonthKey, setRequestModalMonthKey] = useState<string | null>(null);
  const [requestModalContext, setRequestModalContext] = useState<{
    projectId: number;
    productId: number;
    productVariantId: number;
    reportingYear: number;
    reportingMonth: number;
    requesterSupplyChainNodeId: number | null;
  } | null>(null);
  const [selectedRequestNodeIds, setSelectedRequestNodeIds] = useState<Set<string>>(new Set());
  const [expandedRequestNodeIds, setExpandedRequestNodeIds] = useState<Set<string>>(new Set());
  const [requestTierFilter, setRequestTierFilter] = useState<'all' | 'tier2' | 'tier3'>('all');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestDueDate, setRequestDueDate] = useState('');

  // Generate period options
  const generatePeriodOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      options.push(`${year}-${month}`);
    }
    return options;
  };

  const periodOptions = generatePeriodOptions();

  const validatePeriodRange = (start: string, end: string) => {
    if (!start || !end) {
      setPeriodError('');
      return true;
    }

    if (start > end) {
      setPeriodError('종료 기간은 시작 기간 이후여야 합니다.');
      return false;
    }

    setPeriodError('');
    return true;
  };

  const validateGeneralPeriodRange = (start: string | null, end: string | null) => {
    if (!start || !end) {
      setGeneralPeriodError('');
      return true;
    }
    if (start > end) {
      setGeneralPeriodError('종료 기간은 시작 기간 이후여야 합니다.');
      return false;
    }
    setGeneralPeriodError('');
    return true;
  };

  const handlePeriodStartChange = (value: string) => {
    setSelectedPeriodStart(value);
    validatePeriodRange(value, selectedPeriodEnd);
  };

  const handlePeriodEndChange = (value: string) => {
    setSelectedPeriodEnd(value);
    validatePeriodRange(selectedPeriodStart, value);
  };

  const handleQuery = async () => {
    if (!selectedCustomer) {
      toast.error('고객사를 선택해주세요');
      return;
    }
    const customerId = Number(selectedCustomer);
    if (!Number.isFinite(customerId)) {
      toast.error('고객사 정보가 올바르지 않습니다');
      return;
    }

    const rowsForCustomer = scaffoldVariants.filter((r) => r.customerId === customerId);
    if (!rowsForCustomer.length) {
      toast.error('선택한 고객사에 등록된 프로젝트·제품이 없습니다');
      return;
    }

    const custBranchId = selectedBranch ? Number(selectedBranch) : NaN;
    const useCustomerScope = !selectedBranch || !Number.isFinite(custBranchId);

    if (!useCustomerScope) {
      const scaffoldForBranch = scaffoldVariants.filter((r) => r.branchId === custBranchId);
      if (!scaffoldForBranch.length) {
        toast.error('선택한 지사에 등록된 제품이 없습니다');
        return;
      }
    }

    const hasDetailProduct = !!selectedDetailProduct;
    const variantId = hasDetailProduct ? Number(selectedDetailProduct) : NaN;

    if (hasDetailProduct) {
      if (!selectedProduct) {
        toast.error('세부제품까지 선택할 경우 제품을 선택해주세요');
        return;
      }
      if (periodMode === 'manual') {
        if (!selectedPeriodStart || !selectedPeriodEnd) {
          toast.error('프로젝트 기간(월 선택)에서 조회할 월 범위를 지정해주세요');
          return;
        }
        if (!validatePeriodRange(selectedPeriodStart, selectedPeriodEnd)) {
          toast.error('프로젝트 기간을 확인해주세요');
          return;
        }
      }
    } else {
      if (!validateGeneralPeriodRange(generalPeriodStart, generalPeriodEnd)) {
        toast.error('기간 선택을 확인해주세요');
        return;
      }
      if (!generalPeriodStart || !generalPeriodEnd) {
        toast.error('기간 선택에서 조회할 월 범위를 지정해주세요');
        return;
      }
    }

    const body: OprQueryRequest = useCustomerScope
      ? { opr_customer_id: customerId }
      : { cust_branch_id: custBranchId };
    if (selectedProduct) {
      const pid = Number(selectedProduct);
      if (Number.isFinite(pid)) body.product_id = pid;
    }
    if (hasDetailProduct && Number.isFinite(variantId)) {
      body.product_variant_id = variantId;
    }

    let displayMonths: string[] = [];
    if (hasDetailProduct) {
      const vr = scaffoldVariants.find((r) => r.variantId === variantId);
      if (!vr) {
        toast.error('세부제품 정보를 찾을 수 없습니다');
        return;
      }
      const projectMonths = monthsFromProjectIso(vr.projectStartIso, vr.projectEndIso);
      if (periodMode === 'manual' && selectedPeriodStart && selectedPeriodEnd) {
        const manualRange = enumerateMonthsBetweenYm(selectedPeriodStart, selectedPeriodEnd);
        displayMonths = intersectMonthLists(projectMonths, manualRange);
        body.selected_months = displayMonths.map((ym) => {
          const [y, m] = ym.split('-').map(Number);
          return [y, m];
        });
      } else {
        displayMonths = [...projectMonths];
      }
    } else {
      body.period_start = periodStartDate(generalPeriodStart!);
      body.period_end = periodEndDate(generalPeriodEnd!);
      const userMonths = enumerateMonthsBetweenYm(generalPeriodStart!, generalPeriodEnd!);
      if (useCustomerScope) {
        displayMonths = unionIntersectedMonthsForCustomerBranches(
          customerId,
          generalPeriodStart!,
          generalPeriodEnd!,
          scaffoldVariants,
        );
      } else {
        const scaffoldForBranch = scaffoldVariants.filter((r) => r.branchId === custBranchId);
        const projectMonths = monthsFromProjectIso(
          scaffoldForBranch[0]!.projectStartIso,
          scaffoldForBranch[0]!.projectEndIso,
        );
        displayMonths = intersectMonthLists(projectMonths, userMonths);
      }
    }

    if (!displayMonths.length) {
      toast.error('선택한 기간이 프로젝트 계약 기간과 겹치지 않습니다');
      return;
    }

    setQueryLoading(true);
    setOverviewByKey({});
    setOverviewLoadingKey(null);
    setOverviewErrorKey(null);

    try {
      const res = await postOprQuery(body);
      lastQueryBodyRef.current = body;

      const customerName =
        customerOptions.find((c) => String(c.id) === selectedCustomer)?.name ?? '';

      const cards: DetailProductCard[] = res.product_variants.map((pv, idx) => {
        const sc =
          scaffoldVariants.find(
            (s) => s.branchId === pv.cust_branch_id && s.variantId === pv.product_variant_id,
          ) ?? scaffoldVariants.find((s) => s.variantId === pv.product_variant_id);
        const branchLabel =
          branchOptions.find((b) => b.id === pv.cust_branch_id)?.name ??
          sc?.branchName ??
          `지사 ${pv.cust_branch_id}`;
        const vName = (pv.product_variant_name ?? '').trim();
        const vCode =
          pv.product_variant_code != null ? String(pv.product_variant_code).trim() : '';
        const detailProduct =
          vCode && vCode !== vName ? `${vName} | ${vCode}` : vName || vCode || `세부제품 #${pv.product_variant_id}`;
        return {
          id: `card-${pv.cust_branch_id}-${pv.product_variant_id}-${idx}`,
          customer: customerName || sc?.customerName || '',
          branch: branchLabel,
          product: pv.product_name,
          detailProduct,
          bomCode: pv.bom_code ?? sc?.variantCode ?? '-',
          custBranchId: pv.cust_branch_id,
          productVariantId: pv.product_variant_id,
          projectId: pv.project_id,
          productId: pv.product_id,
        };
      });

      setQueriedCards(cards);
      setQueriedPeriodMonths(displayMonths);
      setQueriedSummaryText(res.summary_text || '');
      setHasQueried(true);
      toast.success('조회가 완료되었습니다');
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`조회 실패: ${msg}`);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedCustomer('');
    setSelectedBranch('');
    setSelectedProduct('');
    setSelectedDetailProduct('');
    setPeriodMode('auto');
    setSelectedPeriodStart(defaultMonthRange.startMonth);
    setSelectedPeriodEnd(defaultMonthRange.endMonth);
    setPeriodError('');
    setGeneralPeriodStart(defaultMonthRange.startMonth);
    setGeneralPeriodEnd(defaultMonthRange.endMonth);
    setGeneralPeriodError('');
    setSelectedProcess('ALL');
    setSelectedTier('ALL');
    setSelectedSupplier('');
    setSelectedMaterialType('ALL');
    setSelectedMaterialName('ALL');
    setSelectedPcfStatus('ALL'); // Reset PCF status filter
    setSortBy('latest');
    setHasQueried(false);
    setQueriedCards([]);
    setQueriedPeriodMonths([]);
    setQueriedSummaryText('');
    lastQueryBodyRef.current = null;
    setOverviewByKey({});
    setOverviewLoadingKey(null);
    setOverviewErrorKey(null);
    setExpandedProjects(new Set());
    setExpandedMonthSections(new Set());
    setExpandedNodes(new Set());
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    const body = lastQueryBodyRef.current;
    if (!body) {
      toast.error('먼저 조회를 실행해 주세요');
      return;
    }
    try {
      const { blob, filename } = await downloadOprExport(format, body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        filename ??
        (format === 'csv' ? 'opr_data_mgmt_export.csv' : 'opr_data_mgmt_export.xlsx');
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} 다운로드를 시작합니다`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`다운로드 실패: ${msg}`);
    }
  };

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const toggleMonthSection = async (card: DetailProductCard, month: string) => {
    const key = `${card.id}-${month}`;
    const newExpanded = new Set(expandedMonthSections);
    const willExpand = !newExpanded.has(key);
    if (willExpand) {
      newExpanded.add(key);
    } else {
      newExpanded.delete(key);
    }
    setExpandedMonthSections(newExpanded);

    if (willExpand && card.custBranchId && card.productVariantId) {
      const [y, m] = month.split('-').map(Number);
      if (!overviewByKey[key]) {
        setOverviewLoadingKey(key);
        setOverviewErrorKey(null);
        try {
          const ov = await getOprMonthlyOverview(card.productVariantId, y, m, card.custBranchId);
          const tree = monthlyRowsToTree(ov.rows, card.id, month);
          setOverviewByKey((prev) => ({ ...prev, [key]: tree }));
        } catch (e) {
          console.error(e);
          setOverviewErrorKey(key);
          toast.error('월별 공급망 데이터를 불러오지 못했습니다');
        } finally {
          setOverviewLoadingKey(null);
        }
      }
    }
  };

  const ensureMonthOverviewLoaded = async (
    card: DetailProductCard,
    month: string,
  ): Promise<DataNode | undefined> => {
    const key = `${card.id}-${month}`;
    const cached = overviewByKey[key];
    if (cached) return cached;
    if (!card.custBranchId || !card.productVariantId) return undefined;
    const [y, m] = month.split('-').map(Number);
    setOverviewLoadingKey(key);
    setOverviewErrorKey(null);
    try {
      const ov = await getOprMonthlyOverview(card.productVariantId, y, m, card.custBranchId);
      const tree = monthlyRowsToTree(ov.rows, card.id, month);
      setOverviewByKey((prev) => ({ ...prev, [key]: tree }));
      return tree;
    } catch (e) {
      console.error(e);
      setOverviewErrorKey(key);
      toast.error('요청 대상 노드를 불러오지 못했습니다');
      return undefined;
    } finally {
      setOverviewLoadingKey(null);
    }
  };

  const handleViewMap = (_card: DetailProductCard) => {
    toast.info('공급망 지도 기능은 데이터 연동 후 제공됩니다');
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">높음</span>;
      case 'medium':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">중간</span>;
      case 'low':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">낮음</span>;
      default:
        return null;
    }
  };

  const getVerificationStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" />검증완료</span>;
      case 'not-verified':
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">미검증</span>;
      default:
        return null;
    }
  };

  // Check if node has missing child PCF data
  const hasMissingChildPcf = (node: DataNode): boolean => {
    if (!node.children || node.children.length === 0) {
      return false; // Leaf node
    }
    
    // Check if any child has missing PCF
    return node.children.some(child => {
      return child.pcfResult === null || hasMissingChildPcf(child);
    });
  };

  // 티어별 배지 - 메인컬러 1종, opacity로 차수 구분 (Tier 1 가장 진함 → Tier 3 가장 연함)
  const getTierBadgeStyle = (tier: string): { bg: string; text: string; border?: string } => {
    const main = mode === 'procurement' ? '#5B3BFA' : '#00B4FF';
    const rgb = mode === 'procurement' ? '91, 59, 250' : '0, 180, 255';
    switch (tier) {
      case 'Tier 0':
        return { bg: `rgba(${rgb}, 0.12)`, text: main, border: `2px solid ${main}` };
      case 'Tier 1':
        return { bg: main, text: '#FFFFFF' };
      case 'Tier 2':
        return { bg: `rgba(${rgb}, 0.55)`, text: '#FFFFFF' };
      case 'Tier 3':
        return { bg: `rgba(${rgb}, 0.28)`, text: main };
      default:
        return { bg: '#E5E7EB', text: '#374151' };
    }
  };

  // Unified status badge - PCF calculation logic based
  const getUnifiedStatusBadge = (node: DataNode) => {
    // Priority: Risk > Missing Child Data > Not Submitted > Pending > Completed
    
    // 1. High risk
    if (node.riskLevel === 'high') {
      return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />리스크 있음</span>;
    }
    
    // 2. Data not submitted
    if (node.dataSubmissionStatus === 'not-submitted') {
      return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">데이터 미제출</span>;
    }
    
    // 3. Has children with missing PCF data
    if (hasMissingChildPcf(node)) {
      return <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />하위 데이터 부족</span>;
    }
    
    // 4. PCF not calculated yet (submitted but pending calculation)
    if (node.pcfResult === null) {
      return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" />계산 대기</span>;
    }
    
    // 5. PCF calculated successfully
    return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" />PCF 계산 완료</span>;
  };

  // Unified render - simplified structure with 9 columns only (no horizontal scroll)
  const renderNode = (node: DataNode, depth: number = 0, parentNode?: DataNode | null) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isTier0 = node.tier === 'Tier 0';
    const isEmptyPlaceholder = node.id === 'empty-tier0';

    /* 상세보기 열 좌측 이동(우측에 스페이서 추가), 공급망 PCF 보기 버튼은 헤더 우측 유지 */
    const gridCols = DATA_VIEW_MONTH_TREE_GRID_COLS;
    const tierStyle = getTierBadgeStyle(node.tier);

    return (
      <div key={node.id}>
        <div
          className={`border-b border-gray-100 hover:bg-gray-50 transition-all ${isTier0 ? mode === 'procurement' ? 'bg-purple-50' : 'bg-blue-50' : ''}`}
        >
          <div
            className="grid items-center py-3 pr-4 gap-x-2 text-sm px-4 w-full"
            style={{ gridTemplateColumns: gridCols }}
          >
            {/* Toggle (indent by depth, fixed column aligns rest) */}
            <div className="flex items-center" style={{ paddingLeft: depth * 40 }}>
              {hasChildren && (
                <button
                  onClick={() => toggleNode(node.id)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            {/* Tier */}
            <div>
              <span
                className="inline-block px-2 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: tierStyle.bg,
                  color: tierStyle.text,
                  ...(tierStyle.border && { border: tierStyle.border }),
                }}
              >
                {node.tier}
              </span>
            </div>

            {/* Company Name — 그리드 트랙 최소 너비와 함께 셀에도 min-width로 가시성 보장 */}
            <div className="min-w-[140px] overflow-hidden">
              <div className="font-medium text-gray-900 truncate">{node.companyName}</div>
              <div className="text-xs text-gray-500 truncate">{node.companyNameEn}</div>
            </div>

            <div className="min-w-0" aria-hidden />

            {/* Product Type */}
            <div className="text-gray-700 min-w-0 truncate">{node.productType}</div>

            {/* Country - 제품유형과 회사명 사이 */}
            <div className="min-w-0 truncate text-gray-700">{node.country}</div>

            {/* PCF Result (kg CO₂e) */}
            <div className={`text-center min-w-0 flex flex-col items-center justify-center gap-0.5 ${isTier0 ? 'text-[#00B4FF]' : 'text-gray-900'}`}>
              {node.pcfResult !== null ? (
                <>
                  <span className={`font-medium ${isTier0 ? 'font-bold' : ''}`}>{node.pcfResult.toLocaleString()} kg CO₂e</span>
                  {hasMissingChildPcf(node) && (
                    <span className="text-xs text-orange-600 font-medium" title="하위 협력사 데이터 미반영, 자사·운송·일부 하위 기준 산정">
                      부분 산정
                    </span>
                  )}
                </>
              ) : (
                '미산정'
              )}
            </div>

            <div className="min-w-0" aria-hidden />

            {/* Unified Status - 중앙 정렬 */}
            <div className="min-w-0 flex justify-center">
              {getUnifiedStatusBadge(node)}
            </div>

            <div className="min-w-0" aria-hidden />

            {/* Actions - 상세보기 버튼 중앙 정렬 */}
            <div className="min-w-0 flex justify-center">
              <button
                onClick={() => {
                  if (isEmptyPlaceholder) return;
                  // 뒤로가기 시 조회조건 복원을 위해 현재 필터 상태 저장
                  try {
                    sessionStorage.setItem(DATA_VIEW_FILTER_STORAGE_KEY, JSON.stringify({
                      selectedCustomer,
                      selectedBranch,
                      selectedProduct,
                      selectedDetailProduct,
                      periodMode,
                      selectedPeriodStart,
                      selectedPeriodEnd,
                      generalPeriodStart,
                      generalPeriodEnd,
                      selectedProcess,
                      selectedTier,
                      selectedSupplier,
                      selectedMaterialType,
                      selectedMaterialName,
                      selectedPcfStatus,
                      hasQueried,
                      searchTerm,
                      sortBy,
                      expandedProjects: Array.from(expandedProjects),
                      expandedMonthSections: Array.from(expandedMonthSections),
                      expandedNodes: Array.from(expandedNodes),
                    }));
                  } catch {
                    // ignore
                  }
                  try {
                    const parentName =
                      parentNode?.companyName && parentNode.companyName.trim()
                        ? parentNode.companyName
                        : '-';
                    sessionStorage.setItem('aifix_data_view_selected_parent_company_v1', parentName);
                  } catch {
                    // ignore
                  }
                  let route;
                  if (node.tier === 'Tier 0') {
                    route = `/dashboard/data-view/tier0/${node.id}`;
                  } else if (node.companyType === 'Supplier') {
                    saveSupplierDetailSnapshot(node.id, {
                      companyName: node.companyName,
                      companyNameEn: node.companyNameEn,
                      tier: node.tier,
                      country: node.country,
                      productType: node.productType,
                      pcfResult: node.pcfResult,
                    });
                    route = `/dashboard/data-view/supplier/${node.id}`;
                  } else {
                    route = `/dashboard/data-view/company/${node.id}`;
                  }
                  router.push(route);
                }}
                disabled={isEmptyPlaceholder}
                className={`px-3 py-1.5 text-xs border border-gray-300 rounded-lg transition-colors ${isEmptyPlaceholder ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                상세보기
              </button>
            </div>

            <div className="min-w-0" aria-hidden />
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="transition-all duration-200">
            {node.children!.map((child) => renderNode(child, depth + 1, node))}
          </div>
        )}
      </div>
    );
  };

  const collectTreeNodesWithRoot = (root: DataNode | undefined): DataNode[] => {
    if (!root) return [];
    const out: DataNode[] = [root];
    const walk = (n: DataNode) => {
      for (const c of n.children ?? []) {
        out.push(c);
        walk(c);
      }
    };
    walk(root);
    return out;
  };

  const parseTierNumber = (tierLabel: string): number => {
    const m = /tier\s*(\d+)/i.exec(tierLabel);
    return m ? Number(m[1]) : 0;
  };

  // Format month for display (e.g. "2026-01" -> "2026년 1월")
  const formatMonthLabel = (month: string) => {
    const [y, m] = month.split('-').map(Number);
    return `${y}년 ${m}월`;
  };

  // Render detail product card (blue header + month sections + tree)
  const renderDetailProductCard = (card: DetailProductCard) => {
    const isCardExpanded = expandedProjects.has(card.id);

    return (
      <div key={card.id} className="mb-4">
        {/* Blue Header: 고객사, 지사, 제품, 세부제품, BOM 코드 */}
        <div
          className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all hover:shadow-md"
          style={{
            background: mode === 'procurement'
              ? 'linear-gradient(90deg, rgba(91,59,250,0.05) 0%, rgba(0,180,255,0.05) 100%)'
              : 'linear-gradient(90deg, rgba(0,180,255,0.05) 0%, rgba(91,59,250,0.05) 100%)',
            border: `1px solid ${mode === 'procurement' ? 'rgba(91,59,250,0.2)' : 'rgba(0,180,255,0.2)'}`,
          }}
          onClick={() => toggleProject(card.id)}
        >
          <div className="flex items-center gap-4 flex-1">
            <button className="p-1 hover:bg-gray-200 rounded transition-colors">
              {isCardExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>

            <Folder className={`w-5 h-5 ${mode === 'procurement' ? 'text-[#5B3BFA]' : 'text-[#00B4FF]'}`} />

            <div className="flex-1">
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-700">
                <span>고객사: <span className="font-medium">{card.customer}</span></span>
                <span>지사: <span className="font-medium">{card.branch}</span></span>
                <span>제품: <span className="font-medium">{card.product}</span></span>
                <span>세부제품: <span className="font-medium">{card.detailProduct}</span></span>
                <span>BOM 코드: <span className={`font-semibold ${mode === 'procurement' ? 'text-[#5B3BFA]' : 'text-[#00B4FF]'}`}>{card.bomCode}</span></span>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewMap(card);
              }}
              className="px-4 py-2 text-sm text-white rounded-lg transition-all hover:scale-105 flex items-center gap-2"
              style={{
                background: mode === 'procurement'
                  ? 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)'
                  : 'linear-gradient(90deg, #00B4FF 0%, #5B3BFA 100%)',
              }}
            >
              <MapPin className="w-4 h-4" />
              공급망 보기
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                toast.info('엑셀 다운로드 기능을 준비 중입니다');
              }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              엑셀 다운로드
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                toast.info('엑셀 업로드 기능을 준비 중입니다');
              }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              엑셀 업로드
            </button>
          </div>
        </div>

        {/* Month sections + Tree (Tier 0부터 하위 협력사) */}
        {isCardExpanded && (
          <div className="mt-2 space-y-2">
            {queriedPeriodMonths.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500" style={{ border: '1px solid #E5E7EB' }}>
                조회 기간을 선택해주세요
              </div>
            ) : (
              sortedQueriedPeriodMonths.map((month) => {
                const monthKey = `${card.id}-${month}`;
                const isMonthExpanded = expandedMonthSections.has(monthKey);

                return (
                  <div key={monthKey} className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
                    {/* Month section header - collapsible, 공급망 PCF 보기 버튼 */}
                    <div
                      className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => void toggleMonthSection(card, month)}
                    >
                      <div className="flex items-center gap-3">
                        <button className="p-1 hover:bg-gray-200 rounded transition-colors" type="button">
                          {isMonthExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <span className="font-medium text-gray-700">{formatMonthLabel(month)}</span>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        {mode === 'pcf' && (
                          <button
                            type="button"
                          onClick={async (e) => {
                              e.stopPropagation();
                              const targetKey = `${card.id}-${month}`;
                            const tree =
                              overviewByKey[targetKey] ?? (await ensureMonthOverviewLoaded(card, month));
                            const nodes = collectTreeNodesWithRoot(tree);
                            if (nodes.length === 0) {
                              toast.info('선택 가능한 하위 협력사 노드가 없습니다.');
                            }
                              setRequestModalMonthKey(targetKey);
                              setRequestModalContext({
                                projectId: card.projectId,
                                productId: card.productId,
                                productVariantId: card.productVariantId,
                                reportingYear: Number(month.split('-')[0]),
                                reportingMonth: Number(month.split('-')[1]),
                                requesterSupplyChainNodeId: tree?.supplyChainNodeId ?? null,
                              });
                              setSelectedRequestNodeIds(
                                new Set(
                                  nodes
                                    .filter((n) => n.id !== tree?.id)
                                    .filter((n) => parseTierNumber(n.tier) >= 2)
                                    .map((n) => n.id),
                                ),
                              );
                              setExpandedRequestNodeIds(new Set(tree ? [tree.id] : []));
                              setRequestTierFilter('all');
                              setRequestMessage('');
                              setRequestDueDate('');
                              setShowLowerTierRequestModal(true);
                            }}
                            className="px-3 py-1.5 text-xs border border-[#5B3BFA] text-[#5B3BFA] rounded-lg hover:bg-violet-50 transition-all flex items-center justify-center gap-1 flex-shrink-0"
                          >
                            <Send className="w-3 h-3" />
                            하위 협력사 데이터 요청
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              sessionStorage.setItem(DATA_VIEW_FILTER_STORAGE_KEY, JSON.stringify({
                                selectedCustomer, selectedBranch, selectedProduct, selectedDetailProduct,
                                periodMode, selectedPeriodStart, selectedPeriodEnd, generalPeriodStart, generalPeriodEnd,
                                selectedProcess, selectedTier, selectedSupplier, selectedMaterialType, selectedMaterialName,
                                selectedPcfStatus, hasQueried, searchTerm, sortBy,
                                expandedProjects: Array.from(expandedProjects),
                                expandedMonthSections: Array.from(expandedMonthSections),
                                expandedNodes: Array.from(expandedNodes),
                              }));
                            } catch { /* ignore */ }
                            const tier0Id = `${card.id}-${month}-tier0`;
                            router.push(`/dashboard/pcf-calculation/result/${tier0Id}`);
                          }}
                          className="px-3 py-1.5 text-xs text-white rounded-lg hover:scale-105 transition-all flex items-center justify-center gap-1 flex-shrink-0"
                          style={{
                            background: 'linear-gradient(90deg, #00B4FF 0%, #5B3BFA 100%)',
                          }}
                        >
                          <FileText className="w-3 h-3" />
                          공급망 PCF 보기
                        </button>
                      </div>
                    </div>

                    {/* Tree: Tier 0부터 하위 협력사 (현재 빈 데이터) */}
                    {isMonthExpanded && (
                      <div>
                        <div className="bg-gray-50 border-b border-gray-200">
                          <div
                            className="grid items-center px-4 py-3 gap-x-2 text-xs font-medium text-gray-700 w-full"
                            style={{ gridTemplateColumns: DATA_VIEW_MONTH_TREE_GRID_COLS }}
                          >
                            <div></div>
                            <div>Tier</div>
                            <div>회사명</div>
                            <div></div>
                            <div>제품 유형</div>
                            <div>국가</div>
                            <div className="text-center">PCF 결과 (kg CO₂e)</div>
                            <div></div>
                            <div className="text-center">데이터 상태</div>
                            <div></div>
                            <div className="text-center">상세보기</div>
                            <div></div>
                          </div>
                        </div>
                        {overviewLoadingKey === monthKey ? (
                          <div className="p-8 text-center text-gray-500">불러오는 중…</div>
                        ) : overviewErrorKey === monthKey ? (
                          <div className="p-8 text-center text-red-600">
                            데이터를 불러오지 못했습니다. 다시 펼쳐 보세요.
                          </div>
                        ) : overviewByKey[monthKey] ? (
                          renderNode(overviewByKey[monthKey])
                        ) : (
                          <div className="p-8 text-center text-gray-500">불러오는 중…</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">데이터 관리</h1>
        <p className="text-gray-600">
          제품 기준으로 공급망 및 PCF 데이터를 조회하고 관리합니다
        </p>
      </div>

      {/* Filter Panel */}
      <div
        className="bg-white p-8"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        <h2 className="text-xl font-semibold mb-6">조회 조건</h2>

        {/* Main Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">고객사 <span style={{ color: '#EF4444' }}>*</span></label>
            <select
              value={selectedCustomer}
              onChange={(e) => {
                setSelectedCustomer(e.target.value);
                setSelectedBranch('');
                setSelectedProduct('');
                setSelectedDetailProduct('');
                setHasQueried(false);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
            >
              <option value="">선택</option>
              {customerOptions.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">지사</label>
            <select
              value={selectedBranch}
              disabled={!selectedCustomer}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setSelectedProduct('');
                setSelectedDetailProduct('');
                setHasQueried(false);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
              <option value="">선택</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">제품</label>
            <select
              value={selectedProduct}
              disabled={!selectedCustomer}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                setSelectedDetailProduct('');
                setHasQueried(false);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
              <option value="">선택</option>
              {productOptions.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">세부제품</label>
            <select
              value={selectedDetailProduct}
              disabled={!selectedProduct}
              onChange={(e) => {
                setSelectedDetailProduct(e.target.value);
                setHasQueried(false);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
              <option value="">선택</option>
              {detailProductOptions.map((row) => (
                <option key={`${row.branchId}-${row.variantId}`} value={String(row.variantId)}>
                  {row.variantCode
                    ? `${row.variantName} | ${row.variantCode}`
                    : row.variantName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">BOM Code</label>
            <div className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-gray-700">
              {bomPeriodBrief?.bom_code ?? selectedDetailMeta?.variantCode ?? '-'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              기간 선택 <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <MonthRangePicker
              startMonth={generalPeriodStart}
              endMonth={generalPeriodEnd}
              onChange={(start, end) => {
                setGeneralPeriodStart(start);
                setGeneralPeriodEnd(end);
                validateGeneralPeriodRange(start, end);
                setHasQueried(false);
              }}
              error={generalPeriodError}
              disabled={!!selectedDetailProduct}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">
                계약기간 <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div className="flex items-center gap-1.5 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => { setPeriodMode('auto'); setHasQueried(false); }}
                  className={`min-w-[52px] px-2.5 py-1 rounded-md border text-xs whitespace-nowrap leading-none ${periodMode === 'auto' ? 'bg-purple-50 text-[#5B3BFA] border-[#5B3BFA]' : 'text-gray-600 border-gray-300'}`}
                >
                  자동
                </button>
                <button
                  type="button"
                  onClick={() => { setPeriodMode('manual'); setHasQueried(false); }}
                  className={`min-w-[68px] px-2.5 py-1 rounded-md border text-xs whitespace-nowrap leading-none ${periodMode === 'manual' ? 'bg-purple-50 text-[#5B3BFA] border-[#5B3BFA]' : 'text-gray-600 border-gray-300'}`}
                >
                  월 선택
                </button>
              </div>
            </div>
            {periodMode === 'auto' ? (
              <div className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-gray-700">
                {projectPeriodLabelDisplay || '세부제품 선택 시 자동 표시'}
              </div>
            ) : (
              <MonthRangePicker
                startMonth={selectedPeriodStart || null}
                endMonth={selectedPeriodEnd || null}
                onChange={(start, end) => {
                  setSelectedPeriodStart(start || '');
                  setSelectedPeriodEnd(end || '');
                  if (start && end) {
                    validatePeriodRange(start, end);
                  } else {
                    setPeriodError('');
                  }
                  setHasQueried(false);
                }}
                error={periodError}
                enabledMonths={contractMonths}
              />
            )}
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleQuery()}
            disabled={queryLoading || scaffoldLoading}
            className="px-6 py-3 text-white rounded-xl font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
              boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
            }}
          >
            {queryLoading ? '조회 중…' : '조회'}
          </button>

          <button
            onClick={handleReset}
            className="px-6 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            초기화
          </button>

          <select className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]">
            <option value="">저장된 조회 조건</option>
            <option value="1">BMW 배터리 모듈 조회</option>
            <option value="2">2026년 1분기 전체</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {!hasQueried ? (
        <div
          className="bg-white p-12 text-center"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <Filter className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg">조회 조건을 선택하고 조회 버튼을 눌러주세요</p>
        </div>
      ) : (
        <>
          {/* Control Bar */}
          <div
            className="bg-white p-6"
            style={{
              borderRadius: '20px',
              boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <span className="font-semibold whitespace-nowrap">
                  조회 결과: <span className={mode === 'procurement' ? 'text-[#5B3BFA]' : 'text-[#00B4FF]'}>
                    {displayCards.length}개 세부제품
                  </span>
                  {queriedPeriodMonths.length > 0 && (
                    <> / <span className={mode === 'procurement' ? 'text-[#5B3BFA]' : 'text-[#00B4FF]'}>
                      {queriedPeriodMonths.length}개 월
                    </span></>
                  )}
                  {queriedSummaryText ? (
                    <span className="text-gray-500 font-normal text-sm ml-2">({queriedSummaryText})</span>
                  ) : null}
                </span>

                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="검색..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  />
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'latest' | 'oldest')}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                >
                  <option value="latest">최신순</option>
                  <option value="oldest">오래된순</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('csv')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>

                <button
                  onClick={() => handleExport('xlsx')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  XLSX
                </button>

                <button
                  onClick={() => setShowExportModal(true)}
                  className="px-4 py-2 text-white rounded-lg transition-all hover:scale-105 flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                    boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
                  }}
                >
                  <FileText className="w-4 h-4" />
                  보고서 내보내기
                </button>
              </div>
            </div>
          </div>

          {/* Detail Product Cards (세부제품별 파란 카드) */}
          <div>
            {displayCards.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl" style={{ border: '1px solid #E5E7EB' }}>
                <p className="text-gray-500">조회 조건에 맞는 세부제품이 없습니다. 고객사·지사·기간을 확인해 주세요.</p>
              </div>
            ) : (
              displayCards.map((card) => renderDetailProductCard(card))
            )}
          </div>
        </>
      )}

      {/* Export Report Modal */}
      {showExportModal && (
        <ExportReportModal
          onClose={() => setShowExportModal(false)}
          onExport={(options) => {
            toast.success(
              options.format === 'excel'
                ? 'Excel 보고서를 준비합니다'
                : 'PDF 보고서를 준비합니다'
            );
            setShowExportModal(false);
          }}
        />
      )}

      {/* Detail Modals */}
      {selectedCompany && mode === 'procurement' && (
        <ProcurementDetailModal
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
          selectedPeriodStart={selectedPeriodStart}
          selectedPeriodEnd={selectedPeriodEnd}
        />
      )}

      {selectedCompany && mode === 'pcf' && (
        <PcfDetailModal
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
        />
      )}

      {/* Supply Chain Version Selection Modal */}
      {showSupplyChainModal && (
        <SupplyChainVersionModal
          groups={mockSupplyChainGroups}
          versions={mockSupplyChainVersions}
          appliedVersion={appliedSupplyChainVersion}
          onSelect={(version) => {
            setAppliedSupplyChainVersion(version);
            setMatchingMode('manual');
          }}
          onClose={() => setShowSupplyChainModal(false)}
        />
      )}

      {showLowerTierRequestModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">데이터 요청 모달</h3>
                <p className="text-sm text-gray-500">자신보다 하위 차수 전체에 직접 데이터 요청을 보냅니다.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLowerTierRequestModal(false);
                  setRequestModalContext(null);
                }}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 px-6 py-5 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">요청 대상 선택</h4>
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const root = requestModalMonthKey ? overviewByKey[requestModalMonthKey] : undefined;
                      const nodes = collectTreeNodesWithRoot(root);
                      setRequestTierFilter('all');
                      setSelectedRequestNodeIds(
                        new Set(
                          nodes
                            .filter((n) => n.id !== root?.id)
                            .filter((n) => parseTierNumber(n.tier) >= 2)
                            .map((n) => n.id),
                        ),
                      );
                      setExpandedRequestNodeIds(new Set(nodes.map((n) => n.id)));
                    }}
                    className={`rounded-lg border px-3 py-1 text-xs transition-colors ${
                      requestTierFilter === 'all'
                        ? 'border-[#5B3BFA] bg-violet-50 text-[#5B3BFA]'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const root = requestModalMonthKey ? overviewByKey[requestModalMonthKey] : undefined;
                      const nodes = collectTreeNodesWithRoot(root);
                      const next = nodes
                        .filter((n) => n.id !== root?.id)
                        .filter((n) => parseTierNumber(n.tier) >= 2)
                        .map((n) => n.id);
                      setRequestTierFilter('tier2');
                      setSelectedRequestNodeIds(new Set(next));
                      setExpandedRequestNodeIds(new Set(nodes.map((n) => n.id)));
                    }}
                    className={`rounded-lg border px-3 py-1 text-xs transition-colors ${
                      requestTierFilter === 'tier2'
                        ? 'border-[#5B3BFA] bg-violet-50 text-[#5B3BFA]'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    2차만
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const root = requestModalMonthKey ? overviewByKey[requestModalMonthKey] : undefined;
                      const nodes = collectTreeNodesWithRoot(root);
                      const next = nodes
                        .filter((n) => n.id !== root?.id)
                        .filter((n) => parseTierNumber(n.tier) >= 3)
                        .map((n) => n.id);
                      setRequestTierFilter('tier3');
                      setSelectedRequestNodeIds(new Set(next));
                      setExpandedRequestNodeIds(new Set(nodes.map((n) => n.id)));
                    }}
                    className={`rounded-lg border px-3 py-1 text-xs transition-colors ${
                      requestTierFilter === 'tier3'
                        ? 'border-[#5B3BFA] bg-violet-50 text-[#5B3BFA]'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    3차만
                  </button>
                </div>
                <div className="max-h-72 overflow-auto rounded-xl border border-gray-200 p-3">
                  {(() => {
                    const root = requestModalMonthKey ? overviewByKey[requestModalMonthKey] : undefined;
                    if (!root) {
                      return <p className="text-sm text-gray-500">요청 대상이 없습니다.</p>;
                    }

                    const toggleExpand = (nodeId: string) => {
                      setExpandedRequestNodeIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(nodeId)) next.delete(nodeId);
                        else next.add(nodeId);
                        return next;
                      });
                    };

                    const renderRequestNode = (node: DataNode, depth: number, isRoot = false) => {
                      const hasChildren = (node.children?.length ?? 0) > 0;
                      const isExpanded = expandedRequestNodeIds.has(node.id);
                      const checked = selectedRequestNodeIds.has(node.id);
                      const tierNo = parseTierNumber(node.tier);
                      const selectableByFilter =
                        requestTierFilter === 'all'
                          ? tierNo >= 2
                          : requestTierFilter === 'tier2'
                            ? tierNo >= 2
                            : tierNo >= 3;
                      const isSelectable = !isRoot && selectableByFilter;

                      return (
                        <div key={node.id}>
                          <div
                            className="mb-1 flex items-center gap-2 rounded px-1 py-1 hover:bg-gray-50"
                            style={{ marginLeft: `${Math.max(0, depth) * 12}px` }}
                          >
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={() => toggleExpand(node.id)}
                                className="rounded p-0.5 text-gray-500 hover:bg-gray-100"
                              >
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                            ) : (
                              <span className="inline-block h-4 w-4" />
                            )}

                            {isRoot ? (
                              <span className="inline-block h-4 w-4" />
                            ) : (
                              <input
                                type="checkbox"
                                disabled={!isSelectable}
                                checked={checked}
                                onChange={(e) => {
                                  if (!isSelectable) return;
                                  setSelectedRequestNodeIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(node.id);
                                    else next.delete(node.id);
                                    return next;
                                  });
                                }}
                              />
                            )}

                            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{node.tier}</span>
                            <span className={`text-sm ${isSelectable || isRoot ? 'text-gray-800' : 'text-gray-400'}`}>{node.companyName}</span>
                          </div>

                          {hasChildren && isExpanded && (
                            <div>
                              {node.children!.map((child) => renderRequestNode(child, depth + 1, false))}
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <>
                        <div className="mb-3 text-xs text-gray-500">
                          현재 선택된 노드: <span className="font-semibold text-gray-800">{root.companyName} (나)</span>
                        </div>
                        {renderRequestNode(root, 0, true)}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-800">요청 메시지 입력</h4>
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="요청 메시지 입력"
                    className="h-24 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  />
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-800">제출 기한 설정</h4>
                  <input
                    type="date"
                    value={requestDueDate}
                    onChange={(e) => setRequestDueDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowLowerTierRequestModal(false);
                  setRequestModalContext(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (selectedRequestNodeIds.size === 0) {
                    toast.error('요청 대상을 1개 이상 선택해주세요.');
                    return;
                  }
                  if (!requestModalContext) {
                    toast.error('요청 컨텍스트를 찾을 수 없습니다. 모달을 다시 열어주세요.');
                    return;
                  }
                  if (!requestDueDate) {
                    toast.error('제출 기한을 선택해주세요.');
                    return;
                  }

                  const root = requestModalMonthKey ? overviewByKey[requestModalMonthKey] : undefined;
                  const allNodes: DataNode[] = [];
                  const walk = (n?: DataNode) => {
                    if (!n) return;
                    allNodes.push(n);
                    for (const c of n.children ?? []) walk(c);
                  };
                  walk(root);
                  const targetNodeIds = allNodes
                    .filter((n) => selectedRequestNodeIds.has(n.id))
                    .map((n) => n.supplyChainNodeId)
                    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
                  if (targetNodeIds.length === 0) {
                    toast.error('요청 가능한 공급망 노드를 찾지 못했습니다.');
                    return;
                  }

                  const payload: OprDataRequestCreateBody = {
                    project_id: requestModalContext.projectId,
                    product_id: requestModalContext.productId,
                    product_variant_id: requestModalContext.productVariantId,
                    reporting_year: requestModalContext.reportingYear,
                    reporting_month: requestModalContext.reportingMonth,
                    requester_supply_chain_node_id: requestModalContext.requesterSupplyChainNodeId,
                    request_mode: 'chain',
                    message: requestMessage || null,
                    due_date: requestDueDate,
                    target_supply_chain_node_ids: targetNodeIds,
                  };
                  try {
                    const res = await postOprDataRequest(payload);
                    toast.success(`요청 ${res.target_count}건을 전송했습니다.`);
                    setShowLowerTierRequestModal(false);
                    setRequestModalContext(null);
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    toast.error(`요청 전송 실패: ${msg}`);
                  }
                }}
                className="rounded-lg bg-[#5B3BFA] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                요청 보내기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}