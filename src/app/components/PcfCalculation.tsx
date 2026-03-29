'use client';

import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Download, CheckCircle, Clock, AlertTriangle, FileText, Network, TrendingUp, Play, Info, X, Calculator, History, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
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
  
  // Selection states
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<string>('');
  const [selectedBomCode, setSelectedBomCode] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // 필터 옵션
  const customerOptions = useMemo(() => Array.from(new Set(pcfFilterRows.map(r => r.customer))).sort((a, b) => a.localeCompare(b)), []);
  const branchOptions = useMemo(() => Array.from(new Set(pcfFilterRows.filter(r => r.customer === selectedCustomer).map(r => r.branch))).sort((a, b) => a.localeCompare(b)), [selectedCustomer]);
  const productOptions = useMemo(() => Array.from(new Set(pcfFilterRows.filter(r => r.customer === selectedCustomer && r.branch === selectedBranch).map(r => r.product))).sort((a, b) => a.localeCompare(b)), [selectedCustomer, selectedBranch]);
  const detailProductOptions = useMemo(() => pcfFilterRows.filter(r => r.customer === selectedCustomer && r.branch === selectedBranch && r.product === selectedProduct).sort((a, b) => a.detailProduct.localeCompare(b.detailProduct)), [selectedCustomer, selectedBranch, selectedProduct]);
  const selectedDetailMeta = useMemo(() => detailProductOptions.find(r => r.detailProduct === selectedDetailProduct), [detailProductOptions, selectedDetailProduct]);

  // 프로젝트 기간 내 월 목록
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

  // 데이터 준비 상태 (시뮬레이션)
  const [dataScenario, setDataScenario] = useState<'primary_only' | 'complete'>('primary_only');
  
  const getDataStatus = () => {
    switch (dataScenario) {
      case 'primary_only':
        return {
          primaryDataComplete: true,
          supplierDataComplete: 8,
          supplierDataTotal: 12,
          missingSuppliers: 4,
        };
      case 'complete':
        return {
          primaryDataComplete: true,
          supplierDataComplete: 12,
          supplierDataTotal: 12,
          missingSuppliers: 0,
        };
      default:
        return {
          primaryDataComplete: true,
          supplierDataComplete: 12,
          supplierDataTotal: 12,
          missingSuppliers: 0,
        };
    }
  };

  const dataStatus = getDataStatus();
  const { primaryDataComplete, supplierDataComplete, supplierDataTotal, missingSuppliers } = dataStatus;
  const isTargetSelectionComplete =
    selectedCustomer !== '' &&
    selectedBranch !== '' &&
    selectedProduct !== '' &&
    selectedDetailProduct !== '' &&
    selectedBomCode !== '' &&
    selectedMonth != null &&
    projectPeriodMonths.includes(selectedMonth);

  // 부분산정/최종산정 가능 여부
  const canPartialCalculate = 
    selectedCustomer !== '' &&
    selectedBranch !== '' &&
    selectedProduct !== '' &&
    selectedDetailProduct !== '' &&
    selectedMonth != null &&
    projectPeriodMonths.includes(selectedMonth) &&
    primaryDataComplete;

  const canFinalCalculate = 
    canPartialCalculate &&
    supplierDataComplete === supplierDataTotal;

  // 계산 결과 표시 상태
  const [showResult, setShowResult] = useState(false);
  const [currentResult, setCurrentResult] = useState<'partial' | 'final' | null>(null);

  // 트리 테이블 확장 상태
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set(['prime']));

  // 계산식 드로어 상태
  const [detailDrawer, setDetailDrawer] = useState<{open: boolean; companyId: string | null}>({
    open: false,
    companyId: null,
  });

  // 드로어 아코디언 상태
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['material', 'energy', 'transport', 'supplier']));

  // 히스토리 상세보기 모달 상태
  const [historyDetailModal, setHistoryDetailModal] = useState<{open: boolean; historyId: string | null}>({
    open: false,
    historyId: null,
  });
  const [isHistoryDownloadSelecting, setIsHistoryDownloadSelecting] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

  // 부분산정 불러오기 선택
  const [selectedPartialHistory, setSelectedPartialHistory] = useState<string>('');

  // Mock 계산 이력
  const mockHistories: CalculationHistory[] = useMemo(() => [
    {
      id: 'hist-1',
      calculationType: 'final',
      calculationDate: '2025-02-15 14:32',
      targetSummary: 'A 자동차 / 국내사업본부 / 배터리 모듈 A / A-1 / BOM_A_001 / 2025-02',
      status: 'final_completed',
      productPcf: 32420.3,
      kgPcf: 0.6484,
      executor: '김철수',
    },
    {
      id: 'hist-2',
      calculationType: 'partial',
      calculationDate: '2025-02-10 10:15',
      targetSummary: 'A 자동차 / 국내사업본부 / 배터리 모듈 A / A-1 / BOM_A_001 / 2025-02',
      status: 'partial_saved',
      productPcf: 8105.0,
      kgPcf: 0.1621,
      executor: '김철수',
    },
    {
      id: 'hist-3',
      calculationType: 'final',
      calculationDate: '2025-01-28 16:20',
      targetSummary: 'A 자동차 / 국내사업본부 / 배터리 모듈 A / A-1 / BOM_A_001 / 2025-01',
      status: 'final_completed',
      productPcf: 31850.7,
      kgPcf: 0.6370,
      executor: '이영희',
    },
  ], []);

  // 부분산정 실행
  const handlePartialCalculate = () => {
    if (!canPartialCalculate) {
      toast.error('부분산정 조건이 충족되지 않았습니다');
      return;
    }
    setCurrentResult('partial');
    setShowResult(true);
    toast.success('부분산정을 실행합니다 (자사 데이터만 반영)');
  };

  // 최종산정 실행
  const handleFinalCalculate = () => {
    if (!canFinalCalculate) {
      toast.error('최종산정 조건이 충족되지 않았습니다');
      return;
    }
    setCurrentResult('final');
    setShowResult(true);
    toast.success('최종 PCF 산정을 실행합니다');
  };

  // 부분산정 불러오기
  const handleLoadPartialHistory = () => {
    if (!selectedPartialHistory) {
      toast.error('불러올 부분산정 기록을 선택해주세요');
      return;
    }
    toast.info('부분산정 기록을 불러왔습니다');
  };

  // 미입력 협력사 요청
  const handleRequestMissingSuppliers = () => {
    toast.info(`미입력 협력사 ${missingSuppliers}곳에 데이터 제출 요청을 발송합니다`);
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
    if (selectedHistoryIds.size === mockHistories.length) {
      setSelectedHistoryIds(new Set());
      return;
    }
    setSelectedHistoryIds(new Set(mockHistories.map((h) => h.id)));
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

    const selectedRows = mockHistories.filter((h) => selectedHistoryIds.has(h.id));
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

  const mockCompanyResults: CompanyResult[] = useMemo(() => {
    if (currentResult === 'partial') {
      // 부분산정: 자사만 데이터 있음
      return [
        {
          id: 'prime',
          companyName: 'LG에너지솔루션 (원청사)',
          tier: 0,
          ownEmission: 8105.0,
          supplierEmission: 0,
          transportEmission: 0,
          finalPcf: 8105.0,
          status: 'partial',
        },
      ];
    } else if (currentResult === 'final') {
      // 최종산정: 전체 공급망 데이터
      return [
        {
          id: 'prime',
          companyName: 'LG에너지솔루션 (원청사)',
          tier: 0,
          ownEmission: 8105.0,
          supplierEmission: 22315.3,
          transportEmission: 2000.0,
          finalPcf: 32420.3,
          status: 'final',
          children: [
            {
              id: 'tier1-1',
              companyName: '한국배터리',
              tier: 1,
              ownEmission: 4200.0,
              supplierEmission: 10800.8,
              transportEmission: 200.0,
              finalPcf: 15200.8,
              status: 'final',
              children: [
                {
                  id: 'tier2-1',
                  companyName: '셀테크',
                  tier: 2,
                  ownEmission: 5300.0,
                  supplierEmission: 3000.0,
                  transportEmission: 200.0,
                  finalPcf: 8500.0,
                  status: 'final',
                  children: [
                    {
                      id: 'tier3-1',
                      companyName: '리튬소재',
                      tier: 3,
                      ownEmission: 3200.0,
                      supplierEmission: 0,
                      transportEmission: 0,
                      finalPcf: 3200.0,
                      status: 'final',
                    },
                  ],
                },
                {
                  id: 'tier2-2',
                  companyName: '글로벌소재',
                  tier: 2,
                  ownEmission: 4000.3,
                  supplierEmission: 0,
                  transportEmission: 200.0,
                  finalPcf: 4200.3,
                  status: 'final',
                },
              ],
            },
            {
              id: 'tier1-2',
              companyName: '파워셀 테크놀로지',
              tier: 1,
              ownEmission: 3600.0,
              supplierEmission: 2000.0,
              transportEmission: 200.0,
              finalPcf: 5800.0,
              status: 'final',
              children: [
                {
                  id: 'tier2-3',
                  companyName: '아시아소재',
                  tier: 2,
                  ownEmission: 2000.0,
                  supplierEmission: 0,
                  transportEmission: 200.0,
                  finalPcf: 2200.0,
                  status: 'final',
                },
              ],
            },
          ],
        },
      ];
    }
    return [];
  }, [currentResult]);

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
          className={`grid grid-cols-12 px-4 py-3 border-b border-gray-100 text-sm ${
            isPrime ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50 cursor-pointer'
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
          className={`px-6 py-3 text-xl font-semibold transition-all ${
            activeTab === 'calculation'
              ? 'border-b-2 border-[#00B4FF] text-[#00B4FF]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calculator className="w-4 h-4 inline-block mr-2" />
          계산
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 text-xl font-semibold transition-all ${
            activeTab === 'history'
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
                  onChange={(e) => {
                    setSelectedCustomer(e.target.value);
                    setSelectedBranch('');
                    setSelectedProduct('');
                    setSelectedDetailProduct('');
                    setSelectedBomCode('');
                    setSelectedMonth(null);
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                >
                  <option value="">고객사를 선택하세요</option>
                  {customerOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">세부지사</label>
                <select
                  value={selectedBranch}
                  disabled={!selectedCustomer}
                  onChange={(e) => {
                    setSelectedBranch(e.target.value);
                    setSelectedProduct('');
                    setSelectedDetailProduct('');
                    setSelectedBomCode('');
                    setSelectedMonth(null);
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
                >
                  <option value="">세부지사를 선택하세요</option>
                  {branchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
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
                    setSelectedBomCode('');
                    setSelectedMonth(null);
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
                >
                  <option value="">제품을 선택하세요</option>
                  {productOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
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
                    const val = e.target.value;
                    setSelectedDetailProduct(val);
                    const meta = detailProductOptions.find((d) => d.detailProduct === val);
                    setSelectedBomCode(meta?.bomCode || '');
                    setSelectedMonth(null);
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
                >
                  <option value="">세부제품을 선택하세요</option>
                  {detailProductOptions.map((d) => (
                    <option key={d.detailProduct} value={d.detailProduct}>
                      {d.detailProduct}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">BOM Code</label>
                <div className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-gray-700">
                  {selectedBomCode || '-'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  기간(월) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <MonthPicker
                  selectedMonth={selectedMonth}
                  onChange={setSelectedMonth}
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
                  {selectedCustomer} / {selectedBranch} / {selectedProduct} / {selectedDetailProduct} / {selectedBomCode} / {selectedMonth}
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
                  {primaryDataComplete ? (
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
              </div>

              <div className="bg-white/70 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-2">하위 협력사 데이터 제출 현황</div>
                <div className="flex items-center gap-2">
                  {supplierDataComplete === supplierDataTotal ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-bold text-green-600">
                        {supplierDataComplete} / {supplierDataTotal}
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
                <span className="font-bold text-red-700 text-lg">{missingSuppliers}곳</span>
                <button
                  onClick={handleRequestMissingSuppliers}
                  disabled={missingSuppliers === 0}
                  className="px-3 py-1.5 text-xs border border-[#00B4FF] text-[#00B4FF] rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  미입력 협력사 요청
                </button>
              </div>
            </div>

            {/* 테스트용 시나리오 전환 버튼 */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDataScenario('primary_only')}
                className={`px-3 py-1.5 text-xs rounded ${
                  dataScenario === 'primary_only'
                    ? 'bg-orange-100 text-orange-700 border border-orange-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                자사만 준비
              </button>
              <button
                onClick={() => setDataScenario('complete')}
                className={`px-3 py-1.5 text-xs rounded ${
                  dataScenario === 'complete'
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                전체 준비
              </button>
            </div>
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
                  disabled={!canPartialCalculate}
                  className={`w-full px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                    canPartialCalculate
                      ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white hover:scale-105'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-5 h-5" />
                  부분산정 실행
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
                  className={`w-full px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                    canFinalCalculate
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
                {mockHistories
                  .filter((h) => h.calculationType === 'partial')
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.calculationDate} - {h.targetSummary.split(' / ').slice(-1)[0]} (제품 PCF:{' '}
                      {h.productPcf.toLocaleString()} kgCO₂e)
                    </option>
                  ))}
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
                      {(mockCompanyResults[0].finalPcf / 50000).toFixed(4)} kgCO₂e/kg
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
                        checked={selectedHistoryIds.size === mockHistories.length && mockHistories.length > 0}
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
                {mockHistories.map((hist, idx) => (
                  <tr
                    key={hist.id}
                    className={`border-b border-gray-100 hover:bg-blue-50 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
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

          {mockHistories.length === 0 && (
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
        const history = mockHistories.find(h => h.id === historyDetailModal.historyId);
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