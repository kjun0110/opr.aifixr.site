'use client';

import { useState } from 'react';
import { Search, Filter, Download, Info, CheckCircle, AlertTriangle, Clock, X } from 'lucide-react';
import { toast } from 'sonner';

type TabType = 'rmi' | 'feoc';

interface RMICompany {
  id: string;
  companyName: string;
  country: string;
  certificationNumber: string;
  certificationType: string;
  validityPeriod: string;
  status: 'active' | 'expiring' | 'expired';
  isOurSupplier: boolean;
  // Our supplier details
  tier?: string;
  product?: string;
  project?: string;
  registeredDate?: string;
  submissionStatus?: string;
}

interface FEOCCompany {
  id: string;
  companyName: string;
  tier: string;
  country: string;
  feocStatus: 'applicable' | 'not-applicable' | 'under-review' | 'insufficient-info';
  reviewStatus: string;
  lastUpdate: string;
}

// Mock RMI data
const mockRMIData: RMICompany[] = [
  {
    id: '1',
    companyName: 'Korea Battery Co.',
    country: 'South Korea',
    certificationNumber: 'RMI-2023-001234',
    certificationType: 'Conformant Smelter',
    validityPeriod: '2026-12-31',
    status: 'active',
    isOurSupplier: true,
    tier: 'Tier 1',
    product: 'Battery Module A',
    project: 'BMW Munich',
    registeredDate: '2025-01-15',
    submissionStatus: '검증완료',
  },
  {
    id: '2',
    companyName: 'Cell Tech Inc.',
    country: 'China',
    certificationNumber: 'RMI-2023-005678',
    certificationType: 'Active Smelter',
    validityPeriod: '2026-06-30',
    status: 'expiring',
    isOurSupplier: true,
    tier: 'Tier 2',
    product: 'Battery Module A',
    project: 'BMW Munich',
    registeredDate: '2025-02-20',
    submissionStatus: '제출완료',
  },
  {
    id: '3',
    companyName: 'Global Metals Corp.',
    country: 'USA',
    certificationNumber: 'RMI-2022-009876',
    certificationType: 'Conformant Smelter',
    validityPeriod: '2027-03-31',
    status: 'active',
    isOurSupplier: false,
  },
  {
    id: '4',
    companyName: 'Lithium Mine Corp.',
    country: 'Australia',
    certificationNumber: 'RMI-2023-002468',
    certificationType: 'Conformant Mine',
    validityPeriod: '2026-09-30',
    status: 'active',
    isOurSupplier: true,
    tier: 'Tier 3',
    product: 'Battery Module A',
    project: 'BMW Munich',
    registeredDate: '2025-03-10',
    submissionStatus: '대기중',
  },
  {
    id: '5',
    companyName: 'Asia Refining Ltd.',
    country: 'Japan',
    certificationNumber: 'RMI-2024-001357',
    certificationType: 'Active Smelter',
    validityPeriod: '2025-04-30',
    status: 'expiring',
    isOurSupplier: false,
  },
];

// Mock FEOC data
const mockFEOCData: FEOCCompany[] = [
  {
    id: '1',
    companyName: 'Korea Battery Co.',
    tier: 'Tier 1',
    country: 'South Korea',
    feocStatus: 'not-applicable',
    reviewStatus: '검토완료',
    lastUpdate: '2026-02-28',
  },
  {
    id: '2',
    companyName: 'Cell Tech Inc.',
    tier: 'Tier 2',
    country: 'China',
    feocStatus: 'under-review',
    reviewStatus: '검토중',
    lastUpdate: '2026-02-25',
  },
  {
    id: '3',
    companyName: 'DRC Mining Co.',
    tier: 'Tier 3',
    country: 'DRC',
    feocStatus: 'applicable',
    reviewStatus: '검토완료',
    lastUpdate: '2026-01-15',
  },
  {
    id: '4',
    companyName: 'Lithium Mine Corp.',
    tier: 'Tier 3',
    country: 'Australia',
    feocStatus: 'not-applicable',
    reviewStatus: '검토완료',
    lastUpdate: '2026-02-20',
  },
  {
    id: '5',
    companyName: 'Myanmar Resources',
    tier: 'Tier 2',
    country: 'Myanmar',
    feocStatus: 'applicable',
    reviewStatus: '검토완료',
    lastUpdate: '2026-01-10',
  },
];

export default function CertificationControl() {
  const [activeTab, setActiveTab] = useState<TabType>('rmi');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showOurSuppliersOnly, setShowOurSuppliersOnly] = useState(false);
  const [hoveredCompany, setHoveredCompany] = useState<string | null>(null);
  const [selectedFEOCCompany, setSelectedFEOCCompany] = useState<FEOCCompany | null>(null);

  // RMI Statistics
  const totalRMICompanies = mockRMIData.length;
  const ourRMICertified = mockRMIData.filter(c => c.isOurSupplier).length;
  const expiringRMI = mockRMIData.filter(c => c.status === 'expiring').length;
  const uncertifiedSuppliers = 5; // Mock number

  // FEOC Statistics
  const totalFEOCCompanies = mockFEOCData.length;
  const feocApplicable = mockFEOCData.filter(c => c.feocStatus === 'applicable').length;
  const feocUnderReview = mockFEOCData.filter(c => c.feocStatus === 'under-review').length;
  const feocInsufficientInfo = mockFEOCData.filter(c => c.feocStatus === 'insufficient-info').length;

  // Filter RMI data
  const filteredRMIData = mockRMIData.filter(company => {
    if (showOurSuppliersOnly && !company.isOurSupplier) return false;
    if (searchTerm && !company.companyName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (selectedCountry && company.country !== selectedCountry) return false;
    if (selectedStatus && company.status !== selectedStatus) return false;
    return true;
  });

  // Filter FEOC data
  const filteredFEOCData = mockFEOCData.filter(company => {
    if (searchTerm && !company.companyName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (selectedCountry && company.country !== selectedCountry) return false;
    if (selectedStatus && company.feocStatus !== selectedStatus) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">활성</span>;
      case 'expiring':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">만료예정</span>;
      case 'expired':
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">만료됨</span>;
      default:
        return null;
    }
  };

  const getFEOCBadge = (status: string) => {
    switch (status) {
      case 'applicable':
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">해당 (위험)</span>;
      case 'not-applicable':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">비해당</span>;
      case 'under-review':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">검토중</span>;
      case 'insufficient-info':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">정보부족</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">인증 관리</h1>
        <p className="text-gray-600">Certification Control · 공급망 인증 현황 및 리스크를 관리합니다</p>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('rmi')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${
            activeTab === 'rmi'
              ? 'text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
          style={
            activeTab === 'rmi'
              ? {
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                  boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
                }
              : {}
          }
        >
          RMI
        </button>
        
        <button
          onClick={() => setActiveTab('feoc')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${
            activeTab === 'feoc'
              ? 'text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
          style={
            activeTab === 'feoc'
              ? {
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                  boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
                }
              : {}
          }
        >
          FEOC
        </button>
      </div>

      {/* RMI Tab Content */}
      {activeTab === 'rmi' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div
              className="bg-white p-6 cursor-pointer hover:shadow-lg transition-shadow"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
              }}
              onClick={() => {
                setShowOurSuppliersOnly(false);
                setSelectedStatus('');
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">전체 RMI 등록 기업</span>
                <CheckCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{totalRMICompanies}</div>
              <div className="text-xs text-gray-500 mt-1">글로벌 전체</div>
            </div>

            <div
              className="bg-white p-6 cursor-pointer hover:shadow-lg transition-shadow"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
              }}
              onClick={() => {
                setShowOurSuppliersOnly(true);
                setSelectedStatus('');
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">우리 협력사 중 RMI 인증</span>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-[#5B3BFA]">{ourRMICertified}</div>
              <div className="text-xs text-gray-500 mt-1">공급망 등록 기업</div>
            </div>

            <div
              className="bg-white p-6 cursor-pointer hover:shadow-lg transition-shadow"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
              }}
              onClick={() => {
                setShowOurSuppliersOnly(false);
                setSelectedStatus('expiring');
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">만료 예정 기업</span>
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="text-3xl font-bold text-yellow-600">{expiringRMI}</div>
              <div className="text-xs text-gray-500 mt-1">90일 이내</div>
            </div>

            <div
              className="bg-white p-6 cursor-pointer hover:shadow-lg transition-shadow"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">미인증 협력사</span>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-3xl font-bold text-red-600">{uncertifiedSuppliers}</div>
              <div className="text-xs text-gray-500 mt-1">인증 필요</div>
            </div>
          </div>

          {/* Filters and Search */}
          <div
            className="bg-white p-6"
            style={{
              borderRadius: '20px',
              boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">RMI 인증 기업 리스트</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Info className="w-4 h-4" />
                <span>RMI 데이터는 매월 자동 업데이트됩니다</span>
                <span className="text-gray-400">·</span>
                <span className="font-medium">최근 업데이트: 2026-03-01</span>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="기업명 검색..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                />
              </div>

              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
              >
                <option value="">모든 국가</option>
                <option value="South Korea">South Korea</option>
                <option value="China">China</option>
                <option value="USA">USA</option>
                <option value="Japan">Japan</option>
                <option value="Australia">Australia</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
              >
                <option value="">모든 상태</option>
                <option value="active">활성</option>
                <option value="expiring">만료예정</option>
                <option value="expired">만료됨</option>
              </select>

              <label className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 border border-purple-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOurSuppliersOnly}
                  onChange={(e) => setShowOurSuppliersOnly(e.target.checked)}
                  className="w-4 h-4 text-[#5B3BFA] rounded focus:ring-[#5B3BFA]"
                />
                <span className="text-sm font-medium text-purple-700">우리 공급망만 보기</span>
              </label>

              <button
                onClick={() => toast.success('CSV 파일을 다운로드합니다')}
                className="px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                내보내기
              </button>
            </div>

            {/* RMI Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F6F8FB]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">기업명</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">국가</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">인증번호</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">인증유형</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">유효기간</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">상태</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">우리공급망</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRMIData.map((company) => (
                    <tr
                      key={company.id}
                      className="border-b border-gray-100 hover:bg-gray-50 relative"
                      onMouseEnter={() => company.isOurSupplier && setHoveredCompany(company.id)}
                      onMouseLeave={() => setHoveredCompany(null)}
                    >
                      <td className="px-4 py-4 font-medium">{company.companyName}</td>
                      <td className="px-4 py-4 text-sm">{company.country}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{company.certificationNumber}</td>
                      <td className="px-4 py-4 text-sm">{company.certificationType}</td>
                      <td className="px-4 py-4 text-sm">{company.validityPeriod}</td>
                      <td className="px-4 py-4">{getStatusBadge(company.status)}</td>
                      <td className="px-4 py-4">
                        {company.isOurSupplier ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                            <CheckCircle className="w-4 h-4" />
                            우리 공급망
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>

                      {/* Hover Tooltip */}
                      {hoveredCompany === company.id && company.isOurSupplier && (
                        <td className="absolute left-full top-0 ml-2 z-10">
                          <div
                            className="bg-white p-4 shadow-lg border border-gray-200"
                            style={{
                              borderRadius: '12px',
                              minWidth: '280px',
                            }}
                          >
                            <h4 className="font-bold text-gray-900 mb-3">공급망 정보</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">공급망 차수:</span>
                                <span className="font-medium text-[#5B3BFA]">{company.tier}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">제품:</span>
                                <span className="font-medium">{company.product}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">프로젝트:</span>
                                <span className="font-medium">{company.project}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">등록일:</span>
                                <span className="font-medium">{company.registeredDate}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">제출 상태:</span>
                                <span className="font-medium text-green-600">{company.submissionStatus}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              총 <span className="font-semibold text-[#5B3BFA]">{filteredRMIData.length}</span>개 기업
            </div>
          </div>
        </div>
      )}

      {/* FEOC Tab Content */}
      {activeTab === 'feoc' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div
              className="bg-white p-6 cursor-pointer hover:shadow-lg transition-shadow"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
              }}
              onClick={() => setSelectedStatus('')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">전체 협력사</span>
                <CheckCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{totalFEOCCompanies}</div>
              <div className="text-xs text-gray-500 mt-1">등록 기업</div>
            </div>

            <div
              className="bg-white p-6 cursor-pointer hover:shadow-lg transition-shadow"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
              }}
              onClick={() => setSelectedStatus('applicable')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">FEOC 해당 협력사</span>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-3xl font-bold text-red-600">{feocApplicable}</div>
              <div className="text-xs text-gray-500 mt-1">위험 지역</div>
            </div>

            <div
              className="bg-white p-6 cursor-pointer hover:shadow-lg transition-shadow"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
              }}
              onClick={() => setSelectedStatus('under-review')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">검토 필요</span>
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="text-3xl font-bold text-yellow-600">{feocUnderReview}</div>
              <div className="text-xs text-gray-500 mt-1">검토중</div>
            </div>

            <div
              className="bg-white p-6 cursor-pointer hover:shadow-lg transition-shadow"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
              }}
              onClick={() => setSelectedStatus('insufficient-info')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">미응답 협력사</span>
                <AlertTriangle className="w-5 h-5 text-gray-400" />
              </div>
              <div className="text-3xl font-bold text-gray-600">{feocInsufficientInfo}</div>
              <div className="text-xs text-gray-500 mt-1">정보 필요</div>
            </div>
          </div>

          {/* Filters and Search */}
          <div
            className="bg-white p-6"
            style={{
              borderRadius: '20px',
              boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">FEOC 협력사 리스트</h3>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="기업명 검색..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                />
              </div>

              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
              >
                <option value="">모든 국가</option>
                <option value="South Korea">South Korea</option>
                <option value="China">China</option>
                <option value="DRC">DRC</option>
                <option value="Myanmar">Myanmar</option>
                <option value="Australia">Australia</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
              >
                <option value="">모든 상태</option>
                <option value="applicable">해당 (위험)</option>
                <option value="not-applicable">비해당</option>
                <option value="under-review">검토중</option>
                <option value="insufficient-info">정보부족</option>
              </select>

              <button
                onClick={() => toast.success('CSV 파일을 다운로드합니다')}
                className="px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                내보내기
              </button>
            </div>

            {/* FEOC Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F6F8FB]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">기업명</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Tier</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">국가</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">FEOC 해당 여부</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">검토 상태</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">최근 업데이트</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFEOCData.map((company) => (
                    <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4 font-medium">{company.companyName}</td>
                      <td className="px-4 py-4">
                        <span className="inline-block px-3 py-1 bg-[#5B3BFA] text-white rounded-full text-sm font-semibold">
                          {company.tier}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">{company.country}</td>
                      <td className="px-4 py-4">{getFEOCBadge(company.feocStatus)}</td>
                      <td className="px-4 py-4 text-sm">{company.reviewStatus}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{company.lastUpdate}</td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => setSelectedFEOCCompany(company)}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          상세보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              총 <span className="font-semibold text-[#5B3BFA]">{filteredFEOCData.length}</span>개 협력사
            </div>
          </div>
        </div>
      )}

      {/* FEOC Detail Slide Panel */}
      {selectedFEOCCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div className="w-full md:w-1/3 bg-white shadow-2xl overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold">협력사 상세 정보</h3>
              <button
                onClick={() => setSelectedFEOCCompany(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Company Info */}
              <div>
                <h4 className="text-lg font-bold mb-3">회사 기본정보</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">기업명:</span>
                    <span className="font-medium">{selectedFEOCCompany.companyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tier:</span>
                    <span className="font-medium text-[#5B3BFA]">{selectedFEOCCompany.tier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">국가:</span>
                    <span className="font-medium">{selectedFEOCCompany.country}</span>
                  </div>
                </div>
              </div>

              {/* FEOC Status */}
              <div>
                <h4 className="text-lg font-bold mb-3">FEOC 판단 정보</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">FEOC 해당 여부:</span>
                    {getFEOCBadge(selectedFEOCCompany.feocStatus)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">검토 상태:</span>
                    <span className="font-medium">{selectedFEOCCompany.reviewStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">최근 업데이트:</span>
                    <span className="font-medium">{selectedFEOCCompany.lastUpdate}</span>
                  </div>
                </div>
              </div>

              {/* Related Products */}
              <div>
                <h4 className="text-lg font-bold mb-3">관련 제품/프로젝트</h4>
                <div className="space-y-2">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium text-sm">Battery Module A</div>
                    <div className="text-xs text-gray-600 mt-1">BMW Munich</div>
                  </div>
                </div>
              </div>

              {/* Review History */}
              <div>
                <h4 className="text-lg font-bold mb-3">검토 이력</h4>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium">초기 검토 완료</span>
                      <span className="text-xs text-gray-600">2026-02-01</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      FEOC 적용 지역 확인 및 초기 판단 완료
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium">정보 업데이트</span>
                      <span className="text-xs text-gray-600">{selectedFEOCCompany.lastUpdate}</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      협력사로부터 최신 정보 수령
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
