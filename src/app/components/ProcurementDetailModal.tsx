import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface DataNode {
  id: string;
  tier: string;
  companyName: string;
  companyNameEn: string;
  country: string;
  supplierType: string;
  feoc: boolean;
  rmi: boolean;
  certExpiry: string | null;
  connectedProducts: number;
  riskLevel: 'high' | 'medium' | 'low';
  alternativeAvailable: boolean;
  scope1: number;
  scope2: number;
  mainMaterial: string;
  emissionSource: string;
  pcfResult: number;
  dqr: number;
  submissionStatus: 'verified' | 'submitted' | 'pending';
  lastUpdate: string;
  children?: DataNode[];
}

interface Props {
  company: any;
  onClose: () => void;
  selectedPeriodStart?: string;
  selectedPeriodEnd?: string;
}

// Mock quarterly delivery data
const mockQuarterlyDeliveryData = [
  {
    id: '1',
    quarter: '2025-Q4',
    deliveryAmount: 7200,
    monthlyAvg: 2400,
    certMaintained: true,
    riskLevel: 'low' as const,
    submissionStatus: 'verified' as const,
    changeFromPrevious: 5.2,
  },
  {
    id: '2',
    quarter: '2025-Q3',
    deliveryAmount: 6840,
    monthlyAvg: 2280,
    certMaintained: true,
    riskLevel: 'low' as const,
    submissionStatus: 'verified' as const,
    changeFromPrevious: -2.1,
  },
  {
    id: '3',
    quarter: '2025-Q2',
    deliveryAmount: 6990,
    monthlyAvg: 2330,
    certMaintained: true,
    riskLevel: 'medium' as const,
    submissionStatus: 'verified' as const,
    changeFromPrevious: 8.3,
  },
  {
    id: '4',
    quarter: '2025-Q1',
    deliveryAmount: 6450,
    monthlyAvg: 2150,
    certMaintained: false,
    riskLevel: 'medium' as const,
    submissionStatus: 'submitted' as const,
    changeFromPrevious: 0,
  },
];

// Mock certification/regulation status changes
const mockCertificationData = [
  {
    id: '1',
    quarter: '2025-Q4',
    feoc: true,
    rmi: true,
    certifiedSupply: true,
    changes: '',
  },
  {
    id: '2',
    quarter: '2025-Q3',
    feoc: true,
    rmi: true,
    certifiedSupply: true,
    changes: '',
  },
  {
    id: '3',
    quarter: '2025-Q2',
    feoc: true,
    rmi: false,
    certifiedSupply: true,
    changes: 'RMI 인증 만료 (2025-05-15)',
  },
  {
    id: '4',
    quarter: '2025-Q1',
    feoc: true,
    rmi: true,
    certifiedSupply: true,
    changes: '',
  },
];

// Mock Tier-based cumulative summary
const mockTierSummaryData = [
  {
    id: '1',
    tier: 'Tier 1',
    companyName: '한국배터리',
    quarterlyDelivery: 7200,
    monthlyAvg: 2400,
    certStatus: 'all' as const,
    riskLevel: 'low' as const,
  },
  {
    id: '2',
    tier: 'Tier 2',
    companyName: '셀테크',
    quarterlyDelivery: 3450,
    monthlyAvg: 1150,
    certStatus: 'partial' as const,
    riskLevel: 'medium' as const,
  },
  {
    id: '3',
    tier: 'Tier 3',
    companyName: '리튬소재',
    quarterlyDelivery: 14400,
    monthlyAvg: 4800,
    certStatus: 'all' as const,
    riskLevel: 'low' as const,
  },
];

export default function ProcurementDetailModal({ company, onClose, selectedPeriodStart, selectedPeriodEnd }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(mockQuarterlyDeliveryData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = mockQuarterlyDeliveryData.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const getRiskBadge = (riskLevel: 'high' | 'medium' | 'low') => {
    switch (riskLevel) {
      case 'low':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">낮음</span>;
      case 'medium':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">보통</span>;
      case 'high':
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">높음</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">승인</span>;
      case 'submitted':
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">제출</span>;
      case 'pending':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">대기</span>;
      default:
        return null;
    }
  };

  const getCertStatusBadge = (status: 'all' | 'partial' | 'none') => {
    switch (status) {
      case 'all':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">전체 인증</span>;
      case 'partial':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">일부 인증</span>;
      case 'none':
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">미인증</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white w-full flex flex-col"
        style={{
          maxWidth: '1400px',
          minHeight: '700px',
          maxHeight: '90vh',
          borderRadius: '20px',
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">{company.companyName}</h2>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    company.tier === 'Tier 0'
                      ? 'bg-gray-100 text-gray-700 border-2 border-[#5B3BFA]'
                      : 'bg-[#5B3BFA] text-white'
                  }`}
                >
                  {company.tier}
                </span>
                {company.tier === 'Tier 0' && (
                  <span className="inline-block px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-semibold">
                    원청
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <p className="text-gray-600">{company.companyNameEn}</p>
                {selectedPeriodStart && selectedPeriodEnd && (
                  <span className="text-sm text-gray-500">
                    📅 조회 기간: <span className="font-semibold text-[#5B3BFA]">{selectedPeriodStart}</span> ~ <span className="font-semibold text-[#5B3BFA]">{selectedPeriodEnd}</span>
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-6 space-y-8">
          {/* Table A - 분기별 납품 현황 */}
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="text-[#5B3BFA]">📊</span> 분기별 납품 현황
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-[#F6F8FB]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">분기</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">납품량 (kg)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200 text-gray-500">
                      월 평균 납품량 (kg)
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">전분기 대비</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">인증 유지</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">리스크 등급</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">제출 상태</th>
                  </tr>
                </thead>
                <tbody>
                  {mockQuarterlyDeliveryData.map((data, index) => {
                    const hasChange = data.changeFromPrevious !== 0;
                    const isIncrease = data.changeFromPrevious > 0;
                    
                    return (
                      <tr key={data.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4 font-bold text-sm">{data.quarter}</td>
                        <td className="px-4 py-4 text-sm">
                          <span className="font-bold text-[#5B3BFA]">
                            {data.deliveryAmount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span className="text-gray-500" title="※ 분기 데이터 기준 추정치 (분기 ÷ 3)">
                            {data.monthlyAvg.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {hasChange ? (
                            <span className={`flex items-center gap-1 font-semibold ${
                              isIncrease ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {isIncrease ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              {Math.abs(data.changeFromPrevious)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-center">
                          {data.certMaintained ? (
                            <CheckCircle className="w-5 h-5 text-green-600 inline-block" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-red-600 inline-block" />
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm">{getRiskBadge(data.riskLevel)}</td>
                        <td className="px-4 py-4 text-sm">{getStatusBadge(data.submissionStatus)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table B - 협력사 인증/규제 상태 변화 */}
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="text-[#5B3BFA]">🔐</span> 인증 및 규제 상태 변화
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-[#F6F8FB]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">분기</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold border-b border-gray-200">FEOC</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold border-b border-gray-200">RMI</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold border-b border-gray-200">인증공급 여부</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">변경사항</th>
                  </tr>
                </thead>
                <tbody>
                  {mockCertificationData.map((data) => (
                    <tr key={data.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4 font-bold text-sm">{data.quarter}</td>
                      <td className="px-4 py-4 text-center">
                        {data.feoc ? (
                          <CheckCircle className="w-5 h-5 text-green-600 inline-block" />
                        ) : (
                          <X className="w-5 h-5 text-red-400 inline-block" />
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {data.rmi ? (
                          <CheckCircle className="w-5 h-5 text-blue-600 inline-block" />
                        ) : (
                          <X className="w-5 h-5 text-red-400 inline-block" />
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {data.certifiedSupply ? (
                          <CheckCircle className="w-5 h-5 text-green-600 inline-block" />
                        ) : (
                          <X className="w-5 h-5 text-red-400 inline-block" />
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {data.changes ? (
                          <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-lg font-medium">
                            {data.changes}
                          </span>
                        ) : (
                          <span className="text-gray-400">변경 없음</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table C - Tier별 누적 요약 */}
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="text-[#5B3BFA]">📈</span> Tier별 누적 요약
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-[#F6F8FB]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">Tier</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">회사명</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">분기 납품량 (kg)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200 text-gray-500">
                      월 평균 (kg)
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">인증 상태</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-200">리스크</th>
                  </tr>
                </thead>
                <tbody>
                  {mockTierSummaryData.map((data) => (
                    <tr key={data.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full font-bold ${
                          data.tier === 'Tier 1' ? 'bg-purple-100 text-purple-700' :
                          data.tier === 'Tier 2' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {data.tier}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium">{data.companyName}</td>
                      <td className="px-4 py-4 text-sm">
                        <span className="font-bold text-[#5B3BFA]">
                          {data.quarterlyDelivery.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className="text-gray-500">
                          {data.monthlyAvg.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">{getCertStatusBadge(data.certStatus)}</td>
                      <td className="px-4 py-4 text-sm">{getRiskBadge(data.riskLevel)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-600">
            선택 기간 내 <span className="font-semibold text-[#5B3BFA]">{mockQuarterlyDeliveryData.length}</span>개 분기 데이터 표시
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2 text-white rounded-lg font-medium transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
