'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, ChevronDown, Download, CheckCircle, Clock, AlertTriangle, FileText, Network, TrendingUp, Play, Info, X, Calculator, History, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import MonthPicker from './MonthPicker';
import { useMode } from '../context/ModeContext';
import { apiFetch, restoreOprSessionFromCookie } from '@/lib/api/client';
import { getOprAccessToken } from '@/lib/api/sessionAccessToken';
import {
  getOprBomPeriod,
  getOprPcfReadiness,
  postOprDataRequest,
  type OprPcfReadinessResponse,
} from '@/lib/api/dataMgmtOpr';
import { getOprDataViewContacts } from '@/lib/api/iamOpr';
import { getOprPcfReadinessForNotify, getOprPcfRuns, postOprPcfRunExecute } from '@/lib/api/pcf';

/** 데이터 관리(DataView)와 동일: 공급망 API로 고객→지사→제품→세부제품 스캐폴드 */
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

let pcfScaffoldCache: ScaffoldVariantRow[] | null = null;
let pcfScaffoldInFlight: Promise<ScaffoldVariantRow[]> | null = null;

async function loadPcfScaffoldRows(): Promise<ScaffoldVariantRow[]> {
  if (pcfScaffoldCache) return pcfScaffoldCache;
  if (pcfScaffoldInFlight) return pcfScaffoldInFlight;

  pcfScaffoldInFlight = (async () => {
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

    pcfScaffoldCache = rows;
    return rows;
  })();

  try {
    return await pcfScaffoldInFlight;
  } finally {
    pcfScaffoldInFlight = null;
  }
}

/** 이름과 코드가 같으면 한 번만 표시 (예: prodA_var1 | prodA_var1 방지) */
function formatVariantLabel(name: string, code: string | null | undefined): string {
  const n = (name || '').trim();
  const c = (code || '').trim();
  if (c && c !== n) return `${n} | ${c}`;
  return n || c || '—';
}

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

/** 달력 기준 직전 달 (예: 4월 → 3월), `YYYY-MM` */
function getPreviousCalendarMonthYm(base: Date = new Date()): string {
  const y = base.getFullYear();
  const monthIndex = base.getMonth(); // 0..11
  const d = new Date(y, monthIndex - 1, 1);
  const py = d.getFullYear();
  const pm = d.getMonth() + 1;
  return `${py}-${String(pm).padStart(2, '0')}`;
}

/** 프로젝트 허용 월 중 기본값: 전월이 있으면 전월, 없으면 전월 이하 최신 허용월, 그것도 없으면 기간 내 첫 달 */
function pickDefaultPeriodMonth(enabled: string[]): string | null {
  if (enabled.length === 0) return null;
  const sorted = [...enabled].sort();
  const prev = getPreviousCalendarMonthYm();
  if (sorted.includes(prev)) return prev;
  const notAfterPrev = sorted.filter((m) => m <= prev);
  if (notAfterPrev.length > 0) return notAfterPrev[notAfterPrev.length - 1];
  return sorted[0];
}

function monthsFromProjectIso(startIso: string, endIso: string): string[] {
  const s = parseIsoToYearMonth(startIso);
  const e = parseIsoToYearMonth(endIso);
  const startYm = `${s.y}-${String(s.m).padStart(2, '0')}`;
  const endYm = `${e.y}-${String(e.m).padStart(2, '0')}`;
  return enumerateMonthsBetweenYm(startYm, endYm);
}

// Types
interface Customer {
  id: string;
  name: string;
}

interface SubBranch {
  id: string;
  customerId: string;
  name: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
}

interface SubProduct {
  id: string;
  productId: string;
  name: string;
}

interface SupplyChainVersion {
  id: string;
  code: string;
  version: string;
  createdDate: string;
  supplierCount: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  dataCoverage: number;
}

interface MBomVersion {
  id: string;
  version: string;
  createdDate: string;
  materialCount: number;
  matchingRate: number;
}

interface PcfCalculationResult {
  id: string;
  calculationId: string;
  productName: string;
  supplyChainVersion: string;
  mbomVersion: string;
  period: string;
  coverage: number;
  averageDqr: number;
  totalEmission: number;
  status: 'completed' | 'in_progress' | 'pending' | 'error';
  calculatedDate: string;
}

interface SupplyChainNode {
  id: string;
  companyName: string;
  tier: number;
  dataStatus: 'submitted' | 'pending' | 'incomplete';
  country: string;
  children?: SupplyChainNode[];
}

interface MBomMaterial {
  id: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplierName: string;
  efSource: string;
  dataMatched: boolean;
  dqrScore: number;
}

// Mock Data
const mockCustomers: Customer[] = [
  { id: 'cust1', name: 'A 자동차' },
  { id: 'cust2', name: 'B 모빌리티' },
  { id: 'cust3', name: 'C 그룹' },
];

const mockSubBranches: SubBranch[] = [
  { id: 'branch1', customerId: 'cust1', name: '국내사업본부' },
  { id: 'branch2', customerId: 'cust1', name: '해외사업본부' },
  { id: 'branch3', customerId: 'cust2', name: '전동화사업부' },
  { id: 'branch4', customerId: 'cust2', name: '에너지사업부' },
  { id: 'branch5', customerId: 'cust3', name: 'R&D센터' },
];

const mockProducts: Product[] = [
  { id: 'prod1', code: 'BM-A-100', name: '배터리 모듈 A', description: '중형 전기차용 배터리 모듈' },
  { id: 'prod2', code: 'SSC-200', name: '전고체 셀', description: '차세대 전고체 배터리 셀' },
  { id: 'prod3', code: 'ESS-300', name: 'ESS 팩', description: '에너지 저장 시스템용 배터리 팩' },
];

const mockSubProducts: SubProduct[] = [
  { id: 'sub1', productId: 'prod1', name: '배터리 모듈 A-1 (표준형)' },
  { id: 'sub2', productId: 'prod1', name: '배터리 모듈 A-2 (고용량)' },
  { id: 'sub3', productId: 'prod2', name: '전고체 셀 60Ah' },
  { id: 'sub4', productId: 'prod2', name: '전고체 셀 80Ah' },
  { id: 'sub5', productId: 'prod3', name: 'ESS 팩 1MWh' },
  { id: 'sub6', productId: 'prod3', name: 'ESS 팩 2MWh' },
];

const mockSupplyChainVersions: SupplyChainVersion[] = [
  {
    id: 'scv1',
    code: 'SC-1',
    version: 'SCV-2026-01',
    createdDate: '2026-03-01',
    supplierCount: { tier1: 3, tier2: 7, tier3: 4 },
    dataCoverage: 95.5,
  },
  {
    id: 'scv2',
    code: 'SC-2',
    version: 'SCV-2026-02',
    createdDate: '2026-02-15',
    supplierCount: { tier1: 3, tier2: 6, tier3: 3 },
    dataCoverage: 92.3,
  },
];

const mockMBomVersions: MBomVersion[] = [
  {
    id: 'mbom1',
    version: 'M-BOM v2.3',
    createdDate: '2026-03-02',
    materialCount: 45,
    matchingRate: 91.2,
  },
  {
    id: 'mbom2',
    version: 'M-BOM v2.2',
    createdDate: '2026-02-20',
    materialCount: 43,
    matchingRate: 88.5,
  },
];

const mockSupplyChainStructure: SupplyChainNode[] = [
  {
    id: 'tier1-1',
    companyName: '한국배터리',
    tier: 1,
    dataStatus: 'submitted',
    country: 'South Korea',
    children: [
      {
        id: 'tier2-1',
        companyName: '셀테크',
        tier: 2,
        dataStatus: 'submitted',
        country: 'China',
        children: [
          {
            id: 'tier3-1',
            companyName: '리튬소재',
            tier: 3,
            dataStatus: 'submitted',
            country: 'Chile',
          },
        ],
      },
      {
        id: 'tier2-2',
        companyName: '글로벌소재',
        tier: 2,
        dataStatus: 'submitted',
        country: 'Germany',
      },
    ],
  },
  {
    id: 'tier1-2',
    companyName: '파워셀 테크놀로지',
    tier: 1,
    dataStatus: 'submitted',
    country: 'Japan',
    children: [
      {
        id: 'tier2-3',
        companyName: '아시아소재',
        tier: 2,
        dataStatus: 'submitted',
        country: 'Taiwan',
      },
    ],
  },
];

const mockMBomMaterials: MBomMaterial[] = [
  {
    id: 'mat1',
    materialName: '리튬이온 셀',
    quantity: 120,
    unit: 'EA',
    supplierName: '한국배터리',
    efSource: 'Ecoinvent 3.9',
    dataMatched: true,
    dqrScore: 1.5,
  },
  {
    id: 'mat2',
    materialName: '양극재 (NCM811)',
    quantity: 15.5,
    unit: 'kg',
    supplierName: '셀테크',
    efSource: 'Primary Data',
    dataMatched: true,
    dqrScore: 1.2,
  },
  {
    id: 'mat3',
    materialName: '전해액',
    quantity: 8.2,
    unit: 'L',
    supplierName: '아시아소재',
    efSource: 'Primary Data',
    dataMatched: true,
    dqrScore: 1.4,
  },
  {
    id: 'mat4',
    materialName: '알루미늄 케이스',
    quantity: 3.5,
    unit: 'kg',
    supplierName: '글로벌소재',
    efSource: 'GaBi Database',
    dataMatched: true,
    dqrScore: 1.8,
  },
  {
    id: 'mat5',
    materialName: 'BMS (배터리 관리 시스템)',
    quantity: 1,
    unit: 'SET',
    supplierName: '파워셀 테크놀로지',
    efSource: 'Primary Data',
    dataMatched: true,
    dqrScore: 1.3,
  },
];

const mockCalculationResults: PcfCalculationResult[] = [
  {
    id: 'calc1',
    calculationId: 'PCF-2026-001',
    productName: '배터리 모듈 A',
    supplyChainVersion: 'SCV-2026-01',
    mbomVersion: 'M-BOM v2.3',
    period: '2026년 1월',
    coverage: 95.5,
    averageDqr: 1.6,
    totalEmission: 32420.3,
    status: 'completed',
    calculatedDate: '2026-03-01',
  },
  {
    id: 'calc2',
    calculationId: 'PCF-2026-002',
    productName: '배터리 모듈 A',
    supplyChainVersion: 'SCV-2026-02',
    mbomVersion: 'M-BOM v2.2',
    period: '2026년 2월',
    coverage: 92.3,
    averageDqr: 1.8,
    totalEmission: 33150.7,
    status: 'completed',
    calculatedDate: '2026-02-25',
  },
  {
    id: 'calc3',
    calculationId: 'PCF-2026-003',
    productName: '전고체 셀',
    supplyChainVersion: 'SCV-2026-01',
    mbomVersion: 'M-BOM v1.5',
    period: '2026년 3월',
    coverage: 88.5,
    averageDqr: 2.1,
    totalEmission: 28930.5,
    status: 'in_progress',
    calculatedDate: '2026-03-02',
  },
];

// 계산 이력 타입 추가
interface CalculationHistory {
  id: string;
  calculationType: 'partial' | 'final';
  calculationDate: string;
  targetSummary: string;
  status: 'partial_saved' | 'final_completed' | 'recalculated';
  productPcf: number;
  kgPcf: number;
  executor: string;
}

export default function PcfCalculation() {
  const router = useRouter();
  const { mode } = useMode();
  
  // 세부탭 상태
  const [activeTab, setActiveTab] = useState<'calculation' | 'history'>('calculation');

  const [scaffoldVariants, setScaffoldVariants] = useState<ScaffoldVariantRow[]>([]);
  const [scaffoldLoading, setScaffoldLoading] = useState(false);
  const [bomPeriodBrief, setBomPeriodBrief] = useState<{
    bom_code: string | null;
    project_start: string;
    project_end: string;
  } | null>(null);

  // Selection states (값은 DB id 문자열, 데이터 관리와 동일)
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const lastDetailForMonthRef = useRef<string>('');
  const monthUserClearedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const loadScaffold = async () => {
      setScaffoldLoading(true);
      try {
        const rows = await loadPcfScaffoldRows();
        if (mounted) setScaffoldVariants(rows);
      } catch (e) {
        console.error('PcfCalculation scaffold load failed', e);
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
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const b = await getOprBomPeriod(vid, bid);
        if (!cancelled) setBomPeriodBrief(b);
      } catch {
        if (!cancelled) setBomPeriodBrief(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDetailProduct, selectedBranch, selectedDetailMeta?.branchId]);

  const displayBomCode = bomPeriodBrief?.bom_code?.trim() || '';

  const projectPeriodMonths = useMemo((): string[] => {
    if (bomPeriodBrief?.project_start && bomPeriodBrief?.project_end) {
      return monthsFromProjectIso(bomPeriodBrief.project_start, bomPeriodBrief.project_end);
    }
    if (!selectedDetailMeta) return [];
    return monthsFromProjectIso(selectedDetailMeta.projectStartIso, selectedDetailMeta.projectEndIso);
  }, [bomPeriodBrief, selectedDetailMeta]);

  useEffect(() => {
    if (!selectedDetailProduct) {
      setSelectedMonth(null);
      lastDetailForMonthRef.current = '';
      monthUserClearedRef.current = false;
      return;
    }
    if (projectPeriodMonths.length === 0) return;
    const detailChanged = lastDetailForMonthRef.current !== selectedDetailProduct;
    if (detailChanged) {
      lastDetailForMonthRef.current = selectedDetailProduct;
      monthUserClearedRef.current = false;
      setSelectedMonth(pickDefaultPeriodMonth(projectPeriodMonths));
      return;
    }
    setSelectedMonth((cur) => {
      if (cur != null && projectPeriodMonths.includes(cur)) return cur;
      if (monthUserClearedRef.current && cur === null) return null;
      return pickDefaultPeriodMonth(projectPeriodMonths);
    });
  }, [selectedDetailProduct, projectPeriodMonths]);

  const selectionSummaryText = useMemo(() => {
    const cn =
      customerOptions.find((c) => String(c.id) === selectedCustomer)?.name ?? '';
    const bn =
      branchOptions.find((b) => String(b.id) === selectedBranch)?.name ?? '';
    const pn =
      productOptions.find((p) => String(p.id) === selectedProduct)?.name ?? '';
    const dn = selectedDetailMeta
      ? formatVariantLabel(selectedDetailMeta.variantName, selectedDetailMeta.variantCode)
      : '';
    const bom = displayBomCode || '-';
    return [cn, bn, pn, dn, bom, selectedMonth].filter(Boolean).join(' / ');
  }, [
    customerOptions,
    branchOptions,
    productOptions,
    selectedCustomer,
    selectedBranch,
    selectedProduct,
    selectedDetailMeta,
    displayBomCode,
    selectedMonth,
  ]);

  const [pcfReadiness, setPcfReadiness] = useState<OprPcfReadinessResponse | null>(null);
  const [pcfReadinessLoading, setPcfReadinessLoading] = useState(false);
  const [monthRunState, setMonthRunState] = useState({ partial: false, final: false });

  const isTargetSelectionComplete =
    selectedCustomer !== '' &&
    selectedBranch !== '' &&
    selectedProduct !== '' &&
    selectedDetailProduct !== '' &&
    selectedMonth != null &&
    projectPeriodMonths.includes(selectedMonth);

  const refreshMonthRunState = useCallback(async () => {
    if (!selectedDetailProduct || !selectedMonth || !selectedProduct || !selectedDetailMeta?.projectId) {
      setMonthRunState({ partial: false, final: false });
      return;
    }
    const vid = Number(selectedDetailProduct);
    const pid = Number(selectedProduct);
    const projectId = Number(selectedDetailMeta.projectId);
    const [yRaw, mRaw] = selectedMonth.split('-');
    const ry = Number(yRaw);
    const rm = Number(mRaw);
    if (
      !Number.isFinite(vid) ||
      !Number.isFinite(pid) ||
      !Number.isFinite(projectId) ||
      !Number.isFinite(ry) ||
      !Number.isFinite(rm)
    ) {
      setMonthRunState({ partial: false, final: false });
      return;
    }
    try {
      const rows = await getOprPcfRuns({
        project_id: projectId,
        product_id: pid,
        product_variant_id: vid,
        reporting_year: ry,
        reporting_month: rm,
        limit: 100,
        offset: 0,
      });
      const isDone = (s?: string) => {
        const v = (s || '').toLowerCase();
        return v === 'completed' || v === 'success';
      };
      // 원청 기준: node_rollup=부분, batch=최종
      const partial = rows.some((r) => isDone(r.status) && (r.run_kind || '').toLowerCase() === 'node_rollup');
      const final = rows.some((r) => isDone(r.status) && (r.run_kind || '').toLowerCase() === 'batch');
      setMonthRunState({ partial, final });
    } catch {
      setMonthRunState({ partial: false, final: false });
    }
  }, [selectedDetailMeta?.projectId, selectedDetailProduct, selectedMonth, selectedProduct]);

  useEffect(() => {
    void refreshMonthRunState();
  }, [refreshMonthRunState]);

  useEffect(() => {
    if (!isTargetSelectionComplete || !selectedBranch || !selectedDetailProduct || !selectedMonth) {
      setPcfReadiness(null);
      return;
    }
    const branchId = Number(selectedBranch);
    const vid = Number(selectedDetailProduct);
    const parts = selectedMonth.split('-');
    const ry = parseInt(parts[0] ?? '', 10);
    const rm = parseInt(parts[1] ?? '', 10);
    if (!Number.isFinite(branchId) || !Number.isFinite(vid) || !ry || !rm) return;
    let cancelled = false;
    void (async () => {
      setPcfReadinessLoading(true);
      try {
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const r = await getOprPcfReadiness(vid, ry, rm, branchId);
        if (!cancelled) setPcfReadiness(r);
      } catch (e) {
        if (!cancelled) {
          setPcfReadiness(null);
          toast.error(e instanceof Error ? e.message : 'PCF 준비도를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setPcfReadinessLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTargetSelectionComplete, selectedBranch, selectedDetailProduct, selectedMonth]);

  const primaryDataComplete = pcfReadiness?.operator_data_ready ?? false;
  const supplierDataComplete = pcfReadiness?.supplier_submitted ?? 0;
  const supplierDataTotal = pcfReadiness?.supplier_total ?? 0;
  const missingSuppliers = Math.max(0, supplierDataTotal - supplierDataComplete);
  const allSuppliersReady = pcfReadiness?.all_suppliers_submitted ?? false;

  // 부분산정/최종산정 가능 여부 (실제 산정 엔진은 추후 연동)
  const canPartialCalculate =
    selectedCustomer !== '' &&
    selectedBranch !== '' &&
    selectedProduct !== '' &&
    selectedDetailProduct !== '' &&
    selectedMonth != null &&
    projectPeriodMonths.includes(selectedMonth) &&
    !pcfReadinessLoading &&
    primaryDataComplete;

  const canFinalCalculate = canPartialCalculate && allSuppliersReady;

  // 계산 결과 표시 상태
  const [showResult, setShowResult] = useState(false);
  const [currentResult, setCurrentResult] = useState<'partial' | 'final' | null>(null);

  // 트리 테이블 확장 상태
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set(['prime']));

  // 계산식 드로어 상태
  const [detailDrawer, setDetailDrawer] = useState<{ open: boolean; companyId: string | null }>({
    open: false,
    companyId: null,
  });

  // 드로어 아코디언 상태
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['material', 'energy', 'transport', 'supplier']));

  // 히스토리 상세보기 모달 상태
  const [historyDetailModal, setHistoryDetailModal] = useState<{ open: boolean; historyId: string | null }>({
    open: false,
    historyId: null,
  });
  const [isHistoryDownloadSelecting, setIsHistoryDownloadSelecting] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

  // 부분산정 불러오기 선택
  const [selectedPartialHistory, setSelectedPartialHistory] = useState<string>('');
  const [executorFallbackName, setExecutorFallbackName] = useState<string>('사용자');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const resp = await getOprDataViewContacts();
        const selfRow = resp.rows.find((r) => r.is_self);
        const nm = (selfRow?.name || '').trim();
        if (!cancelled && nm) setExecutorFallbackName(nm);
      } catch {
        // 이름 조회 실패 시 기본값 유지
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [histories, setHistories] = useState<CalculationHistory[]>([]);
  const [isPartialCalculating, setIsPartialCalculating] = useState(false);
  const [isRequestingMissingSuppliers, setIsRequestingMissingSuppliers] = useState(false);

  const loadHistoriesFromServer = useCallback(async () => {
    const projectIds = Array.from(new Set(scaffoldVariants.map((v) => v.projectId))).filter((v) =>
      Number.isFinite(v),
    );
    if (projectIds.length === 0) {
      setHistories([]);
      return;
    }
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const runChunks = await Promise.all(
      projectIds.map((projectId) =>
        getOprPcfRuns({
          project_id: projectId,
          limit: 200,
          offset: 0,
        }),
      ),
    );
    const runs = runChunks.flat();
    const mappedAll: CalculationHistory[] = runs.map((r) => {
      const asNum = (v: unknown): number | null => {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string') {
          const n = Number(v.replace(/,/g, '').trim());
          if (Number.isFinite(n)) return n;
        }
        return null;
      };
      const runKind = (r.run_kind || '').trim().toLowerCase();
      // 원청 백엔드 기준: batch=최종, node_rollup=부분
      // 예상 밖 값이 와도 "부분" 우선으로 분류해 기존 부분산정 불러오기가 비지 않도록 보정
      const calculationType: CalculationHistory['calculationType'] =
        runKind === 'batch' || runKind.includes('final')
          ? 'final'
          : 'partial';
      const status: CalculationHistory['status'] =
        calculationType === 'final' ? 'final_completed' : 'partial_saved';
      const monthYm = `${r.reporting_year}-${pad2(r.reporting_month)}`;
      const variantName =
        scaffoldVariants.find((v) => v.variantId === (r.product_variant_id ?? -1))?.variantName ||
        String(r.product_variant_id ?? '-');
      const tsRaw = (r.finished_at || r.created_at || '').toString();
      const ts = tsRaw ? tsRaw.slice(0, 16).replace('T', ' ') : monthYm;
      const declaredPcf = asNum(r.pcf_per_declared_unit_kg);
      const perMassPcf = asNum(r.pcf_per_product_mass_kg);
      const totalCo2e = asNum(r.total_co2e_kg);
      // 일부 게이트웨이/환경에서 pcf_per_* 필드 누락 시 total_co2e를 폴백으로 사용
      const productPcf = declaredPcf ?? totalCo2e ?? 0;
      const kgPcf = perMassPcf ?? 0;
      return {
        id: `hist-run-${r.id}`,
        calculationType,
        calculationDate: ts,
        targetSummary: `project ${r.project_id} / - / ${r.product_name || '-'} / ${variantName} / ${r.bom_label || '-'} / ${monthYm}`,
        status,
        productPcf,
        kgPcf,
        executor: r.executed_by_name?.trim() || (r.triggered_by_user_id ? `사용자#${r.triggered_by_user_id}` : executorFallbackName),
      };
    });
    // 동일 대상/월/산정유형은 최신 실행 1건만 노출(재실행 시 업데이트 체감)
    const latestByKey = new Map<string, CalculationHistory>();
    for (const row of mappedAll) {
      const key = `${row.calculationType}|${row.targetSummary}`;
      const prev = latestByKey.get(key);
      if (!prev) {
        latestByKey.set(key, row);
        continue;
      }
      const curNum = Number(row.id.replace('hist-run-', ''));
      const prevNum = Number(prev.id.replace('hist-run-', ''));
      if (Number.isFinite(curNum) && Number.isFinite(prevNum) && curNum > prevNum) {
        latestByKey.set(key, row);
      }
    }
    setHistories(Array.from(latestByKey.values()).sort((a, b) => {
      const an = Number(a.id.replace('hist-run-', ''));
      const bn = Number(b.id.replace('hist-run-', ''));
      return bn - an;
    }));
  }, [scaffoldVariants, executorFallbackName]);

  useEffect(() => {
    void loadHistoriesFromServer().catch(() => {
      setHistories([]);
    });
  }, [loadHistoriesFromServer]);

  // 부분산정 실행
  const handlePartialCalculate = async () => {
    if (isPartialCalculating) return;
    if (!canPartialCalculate) {
      toast.error('부분산정 조건이 충족되지 않았습니다');
      return;
    }
    const vid = Number(selectedDetailProduct);
    const pid = Number(selectedProduct);
    const projectId = selectedDetailMeta?.projectId ?? null;
    if (!Number.isFinite(vid) || !Number.isFinite(pid) || !projectId || !selectedMonth) {
      toast.error('산정 대상(project/product/variant/month) 정보가 없습니다.');
      return;
    }
    const [yRaw, mRaw] = selectedMonth.split('-');
    const ry = Number(yRaw);
    const rm = Number(mRaw);
    if (!Number.isFinite(ry) || !Number.isFinite(rm)) {
      toast.error('조회 월 형식이 올바르지 않습니다.');
      return;
    }
    setIsPartialCalculating(true);
    try {
      const runResult = await postOprPcfRunExecute({
        project_id: projectId,
        product_id: pid,
        product_variant_id: vid,
        reporting_year: ry,
        reporting_month: rm,
        calculation_mode: 'partial',
      });
      await refreshMonthRunState();
      setCurrentResult('partial');
      setShowResult(true);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      await loadHistoriesFromServer();
      toast.success('부분산정 실행 및 저장이 완료되었습니다.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '부분산정 실행에 실패했습니다.');
    } finally {
      setIsPartialCalculating(false);
    }
  };

  // 최종산정 실행
  const handleFinalCalculate = async () => {
    if (!canFinalCalculate) {
      toast.error('최종산정 조건이 충족되지 않았습니다');
      return;
    }
    const vid = Number(selectedDetailProduct);
    const pid = Number(selectedProduct);
    const projectId = selectedDetailMeta?.projectId ?? null;
    if (!Number.isFinite(vid) || !Number.isFinite(pid) || !projectId || !selectedMonth) {
      toast.error('산정 대상(project/product/variant/month) 정보가 없습니다.');
      return;
    }
    const [yRaw, mRaw] = selectedMonth.split('-');
    const ry = Number(yRaw);
    const rm = Number(mRaw);
    if (!Number.isFinite(ry) || !Number.isFinite(rm)) {
      toast.error('조회 월 형식이 올바르지 않습니다.');
      return;
    }
    try {
      const runResult = await postOprPcfRunExecute({
        project_id: projectId,
        product_id: pid,
        product_variant_id: vid,
        reporting_year: ry,
        reporting_month: rm,
        calculation_mode: 'final',
      });
      await refreshMonthRunState();
      setCurrentResult('final');
      setShowResult(true);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      await loadHistoriesFromServer();
      toast.success('최종 PCF 산정을 실행했습니다.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '최종 PCF 산정 실행에 실패했습니다.');
    }
  };

  // 부분산정 불러오기
  const handleLoadPartialHistory = () => {
    if (!selectedPartialHistory) {
      toast.error('불러올 부분산정 기록을 선택해주세요');
      return;
    }
    const loaded = histories.find((h) => h.id === selectedPartialHistory);
    if (!loaded) {
      toast.error('선택한 부분산정 기록을 찾을 수 없습니다.');
      return;
    }
    setCurrentResult('partial');
    setShowResult(true);
    toast.success('부분산정 기록을 불러왔습니다.');
  };

  // 미입력 협력사 요청
  const handleRequestMissingSuppliers = async () => {
    if (isRequestingMissingSuppliers) return;
    const vid = Number(selectedDetailProduct);
    const pid = Number(selectedProduct);
    const projectId = selectedDetailMeta?.projectId ?? null;
    if (!Number.isFinite(vid) || !Number.isFinite(pid) || !projectId || !selectedMonth) {
      toast.error('요청 대상(project/product/variant/month) 정보가 없습니다.');
      return;
    }
    const [yRaw, mRaw] = selectedMonth.split('-');
    const ry = Number(yRaw);
    const rm = Number(mRaw);
    if (!Number.isFinite(ry) || !Number.isFinite(rm)) {
      toast.error('조회 월 형식이 올바르지 않습니다.');
      return;
    }
    try {
      setIsRequestingMissingSuppliers(true);
      const rd = await getOprPcfReadinessForNotify({
        project_id: projectId,
        product_id: pid,
        product_variant_id: vid,
        reporting_year: ry,
        reporting_month: rm,
      });
      const targetNodeIds = rd.suppliers
        .filter((s) => !s.ready)
        .map((s) => s.supply_chain_node_id);
      if (targetNodeIds.length === 0) {
        toast.info('현재 월 기준 미입력 협력사가 없습니다.');
        return;
      }
      await postOprDataRequest({
        project_id: projectId,
        product_id: pid,
        product_variant_id: vid,
        reporting_year: ry,
        reporting_month: rm,
        request_mode: 'chain',
        message: '데이터를 입력하고 PCF 최종산정 후 제출하세요',
        target_supply_chain_node_ids: targetNodeIds,
      });
      toast.success(`미입력 협력사 ${targetNodeIds.length}곳에 요청 알림을 발송했습니다.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '미입력 협력사 요청 발송에 실패했습니다.');
    } finally {
      setIsRequestingMissingSuppliers(false);
    }
  };

  // 트리 토글
  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // 계산식 드로어 열기
  const openDetailDrawer = (companyId: string) => {
    setDetailDrawer({ open: true, companyId });
  };

  // 계산식 드로어 닫기
  const closeDetailDrawer = () => {
    setDetailDrawer({ open: false, companyId: null });
  };

  // 드로어 섹션 토글
  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  // 히스토리 상세보기 모달 열기
  const openHistoryDetail = (historyId: string) => {
    setHistoryDetailModal({ open: true, historyId });
  };

  // 히스토리 상세보기 모달 닫기
  const closeHistoryDetail = () => {
    setHistoryDetailModal({ open: false, historyId: null });
  };

  const toggleHistorySelection = (historyId: string) => {
    const next = new Set(selectedHistoryIds);
    if (next.has(historyId)) {
      next.delete(historyId);
    } else {
      next.add(historyId);
    }
    setSelectedHistoryIds(next);
  };

  const toggleSelectAllHistories = () => {
    if (selectedHistoryIds.size === histories.length) {
      setSelectedHistoryIds(new Set());
      return;
    }
    setSelectedHistoryIds(new Set(histories.map((h) => h.id)));
  };

  const startHistoryDownloadSelection = () => {
    setIsHistoryDownloadSelecting(true);
    setSelectedHistoryIds(new Set());
  };

  const cancelHistoryDownloadSelection = () => {
    setIsHistoryDownloadSelecting(false);
    setSelectedHistoryIds(new Set());
  };

  const completeHistoryDownloadSelection = () => {
    if (selectedHistoryIds.size === 0) {
      toast.error('다운로드할 이력을 1개 이상 선택해주세요.');
      return;
    }

    const selectedRows = histories.filter((h) => selectedHistoryIds.has(h.id));
    const typeLabel = (type: CalculationHistory['calculationType']) =>
      type === 'partial' ? '부분산정' : '최종산정';
    const statusLabel = (status: CalculationHistory['status']) => {
      if (status === 'partial_saved') return '부분산정 저장';
      if (status === 'final_completed') return '최종산정 완료';
      return '재산정 완료';
    };
    const buildCommonBase = (row: CalculationHistory) => ({
      산정일시: row.calculationDate,
      산정유형: typeLabel(row.calculationType),
      산정대상: row.targetSummary,
      상태: statusLabel(row.status),
      실행자: row.executor,
    });

    // 1) 요약 시트
    const summarySheetRows = selectedRows.map((row) => ({
      ...buildCommonBase(row),
      제품기준_PCF_kgCO2e: Number(row.productPcf.toFixed(1)),
      kg기준_PCF_kgCO2e_per_kg: Number(row.kgPcf.toFixed(4)),
    }));

    // 2) 상세 시트들
    const materialRows = selectedRows.map((row) => [
      {
        ...buildCommonBase(row),
        카테고리: '자재 배출량',
        항목: '양극재',
        계산식: '15.5 kg × 42.3 kgCO₂e/kg',
        배출량_kgCO2e: 655.65,
      },
      {
        ...buildCommonBase(row),
        카테고리: '자재 배출량',
        항목: '음극재',
        계산식: '12.0 kg × 28.1 kgCO₂e/kg',
        배출량_kgCO2e: 337.2,
      },
      {
        ...buildCommonBase(row),
        카테고리: '자재 배출량',
        항목: '전해액',
        계산식: '8.2 L × 18.5 kgCO₂e/L',
        배출량_kgCO2e: 151.7,
      },
      {
        ...buildCommonBase(row),
        카테고리: '자재 배출량',
        항목: '합계',
        계산식: '-',
        배출량_kgCO2e: 1144.55,
      },
    ]).flat();

    const energyRows = selectedRows.map((row) => [
      {
        ...buildCommonBase(row),
        카테고리: '에너지 배출량',
        항목: '전력',
        계산식: '1,250 kWh × 0.4653 kgCO₂e/kWh',
        배출량_kgCO2e: 581.63,
      },
      {
        ...buildCommonBase(row),
        카테고리: '에너지 배출량',
        항목: 'LNG',
        계산식: '450 m³ × 2.176 kgCO₂e/m³',
        배출량_kgCO2e: 979.2,
      },
      {
        ...buildCommonBase(row),
        카테고리: '에너지 배출량',
        항목: '합계',
        계산식: '-',
        배출량_kgCO2e: 1560.83,
      },
    ]).flat();

    const transportRows = selectedRows.map((row) => {
      if (row.calculationType === 'partial') {
        return [
          {
            ...buildCommonBase(row),
            카테고리: '운송 배출량',
            항목: '부분산정',
            계산식: '하위 협력사/운송 데이터 미반영',
            배출량_kgCO2e: 0,
          },
        ];
      }

      return [
        {
          ...buildCommonBase(row),
          카테고리: '운송 배출량',
          항목: '1차 운송건 (트럭, 320km)',
          계산식: '320 km × 1.2 ton × 0.112 kgCO₂e/ton·km',
          배출량_kgCO2e: 43.01,
        },
        {
          ...buildCommonBase(row),
          카테고리: '운송 배출량',
          항목: '2차 운송건 (선박, 1200km)',
          계산식: '1200 km × 5.5 ton × 0.015 kgCO₂e/ton·km',
          배출량_kgCO2e: 99.0,
        },
        {
          ...buildCommonBase(row),
          카테고리: '운송 배출량',
          항목: '합계',
          계산식: '-',
          배출량_kgCO2e: 142.01,
        },
      ];
    }).flat();

    const supplierRows = selectedRows.map((row) => {
      if (row.calculationType === 'partial') {
        return [
          {
            ...buildCommonBase(row),
            카테고리: '하위 협력사 반영분',
            항목: '부분산정',
            계산식: '하위 협력사 데이터 미반영',
            배출량_kgCO2e: 0,
          },
        ];
      }

      return [
        {
          ...buildCommonBase(row),
          카테고리: '하위 협력사 반영분',
          항목: '한국배터리 (Tier 1)',
          계산식: '15,200.8 kgCO₂e × 1.0',
          배출량_kgCO2e: 15200.8,
        },
        {
          ...buildCommonBase(row),
          카테고리: '하위 협력사 반영분',
          항목: '파워셀 테크놀로지 (Tier 1)',
          계산식: '5,800.0 kgCO₂e × 1.0',
          배출량_kgCO2e: 5800.0,
        },
        {
          ...buildCommonBase(row),
          카테고리: '하위 협력사 반영분',
          항목: '합계',
          계산식: '-',
          배출량_kgCO2e: 21000.8,
        },
      ];
    }).flat();

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summarySheetRows), '요약');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(materialRows), '상세_자재');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(energyRows), '상세_에너지');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(transportRows), '상세_운송');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(supplierRows), '상세_하위협력사');

    const now = new Date();
    const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}`;
    XLSX.writeFile(workbook, `pcf-history-selected-${dateStamp}.xlsx`);

    toast.success(`선택한 ${selectedHistoryIds.size}건의 이력을 엑셀(XLSX)로 다운로드했습니다.`);
    setIsHistoryDownloadSelecting(false);
    setSelectedHistoryIds(new Set());
  };

  // Mock 협력사별 계산 결과 데이터
  interface CompanyResult {
    id: string;
    companyName: string;
    tier: number;
    ownEmission: number;
    supplierEmission: number;
    transportEmission: number;
    finalPcf: number;
    status: 'partial' | 'final' | 'missing';
    children?: CompanyResult[];
  }

  const activeResultHistory = useMemo(() => {
    if (!currentResult) return null;
    if (currentResult === 'partial' && selectedPartialHistory) {
      const picked = histories.find((h) => h.id === selectedPartialHistory);
      if (picked) return picked;
    }
    return histories.find((h) => h.calculationType === currentResult) ?? null;
  }, [currentResult, selectedPartialHistory, histories]);

  const mockCompanyResults: CompanyResult[] = useMemo(() => {
    if (!activeResultHistory || !currentResult) return [];
    if (currentResult === 'partial') {
      return [
        {
          id: 'prime',
          companyName: 'LG에너지솔루션 (원청사)',
          tier: 0,
          ownEmission: activeResultHistory.productPcf,
          supplierEmission: 0,
          transportEmission: 0,
          finalPcf: activeResultHistory.productPcf,
          status: 'partial',
        },
      ];
    } else if (currentResult === 'final') {
      return [
        {
          id: 'prime',
          companyName: 'LG에너지솔루션 (원청사)',
          tier: 0,
          ownEmission: activeResultHistory.productPcf,
          supplierEmission: 0,
          transportEmission: 0,
          finalPcf: activeResultHistory.productPcf,
          status: 'final',
        },
      ];
    }
    return [];
  }, [activeResultHistory, currentResult]);

  // 협력사별 기여도 계산 (최종산정 시)
  const supplierContributions = useMemo(() => {
    if (currentResult !== 'final' || mockCompanyResults.length === 0) return [];
    const primeData = mockCompanyResults[0];
    const totalPcf = primeData.finalPcf;

    const contributions: { companyName: string; contribution: number; percentage: number }[] = [];
    if (primeData.children) {
      primeData.children.forEach((tier1) => {
        contributions.push({
          companyName: tier1.companyName,
          contribution: tier1.finalPcf,
          percentage: (tier1.finalPcf / totalPcf) * 100,
        });
      });
    }
    return contributions.sort((a, b) => b.contribution - a.contribution);
  }, [currentResult, mockCompanyResults]);

  // Render 트리형 협력사 결과 테이블 (재귀)
  const renderCompanyRow = (company: CompanyResult, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedRows.has(company.id);
    const hasChildren = company.children && company.children.length > 0;
    const isPrime = company.tier === 0;

    return (
      <React.Fragment key={company.id}>
        <div
          className={`grid grid-cols-12 px-4 py-3 border-b border-gray-100 text-sm ${isPrime ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50 cursor-pointer'
            }`}
          style={{ paddingLeft: `${depth * 24 + 16}px` }}
        >
          <div className="col-span-4 flex items-center gap-2">
          {hasChildren && (
            <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRow(company.id);
                }}
                className="p-0.5 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
            </button>
          )}
            {!hasChildren && <div className="w-5"></div>}
            <span>{company.companyName}</span>
          </div>
          <div className="col-span-2 text-right">{company.ownEmission.toLocaleString()}</div>
          <div className="col-span-2 text-right">{company.supplierEmission.toLocaleString()}</div>
          <div className="col-span-2 text-right">{company.transportEmission.toLocaleString()}</div>
          <div className="col-span-1 text-right font-bold text-cyan-700">{company.finalPcf.toLocaleString()}</div>
          <div className="col-span-1 text-right flex items-center justify-end gap-2">
            {company.status === 'partial' && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">부분산정</span>
            )}
            {company.status === 'final' && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                최종완료
          </span>
            )}
            {company.status === 'missing' && (
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">미제출</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                openDetailDrawer(company.id);
              }}
              className="p-1 hover:bg-blue-100 rounded transition-colors"
              title="계산식 상세보기"
            >
              <Eye className="w-4 h-4 text-[#00B4FF]" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <>
            {company.children!.map((child) => renderCompanyRow(child, depth + 1))}
          </>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
      {/* 세부탭 */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('calculation')}
          className={`px-6 py-3 text-xl font-semibold transition-all ${activeTab === 'calculation'
              ? 'border-b-2 border-[#00B4FF] text-[#00B4FF]'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Calculator className="w-4 h-4 inline-block mr-2" />
          계산
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 text-xl font-semibold transition-all ${activeTab === 'history'
              ? 'border-b-2 border-[#00B4FF] text-[#00B4FF]'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <History className="w-4 h-4 inline-block mr-2" />
          히스토리
        </button>
      </div>

      {/* 계산 탭 */}
      {activeTab === 'calculation' && (
        <>
          {/* A. PCF 산정 대상 선택 */}
      <div
        className="bg-white p-8"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        <h2 className="text-xl font-semibold mb-6">PCF 산정 대상 선택</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
                <label className="block text-sm font-medium mb-2">
                  고객사 <span style={{ color: '#EF4444' }}>*</span>
                </label>
            <select
              value={selectedCustomer}
                  disabled={scaffoldLoading}
              onChange={(e) => {
                setSelectedCustomer(e.target.value);
                setSelectedBranch('');
                setSelectedProduct('');
                setSelectedDetailProduct('');
                setSelectedMonth(null);
              }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
                  <option value="">
                    {scaffoldLoading ? '목록 불러오는 중…' : '고객사를 선택하세요'}
                  </option>
              {customerOptions.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
              ))}
            </select>
          </div>

          <div>
                <label className="block text-sm font-medium mb-2">세부지사</label>
            <select
              value={selectedBranch}
                  disabled={!selectedCustomer || scaffoldLoading}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setSelectedProduct('');
                setSelectedDetailProduct('');
                setSelectedMonth(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
                  <option value="">세부지사를 선택하세요</option>
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
                  disabled={!selectedCustomer || scaffoldLoading}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                setSelectedDetailProduct('');
                setSelectedMonth(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
                  <option value="">제품을 선택하세요</option>
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
                  disabled={!selectedProduct || scaffoldLoading}
              onChange={(e) => {
                setSelectedDetailProduct(e.target.value);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
                  <option value="">세부제품을 선택하세요</option>
              {detailProductOptions.map((d) => (
                    <option key={d.variantId} value={String(d.variantId)}>
                      {formatVariantLabel(d.variantName, d.variantCode)}
                    </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">BOM Code</label>
            <div className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-gray-700">
                  {displayBomCode || '-'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
                  기간(월) <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <MonthPicker
              selectedMonth={selectedMonth}
                  onChange={(v) => {
                    if (v === null) monthUserClearedRef.current = true;
                    else monthUserClearedRef.current = false;
                    setSelectedMonth(v);
                  }}
                  placeholder="세부제품 선택 후 선택 가능"
              enabledMonths={projectPeriodMonths}
              disabled={!selectedDetailProduct}
            />
          </div>
        </div>

            {/* 선택 요약 */}
            {selectedCustomer && selectedMonth && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-gray-700">
                  <span className="text-[#00B4FF] font-bold">선택된 산정 대상:</span>{' '}
                  {selectionSummaryText}
                </div>
              </div>
            )}
      </div>

          {/* B. PCF 산정 준비 상태 */}
      <div
        className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 border border-blue-200"
        style={{
          borderRadius: '16px',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-[#00B4FF]" />
          <h3 className="font-bold">PCF 산정 준비 상태</h3>
        </div>

            {isTargetSelectionComplete && (
              <div className="mb-4 rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-700">
                <span className="font-semibold text-gray-800">이번 달 산정 단계</span>
                <span className="mx-2 text-gray-400">·</span>
                {monthRunState.final ? (
                  <span className="font-bold text-green-700">최종 산정 완료</span>
                ) : monthRunState.partial ? (
                  <span className="font-bold text-orange-700">부분 산정 완료 · 최종 미실행</span>
                ) : (
                  <span className="text-gray-600">산정 전</span>
                )}
              </div>
            )}

            {!isTargetSelectionComplete ? (
              <div className="bg-white/70 p-4 rounded-lg border border-blue-100 text-sm text-gray-600">
                산정 대상(고객사, 세부지사, 제품, 세부제품, BOM Code, 기간)을 모두 선택하면 준비 상태가 표시됩니다.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white/70 p-4 rounded-lg">
                    <div className="text-xs text-gray-600 mb-2">자사 데이터 준비 여부</div>
            <div className="flex items-center gap-2">
                      {pcfReadinessLoading ? (
                        <span className="font-bold text-gray-400">불러오는 중…</span>
                      ) : primaryDataComplete ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="font-bold text-green-600">준비 완료</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="font-bold text-red-600">미입력</span>
                </>
              )}
            </div>
                    {!pcfReadinessLoading && pcfReadiness && !primaryDataComplete && (
                      <p className="mt-2 text-xs text-gray-500">
                        데이터 관리 Tier0(자재·에너지·생산) 또는 공정활동 행이 있어야 합니다.
                      </p>
                    )}
          </div>

          <div className="bg-white/70 p-4 rounded-lg">
                    <div className="text-xs text-gray-600 mb-2">하위 협력사 데이터 제출 현황</div>
            <div className="flex items-center gap-2">
                      {pcfReadinessLoading ? (
                        <span className="font-bold text-gray-400">불러오는 중…</span>
                      ) : allSuppliersReady ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-bold text-green-600">
                            {supplierDataTotal === 0
                              ? '대상 없음'
                              : `${supplierDataComplete} / ${supplierDataTotal}`}
                  </span>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="font-bold text-yellow-600">
                    {supplierDataComplete} / {supplierDataTotal}
                  </span>
                </>
              )}
            </div>
                    {!pcfReadinessLoading && supplierDataTotal === 0 && (
                      <p className="mt-2 text-xs text-gray-500">
                        원청 승인이 완료된 하위 협력사 노드가 없으면 제출 현황은 0/0이며, 최종 산정도 바로 가능합니다.
                      </p>
                    )}
          </div>

          <div className="bg-white/70 p-4 rounded-lg">
                    <div className="text-xs text-gray-600 mb-2">부분산정 가능 여부</div>
                    <div className="flex items-center gap-2">
                      {canPartialCalculate ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="font-bold text-green-600">가능</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-5 h-5 text-gray-400" />
                          <span className="font-bold text-gray-400">불가</span>
                        </>
                      )}
            </div>
          </div>

          <div className="bg-white/70 p-4 rounded-lg">
                    <div className="text-xs text-gray-600 mb-2">최종산정 가능 여부</div>
                    <div className="flex items-center gap-2">
                      {canFinalCalculate ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="font-bold text-green-600">가능</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-5 h-5 text-yellow-600" />
                          <span className="font-bold text-yellow-600">대기</span>
                        </>
                      )}
            </div>
          </div>
        </div>

                <div className="bg-white/70 p-4 rounded-lg mb-4">
                  <div className="text-xs text-gray-600 mb-2">미입력 협력사 수</div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-700 text-lg">
                      {pcfReadinessLoading ? '—' : `${missingSuppliers}곳`}
                    </span>
            <button
                      onClick={handleRequestMissingSuppliers}
                      disabled={pcfReadinessLoading || missingSuppliers === 0 || isRequestingMissingSuppliers}
                      className="px-3 py-1.5 text-xs border border-[#00B4FF] text-[#00B4FF] rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRequestingMissingSuppliers ? '요청 발송 중...' : '미입력 협력사 요청'}
            </button>
                  </div>
                </div>

                {!pcfReadinessLoading &&
                  allSuppliersReady &&
                  supplierDataTotal > 0 &&
                  primaryDataComplete && (
                    <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                      하위 협력사 데이터 제출이 모두 완료되어 <strong>전체 준비</strong> 상태입니다. 최종 PCF 산정을
                      실행할 수 있습니다.
              </div>
                  )}
              </>
            )}
          </div>

          {/* C. 계산 실행 액션 영역 */}
          <div
            className="bg-white p-6"
            style={{
              borderRadius: '16px',
              boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <h3 className="font-bold mb-4">PCF 산정 실행</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border-2 border-orange-200 rounded-lg bg-orange-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-lg">부분산정</span>
                  <span className="px-2 py-0.5 bg-orange-200 text-orange-800 rounded text-xs">자사 데이터만</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  자사 데이터만 활용하여 내 공정 배출량을 산정합니다.
                  <br />
                  하위 협력사 데이터가 준비되기 전에도 중간 결과를 확인할 수 있습니다.
                </p>
          <button
                  onClick={handlePartialCalculate}
                  disabled={!canPartialCalculate || isPartialCalculating}
                  className={`w-full px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${canPartialCalculate && !isPartialCalculating
                      ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white hover:scale-105'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {isPartialCalculating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      부분산정 실행 중...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      부분산정 실행
                    </>
                  )}
          </button>
              </div>

              <div className="p-4 border-2 border-green-200 rounded-lg bg-green-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-lg">최종 PCF 산정</span>
                  <span className="px-2 py-0.5 bg-green-200 text-green-800 rounded text-xs">전체 데이터</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  하위 협력사 PCF 및 운송 정보까지 포함하여 최종 PCF를 산정합니다.
                  <br />
                  모든 협력사 데이터가 준비되어야 실행할 수 있습니다.
                </p>
            <button
                  onClick={handleFinalCalculate}
                  disabled={!canFinalCalculate}
                  className={`w-full px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${canFinalCalculate
                      ? 'bg-gradient-to-r from-green-500 to-green-700 text-white hover:scale-105'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  <Play className="w-5 h-5" />
                  최종 PCF 산정 실행
            </button>
              </div>
            </div>
          </div>

          {/* D. 부분산정 불러오기 영역 */}
          <div
            className="bg-white p-6"
            style={{
              borderRadius: '16px',
              boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <h3 className="font-bold mb-4">기존 부분산정 불러오기</h3>
            <p className="text-sm text-gray-600 mb-4">
              이전에 저장된 부분산정 기록을 불러와 최종산정을 이어서 진행할 수 있습니다.
            </p>

            <div className="flex gap-3">
              <select
                value={selectedPartialHistory}
                onChange={(e) => setSelectedPartialHistory(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
              >
                <option value="">부분산정 기록 선택</option>
                {(() => {
                  const partialHistories = histories.filter((h) => h.calculationType === 'partial');
                  if (partialHistories.length === 0) {
                    return (
                      <option value="" disabled>
                        부분산정 이력이 없습니다. 부분산정 실행 후 다시 확인해 주세요.
                      </option>
                    );
                  }
                  return partialHistories.map((h) => {
                    const parts = h.targetSummary.split(' / ');
                    const projectRaw = (parts[0] ?? '-').trim();
                    const projectLabel = /^\d+$/.test(projectRaw) ? `project ${projectRaw}` : projectRaw;
                    const detailLabel = parts[3] ?? '-';
                    const monthLabel = parts[parts.length - 1] ?? '-';
                    return (
                      <option key={h.id} value={h.id}>
                        {monthLabel}/{projectLabel}/{detailLabel} (제품 PCF:{' '}
                        {h.productPcf.toLocaleString()} kgCO₂e)
                      </option>
                    );
                  });
                })()}
              </select>
            <button
                onClick={handleLoadPartialHistory}
                disabled={!selectedPartialHistory}
                className="px-6 py-2.5 border border-[#00B4FF] text-[#00B4FF] rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                불러오기
            </button>
            <button
                onClick={() => {
                  if (!selectedPartialHistory) {
                    toast.error('부분산정 기록을 선택해주세요');
                    return;
                  }
                  toast.info('부분산정 기록을 바탕으로 최종산정을 시작합니다');
                }}
                disabled={!selectedPartialHistory || !canFinalCalculate}
                className="px-6 py-2.5 bg-gradient-to-r from-[#00B4FF] to-[#5B3BFA] text-white rounded-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이어서 최종산정
            </button>
        </div>
      </div>

          {/* 계산 결과 영역 */}
          {showResult && currentResult && mockCompanyResults.length > 0 && (
            <>
              {/* A. 총 PCF 결과 카드 */}
        <div
          className="bg-white p-6"
          style={{
            borderRadius: '16px',
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">총 PCF 결과</h3>
                  {currentResult === 'partial' && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                      부분산정 결과 (자사 데이터만)
              </span>
                  )}
                  {currentResult === 'final' && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      최종산정 완료
                    </span>
                  )}
            </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-cyan-50">
                    <div className="text-sm text-gray-600 mb-1">제품 기준 PCF</div>
                    <div className="text-3xl font-extrabold text-cyan-700">
                      {mockCompanyResults[0].finalPcf.toLocaleString()} kgCO₂e
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50">
                    <div className="text-sm text-gray-600 mb-1">kg 기준 PCF</div>
                    <div className="text-3xl font-extrabold text-emerald-700">
                      {(activeResultHistory?.kgPcf ?? 0).toFixed(4)} kgCO₂e/kg
                    </div>
                  </div>
                </div>
              </div>

              {/* B. PCF 구성 분석 카드 */}
              <div
                className="bg-white p-6"
                style={{
                  borderRadius: '16px',
                  boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
                }}
              >
                <h3 className="font-bold text-lg mb-4">PCF 구성 분석</h3>

                <div className="space-y-4 mb-6">
                  {/* 내 공정 배출 */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-medium">내 공정 배출 (Scope1, 2)</span>
                      <span className="text-gray-600">
                        {mockCompanyResults[0].ownEmission.toLocaleString()} kgCO₂e (
                        {((mockCompanyResults[0].ownEmission / mockCompanyResults[0].finalPcf) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full">
                      <div
                        className="h-4 rounded-full"
                        style={{
                          width: `${(mockCompanyResults[0].ownEmission / mockCompanyResults[0].finalPcf) * 100}%`,
                          background: '#5B3BFA',
                        }}
                      />
                    </div>
          </div>

                  {/* 협력사 기여 */}
                  {currentResult === 'final' && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium">협력사 기여 (Scope3 - 구매)</span>
                        <span className="text-gray-600">
                          {mockCompanyResults[0].supplierEmission.toLocaleString()} kgCO₂e (
                          {((mockCompanyResults[0].supplierEmission / mockCompanyResults[0].finalPcf) * 100).toFixed(1)}
                          %)
                        </span>
                      </div>
                      <div className="h-8 bg-gray-100 rounded-full relative overflow-hidden">
                        {supplierContributions.map((contrib, idx) => {
                          const left = supplierContributions
                            .slice(0, idx)
                            .reduce((sum, c) => sum + c.percentage, 0);
                          return (
                            <div
                              key={idx}
                              className="absolute h-8 group cursor-pointer transition-all hover:brightness-110"
                              style={{
                                left: `${left}%`,
                                width: `${contrib.percentage}%`,
                                background: `hsl(${200 + idx * 40}, 70%, 60%)`,
                              }}
                              title={`${contrib.companyName}: ${contrib.contribution.toLocaleString()} kgCO₂e (${contrib.percentage.toFixed(
                                1
                              )}%)`}
                            >
                              <div className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-10">
                                {contrib.companyName}
                                <br />
                                {contrib.contribution.toLocaleString()} kgCO₂e ({contrib.percentage.toFixed(1)}%)
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {supplierContributions.map((contrib, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-xs">
                            <div
                              className="w-3 h-3 rounded"
                              style={{ background: `hsl(${200 + idx * 40}, 70%, 60%)` }}
                            ></div>
                            <span className="text-gray-600">{contrib.companyName}</span>
                          </div>
                        ))}
                      </div>
            </div>
          )}
        </div>
              </div>

              {/* C. 협력사별 계산 결과 테이블 */}
              <div
                className="bg-white p-6 overflow-x-auto"
                style={{
                  borderRadius: '16px',
                  boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
                }}
              >
                <h3 className="font-bold text-lg mb-4">협력사별 계산 결과</h3>

                <div className="min-w-[900px]">
                  <div className="grid grid-cols-12 px-4 py-3 rounded-lg bg-gray-50 border-b-2 border-gray-300 text-sm font-semibold">
                    <div className="col-span-4">회사명</div>
                    <div className="col-span-2 text-right">자사배출량 (kgCO₂e)</div>
                    <div className="col-span-2 text-right">하위협력사배출량</div>
                    <div className="col-span-2 text-right">운송배출량</div>
                    <div className="col-span-1 text-right">최종PCF</div>
                    <div className="col-span-1 text-right">상태 / 액션</div>
                  </div>

                  {mockCompanyResults.map((company) => renderCompanyRow(company, 0))}
                </div>
              </div>
            </>
          )}

          {/* 빈 상태 */}
          {!showResult && (
            <div
              className="bg-white p-12 text-center"
              style={{
                borderRadius: '16px',
                boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              <Calculator className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg mb-2">산정 대상 선택 후 계산을 실행해 주세요</p>
              {canPartialCalculate && (
                <p className="text-sm text-gray-400">부분산정 가능한 상태입니다. 위 버튼을 눌러 산정을 시작하세요.</p>
              )}
              {canFinalCalculate && (
                <p className="text-sm text-gray-400">
                  하위 협력사 데이터가 모두 준비되었습니다. 최종산정을 실행하세요.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* 히스토리 탭 */}
      {activeTab === 'history' && (
        <div
          className="bg-white overflow-x-auto"
        style={{
          borderRadius: '16px',
          boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#00B4FF]" />
                <h2 className="text-lg font-bold">PCF 계산 이력</h2>
                <span className="text-xs text-gray-500 ml-2">※ 과거에 수행된 모든 산정 기록</span>
            </div>
              {!isHistoryDownloadSelecting ? (
              <button
                  onClick={startHistoryDownloadSelection}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                  다운로드
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelHistoryDownloadSelection}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={completeHistoryDownloadSelection}
                    className="px-3 py-2 text-sm text-white rounded-lg bg-gradient-to-r from-[#00B4FF] to-[#5B3BFA] hover:opacity-90"
                  >
                    선택 완료 ({selectedHistoryIds.size})
              </button>
            </div>
              )}
          </div>
        </div>

          <div className="min-w-[1000px]">
          <table className="w-full">
            <thead className="bg-[#F0F9FF] border-b border-blue-200">
              <tr>
                  {isHistoryDownloadSelecting && (
                    <th className="px-4 py-3 text-center text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={selectedHistoryIds.size === histories.length && histories.length > 0}
                        onChange={toggleSelectAllHistories}
                        aria-label="전체 선택"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold">산정일시</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">산정유형</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">산정대상 요약</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">상태</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold">제품 PCF</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold">kg 기준 PCF</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">실행자</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">관리</th>
              </tr>
            </thead>
            <tbody>
                {histories.map((hist, idx) => (
                  <tr
                    key={hist.id}
                    className={`border-b border-gray-100 hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                  >
                    {isHistoryDownloadSelecting && (
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedHistoryIds.has(hist.id)}
                          onChange={() => toggleHistorySelection(hist.id)}
                          aria-label={`${hist.id} 선택`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm">{hist.calculationDate}</td>
                  <td className="px-4 py-3 text-sm">
                      {hist.calculationType === 'partial' && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">부분산정</span>
                      )}
                      {hist.calculationType === 'final' && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">최종산정</span>
                      )}
                  </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{hist.targetSummary}</td>
                  <td className="px-4 py-3 text-sm">
                      {hist.status === 'partial_saved' && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">부분산정 저장</span>
                      )}
                      {hist.status === 'final_completed' && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs flex items-center gap-1 w-fit">
                          <CheckCircle className="w-3 h-3" />
                          최종산정 완료
                    </span>
                      )}
                      {hist.status === 'recalculated' && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">재산정 완료</span>
                      )}
                  </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">
                      {hist.productPcf.toLocaleString()} kgCO₂e
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">{hist.kgPcf.toFixed(4)}</td>
                    <td className="px-4 py-3 text-sm">{hist.executor}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                          onClick={() => openHistoryDetail(hist.id)}
                          className="px-2 py-1 text-xs text-[#00B4FF] border border-[#00B4FF] rounded hover:bg-blue-50 flex items-center gap-1"
                      >
                          <Eye className="w-3 h-3" />
                        상세보기
                      </button>
                        {hist.calculationType === 'partial' && (
                        <button
                            onClick={() => {
                              setSelectedPartialHistory(hist.id);
                              setActiveTab('calculation');
                              toast.info('계산 탭으로 이동했습니다. 부분산정 기록을 불러와 최종산정하세요.');
                            }}
                          className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                        >
                            불러오기
                        </button>
                      )}
                        <button
                          onClick={() => {
                            toast.error('정말 삭제하시겠습니까?');
                          }}
                          className="px-2 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50"
                        >
                          삭제
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

          {histories.length === 0 && (
            <div className="p-12 text-center">
              <History className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg">산정 대상 선택 후 계산을 실행해 주세요.</p>
      </div>
          )}
        </div>
      )}

      {/* 계산식 상세 드로어 */}
      {detailDrawer.open && detailDrawer.companyId && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex justify-end"
          onClick={closeDetailDrawer}
        >
          <div
            className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
              <div>
                <h3 className="font-bold text-lg">계산식 상세</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {mockCompanyResults.length > 0 &&
                    (() => {
                      const findCompany = (companies: CompanyResult[]): CompanyResult | null => {
                        for (const c of companies) {
                          if (c.id === detailDrawer.companyId) return c;
                          if (c.children) {
                            const found = findCompany(c.children);
                            if (found) return found;
                          }
                        }
                        return null;
                      };
                      const company = findCompany(mockCompanyResults);
                      return company ? company.companyName : '';
                    })()
                  }
                </p>
              </div>
              <button
                onClick={closeDetailDrawer}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* 자재 배출량 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('material')}
                  className="w-full bg-gray-50 px-4 py-3 font-semibold border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <span>자재 배출량</span>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-700 text-sm">1,144.55 kgCO₂e</span>
                    {expandedSections.has('material') ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </button>
                {expandedSections.has('material') && (
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>양극재</span>
                      <span className="font-mono text-gray-600">15.5 kg × 42.3 kgCO₂e/kg = 655.65 kgCO₂e</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>음극재</span>
                      <span className="font-mono text-gray-600">12.0 kg × 28.1 kgCO₂e/kg = 337.20 kgCO₂e</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>전해액</span>
                      <span className="font-mono text-gray-600">8.2 L × 18.5 kgCO₂e/L = 151.70 kgCO₂e</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold text-cyan-700">
                      <span>합계</span>
                      <span>1,144.55 kgCO₂e</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 에너지 배출량 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('energy')}
                  className="w-full bg-gray-50 px-4 py-3 font-semibold border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <span>에너지 배출량</span>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-700 text-sm">1,560.83 kgCO₂e</span>
                    {expandedSections.has('energy') ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </button>
                {expandedSections.has('energy') && (
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>전력</span>
                      <span className="font-mono text-gray-600">1,250 kWh × 0.4653 kgCO₂e/kWh = 581.63 kgCO₂e</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>LNG</span>
                      <span className="font-mono text-gray-600">450 m³ × 2.176 kgCO₂e/m³ = 979.20 kgCO₂e</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold text-cyan-700">
                      <span>합계</span>
                      <span>1,560.83 kgCO₂e</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 운송 배출량 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('transport')}
                  className="w-full bg-gray-50 px-4 py-3 font-semibold border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <span>운송 배출량</span>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-700 text-sm">142.01 kgCO₂e</span>
                    {expandedSections.has('transport') ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </button>
                {expandedSections.has('transport') && (
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>1차 운송건 (트럭, 320km)</span>
                      <span className="font-mono text-gray-600">320 km × 1.2 ton × 0.112 kgCO₂e/ton·km = 43.01 kgCO₂e</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>2차 운송건 (선박, 1200km)</span>
                      <span className="font-mono text-gray-600">1200 km × 5.5 ton × 0.015 kgCO₂e/ton·km = 99.00 kgCO₂e</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold text-cyan-700">
                      <span>합계</span>
                      <span>142.01 kgCO₂e</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 하위 협력사 반영분 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('supplier')}
                  className="w-full bg-gray-50 px-4 py-3 font-semibold border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <span>하위 협력사 반영분</span>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-700 text-sm">21,000.8 kgCO₂e</span>
                    {expandedSections.has('supplier') ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </button>
                {expandedSections.has('supplier') && (
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>한국배터리 (Tier 1)</span>
                      <span className="font-mono text-gray-600">15,200.8 kgCO₂e × 1.0 = 15,200.8 kgCO₂e</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>파워셀 테크놀로지 (Tier 1)</span>
                      <span className="font-mono text-gray-600">5,800.0 kgCO₂e × 1.0 = 5,800.0 kgCO₂e</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold text-cyan-700">
                      <span>합계</span>
                      <span>21,000.8 kgCO₂e</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 히스토리 상세보기 모달 */}
      {historyDetailModal.open && historyDetailModal.historyId && (() => {
        const history = histories.find(h => h.id === historyDetailModal.historyId);
        if (!history) return null;

        const isPartial = history.calculationType === 'partial';
        const ownEmission = isPartial ? history.productPcf : 8105.0;
        const supplierEmission = isPartial ? 0 : 22315.3;
        const transportEmission = isPartial ? 0 : 2000.0;

        return (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={closeHistoryDetail}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 헤더 */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10 rounded-t-2xl">
                <div>
                  <h3 className="font-bold text-xl flex items-center gap-2">
                    PCF 결과
                    {isPartial ? (
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                        부분산정 결과 (자사데이터만)
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        최종산정 완료
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{history.targetSummary}</p>
                  <p className="text-xs text-gray-400 mt-1">산정일시: {history.calculationDate} | 실행자: {history.executor}</p>
                </div>
                <button
                  onClick={closeHistoryDetail}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* 총 PCF 결과 */}
                <div>
                  <h4 className="font-bold text-lg mb-4">총 PCF 결과</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-xl bg-cyan-50 border border-cyan-200">
                      <div className="text-sm text-gray-600 mb-2">제품 기준 PCF</div>
                      <div className="text-3xl font-extrabold text-cyan-700">
                        {history.productPcf.toLocaleString()} kgCO₂e
                      </div>
                    </div>
                    <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-sm text-gray-600 mb-2">kg 기준 PCF</div>
                      <div className="text-3xl font-extrabold text-emerald-700">
                        {history.kgPcf.toFixed(4)} kgCO₂e/kg
                      </div>
                    </div>
                  </div>
                </div>

                {/* PCF 구성 분석 */}
                <div>
                  <h4 className="font-bold text-lg mb-4">PCF 구성 분석</h4>

                  {/* 내 공정 배출 */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-medium">내 공정 배출 (Scope1, 2)</span>
                      <span className="text-gray-600">
                        {ownEmission.toLocaleString()} kgCO₂e ({((ownEmission / history.productPcf) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-5 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                        style={{
                          width: `${(ownEmission / history.productPcf) * 100}%`,
                          background: '#5B3BFA',
                          minWidth: '60px',
                        }}
                      >
                        {((ownEmission / history.productPcf) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* 협력사 기여 - 최종산정만 */}
                  {!isPartial && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium">협력사 기여 (Scope3 - 구매)</span>
                        <span className="text-gray-600">
                          {supplierEmission.toLocaleString()} kgCO₂e ({((supplierEmission / history.productPcf) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-5 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                          style={{
                            width: `${(supplierEmission / history.productPcf) * 100}%`,
                            background: 'linear-gradient(90deg, #00B4FF 0%, #06B6D4 100%)',
                            minWidth: '60px',
                          }}
                        >
                          {((supplierEmission / history.productPcf) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 운송 배출 - 최종산정만 */}
                  {!isPartial && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium">운송 배출 (Scope3 - 운송)</span>
                        <span className="text-gray-600">
                          {transportEmission.toLocaleString()} kgCO₂e ({((transportEmission / history.productPcf) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-5 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                          style={{
                            width: `${(transportEmission / history.productPcf) * 100}%`,
                            background: '#22C55E',
                            minWidth: '60px',
                          }}
                        >
                          {((transportEmission / history.productPcf) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 협력사별 계산 결과 - 최종산정만 */}
                {!isPartial && (
                  <div>
                    <h4 className="font-bold text-lg mb-4">협력사별 계산 결과</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold">회사명</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold">자사배출량</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold">하위협력사배출량</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold">운송배출량</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold">최종PCF</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold">상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-100 bg-blue-50 font-semibold">
                            <td className="px-4 py-3 text-sm">LG에너지솔루션 (원청사)</td>
                            <td className="px-4 py-3 text-sm text-right">{ownEmission.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-right">{supplierEmission.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-right">{transportEmission.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-cyan-700">{history.productPcf.toLocaleString()}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs inline-flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                최종완료
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm pl-8">한국배터리</td>
                            <td className="px-4 py-3 text-sm text-right">4,200</td>
                            <td className="px-4 py-3 text-sm text-right">10,801</td>
                            <td className="px-4 py-3 text-sm text-right">200</td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-cyan-700">15,201</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs inline-flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                최종완료
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm pl-8">파워셀 테크놀로지</td>
                            <td className="px-4 py-3 text-sm text-right">3,600</td>
                            <td className="px-4 py-3 text-sm text-right">2,000</td>
                            <td className="px-4 py-3 text-sm text-right">200</td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-cyan-700">5,800</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs inline-flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                최종완료
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}