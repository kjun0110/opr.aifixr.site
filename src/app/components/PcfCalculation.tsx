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
  getOprMonthlyOverview,
  getOprPcfReadiness,
  postOprDataRequest,
  type OprMonthlyTierRow,
  type OprPcfReadinessResponse,
} from '@/lib/api/dataMgmtOpr';
import { getOprDataViewContacts } from '@/lib/api/iamOpr';
import {
  getOprPcfReadinessForNotify,
  getOprPcfRuns,
  postOprPcfRunExecute,
  type PcfReadinessOprResponse,
} from '@/lib/api/pcf';

/** 월별 overview의 PCF 문자열(쉼표 포함) → kg CO₂e */
function parsePcfKgCo2e(raw: string | null | undefined): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function formatKgCell(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function oprSupplierRowStableKey(r: OprMonthlyTierRow): string {
  if (r.detail_key != null && String(r.detail_key).trim() !== '') return String(r.detail_key);
  return `sup-${r.company_name}-${r.tier}`;
}

/** 월별 overview `detail_key` 예: `node:123:2025:1` */
function parseNodeIdFromDetailKey(detailKey: string | null | undefined): number | null {
  if (detailKey == null || String(detailKey).trim() === '') return null;
  const m = /^node:(\d+):/.exec(String(detailKey));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

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

/**
 * 전체 스캐폴드(지사→프로젝트→제품→세부제품).
 * `customersPreloaded`가 있으면 고객 목록 API를 다시 부르지 않음(첫 화면에서 고객사만 먼저 받은 뒤 호출).
 */
async function loadPcfScaffoldRows(
  customersPreloaded?: { id: number; name: string }[],
): Promise<ScaffoldVariantRow[]> {
  if (pcfScaffoldCache) return pcfScaffoldCache;
  if (pcfScaffoldInFlight) return pcfScaffoldInFlight;

  pcfScaffoldInFlight = (async () => {
    if (typeof window !== 'undefined' && !getOprAccessToken()) {
      await restoreOprSessionFromCookie();
    }
    const customers =
      customersPreloaded ??
      (await apiFetch<{ id: number; name: string }[]>(
        '/api/supply-chain/project-supply-chain/customers',
      ));
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

/** 세부제품까지 펼치지 않고, PCF 이력 조회용으로 지사별 프로젝트 PK만 수집 */
async function collectOprProjectIdsForHistory(): Promise<number[]> {
  if (typeof window !== 'undefined' && !getOprAccessToken()) {
    await restoreOprSessionFromCookie();
  }
  const customers = await apiFetch<{ id: number; name: string }[]>(
    '/api/supply-chain/project-supply-chain/customers',
  );
  const ids = new Set<number>();
  for (const customer of customers) {
    let branches: { id: number }[] = [];
    try {
      branches = await apiFetch<{ id: number }[]>(
        `/api/supply-chain/project-supply-chain/customers/${customer.id}/branches`,
      );
    } catch {
      continue;
    }
    for (const branch of branches) {
      try {
        const project = await apiFetch<{ id: number }>(
          `/api/supply-chain/project-supply-chain/branches/${branch.id}/project`,
        );
        if (Number.isFinite(project.id) && project.id >= 1) ids.add(project.id);
      } catch {
        /* skip */
      }
    }
  }
  return [...ids];
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
  /** YYYY-MM — 산정 대상 월 */
  targetMonthYm: string;
  targetSummary: string;
  status: 'partial_saved' | 'final_completed' | 'recalculated';
  /** API total_co2e_kg — 총 배출량(kg CO₂e) */
  totalCo2eKg: number | null;
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
  /** 고객사 목록만 먼저 받은 뒤(빠름) 드롭다운에 반영 */
  const [quickCustomers, setQuickCustomers] = useState<{ id: number; name: string }[] | null>(null);
  /** 고객사 GET 완료 전 — 고객사 셀렉트만 대기 */
  const [customersLoading, setCustomersLoading] = useState(true);
  /** 지사·제품·세부제품 행 전체 펼침 완료 전 */
  const [fullScaffoldLoading, setFullScaffoldLoading] = useState(true);
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
      setCustomersLoading(true);
      setFullScaffoldLoading(true);
      try {
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const customers = await apiFetch<{ id: number; name: string }[]>(
          '/api/supply-chain/project-supply-chain/customers',
        );
        if (!mounted) return;
        setQuickCustomers(customers);
        setCustomersLoading(false);

        const rows = await loadPcfScaffoldRows(customers);
        if (!mounted) return;
        setScaffoldVariants(rows);
      } catch (e) {
        console.error('PcfCalculation scaffold load failed', e);
        if (mounted) {
          toast.error('고객사·제품 목록을 불러오지 못했습니다. 공급망 API를 확인해 주세요.');
        }
      } finally {
        if (mounted) {
          setCustomersLoading(false);
          setFullScaffoldLoading(false);
        }
      }
    };

    void loadScaffold();
    return () => {
      mounted = false;
    };
  }, []);

  const customerOptions = useMemo(() => {
    if (quickCustomers != null) {
      return [...quickCustomers]
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
        .map((c) => ({
          id: c.id,
          name: (c.name || '').trim() || `고객 #${c.id}`,
        }));
    }
    const byId = new Map<number, string>();
    for (const r of scaffoldVariants) {
      if (!byId.has(r.customerId)) byId.set(r.customerId, r.customerName);
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'ko'))
      .map(([id, name]) => ({ id, name }));
  }, [quickCustomers, scaffoldVariants]);

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

  /** 데이터 관리 월별 overview — 협력사별 행(고객사 Tier0 제외에 사용) */
  const [monthlyOverviewRows, setMonthlyOverviewRows] = useState<OprMonthlyTierRow[] | null>(null);
  const [monthlyOverviewLoading, setMonthlyOverviewLoading] = useState(false);

  useEffect(() => {
    if (!isTargetSelectionComplete || !selectedBranch || !selectedDetailProduct || !selectedMonth) {
      setMonthlyOverviewRows(null);
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
      setMonthlyOverviewLoading(true);
      try {
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const ov = await getOprMonthlyOverview(vid, ry, rm, branchId);
        if (!cancelled) setMonthlyOverviewRows(ov.rows);
      } catch {
        if (!cancelled) setMonthlyOverviewRows(null);
      } finally {
        if (!cancelled) setMonthlyOverviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTargetSelectionComplete, selectedBranch, selectedDetailProduct, selectedMonth]);

  const supplierOnlyRows = useMemo(() => {
    if (!monthlyOverviewRows) return [];
    return monthlyOverviewRows.filter((r) => r.tier > 0);
  }, [monthlyOverviewRows]);

  /** PCF `/readiness/opr` — 협력사 노드별 원청 전송(준비) 여부(1차 등록 노드 중심) */
  const [pcfReadinessOpr, setPcfReadinessOpr] = useState<PcfReadinessOprResponse | null>(null);

  useEffect(() => {
    if (
      !isTargetSelectionComplete ||
      !selectedMonth ||
      selectedDetailMeta?.projectId == null ||
      !selectedProduct ||
      !selectedDetailProduct
    ) {
      setPcfReadinessOpr(null);
      return;
    }
    const projectId = Number(selectedDetailMeta.projectId);
    const pid = Number(selectedProduct);
    const vid = Number(selectedDetailProduct);
    const [yRaw, mRaw] = selectedMonth.split('-');
    const ry = Number(yRaw);
    const rm = Number(mRaw);
    if (
      !Number.isFinite(projectId) ||
      !Number.isFinite(pid) ||
      !Number.isFinite(vid) ||
      !Number.isFinite(ry) ||
      !Number.isFinite(rm)
    ) {
      setPcfReadinessOpr(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const rd = await getOprPcfReadinessForNotify({
          project_id: projectId,
          product_id: pid,
          product_variant_id: vid,
          reporting_year: ry,
          reporting_month: rm,
        });
        if (!cancelled) setPcfReadinessOpr(rd);
      } catch {
        if (!cancelled) setPcfReadinessOpr(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isTargetSelectionComplete,
    selectedMonth,
    selectedDetailMeta?.projectId,
    selectedProduct,
    selectedDetailProduct,
  ]);

  const oprTransferReadyByNodeId = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const s of pcfReadinessOpr?.suppliers ?? []) {
      m.set(s.supply_chain_node_id, s.ready);
    }
    return m;
  }, [pcfReadinessOpr]);

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

  /** 원청 PCF 화면·이력 모달의 운영사(원청) 표시명 — 데모 고정값(LG…) 대신 실제 선택 고객사 또는 로그인 주체 */
  const primeOperatorDisplayName = useMemo(() => {
    const cn = customerOptions.find((c) => String(c.id) === selectedCustomer)?.name?.trim();
    if (cn) return `${cn} (원청)`;
    const fb = executorFallbackName.trim();
    if (fb) return `${fb} (원청)`;
    return '원청';
  }, [customerOptions, selectedCustomer, executorFallbackName]);

  const [histories, setHistories] = useState<CalculationHistory[]>([]);
  const [historyListLoading, setHistoryListLoading] = useState(false);
  /** 같은 세션에서 OPR 산정 실행 직후 구성(자사/1차) — 이력과 키가 맞을 때만 사용 */
  const [lastOprComposition, setLastOprComposition] = useState<{
    key: string;
    ownKg: number;
    tier1Kg: number;
  } | null>(null);
  const [isPartialCalculating, setIsPartialCalculating] = useState(false);
  const [isFinalCalculating, setIsFinalCalculating] = useState(false);
  const [isRequestingMissingSuppliers, setIsRequestingMissingSuppliers] = useState(false);

  const loadHistoriesFromServer = useCallback(async () => {
    setHistoryListLoading(true);
    try {
    let projectIds = Array.from(new Set(scaffoldVariants.map((v) => v.projectId))).filter((v) =>
      Number.isFinite(v),
    );
    if (projectIds.length === 0) {
      projectIds = await collectOprProjectIdsForHistory();
    }
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
    const runs = runChunks.flat().sort((a, b) => b.id - a.id);
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
      // 원청 OPR: calculation_mode final → batch, partial → node_rollup
      const calculationType: CalculationHistory['calculationType'] =
        runKind === 'batch' ? 'final' : 'partial';
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
        targetMonthYm: monthYm,
        targetSummary: `project ${r.project_id} / - / ${r.product_name || '-'} / ${variantName} / ${r.bom_label || '-'} / ${monthYm}`,
        status,
        totalCo2eKg: totalCo2e,
        productPcf,
        kgPcf,
        executor: r.executed_by_name?.trim() || (r.triggered_by_user_id ? `사용자#${r.triggered_by_user_id}` : executorFallbackName),
      };
    });
    setHistories(mappedAll);
    } catch {
      setHistories([]);
    } finally {
      setHistoryListLoading(false);
    }
  }, [scaffoldVariants, executorFallbackName]);

  useEffect(() => {
    void loadHistoriesFromServer().catch(() => {
      setHistories([]);
    });
  }, [loadHistoriesFromServer]);

  /** 히스토리 탭 진입 시 최신 목록(계산 탭에서 실행 후 이동한 경우 등) */
  useEffect(() => {
    if (activeTab !== 'history') return;
    void loadHistoriesFromServer();
    // loadHistoriesFromServer 변경 시에는 상단 effect에서 이미 호출됨 — 중복 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
      {
        const own =
          runResult.opr_own_total_co2e_kg ??
          runResult.total_co2e_kg ??
          0;
        const tier1 = runResult.opr_tier1_upstream_total_co2e_kg ?? 0;
        setLastOprComposition({
          key: `${projectId}:${vid}:${selectedMonth}:partial`,
          ownKg: own,
          tier1Kg: tier1,
        });
      }
      await refreshMonthRunState();
      setCurrentResult('partial');
      setShowResult(true);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      await loadHistoriesFromServer();
      toast.success(
        '부분 산정만 저장되었습니다. 최종 PCF는 자동 실행되지 않으며, 오른쪽 초록색「최종 PCF 산정 실행」을 눌러야 합니다.',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '부분산정 실행에 실패했습니다.');
    } finally {
      setIsPartialCalculating(false);
    }
  };

  // 최종산정 실행
  const handleFinalCalculate = async () => {
    if (isFinalCalculating) return;
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
    setIsFinalCalculating(true);
    try {
      const runResult = await postOprPcfRunExecute({
        project_id: projectId,
        product_id: pid,
        product_variant_id: vid,
        reporting_year: ry,
        reporting_month: rm,
        calculation_mode: 'final',
      });
      {
        const tier1 = runResult.opr_tier1_upstream_total_co2e_kg ?? 0;
        const own =
          runResult.opr_own_total_co2e_kg ??
          (runResult.total_co2e_kg != null ? Math.max(0, runResult.total_co2e_kg - tier1) : 0);
        setLastOprComposition({
          key: `${projectId}:${vid}:${selectedMonth}:final`,
          ownKg: own,
          tier1Kg: tier1,
        });
      }
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
    } finally {
      setIsFinalCalculating(false);
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
      산정대상_월: row.targetMonthYm,
      산정대상: row.targetSummary,
      상태: statusLabel(row.status),
      실행자: row.executor,
    });

    // 1) 요약 시트
    const summarySheetRows = selectedRows.map((row) => ({
      ...buildCommonBase(row),
      총배출량_kgCO2e:
        row.totalCo2eKg != null ? Number(row.totalCo2eKg.toFixed(6)) : '',
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

  const activeResultHistory = useMemo(() => {
    if (!currentResult) return null;
    if (currentResult === 'partial' && selectedPartialHistory) {
      const picked = histories.find((h) => h.id === selectedPartialHistory);
      if (picked) return picked;
    }
    return histories.find((h) => h.calculationType === currentResult) ?? null;
  }, [currentResult, selectedPartialHistory, histories]);

  const oprCompositionKeyFull = useMemo(() => {
    const projectId = selectedDetailMeta?.projectId;
    const vid = selectedDetailProduct;
    const month = selectedMonth;
    if (projectId == null || !vid || !month || !currentResult) return null;
    return `${projectId}:${vid}:${month}:${currentResult}`;
  }, [selectedDetailMeta?.projectId, selectedDetailProduct, selectedMonth, currentResult]);

  /** 총 PCF 카드·PCF 구성용 — 총배출(kg)·자사(부분과 동일)·1차 협력사 합 */
  const operatorPcfSummary = useMemo(() => {
    if (!activeResultHistory || !currentResult) return null;
    const totalKg =
      activeResultHistory.totalCo2eKg != null && Number.isFinite(activeResultHistory.totalCo2eKg)
        ? activeResultHistory.totalCo2eKg
        : activeResultHistory.productPcf;

    let ownKg: number;
    let tier1Kg: number;

    if (oprCompositionKeyFull && lastOprComposition?.key === oprCompositionKeyFull) {
      ownKg = lastOprComposition.ownKg;
      tier1Kg = lastOprComposition.tier1Kg;
    } else if (currentResult === 'partial') {
      ownKg = totalKg;
      tier1Kg = 0;
    } else {
      const partialRow = histories.find(
        (h) => h.calculationType === 'partial' && h.targetSummary === activeResultHistory.targetSummary,
      );
      const pTotal = partialRow?.totalCo2eKg ?? partialRow?.productPcf;
      if (
        partialRow != null &&
        typeof pTotal === 'number' &&
        Number.isFinite(pTotal) &&
        activeResultHistory.totalCo2eKg != null &&
        Number.isFinite(activeResultHistory.totalCo2eKg)
      ) {
        ownKg = pTotal;
        tier1Kg = Math.max(0, activeResultHistory.totalCo2eKg - pTotal);
      } else {
        ownKg = totalKg;
        tier1Kg = 0;
      }
    }

    return {
      finalPcf: totalKg,
      ownEmission: ownKg,
      supplierEmission: tier1Kg,
    };
  }, [activeResultHistory, currentResult, histories, oprCompositionKeyFull, lastOprComposition]);

  const supplierContributions = useMemo(() => {
    if (currentResult !== 'final' || !operatorPcfSummary || operatorPcfSummary.finalPcf <= 0) return [];
    const totalPcf = operatorPcfSummary.finalPcf;
    const tier1 = operatorPcfSummary.supplierEmission;
    if (tier1 <= 0) return [];

    const raw: { companyName: string; v: number }[] = [];
    for (const r of supplierOnlyRows) {
      const v =
        r.own_total_co2e_kg != null && Number.isFinite(r.own_total_co2e_kg)
          ? r.own_total_co2e_kg
          : parsePcfKgCo2e(r.pcf_result_kg_co2e);
      if (v != null && v > 0) raw.push({ companyName: r.company_name, v });
    }
    const sumV = raw.reduce((s, x) => s + x.v, 0);

    if (sumV > 0) {
      const out: { companyName: string; contribution: number; percentage: number }[] = raw.map((x) => {
        const contribution = (tier1 * x.v) / sumV;
        return {
          companyName: x.companyName,
          contribution,
          percentage: (contribution / totalPcf) * 100,
        };
      });
      return out.sort((a, b) => b.contribution - a.contribution);
    }

    // 월별 개요에 협력사별 kg가 없어도 1차 합(tier1)만큼 막대는 표시
    return [
      {
        companyName: '협력사 기여 (합계)',
        contribution: tier1,
        percentage: (tier1 / totalPcf) * 100,
      },
    ];
  }, [currentResult, operatorPcfSummary, supplierOnlyRows]);

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
                  disabled={customersLoading}
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
                    {customersLoading ? '목록 불러오는 중…' : '고객사를 선택하세요'}
                  </option>
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
                  disabled={!selectedCustomer || fullScaffoldLoading}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setSelectedProduct('');
                setSelectedDetailProduct('');
                setSelectedMonth(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
                  <option value="">
                    {fullScaffoldLoading ? '목록 불러오는 중…' : '지사를 선택하세요'}
                  </option>
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
                  disabled={!selectedCustomer || fullScaffoldLoading}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                setSelectedDetailProduct('');
                setSelectedMonth(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
                  <option value="">
                    {fullScaffoldLoading ? '목록 불러오는 중…' : '제품을 선택하세요'}
                  </option>
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
                  disabled={!selectedProduct || fullScaffoldLoading}
              onChange={(e) => {
                setSelectedDetailProduct(e.target.value);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
                  <option value="">
                    {fullScaffoldLoading ? '목록 불러오는 중…' : '세부제품을 선택하세요'}
                  </option>
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
                {monthRunState.final && monthRunState.partial ? (
                  <span className="font-bold text-green-700">부분·최종 산정 모두 완료</span>
                ) : monthRunState.final ? (
                  <span className="font-bold text-green-700">최종 산정 완료</span>
                ) : monthRunState.partial ? (
                  <span className="font-bold text-orange-700">부분 산정만 완료 · 최종 미실행</span>
                ) : (
                  <span className="text-gray-600">산정 전</span>
                )}
              </div>
            )}

            {!isTargetSelectionComplete ? (
              <div className="bg-white/70 p-4 rounded-lg border border-blue-100 text-sm text-gray-600">
                산정 대상(고객사, 지사, 제품, 세부제품, BOM Code, 기간)을 모두 선택하면 준비 상태가 표시됩니다.
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
                      하위 협력사 데이터 제출이 모두 완료되어 <strong>전체 준비</strong> 상태입니다.{' '}
                      <strong>최종 PCF</strong>는 아래 초록 버튼을 눌렀을 때만 실행되며, 주황색 부분 산정과는 별개입니다.
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
            <p className="text-xs text-gray-500 mb-3">
              부분(주황)과 최종(초록)은 각각 다른 API로 실행됩니다. 하나를 실행한다고 다른 하나가 자동으로 돌아가지 않습니다.
            </p>

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
                  disabled={!canPartialCalculate || isPartialCalculating || isFinalCalculating}
                  className={`w-full px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${canPartialCalculate && !isPartialCalculating && !isFinalCalculating
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
                  onClick={() => void handleFinalCalculate()}
                  disabled={!canFinalCalculate || isFinalCalculating || isPartialCalculating}
                  className={`w-full px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${canFinalCalculate && !isFinalCalculating && !isPartialCalculating
                      ? 'bg-gradient-to-r from-green-500 to-green-700 text-white hover:scale-105'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {isFinalCalculating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      최종 PCF 산정 실행 중…
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      최종 PCF 산정 실행
                    </>
                  )}
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
                  void handleFinalCalculate();
                }}
                disabled={!selectedPartialHistory || !canFinalCalculate || isFinalCalculating || isPartialCalculating}
                className="px-6 py-2.5 bg-gradient-to-r from-[#00B4FF] to-[#5B3BFA] text-white rounded-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 min-w-[10rem]"
              >
                {isFinalCalculating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    최종 산정 중…
                  </>
                ) : (
                  '이어서 최종산정'
                )}
            </button>
        </div>
      </div>

          {/* 계산 결과 영역 */}
          {showResult && currentResult && operatorPcfSummary && (
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

                {currentResult === 'partial' && monthRunState.final && (
                  <div className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    이 달에는 <strong>최종 산정</strong> 실행 이력도 있습니다. 아래 수치는{' '}
                    <strong>부분 산정</strong> 결과이며, 최종 결과를 보려면 히스토리에서 최종 항목을 보거나 초록 버튼으로
                    다시 실행하세요.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-cyan-50">
                    <div className="text-sm text-gray-600 mb-1">제품 기준 PCF</div>
                    <div className="text-3xl font-extrabold text-cyan-700">
                      {operatorPcfSummary.finalPcf.toLocaleString()} kgCO₂e
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

              {/* B. PCF 구성 카드 */}
              <div
                className="bg-white p-6"
                style={{
                  borderRadius: '16px',
                  boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
                }}
              >
                <h3 className="font-bold text-lg mb-4">PCF 구성</h3>

                <div className="space-y-4 mb-6">
                  {/* 내 공정 배출 */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-medium">내 공정 배출 (Scope1, 2)</span>
                      <span className="text-gray-600">
                        {operatorPcfSummary.ownEmission.toLocaleString()} kgCO₂e (
                        {((operatorPcfSummary.finalPcf > 0
                          ? (operatorPcfSummary.ownEmission / operatorPcfSummary.finalPcf) * 100
                          : 0
                        )).toFixed(1)}
                        %)
                      </span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full">
                      <div
                        className="h-4 rounded-full"
                        style={{
                          width: `${operatorPcfSummary.finalPcf > 0 ? (operatorPcfSummary.ownEmission / operatorPcfSummary.finalPcf) * 100 : 0}%`,
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
                          {operatorPcfSummary.supplierEmission.toLocaleString()} kgCO₂e (
                          {((operatorPcfSummary.finalPcf > 0
                            ? (operatorPcfSummary.supplierEmission / operatorPcfSummary.finalPcf) * 100
                            : 0
                          )).toFixed(1)}
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
                <h3 className="font-bold text-lg mb-1">협력사별 계산 결과</h3>
                <p className="text-xs text-gray-500 mb-4">
                  위쪽 카드의 부분·최종 산정은 <span className="font-medium">원청이 실행한 산정 유형</span>이고, 자사
                  총배출·kg당은 <span className="font-medium">부분산정</span> 결과를 우선 표시합니다. 직하위 협력사가 없는
                  말단 노드는 부분만 없는 경우가 있어 <span className="font-medium">최종산정(자사)</span>만 표시됩니다.
                  전송은 해당 월 상위로 PCF 공유(SHARED) 여부입니다.
                </p>

                <div className="min-w-[720px]">
                  <div className="grid grid-cols-12 px-4 py-3 rounded-lg bg-gray-50 border-b-2 border-gray-300 text-sm font-semibold">
                    <div className="col-span-3">회사명</div>
                    <div className="col-span-2 text-right">자사 총배출량 (kgCO₂e)</div>
                    <div className="col-span-2 text-right">자사 kg당 배출 (kgCO₂e/kg)</div>
                    <div className="col-span-5 text-right">전송</div>
                  </div>

                  {monthlyOverviewLoading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      협력사 목록 불러오는 중…
                    </div>
                  ) : supplierOnlyRows.length === 0 ? (
                    <div className="py-10 text-center text-gray-500 text-sm">
                      이 세부제품·월에 표시할 하위 협력사 노드가 없습니다.
                    </div>
                  ) : (
                    supplierOnlyRows.map((r) => {
                      const rowKey = oprSupplierRowStableKey(r);
                      const ownTotal =
                        r.own_total_co2e_kg != null && Number.isFinite(r.own_total_co2e_kg)
                          ? r.own_total_co2e_kg
                          : null;
                      const ownPerKg =
                        r.own_pcf_per_kg_co2e != null && Number.isFinite(r.own_pcf_per_kg_co2e)
                          ? r.own_pcf_per_kg_co2e
                          : null;
                      return (
                        <div
                          key={rowKey}
                          className="grid grid-cols-12 px-4 py-3 border-b border-gray-100 text-sm hover:bg-gray-50"
                        >
                          <div className="col-span-3 flex flex-wrap items-center gap-x-2 min-w-0">
                            <span>{r.company_name}</span>
                            <span className="text-xs text-gray-400">{r.tier_label}</span>
                          </div>
                          <div className="col-span-2 text-right tabular-nums text-gray-800">
                            {formatKgCell(ownTotal)}
                          </div>
                          <div className="col-span-2 text-right tabular-nums text-gray-800">
                            {ownPerKg != null ? ownPerKg.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}
                          </div>
                          <div className="col-span-5 flex items-center justify-end gap-2 flex-wrap">
                            {(() => {
                              const nid = parseNodeIdFromDetailKey(r.detail_key);
                              if (nid == null) {
                                return (
                                  <span className="text-xs text-gray-400" title="노드 식별 불가">
                                    —
                                  </span>
                                );
                              }
                              const sharedFromOverview = r.upstream_pcf_shared === true;
                              const sharedTier1Ready = oprTransferReadyByNodeId.get(nid) === true;
                              if (sharedFromOverview || sharedTier1Ready) {
                                return (
                                  <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-xs">
                                    전송완료
                                  </span>
                                );
                              }
                              if (r.upstream_pcf_shared === false) {
                                return (
                                  <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">전송 전</span>
                                );
                              }
                              if (oprTransferReadyByNodeId.get(nid) === false) {
                                return (
                                  <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">전송 전</span>
                                );
                              }
                              return (
                                <span className="text-xs text-gray-400" title="공유 상태를 확인할 수 없습니다">
                                  —
                                </span>
                              );
                            })()}
                            <button
                              type="button"
                              onClick={() => openDetailDrawer(rowKey)}
                              className="p-1 hover:bg-blue-100 rounded transition-colors"
                              title="계산식 상세보기"
                            >
                              <Eye className="w-4 h-4 text-[#00B4FF]" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
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
                  <th className="px-4 py-3 text-left text-xs font-semibold">산정대상 월</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">산정대상 요약</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">상태</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold">총배출량</th>
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
                    <td className="px-4 py-3 text-sm font-medium tabular-nums">{hist.targetMonthYm}</td>
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
                    <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">
                      {hist.totalCo2eKg != null
                        ? `${hist.totalCo2eKg.toLocaleString(undefined, { maximumFractionDigits: 6 })} kgCO₂e`
                        : '—'}
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
              {historyListLoading ? (
                <>
                  <Loader2 className="w-16 h-16 mx-auto mb-4 text-[#00B4FF] animate-spin" />
                  <p className="text-gray-500 text-lg">산정 이력을 불러오는 중입니다.</p>
                </>
              ) : (
                <>
                  <History className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 text-lg">저장된 PCF 산정 이력이 없습니다.</p>
                  <p className="text-sm text-gray-400 mt-2">계산 탭에서 부분·최종 산정을 실행하면 여기에 기록됩니다.</p>
                </>
              )}
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
                  {supplierOnlyRows.find((row) => oprSupplierRowStableKey(row) === detailDrawer.companyId)
                    ?.company_name ?? '—'}
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
        const totalPcf = history.productPcf;
        const ownEmissionPartial = totalPcf;

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

                {/* PCF 구성 */}
                <div>
                  <h4 className="font-bold text-lg mb-4">PCF 구성</h4>

                  {isPartial ? (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium">내 공정 배출 (Scope1, 2)</span>
                        <span className="text-gray-600">
                          {ownEmissionPartial.toLocaleString()} kgCO₂e (
                          {totalPcf > 0 ? ((ownEmissionPartial / totalPcf) * 100).toFixed(1) : '0.0'}%)
                        </span>
                      </div>
                      <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-5 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                          style={{
                            width: `${totalPcf > 0 ? (ownEmissionPartial / totalPcf) * 100 : 0}%`,
                            background: '#5B3BFA',
                            minWidth: '60px',
                          }}
                        >
                          {totalPcf > 0 ? ((ownEmissionPartial / totalPcf) * 100).toFixed(1) : '0.0'}%
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 rounded-lg bg-gray-50 border border-gray-100 p-4">
                      최종 산정의 자사·협력사·운송 구성 비율은 실행 결과 스코프(Scope) 상세가 연동되면 표시됩니다. 현재는
                      상단 총 PCF 수치만 확인할 수 있습니다.
                    </p>
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
                            <th className="px-4 py-3 text-right text-xs font-semibold">최종 PCF (제품 기준)</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold">상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-100 bg-blue-50 font-semibold">
                            <td className="px-4 py-3 text-sm">{primeOperatorDisplayName}</td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-cyan-700">
                              {history.productPcf.toLocaleString()} kgCO₂e
                            </td>
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