import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

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
}

// Mock monthly data
const mockMonthlyData = [
  {
    id: '1',
    month: '2026-01',
    scope1: 1250.5,
    scope2: 3420.8,
    mainMaterial: '조립 부품',
    emissionFactor: 'Internal DB v2.1',
    pcfResult: 15842.3,
    submittedDate: '2026-02-05',
  },
  {
    id: '2',
    month: '2025-12',
    scope1: 1180.2,
    scope2: 3310.5,
    mainMaterial: '조립 부품',
    emissionFactor: 'Internal DB v2.0',
    pcfResult: 15320.1,
    submittedDate: '2026-01-05',
  },
  {
    id: '3',
    month: '2025-11',
    scope1: 1220.8,
    scope2: 3280.3,
    mainMaterial: '조립 부품',
    emissionFactor: 'Internal DB v2.0',
    pcfResult: 15450.6,
    submittedDate: '2025-12-05',
  },
  {
    id: '4',
    month: '2025-10',
    scope1: 1190.5,
    scope2: 3350.2,
    mainMaterial: '조립 부품',
    emissionFactor: 'Internal DB v1.9',
    pcfResult: 15280.8,
    submittedDate: '2025-11-05',
  },
  {
    id: '5',
    month: '2025-09',
    scope1: 1240.3,
    scope2: 3400.1,
    mainMaterial: '조립 부품',
    emissionFactor: 'Internal DB v1.9',
    pcfResult: 15520.4,
    submittedDate: '2025-10-05',
  },
  {
    id: '6',
    month: '2025-08',
    scope1: 1210.7,
    scope2: 3290.5,
    mainMaterial: '조립 부품',
    emissionFactor: 'Internal DB v1.9',
    pcfResult: 15380.2,
    submittedDate: '2025-09-05',
  },
  {
    id: '7',
    month: '2025-07',
    scope1: 1230.4,
    scope2: 3320.8,
    mainMaterial: '조립 부품',
    emissionFactor: 'Internal DB v1.8',
    pcfResult: 15420.5,
    submittedDate: '2025-08-05',
  },
  {
    id: '8',
    month: '2025-06',
    scope1: 1200.2,
    scope2: 3270.6,
    mainMaterial: '조립 부품',
    emissionFactor: 'Internal DB v1.8',
    pcfResult: 15310.8,
    submittedDate: '2025-07-05',
  },
  {
    id: '9',
    month: '2025-05',
    scope1: 1260.1,
    scope2: 3380.4,
    mainMaterial: '조립 부품',
    emissionFactor: 'Internal DB v1.8',
    pcfResult: 15580.3,
    submittedDate: '2025-06-05',
  },
  {
    id: '10',
    month: '2025-04',
    scope1: 1220.6,
    scope2: 3300.2,
    mainMaterial: '조립 부품',
    emissionFactor: 'Internal DB v1.7',
    pcfResult: 15410.7,
    submittedDate: '2025-05-05',
  },
  {
    id: '11',
    month: '2025-03',
    scope1: 1190.8,
    scope2: 3260.5,
    mainMaterial: '조립 부품',
    emissionFactor: 'Internal DB v1.7',
    pcfResult: 15290.4,
    submittedDate: '2025-04-05',
  },
  {
    id: '12',
    month: '2025-02',
    scope1: 1250.3,
    scope2: 3410.7,
    mainMaterial: '조립 부품',
    emissionFactor: 'Internal DB v1.7',
    pcfResult: 15830.2,
    submittedDate: '2025-03-05',
  },
];

export default function PcfDetailModal({ company, onClose }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(mockMonthlyData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = mockMonthlyData.slice(startIndex, endIndex);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">검증완료</span>;
      case 'submitted':
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">제출완료</span>;
      case 'pending':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">대기중</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white w-full flex flex-col"
        style={{
          maxWidth: '1200px',
          minHeight: '650px',
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
                {getStatusBadge(company.submissionStatus)}
              </div>
              <p className="text-gray-600">{company.companyNameEn}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Table Content - Scrollable */}
        <div className="flex-1 overflow-auto p-6">
          <h3 className="text-lg font-bold mb-4">월별 입력 데이터</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F6F8FB] sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">연월</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Scope 1</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Scope 2</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">주요 자재 투입량</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">배출계수 출처</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">PCF 결과</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">제출일</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((data) => (
                  <tr key={data.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-4 font-medium">{data.month}</td>
                    <td className="px-4 py-4 text-sm">{data.scope1.toLocaleString()} kg CO₂e</td>
                    <td className="px-4 py-4 text-sm">{data.scope2.toLocaleString()} kg CO₂e</td>
                    <td className="px-4 py-4 text-sm">{data.mainMaterial}</td>
                    <td className="px-4 py-4 text-sm">{data.emissionFactor}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-[#5B3BFA]">
                      {data.pcfResult.toLocaleString()} kg CO₂e
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{data.submittedDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination - Fixed at bottom */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-600">
            총 <span className="font-semibold text-[#5B3BFA]">{mockMonthlyData.length}</span>건 중{' '}
            <span className="font-semibold">{startIndex + 1}</span>-
            <span className="font-semibold">{Math.min(endIndex, mockMonthlyData.length)}</span>건 표시
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-[#5B3BFA] text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}