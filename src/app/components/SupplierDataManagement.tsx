import { useState, useMemo } from 'react';
import { Download, Upload, CheckCircle, Clock, AlertTriangle, Send, X, ChevronRight, MapPin, Edit2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useMode } from '../context/ModeContext';
import SupplyChainMap from './SupplyChainMap';
import MonthRangePicker from './MonthRangePicker';
import SupplierExcelUploadModal from './SupplierExcelUploadModal';

// Supplier data structure with hierarchy
interface SupplierData {
  id: string;
  companyName: string;
  tier: number;
  supplierType: string;
  country: string;
  site: string;
  parentId: string | null;
  productId: string;
  supplyChainId: string;
  
  // Procurement view fields
  feoc: boolean;
  rmi: boolean;
  certifiedMine: boolean;
  deliveryMaterial: string;
  mineralContent: string;
  contactPerson: string;
  submissionStatus: 'submitted' | 'review' | 'approved' | 'rejected';
  
  // Procurement - Quarterly data
  quarterlyDelivery: number; // 분기 납품량 (kg)
  
  // PCF view fields
  productName: string;
  energyUsage: number;
  lngUsage: number;
  materialInput: number;
  production: number;
  waste: number;
  dqr: number;
  calculable: boolean;
  missingFields: string[];
  pcfApprovalStage: 'draft' | 'verification' | 'approved';
  
  // PCF - Quarterly data
  quarterlyEmission: number; // 분기 배출량 (tCO₂e)
  
  submittedDate: string;
  reviewer?: string;
}

// Product and supply chain metadata
interface Product {
  id: string;
  name: string;
  supplyChains: string[];
}

interface SupplyChain {
  id: string;
  name: string;
  productId: string;
}

// Mock products
const mockProducts: Product[] = [
  { id: 'p1', name: '배터리 모듈 A', supplyChains: ['sc1', 'sc2'] },
  { id: 'p2', name: '전고체 셀', supplyChains: ['sc3'] },
  { id: 'p3', name: 'ESS 팩', supplyChains: ['sc4'] },
];

// Mock supply chains
const mockSupplyChains: SupplyChain[] = [
  { id: 'sc1', name: 'SCN-2026-01', productId: 'p1' },
  { id: 'sc2', name: 'SCN-2026-02', productId: 'p1' },
  { id: 'sc3', name: 'SCN-2026-03', productId: 'p2' },
  { id: 'sc4', name: 'SCN-2026-04', productId: 'p3' },
];

// Mock supplier data with tree structure
const mockSupplierData: SupplierData[] = [
  // Tier 0 (원청/자사) - Supply Chain 1
  {
    id: 'c0-sc1',
    companyName: '삼성SDI',
    tier: 0,
    supplierType: 'OEM',
    country: 'South Korea',
    site: '본사',
    parentId: null,
    productId: 'p1',
    supplyChainId: 'sc1',
    feoc: true,
    rmi: true,
    certifiedMine: true,
    deliveryMaterial: '-',
    mineralContent: '-',
    contactPerson: '김담당',
    submissionStatus: 'approved',
    quarterlyDelivery: 0,
    productName: '배터리 모듈 A',
    energyUsage: 0,
    lngUsage: 0,
    materialInput: 0,
    production: 0,
    waste: 0,
    dqr: 1.0,
    calculable: true,
    missingFields: [],
    pcfApprovalStage: 'approved',
    quarterlyEmission: 0,
    submittedDate: '2026-03-05',
    reviewer: '관리자',
  },

  // Tier 0 (원청/자사) - Supply Chain 2
  {
    id: 'c0-sc2',
    companyName: '삼성SDI',
    tier: 0,
    supplierType: 'OEM',
    country: 'South Korea',
    site: '본사',
    parentId: null,
    productId: 'p1',
    supplyChainId: 'sc2',
    feoc: true,
    rmi: true,
    certifiedMine: true,
    deliveryMaterial: '-',
    mineralContent: '-',
    contactPerson: '김담당',
    submissionStatus: 'approved',
    quarterlyDelivery: 0,
    productName: '배터리 모듈 A',
    energyUsage: 0,
    lngUsage: 0,
    materialInput: 0,
    production: 0,
    waste: 0,
    dqr: 1.0,
    calculable: true,
    missingFields: [],
    pcfApprovalStage: 'approved',
    quarterlyEmission: 0,
    submittedDate: '2026-03-05',
    reviewer: '관리자',
  },

  // Supply Chain 1 - Tier 1
  {
    id: 's1',
    companyName: '한국배터리',
    tier: 1,
    supplierType: 'Manufacturer',
    country: 'South Korea',
    site: '천안사업장',
    parentId: 'c0-sc1',
    productId: 'p1',
    supplyChainId: 'sc1',
    feoc: true,
    rmi: true,
    certifiedMine: true,
    deliveryMaterial: '배터리 셀',
    mineralContent: '리튬 15%, 니켈 10%',
    contactPerson: '김협력',
    submissionStatus: 'approved',
    quarterlyDelivery: 7200, // 분기 납품량 (kg)
    productName: '배터리 셀 Type-A',
    energyUsage: 1250.5,
    lngUsage: 450.3,
    materialInput: 2500.8,
    production: 2400.0,
    waste: 100.8,
    dqr: 1.6,
    calculable: true,
    missingFields: [],
    pcfApprovalStage: 'approved',
    quarterlyEmission: 38.52, // 분기 배출량 (tCO₂e)
    submittedDate: '2026-03-01',
    reviewer: '이영희',
  },
  // Tier 2 under 한국배터리
  {
    id: 's2',
    companyName: '셀테크',
    tier: 2,
    supplierType: 'Component Supplier',
    country: 'China',
    site: 'Shenzhen Factory',
    parentId: 's1',
    productId: 'p1',
    supplyChainId: 'sc1',
    feoc: false,
    rmi: true,
    certifiedMine: false,
    deliveryMaterial: '리튬이온 셀',
    mineralContent: '리튬 20%, 코발트 5%',
    contactPerson: 'Li Wei',
    submissionStatus: 'review',
    quarterlyDelivery: 3450, // 분기 납품량 (kg)
    productName: '리튬이온 셀 LI-100',
    energyUsage: 0,
    lngUsage: 320.5,
    materialInput: 1200.0,
    production: 1150.0,
    waste: 50.0,
    dqr: 2.4,
    calculable: false,
    missingFields: ['에너지 사용량', '생산량 상세'],
    pcfApprovalStage: 'draft',
    quarterlyEmission: 17.76, // 분기 배출량 (tCO₂e)
    submittedDate: '2026-02-25',
  },
  // Tier 3 under 셀테크
  {
    id: 's3',
    companyName: '리튬소재',
    tier: 3,
    supplierType: 'Material Supplier',
    country: 'Chile',
    site: 'Santiago Plant',
    parentId: 's2',
    productId: 'p1',
    supplyChainId: 'sc1',
    feoc: true,
    rmi: false,
    certifiedMine: true,
    deliveryMaterial: '리튬 원료',
    mineralContent: '리튬 95%',
    contactPerson: 'Carlos Rodriguez',
    submissionStatus: 'submitted',
    quarterlyDelivery: 14400, // 분기 납품량 (kg)
    productName: '리튬 원료 LTH-95',
    energyUsage: 2200.0,
    lngUsage: 0,
    materialInput: 5000.0,
    production: 4800.0,
    waste: 200.0,
    dqr: 2.1,
    calculable: true,
    missingFields: [],
    pcfApprovalStage: 'verification',
    quarterlyEmission: 6.31, // 분기 배출량 (tCO₂e)
    submittedDate: '2026-02-20',
  },
  // Another Tier 2 under 한국배터리
  {
    id: 's4',
    companyName: '글로벌소재',
    tier: 2,
    supplierType: 'Material Supplier',
    country: 'Germany',
    site: 'Munich Plant',
    parentId: 's1',
    productId: 'p1',
    supplyChainId: 'sc1',
    feoc: true,
    rmi: false,
    certifiedMine: false,
    deliveryMaterial: '친환경 소재',
    mineralContent: 'N/A',
    contactPerson: 'Hans Mueller',
    submissionStatus: 'approved',
    quarterlyDelivery: 5250, // 분기 납품량 (kg)
    productName: '친환경 소재 ECO-X',
    energyUsage: 820.7,
    lngUsage: 0,
    materialInput: 1800.5,
    production: 1750.0,
    waste: 50.5,
    dqr: 1.9,
    calculable: true,
    missingFields: [],
    pcfApprovalStage: 'approved',
    quarterlyEmission: 18.15, // 분기 배출량 (tCO₂e)
    submittedDate: '2026-02-28',
    reviewer: '박지성',
  },
  // Supply Chain 1 - Another Tier 1
  {
    id: 's5',
    companyName: '파워셀 테크놀로지',
    tier: 1,
    supplierType: 'Manufacturer',
    country: 'Japan',
    site: 'Tokyo Plant',
    parentId: 'c0-sc1',
    productId: 'p1',
    supplyChainId: 'sc1',
    feoc: true,
    rmi: true,
    certifiedMine: true,
    deliveryMaterial: '전력 셀',
    mineralContent: '니켈 12%, 코발트 3%',
    contactPerson: 'Tanaka Yuki',
    submissionStatus: 'approved',
    quarterlyDelivery: 6150, // 분기 납품량 (kg)
    productName: '전력 셀 PWR-200',
    energyUsage: 980.8,
    lngUsage: 280.3,
    materialInput: 2100.5,
    production: 2050.0,
    waste: 50.5,
    dqr: 1.5,
    calculable: true,
    missingFields: [],
    pcfApprovalStage: 'approved',
    quarterlyEmission: 29.55, // 분기 배출량 (tCO₂e)
    submittedDate: '2026-03-02',
    reviewer: '최민수',
  },
  // Supply Chain 2 - Tier 1
  {
    id: 's6',
    companyName: '에코 패키징',
    tier: 1,
    supplierType: 'Material Supplier',
    country: 'USA',
    site: 'California Plant',
    parentId: 'c0-sc2',
    productId: 'p1',
    supplyChainId: 'sc2',
    feoc: true,
    rmi: true,
    certifiedMine: false,
    deliveryMaterial: '포장재',
    mineralContent: 'N/A',
    contactPerson: 'John Smith',
    submissionStatus: 'rejected',
    quarterlyDelivery: 2340, // 분기 납품량 (kg)
    productName: '친환경 포장재',
    energyUsage: 520.3,
    lngUsage: 0,
    materialInput: 800.0,
    production: 780.0,
    waste: 20.0,
    dqr: 3.1,
    calculable: false,
    missingFields: ['DQR 개선 필요', '배출계수 출처 미명시'],
    pcfApprovalStage: 'draft',
    quarterlyEmission: 14.85, // 분기 배출량 (tCO₂e)
    submittedDate: '2026-02-20',
    reviewer: '정우성',
  },
];

type SupplierTabType = 'submission' | 'review';

export default function SupplierDataManagement() {
  const { mode } = useMode();
  
  const [supplierTab, setSupplierTab] = useState<SupplierTabType>('submission');
  const [data] = useState<SupplierData[]>(mockSupplierData);
  const [editModeBySupplyChain, setEditModeBySupplyChain] = useState<Record<string, boolean>>({});
  
  // Excel upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<{
    scnCode: string;
    productName: string;
    supplierName: string;
    tier: string;
    period: string;
  } | null>(null);
  
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
  
  // Filters for submission tab
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [selectedSupplyChain, setSelectedSupplyChain] = useState<string>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [selectedPeriodStart, setSelectedPeriodStart] = useState<string>(defaultMonthRange.startMonth);
  const [selectedPeriodEnd, setSelectedPeriodEnd] = useState<string>(defaultMonthRange.endMonth);
  const [periodError, setPeriodError] = useState<string>('');
  const [hasQueried, setHasQueried] = useState(false);
  
  // Supply chain map modal
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedMapSupplyChain, setSelectedMapSupplyChain] = useState<{ id: string; name: string; productName: string } | null>(null);
  const [mapViewMode, setMapViewMode] = useState<'procurement' | 'pcf'>('procurement');
  
  // Detail slide panel
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierData | null>(null);
  const [detailViewMode, setDetailViewMode] = useState<'procurement' | 'pcf'>('procurement');

  // "우리회사"는 계층상 최상위(부모가 없는) 노드로 판단합니다.
  // (tier 값은 mock/데이터에 따라 0이 없을 수 있어 parentId 기반으로 처리)
  const isOwnSupplier = selectedSupplier?.tier === 0;

  // Get available supply chains based on selected product
  const availableSupplyChains = useMemo(() => {
    if (selectedProduct === 'ALL') {
      return mockSupplyChains;
    }
    return mockSupplyChains.filter(sc => sc.productId === selectedProduct);
  }, [selectedProduct]);

  // Get unique countries from data
  const availableCountries = useMemo(() => {
    const countries = new Set(data.map(d => d.country));
    return Array.from(countries);
  }, [data]);

  // Filter data based on selections
  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (selectedProduct !== 'ALL' && item.productId !== selectedProduct) return false;
      if (selectedSupplyChain !== 'ALL' && item.supplyChainId !== selectedSupplyChain) return false;
      if (selectedTier !== 'ALL') {
        const maxTier = parseInt(selectedTier);
        if (item.tier > maxTier) return false;
      }
      if (selectedStatus !== 'ALL' && item.submissionStatus !== selectedStatus) return false;
      if (selectedCountry !== 'ALL' && item.country !== selectedCountry) return false;
      return true;
    });
  }, [data, selectedProduct, selectedSupplyChain, selectedTier, selectedStatus, selectedCountry]);

  // Group data by supply chain for submission tab
  const groupedBySupplyChain = useMemo(() => {
    const groups = new Map<string, SupplierData[]>();
    
    filteredData.forEach(item => {
      if (!groups.has(item.supplyChainId)) {
        groups.set(item.supplyChainId, []);
      }
      groups.get(item.supplyChainId)!.push(item);
    });
    
    // Sort suppliers within each group by tier
    groups.forEach((suppliers, key) => {
      suppliers.sort((a, b) => a.tier - b.tier);
    });
    
    return groups;
  }, [filteredData]);

  const handleQuery = () => {
    if (selectedPeriodStart > selectedPeriodEnd) {
      setPeriodError('시작 기간이 종료 기간보다 나중일 수 없습니다');
      return;
    }
    setHasQueried(true);
    toast.success('조회가 완료되었습니다');
  };

  const handleReset = () => {
    setSelectedProduct('ALL');
    setSelectedSupplyChain('ALL');
    setSelectedTier('ALL');
    setSelectedStatus('ALL');
    setSelectedCountry('ALL');
    setSelectedPeriodStart(defaultMonthRange.startMonth);
    setSelectedPeriodEnd(defaultMonthRange.endMonth);
    setPeriodError('');
    setHasQueried(false);
  };

  const handleDownloadExcel = (supplyChainId?: string) => {
    const target = supplyChainId ? mockSupplyChains.find(sc => sc.id === supplyChainId)?.name : '전체';
    toast.success(`${target} 엑셀 파일을 다운로드합니다`);
  };

  const handleUploadExcel = (supplyChainId: string, suppliers: SupplierData[]) => {
    const supplyChain = mockSupplyChains.find(sc => sc.id === supplyChainId);
    const product = mockProducts.find(p => p.id === supplyChain?.productId);
    const supplier = suppliers.find(s => s.tier !== 0) || suppliers[0]; // Avoid Tier 0 for "협력사" context
    
    setUploadTarget({
      scnCode: supplyChain?.name || '',
      productName: product?.name || '',
      supplierName: supplier?.companyName || '전체',
      tier: supplier ? `Tier ${supplier.tier}` : '전체',
      period: `${selectedPeriodStart} ~ ${selectedPeriodEnd}`,
    });
    setShowUploadModal(true);
  };

  const handleViewMap = (supplyChainId: string) => {
    const supplyChain = mockSupplyChains.find(sc => sc.id === supplyChainId);
    const product = mockProducts.find(p => p.id === supplyChain?.productId);
    
    if (supplyChain && product) {
      setSelectedMapSupplyChain({
        id: supplyChain.id,
        name: supplyChain.name,
        productName: product.name,
      });
      setMapViewMode(mode === 'procurement' ? 'procurement' : 'pcf');
      setShowMapModal(true);
    }
  };

  const handleRequestRevision = (supplier: SupplierData) => {
    toast.success(`${supplier.companyName}에 수정 요청을 보냈습니다`);
  };

  const handleApprove = (supplier: SupplierData) => {
    toast.success(`${supplier.companyName} 데이터를 승인했습니다`);
  };

  const handleReject = (supplier: SupplierData) => {
    toast.error(`${supplier.companyName} 데이터를 반려했습니다`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-3 h-3" />
            <span className="text-xs">승인</span>
          </span>
        );
      case 'review':
        return (
          <span className="flex items-center gap-1 text-blue-600">
            <Clock className="w-3 h-3" />
            <span className="text-xs">검토중</span>
          </span>
        );
      case 'submitted':
        return (
          <span className="flex items-center gap-1 text-yellow-600">
            <Send className="w-3 h-3" />
            <span className="text-xs">제출</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 text-red-600">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-xs">반려</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getPcfStageBadge = (stage: string) => {
    switch (stage) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">산정완료</span>;
      case 'verification':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">검증중</span>;
      case 'draft':
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">초안</span>;
      default:
        return null;
    }
  };

  // Render submission data tab (group cards with tables)
  const renderSubmissionData = () => {
    if (!hasQueried) {
      return (
        <div className="text-center py-12 text-gray-500">
          <div className="mb-2">조회 조건을 설정하고 조회 버튼을 클릭하세요</div>
        </div>
      );
    }

    if (groupedBySupplyChain.size === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <div className="mb-2">선택한 조건에 해당하는 협력사가 없습니다</div>
          <div className="text-xs">필터를 조정해주세요</div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {Array.from(groupedBySupplyChain.entries()).map(([supplyChainId, suppliers]) => {
          const supplyChain = mockSupplyChains.find(sc => sc.id === supplyChainId);
          const product = mockProducts.find(p => p.id === supplyChain?.productId);
          const supplierOnly = suppliers.filter(s => s.tier !== 0);

          // 상세보기 패널이 열려있는 경우:
          // - 선택된 공급망(supplyChainId) 카드에서는 "우리회사(tier 0)"가 아니면 엑셀/수정/저장 권한 UI를 숨깁니다.
          // - 다른 공급망 카드들은 기본적으로 엑셀/수정 UI를 유지합니다.
          const showExcelActions = !selectedSupplier
            ? true
            : selectedSupplier.supplyChainId === supplyChainId
              ? isOwnSupplier
              : true;
          
          return (
            <div
              key={supplyChainId}
              className="bg-white"
              style={{
                borderRadius: '16px',
                border: '1px solid #E5E7EB',
              }}
            >
              {/* Group Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-lg flex items-center gap-2">
                      <span>{supplyChain?.name}</span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-700">{product?.name}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      협력사 {supplierOnly.length}개 · Tier {Math.min(...supplierOnly.map(s => s.tier))}~{Math.max(...supplierOnly.map(s => s.tier))}
                    </div>
                  </div>

                  {/* Excel Actions + Map View */}
                  <div className="flex gap-2">
                    {showExcelActions && (
                      <>
                        <button
                          onClick={() => handleDownloadExcel(supplyChainId)}
                          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          엑셀 다운로드
                        </button>
                        <button
                          onClick={() => handleUploadExcel(supplyChainId, suppliers)}
                          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          엑셀 업로드
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleViewMap(supplyChainId)}
                      className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-2 transition-all hover:scale-105"
                      style={{
                        background: mode === 'procurement'
                          ? 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)'
                          : 'linear-gradient(90deg, #00B4FF 0%, #5B3BFA 100%)',
                      }}
                    >
                      <MapPin className="w-4 h-4" />
                      공급망 보기
                    </button>
                    
                    {showExcelActions && (
                      <>
                        {editModeBySupplyChain[supplyChainId] ? (
                          <button
                            onClick={() => {
                              setEditModeBySupplyChain(prev => ({ ...prev, [supplyChainId]: false }));
                              toast.info('편집이 취소되었습니다');
                            }}
                            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            취소
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditModeBySupplyChain(prev => ({ ...prev, [supplyChainId]: true }));
                              toast.info('편집 모드가 활성화되었습니다');
                            }}
                            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            수정
                          </button>
                        )}
                        
                        <button
                          onClick={() => {
                            toast.success('저장되었습니다');
                            setEditModeBySupplyChain(prev => ({ ...prev, [supplyChainId]: false }));
                          }}
                          className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-2 transition-all hover:scale-105"
                          style={{
                            background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                          }}
                        >
                          <Save className="w-4 h-4" />
                          저장
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Suppliers Table */}
              <div className="overflow-x-auto">
                {mode === 'procurement' ? (
                  <table className="w-full">
                    <thead className="bg-[#F6F8FB] border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold">Tier</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">회사명</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">사업장</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">국가</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">분기 납품량</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">월 평균 납품량</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">FEOC</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">RMI</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">인증 광산</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">납품 자재</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">제출 상태</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((supplier) => {
                        const monthlyAvgDelivery = (supplier.quarterlyDelivery / 3).toFixed(1);
                        
                        return (
                          <tr key={supplier.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-xs">
                              <span className={`px-2 py-1 rounded-full font-bold ${
                                supplier.tier === 1 ? 'bg-purple-100 text-purple-700' :
                                supplier.tier === 2 ? 'bg-blue-100 text-blue-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {supplier.tier}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs font-medium">{supplier.companyName}</td>
                            <td className="px-4 py-3 text-xs">{supplier.site}</td>
                            <td className="px-4 py-3 text-xs">{supplier.country}</td>
                            <td className="px-4 py-3 text-xs">
                              <span className="font-bold text-[#5B3BFA]">
                                {supplier.quarterlyDelivery.toLocaleString()} kg
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className="text-gray-500" title="※ 분기 데이터 기준 추정치 (분기 ÷ 3)">
                                {monthlyAvgDelivery} kg
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-center">
                              {supplier.feoc ? (
                                <CheckCircle className="w-4 h-4 text-green-600 inline-block" />
                              ) : (
                                <X className="w-4 h-4 text-red-400 inline-block" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-center">
                              {supplier.rmi ? (
                                <CheckCircle className="w-4 h-4 text-blue-600 inline-block" />
                              ) : (
                                <X className="w-4 h-4 text-red-400 inline-block" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-center">
                              {supplier.certifiedMine ? (
                                <CheckCircle className="w-4 h-4 text-green-600 inline-block" />
                              ) : (
                                <X className="w-4 h-4 text-red-400 inline-block" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs">{supplier.deliveryMaterial}</td>
                            <td className="px-4 py-3 text-xs">{getStatusBadge(supplier.submissionStatus)}</td>
                            <td className="px-4 py-3 text-xs">
                              <button
                                onClick={() => {
                                  setSelectedSupplier(supplier);
                                  setDetailViewMode('procurement');
                                }}
                                className="text-[#5B3BFA] hover:underline"
                              >
                                상세보기
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full">
                    <thead className="bg-[#F6F8FB] border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold">Tier</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">회사명</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">제품명</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">분기 배출량</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">월 추정 배출량</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">에너지 (kWh)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">LNG (m³)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">자재 투입 (kg)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">DQR</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">계산 가능</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((supplier) => {
                        const monthlyAvgEmission = (supplier.quarterlyEmission / 3).toFixed(2);
                        
                        return (
                          <tr key={supplier.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-xs">
                              <span className={`px-2 py-1 rounded-full font-bold ${
                                supplier.tier === 1 ? 'bg-purple-100 text-purple-700' :
                                supplier.tier === 2 ? 'bg-blue-100 text-blue-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {supplier.tier}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs font-medium">{supplier.companyName}</td>
                            <td className="px-4 py-3 text-xs">{supplier.productName}</td>
                            <td className="px-4 py-3 text-xs">
                              <span className="font-bold text-[#00B4FF]">
                                {supplier.quarterlyEmission.toFixed(2)} tCO₂e
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className="text-gray-500" title="※ 분기 데이터 기준 추정치 (분기 ÷ 3)">
                                {monthlyAvgEmission} tCO₂e
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {supplier.energyUsage > 0 ? supplier.energyUsage.toLocaleString() : (
                                <span className="text-red-600">누락</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs">{supplier.lngUsage.toLocaleString()}</td>
                            <td className="px-4 py-3 text-xs">{supplier.materialInput.toLocaleString()}</td>
                            <td className="px-4 py-3 text-xs">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                supplier.dqr < 2 ? 'bg-green-100 text-green-700' :
                                supplier.dqr < 3 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {supplier.dqr}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-center">
                              {supplier.calculable ? (
                                <CheckCircle className="w-4 h-4 text-green-600 inline-block" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-red-600 inline-block" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <button
                                onClick={() => {
                                  setSelectedSupplier(supplier);
                                  setDetailViewMode('pcf');
                                }}
                                className="text-[#00B4FF] hover:underline"
                              >
                                상세보기
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render review status
  const renderReviewStatus = () => {
    const approvedCount = filteredData.filter(d => d.submissionStatus === 'approved').length;
    const reviewCount = filteredData.filter(d => d.submissionStatus === 'review').length;
    const submittedCount = filteredData.filter(d => d.submissionStatus === 'submitted').length;
    const rejectedCount = filteredData.filter(d => d.submissionStatus === 'rejected').length;

    return (
      <div className="space-y-4">
        {/* Workflow Progress */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className={`p-4 rounded-xl ${submittedCount > 0 ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-yellow-600 mb-1">{submittedCount}</div>
            <div className="text-xs text-gray-700">제출완료</div>
          </div>
          
          <div className={`p-4 rounded-xl ${reviewCount > 0 ? 'bg-blue-50 border-2 border-blue-300' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-blue-600 mb-1">{reviewCount}</div>
            <div className="text-xs text-gray-700">검토중</div>
          </div>
          
          <div className={`p-4 rounded-xl ${approvedCount > 0 ? 'bg-green-50 border-2 border-green-300' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-green-600 mb-1">{approvedCount}</div>
            <div className="text-xs text-gray-700">승인완료</div>
          </div>
          
          <div className={`p-4 rounded-xl ${rejectedCount > 0 ? 'bg-red-50 border-2 border-red-300' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-red-600 mb-1">{rejectedCount}</div>
            <div className="text-xs text-gray-700">반려</div>
          </div>
        </div>

        {/* Data table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F6F8FB] border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold">회사명</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Tier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">제출일</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">검토자</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">액션</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-medium">{item.companyName}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                      Tier {item.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{item.submittedDate}</td>
                  <td className="px-4 py-3 text-xs">{item.reviewer || '-'}</td>
                  <td className="px-4 py-3 text-xs">{getStatusBadge(item.submissionStatus)}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex gap-1">
                      {item.submissionStatus === 'submitted' || item.submissionStatus === 'review' ? (
                        <>
                          <button
                            onClick={() => handleApprove(item)}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => handleReject(item)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            반려
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">완료</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filter Panel (for submission tab only) */}
      {supplierTab === 'submission' && (
        <div
          className="bg-white p-6"
          style={{
            borderRadius: '16px',
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <h2 className="text-lg font-semibold mb-4">조회 조건</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">제품 선택</label>
              <select
                value={selectedProduct}
                onChange={(e) => {
                  setSelectedProduct(e.target.value);
                  setSelectedSupplyChain('ALL');
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
              >
                <option value="ALL">전체</option>
                {mockProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">공급망 선택</label>
              <select
                value={selectedSupplyChain}
                onChange={(e) => setSelectedSupplyChain(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
              >
                <option value="ALL">전체</option>
                {availableSupplyChains.map(sc => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">차수 선택</label>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
              >
                <option value="ALL">전체</option>
                <option value="1">1차</option>
                <option value="2">2차까지</option>
                <option value="3">3차까지</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">제출 상태</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
              >
                <option value="ALL">전체</option>
                <option value="submitted">제출완료</option>
                <option value="review">검토중</option>
                <option value="approved">승인완료</option>
                <option value="rejected">반려</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">국가</label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
              >
                <option value="ALL">전체</option>
                {availableCountries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">기간 선택</label>
              <MonthRangePicker
                startMonth={selectedPeriodStart || null}
                endMonth={selectedPeriodEnd || null}
                onChange={(start, end) => {
                  setSelectedPeriodStart(start || '');
                  setSelectedPeriodEnd(end || '');
                  setPeriodError('');
                }}
                error={periodError}
              />
            </div>
          </div>

          <div className="flex gap-3">
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
          </div>
        </div>
      )}

      {/* Content Panel */}
      <div
        className="bg-white"
        style={{
          borderRadius: '16px',
          boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        {/* Tab Headers */}
        <div className="border-b border-gray-200 px-4">
          <div className="flex gap-2">
            <button
              onClick={() => setSupplierTab('submission')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                supplierTab === 'submission'
                  ? mode === 'procurement' ? 'border-[#5B3BFA] text-[#5B3BFA]' : 'border-[#00B4FF] text-[#00B4FF]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              협력사 제출 데이터
            </button>
            <button
              onClick={() => setSupplierTab('review')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                supplierTab === 'review'
                  ? 'border-[#5B3BFA] text-[#5B3BFA]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              검토/승인 현황
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {supplierTab === 'submission' && renderSubmissionData()}
          {supplierTab === 'review' && renderReviewStatus()}
        </div>
      </div>

      {/* Supply Chain Map Modal */}
      {showMapModal && selectedMapSupplyChain && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white w-full h-full relative flex flex-col"
            style={{
              maxWidth: '1400px',
              maxHeight: '90vh',
              borderRadius: '20px',
            }}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold">{selectedMapSupplyChain.name} | {selectedMapSupplyChain.productName}</h2>
                <p className="text-sm text-gray-600 mt-1">공급망 구조 시각화</p>
              </div>

              <div className="flex items-center gap-4">
                {/* Mode Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setMapViewMode('procurement')}
                    className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                      mapViewMode === 'procurement'
                        ? 'bg-purple-100 text-[#5B3BFA] font-semibold'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    구매 직무
                  </button>
                  <button
                    onClick={() => setMapViewMode('pcf')}
                    className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                      mapViewMode === 'pcf'
                        ? 'bg-blue-100 text-[#00B4FF] font-semibold'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    ESG 직무
                  </button>
                </div>

                <button
                  onClick={() => setShowMapModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <SupplyChainMap
                versionId={selectedMapSupplyChain.id}
                highlightedNode={null}
              />
            </div>
          </div>
        </div>
      )}

      {/* Right Slide Panel for Detail View */}
      {selectedSupplier && (
        <>
          <div
            className="fixed right-0 top-0 h-full bg-white shadow-2xl z-50 overflow-y-auto"
            style={{ width: '480px' }}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold">{selectedSupplier.companyName}</h2>
              <button
                onClick={() => setSelectedSupplier(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Toggle in Detail Panel */}
            <div className="px-6 py-3 border-b border-gray-200 flex gap-2">
              <button
                onClick={() => setDetailViewMode('procurement')}
                className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                  detailViewMode === 'procurement'
                    ? 'bg-purple-100 text-[#5B3BFA] font-semibold'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                구매 직무 검토
              </button>
              <button
                onClick={() => setDetailViewMode('pcf')}
                className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                  detailViewMode === 'pcf'
                    ? 'bg-blue-100 text-[#00B4FF] font-semibold'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ESG 직무 검토
              </button>
            </div>

            <div className="p-6">
              {/* Basic Info */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3">기본 정보</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tier:</span>
                    <span className="font-medium">Tier {selectedSupplier.tier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">국가:</span>
                    <span>{selectedSupplier.country}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">사업장:</span>
                    <span>{selectedSupplier.site}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">제출일:</span>
                    <span>{selectedSupplier.submittedDate}</span>
                  </div>
                </div>
              </div>

              {/* View-specific content */}
              {detailViewMode === 'procurement' ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-3">차수 적합성</h3>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-xs text-green-700">✓ 공급망 구조 적합</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-3">규제 위험 검토</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">FEOC:</span>
                        {selectedSupplier.feoc ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">RMI 인증:</span>
                        {selectedSupplier.rmi ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">인증 광산:</span>
                        {selectedSupplier.certifiedMine ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-3">납품 정보</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">자재:</span>
                        <span className="ml-2 font-medium">{selectedSupplier.deliveryMaterial}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">광물 함량:</span>
                        <span className="ml-2 text-xs">{selectedSupplier.mineralContent}</span>
                      </div>
                    </div>
                  </div>

                  {!isOwnSupplier && (
                    <button
                      onClick={() => handleRequestRevision(selectedSupplier)}
                      className="w-full px-4 py-2 border border-[#5B3BFA] text-[#5B3BFA] rounded-lg hover:bg-purple-50"
                    >
                      수정 요청
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-3">데이터 누락 경고</h3>
                    {selectedSupplier.missingFields.length > 0 ? (
                      <div className="p-3 bg-red-50 rounded-lg">
                        <ul className="text-xs text-red-600 space-y-1">
                          {selectedSupplier.missingFields.map((field, idx) => (
                            <li key={idx}>• {field}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-xs text-green-700">✓ 필수 데이터 모두 입력됨</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-3">DQR 점수</h3>
                    <div className="flex items-center justify-between">
                      <span className={`text-2xl font-bold ${
                        selectedSupplier.dqr < 2 ? 'text-green-600' :
                        selectedSupplier.dqr < 3 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {selectedSupplier.dqr}
                      </span>
                      <span className="text-xs text-gray-500">
                        {selectedSupplier.dqr < 2 ? '우수' : selectedSupplier.dqr < 3 ? '보통' : '개선 필요'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-3">배출계수 연결 상태</h3>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-700">연결됨 (ecoinvent 3.9)</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-3">계산 가능 여부</h3>
                    <div className={`p-3 rounded-lg ${selectedSupplier.calculable ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className={`text-xs ${selectedSupplier.calculable ? 'text-green-700' : 'text-red-700'}`}>
                        {selectedSupplier.calculable ? '✓ PCF 계산 가능' : '✗ 데이터 보완 필요'}
                      </div>
                    </div>
                  </div>

                  {!isOwnSupplier && (
                    <button
                      onClick={() => handleRequestRevision(selectedSupplier)}
                      className="w-full px-4 py-2 border border-[#00B4FF] text-[#00B4FF] rounded-lg hover:bg-blue-50"
                    >
                      재요청
                    </button>
                  )}
                </div>
              )}

              {/* Action buttons */}
              {isOwnSupplier && (
                <div className="mt-6 pt-6 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={() => {
                      handleReject(selectedSupplier);
                      setSelectedSupplier(null);
                    }}
                    className="flex-1 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    반려
                  </button>
                  <button
                    onClick={() => {
                      handleApprove(selectedSupplier);
                      setSelectedSupplier(null);
                    }}
                    className="flex-1 px-4 py-2 text-white rounded-lg"
                    style={{
                      background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                    }}
                  >
                    승인
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-40"
            onClick={() => setSelectedSupplier(null)}
          />
        </>
      )}

      {/* Excel Upload Modal */}
      {showUploadModal && uploadTarget && (
        <SupplierExcelUploadModal
          onClose={() => {
            setShowUploadModal(false);
            setUploadTarget(null);
          }}
          supplyChainInfo={uploadTarget}
        />
      )}
    </div>
  );
}