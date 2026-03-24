'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, MapPin, Package, TrendingUp, CheckCircle, AlertTriangle, Download, Upload, Plus, Edit2, Trash2, Lock, FileText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useMode } from '../context/ModeContext';

// Mock Tier0 (Operator) company data
interface Tier0DetailData {
  id: string;
  companyName: string;
  companyType: 'Operator';
  tier: 'Tier 0';
  country: string;
  productType: string;
  deliveryVolume: number;
  pcfResult: number | null;
  status: string;
  
  // Interface Data (Read Only)
  organizationInfo: {
    companyName: string;
    businessRegistrationNumber: string;
    country: string;
    address: string;
    department: string;
    dunsNumber: string;
    taxId: string;
    website: string;
    ceoName: string;
    ceoEmail: string;
    ceoPhone: string;
  };
  
  siteInfo: {
    siteId: string;
    siteName: string;
    country: string;
    address: string;
    managerName: string;
    managerEmail: string;
    managerPhone: string;
    processName: string;
    renewableEnergy: boolean;
    environmentalCertification: string;
  }[];
  
  materialInfo: {
    materialId: string;
    materialName: string;
    unit: string;
    hsCode: string;
    emissionFactorId: string;
  }[];
  
  facilityInfo: {
    processName: string;
    facilityNumber: string;
    facilityName: string;
    maxOutput: number;
    standardProduction: number;
    installationYear: number;
    energyType: string;
  }[];
  
  contactInfo: {
    employeeId: string;
    department: string;
    position: string;
    name: string;
    email: string;
    phone: string;
  }[];
  
  // Factory Input Data (Editable)
  processPerformanceInfo: {
    id: string;
    processName: string;
    materialCategory: string;
    materialName: string;
    materialQuantity: number;
    quantityUnit: string;
    recyclingRatio: number;
    energyType: string;
    energyUsage: number;
    energyUnit: string;
    transportType: string;
    transportMode: string;
    standardWeight: number;
    actualWeight: number;
    output: number;
    scrap: number;
    waste: number;
    emissionFactor: number;
  }[];
}

const mockTier0Data: Record<string, Tier0DetailData> = {
  'tier0-p1': {
    id: 'tier0-p1',
    companyName: '삼성SDI',
    companyType: 'Operator',
    tier: 'Tier 0',
    country: 'South Korea',
    productType: '배터리 모듈',
    deliveryVolume: 50000,
    pcfResult: 32420.3,
    status: 'Verified',
    organizationInfo: {
      companyName: '삼성SDI',
      businessRegistrationNumber: '100-81-00000',
      country: 'South Korea',
      address: '경기도 용인시 기흥구 공세로 150',
      department: 'ESG팀',
      dunsNumber: 'DUNS-123456789',
      taxId: 'TAX-KR-SDI',
      website: 'https://samsungsdi.com',
      ceoName: '최윤호',
      ceoEmail: 'ceo@samsungsdi.com',
      ceoPhone: '+82-31-8006-3114',
    },
    siteInfo: [
      {
        siteId: 'SITE-SDI-001',
        siteName: '울산 공장',
        country: 'South Korea',
        address: '울산광역시 남구 산업로 100',
        managerName: '박영수',
        managerEmail: 'park@samsungsdi.com',
        managerPhone: '+82-52-1234-5678',
        processName: '배터리 모듈 조립',
        renewableEnergy: true,
        environmentalCertification: 'ISO 14001',
      },
      {
        siteId: 'SITE-SDI-002',
        siteName: '천안 공장',
        country: 'South Korea',
        address: '충청남도 천안시 서북구 직산읍 삼성로 181',
        managerName: '김민수',
        managerEmail: 'kim@samsungsdi.com',
        managerPhone: '+82-41-1234-5678',
        processName: '배터리 셀 제조',
        renewableEnergy: true,
        environmentalCertification: 'ISO 14001, ISO 50001',
      },
    ],
    materialInfo: [
      {
        materialId: 'MAT-001',
        materialName: '배터리 셀',
        unit: 'EA',
        hsCode: '8507.60.00',
        emissionFactorId: 'EF-2026-001',
      },
      {
        materialId: 'MAT-002',
        materialName: 'BMS 모듈',
        unit: 'SET',
        hsCode: '8537.10.00',
        emissionFactorId: 'EF-2026-002',
      },
      {
        materialId: 'MAT-003',
        materialName: '알루미늄 하우징',
        unit: 'kg',
        hsCode: '7606.12.00',
        emissionFactorId: 'EF-2026-003',
      },
    ],
    facilityInfo: [
      {
        processName: '배터리 모듈 조립',
        facilityNumber: 'FAC-001',
        facilityName: '자동화 조립 라인 1호기',
        maxOutput: 500,
        standardProduction: 450,
        installationYear: 2020,
        energyType: '전기',
      },
      {
        processName: '배터리 모듈 조립',
        facilityNumber: 'FAC-002',
        facilityName: '자동화 조립 라인 2호기',
        maxOutput: 500,
        standardProduction: 450,
        installationYear: 2021,
        energyType: '전기',
      },
    ],
    contactInfo: [
      {
        employeeId: 'EMP-001',
        department: 'ESG팀',
        position: '팀장',
        name: '정은지',
        email: 'esg@samsungsdi.com',
        phone: '+82-31-8006-1234',
      },
      {
        employeeId: 'EMP-002',
        department: '생산관리팀',
        position: '과장',
        name: '이준호',
        email: 'production@samsungsdi.com',
        phone: '+82-31-8006-2345',
      },
    ],
    processPerformanceInfo: [
      {
        id: 'perf-1',
        processName: '배터리 모듈 조립',
        materialCategory: '원자재',
        materialName: '배터리 셀',
        materialQuantity: 30000,
        quantityUnit: 'EA',
        recyclingRatio: 5,
        energyType: '전기',
        energyUsage: 15000,
        energyUnit: 'kWh',
        transportType: '육상운송',
        transportMode: '트럭',
        standardWeight: 0.5,
        actualWeight: 0.48,
        output: 50000,
        scrap: 500,
        waste: 100,
        emissionFactor: 2.8,
      },
      {
        id: 'perf-2',
        processName: '배터리 모듈 조립',
        materialCategory: '부자재',
        materialName: 'BMS 모듈',
        materialQuantity: 50000,
        quantityUnit: 'SET',
        recyclingRatio: 0,
        energyType: '전기',
        energyUsage: 8000,
        energyUnit: 'kWh',
        transportType: '육상운송',
        transportMode: '트럭',
        standardWeight: 0.2,
        actualWeight: 0.19,
        output: 50000,
        scrap: 200,
        waste: 50,
        emissionFactor: 1.5,
      },
    ],
  },
  'tier0-p2': {
    id: 'tier0-p2',
    companyName: '삼성SDI',
    companyType: 'Operator',
    tier: 'Tier 0',
    country: 'South Korea',
    productType: '전고체 배터리',
    deliveryVolume: 40000,
    pcfResult: 38520.8,
    status: 'Verified',
    organizationInfo: {
      companyName: '삼성SDI',
      businessRegistrationNumber: '100-81-00000',
      country: 'South Korea',
      address: '경기도 용인시 기흥구 공세로 150',
      department: 'ESG팀',
      dunsNumber: 'DUNS-123456789',
      taxId: 'TAX-KR-SDI',
      website: 'https://samsungsdi.com',
      ceoName: '최윤호',
      ceoEmail: 'ceo@samsungsdi.com',
      ceoPhone: '+82-31-8006-3114',
    },
    siteInfo: [
      {
        siteId: 'SITE-SDI-001',
        siteName: '울산 공장',
        country: 'South Korea',
        address: '울산광역시 남구 산업로 100',
        managerName: '박영수',
        managerEmail: 'park@samsungsdi.com',
        managerPhone: '+82-52-1234-5678',
        processName: '전고체 배터리 제조',
        renewableEnergy: true,
        environmentalCertification: 'ISO 14001',
      },
    ],
    materialInfo: [
      {
        materialId: 'MAT-001',
        materialName: '전고체 셀',
        unit: 'EA',
        hsCode: '8507.60.00',
        emissionFactorId: 'EF-2026-001',
      },
    ],
    facilityInfo: [
      {
        processName: '전고체 배터리 제조',
        facilityNumber: 'FAC-003',
        facilityName: '전고체 셀 제조 라인',
        maxOutput: 400,
        standardProduction: 350,
        installationYear: 2022,
        energyType: '전기',
      },
    ],
    contactInfo: [
      {
        employeeId: 'EMP-001',
        department: 'ESG팀',
        position: '팀장',
        name: '정은지',
        email: 'esg@samsungsdi.com',
        phone: '+82-31-8006-1234',
      },
    ],
    processPerformanceInfo: [
      {
        id: 'perf-1',
        processName: '전고체 배터리 제조',
        materialCategory: '원자재',
        materialName: '전고체 셀',
        materialQuantity: 20000,
        quantityUnit: 'EA',
        recyclingRatio: 3,
        energyType: '전기',
        energyUsage: 18000,
        energyUnit: 'kWh',
        transportType: '육상운송',
        transportMode: '트럭',
        standardWeight: 0.6,
        actualWeight: 0.58,
        output: 40000,
        scrap: 400,
        waste: 80,
        emissionFactor: 3.2,
      },
    ],
  },
  'tier0-p3': {
    id: 'tier0-p3',
    companyName: '삼성SDI',
    companyType: 'Operator',
    tier: 'Tier 0',
    country: 'South Korea',
    productType: 'ESS 모듈',
    deliveryVolume: 30000,
    pcfResult: 24850.4,
    status: 'Verified',
    organizationInfo: {
      companyName: '삼성SDI',
      businessRegistrationNumber: '100-81-00000',
      country: 'South Korea',
      address: '경기도 용인시 기흥구 공세로 150',
      department: 'ESG팀',
      dunsNumber: 'DUNS-123456789',
      taxId: 'TAX-KR-SDI',
      website: 'https://samsungsdi.com',
      ceoName: '최윤호',
      ceoEmail: 'ceo@samsungsdi.com',
      ceoPhone: '+82-31-8006-3114',
    },
    siteInfo: [
      {
        siteId: 'SITE-SDI-002',
        siteName: '천안 공장',
        country: 'South Korea',
        address: '충청남도 천안시 서북구 직산읍 삼성로 181',
        managerName: '김민수',
        managerEmail: 'kim@samsungsdi.com',
        managerPhone: '+82-41-1234-5678',
        processName: 'ESS 모듈 조립',
        renewableEnergy: true,
        environmentalCertification: 'ISO 14001, ISO 50001',
      },
    ],
    materialInfo: [
      {
        materialId: 'MAT-001',
        materialName: '배터리 셀',
        unit: 'EA',
        hsCode: '8507.60.00',
        emissionFactorId: 'EF-2026-001',
      },
      {
        materialId: 'MAT-004',
        materialName: 'ESS 제어 시스템',
        unit: 'SET',
        hsCode: '8537.10.00',
        emissionFactorId: 'EF-2026-004',
      },
    ],
    facilityInfo: [
      {
        processName: 'ESS 모듈 조립',
        facilityNumber: 'FAC-004',
        facilityName: 'ESS 조립 라인',
        maxOutput: 300,
        standardProduction: 280,
        installationYear: 2021,
        energyType: '전기',
      },
    ],
    contactInfo: [
      {
        employeeId: 'EMP-001',
        department: 'ESG팀',
        position: '팀장',
        name: '정은지',
        email: 'esg@samsungsdi.com',
        phone: '+82-31-8006-1234',
      },
    ],
    processPerformanceInfo: [
      {
        id: 'perf-1',
        processName: 'ESS 모듈 조립',
        materialCategory: '원자재',
        materialName: '배터리 셀',
        materialQuantity: 10000,
        quantityUnit: 'EA',
        recyclingRatio: 5,
        energyType: '전기',
        energyUsage: 12000,
        energyUnit: 'kWh',
        transportType: '육상운송',
        transportMode: '트럭',
        standardWeight: 0.5,
        actualWeight: 0.48,
        output: 30000,
        scrap: 300,
        waste: 60,
        emissionFactor: 2.4,
      },
    ],
  },
};

export default function Tier0Detail() {
  const { companyId } = useParams();
  const router = useRouter();
  const { mode } = useMode();
  const [activeTab, setActiveTab] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  const companyKey = Array.isArray(companyId) ? companyId[0] : companyId;
  // DataView 새 구조(card-xxx-month-tier0) 지원: mock에 없으면 기본 원청사 데이터 사용
  const company = companyKey
    ? (mockTier0Data[companyKey] ?? (companyKey.endsWith('-tier0') ? { ...mockTier0Data['tier0-p1'], id: companyKey, companyName: '우리회사', organizationInfo: { ...mockTier0Data['tier0-p1'].organizationInfo, companyName: '우리회사' } } : null))
    : null;
  
  if (!company) {
    return (
      <div className="p-6">
        <p className="text-gray-600">회사 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }
  
  const tabs = [
    { id: 0, name: '기업 및 조직 식별 정보', readOnly: true },
    { id: 1, name: '사업장 정보', readOnly: true },
    { id: 2, name: '자재 및 품목', readOnly: true },
    { id: 3, name: '주요설비정보', readOnly: true },
    { id: 4, name: '공정 활동 데이터', readOnly: false },
    { id: 5, name: '담당자 정보', readOnly: true },
  ];

  // 구매 직무에서는 모든 탭이 읽기 전용, ESG 직무에서는 원래 설정 유지
  const isTabEditable = (tabId: number) => {
    if (mode === 'procurement') return false;
    return !tabs[tabId].readOnly;
  };

  // 전체 공정 활동 데이터 (공정명 컬럼으로 통합 표시)
  const allActivityData = company.processPerformanceInfo;

  const handleExcelDownload = () => {
    toast.success('Excel 파일을 다운로드합니다');
  };

  const handleExcelUpload = () => {
    setShowUploadModal(true);
  };

  const handleAddRow = () => {
    toast.info('새 행을 추가합니다');
  };

  const handleSave = () => {
    toast.success('저장되었습니다');
  };

  useEffect(() => {
    const handler = () => {
      try {
        sessionStorage.setItem('aifix_data_view_from_back_v1', '1');
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const handleBack = () => {
    try {
      sessionStorage.setItem('aifix_data_view_from_back_v1', '1');
    } catch {
      /* ignore */
    }
    router.back();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 0: // 기업 및 조직 식별 정보
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Lock className="w-4 h-4" />
                <span>🔗 Source : ERP / MES Interface | Data Sync : 자동 연동</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">항목</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">내용</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">회사명</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.companyName}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">사업자 등록번호</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.businessRegistrationNumber}</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">국가 소재지</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.country}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">상세주소</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.address}</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">부서명</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.department}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">DUNS Number</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.dunsNumber}</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">텍스 ID</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.taxId}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">공식 홈페이지 주소</td>
                    <td className="px-4 py-3 text-sm border">
                      <a href={company.organizationInfo.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {company.organizationInfo.website}
                      </a>
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">대표자명</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.ceoName}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">대표 이메일</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.ceoEmail}</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">대표자 연락처</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.ceoPhone}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 1: // 사업장 정보
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Lock className="w-4 h-4" />
                <span>🔗 Source : ERP / MES Interface | Data Sync : 자동 연동</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">종사업장번호</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">사업장명</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">국가 소재지</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">상세주소</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">대표자명</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">대표 이메일</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">대표자 연락처</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">공정명</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">신재생 에너지</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">���경 인증</th>
                  </tr>
                </thead>
                <tbody>
                  {company.siteInfo.map((site, idx) => (
                    <tr key={site.siteId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-3 text-sm border">{site.siteId}</td>
                      <td className="px-3 py-3 text-sm border">{site.siteName}</td>
                      <td className="px-3 py-3 text-sm border">{site.country}</td>
                      <td className="px-3 py-3 text-sm border">{site.address}</td>
                      <td className="px-3 py-3 text-sm border">{site.managerName}</td>
                      <td className="px-3 py-3 text-sm border">{site.managerEmail}</td>
                      <td className="px-3 py-3 text-sm border">{site.managerPhone}</td>
                      <td className="px-3 py-3 text-sm border">{site.processName}</td>
                      <td className="px-3 py-3 text-sm border">
                        {site.renewableEnergy ? (
                          <span className="text-green-600">사용</span>
                        ) : (
                          <span className="text-gray-400">미사용</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm border">{site.environmentalCertification}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 2: // 자재 및 품목
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Lock className="w-4 h-4" />
                <span>🔗 Source : ERP / MES Interface | Data Sync : 자동 연동</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">자재ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">자재명</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">기본 단위</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">HS 코드</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">배출계수(EF) ID</th>
                  </tr>
                </thead>
                <tbody>
                  {company.materialInfo.map((material, idx) => (
                    <tr key={material.materialId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm border">{material.materialId}</td>
                      <td className="px-4 py-3 text-sm border">{material.materialName}</td>
                      <td className="px-4 py-3 text-sm border">{material.unit}</td>
                      <td className="px-4 py-3 text-sm border">{material.hsCode}</td>
                      <td className="px-4 py-3 text-sm border">{material.emissionFactorId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 3: // 주요설비정보
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Lock className="w-4 h-4" />
                <span>🔗 Source : ERP / MES Interface | Data Sync : 자동 연동</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">공정명</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">주요 설비 번호</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">설비명</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">시간당 최대 정격출력</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">시간당 표준 생산량</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">설비 도입 연도</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">사용 에너지 종류</th>
                  </tr>
                </thead>
                <tbody>
                  {company.facilityInfo.map((facility, idx) => (
                    <tr key={facility.facilityNumber} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-3 text-sm border">{facility.processName}</td>
                      <td className="px-3 py-3 text-sm border">{facility.facilityNumber}</td>
                      <td className="px-3 py-3 text-sm border">{facility.facilityName}</td>
                      <td className="px-3 py-3 text-sm border">{facility.maxOutput}</td>
                      <td className="px-3 py-3 text-sm border">{facility.standardProduction}</td>
                      <td className="px-3 py-3 text-sm border">{facility.installationYear}</td>
                      <td className="px-3 py-3 text-sm border">{facility.energyType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 4: // 공정 활동 데이터 (Editable)
        return (
          <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {isTabEditable(4) ? (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>✏ Factory Input Data (수정 가능)</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>🔗 Source : ERP / MES Interface | Data Sync : 자동 연동</span>
                    </>
                  )}
                </div>
                {isTabEditable(4) && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExcelDownload}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Excel 다운로드
                    </button>
                    <button
                      onClick={handleExcelUpload}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Excel 업로드
                    </button>
                    <button
                      onClick={handleAddRow}
                      className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-2 transition-all cursor-pointer"
                      style={{
                        background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      행 추가
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      저장
                    </button>
                  </div>
                )}
              </div>

              <div className="min-h-[500px] overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full border-collapse">
                  <thead className={isTabEditable(4) ? "bg-gradient-to-r from-[#5B3BFA] to-[#00B4FF] text-white sticky top-0" : "bg-gray-100 sticky top-0"}>
                    <tr>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>공정명</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>투입 자재 카테고리</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>투입자재명</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>투입자재량</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>투입 수량 단위</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>자재 재활용 비율(%)</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>투입 에너지 유형</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>에너지 사용량</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>에너지 단위</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>운송유형</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>운송수단</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>제품 표준 중량</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>순중량 실측치</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>산출물(양품)</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>손실량(Scrap)</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>산출 폐기물</th>
                      <th className={`px-2 py-3 text-left text-xs font-semibold border ${isTabEditable(4) ? 'border-blue-400' : 'text-gray-700'}`}>배출계수</th>
                      {isTabEditable(4) && (
                        <th className="px-2 py-3 text-center text-xs font-semibold border border-blue-400">액션</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {allActivityData.length > 0 ? (
                      allActivityData.map((perf, idx) => (
                        <tr key={perf.id} className={idx % 2 === 0 ? 'bg-white' : (isTabEditable(4) ? 'bg-blue-50' : 'bg-gray-50')}>
                          <td className="px-2 py-2 text-sm border font-medium">{perf.processName}</td>
                          <td className="px-2 py-2 text-sm border">{perf.materialCategory}</td>
                          <td className="px-2 py-2 text-sm border">{perf.materialName}</td>
                          <td className="px-2 py-2 text-sm border text-right">{perf.materialQuantity.toLocaleString()}</td>
                          <td className="px-2 py-2 text-sm border">{perf.quantityUnit}</td>
                          <td className="px-2 py-2 text-sm border text-right">{perf.recyclingRatio}</td>
                          <td className="px-2 py-2 text-sm border">{perf.energyType}</td>
                          <td className="px-2 py-2 text-sm border text-right">{perf.energyUsage.toLocaleString()}</td>
                          <td className="px-2 py-2 text-sm border">{perf.energyUnit}</td>
                          <td className="px-2 py-2 text-sm border">{perf.transportType}</td>
                          <td className="px-2 py-2 text-sm border">{perf.transportMode}</td>
                          <td className="px-2 py-2 text-sm border text-right">{perf.standardWeight}</td>
                          <td className="px-2 py-2 text-sm border text-right">{perf.actualWeight}</td>
                          <td className="px-2 py-2 text-sm border text-right">{perf.output.toLocaleString()}</td>
                          <td className="px-2 py-2 text-sm border text-right">{perf.scrap.toLocaleString()}</td>
                          <td className="px-2 py-2 text-sm border text-right">{perf.waste.toLocaleString()}</td>
                          <td className="px-2 py-2 text-sm border text-right">{perf.emissionFactor}</td>
                          {isTabEditable(4) && (
                            <td className="px-2 py-2 text-sm border">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => toast.info('수정 기능을 준비 중입니다')}
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                >
                                  <Edit2 className="w-4 h-4 text-blue-600" />
                                </button>
                                <button
                                  onClick={() => toast.info('삭제 기능을 준비 중입니다')}
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={isTabEditable(4) ? 18 : 17} className="px-4 py-8 text-center text-gray-500">
                          공정 활동 데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
          </div>
        );
      
      case 5: // 담당자 정보
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Lock className="w-4 h-4" />
                <span>🔗 Source : ERP / MES Interface | Data Sync : 자동 연동</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">사번</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">부서명</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">직급</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">이름</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">이메일</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {company.contactInfo.map((contact, idx) => (
                    <tr key={contact.employeeId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm border">{contact.employeeId}</td>
                      <td className="px-4 py-3 text-sm border">{contact.department}</td>
                      <td className="px-4 py-3 text-sm border">{contact.position}</td>
                      <td className="px-4 py-3 text-sm border">{contact.name}</td>
                      <td className="px-4 py-3 text-sm border">{contact.email}</td>
                      <td className="px-4 py-3 text-sm border">{contact.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <button
          onClick={() => router.push('/dashboard/data-view')}
          className="hover:text-[#5B3BFA] transition-colors"
        >
          데이터 관리
        </button>
        <span>&gt;</span>
        <button
          onClick={() => router.push('/dashboard/data-view')}
          className="hover:text-[#5B3BFA] transition-colors"
        >
          조회 결과
        </button>
        <span>&gt;</span>
        <span className="text-gray-900 font-medium">회사 상세</span>
      </div>

      {/* Company Info Card */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-6 flex-1">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5B3BFA] to-[#00B4FF] flex items-center justify-center flex-shrink-0">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-2xl font-bold text-gray-900">{company.companyName}</h1>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                  {company.companyType} (원청사)
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                  {company.tier}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">국가:</span>
                  <span className="font-medium">{company.country}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">납품 제품:</span>
                  <span className="font-medium">{company.productType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">납품량:</span>
                  <span className="font-medium">{company.deliveryVolume.toLocaleString()} EA</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">PCF 결과:</span>
                  <span className="font-medium">
                    {company.pcfResult ? `${company.pcfResult.toLocaleString()} kg CO₂e` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {company.status === 'Verified' ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  )}
                  <span className="text-gray-600">상태:</span>
                  <span className={`font-medium ${
                    company.status === 'Verified' ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {company.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExcelDownload}
              className="px-5 py-2.5 text-white rounded-lg flex items-center gap-2 font-medium transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
              }}
            >
              <Download className="w-4 h-4" />
              Excel 다운로드
            </button>
            <button
              onClick={handleBack}
              className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              뒤로가기
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="bg-white"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        {/* Tab Headers */}
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-[#5B3BFA] border-b-2 border-[#5B3BFA]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {tab.name}
                  {!isTabEditable(tab.id) && <Lock className="w-3 h-3 text-gray-400" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>

      {/* Excel Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white w-full max-w-lg"
            style={{
              borderRadius: '20px',
            }}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">공정 실적 Excel 업로드</h2>
            </div>
            <div className="p-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#5B3BFA] transition-colors cursor-pointer">
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-700 font-medium mb-2">파일을 드래그하거나 클릭하여 선택</p>
                <p className="text-sm text-gray-500">Excel 파일만 업로드 가능합니다</p>
              </div>
              <div className="mt-6 space-y-3">
                <label className="flex items-center gap-2">
                  <input type="radio" name="uploadMode" defaultChecked className="text-[#5B3BFA]" />
                  <span className="text-sm">기존 데이터 덮어쓰기</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="uploadMode" className="text-[#5B3BFA]" />
                  <span className="text-sm">기존 데이터 유지 + 추가</span>
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  toast.success('Excel 파일을 업로드합니다');
                  setShowUploadModal(false);
                }}
                className="px-5 py-2.5 text-white rounded-lg"
                style={{
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                }}
              >
                업로드
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}