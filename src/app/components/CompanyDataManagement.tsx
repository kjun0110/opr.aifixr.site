import { useState, useMemo } from 'react';
import { Download, Upload, Save, CheckCircle, Clock, AlertTriangle, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMode } from '../context/ModeContext';
import ExcelUploadModal from './ExcelUploadModal';
import MonthPicker from './MonthPicker';

// Internal company data structure - monthly input based
interface CompanyMonthlyData {
  id: string;
  period: string; // YYYY-MM
  site: string;
  factory: string;
  process: string;
  
  // Procurement fields
  productionVolume?: number; // 생산량
  deliveryVolume?: number; // 납품량
  operationRate?: number; // 가동률 (%)
  dataStatus?: 'temp' | 'confirmed' | 'reviewed'; // 임시저장/확정/검토완료
  
  // PCF fields
  electricityUsage?: number; // 전력 사용량 (kWh)
  lngUsage?: number; // LNG 사용량 (m³)
  scope1?: number; // Scope 1 (tCO₂e)
  scope2?: number; // Scope 2 (tCO₂e)
  dqr?: number; // DQR
  calculationStatus?: 'calculated' | 'uncalculated' | 'reviewing'; // 계산완료/미계산/검토중
  calculable?: boolean; // 계산 가능 여부
  
  modifiedDate: string;
  modifiedBy: string;
}

const mockCompanyData: CompanyMonthlyData[] = [
  {
    id: '1',
    period: '2026-03',
    site: '서울사업장',
    factory: '1공장',
    process: '조립공정',
    productionVolume: 12500,
    deliveryVolume: 12000,
    operationRate: 96.5,
    dataStatus: 'confirmed',
    electricityUsage: 850500,
    lngUsage: 12450,
    scope1: 28.3,
    scope2: 420.5,
    dqr: 1.5,
    calculationStatus: 'calculated',
    calculable: true,
    modifiedDate: '2026-03-02',
    modifiedBy: '김철수',
  },
  {
    id: '2',
    period: '2026-03',
    site: '서울사업장',
    factory: '1공장',
    process: '용접공정',
    productionVolume: 8400,
    deliveryVolume: 8200,
    operationRate: 92.3,
    dataStatus: 'reviewed',
    electricityUsage: 620800,
    lngUsage: 8520,
    scope1: 19.5,
    scope2: 310.4,
    dqr: 1.8,
    calculationStatus: 'calculated',
    calculable: true,
    modifiedDate: '2026-03-01',
    modifiedBy: '이영희',
  },
  {
    id: '3',
    period: '2026-03',
    site: '부산사업장',
    factory: '2공장',
    process: '도장공정',
    productionVolume: 5600,
    deliveryVolume: 5500,
    operationRate: 88.7,
    dataStatus: 'temp',
    electricityUsage: 420300,
    lngUsage: 6180,
    scope1: 14.2,
    scope2: 210.2,
    dqr: 2.1,
    calculationStatus: 'reviewing',
    calculable: true,
    modifiedDate: '2026-03-03',
    modifiedBy: '박지성',
  },
  {
    id: '4',
    period: '2026-02',
    site: '서울사업장',
    factory: '1공장',
    process: '조립공정',
    productionVolume: 11800,
    deliveryVolume: 11500,
    operationRate: 94.2,
    dataStatus: 'confirmed',
    electricityUsage: 820400,
    lngUsage: 11950,
    scope1: 27.1,
    scope2: 405.2,
    dqr: 1.6,
    calculationStatus: 'calculated',
    calculable: true,
    modifiedDate: '2026-02-28',
    modifiedBy: '김철수',
  },
  {
    id: '5',
    period: '2026-02',
    site: '인천사업장',
    factory: '3공장',
    process: '검사공정',
    productionVolume: 9200,
    deliveryVolume: 9100,
    operationRate: 90.5,
    dataStatus: 'reviewed',
    electricityUsage: 580200,
    lngUsage: 7850,
    scope1: 18.0,
    scope2: 290.1,
    dqr: 1.9,
    calculationStatus: 'calculated',
    calculable: true,
    modifiedDate: '2026-02-27',
    modifiedBy: '최민수',
  },
  {
    id: '6',
    period: '2026-01',
    site: '부산사업장',
    factory: '2공장',
    process: '도장공정',
    productionVolume: 5400,
    deliveryVolume: 5200,
    operationRate: 85.3,
    dataStatus: 'confirmed',
    electricityUsage: 405600,
    lngUsage: 5920,
    scope1: 13.5,
    scope2: 202.8,
    dqr: 2.0,
    calculationStatus: 'uncalculated',
    calculable: false,
    modifiedDate: '2026-01-31',
    modifiedBy: '박지성',
  },
];

export default function CompanyDataManagement() {
  const { mode } = useMode();
  
  const [data] = useState<CompanyMonthlyData[]>(mockCompanyData);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Query filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-03');
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  const [selectedProcess, setSelectedProcess] = useState<string>('ALL');
  const [selectedDataStatus, setSelectedDataStatus] = useState<string>('ALL'); // 구매관점
  const [selectedCalcStatus, setSelectedCalcStatus] = useState<string>('ALL'); // PCF관점
  const [hasQueried, setHasQueried] = useState(false);

  // Generate period options (last 24 months)
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

  // Extract unique values for filters
  const availableSites = useMemo(() => {
    const sites = new Set(data.map(item => item.site));
    return Array.from(sites).sort();
  }, [data]);

  const availableFactories = useMemo(() => {
    const factories = new Set(data.map(item => item.factory));
    return Array.from(factories).sort();
  }, [data]);

  const availableProcesses = useMemo(() => {
    const processes = new Set(data.map(item => item.process));
    return Array.from(processes).sort();
  }, [data]);

  // Filter data based on selections
  const filteredData = useMemo(() => {
    if (!hasQueried) return [];
    
    return data.filter(item => {
      if (selectedPeriod !== 'ALL' && item.period !== selectedPeriod) return false;
      if (selectedSite !== 'ALL' && item.site !== selectedSite) return false;
      if (selectedFactory !== 'ALL' && item.factory !== selectedFactory) return false;
      if (selectedProcess !== 'ALL' && item.process !== selectedProcess) return false;
      
      if (mode === 'procurement') {
        if (selectedDataStatus !== 'ALL' && item.dataStatus !== selectedDataStatus) return false;
      } else {
        if (selectedCalcStatus !== 'ALL' && item.calculationStatus !== selectedCalcStatus) return false;
      }
      
      return true;
    });
  }, [data, hasQueried, selectedPeriod, selectedSite, selectedFactory, selectedProcess, selectedDataStatus, selectedCalcStatus, mode]);

  const handleQuery = () => {
    setHasQueried(true);
    toast.success('조회가 완료되었습니다');
  };

  const handleReset = () => {
    setSelectedPeriod('2026-03');
    setSelectedSite('ALL');
    setSelectedFactory('ALL');
    setSelectedProcess('ALL');
    setSelectedDataStatus('ALL');
    setSelectedCalcStatus('ALL');
    setHasQueried(false);
  };

  const handleSave = () => {
    toast.success('데이터가 저장되었습니다');
  };

  const handleUpload = () => {
    setShowUploadModal(true);
  };

  const handleUploadComplete = () => {
    setShowUploadModal(false);
    toast.success('엑셀 업로드가 완료되었습니다');
  };

  const handleExport = () => {
    toast.success('엑셀 파일을 다운로드합니다');
  };

  const handleEdit = (id: string) => {
    toast.info(`데이터 ID ${id} 수정 모달 열기 (구현 예정)`);
  };

  const getDataStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">확정</span>;
      case 'reviewed':
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">검토완료</span>;
      case 'temp':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">임시저장</span>;
      default:
        return null;
    }
  };

  const getCalcStatusBadge = (status: string) => {
    switch (status) {
      case 'calculated':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">계산완료</span>;
      case 'reviewing':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">검토중</span>;
      case 'uncalculated':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">미계산</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Query Condition Card */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        <h2 className="text-xl font-semibold mb-6">조회 조건</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Period */}
          <div>
            <label className="block text-sm font-medium mb-2">기간 (월 단위)</label>
            <MonthPicker
              selectedMonth={selectedPeriod}
              onChange={(month) => setSelectedPeriod(month || 'ALL')}
              placeholder="기간 선택"
            />
          </div>

          {/* Site */}
          <div>
            <label className="block text-sm font-medium mb-2">사업장</label>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
            >
              <option value="ALL">전체</option>
              {availableSites.map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>

          {/* Factory */}
          <div>
            <label className="block text-sm font-medium mb-2">공장</label>
            <select
              value={selectedFactory}
              onChange={(e) => setSelectedFactory(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
            >
              <option value="ALL">전체</option>
              {availableFactories.map(factory => (
                <option key={factory} value={factory}>{factory}</option>
              ))}
            </select>
          </div>

          {/* Process */}
          <div>
            <label className="block text-sm font-medium mb-2">공정</label>
            <select
              value={selectedProcess}
              onChange={(e) => setSelectedProcess(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
            >
              <option value="ALL">전체</option>
              {availableProcesses.map(process => (
                <option key={process} value={process}>{process}</option>
              ))}
            </select>
          </div>

          {/* Mode-specific filter */}
          {mode === 'procurement' ? (
            <div>
              <label className="block text-sm font-medium mb-2">데이터 상태</label>
              <select
                value={selectedDataStatus}
                onChange={(e) => setSelectedDataStatus(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
              >
                <option value="ALL">전체</option>
                <option value="temp">임시저장</option>
                <option value="confirmed">확정</option>
                <option value="reviewed">검토완료</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">산정 상태</label>
              <select
                value={selectedCalcStatus}
                onChange={(e) => setSelectedCalcStatus(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00B4FF]"
              >
                <option value="ALL">전체</option>
                <option value="calculated">계산완료</option>
                <option value="uncalculated">미계산</option>
                <option value="reviewing">검토중</option>
              </select>
            </div>
          )}
        </div>

        {/* Action Buttons */}
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

      {/* Table Content */}
      {hasQueried && (
        <div
          className="bg-white"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          {/* Header with Actions */}
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">
                {mode === 'procurement' ? '자사 생산 데이터' : '자사 배출량 데이터'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                총 <span className={`font-semibold ${mode === 'procurement' ? 'text-[#5B3BFA]' : 'text-[#00B4FF]'}`}>{filteredData.length}</span>건
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                엑셀 다운로드
              </button>

              <button
                onClick={handleUpload}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
              >
                <Upload className="w-4 h-4" />
                엑셀 업로드
              </button>

              {isEditMode ? (
                <button
                  onClick={() => {
                    setIsEditMode(false);
                    toast.info('편집이 취소되었습니다');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  취소
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsEditMode(true);
                    toast.info('편집 모드가 활성화되었습니다');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  수정
                </button>
              )}

              <button
                onClick={() => {
                  handleSave();
                  setIsEditMode(false);
                }}
                className="px-4 py-2 text-white rounded-lg transition-all hover:scale-105 flex items-center gap-2 text-sm"
                style={{
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                }}
              >
                <Save className="w-4 h-4" />
                저장
              </button>
            </div>
          </div>

          {/* Table */}
          <div className={`overflow-x-auto transition-colors ${isEditMode ? 'bg-blue-50/30' : ''}`}>
            {mode === 'procurement' ? (
              // Procurement View Table
              <table className="w-full">
                <thead className="bg-[#F6F8FB] border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">기간</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">사업장</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">공장</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">공정</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">생산량 (units)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">납품량 (units)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">가동률 (%)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">입력 상태</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">수정일</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => (
                    <tr key={item.id} className={`border-b border-gray-100 ${isEditMode ? 'hover:bg-blue-100/50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-4 text-sm font-bold">{item.period}</td>
                      <td className="px-4 py-4 text-sm">{item.site}</td>
                      <td className="px-4 py-4 text-sm">{item.factory}</td>
                      <td className="px-4 py-4 text-sm">{item.process}</td>
                      <td className="px-4 py-4 text-sm">
                        <span className="font-semibold text-[#5B3BFA]">
                          {item.productionVolume?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className="font-semibold">
                          {item.deliveryVolume?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className={`font-semibold ${
                          (item.operationRate || 0) >= 95 ? 'text-green-600' :
                          (item.operationRate || 0) >= 85 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {item.operationRate?.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {item.dataStatus && getDataStatusBadge(item.dataStatus)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{item.modifiedDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              // PCF View Table
              <table className="w-full">
                <thead className="bg-[#F6F8FB] border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">기간</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">사업장</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">공장</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">공정</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">전력 (kWh)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">LNG (m³)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Scope 1 (tCO₂e)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Scope 2 (tCO₂e)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">DQR</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">계산 가능</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">산정 상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => (
                    <tr key={item.id} className={`border-b border-gray-100 ${isEditMode ? 'hover:bg-blue-100/50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-4 text-sm font-bold">{item.period}</td>
                      <td className="px-4 py-4 text-sm">{item.site}</td>
                      <td className="px-4 py-4 text-sm">{item.factory}</td>
                      <td className="px-4 py-4 text-sm">{item.process}</td>
                      <td className="px-4 py-4 text-sm">
                        <span className="font-semibold">
                          {item.electricityUsage?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className="font-semibold">
                          {item.lngUsage?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className="font-semibold text-[#00B4FF]">
                          {item.scope1?.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className="font-semibold text-[#00B4FF]">
                          {item.scope2?.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className={`font-semibold ${
                          (item.dqr || 0) <= 1.5 ? 'text-green-600' :
                          (item.dqr || 0) <= 2.0 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {item.dqr?.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-center">
                        {item.calculable ? (
                          <CheckCircle className="w-5 h-5 text-green-600 inline-block" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-600 inline-block" />
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {item.calculationStatus && getCalcStatusBadge(item.calculationStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Excel Upload Modal */}
      {showUploadModal && (
        <ExcelUploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUploadComplete}
        />
      )}
    </div>
  );
}