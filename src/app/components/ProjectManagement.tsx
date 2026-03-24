 'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Eye, Calendar, Package, Network, FileText, CheckCircle, Clock, AlertTriangle, ArrowRight, Building2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useMode } from '../context/ModeContext';

// Customer type
interface Customer {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  industry: string;
}

// Source System Project type - SRM/ERP에서 연동된 프로젝트 정보
interface SourceSystemProject {
  projectCode: string;
  projectName: string;
  customerId: string;
  customerName: string;
  deliveryPlant: string; // 납품 공장
  corporation: string; // 법인
  productionSite: string; // 생산 거점
  deliveryRegion: string; // 납품 지역
}

// Project type - 제품 집계 기반 상태 관리
interface Project {
  id: string;
  projectCode: string;
  projectName: string;
  customerId: string;
  connectedProductsCount: number;
  structureNotConnectedCount: number; // 공급망 미선택 제품 수
  mbomNotSelectedCount: number; // M-BOM 미선택 제품 수
  pcfCompletedCount: number; // PCF 계산 완료 제품 수
  period: {
    start: string;
    end: string;
  };
  status: 'no-products' | 'structure-incomplete' | 'mbom-incomplete' | 'pcf-partial' | 'pcf-completed';
  lastModified: string;
  createdDate: string;
}

// Mock Customers
const mockCustomers: Customer[] = [
  { id: 'cust1', name: 'BMW', nameEn: 'BMW AG', country: 'Germany', industry: 'Automotive' },
  { id: 'cust2', name: 'Mercedes-Benz', nameEn: 'Mercedes-Benz Group AG', country: 'Germany', industry: 'Automotive' },
  { id: 'cust3', name: 'Audi', nameEn: 'Audi AG', country: 'Germany', industry: 'Automotive' },
  { id: 'cust4', name: 'Tesla', nameEn: 'Tesla Inc.', country: 'USA', industry: 'Automotive' },
];

// Mock Source System Projects - SRM/ERP에서 연동된 프로젝트 목록
const mockSourceSystemProjects: SourceSystemProject[] = [
  {
    projectCode: 'SCN-2026-06',
    projectName: 'Porsche Taycan 배터리 시스템',
    customerId: 'cust5',
    customerName: 'Porsche',
    deliveryPlant: 'Stuttgart Plant',
    corporation: 'Porsche AG',
    productionSite: 'Ulsan Factory',
    deliveryRegion: 'Germany',
  },
  {
    projectCode: 'SCN-2026-07',
    projectName: 'Volkswagen ID.4 배터리 팩',
    customerId: 'cust6',
    customerName: 'Volkswagen',
    deliveryPlant: 'Wolfsburg Plant',
    corporation: 'Volkswagen AG',
    productionSite: 'Cheonan Factory',
    deliveryRegion: 'Germany',
  },
  {
    projectCode: 'SCN-2026-08',
    projectName: 'Hyundai IONIQ 6 배터리',
    customerId: 'cust7',
    customerName: 'Hyundai',
    deliveryPlant: 'Ulsan Plant',
    corporation: 'Hyundai Motor Company',
    productionSite: 'Ulsan Factory',
    deliveryRegion: 'Korea',
  },
  {
    projectCode: 'SCN-2026-09',
    projectName: 'Ford F-150 Lightning ESS',
    customerId: 'cust8',
    customerName: 'Ford',
    deliveryPlant: 'Dearborn Plant',
    corporation: 'Ford Motor Company',
    productionSite: 'Cheonan Factory',
    deliveryRegion: 'USA',
  },
  {
    projectCode: 'SCN-2026-10',
    projectName: 'Rivian R1T 배터리 모듈',
    customerId: 'cust9',
    customerName: 'Rivian',
    deliveryPlant: 'Normal Plant',
    corporation: 'Rivian Automotive LLC',
    productionSite: 'Ulsan Factory',
    deliveryRegion: 'USA',
  },
];

// Mock Projects - 제품 집계 기반
const mockProjects: Project[] = [
  {
    id: 'proj1',
    projectCode: 'SCN-2026-01',
    projectName: 'BMW iX5 배터리 공급',
    customerId: 'cust1',
    connectedProductsCount: 3,
    structureNotConnectedCount: 0,
    mbomNotSelectedCount: 0,
    pcfCompletedCount: 3,
    period: { start: '2026-01-01', end: '2026-12-31' },
    status: 'pcf-completed',
    lastModified: '2026-03-01',
    createdDate: '2026-01-15',
  },
  {
    id: 'proj2',
    projectCode: 'SCN-2026-02',
    projectName: 'Mercedes EQS 차세대 배터리',
    customerId: 'cust2',
    connectedProductsCount: 2,
    structureNotConnectedCount: 0,
    mbomNotSelectedCount: 0,
    pcfCompletedCount: 1,
    period: { start: '2026-03-01', end: '2027-02-28' },
    status: 'pcf-partial',
    lastModified: '2026-02-28',
    createdDate: '2026-02-10',
  },
  {
    id: 'proj3',
    projectCode: 'SCN-2026-03',
    projectName: 'Audi Q6 e-tron ESS',
    customerId: 'cust3',
    connectedProductsCount: 1,
    structureNotConnectedCount: 0,
    mbomNotSelectedCount: 0,
    pcfCompletedCount: 1,
    period: { start: '2026-02-01', end: '2026-11-30' },
    status: 'pcf-completed',
    lastModified: '2026-02-20',
    createdDate: '2026-01-20',
  },
  {
    id: 'proj4',
    projectCode: 'SCN-2026-04',
    projectName: 'Tesla Model Y 배터리 팩',
    customerId: 'cust4',
    connectedProductsCount: 2,
    structureNotConnectedCount: 1,
    mbomNotSelectedCount: 1,
    pcfCompletedCount: 0,
    period: { start: '2026-04-01', end: '2027-03-31' },
    status: 'mbom-incomplete',
    lastModified: '2026-03-04',
    createdDate: '2026-03-01',
  },
  {
    id: 'proj5',
    projectCode: 'SCN-2026-05',
    projectName: 'BMW i7 전고체 배터리',
    customerId: 'cust1',
    connectedProductsCount: 0,
    structureNotConnectedCount: 0,
    mbomNotSelectedCount: 0,
    pcfCompletedCount: 0,
    period: { start: '2026-06-01', end: '2027-05-31' },
    status: 'no-products',
    lastModified: '2026-03-03',
    createdDate: '2026-03-02',
  },
];

export default function ProjectManagement() {
  const router = useRouter();
  const { mode } = useMode();

  // Filter states
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // UI states
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  
  // Project creation form states
  const [selectedProjectCode, setSelectedProjectCode] = useState<string>('');
  const [deliveryStartDate, setDeliveryStartDate] = useState<string>('');
  const [deliveryEndDate, setDeliveryEndDate] = useState<string>('');
  
  // Get selected source project info
  const selectedSourceProject = mockSourceSystemProjects.find(
    p => p.projectCode === selectedProjectCode
  );

  // Get customer name
  const getCustomerName = (customerId: string) => {
    return mockCustomers.find(c => c.id === customerId)?.name || '-';
  };

  // Filter projects by customer
  const filteredProjects = mockProjects
    .filter(project => {
      const matchesCustomer = selectedCustomer === 'ALL' || project.customerId === selectedCustomer;
      const matchesSearch = searchTerm === '' || 
        project.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.projectCode.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesCustomer && matchesSearch;
    })
    .sort((a, b) => {
      // Sort by customer name first
      const customerA = getCustomerName(a.customerId);
      const customerB = getCustomerName(b.customerId);
      if (customerA !== customerB) {
        return customerA.localeCompare(customerB);
      }
      // Then sort by project name
      return a.projectName.localeCompare(b.projectName);
    });

  // Status badge
  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'no-products':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">제품 미연결</span>;
      case 'structure-incomplete':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">구조 미연결</span>;
      case 'mbom-incomplete':
        return <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">M-BOM 미선택</span>;
      case 'pcf-partial':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center gap-1">
          <Clock className="w-3 h-3" />
          PCF 계산 진행 중
        </span>;
      case 'pcf-completed':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          계산 완료
        </span>;
      default:
        return null;
    }
  };

  const handleCreateCustomer = () => {
    setShowCustomerModal(true);
  };

  const handleCreateProject = () => {
    setShowProjectModal(true);
  };

  const handleViewProject = (projectId: string) => {
    router.push(`/dashboard/project-management/${projectId}`);
  };

  return (
    <div className="space-y-6">
      {/* Read-only banner for PCF mode */}
      {mode === 'pcf' && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-[#00B4FF] p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#00B4FF] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-[#00B4FF] mb-1">ESG 직무 - 읽기 전용 모드</h3>
              <p className="text-sm text-gray-700">
                PCF 담당자는 프로젝트 정보를 조회할 수 있으나, 프로젝트 생성 및 수정 권한은 없습니다. 
                프로젝트를 수정하려면 우측 상단에서 "구매 직무"로 전환하세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header with Philosophy */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">프로젝트 관리</h1>
        <div className="flex items-start gap-3 mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700 leading-relaxed">
            프로젝트 관리 탭은 <strong className="text-blue-600">고객사 납품 맥락을 정의</strong>하고, 
            <strong> 제품별로 공급망 버전과 M-BOM을 연결</strong>하는 화면입니다.
            <br />
            <span className="text-gray-600">※ PCF 계산 실행은 ESG 직무 탭에서 수행합니다.</span>
          </p>
        </div>
      </div>

      {/* Top Controls */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center justify-between">
          {/* Left - Customer Filter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-600" />
              <label className="text-sm font-semibold">고객사 선택</label>
            </div>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] min-w-[200px]"
            >
              <option value="ALL">전체 고객사</option>
              {mockCustomers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.nameEn})
                </option>
              ))}
            </select>
          </div>

          {/* Right - Create Project */}
          <button
            onClick={handleCreateProject}
            className="px-5 py-2.5 text-white rounded-lg flex items-center gap-2 font-medium transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
              boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
            }}
            disabled={mode === 'pcf'}
          >
            <Plus className="w-5 h-5" />
            프로젝트 생성
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div
        className="bg-white p-4"
        style={{
          borderRadius: '16px',
          boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="프로젝트명 또는 프로젝트 코드로 검색..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
          />
        </div>
      </div>

      {/* Project List Table */}
      <div
        className="bg-white overflow-hidden"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">고객사</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">프로젝트명</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">연결 제품 수</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">구조 미연결</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">M-BOM 미선택</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">PCF 완료</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">적용 기간</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">상태</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">최근 수정일</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    조회된 프로젝트가 없습니다
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-gray-100 hover:bg-purple-50 transition-colors cursor-pointer"
                    onClick={() => handleViewProject(project.id)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium">{getCustomerName(project.customerId)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-gray-900">{project.projectName}</div>
                        <div className="text-xs text-gray-500 mt-1">{project.projectCode}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Package className="w-4 h-4 text-[#5B3BFA]" />
                        <span className="font-bold text-[#5B3BFA]">{project.connectedProductsCount}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-semibold ${
                        project.structureNotConnectedCount > 0 ? 'text-orange-600' : 'text-gray-400'
                      }`}>
                        {project.structureNotConnectedCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-semibold ${
                        project.mbomNotSelectedCount > 0 ? 'text-purple-600' : 'text-gray-400'
                      }`}>
                        {project.mbomNotSelectedCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-semibold ${
                        project.pcfCompletedCount > 0 ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {project.pcfCompletedCount}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{project.period.start} ~ {project.period.end}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(project.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {project.lastModified}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewProject(project.id);
                          }}
                          className="p-2 text-[#5B3BFA] hover:bg-purple-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div
          className="bg-white p-4"
          style={{
            borderRadius: '16px',
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <div className="text-sm text-gray-600 mb-2">전체 프로젝트</div>
          <div className="text-3xl font-bold text-[#5B3BFA]">{mockProjects.length}</div>
        </div>

        <div
          className="bg-white p-4"
          style={{
            borderRadius: '16px',
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <div className="text-sm text-gray-600 mb-2">제품 미연결 프로젝트</div>
          <div className="text-3xl font-bold text-gray-600">
            {mockProjects.filter(p => p.status === 'no-products').length}
          </div>
        </div>

        <div
          className="bg-white p-4"
          style={{
            borderRadius: '16px',
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <div className="text-sm text-gray-600 mb-2">구조 미완료 제품 수</div>
          <div className="text-3xl font-bold text-orange-600">
            {mockProjects.reduce((acc, p) => acc + p.structureNotConnectedCount + p.mbomNotSelectedCount, 0)}
          </div>
        </div>

        <div
          className="bg-white p-4"
          style={{
            borderRadius: '16px',
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <div className="text-sm text-gray-600 mb-2">PCF 완료 제품 수</div>
          <div className="text-3xl font-bold text-green-600">
            {mockProjects.reduce((acc, p) => acc + p.pcfCompletedCount, 0)}
          </div>
        </div>
      </div>

      {/* Customer Registration Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white w-full max-w-2xl"
            style={{
              borderRadius: '20px',
            }}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold">고객사 등록</h2>
              <p className="text-sm text-gray-600 mt-1">새로운 고객사 정보를 입력하세요</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">고객사명 (한글)</label>
                <input
                  type="text"
                  placeholder="예: BMW"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">고객사명 (영문)</label>
                <input
                  type="text"
                  placeholder="예: BMW AG"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">국가</label>
                  <input
                    type="text"
                    placeholder="예: Germany"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">산업 분야</label>
                  <input
                    type="text"
                    placeholder="예: Automotive"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                취소
              </button>
              <button
                onClick={() => {
                  toast.success('고객사가 등록되었습니다');
                  setShowCustomerModal(false);
                }}
                className="px-5 py-2 text-white rounded-lg font-medium"
                style={{
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                }}
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Creation Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            style={{
              borderRadius: '20px',
            }}
          >
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold">프로젝트 생성</h2>
              <p className="text-sm text-gray-600 mt-1">원천 시스템 프로젝트를 선택하여 연결합니다</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Info Banner */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-700 leading-relaxed">
                  <p className="font-medium text-blue-900 mb-1">원천 시스템 연동 안내</p>
                  <p>프로젝트 정보는 원천 시스템(SRM/ERP)에서 연동된 데이터입니다. 프로젝트를 선택하면 관련 정보가 자동으로 입력됩니다.</p>
                </div>
              </div>

              {/* 프로젝트 선택 영역 */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 text-sm">프로젝트 선택</h3>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">프로젝트 코드</label>
                  <select
                    value={selectedProjectCode}
                    onChange={(e) => setSelectedProjectCode(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  >
                    <option value="">프로젝트를 선택하세요</option>
                    {mockSourceSystemProjects.map(project => (
                      <option key={project.projectCode} value={project.projectCode}>
                        {project.projectCode} - {project.projectName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 자동 표시 영역 (Read-only) */}
              {selectedSourceProject && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    프로젝트 정보 (자동 입력됨)
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-600">프로젝트명</label>
                      <div className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900">
                        {selectedSourceProject.projectName}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-600">고객사</label>
                      <div className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900">
                        {selectedSourceProject.customerName}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-600">납품 공장</label>
                      <div className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900">
                        {selectedSourceProject.deliveryPlant}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-600">법인</label>
                      <div className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900">
                        {selectedSourceProject.corporation}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-600">생산 거점</label>
                      <div className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900">
                        {selectedSourceProject.productionSite}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-600">납품 지역</label>
                      <div className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900">
                        {selectedSourceProject.deliveryRegion}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 사용자 입력 영역 */}
              {selectedSourceProject && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 text-sm">납품 기간 설정</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">납품 시작일</label>
                      <input
                        type="date"
                        value={deliveryStartDate}
                        onChange={(e) => setDeliveryStartDate(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">납품 종료일</label>
                      <input
                        type="date"
                        value={deliveryEndDate}
                        onChange={(e) => setDeliveryEndDate(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={() => {
                  setShowProjectModal(false);
                  setSelectedProjectCode('');
                  setDeliveryStartDate('');
                  setDeliveryEndDate('');
                }}
                className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (!selectedProjectCode) {
                    toast.error('프로젝트를 선택해주세요');
                    return;
                  }
                  if (!deliveryStartDate || !deliveryEndDate) {
                    toast.error('납품 기간을 입력해주세요');
                    return;
                  }
                  toast.success('프로젝트가 생성되었습니다');
                  setShowProjectModal(false);
                  setSelectedProjectCode('');
                  setDeliveryStartDate('');
                  setDeliveryEndDate('');
                }}
                disabled={!selectedProjectCode || !deliveryStartDate || !deliveryEndDate}
                className="px-5 py-2.5 text-white rounded-lg font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                }}
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}