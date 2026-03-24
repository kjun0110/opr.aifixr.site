import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, Download, FileText, Filter, CheckCircle, Clock, AlertTriangle, Edit2, Eye, FileCheck, Building2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useMode } from '../context/ModeContext';
import MonthRangePicker from './MonthRangePicker';
import ProcurementDetailModal from './ProcurementDetailModal';
import PcfDetailModal from './PcfDetailModal';

// Unified data structure - contains both company and supplier data
interface DataRecord {
  id: string;
  supplyChainCode: string; // 공급망 코드 (e.g., SC-1.2)
  companyName: string;
  companyNameEn: string;
  site: string;
  country: string;
  tier: string; // Tier 0 (자사) or Tier 1, 2, 3 (협력사)
  
  // Common fields
  dataStatus: 'complete' | 'partial' | 'missing'; // 데이터 상태
  inputStatus: 'confirmed' | 'temp' | 'pending'; // 입력 상태
  pcfStatus: 'verified' | 'submitted' | 'pending'; // PCF 상태
  submissionDate: string | null; // 제출일
  canModify: boolean; // 수정 가능 여부
  
  // Procurement specific fields
  productionVolume?: number;
  deliveryVolume?: number;
  operationRate?: number;
  
  // PCF specific fields
  scope1?: number;
  scope2?: number;
  pcfResult?: number;
  dqr?: number;
  
  lastUpdate: string;
  updatedBy: string;
}

// Mock data - mixed company and supplier data
const mockDataRecords: DataRecord[] = [
  // Tier 0 (자사) records
  {
    id: 'rec-1',
    supplyChainCode: 'SC-1.2',
    companyName: '삼성SDI',
    companyNameEn: 'Samsung SDI',
    site: '서울사업장',
    country: 'South Korea',
    tier: 'Tier 0',
    dataStatus: 'complete',
    inputStatus: 'confirmed',
    pcfStatus: 'verified',
    submissionDate: '2026-03-01',
    canModify: true,
    productionVolume: 12500,
    deliveryVolume: 12000,
    operationRate: 96.5,
    scope1: 2850.5,
    scope2: 7150.8,
    pcfResult: 32420.3,
    dqr: 1.5,
    lastUpdate: '2026-03-02',
    updatedBy: '김철수',
  },
  {
    id: 'rec-2',
    supplyChainCode: 'SC-1.2',
    companyName: '삼성SDI',
    companyNameEn: 'Samsung SDI',
    site: '부산사업장',
    country: 'South Korea',
    tier: 'Tier 0',
    dataStatus: 'partial',
    inputStatus: 'temp',
    pcfStatus: 'submitted',
    submissionDate: '2026-02-28',
    canModify: true,
    productionVolume: 8400,
    deliveryVolume: 8200,
    operationRate: 92.3,
    scope1: 1950.3,
    scope2: 5280.7,
    pcfResult: 24850.4,
    dqr: 1.6,
    lastUpdate: '2026-03-01',
    updatedBy: '이영희',
  },
  // Tier 1 (협력사) records
  {
    id: 'rec-3',
    supplyChainCode: 'SC-1.2',
    companyName: '한국배터리',
    companyNameEn: 'Korea Battery Co.',
    site: '천안사업장',
    country: 'South Korea',
    tier: 'Tier 1',
    dataStatus: 'complete',
    inputStatus: 'confirmed',
    pcfStatus: 'verified',
    submissionDate: '2026-03-01',
    canModify: false,
    productionVolume: 7200,
    deliveryVolume: 7100,
    operationRate: 94.2,
    scope1: 1050.2,
    scope2: 2850.6,
    pcfResult: 12820.4,
    dqr: 1.7,
    lastUpdate: '2026-02-28',
    updatedBy: '김협력',
  },
  {
    id: 'rec-4',
    supplyChainCode: 'SC-1.2',
    companyName: '글로벌 소재',
    companyNameEn: 'Global Materials Ltd.',
    site: 'Munich Plant',
    country: 'Germany',
    tier: 'Tier 1',
    dataStatus: 'complete',
    inputStatus: 'confirmed',
    pcfStatus: 'verified',
    submissionDate: '2026-02-27',
    canModify: false,
    productionVolume: 5250,
    deliveryVolume: 5200,
    operationRate: 91.8,
    scope1: 620.8,
    scope2: 1580.5,
    pcfResult: 6050.2,
    dqr: 1.5,
    lastUpdate: '2026-02-27',
    updatedBy: 'Hans Mueller',
  },
  // Tier 2 (협력사) records
  {
    id: 'rec-5',
    supplyChainCode: 'SC-1.2',
    companyName: '셀테크',
    companyNameEn: 'Cell Tech Inc.',
    site: 'Shenzhen Factory',
    country: 'China',
    tier: 'Tier 2',
    dataStatus: 'partial',
    inputStatus: 'pending',
    pcfStatus: 'submitted',
    submissionDate: '2026-02-25',
    canModify: false,
    productionVolume: 3450,
    deliveryVolume: 3400,
    operationRate: 88.5,
    scope1: 580.3,
    scope2: 1550.7,
    pcfResult: 5920.5,
    dqr: 2.1,
    lastUpdate: '2026-02-25',
    updatedBy: 'Li Wei',
  },
  {
    id: 'rec-6',
    supplyChainCode: 'SC-2.1',
    companyName: '파워셀 테크놀로지',
    companyNameEn: 'PowerCell Technologies',
    site: 'Tokyo Plant',
    country: 'Japan',
    tier: 'Tier 1',
    dataStatus: 'complete',
    inputStatus: 'confirmed',
    pcfStatus: 'verified',
    submissionDate: '2026-03-01',
    canModify: false,
    productionVolume: 6150,
    deliveryVolume: 6100,
    operationRate: 95.3,
    scope1: 980.5,
    scope2: 2380.6,
    pcfResult: 9850.3,
    dqr: 1.7,
    lastUpdate: '2026-03-01',
    updatedBy: 'Tanaka Yuki',
  },
  {
    id: 'rec-7',
    supplyChainCode: 'SC-2.1',
    companyName: '에코 패키징',
    companyNameEn: 'Eco Packaging Corp.',
    site: 'California Plant',
    country: 'USA',
    tier: 'Tier 1',
    dataStatus: 'missing',
    inputStatus: 'pending',
    pcfStatus: 'pending',
    submissionDate: null,
    canModify: false,
    productionVolume: 0,
    deliveryVolume: 0,
    operationRate: 0,
    scope1: 0,
    scope2: 0,
    pcfResult: 0,
    dqr: 0,
    lastUpdate: '2026-02-20',
    updatedBy: 'John Smith',
  },
  // Tier 3 (협력사) records
  {
    id: 'rec-8',
    supplyChainCode: 'SC-1.2',
    companyName: '리튬광산',
    companyNameEn: 'Lithium Mine Corp.',
    site: 'Santiago Plant',
    country: 'Chile',
    tier: 'Tier 3',
    dataStatus: 'partial',
    inputStatus: 'temp',
    pcfStatus: 'pending',
    submissionDate: '2026-02-20',
    canModify: false,
    productionVolume: 14400,
    deliveryVolume: 14200,
    operationRate: 87.2,
    scope1: 320.1,
    scope2: 680.3,
    pcfResult: 2101.8,
    dqr: 2.3,
    lastUpdate: '2026-02-20',
    updatedBy: 'Carlos Rodriguez',
  },
];

export default function DataManage() {
  const { mode } = useMode();

  // Calculate default period: last completed 4-month range (월 단위)
  const getDefaultMonthRange = () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    let currentQuarter = Math.ceil(currentMonth / 3);
    let endQuarter = currentQuarter - 1;
    let endYear = currentYear;
    
    if (endQuarter === 0) {
      endQuarter = 4;
      endYear = currentYear - 1;
    }
    
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

  // Filter states
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [selectedSupplyChain, setSelectedSupplyChain] = useState('ALL');
  const [selectedSupplyChainVersion, setSelectedSupplyChainVersion] = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState('ALL');
  const [selectedPeriodStart, setSelectedPeriodStart] = useState(defaultMonthRange.startMonth);
  const [selectedPeriodEnd, setSelectedPeriodEnd] = useState(defaultMonthRange.endMonth);
  const [periodError, setPeriodError] = useState('');
  const [selectedCompanyType, setSelectedCompanyType] = useState('ALL'); // 회사 유형 (자사/협력사)
  const [selectedSite, setSelectedSite] = useState('ALL');

  // Advanced filter states
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedDataStatus, setSelectedDataStatus] = useState('ALL');
  const [selectedInputStatus, setSelectedInputStatus] = useState('ALL');
  const [selectedPcfStatus, setSelectedPcfStatus] = useState('ALL');

  // UI states
  const [hasQueried, setHasQueried] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null);

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

  const handleQuery = () => {
    if (periodError) {
      toast.error('기간 선택을 확인해주세요');
      return;
    }

    setHasQueried(true);
    toast.success('조회가 완료되었습니다');
  };

  const handleReset = () => {
    setSelectedProduct('ALL');
    setSelectedSupplyChain('ALL');
    setSelectedSupplyChainVersion('ALL');
    setSelectedCustomer('ALL');
    setSelectedPeriodStart(defaultMonthRange.startMonth);
    setSelectedPeriodEnd(defaultMonthRange.endMonth);
    setPeriodError('');
    setSelectedCompanyType('ALL');
    setSelectedSite('ALL');
    setSelectedTier('ALL');
    setSelectedCountry('ALL');
    setSelectedDataStatus('ALL');
    setSelectedInputStatus('ALL');
    setSelectedPcfStatus('ALL');
    setHasQueried(false);
  };

  // Filter data
  const filteredData = useMemo(() => {
    if (!hasQueried) return [];
    
    return mockDataRecords.filter(item => {
      // 회사 유형 필터
      if (selectedCompanyType !== 'ALL') {
        if (selectedCompanyType === 'company' && item.tier !== 'Tier 0') return false;
        if (selectedCompanyType === 'supplier' && item.tier === 'Tier 0') return false;
      }
      
      // 공급망 필터
      if (selectedSupplyChain !== 'ALL' && !item.supplyChainCode.includes(selectedSupplyChain)) return false;
      
      // 사업장 필터
      if (selectedSite !== 'ALL' && item.site !== selectedSite) return false;
      
      // Tier 필터
      if (selectedTier !== 'ALL' && item.tier !== selectedTier) return false;
      
      // 국가 필터
      if (selectedCountry !== 'ALL' && item.country !== selectedCountry) return false;
      
      // 데이터 상태 필터
      if (selectedDataStatus !== 'ALL' && item.dataStatus !== selectedDataStatus) return false;
      
      // 입력 상태 필터
      if (selectedInputStatus !== 'ALL' && item.inputStatus !== selectedInputStatus) return false;
      
      // PCF 상태 필터
      if (selectedPcfStatus !== 'ALL' && item.pcfStatus !== selectedPcfStatus) return false;
      
      // 검색어 필터
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          item.companyName.toLowerCase().includes(searchLower) ||
          item.companyNameEn.toLowerCase().includes(searchLower) ||
          item.site.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
  }, [hasQueried, selectedCompanyType, selectedSupplyChain, selectedSite, selectedTier, selectedCountry, selectedDataStatus, selectedInputStatus, selectedPcfStatus, searchTerm]);

  const handleViewDetail = (record: DataRecord) => {
    setSelectedRecord(record);
  };

  const handleEdit = (record: DataRecord) => {
    if (mode === 'procurement') {
      toast.error('구매 직무는 데이터 수정 권한이 없습니다');
      return;
    }
    
    if (!record.canModify) {
      toast.error('협력사 데이터는 수정할 수 없습니다');
      return;
    }
    
    toast.info(`${record.companyName} 데이터 수정 (구현 예정)`);
  };

  const handleDownload = (record: DataRecord) => {
    toast.success(`${record.companyName} 데이터를 다운로드합니다`);
  };

  const handleVerify = (record: DataRecord) => {
    if (mode === 'procurement') {
      toast.error('구매 직무는 검증 권한이 없습니다');
      return;
    }
    
    toast.info(`${record.companyName} 데이터 검증 (구현 예정)`);
  };

  const getDataStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return (
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">준비완료</span>
          </div>
        );
      case 'partial':
        return (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-700">부분완료</span>
          </div>
        );
      case 'missing':
        return (
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">미완료</span>
          </div>
        );
      default:
        return null;
    }
  };

  const getInputStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">확정</span>;
      case 'temp':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">임시저장</span>;
      case 'pending':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">대기</span>;
      default:
        return null;
    }
  };

  const getPcfStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">검증완료</span>;
      case 'submitted':
        return <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">제출완료</span>;
      case 'pending':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">대기</span>;
      default:
        return null;
    }
  };

  const getTierBadge = (tier: string) => {
    const isTier0 = tier === 'Tier 0';
    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
            isTier0
              ? mode === 'procurement'
                ? 'bg-gray-100 text-gray-700 border-2 border-[#5B3BFA]'
                : 'bg-gray-100 text-gray-700 border-2 border-[#00B4FF]'
              : mode === 'procurement'
              ? 'bg-[#5B3BFA] text-white'
              : 'bg-[#00B4FF] text-white'
          }`}
        >
          {tier}
        </span>
        {isTier0 && (
          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
            mode === 'procurement' ? 'bg-purple-700 text-white' : 'bg-blue-700 text-white'
          }`}>
            원청
          </span>
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
          {mode === 'procurement' 
            ? '제품 기준으로 공급망 데이터를 조회하고 관리합니다' 
            : '제품 기준으로 PCF 데이터를 조회하고 관리합니다'}
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
          {/* Product */}
          <div>
            <label className="block text-sm font-medium mb-2">제품</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
            >
              <option value="ALL">ALL (전체)</option>
              <option value="Battery Module A">배터리 모듈 A</option>
              <option value="Solid State Cell">전고체 셀</option>
              <option value="ESS Pack">ESS 팩</option>
            </select>
          </div>

          {/* Supply Chain */}
          <div>
            <label className="block text-sm font-medium mb-2">공급망</label>
            <select
              value={selectedSupplyChain}
              onChange={(e) => setSelectedSupplyChain(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
            >
              <option value="ALL">ALL (전체)</option>
              <option value="SC-1">표준 공급망 (SC-1)</option>
              <option value="SC-2">친환경 공급망 (SC-2)</option>
              <option value="SC-3">차세대 공급망 (SC-3)</option>
            </select>
          </div>

          {/* Supply Chain Version */}
          <div>
            <label className="block text-sm font-medium mb-2">공급망 버전</label>
            <select
              value={selectedSupplyChainVersion}
              onChange={(e) => setSelectedSupplyChainVersion(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
            >
              <option value="ALL">ALL (전체)</option>
              <option value="SC-1.2">SC-1.2</option>
              <option value="SC-1.1">SC-1.1</option>
              <option value="SC-2.1">SC-2.1</option>
            </select>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium mb-2">고객사</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
            >
              <option value="ALL">ALL (전체)</option>
              <option value="BMW">BMW</option>
              <option value="Mercedes">Mercedes-Benz</option>
              <option value="Audi">Audi</option>
            </select>
          </div>

          {/* Period */}
          <div>
            <label className="block text-sm font-medium mb-2">기간</label>
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
              }}
              error={periodError}
            />
          </div>

          {/* Company Type - 회사 유형 (자사/협력사 구분) */}
          <div>
            <label className="block text-sm font-medium mb-2">회사 유형</label>
            <select
              value={selectedCompanyType}
              onChange={(e) => setSelectedCompanyType(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
            >
              <option value="ALL">ALL (전체)</option>
              <option value="company">자사</option>
              <option value="supplier">협력사</option>
            </select>
          </div>

          {/* Site */}
          <div>
            <label className="block text-sm font-medium mb-2">사업장</label>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
            >
              <option value="ALL">ALL (전체)</option>
              <option value="서울사업장">서울사업장</option>
              <option value="부산사업장">부산사업장</option>
              <option value="천안사업장">천안사업장</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="mb-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-[#5B3BFA] hover:text-[#00B4FF] transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            <span className="font-medium">세부내용 선택</span>
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 p-4 bg-[#F6F8FB] rounded-xl">
              {/* Tier */}
              <div>
                <label className="block text-sm font-medium mb-2">협력사 차수</label>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] bg-white"
                >
                  <option value="ALL">ALL (전체)</option>
                  <option value="Tier 0">Tier 0 (자사)</option>
                  <option value="Tier 1">Tier 1</option>
                  <option value="Tier 2">Tier 2</option>
                  <option value="Tier 3">Tier 3</option>
                </select>
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-medium mb-2">국가</label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] bg-white"
                >
                  <option value="ALL">ALL (전체)</option>
                  <option value="South Korea">South Korea</option>
                  <option value="China">China</option>
                  <option value="Germany">Germany</option>
                  <option value="Japan">Japan</option>
                  <option value="USA">USA</option>
                  <option value="Chile">Chile</option>
                </select>
              </div>

              {/* Data Status */}
              <div>
                <label className="block text-sm font-medium mb-2">데이터 상태</label>
                <select
                  value={selectedDataStatus}
                  onChange={(e) => setSelectedDataStatus(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] bg-white"
                >
                  <option value="ALL">ALL (전체)</option>
                  <option value="complete">준비완료</option>
                  <option value="partial">부분완료</option>
                  <option value="missing">미완료</option>
                </select>
              </div>

              {/* Input Status */}
              <div>
                <label className="block text-sm font-medium mb-2">입력 상태</label>
                <select
                  value={selectedInputStatus}
                  onChange={(e) => setSelectedInputStatus(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] bg-white"
                >
                  <option value="ALL">ALL (전체)</option>
                  <option value="confirmed">확정</option>
                  <option value="temp">임시저장</option>
                  <option value="pending">대기</option>
                </select>
              </div>

              {/* PCF Status */}
              <div>
                <label className="block text-sm font-medium mb-2">PCF 상태</label>
                <select
                  value={selectedPcfStatus}
                  onChange={(e) => setSelectedPcfStatus(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] bg-white"
                >
                  <option value="ALL">ALL (전체)</option>
                  <option value="verified">검증완료</option>
                  <option value="submitted">제출완료</option>
                  <option value="pending">대기</option>
                </select>
              </div>
            </div>
          )}
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
                    {filteredData.length}건
                  </span>
                </span>

                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="회사명, 사업장 검색..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  />
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                >
                  <option value="latest">최신순</option>
                  <option value="company">회사명</option>
                  <option value="tier">차수</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.success('엑셀 파일을 다운로드합니다')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  엑셀 다운로드
                </button>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div
            className="bg-white overflow-hidden"
            style={{
              borderRadius: '20px',
              boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">공급망</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">회사명</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tier</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">사업장</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">국가</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">데이터 상태</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">입력 상태</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">PCF 상태</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">제출일</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                        조회 결과가 없습니다
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">{record.supplyChainCode}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{record.companyName}</div>
                            <div className="text-xs text-gray-500">{record.companyNameEn}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">{getTierBadge(record.tier)}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{record.site}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{record.country}</td>
                        <td className="px-6 py-4">{getDataStatusBadge(record.dataStatus)}</td>
                        <td className="px-6 py-4">{getInputStatusBadge(record.inputStatus)}</td>
                        <td className="px-6 py-4">{getPcfStatusBadge(record.pcfStatus)}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{record.submissionDate || '-'}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {/* 상세보기 */}
                            <button
                              onClick={() => handleViewDetail(record)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="상세보기"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* 수정 - 구매 직무는 비활성화 */}
                            <button
                              onClick={() => handleEdit(record)}
                              disabled={mode === 'procurement' || !record.canModify}
                              className={`p-2 rounded-lg transition-colors ${
                                mode === 'procurement' || !record.canModify
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-green-600 hover:bg-green-50'
                              }`}
                              title={mode === 'procurement' ? '구매 직무는 수정 불가' : !record.canModify ? '협력사 데이터는 수정 불가' : '수정'}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* 다운로드 */}
                            <button
                              onClick={() => handleDownload(record)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="다운로드"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {/* 검증 상태 확인 - PCF 직무만 표시 */}
                            {mode === 'pcf' && (
                              <button
                                onClick={() => handleVerify(record)}
                                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                title="검증 상태 확인"
                              >
                                <FileCheck className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Detail Modals */}
      {selectedRecord && mode === 'procurement' && (
        <ProcurementDetailModal
          company={{
            id: selectedRecord.id,
            tier: selectedRecord.tier,
            companyName: selectedRecord.companyName,
            companyNameEn: selectedRecord.companyNameEn,
            country: selectedRecord.country,
            supplierType: 'Manufacturer',
            feoc: true,
            rmi: true,
            certExpiry: null,
            connectedProducts: 1,
            riskLevel: 'low' as const,
            alternativeAvailable: false,
            scope1: selectedRecord.scope1 || 0,
            scope2: selectedRecord.scope2 || 0,
            mainMaterial: '',
            emissionSource: '',
            pcfResult: selectedRecord.pcfResult || 0,
            dqr: selectedRecord.dqr || 0,
            submissionStatus: selectedRecord.pcfStatus as any,
            lastUpdate: selectedRecord.lastUpdate,
          }}
          onClose={() => setSelectedRecord(null)}
          selectedPeriodStart={selectedPeriodStart}
          selectedPeriodEnd={selectedPeriodEnd}
        />
      )}

      {selectedRecord && mode === 'pcf' && (
        <PcfDetailModal
          company={{
            id: selectedRecord.id,
            tier: selectedRecord.tier,
            companyName: selectedRecord.companyName,
            companyNameEn: selectedRecord.companyNameEn,
            country: selectedRecord.country,
            supplierType: 'Manufacturer',
            feoc: true,
            rmi: true,
            certExpiry: null,
            connectedProducts: 1,
            riskLevel: 'low' as const,
            alternativeAvailable: false,
            scope1: selectedRecord.scope1 || 0,
            scope2: selectedRecord.scope2 || 0,
            mainMaterial: '',
            emissionSource: '',
            pcfResult: selectedRecord.pcfResult || 0,
            dqr: selectedRecord.dqr || 0,
            submissionStatus: selectedRecord.pcfStatus as any,
            lastUpdate: selectedRecord.lastUpdate,
          }}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}