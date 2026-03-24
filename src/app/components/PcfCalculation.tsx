'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, Download, CheckCircle, Clock, AlertTriangle, FileText, Network, TrendingUp, Play, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import MonthPicker from './MonthPicker';
import { useMode } from '../context/ModeContext';

// PCF 산정용 조회 조건 (데이터관리와 동일 구조)
type PcfFilterRow = {
  customer: string;
  branch: string;
  product: string;
  detailProduct: string;
  bomCode: string;
  projectPeriodStart: string;
  projectPeriodEnd: string;
};

// 2025년 1·2분기(1~6월)만 프로젝트 기간으로 설정
const pcfFilterRows: PcfFilterRow[] = [
  { customer: 'A 자동차', branch: '국내사업본부', product: '배터리 모듈 A', detailProduct: '배터리 모듈 A-1 (표준형)', bomCode: 'BOM_A_001', projectPeriodStart: '2025-01', projectPeriodEnd: '2025-06' },
  { customer: 'A 자동차', branch: '국내사업본부', product: '배터리 모듈 A', detailProduct: '배터리 모듈 A-2 (고용량)', bomCode: 'BOM_A_002', projectPeriodStart: '2025-01', projectPeriodEnd: '2025-06' },
  { customer: 'A 자동차', branch: '해외사업본부', product: '배터리 모듈 A', detailProduct: '배터리 모듈 A-1 (표준형)', bomCode: 'BOM_A_001', projectPeriodStart: '2025-01', projectPeriodEnd: '2025-06' },
  { customer: 'A 자동차', branch: '해외사업본부', product: '배터리 모듈 A', detailProduct: '배터리 모듈 A-2 (고용량)', bomCode: 'BOM_A_002', projectPeriodStart: '2025-01', projectPeriodEnd: '2025-06' },
  { customer: 'B 모빌리티', branch: '전동화사업부', product: '전고체 셀', detailProduct: '전고체 셀 60Ah', bomCode: 'BOM_SSC_60', projectPeriodStart: '2025-01', projectPeriodEnd: '2025-06' },
  { customer: 'B 모빌리티', branch: '전동화사업부', product: '전고체 셀', detailProduct: '전고체 셀 80Ah', bomCode: 'BOM_SSC_80', projectPeriodStart: '2025-01', projectPeriodEnd: '2025-06' },
  { customer: 'B 모빌리티', branch: '에너지사업부', product: 'ESS 팩', detailProduct: 'ESS 팩 1MWh', bomCode: 'BOM_ESS_1', projectPeriodStart: '2025-01', projectPeriodEnd: '2025-06' },
  { customer: 'B 모빌리티', branch: '에너지사업부', product: 'ESS 팩', detailProduct: 'ESS 팩 2MWh', bomCode: 'BOM_ESS_2', projectPeriodStart: '2025-01', projectPeriodEnd: '2025-06' },
  { customer: 'C 그룹', branch: 'R&D센터', product: '배터리 모듈 A', detailProduct: '배터리 모듈 A-1 (표준형)', bomCode: 'BOM_A_001', projectPeriodStart: '2025-01', projectPeriodEnd: '2025-06' },
];

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

export default function PcfCalculation() {
  const router = useRouter();
  const { mode } = useMode();
  
  // Selection states (데이터관리 조회조건과 동일)
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedSupplyChain, setSelectedSupplyChain] = useState<string>(mockSupplyChainVersions[0].id);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // 필터 옵션 (고객사 → 지사 → 제품 → 세부제품)
  const customerOptions = useMemo(() => Array.from(new Set(pcfFilterRows.map(r => r.customer))).sort((a, b) => a.localeCompare(b)), []);
  const branchOptions = useMemo(() => Array.from(new Set(pcfFilterRows.filter(r => r.customer === selectedCustomer).map(r => r.branch))).sort((a, b) => a.localeCompare(b)), [selectedCustomer]);
  const productOptions = useMemo(() => Array.from(new Set(pcfFilterRows.filter(r => r.customer === selectedCustomer && r.branch === selectedBranch).map(r => r.product))).sort((a, b) => a.localeCompare(b)), [selectedCustomer, selectedBranch]);
  const detailProductOptions = useMemo(() => pcfFilterRows.filter(r => r.customer === selectedCustomer && r.branch === selectedBranch && r.product === selectedProduct).sort((a, b) => a.detailProduct.localeCompare(b.detailProduct)), [selectedCustomer, selectedBranch, selectedProduct]);
  const selectedDetailMeta = useMemo(() => detailProductOptions.find(r => r.detailProduct === selectedDetailProduct), [detailProductOptions, selectedDetailProduct]);

  // 프로젝트 기간 내 월 목록 (세부제품 선택 시에만)
  const projectPeriodMonths = useMemo((): string[] => {
    if (!selectedDetailMeta) return [];
    const { projectPeriodStart, projectPeriodEnd } = selectedDetailMeta;
    const [sy, sm] = projectPeriodStart.split('-').map(Number);
    const [ey, em] = projectPeriodEnd.split('-').map(Number);
    const months: string[] = [];
    let y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return months;
  }, [selectedDetailMeta]);

  // UI states
  const [expandedStructureNodes, setExpandedStructureNodes] = useState<Set<string>>(new Set());

  // Get selected data (기존 로직 호환)
  const selectedProductData = mockProducts.find(p => p.name === selectedProduct) ?? mockProducts[0];
  const selectedSupplyChainVersion = mockSupplyChainVersions.find(v => v.id === selectedSupplyChain);

  // 데이터 준비 상태 (Mock - 테스트를 위해 다양한 상태 시뮬레이션)
  // 실제 구현 시 API에서 가져올 데이터
  const [dataScenario, setDataScenario] = useState<'complete' | 'partial' | 'none'>('complete');
  
  // 시나리오별 데이터 상태
  const getDataStatus = () => {
    switch (dataScenario) {
      case 'complete':
        return {
          primaryDataComplete: true,
          supplierDataComplete: 12,
          supplierDataTotal: 12,
          averageDqr: 1.6,
        };
      case 'partial':
        return {
          primaryDataComplete: true,
          supplierDataComplete: 9,
          supplierDataTotal: 12,
          averageDqr: 2.1,
        };
      case 'none':
        return {
          primaryDataComplete: false,
          supplierDataComplete: 0,
          supplierDataTotal: 12,
          averageDqr: 0,
        };
      default:
        return {
          primaryDataComplete: true,
          supplierDataComplete: 12,
          supplierDataTotal: 12,
          averageDqr: 1.6,
        };
    }
  };

  const dataStatus = getDataStatus();
  const { primaryDataComplete, supplierDataComplete, supplierDataTotal, averageDqr } = dataStatus;

  // PCF 실행 조건 체크 (고객사·지사·제품·세부제품·프로젝트 기간 내 월 선택 + 데이터 준비)
  const canExecutePcf = 
    selectedCustomer !== '' &&
    selectedBranch !== '' &&
    selectedProduct !== '' &&
    selectedDetailProduct !== '' &&
    selectedMonth != null &&
    projectPeriodMonths.includes(selectedMonth) &&
    primaryDataComplete &&
    supplierDataComplete === supplierDataTotal;

  // 비활성 이유 메시지 생성
  const getDisabledReason = () => {
    if (!primaryDataComplete && supplierDataComplete === 0) {
      return 'PCF 계산을 위해 원청 및 협력사 데이터 입력이 필요합니다.';
    }
    if (!primaryDataComplete) {
      return '원청 데이터 입력이 완료되지 않았습니다.';
    }
    if (supplierDataComplete < supplierDataTotal) {
      return '협력사 데이터 입력이 완료되지 않았습니다.';
    }
    return '';
  };

  const disabledReason = getDisabledReason();

  const handleCalculate = () => {
    if (!canExecutePcf) {
      toast.error('PCF 계산 조건이 충족되지 않았습니다');
      return;
    }
    toast.success('PCF 계산을 실행합니다');
  };

  const handleCompare = () => {
    toast.info('결과 비교 화면을 표시합니다');
  };

  const handleRecalculate = (result: PcfCalculationResult) => {
    toast.info(`${result.calculationId}를 재산정합니다`);
  };

  const handleViewDetail = (result: PcfCalculationResult) => {
    router.push(`/dashboard/pcf-calculation/${result.id}`);
  };

  const toggleStructureNode = (nodeId: string) => {
    const newExpanded = new Set(expandedStructureNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedStructureNodes(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            완료
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
            <Clock className="w-3 h-3" />
            진행중
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
            <Clock className="w-3 h-3" />
            대기
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            오류
          </span>
        );
      default:
        return null;
    }
  };

  const getDataStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">제출완료</span>;
      case 'pending':
        return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">대기중</span>;
      case 'incomplete':
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">미완료</span>;
      default:
        return null;
    }
  };

  // Render supply chain structure recursively (read-only, compact)
  const renderSupplyChainNode = (node: SupplyChainNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedStructureNodes.has(node.id);

    return (
      <div key={node.id} style={{ marginLeft: level > 0 ? '20px' : '0' }}>
        <div className="flex items-center gap-2 py-1.5 text-sm">
          {hasChildren && (
            <button
              onClick={() => toggleStructureNode(node.id)}
              className="p-0.5 hover:bg-gray-200 rounded transition-transform"
              style={{
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          {!hasChildren && <div className="w-4"></div>}
          
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
            node.tier === 1 ? 'bg-blue-100 text-blue-700' :
            node.tier === 2 ? 'bg-cyan-100 text-cyan-700' :
            'bg-teal-100 text-teal-700'
          }`}>
            T{node.tier}
          </span>
          
          <span className="font-medium">{node.companyName}</span>
          <span className="text-xs text-gray-500">({node.country})</span>
          {getDataStatusBadge(node.dataStatus)}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderSupplyChainNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Filter results by status
  const filteredResults = selectedStatus === 'ALL' 
    ? mockCalculationResults 
    : mockCalculationResults.filter(r => r.status === selectedStatus);

  return (
    <div className="space-y-6">
      {/* 1. PCF 산정 대상 선택 (데이터관리 조회조건과 동일 레이아웃) */}
      <div
        className="bg-white p-8"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        <h2 className="text-xl font-semibold mb-6">PCF 산정 대상 선택</h2>

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
                setSelectedMonth(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
            >
              <option value="">선택</option>
              {customerOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
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
                setSelectedMonth(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
              <option value="">선택</option>
              {branchOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">제품</label>
            <select
              value={selectedProduct}
              disabled={!selectedBranch}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                setSelectedDetailProduct('');
                setSelectedMonth(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
              <option value="">선택</option>
              {productOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
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
                setSelectedMonth(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
              <option value="">선택</option>
              {detailProductOptions.map((d) => (
                <option key={d.detailProduct} value={d.detailProduct}>{d.detailProduct}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">BOM Code</label>
            <div className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-gray-700">
              {selectedDetailMeta?.bomCode || '-'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              프로젝트 기간 <span style={{ color: '#EF4444' }}>*</span>
              <span className="block text-xs font-normal text-gray-500 mt-0.5">세부제품 선택 시 해당 제품 기간 내 월 선택</span>
            </label>
            <MonthPicker
              selectedMonth={selectedMonth}
              onChange={setSelectedMonth}
              placeholder="세부제품 선택 시 선택 가능"
              enabledMonths={projectPeriodMonths}
              disabled={!selectedDetailProduct}
            />
          </div>
        </div>
      </div>

      {/* 2. 데이터 준비 상태 카드 */}
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

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-2">원청 데이터</div>
            <div className="flex items-center gap-2">
              {primaryDataComplete ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-bold text-green-600">완료</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="font-bold text-red-600">미입력</span>
                </>
              )}
            </div>
          </div>

          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-2">협력사 데이터</div>
            <div className="flex items-center gap-2">
              {supplierDataComplete === supplierDataTotal ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-bold text-green-600">
                    {supplierDataComplete} / {supplierDataTotal} 완료
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
          </div>

          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-2">데이터 커버리지</div>
            <div className="font-bold text-lg text-[#00B4FF]">
              {selectedSupplyChainVersion?.dataCoverage}%
            </div>
          </div>

          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-2">평균 DQR</div>
            <div className={`font-bold text-lg ${
              averageDqr === 0 ? 'text-gray-400' :
              averageDqr <= 1.5 ? 'text-green-600' :
              averageDqr <= 2.0 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {averageDqr === 0 ? '-' : averageDqr.toFixed(1)}
            </div>
          </div>
        </div>

        {/* 데이터 준비 상태 안내 메시지 */}
        {!canExecutePcf && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              {disabledReason}
            </div>
          </div>
        )}

        {/* PCF 계산 실행 버튼 */}
        <div className="mt-4 flex gap-2 items-center">
          <div className="relative group">
            <button
              onClick={handleCalculate}
              disabled={!canExecutePcf || mode === 'procurement'}
              className={`px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-all ${
                canExecutePcf && mode === 'pcf'
                  ? 'text-white'
                  : 'text-gray-400 bg-gray-200 cursor-not-allowed'
              }`}
              style={canExecutePcf && mode === 'pcf' ? {
                background: 'linear-gradient(90deg, #00B4FF 0%, #5B3BFA 100%)',
              } : {}}
            >
              <Play className="w-5 h-5" />
              PCF 계산 실행
            </button>
            
            {/* Tooltip - 비활성 상태일 때만 표시 */}
            {(!canExecutePcf || mode === 'procurement') && (
              <div className="invisible group-hover:visible absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-10">
                {mode === 'procurement' ? '구매 직무에서는 PCF 계산 실행 권한이 없습니다' : disabledReason}
                <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>

          <button
            onClick={handleCompare}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-white flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            결과 비교
          </button>

          {/* 테스트용 시나리오 전환 버튼 (개발용) */}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setDataScenario('complete')}
              className={`px-3 py-1.5 text-xs rounded ${
                dataScenario === 'complete'
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-300'
              }`}
            >
              완료
            </button>
            <button
              onClick={() => setDataScenario('partial')}
              className={`px-3 py-1.5 text-xs rounded ${
                dataScenario === 'partial'
                  ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-300'
              }`}
            >
              부분 완료
            </button>
            <button
              onClick={() => setDataScenario('none')}
              className={`px-3 py-1.5 text-xs rounded ${
                dataScenario === 'none'
                  ? 'bg-red-100 text-red-700 border border-red-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-300'
              }`}
            >
              미완료
            </button>
          </div>
        </div>
      </div>

      {/* 3. PCF 계산 결과 이력 */}
      <div
        className="bg-white"
        style={{
          borderRadius: '16px',
          boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#00B4FF]" />
              <h2 className="text-lg font-bold">PCF 계산 결과 이력</h2>
              <span className="text-xs text-gray-500 ml-2">※ 과거에 수행된 PCF 계산 기록(버전 이력)</span>
            </div>
            <div className="flex gap-2">
              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00B4FF]"
                >
                  <option value="ALL">전체</option>
                  <option value="completed">완료</option>
                  <option value="in_progress">진행중</option>
                  <option value="pending">대기</option>
                  <option value="error">오류</option>
                </select>
              </div>
              <button
                onClick={() => toast.success('결과를 엑셀로 다운로드합니다')}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                결과 다운로드
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F0F9FF] border-b border-blue-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold">PCF 계산 ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">제품</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">공급망 버전</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">BOM 버전</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">산정 기간</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">데이터 커버리지</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">평균 DQR</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">총 배출량</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">산정 상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result, idx) => (
                <tr key={result.id} className={`border-b border-gray-100 hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 text-sm font-mono text-[#00B4FF] font-medium">{result.calculationId}</td>
                  <td className="px-4 py-3 text-sm font-medium">{result.productName}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{result.supplyChainVersion}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{result.mbomVersion}</td>
                  <td className="px-4 py-3 text-xs">{result.period}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-semibold text-green-600">{result.coverage}%</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`font-semibold ${
                      result.averageDqr <= 1.5 ? 'text-green-600' :
                      result.averageDqr <= 2.0 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {result.averageDqr.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold">{result.totalEmission.toLocaleString()} kg CO₂e</td>
                  <td className="px-4 py-3">{getStatusBadge(result.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleViewDetail(result)}
                        className="px-2 py-1 text-xs text-[#00B4FF] border border-[#00B4FF] rounded hover:bg-blue-50"
                      >
                        상세보기
                      </button>
                      {mode === 'pcf' && (
                        <button
                          onClick={() => handleRecalculate(result)}
                          className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                        >
                          재산정
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}