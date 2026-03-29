'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Search, Download, Upload, FileText, Filter, AlertTriangle, CheckCircle, Clock, MapPin, Folder, Info, Settings, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import ExportReportModal from './ExportReportModal';
import ProcurementDetailModal from './ProcurementDetailModal';
import PcfDetailModal from './PcfDetailModal';
import MonthRangePicker from './MonthRangePicker';
import SupplyChainVersionModal from './SupplyChainVersionModal';
import { useMode } from '../context/ModeContext';

// Unified data structure - contains both procurement and PCF data
interface DataNode {
  id: string;
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

// 협력사 포털 공급망 구조와 동일 (우리회사 → 동우전자부품/한국소재산업/테크놀로지파트너스 → 하위 2차/3차)
const getSampleSupplyChainTree = (cardId: string, month: string): DataNode => {
  const prefix = `${cardId}-${month}`;
  const base = (opts: Partial<DataNode> & { tier: string; companyName: string; companyNameEn: string; country?: string; productType: string }) =>
    ({ companyType: 'Supplier' as const, deliveryVolume: 10000, pcfResult: 0, emissionIntensity: 0.5, dataSubmissionStatus: 'submitted' as const, verificationStatus: 'verified' as const, riskLevel: 'low' as const, dataInputStatus: 'completed' as const, pcfCalculationStatus: 'verified' as const, submissionStatus: 'verified' as const, lastUpdate: '2026-03-01', emissionSource: 'Internal DB', rawMaterialInput: 10000, ...opts, country: opts.country ?? 'South Korea' });

  return {
    id: `${prefix}-tier0`,
    tier: 'Tier 0',
    companyName: '우리회사',
    companyNameEn: 'Our Company',
    country: 'South Korea',
    companyType: 'Operator',
    deliveryVolume: 50000,
    rawMaterialInput: 30000,
    productType: '배터리 모듈',
    emissionSource: 'Internal DB',
    pcfResult: 32420.3,
    emissionIntensity: 0.6484,
    dataSubmissionStatus: 'submitted',
    verificationStatus: 'verified',
    riskLevel: 'low',
    dataInputStatus: 'completed',
    pcfCalculationStatus: 'verified',
    submissionStatus: 'verified',
    lastUpdate: '2026-03-01',
    children: [
      {
        ...base({ tier: 'Tier 1', companyName: '동우전자부품', companyNameEn: 'Dongwoo Electronic Components', productType: '전자부품', deliveryVolume: 25000, pcfResult: 18200, emissionIntensity: 0.73 }),
        id: `${prefix}-tier1-1`,
        children: [
          {
            ...base({ tier: 'Tier 2', companyName: '세진케미칼', companyNameEn: 'Sejin Chemical', productType: '케미칼 소재', deliveryVolume: 15000, pcfResult: 8500, emissionIntensity: 0.57 }),
            id: `${prefix}-tier2-1`,
            verificationStatus: 'not-verified',
            pcfCalculationStatus: 'submitted',
            submissionStatus: 'submitted',
            children: [
              { ...base({ tier: 'Tier 3', companyName: '디오케미칼', companyNameEn: 'Dio Chemical', productType: '원료', country: 'South Korea', deliveryVolume: 8000, pcfResult: null, emissionIntensity: null, dataSubmissionStatus: 'not-submitted', pcfCalculationStatus: 'pending', submissionStatus: 'pending' }), id: `${prefix}-tier3-1`, children: undefined },
              { ...base({ tier: 'Tier 3', companyName: '솔브런트', companyNameEn: 'Solvrent', productType: '용매', country: 'South Korea', deliveryVolume: 7000, pcfResult: 3200, emissionIntensity: 0.46 }), id: `${prefix}-tier3-2`, children: undefined },
            ],
          },
          { ...base({ tier: 'Tier 2', companyName: '그린에너지솔루션', companyNameEn: 'Green Energy Solution', productType: '에너지 부품', deliveryVolume: 10000, pcfResult: 4200, emissionIntensity: 0.42 }), id: `${prefix}-tier2-2`, children: undefined },
        ],
      },
      {
        ...base({ tier: 'Tier 1', companyName: '한국소재산업', companyNameEn: 'Korea Material Industry', productType: '소재', deliveryVolume: 18000, pcfResult: 9500, emissionIntensity: 0.53 }),
        id: `${prefix}-tier1-2`,
        verificationStatus: 'not-verified',
        children: [
          { ...base({ tier: 'Tier 2', companyName: '글로벌메탈', companyNameEn: 'Global Metal', productType: '금속 소재', country: 'Germany', deliveryVolume: 8000, pcfResult: 4100 }), id: `${prefix}-tier2-3`, children: undefined },
          { ...base({ tier: 'Tier 2', companyName: '에코플라스틱', companyNameEn: 'Eco Plastic', productType: '플라스틱', deliveryVolume: 6000, pcfResult: 2800 }), id: `${prefix}-tier2-4`, children: undefined },
          { ...base({ tier: 'Tier 2', companyName: '바이오소재연구소', companyNameEn: 'Bio Material Research Institute', productType: '바이오 소재', deliveryVolume: 4000, pcfResult: null, emissionIntensity: null, dataSubmissionStatus: 'not-submitted', pcfCalculationStatus: 'pending', submissionStatus: 'pending' }), id: `${prefix}-tier2-5`, children: undefined },
        ],
      },
      {
        ...base({ tier: 'Tier 1', companyName: '테크놀로지파트너스', companyNameEn: 'Technology Partners', productType: '기술 부품', deliveryVolume: 7000, pcfResult: 3120, emissionIntensity: 0.45 }),
        id: `${prefix}-tier1-3`,
        children: undefined,
      },
    ],
  };
};


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

  type FilterRow = {
    customer: string;
    branch: string;
    site: string;
    factory: string;
    product: string;
    detailProduct: string;
    bomCode: string;
    projectPeriodLabel: string;
    projectPeriodStart: string;
    projectPeriodEnd: string;
  };

  // 고객사-지사-제품-세부제품 체인 (프로젝트/공급망 탭과 동일, 고객사별 고유 제품명)
  const filterRows: FilterRow[] = [
    // BMW / BMW Munich
    { customer: 'BMW', branch: 'BMW Munich', site: '유럽 사업장', factory: 'Munich 1공장', product: 'BMW iX5 ESS 팩', detailProduct: 'BMW-X5-001 | ESS 기본형', bomCode: 'BOM_BMW_X5_001', projectPeriodLabel: '2026.01 ~ 2026.12', projectPeriodStart: '2026-01', projectPeriodEnd: '2026-12' },
    // Audi / Audi Germany
    { customer: 'Audi', branch: 'Audi Germany', site: '유럽 사업장', factory: 'Ingolstadt 1공장', product: 'Audi 배터리 모듈 A', detailProduct: 'AU-A-001 | 기본형', bomCode: 'BOM_AUDI_A_001', projectPeriodLabel: '2026.01 ~ 2026.12', projectPeriodStart: '2026-01', projectPeriodEnd: '2026-12' },
    { customer: 'Audi', branch: 'Audi Germany', site: '유럽 사업장', factory: 'Ingolstadt 1공장', product: 'Audi 배터리 모듈 A', detailProduct: 'AU-A-002 | LFP 적용', bomCode: 'BOM_AUDI_A_002', projectPeriodLabel: '2026.01 ~ 2026.12', projectPeriodStart: '2026-01', projectPeriodEnd: '2026-12' },
    { customer: 'Audi', branch: 'Audi Germany', site: '유럽 사업장', factory: 'Ingolstadt 1공장', product: 'Audi 배터리 모듈 A', detailProduct: 'AU-A-003 | 고에너지밀도', bomCode: 'BOM_AUDI_A_003', projectPeriodLabel: '2026.01 ~ 2026.12', projectPeriodStart: '2026-01', projectPeriodEnd: '2026-12' },
    { customer: 'Audi', branch: 'Audi Germany', site: '유럽 사업장', factory: 'Ingolstadt 1공장', product: 'Audi 배터리 모듈 B', detailProduct: 'AU-B-001 | NCM 적용', bomCode: 'BOM_AUDI_B_001', projectPeriodLabel: '2026.01 ~ 2026.12', projectPeriodStart: '2026-01', projectPeriodEnd: '2026-12' },
    { customer: 'Audi', branch: 'Audi Germany', site: '유럽 사업장', factory: 'Ingolstadt 1공장', product: 'Audi 배터리 모듈 B', detailProduct: 'AU-B-002 | 고출력형', bomCode: 'BOM_AUDI_B_002', projectPeriodLabel: '2026.01 ~ 2026.12', projectPeriodStart: '2026-01', projectPeriodEnd: '2026-12' },
    // Mercedes-Benz / Mercedes Germany
    { customer: 'Mercedes-Benz', branch: 'Mercedes Germany', site: '유럽 사업장', factory: 'Berlin 2공장', product: 'Mercedes EQ 배터리 모듈', detailProduct: 'MB-EQ-001 | 기본형', bomCode: 'BOM_MB_EQ_001', projectPeriodLabel: '2026.04 ~ 2027.03', projectPeriodStart: '2026-04', projectPeriodEnd: '2027-03' },
    { customer: 'Mercedes-Benz', branch: 'Mercedes Germany', site: '유럽 사업장', factory: 'Berlin 2공장', product: 'Mercedes EQ 배터리 모듈', detailProduct: 'MB-EQ-002 | LFP 적용', bomCode: 'BOM_MB_EQ_002', projectPeriodLabel: '2026.04 ~ 2027.03', projectPeriodStart: '2026-04', projectPeriodEnd: '2027-03' },
    { customer: 'Mercedes-Benz', branch: 'Mercedes Germany', site: '유럽 사업장', factory: 'Berlin 2공장', product: 'Mercedes EQ 배터리 모듈', detailProduct: 'MB-EQ-003 | 고에너지밀도', bomCode: 'BOM_MB_EQ_003', projectPeriodLabel: '2026.04 ~ 2027.03', projectPeriodStart: '2026-04', projectPeriodEnd: '2027-03' },
    { customer: 'Mercedes-Benz', branch: 'Mercedes Germany', site: '유럽 사업장', factory: 'Berlin 2공장', product: 'Mercedes 전고체 셀', detailProduct: 'MB-SS-001 | NCM 적용', bomCode: 'BOM_MB_SS_001', projectPeriodLabel: '2026.04 ~ 2027.03', projectPeriodStart: '2026-04', projectPeriodEnd: '2027-03' },
    { customer: 'Mercedes-Benz', branch: 'Mercedes Germany', site: '유럽 사업장', factory: 'Berlin 2공장', product: 'Mercedes 전고체 셀', detailProduct: 'MB-SS-002 | 고출력형', bomCode: 'BOM_MB_SS_002', projectPeriodLabel: '2026.04 ~ 2027.03', projectPeriodStart: '2026-04', projectPeriodEnd: '2027-03' },
    { customer: 'Mercedes-Benz', branch: 'Mercedes Germany', site: '유럽 사업장', factory: 'Berlin 2공장', product: 'Mercedes ESS 팩', detailProduct: 'MB-ESS-001 | ESS 기본형', bomCode: 'BOM_MB_ESS_001', projectPeriodLabel: '2026.04 ~ 2027.03', projectPeriodStart: '2026-04', projectPeriodEnd: '2027-03' },
  ];

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

  const customerOptions = useMemo(
    () => Array.from(new Set(filterRows.map((row) => row.customer))).sort((a, b) => a.localeCompare(b)),
    [filterRows]
  );
  const branchOptions = useMemo(
    () => Array.from(new Set(filterRows.filter((row) => row.customer === selectedCustomer).map((row) => row.branch))).sort((a, b) => a.localeCompare(b)),
    [filterRows, selectedCustomer]
  );
  const productOptions = useMemo(
    () =>
      Array.from(
        new Set(
          filterRows
            .filter((row) => row.customer === selectedCustomer && row.branch === selectedBranch)
            .map((row) => row.product)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [filterRows, selectedCustomer, selectedBranch]
  );
  const detailProductOptions = useMemo(
    () =>
      filterRows
        .filter(
          (row) =>
            row.customer === selectedCustomer &&
            row.branch === selectedBranch &&
            row.product === selectedProduct
        )
        .sort((a, b) => a.detailProduct.localeCompare(b.detailProduct)),
    [filterRows, selectedCustomer, selectedBranch, selectedProduct]
  );
  const selectedDetailMeta = useMemo(
    () => detailProductOptions.find((row) => row.detailProduct === selectedDetailProduct),
    [detailProductOptions, selectedDetailProduct]
  );

  /** 세부제품 행의 계약기간(projectPeriodStart~End)에 포함된 월만 월 선택 UI에서 활성화 */
  const contractMonths = useMemo((): string[] | undefined => {
    if (!selectedDetailMeta) return undefined;
    const start = selectedDetailMeta.projectPeriodStart;
    const end = selectedDetailMeta.projectPeriodEnd;
    if (!start || !end || start > end) return [];
    const [sy, sm] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);
    const months: string[] = [];
    let y = sy;
    let m = sm;
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return months;
  }, [selectedDetailMeta]);

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

  // Result cards: one per 세부제품. Blue card changes when detail product changes.
  const resultCards = useMemo((): DetailProductCard[] => {
    if (!selectedCustomer) return [];
    let rows = filterRows.filter((r) => r.customer === selectedCustomer);
    if (selectedBranch) rows = rows.filter((r) => r.branch === selectedBranch);
    if (selectedProduct) rows = rows.filter((r) => r.product === selectedProduct);
    if (selectedDetailProduct) rows = rows.filter((r) => r.detailProduct === selectedDetailProduct);
    return rows.map((r, i) => ({
      id: `card-${r.customer}-${r.branch}-${r.product}-${r.detailProduct}-${i}`,
      customer: r.customer,
      branch: r.branch,
      product: r.product,
      detailProduct: r.detailProduct,
      bomCode: r.bomCode,
    }));
  }, [filterRows, selectedCustomer, selectedBranch, selectedProduct, selectedDetailProduct]);

  // Months in selected period (for month grouping inside each blue card)
  const periodMonths = useMemo((): string[] => {
    let start: string | null;
    let end: string | null;
    if (selectedDetailProduct) {
      // 세부제품 선택 시: 계약기간 사용 (auto면 selectedDetailMeta, manual이면 selectedPeriodStart/End)
      if (periodMode === 'auto' && selectedDetailMeta) {
        start = selectedDetailMeta.projectPeriodStart;
        end = selectedDetailMeta.projectPeriodEnd;
      } else {
        start = selectedPeriodStart || null;
        end = selectedPeriodEnd || null;
      }
    } else {
      start = generalPeriodStart;
      end = generalPeriodEnd;
    }
    if (!start || !end || start > end) return [];
    const [sy, sm] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);
    const months: string[] = [];
    let y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return months;
  }, [
    selectedDetailProduct,
    periodMode,
    selectedDetailMeta,
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
  const [sortBy, setSortBy] = useState('latest');
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
    if (resultCards.length > 0 && !hasExpandedForQueryRef.current) {
      hasExpandedForQueryRef.current = true;
      setExpandedProjects(new Set()); // 파란색 카드(고객사·지사·제품·BOM 등) 접힌 상태
      setExpandedMonthSections(new Set()); // 월별 섹션 접힌 상태
    }
  }, [hasQueried, resultCards, periodMonths]);

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
      if (s.sortBy != null) setSortBy(String(s.sortBy));
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

  const handleQuery = () => {
    if (!selectedCustomer) {
      toast.error('고객사를 선택해주세요');
      return;
    }

    const hasDetailProduct = !!selectedDetailProduct;

    if (hasDetailProduct) {
      if (!selectedBranch || !selectedProduct) {
        toast.error('세부제품까지 선택할 경우 지사, 제품을 모두 선택해주세요');
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

    setHasQueried(true);
    // Cards and months will be computed from current selection - expand all after render
    toast.success('조회가 완료되었습니다');
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
    setHasQueried(false);
    setExpandedProjects(new Set());
    setExpandedMonthSections(new Set());
    setExpandedNodes(new Set());
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    toast.success(`${format.toUpperCase()} 파일을 다운로드합니다`);
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

  const toggleMonthSection = (cardId: string, month: string) => {
    const key = `${cardId}-${month}`;
    const newExpanded = new Set(expandedMonthSections);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedMonthSections(newExpanded);
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
    const gridCols = 'minmax(150px, 180px) minmax(70px, 90px) 0.5fr minmax(0,1fr) minmax(100px, 130px) minmax(90px, 120px) minmax(115px, 150px) minmax(0,1fr) minmax(115px, 150px) minmax(0,1fr) minmax(90px, 110px) minmax(0,1fr)';
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

            {/* Company Name */}
            <div className="min-w-0">
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
            {periodMonths.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500" style={{ border: '1px solid #E5E7EB' }}>
                조회 기간을 선택해주세요
              </div>
            ) : (
              periodMonths.map((month) => {
                const monthKey = `${card.id}-${month}`;
                const isMonthExpanded = expandedMonthSections.has(monthKey);

                return (
                  <div key={monthKey} className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
                    {/* Month section header - collapsible, 공급망 PCF 보기 버튼 */}
                    <div
                      className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleMonthSection(card.id, month)}
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

                    {/* Tree: Tier 0부터 하위 협력사 (현재 빈 데이터) */}
                    {isMonthExpanded && (
                      <div>
                        <div className="bg-gray-50 border-b border-gray-200">
                          <div
                            className="grid items-center px-4 py-3 gap-x-2 text-xs font-medium text-gray-700 w-full"
                            style={{ gridTemplateColumns: 'minmax(150px, 180px) minmax(70px, 90px) 0.5fr minmax(0,1fr) minmax(100px, 130px) minmax(90px, 120px) minmax(115px, 150px) minmax(0,1fr) minmax(115px, 150px) minmax(0,1fr) minmax(90px, 110px) minmax(0,1fr)' }}
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
                        {renderNode(getSampleSupplyChainTree(card.id, month))}
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
              {customerOptions.map((customer) => (
                <option key={customer} value={customer}>{customer}</option>
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
              {branchOptions.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
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
                setHasQueried(false);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
              <option value="">선택</option>
              {productOptions.map((product) => (
                <option key={product} value={product}>{product}</option>
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
              {detailProductOptions.map((detail) => (
                <option key={detail.detailProduct} value={detail.detailProduct}>{detail.detailProduct}</option>
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
                {selectedDetailMeta?.projectPeriodLabel || '세부제품 선택 시 자동 표시'}
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
            onClick={handleQuery}
            className="px-6 py-3 text-white rounded-xl font-medium transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
              boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
            }}
          >
            조회
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
                    {resultCards.length}개 세부제품
                  </span>
                  {periodMonths.length > 0 && (
                    <> / <span className={mode === 'procurement' ? 'text-[#5B3BFA]' : 'text-[#00B4FF]'}>
                      {periodMonths.length}개 월
                    </span></>
                  )}
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
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                >
                  <option value="latest">최신순</option>
                  <option value="project">프로젝트명</option>
                  <option value="customer">고객사</option>
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
            {resultCards.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl" style={{ border: '1px solid #E5E7EB' }}>
                <p className="text-gray-500">조회 조건에 맞는 세부제품이 없습니다. 고객사, 지사, 제품을 선택해주세요.</p>
              </div>
            ) : (
              resultCards.map((card) => renderDetailProductCard(card))
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
    </div>
  );
}