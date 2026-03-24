'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Search, Check, Minus, X } from 'lucide-react';
import { toast } from 'sonner';
import SupplyChainDiagram from './SupplyChainDiagram';
import { useMode } from '../context/ModeContext';

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

// Mock supplier list for adding tier 1 suppliers
const mockSupplierList = [
  { id: 'sup-1', name: '한국배터리', nameEn: 'Korea Battery' },
  { id: 'sup-2', name: '글로벌소재', nameEn: 'Global Materials' },
  { id: 'sup-3', name: '아시아화학', nameEn: 'Asia Chemical' },
  { id: 'sup-4', name: '유럽전지', nameEn: 'Euro Battery' },
  { id: 'sup-5', name: '일본셀', nameEn: 'Japan Cell' },
];

const LS_REGISTERED_TIER1_SUPPLIERS_KEY = 'aifix_mock_registered_tier1_suppliers_v1';

export default function ProjectSupplyChain() {
  const { mode } = useMode();
  const isProcurementView = mode === 'procurement'; // 1차 협력사 추가는 구매 직무에서만 가능

  // Filter states
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  // '' = 선택, 'ALL' = 전체(모든 제품) - 기본값 ALL
  const [selectedProductFilterCode, setSelectedProductFilterCode] = useState<string>('ALL');
  
  // UI states
  const [hasQueried, setHasQueried] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['tier0-1']));
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
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

  // Get unique customers (ALL 제외, 오름차순)
  const customers = Array.from(new Set(mockProjects.map(p => p.customerName))).sort((a, b) => a.localeCompare(b));
  
  // Get branches for selected customer (unique)
  const branches = !selectedCustomer
    ? ['ALL']
    : ['ALL', ...Array.from(new Set(mockProjects.filter(p => p.customerName === selectedCustomer).map(p => p.branchName))).sort((a, b) => a.localeCompare(b))];

  // Scope projects: 고객사 필수, 세부지사 ALL이면 해당 고객사 전체 지사의 프로젝트 포함
  const scopedProjects = !selectedCustomer
    ? []
    : selectedBranch === 'ALL'
      ? mockProjects.filter(p => p.customerName === selectedCustomer)
      : mockProjects.filter(p => p.customerName === selectedCustomer && p.branchName === selectedBranch);

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
    if (!selectedCustomer) {
      toast.error('고객사를 선택해주세요');
      return;
    }
    if (!selectedProductFilterCode || selectedProductFilterCode === '') {
      toast.error('제품을 선택해주세요');
      return;
    }
    if (productGroups.length === 0) {
      toast.error('선택 가능한 제품이 없습니다');
      return;
    }
    setHasQueried(true);
    setSelectedProductCode(productGroups[0].productCode);
    setSelectedProductItemCode('ALL');
    toast.success('조회가 완료되었습니다');
  };

  const openAddSupplierModal = () => {
    // 현재 조회 필터를 모달 초기값으로 연결 (유효한 값만 반영)
    const nextCustomer = selectedCustomer || '';
    const nextBranch = selectedBranch !== 'ALL' ? selectedBranch : '';

    const candidateProjects = nextCustomer && nextBranch
      ? mockProjects.filter((p) => p.customerName === nextCustomer && p.branchName === nextBranch)
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

  const handleAddSupplier = () => {
    const resolvedModalProject = modalProject || modalProjects[0]?.id || '';
    if (!modalCustomer || !modalBranch || !resolvedModalProject || !modalProductGroup || !modalSupplier) {
      toast.error('모든 항목을 선택해주세요');
      return;
    }
    // 초대메일 화면에서 "프로젝트/공급망 탭에서 등록된 1차 협력사"만 선택할 수 있도록
    // 등록 상태를 localStorage에 저장합니다.
    const selected = mockSupplierList.find(s => s.id === modalSupplier);
    try {
      if (selected) {
        const prevRaw = localStorage.getItem(LS_REGISTERED_TIER1_SUPPLIERS_KEY);
        const prev = (prevRaw ? JSON.parse(prevRaw) : []) as Array<{ id: string; name: string; nameEn: string }>;
        const exists = prev.some(p => p.id === selected.id);
        const next = exists ? prev : [...prev, { id: selected.id, name: selected.name, nameEn: selected.nameEn }];
        localStorage.setItem(LS_REGISTERED_TIER1_SUPPLIERS_KEY, JSON.stringify(next));
      }
    } catch {
      // localStorage 실패해도 UX 흐름은 유지합니다.
    }

    toast.success('1차 협력사가 추가되었습니다');
    setShowAddSupplierModal(false);
    // Reset modal states
    setModalCustomer('');
    setModalBranch('');
    setModalProject('');
    setModalProductGroup('');
    setModalDetailProduct('');
    setModalSupplier('');
    setSupplierSearchTerm('');
  };

  // Modal: projects for selected customer+branch
  const modalProjects = mockProjects.filter(
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

  const filteredSuppliers = mockSupplierList.filter(supplier =>
    supplier.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
    supplier.nameEn.toLowerCase().includes(supplierSearchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">프로젝트 / 공급망 관리</h1>
            <p className="text-gray-600">프로젝트 단위로 공급망 구조와 BOM 기반 협력사 구성을 관리합니다.</p>
          </div>
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
        </div>

        {/* Filter Section - Only Project-level filters */}
        <div className="bg-white rounded-2xl p-6 mb-6" style={{ boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.05)' }}>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Customer */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">고객사 <span style={{ color: '#EF4444' }}>*</span></label>
              <select
                value={selectedCustomer}
                onChange={(e) => {
                  setSelectedCustomer(e.target.value);
                  setSelectedBranch('ALL');
                  setSelectedProductFilterCode('ALL');
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">선택</option>
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
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  setSelectedProductFilterCode('ALL');
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
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
                {productGroupsUnion.map((pg) => (
                  <option key={pg.productCode} value={pg.productCode}>
                    {pg.name} ({pg.productCode})
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
                  Branch: {selectedBranch !== 'ALL' ? selectedBranch : '-'}
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
                  {/* Detail Product Selector - 제품 탭에 연동 */}
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
            <p className="text-gray-500">조회 조건을 선택하고 조회하기 버튼을 클릭하세요</p>
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
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
                      {branches.filter(b => b !== 'ALL').map((branch) => (
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
                  {filteredSuppliers.map((supplier) => (
                    <button
                      key={supplier.id}
                      onClick={() => setModalSupplier(supplier.id)}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${
                        modalSupplier === supplier.id ? 'bg-purple-50 text-purple-600' : 'text-gray-700'
                      }`}
                    >
                      {supplier.name} <span className="text-sm text-gray-500">({supplier.nameEn})</span>
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