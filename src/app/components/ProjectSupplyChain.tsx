'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Search, Check, Minus, X, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import SupplyChainDiagram from './SupplyChainDiagram';
import Invite from './Invite';
import { useMode } from '../context/ModeContext';
import { apiFetch } from '@/lib/api/client';
import { SUPPLY_CHAIN_BASE } from '@/lib/api/supply-chain';

// Supply chain node structure
interface SupplyChainNode {
  id: string;
  tier: 'Tier 0' | 'Tier 1' | 'Tier 2' | 'Tier 3';
  companyName: string;
  companyNameEn: string;
  country: string;
  materialType: string;
  children?: SupplyChainNode[];
}

// Product structure (코드 기반 설계)
interface DetailProduct {
  id: string;
  displayName: string;        // UI 표시: A-001
  productItemCode: string;    // 코드: PROD_A_001
  bomCode: string;            // BOM 코드: BOM_PROD_A_001
  description?: string;       // 설명: 기본형, LFP 적용 등
  legacyAlias?: string;       // 구 표기 (tooltip용): A'
  suppliers: string[];
}

interface ProductGroup {
  id: string;
  name: string;               // UI 표시: 제품A
  productCode: string;        // 코드: PROD_A
  detailProducts: DetailProduct[];
}

interface Project {
  id: string;
  projectCode?: string;       // 코드: PRJ_2026_BATT (optional)
  customerId: string;
  customerName: string;
  branchId: string;
  branchName: string;
  period: string;
  projectName: string;
  productGroups: ProductGroup[];
}

type ApiCustomer = { id: number; name: string; code?: string | null };
type ApiBranch = { id: number; customer_id: number; name: string; code?: string | null };
type ApiProject = { id: number; cust_branch_id: number; name: string; code: string; start_date: string; end_date: string };
type ApiProduct = { id: number; project_id: number; name: string; code: string };
type ApiProductVariant = { id: number; product_id: number; name: string; code?: string | null };
type ApiBom = { id: number; product_variant_id: number; code?: string | null };
/** 제품별 SRM 1차 협력사 후보 (모달) */
type ApiSupplierBrief = { id: number; product_id: number; name: string; code?: string | null };

/** 필터 캐스케이드용 (순서 무관 선택, 상위 선택 시 하위 후보만 축소) */
type ScopeBranchRow = {
  branchId: number;
  branchName: string;
  customerId: number;
  customerName: string;
};
type ScopeProductRow = {
  code: string;
  name: string;
  branchId: number;
  branchName: string;
  customerId: number;
  customerName: string;
};

// Mock data (고객사/지사별 제품명·세부제품명 고유화)
const mockProjects: Project[] = [
  // Audi / Audi Germany
  {
    id: 'proj-1',
    projectCode: 'PRJ_2026_BATT',
    customerId: 'audi',
    customerName: 'Audi',
    branchId: 'audi-germany',
    branchName: 'Audi Germany',
    period: '2026.01 ~ 2026.12',
    projectName: '2026 Battery Program',
    productGroups: [
      {
        id: 'pg-1',
        name: 'Audi 배터리 모듈 A',
        productCode: 'AUDI_PROD_A',
        detailProducts: [
          // 세부제품당 1차 최소 2개. 전환 시 2·3차 한쪽 브랜치만 변경
          { id: 'dp-1', displayName: 'AU-A-001', productItemCode: 'AUDI_PROD_A_001', bomCode: 'BOM_AUDI_A_001', description: '기본형', legacyAlias: "A'", suppliers: ['tier0-1', 'tier1-1', 'tier2-1', 'tier3-1', 'tier3-2', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5'] },
          { id: 'dp-2', displayName: 'AU-A-002', productItemCode: 'AUDI_PROD_A_002', bomCode: 'BOM_AUDI_A_002', description: 'LFP 적용', legacyAlias: "A''", suppliers: ['tier0-1', 'tier1-1', 'tier2-2', 'tier3-3', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5'] },
          { id: 'dp-3', displayName: 'AU-A-003', productItemCode: 'AUDI_PROD_A_003', bomCode: 'BOM_AUDI_A_003', description: '고에너지밀도', legacyAlias: "A'''", suppliers: ['tier0-1', 'tier1-1', 'tier2-1', 'tier3-1', 'tier3-2', 'tier1-2', 'tier2-4', 'tier3-6'] },
        ],
      },
      {
        id: 'pg-2',
        name: 'Audi 배터리 모듈 B',
        productCode: 'AUDI_PROD_B',
        detailProducts: [
          { id: 'dp-4', displayName: 'AU-B-001', productItemCode: 'AUDI_PROD_B_001', bomCode: 'BOM_AUDI_B_001', description: 'NCM 적용', legacyAlias: "B'", suppliers: ['tier0-1', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5', 'tier1-3', 'tier2-5', 'tier3-7', 'tier3-8'] },
          { id: 'dp-5', displayName: 'AU-B-002', productItemCode: 'AUDI_PROD_B_002', bomCode: 'BOM_AUDI_B_002', description: '고출력형', legacyAlias: "B''", suppliers: ['tier0-1', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5', 'tier1-3', 'tier2-6', 'tier3-9'] },
        ],
      },
    ],
  },
  {
    id: 'proj-1b',
    projectCode: 'PRJ_EV_PACK',
    customerId: 'audi',
    customerName: 'Audi',
    branchId: 'audi-germany',
    branchName: 'Audi Germany',
    period: '2026.04 ~ 2027.03',
    projectName: 'EV Pack Pilot Project',
    productGroups: [
      {
        id: 'pg-1b',
        name: 'Audi 배터리 모듈 A',
        productCode: 'AUDI_PROD_A',
        detailProducts: [
          { id: 'dp-1', displayName: 'AU-A-001', productItemCode: 'AUDI_PROD_A_001', bomCode: 'BOM_AUDI_A_001', description: '기본형', legacyAlias: "A'", suppliers: ['tier0-1', 'tier1-1', 'tier2-1', 'tier3-1', 'tier3-2', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5'] },
          { id: 'dp-2', displayName: 'AU-A-002', productItemCode: 'AUDI_PROD_A_002', bomCode: 'BOM_AUDI_A_002', description: 'LFP 적용', legacyAlias: "A''", suppliers: ['tier0-1', 'tier1-1', 'tier2-2', 'tier3-3', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5'] },
        ],
      },
    ],
  },
  {
    id: 'proj-1c',
    projectCode: 'PRJ_DE_BATT',
    customerId: 'audi',
    customerName: 'Audi',
    branchId: 'audi-germany',
    branchName: 'Audi Germany',
    period: '2026.06 ~ 2027.12',
    projectName: 'Germany Battery Supply Project',
    productGroups: [
      {
        id: 'pg-1c',
        name: 'Audi 배터리 모듈 A',
        productCode: 'AUDI_PROD_A',
        detailProducts: [
          { id: 'dp-1', displayName: 'AU-A-001', productItemCode: 'AUDI_PROD_A_001', bomCode: 'BOM_AUDI_A_001', description: '기본형', legacyAlias: "A'", suppliers: ['tier0-1', 'tier1-1', 'tier2-1', 'tier3-1', 'tier3-2', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5'] },
        ],
      },
    ],
  },
  // BMW / BMW Munich
  {
    id: 'proj-2',
    projectCode: 'PRJ_IX5_ESS',
    customerId: 'bmw',
    customerName: 'BMW',
    branchId: 'bmw-munich',
    branchName: 'BMW Munich',
    period: '2026.01 ~ 2026.12',
    projectName: 'iX5 ESS Project',
    productGroups: [
      {
        id: 'pg-3',
        name: 'BMW iX5 ESS 팩',
        productCode: 'BMW_PROD_IX5',
        detailProducts: [
          { id: 'dp-6', displayName: 'BMW-X5-001', productItemCode: 'BMW_PROD_IX5_001', bomCode: 'BOM_BMW_X5_001', description: 'ESS 기본형', legacyAlias: "C'", suppliers: ['tier0-1', 'tier1-1', 'tier2-1', 'tier3-1', 'tier3-2', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5'] },
        ],
      },
    ],
  },
  // Mercedes-Benz / Mercedes Germany
  {
    id: 'proj-3',
    projectCode: 'PRJ_MB_BATT',
    customerId: 'mercedes-benz',
    customerName: 'Mercedes-Benz',
    branchId: 'mercedes-germany',
    branchName: 'Mercedes Germany',
    period: '2026.04 ~ 2027.03',
    projectName: 'Mercedes EV Battery Project',
    productGroups: [
      {
        id: 'pg-4',
        name: 'Mercedes EQ 배터리 모듈',
        productCode: 'MB_PROD_EQ',
        detailProducts: [
          { id: 'dp-1', displayName: 'MB-EQ-001', productItemCode: 'MB_PROD_EQ_001', bomCode: 'BOM_MB_EQ_001', description: '기본형', legacyAlias: "A'", suppliers: ['tier0-1', 'tier1-1', 'tier2-1', 'tier3-1', 'tier3-2', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5'] },
          { id: 'dp-2', displayName: 'MB-EQ-002', productItemCode: 'MB_PROD_EQ_002', bomCode: 'BOM_MB_EQ_002', description: 'LFP 적용', legacyAlias: "A''", suppliers: ['tier0-1', 'tier1-1', 'tier2-2', 'tier3-3', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5'] },
          { id: 'dp-3', displayName: 'MB-EQ-003', productItemCode: 'MB_PROD_EQ_003', bomCode: 'BOM_MB_EQ_003', description: '고에너지밀도', legacyAlias: "A'''", suppliers: ['tier0-1', 'tier1-1', 'tier2-1', 'tier3-1', 'tier3-2', 'tier1-2', 'tier2-4', 'tier3-6'] },
        ],
      },
      {
        id: 'pg-5',
        name: 'Mercedes 전고체 셀',
        productCode: 'MB_PROD_SS',
        detailProducts: [
          { id: 'dp-4', displayName: 'MB-SS-001', productItemCode: 'MB_PROD_SS_001', bomCode: 'BOM_MB_SS_001', description: 'NCM 적용', legacyAlias: "B'", suppliers: ['tier0-1', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5', 'tier1-3', 'tier2-5', 'tier3-7', 'tier3-8'] },
          { id: 'dp-5', displayName: 'MB-SS-002', productItemCode: 'MB_PROD_SS_002', bomCode: 'BOM_MB_SS_002', description: '고출력형', legacyAlias: "B''", suppliers: ['tier0-1', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5', 'tier1-3', 'tier2-6', 'tier3-9'] },
        ],
      },
      {
        id: 'pg-6',
        name: 'Mercedes ESS 팩',
        productCode: 'MB_PROD_ESS',
        detailProducts: [
          { id: 'dp-6', displayName: 'MB-ESS-001', productItemCode: 'MB_PROD_ESS_001', bomCode: 'BOM_MB_ESS_001', description: 'ESS 기본형', legacyAlias: "C'", suppliers: ['tier0-1', 'tier1-1', 'tier2-1', 'tier3-1', 'tier3-2', 'tier1-2', 'tier2-3', 'tier3-4', 'tier3-5'] },
        ],
      },
    ],
  },
];

// Mock supply chain structure
const mockSupplyChain: SupplyChainNode = {
  id: 'tier0-1',
  tier: 'Tier 0',
  companyName: '삼성SDI',
  companyNameEn: 'Samsung SDI',
  country: 'South Korea',
  materialType: '배터리 모듈',
  children: [
    {
      id: 'tier1-1',
      tier: 'Tier 1',
      companyName: '한국배터리',
      companyNameEn: 'Korea Battery',
      country: 'South Korea',
      materialType: '배터리 셀',
      children: [
        {
          id: 'tier2-1',
          tier: 'Tier 2',
          companyName: '글로벌소재',
          companyNameEn: 'Global Materials',
          country: 'Germany',
          materialType: '양극재',
          children: [
            {
              id: 'tier3-1',
              tier: 'Tier 3',
              companyName: '리튬광산',
              companyNameEn: 'Lithium Mine',
              country: 'Australia',
              materialType: '리튬 원광',
            },
            {
              id: 'tier3-2',
              tier: 'Tier 3',
              companyName: '니켈광산',
              companyNameEn: 'Nickel Mine',
              country: 'Indonesia',
              materialType: '니켈 원광',
            },
          ],
        },
        {
          id: 'tier2-2',
          tier: 'Tier 2',
          companyName: '화학소재',
          companyNameEn: 'Chemical Materials',
          country: 'South Korea',
          materialType: '전해질',
        },
        {
          id: 'tier2-3',
          tier: 'Tier 2',
          companyName: '셀테크',
          companyNameEn: 'Cell Tech',
          country: 'China',
          materialType: '음극재',
        },
      ],
    },
    {
      id: 'tier1-2',
      tier: 'Tier 1',
      companyName: '글로벌셀',
      companyNameEn: 'Global Cell',
      country: 'Japan',
      materialType: '배터리 팩',
    },
    {
      id: 'tier1-3',
      tier: 'Tier 1',
      companyName: '아시아셀',
      companyNameEn: 'Asia Cell',
      country: 'China',
      materialType: '배터리 셀',
    },
  ],
};

const LS_REGISTERED_TIER1_SUPPLIERS_KEY = 'aifix_mock_registered_tier1_suppliers_v1';
type RegisteredTier1Supplier = {
  id: string;
  name: string;
  nameEn: string;
  supplierId: number;
  projectId: number;
  productId: number;
  productVariantId: number;
};

export default function ProjectSupplyChain() {
  const { mode } = useMode();
  const isProcurementView = mode === 'procurement'; // 1차 협력사 추가는 구매 관점에서만 가능
  /** 초대 모달: 구매는 발송·이력·승인, PCF는 Invite 내부에서 이력 조회만 */
  const canOpenTier1InviteModal = mode === 'procurement' || mode === 'pcf';
  const [apiProjects, setApiProjects] = useState<Project[]>([]);
  /** /customers 응답만으로 채움 — 전체 트리 로딩 전에도 고객사 토글에 목록 표시 */
  const [apiCustomers, setApiCustomers] = useState<ApiCustomer[]>([]);
  /** API 메타(지사·제품 코드) — 전체 트리 로딩과 병행, projectRows와 머지 */
  const [scopeBranchesRaw, setScopeBranchesRaw] = useState<ScopeBranchRow[]>([]);
  const [scopeProductsRaw, setScopeProductsRaw] = useState<ScopeProductRow[]>([]);
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [apiLoadError, setApiLoadError] = useState<string | null>(null);

  // Filter states (고객·지사·제품 순서 무관 — 값이 있으면 해당 차원으로 후보만 좁힘)
  const [selectedCustomer, setSelectedCustomer] = useState('');
  /** ALL = 지사 필터 없음, 그 외 = opr_cust_branches.id 문자열 */
  const [selectedBranchKey, setSelectedBranchKey] = useState<string>('ALL');
  // '' = 선택, 'ALL' = 전체(모든 제품) - 기본값 ALL
  const [selectedProductFilterCode, setSelectedProductFilterCode] = useState<string>('ALL');
  
  // UI states
  const [hasQueried, setHasQueried] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['tier0-1']));
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showTier1InviteManageModal, setShowTier1InviteManageModal] = useState(false);
  // 제품 단위 (product_code 기준)
  const [selectedProductCode, setSelectedProductCode] = useState<string>('');
  // 세부제품(BOM) 단위
  const [selectedProductItemCode, setSelectedProductItemCode] = useState<string>('ALL');
  const showBomComparison = false;
  
  // Modal states
  const [modalCustomer, setModalCustomer] = useState('');
  const [modalBranch, setModalBranch] = useState('');
  const [modalProject, setModalProject] = useState('');
  const [modalProductGroup, setModalProductGroup] = useState('');
  const [modalDetailProduct, setModalDetailProduct] = useState('');
  const [modalSupplier, setModalSupplier] = useState('');
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [modalSuppliers, setModalSuppliers] = useState<ApiSupplierBrief[]>([]);
  const [modalSuppliersLoading, setModalSuppliersLoading] = useState(false);
  const [modalSuppliersError, setModalSuppliersError] = useState<string | null>(null);

  // DB/API 데이터만 사용 (mock fallback 비활성화)
  const projectRows = apiProjects;

  // 고객사 목록: API customers 우선 (트리 로딩 중에도 표시). 로드 후엔 이름 기준 동일.
  const customers = useMemo(
    () =>
      Array.from(new Set(apiCustomers.map((c) => c.name).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [apiCustomers]
  );
  
  const scopeBranches = useMemo(() => {
    const byId = new Map<number, ScopeBranchRow>();
    scopeBranchesRaw.forEach((b) => byId.set(b.branchId, b));
    projectRows.forEach((p) => {
      const bid = Number(p.branchId);
      if (!Number.isFinite(bid)) return;
      if (!byId.has(bid)) {
        byId.set(bid, {
          branchId: bid,
          branchName: p.branchName,
          customerId: Number(p.customerId),
          customerName: p.customerName,
        });
      }
    });
    return Array.from(byId.values()).sort((a, b) => {
      const c = String(a.customerName ?? '').localeCompare(String(b.customerName ?? ''));
      return c !== 0 ? c : String(a.branchName ?? '').localeCompare(String(b.branchName ?? ''));
    });
  }, [scopeBranchesRaw, projectRows]);

  const scopeProducts = useMemo(() => {
    const map = new Map<string, ScopeProductRow>();
    const k = (r: ScopeProductRow) => `${r.branchId}::${r.code}`;
    scopeProductsRaw.forEach((r) => map.set(k(r), r));
    projectRows.forEach((p) => {
      const bid = Number(p.branchId);
      if (!Number.isFinite(bid)) return;
      p.productGroups.forEach((pg) => {
        const key = `${bid}::${pg.productCode}`;
        if (!map.has(key)) {
          map.set(key, {
            code: pg.productCode,
            name: pg.name,
            branchId: bid,
            branchName: p.branchName,
            customerId: Number(p.customerId),
            customerName: p.customerName,
          });
        }
      });
    });
    return Array.from(map.values());
  }, [scopeProductsRaw, projectRows]);

  /** 고객 미선택 시 전체 지사, 고객 선택 시 해당 고객 지사만 */
  const branchSelectOptions = useMemo(() => {
    const rows = selectedCustomer
      ? scopeBranches.filter((b) => b.customerName === selectedCustomer)
      : scopeBranches;
    return rows.map((b) => ({
      value: String(b.branchId),
      label: selectedCustomer ? b.branchName : `${b.customerName} · ${b.branchName}`,
    }));
  }, [scopeBranches, selectedCustomer]);

  const selectedBranchRow = useMemo(
    () =>
      selectedBranchKey === 'ALL'
        ? undefined
        : scopeBranches.find((b) => String(b.branchId) === selectedBranchKey),
    [scopeBranches, selectedBranchKey]
  );

  const modalBranchOptions = useMemo(() => {
    if (!modalCustomer) return [];
    return Array.from(
      new Set(
        scopeBranches
          .filter((b) => b.customerName === modalCustomer)
          .map((b) => b.branchName)
          .filter((n): n is string => n != null && String(n).trim() !== '')
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [modalCustomer, scopeBranches]);

  /** 고객·지사 선택에 따라 제품 후보 축소 (둘 다 비우면 전체 제품) */
  const cascadingProductSource = useMemo(() => {
    let rows = scopeProducts;
    if (selectedCustomer) rows = rows.filter((r) => r.customerName === selectedCustomer);
    if (selectedBranchKey !== 'ALL') {
      const bid = Number(selectedBranchKey);
      rows = rows.filter((r) => r.branchId === bid);
    }
    return rows;
  }, [scopeProducts, selectedCustomer, selectedBranchKey]);

  // Scope projects: 고객·지사 필터만 적용 (둘 다 비어 있으면 전체 프로젝트 행)
  const scopedProjects = useMemo(() => {
    return projectRows.filter((p) => {
      if (selectedCustomer && p.customerName !== selectedCustomer) return false;
      if (selectedBranchKey !== 'ALL' && String(p.branchId) !== selectedBranchKey) return false;
      return true;
    });
  }, [projectRows, selectedCustomer, selectedBranchKey]);

  /** Google Gmail 연동 완료 후 복귀 시 1차 초대 모달 자동 오픈 (?tier1Invite=1) */
  const tier1InviteReopenHandled = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || tier1InviteReopenHandled.current) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('tier1Invite') !== '1') return;
    tier1InviteReopenHandled.current = true;
    if (mode === 'procurement' || mode === 'pcf') {
      setShowTier1InviteManageModal(true);
    }
    sp.delete('tier1Invite');
    const q = sp.toString();
    const path = window.location.pathname;
    const nextUrl = q ? `${path}?${q}` : path;
    window.history.replaceState(null, '', nextUrl);
  }, [mode]);

  useEffect(() => {
    let mounted = true;
    let loadAttempted = false;
    
    const load = async () => {
      if (loadAttempted) return;
      loadAttempted = true;
      
      try {
        const customersRes = await apiFetch<ApiCustomer[]>(
          `${SUPPLY_CHAIN_BASE}/project-supply-chain/customers`
        );
        if (mounted) {
          setApiCustomers(customersRes);
        }
        
        // 모든 고객사의 모든 지사를 병렬로 가져오기
        const allBranchesPromises = customersRes.map(async (c) => {
          try {
            const branchesRes = await apiFetch<ApiBranch[]>(
              `${SUPPLY_CHAIN_BASE}/project-supply-chain/customers/${c.id}/branches`
            );
            return branchesRes.map(b => ({ customer: c, branch: b }));
          } catch {
            return [];
          }
        });
        
        const allBranchesNested = await Promise.all(allBranchesPromises);
        const allBranches = allBranchesNested.flat();
        
        // 모든 지사의 프로젝트를 병렬로 가져오기
        const allProjectsPromises = allBranches.map(async ({ customer, branch }) => {
          try {
            const p = await apiFetch<ApiProject>(
              `${SUPPLY_CHAIN_BASE}/project-supply-chain/branches/${branch.id}/project`
            );
            return { customer, branch, project: p };
          } catch {
            return null;
          }
        });
        
        const allProjectsResults = await Promise.all(allProjectsPromises);
        const allProjects = allProjectsResults.filter((x): x is NonNullable<typeof x> => x !== null);
        
        // 모든 프로젝트의 제품을 병렬로 가져오기
        const allProductsPromises = allProjects.map(async ({ customer, branch, project }) => {
          try {
            const products = await apiFetch<ApiProduct[]>(
              `${SUPPLY_CHAIN_BASE}/project-supply-chain/projects/${project.id}/products`
            );
            return products.map(prod => ({ customer, branch, project, product: prod }));
          } catch {
            return [];
          }
        });
        
        const allProductsNested = await Promise.all(allProductsPromises);
        const allProductsFlat = allProductsNested.flat();
        
        // 모든 제품의 변형을 병렬로 가져오기
        const allVariantsPromises = allProductsFlat.map(async (item) => {
          try {
            const variants = await apiFetch<ApiProductVariant[]>(
              `${SUPPLY_CHAIN_BASE}/project-supply-chain/projects/${item.project.id}/products/${item.product.id}/product-variants`
            );
            return variants.map(v => ({ ...item, variant: v }));
          } catch {
            return [];
          }
        });
        
        const allVariantsNested = await Promise.all(allVariantsPromises);
        const allVariants = allVariantsNested.flat();
        
        // 모든 변형의 BOM을 병렬로 가져오기
        const allBomsPromises = allVariants.map(async (item) => {
          try {
            const bom = await apiFetch<ApiBom>(
              `${SUPPLY_CHAIN_BASE}/project-supply-chain/projects/${item.project.id}/product-variants/${item.variant.id}/bom`
            );
            return { ...item, bomCode: bom.code ?? '' };
          } catch {
            return { ...item, bomCode: '' };
          }
        });
        
        const allBomsResults = await Promise.all(allBomsPromises);
        
        // 데이터 재구성
        const projectsMap = new Map<string, Project>();
        
        for (const item of allBomsResults) {
          const projectKey = `${item.customer.id}-${item.branch.id}-${item.project.id}`;
          
          if (!projectsMap.has(projectKey)) {
            projectsMap.set(projectKey, {
              id: String(item.project.id),
              projectCode: item.project.code,
              customerId: String(item.customer.id),
              customerName: item.customer.name,
              branchId: String(item.branch.id),
              branchName: item.branch.name,
              period: `${item.project.start_date} ~ ${item.project.end_date}`,
              projectName: item.project.name,
              productGroups: [],
            });
          }
          
          const project = projectsMap.get(projectKey)!;
          let productGroup = project.productGroups.find(pg => pg.id === String(item.product.id));
          
          if (!productGroup) {
            productGroup = {
              id: String(item.product.id),
              name: item.product.name,
              productCode: item.product.code,
              detailProducts: [],
            };
            project.productGroups.push(productGroup);
          }
          
          productGroup.detailProducts.push({
            id: String(item.variant.id),
            displayName: item.variant.name,
            productItemCode: item.variant.code ?? item.variant.name,
            bomCode: item.bomCode || '-',
            suppliers: [],
          });
        }
        
        const projects: Project[] = Array.from(projectsMap.values());

        if (mounted) {
          setApiProjects(projects);
          setApiLoadError(null);
          setIsApiLoaded(true);
        }
      } catch (e) {
        if (mounted) {
          setApiProjects([]);
          setIsApiLoaded(true);
          setApiLoadError(e instanceof Error ? e.message : '알 수 없는 오류');
          console.error(e);
          toast.error('공급망 API 조회에 실패했습니다.');
        }
      }
    };
    
    // 세션 복원 대기 후 로드
    const timer = setTimeout(() => {
      void load();
    }, 500);
    
    // 세션 업데이트 이벤트 리스너
    const handleSessionUpdate = () => {
      clearTimeout(timer);
      void load();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('aifixr-session-updated', handleSessionUpdate);
    }
    
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('aifixr-session-updated', handleSessionUpdate);
      }
    };
  }, []);

  // 고객 목록 확보 후 전 고객의 지사·제품 메타만 병렬 로드 (BOM/variant 없음 — 필터용)
  useEffect(() => {
    if (apiCustomers.length === 0) {
      setScopeBranchesRaw([]);
      setScopeProductsRaw([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const br: ScopeBranchRow[] = [];
      const pr: ScopeProductRow[] = [];
      await Promise.all(
        apiCustomers.map(async (c) => {
          try {
            const branchesRes = await apiFetch<ApiBranch[]>(
              `${SUPPLY_CHAIN_BASE}/project-supply-chain/customers/${c.id}/branches`
            );
            for (const b of branchesRes) {
              br.push({
                branchId: b.id,
                branchName: b.name,
                customerId: c.id,
                customerName: c.name,
              });
              try {
                const p = await apiFetch<ApiProject>(
                  `${SUPPLY_CHAIN_BASE}/project-supply-chain/branches/${b.id}/project`
                );
                const products = await apiFetch<ApiProduct[]>(
                  `${SUPPLY_CHAIN_BASE}/project-supply-chain/projects/${p.id}/products`
                );
                for (const prod of products) {
                  pr.push({
                    code: prod.code,
                    name: prod.name,
                    branchId: b.id,
                    branchName: b.name,
                    customerId: c.id,
                    customerName: c.name,
                  });
                }
              } catch {
                /* 프로젝트 없음 */
              }
            }
          } catch {
            /* 고객별 스킵 */
          }
        })
      );
      if (!cancelled) {
        setScopeBranchesRaw(br);
        setScopeProductsRaw(pr);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiCustomers]);

  // 상위(고객) 변경 등으로 현재 지사가 후보에 없으면 전체로
  useEffect(() => {
    if (selectedBranchKey === 'ALL') return;
    const valid = branchSelectOptions.some((o) => o.value === selectedBranchKey);
    if (!valid) setSelectedBranchKey('ALL');
  }, [branchSelectOptions, selectedBranchKey]);

  // Build product groups union by productCode across scoped projects.
  // (제품카테고리가 같아도 BOM(세부제품)이 달라질 수 있으므로 detailProducts를 합칩니다.)
  const productGroupsUnion = useMemo(() => {
    const productCodeMap = new Map<
      string,
      {
        id: string;
        name: string;
        productCode: string;
        detailProductMap: Map<string, DetailProduct>;
      }
    >();

    scopedProjects.forEach((proj) => {
      proj.productGroups.forEach((pg) => {
        const entry =
          productCodeMap.get(pg.productCode) ?? {
            id: pg.id,
            name: pg.name,
            productCode: pg.productCode,
            detailProductMap: new Map<string, DetailProduct>(),
          };

        pg.detailProducts.forEach((dp) => {
          const key = dp.productItemCode; // BOM 단위 식별에 productItemCode를 사용
          const existing = entry.detailProductMap.get(key);
          if (!existing) {
            entry.detailProductMap.set(key, { ...dp, suppliers: [...dp.suppliers] });
            return;
          }

          // 동일 BOM(productItemCode) 내에서 공급사 배열을 합침(중복 제거)
          entry.detailProductMap.set(key, {
            ...existing,
            suppliers: Array.from(new Set([...(existing.suppliers ?? []), ...(dp.suppliers ?? [])])),
          });
        });

        productCodeMap.set(pg.productCode, entry);
      });
    });

    return Array.from(productCodeMap.values()).map((entry) => ({
      id: entry.id,
      name: entry.name,
      productCode: entry.productCode,
      detailProducts: Array.from(entry.detailProductMap.values()),
    })) as ProductGroup[];
  }, [scopedProjects]);

  // 제품 필터 드롭다운: 캐스케이드 소스에서 코드별 1행 (이름은 첫 매칭)
  const productFilterRows = useMemo(() => {
    const seen = new Map<string, string>();
    cascadingProductSource.forEach((r) => {
      const code = r.code != null ? String(r.code).trim() : '';
      if (!code) return;
      if (!seen.has(code)) seen.set(code, r.name != null ? String(r.name) : code);
    });
    return Array.from(seen.entries())
      .map(([code, name]) => ({ key: code, productCode: code, name }))
      .sort((a, b) => a.productCode.localeCompare(b.productCode, undefined, { sensitivity: 'base' }));
  }, [cascadingProductSource]);

  // 고객/지사 변경으로 제품 코드가 후보에서 빠지면 ALL로
  useEffect(() => {
    if (selectedProductFilterCode === 'ALL' || selectedProductFilterCode === '') return;
    const ok = productFilterRows.some((r) => r.productCode === selectedProductFilterCode);
    if (!ok) setSelectedProductFilterCode('ALL');
  }, [productFilterRows, selectedProductFilterCode]);

  // 모달: 선택한 프로젝트·카탈로그 제품에 매핑된 SRM 협력사 목록
  useEffect(() => {
    if (!showAddSupplierModal) {
      setModalSuppliers([]);
      setModalSuppliersError(null);
      setModalSuppliersLoading(false);
      return;
    }
    const mProjects = projectRows.filter(
      (p) => p.customerName === modalCustomer && p.branchName === modalBranch,
    );
    const rProject = modalProject || mProjects[0]?.id || '';
    const mPgs = mProjects.find((p) => p.id === rProject)?.productGroups ?? [];
    const rPg = modalProductGroup || mPgs[0]?.id || '';
    if (!rProject || !rPg) {
      setModalSuppliers([]);
      setModalSuppliersLoading(false);
      setModalSuppliersError(null);
      return;
    }
    const nProj = Number(rProject);
    const nProd = Number(rPg);
    const nVariant = Number(modalDetailProduct);
    if (!Number.isFinite(nProj) || !Number.isFinite(nProd)) {
      setModalSuppliers([]);
      setModalSuppliersLoading(false);
      return;
    }
    const variantQuery =
      Number.isFinite(nVariant) && nVariant >= 1
        ? `?product_variant_id=${nVariant}`
        : '';
    let cancelled = false;
    setModalSupplier('');
    setModalSuppliersLoading(true);
    setModalSuppliersError(null);
    void (async () => {
      try {
        const rows = await apiFetch<ApiSupplierBrief[]>(
          `${SUPPLY_CHAIN_BASE}/project-supply-chain/projects/${nProj}/products/${nProd}/suppliers${variantQuery}`,
        );
        if (!cancelled) setModalSuppliers(rows);
      } catch (e) {
        if (!cancelled) {
          setModalSuppliers([]);
          setModalSuppliersError(
            e instanceof Error ? e.message : '협력사 목록을 불러오지 못했습니다.',
          );
        }
      } finally {
        if (!cancelled) setModalSuppliersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    showAddSupplierModal,
    modalCustomer,
    modalBranch,
    modalProject,
    modalProductGroup,
    modalDetailProduct,
    projectRows,
  ]);

  // Apply filter: specific product code or ALL
  const productGroups =
    selectedProductFilterCode === 'ALL'
      ? productGroupsUnion
      : selectedProductFilterCode === ''
        ? []
        : productGroupsUnion.filter((pg) => pg.productCode === selectedProductFilterCode);
  
  // Get current product (productCode 기준) - fallback to first when empty
  const currentProductGroup = productGroups.find(pg => pg.productCode === selectedProductCode) || productGroups[0];
  
  // Get detail products (product_item list) for current product
  const detailProducts = currentProductGroup?.detailProducts || [];
  
  // Get current detail product (productItemCode or id 기준)
  const currentDetailProduct = selectedProductItemCode === 'ALL'
    ? undefined
    : detailProducts.find(dp => dp.productItemCode === selectedProductItemCode || dp.id === selectedProductItemCode);

  const handleQuery = () => {
    if (!selectedProductFilterCode || selectedProductFilterCode === '') {
      toast.error('제품 필터를 선택해 주세요 (ALL 가능)');
      return;
    }
    if (productGroups.length === 0) {
      if (!isApiLoaded) {
        toast.error('전체 공급망 데이터를 불러오는 중입니다. 잠시 후 다시 조회해 주세요.');
        return;
      }
      toast.error('선택한 조건에 맞는 제품이 없습니다. 고객사·지사·제품 조합을 바꿔 보세요.');
      return;
    }
    setHasQueried(true);
    setSelectedProductCode(productGroups[0].productCode);
    setSelectedProductItemCode('ALL');
    toast.success('조회가 완료되었습니다');
  };

  const openAddSupplierModal = () => {
    // 지사만 먼저 고른 경우 고객명은 지사 행에서 유추
    const nextCustomer = selectedCustomer || selectedBranchRow?.customerName || '';
    const nextBranch = selectedBranchRow?.branchName ?? '';

    const candidateProjects = nextCustomer && nextBranch
      ? projectRows.filter((p) => p.customerName === nextCustomer && p.branchName === nextBranch)
      : [];
    const nextProjectId = candidateProjects[0]?.id || '';

    const candidateProductGroups = nextProjectId
      ? (candidateProjects.find((p) => p.id === nextProjectId)?.productGroups || [])
      : [];

    const nextProductGroupId = selectedProductCode
      ? (candidateProductGroups.find((pg) => pg.productCode === selectedProductCode)?.id || '')
      : '';

    const candidateDetailProducts = nextProductGroupId
      ? (candidateProductGroups.find((pg) => pg.id === nextProductGroupId)?.detailProducts || [])
      : [];

    const nextDetailProductId =
      selectedProductItemCode && selectedProductItemCode !== 'ALL'
        ? (candidateDetailProducts.find(
            (dp) => dp.productItemCode === selectedProductItemCode || dp.id === selectedProductItemCode
          )?.id || '')
        : '';

    setModalCustomer(nextCustomer);
    setModalBranch(nextBranch);
    setModalProject(nextProjectId);
    setModalProductGroup(nextProductGroupId);
    setModalDetailProduct(nextDetailProductId);
    setModalSupplier('');
    setSupplierSearchTerm('');
    setShowAddSupplierModal(true);
  };

  const handleProductTabClick = (productCode: string) => {
    setSelectedProductCode(productCode);
    setSelectedProductItemCode('ALL');
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

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Tier 0':
        return '#5B3BFA';
      case 'Tier 1':
        return '#2A64E0';
      case 'Tier 2':
        return '#00A3B5';
      case 'Tier 3':
        return '#8C8C8C';
      default:
        return '#8C8C8C';
    }
  };

  const isNodeHighlighted = (nodeId: string) => {
    if (selectedProductItemCode === 'ALL') return true;
    return currentDetailProduct?.suppliers.includes(nodeId) || false;
  };

  const isNodeInBom = (nodeId: string, bomId: string) => {
    const bom = detailProducts.find(dp => dp.id === bomId || dp.productItemCode === bomId);
    return bom?.suppliers.includes(nodeId) || false;
  };

  const renderNode = (node: SupplyChainNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const highlighted = isNodeHighlighted(node.id);
    const tierColor = getTierColor(node.tier);

    return (
      <div key={node.id} className="mb-2">
        <div
          className="flex items-start gap-3 p-4 rounded-2xl transition-all"
          style={{
            marginLeft: `${depth * 40}px`,
            opacity: highlighted ? 1 : 0.3,
            backgroundColor: highlighted ? 'rgba(91, 59, 250, 0.02)' : '#FFFFFF',
            border: highlighted ? `2px solid ${tierColor}` : '1px solid #E5E7EB',
            boxShadow: highlighted ? '0px 4px 16px rgba(0, 0, 0, 0.08)' : '0px 4px 16px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Expand button */}
          <div className="flex-shrink-0 pt-1">
            {hasChildren ? (
              <button
                onClick={() => toggleNode(node.id)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>
            ) : (
              <div className="w-5"></div>
            )}
          </div>

          {/* Company info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-3 py-1 text-xs font-semibold text-white rounded-full"
                style={{ backgroundColor: tierColor }}
              >
                {node.tier}
              </span>
              <h4 className="text-base font-bold text-gray-900">
                {node.companyName} <span className="text-sm font-normal text-gray-500">({node.companyNameEn})</span>
              </h4>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
              <span>{node.country}</span>
              <span className="text-gray-400">|</span>
              <span>{node.materialType}</span>
            </div>

            {/* BOM inclusion badges */}
            {selectedProductItemCode !== 'ALL' && highlighted && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Included in {currentDetailProduct?.displayName}</span>
              </div>
            )}
          </div>

          {/* BOM Comparison Column */}
          {showBomComparison && (
            <div className="flex items-center gap-4">
              {detailProducts.map((dp) => (
                <div key={dp.id} className="flex items-center justify-center w-12">
                  {isNodeInBom(node.id, dp.productItemCode) ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <Minus size={16} className="text-gray-300" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="mt-2">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleAddSupplier = async () => {
    const mProjects = projectRows.filter(
      (p) => p.customerName === modalCustomer && p.branchName === modalBranch,
    );
    const rProject = modalProject || mProjects[0]?.id || '';
    const mPgs = mProjects.find((p) => p.id === rProject)?.productGroups ?? [];
    const rPg = modalProductGroup || mPgs[0]?.id || '';
    if (!modalCustomer || !modalBranch || !rProject || !rPg || !modalDetailProduct || !modalSupplier) {
      toast.error('고객사·지사·제품·세부제품·협력사를 모두 선택해 주세요');
      return;
    }
    const nProj = Number(rProject);
    const nVariant = Number(modalDetailProduct);
    const nSup = Number(modalSupplier);
    if (!Number.isFinite(nProj) || !Number.isFinite(nVariant) || !Number.isFinite(nSup)) {
      toast.error('선택 값이 올바르지 않습니다');
      return;
    }
    const selected = modalSuppliers.find((s) => String(s.id) === modalSupplier);
    try {
      await apiFetch(
        `${SUPPLY_CHAIN_BASE}/project-supply-chain/projects/${nProj}/product-variants/${nVariant}/tier1-suppliers`,
        { method: 'POST', json: { supplier_id: nSup } },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '추가 요청에 실패했습니다.';
      toast.error(msg);
      return;
    }

    try {
      if (selected) {
        const prevRaw = localStorage.getItem(LS_REGISTERED_TIER1_SUPPLIERS_KEY);
        const prev = (prevRaw ? JSON.parse(prevRaw) : []) as RegisteredTier1Supplier[];
        const item: RegisteredTier1Supplier = {
          id: `${nProj}:${rPg}:${nVariant}:${selected.id}`,
          name: selected.name,
          nameEn: selected.code ?? '',
          supplierId: selected.id,
          projectId: nProj,
          productId: Number(rPg),
          productVariantId: nVariant,
        };
        const exists = prev.some(
          (p) =>
            p.supplierId === item.supplierId &&
            p.projectId === item.projectId &&
            p.productVariantId === item.productVariantId,
        );
        const next = exists ? prev : [...prev, item];
        localStorage.setItem(LS_REGISTERED_TIER1_SUPPLIERS_KEY, JSON.stringify(next));
      }
    } catch {
      /* localStorage 실패 무시 */
    }

    toast.success('1차 협력사가 추가되었습니다');
    setShowAddSupplierModal(false);
    setModalCustomer('');
    setModalBranch('');
    setModalProject('');
    setModalProductGroup('');
    setModalDetailProduct('');
    setModalSupplier('');
    setSupplierSearchTerm('');
    setModalSuppliers([]);
    setModalSuppliersError(null);
  };

  // Modal: projects for selected customer+branch
  const modalProjects = projectRows.filter(
    p => p.customerName === modalCustomer && p.branchName === modalBranch
  );
  const resolvedModalProject = modalProject || modalProjects[0]?.id || '';
  const modalProductGroups = modalProjects.find(p => p.id === resolvedModalProject)?.productGroups || [];
  const resolvedModalProductGroup = modalProductGroup || modalProductGroups[0]?.id || '';
  const selectedModalDetailProduct =
    modalProductGroups
      .find(pg => pg.id === resolvedModalProductGroup)
      ?.detailProducts.find(dp => dp.id === modalDetailProduct) || null;
  const selectedModalBomCode = selectedModalDetailProduct?.bomCode || '';

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearchTerm.trim().toLowerCase();
    if (!q) return modalSuppliers;
    return modalSuppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code ?? '').toLowerCase().includes(q),
    );
  }, [modalSuppliers, supplierSearchTerm]);

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">프로젝트 / 공급망 관리</h1>
            <p className="text-gray-600">프로젝트 단위로 공급망 구조와 BOM 기반 협력사 구성을 관리합니다.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={() => isProcurementView && openAddSupplierModal()}
              disabled={!isProcurementView}
              title={!isProcurementView ? '1차 협력사 추가는 구매 직무에서만 사용할 수 있습니다' : undefined}
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 rounded-xl font-medium transition-all hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white whitespace-nowrap"
              style={{
                borderColor: isProcurementView ? '#5B3BFA' : '#d1d5db',
                color: isProcurementView ? '#5B3BFA' : '#9ca3af',
              }}
            >
              <Plus size={18} />
              1차 협력사 추가
            </button>
            <button
              type="button"
              onClick={() => canOpenTier1InviteModal && setShowTier1InviteManageModal(true)}
              disabled={!canOpenTier1InviteModal}
              title={
                mode === 'pcf'
                  ? 'ESG(PCF) 직무에서는 발송 이력 조회만 가능합니다. 메일 발송·승인은 구매 직무에서 진행합니다.'
                  : undefined
              }
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 whitespace-nowrap"
              style={{
                background: canOpenTier1InviteModal
                  ? 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)'
                  : '#d1d5db',
                boxShadow: canOpenTier1InviteModal ? '0px 4px 12px rgba(91, 59, 250, 0.2)' : undefined,
              }}
            >
              <UserPlus size={18} />
              1차협력사 초대 및 관리
            </button>
          </div>
        </div>

        {/* Filter Section - Only Project-level filters */}
        <div className="bg-white rounded-2xl p-6 mb-6" style={{ boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.05)' }}>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Customer */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                고객사 <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">전체</option>
                {customers.map((customer) => (
                  <option key={customer} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">세부 지사</label>
              <select
                value={selectedBranchKey}
                onChange={(e) => setSelectedBranchKey(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">전체</option>
                {branchSelectOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Product */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">제품</label>
              <select
                value={selectedProductFilterCode}
                onChange={(e) => setSelectedProductFilterCode(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">선택</option>
                <option value="ALL">ALL</option>
                {productFilterRows.map((row) => (
                  <option key={row.key} value={row.productCode}>
                    {row.name} ({row.productCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Query Button */}
          <div className="flex justify-end">
            <button
              onClick={handleQuery}
              className="px-8 py-2.5 text-white font-semibold rounded-xl transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
              }}
            >
              조회하기
            </button>
          </div>
        </div>

        {/* Supply Chain Visualization */}
        {hasQueried && productGroups.length > 0 && (
          <div>
            {/* Supply Chain Card */}
            <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.05)' }}>
              {/* 제품 탭 (Product Tabs) - 공급망 구조 영역 상단 */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-gray-500 mb-2">제품 선택</div>
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                  {productGroups.map((pg) => {
                    const isSelected = selectedProductCode === pg.productCode;
                    return (
                      <button
                        key={pg.id}
                        onClick={() => handleProductTabClick(pg.productCode)}
                        className={`flex-shrink-0 px-5 py-2.5 font-semibold rounded-xl transition-all whitespace-nowrap ${
                          isSelected
                            ? 'text-white shadow-md'
                            : 'bg-[#F6F8FB] text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`}
                        style={{
                          background: isSelected ? '#5B3BFA' : undefined,
                          border: isSelected ? '2px solid #5B3BFA' : '2px solid transparent',
                        }}
                      >
                        <span>{pg.name}</span>
                        <span className={`ml-1.5 ${isSelected ? 'text-purple-200' : 'text-gray-400'}`}>
                          ({pg.productCode})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Project Info Badges (코드 기반) */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#E9F5FF', color: '#2A64E0' }}>
                  Customer: {selectedCustomer || '-'}
                </div>
                <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#E9F5FF', color: '#2A64E0' }}>
                  Branch: {selectedBranchKey !== 'ALL' && selectedBranchRow ? selectedBranchRow.branchName : '-'}
                </div>
                <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#E9F5FF', color: '#2A64E0' }}>
                  Product: {currentProductGroup.name}
                </div>
                <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#F3E8FF', color: '#6B21A8' }}>
                  Product Code: {currentProductGroup.productCode}
                </div>
                {currentDetailProduct ? (
                  <>
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#E9F5FF', color: '#2A64E0' }}>
                      세부제품: {currentDetailProduct.displayName}
                    </div>
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#F3E8FF', color: '#6B21A8' }}>
                      Product Item Code: {currentDetailProduct.productItemCode}
                    </div>
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#F3E8FF', color: '#6B21A8' }}>
                      BOM Code: {currentDetailProduct.bomCode}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500" style={{ background: '#F3F4F6' }}>
                      세부제품: 전체 보기
                    </div>
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400" style={{ background: '#F3F4F6' }}>
                      Product Item Code: -
                    </div>
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400" style={{ background: '#F3F4F6' }}>
                      BOM Code: -
                    </div>
                  </>
                )}
              </div>

              {/* Header with controls */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">공급망 구조</h2>
                
                <div className="flex items-center gap-3">
                  {/* Detail Product Selector (BOM 단위) - 제품 탭에 연동 */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">세부제품</label>
                    <select
                      value={selectedProductItemCode}
                      onChange={(e) => setSelectedProductItemCode(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[200px]"
                    >
                      <option value="ALL">세부제품 전체 보기</option>
                      {detailProducts.map((dp) => (
                        <option key={dp.id} value={dp.productItemCode} title={dp.legacyAlias ? `legacy: ${dp.legacyAlias}` : undefined}>
                          {dp.displayName}{dp.description ? `  |  ${dp.description}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>

              {/* 현재 선택 상태 (세부제품 선택 시) */}
              {selectedProductItemCode !== 'ALL' && currentDetailProduct && (
                <div className="mb-4 p-4 rounded-xl border-2" style={{ borderColor: '#5B3BFA', background: 'rgba(91, 59, 250, 0.04)' }}>
                  <div className="text-xs font-semibold text-gray-500 mb-2">현재 선택 (BOM 기준 공급망)</div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span><span className="font-medium text-gray-600">세부제품:</span> <span className="font-semibold text-gray-900">{currentDetailProduct.displayName}</span></span>
                    <span><span className="font-medium text-gray-600">코드:</span> <code className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-xs">{currentDetailProduct.productItemCode}</code></span>
                    <span><span className="font-medium text-gray-600">BOM:</span> <code className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-xs">{currentDetailProduct.bomCode}</code></span>
                    {currentDetailProduct.legacyAlias && (
                      <span className="text-gray-400" title="구 표기">legacy: {currentDetailProduct.legacyAlias}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Supply Chain Tree - 해당 제품의 공급망 구조 */}
              <div>
                <SupplyChainDiagram
                  selectedDetailProduct={selectedProductItemCode === 'ALL' ? 'ALL' : (currentDetailProduct?.id ?? 'ALL')}
                  detailProducts={detailProducts}
                />
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!hasQueried && (
          <div className="bg-white rounded-2xl p-12 text-center" style={{ boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.05)' }}>
            <p className="text-gray-500">
              {!isApiLoaded
                ? '실제 데이터 불러오는 중...'
                : apiLoadError
                  ? `공급망 API 조회 실패: ${apiLoadError}`
                  : customers.length === 0
                    ? 'DB에서 조회된 공급망 데이터가 없습니다.'
                    : '조회 조건을 선택하고 조회하기 버튼을 클릭하세요'}
            </p>
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      {showTier1InviteManageModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTier1InviteManageModal(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-[20px] w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col"
            style={{ boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.2)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tier1-invite-manage-title"
            aria-describedby="tier1-invite-manage-desc"
          >
            <div
              className="flex items-center justify-between gap-4 p-6 border-b shrink-0"
              style={{ borderColor: '#E0E0E0' }}
            >
              <div>
                <h2
                  id="tier1-invite-manage-title"
                  className="text-2xl font-bold text-gray-900 mb-1"
                >
                  1차협력사 초대 및 관리
                </h2>
                <p id="tier1-invite-manage-desc" className="text-sm text-gray-600">
                  등록된 1차 협력사에게 AIFIX 회원가입 안내 메일을 발송합니다
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTier1InviteManageModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 pb-4 pt-3 md:px-6 md:pb-6 bg-[#F6F8FB]">
              <Invite embedded />
            </div>
          </div>
        </div>
      )}

      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4" style={{ boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.12)' }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">1차 협력사 추가</h2>

            {/* Form */}
            <div className="space-y-4 mb-6">
              {/* Customer / Branch */}
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">고객사</label>
                    <select
                      value={modalCustomer}
                      onChange={(e) => {
                        setModalCustomer(e.target.value);
                        setModalBranch('');
                        setModalProject('');
                        setModalProductGroup('');
                        setModalDetailProduct('');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">선택</option>
                      {customers.map((customer) => (
                        <option key={customer} value={customer}>
                          {customer}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">세부 지사</label>
                    <select
                      value={modalBranch}
                      onChange={(e) => {
                        setModalBranch(e.target.value);
                        setModalProject('');
                        setModalProductGroup('');
                        setModalDetailProduct('');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">선택</option>
                      {modalBranchOptions.map((branch) => (
                        <option key={branch} value={branch}>
                          {branch}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Product / Detail Product / BOM Code */}
              <div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">제품</label>
                    <select
                      value={resolvedModalProductGroup}
                      onChange={(e) => {
                        setModalProductGroup(e.target.value);
                        setModalDetailProduct('');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">선택</option>
                      {modalProductGroups.map((pg) => (
                        <option key={pg.id} value={pg.id}>
                          {pg.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">세부제품</label>
                    <select
                      value={modalDetailProduct}
                      onChange={(e) => setModalDetailProduct(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">선택</option>
                      {modalProductGroups
                        .find(pg => pg.id === resolvedModalProductGroup)
                        ?.detailProducts.map((dp) => (
                        <option key={dp.id} value={dp.id}>
                          {dp.displayName}{dp.description ? ` | ${dp.description}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">BOM 코드</label>
                    <input
                      value={selectedModalBomCode}
                      readOnly
                      placeholder="세부제품을 선택하면 자동으로 표시됩니다"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-700 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Supplier Selection */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">협력사 선택</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="협력사 검색..."
                    value={supplierSearchTerm}
                    onChange={(e) => setSupplierSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {modalSuppliersLoading && (
                    <div className="px-4 py-3 text-sm text-gray-500">협력사 목록 불러오는 중…</div>
                  )}
                  {!modalSuppliersLoading && modalSuppliersError && (
                    <div className="px-4 py-3 text-sm text-red-600">{modalSuppliersError}</div>
                  )}
                  {!modalSuppliersLoading &&
                    !modalSuppliersError &&
                    filteredSuppliers.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        {modalCustomer &&
                        modalBranch &&
                        (modalProductGroup || modalProductGroups[0]?.id) &&
                        !modalDetailProduct
                          ? '제품 기준 SRM 1차 후보입니다. 세부제품을 고르면 이 BOM에 아직 없는 협력사만으로 다시 좁혀집니다.'
                          : modalCustomer && modalBranch && modalDetailProduct
                            ? '이 BOM에 넣을 수 있는 SRM 1차 협력사가 없습니다. (이미 이 트리에 추가됨, 직하위 전용, 또는 미등록)'
                            : '고객사·지사·제품을 선택하면 후보가 표시됩니다.'}
                      </div>
                    )}
                  {!modalSuppliersLoading &&
                    !modalSuppliersError &&
                    filteredSuppliers.map((supplier) => (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => setModalSupplier(String(supplier.id))}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${
                          modalSupplier === String(supplier.id)
                            ? 'bg-purple-50 text-purple-600'
                            : 'text-gray-700'
                        }`}
                      >
                        {supplier.name}
                        {supplier.code ? (
                          <span className="text-sm text-gray-500"> ({supplier.code})</span>
                        ) : null}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddSupplierModal(false);
                  setModalCustomer('');
                  setModalBranch('');
                  setModalProject('');
                  setModalProductGroup('');
                  setModalDetailProduct('');
                  setModalSupplier('');
                  setSupplierSearchTerm('');
                  setModalSuppliers([]);
                  setModalSuppliersError(null);
                }}
                className="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddSupplier}
                className="px-6 py-2.5 text-white font-medium rounded-xl transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                }}
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}