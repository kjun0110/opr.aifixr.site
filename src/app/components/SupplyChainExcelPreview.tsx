'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, FileSpreadsheet, Building2, Package, Calendar, Users, Layers } from 'lucide-react';
import { toast } from 'sonner';

// Mock data for preview
const mockSheetData = {
  supplyChainStructure: [
    {
      supplyChainId: 'SCN-2026-01',
      parentCompanyId: '-',
      companyId: 'C001',
      companyName: '삼성SDI',
      companyType: 'Operator',
      tier: 'Tier 0',
      country: 'South Korea',
      deliveredProduct: '배터리 모듈',
      deliveredQuantity: 50000,
      pcfResult: 32420.3,
      status: 'Verified',
    },
    {
      supplyChainId: 'SCN-2026-01',
      parentCompanyId: 'C001',
      companyId: 'C002',
      companyName: '한국배터리',
      companyType: 'Supplier',
      tier: 'Tier 1',
      country: 'South Korea',
      deliveredProduct: '배터리 셀',
      deliveredQuantity: 30000,
      pcfResult: 12820.4,
      status: 'Verified',
    },
    {
      supplyChainId: 'SCN-2026-01',
      parentCompanyId: 'C002',
      companyId: 'C003',
      companyName: '셀테크',
      companyType: 'Supplier',
      tier: 'Tier 2',
      country: 'China',
      deliveredProduct: '양극재',
      deliveredQuantity: 15000,
      pcfResult: 8540.2,
      status: 'Verified',
    },
  ],
  organizationInfo: [
    {
      supplyChainId: 'SCN-2026-01',
      companyId: 'C001',
      companyName: '삼성SDI',
      companyType: 'Operator',
      tier: 'Tier 0',
      businessRegistrationNumber: '100-81-00000',
      country: 'South Korea',
      address: '경기도 용인시 기흥구 공세로 150',
      dunsNumber: 'DUNS-123456789',
      taxId: 'TAX-KR-SDI',
      website: 'https://samsungsdi.com',
      ceoName: '최윤호',
      ceoEmail: 'ceo@samsungsdi.com',
      ceoPhone: '+82-31-8006-3114',
      feoc: false,
      rmiSmelter: false,
      supplierType: 'OEM',
    },
    {
      supplyChainId: 'SCN-2026-01',
      companyId: 'C002',
      companyName: '한국배터리',
      companyType: 'Supplier',
      tier: 'Tier 1',
      businessRegistrationNumber: '123-45-67890',
      country: 'South Korea',
      address: '서울특별시 강남구 테헤란로 123',
      dunsNumber: 'DUNS-987654321',
      taxId: 'TAX-KR-001',
      website: 'https://koreabattery.com',
      ceoName: '김철수',
      ceoEmail: 'ceo@koreabattery.com',
      ceoPhone: '+82-2-1234-5678',
      feoc: false,
      rmiSmelter: true,
      supplierType: 'Tier 1 Supplier',
    },
  ],
  siteInfo: [
    {
      supplyChainId: 'SCN-2026-01',
      companyId: 'C001',
      companyName: '삼성SDI',
      companyType: 'Operator',
      tier: 'Tier 0',
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
      feoc: false,
      rmiSmelter: false,
    },
    {
      supplyChainId: 'SCN-2026-01',
      companyId: 'C002',
      companyName: '한국배터리',
      companyType: 'Supplier',
      tier: 'Tier 1',
      siteId: 'SITE-001',
      siteName: '서울 본사 공장',
      country: 'South Korea',
      address: '서울특별시 강남구 테헤란로 123',
      managerName: '이영희',
      managerEmail: 'manager1@koreabattery.com',
      managerPhone: '+82-2-1234-5679',
      processName: '배터리 셀 제조',
      renewableEnergy: true,
      environmentalCertification: 'ISO 14001',
      feoc: false,
      rmiSmelter: true,
    },
  ],
  productInfo: [
    {
      supplyChainId: 'SCN-2026-01',
      companyId: 'C002',
      companyName: '한국배터리',
      tier: 'Tier 1',
      productId: 'PROD-001',
      productName: '리튬이온 배터리 셀 (NCM811)',
      deliveryQuantity: 15000,
      unit: 'EA',
      standardWeight: 0.5,
      unitWeight: 0.48,
      hsCode: '8507.60.00',
      mineralType: 'Lithium',
      mineralContent: 12.5,
      recyclingRatio: 5,
      mineralOrigin: 'Australia',
    },
    {
      supplyChainId: 'SCN-2026-01',
      companyId: 'C003',
      companyName: '셀테크',
      tier: 'Tier 2',
      productId: 'PROD-002',
      productName: '양극재 (NCM811)',
      deliveryQuantity: 8000,
      unit: 'kg',
      standardWeight: 1.0,
      unitWeight: 0.98,
      hsCode: '2825.60.00',
      mineralType: 'Nickel',
      mineralContent: 80,
      recyclingRatio: 0,
      mineralOrigin: 'Indonesia',
    },
  ],
  materialInfo: [
    {
      supplyChainId: 'SCN-2026-01',
      companyId: 'C001',
      companyName: '삼성SDI',
      tier: 'Tier 0',
      materialName: '배터리 셀',
      unit: 'EA',
      hsCode: '8507.60.00',
      emissionFactorId: 'EF-2026-001',
    },
    {
      supplyChainId: 'SCN-2026-01',
      companyId: 'C001',
      companyName: '삼성SDI',
      tier: 'Tier 0',
      materialName: 'BMS 모듈',
      unit: 'SET',
      hsCode: '8537.10.00',
      emissionFactorId: 'EF-2026-002',
    },
  ],
  productionInfo: [
    {
      supplyChainId: 'SCN-2026-01',
      companyId: 'C002',
      companyName: '한국배터리',
      tier: 'Tier 1',
      targetProduct: '리튬이온 배터리 셀',
      materialCategory: '원자재',
      materialName: '양극재 (NCM811)',
      materialQuantity: 5000,
      unit: 'kg',
      recyclingRatio: 5,
      energyType: '전기',
      energyUsage: 12000,
      energyUnit: 'kWh',
      transportType: '육상운송',
      transportMode: '트럭',
      standardWeight: 0.5,
      actualWeight: 0.48,
      output: 30000,
      loss: 500,
      waste: 200,
      emissionFactor: 2.5,
    },
  ],
  processInfo: [
    {
      supplyChainId: 'SCN-2026-01',
      companyId: 'C001',
      companyName: '삼성SDI',
      tier: 'Tier 0',
      processName: '배터리 모듈 조립',
      facilityNumber: 'FAC-001',
      facilityName: '자동화 조립 라인 1호기',
      maxProductionRate: 500,
      installationYear: 2020,
      energyType: '전기',
    },
  ],
  contactInfo: [
    {
      supplyChainId: 'SCN-2026-01',
      companyId: 'C001',
      companyName: '삼성SDI',
      companyType: 'Operator',
      tier: 'Tier 0',
      employeeId: 'EMP-001',
      department: 'ESG팀',
      position: '팀장',
      name: '정은지',
      email: 'esg@samsungsdi.com',
      phone: '+82-31-8006-1234',
    },
    {
      supplyChainId: 'SCN-2026-01',
      companyId: 'C002',
      companyName: '한국배터리',
      companyType: 'Supplier',
      tier: 'Tier 1',
      employeeId: '',
      department: 'ESG팀',
      position: '담당자',
      name: '정은지',
      email: 'esg@koreabattery.com',
      phone: '+82-2-1234-5681',
    },
  ],
};

const sheetDefinitions = [
  {
    id: 'supplyChainStructure',
    name: '공급망 구조',
    description: '공급망 트리 및 상하위 관계 확인',
    target: '원청 + 협력사',
    columns: 11,
    recordCount: 14,
  },
  {
    id: 'organizationInfo',
    name: '기업정보',
    description: '공급망 내 모든 회사의 공통 식별 정보',
    target: '원청 + 협력사',
    columns: 18,
    recordCount: 14,
  },
  {
    id: 'siteInfo',
    name: '사업장',
    description: '원청 및 협력사 사업장 정보 통합 조회',
    target: '원청 + 협력사',
    columns: 17,
    recordCount: 22,
  },
  {
    id: 'productInfo',
    name: '납품제품',
    description: '협력사 납품 제품 상세 정보',
    target: '협력사 전용',
    columns: 14,
    recordCount: 12,
  },
  {
    id: 'materialInfo',
    name: '자재/품목',
    description: '원청 자재 및 품목 정보',
    target: '원청 전용',
    columns: 7,
    recordCount: 45,
  },
  {
    id: 'productionInfo',
    name: '생산투입실적',
    description: '협력사 생산 및 투입 실적 데이터',
    target: '협력사 전용',
    columns: 18,
    recordCount: 35,
  },
  {
    id: 'processInfo',
    name: '공정운영',
    description: '원청 공정 운영 및 정밀 실적 정보',
    target: '원청 전용',
    columns: 9,
    recordCount: 8,
  },
  {
    id: 'contactInfo',
    name: '담당자',
    description: '원청 및 협력사 담당자 정보 통합',
    target: '원청 + 협력사',
    columns: 11,
    recordCount: 28,
  },
];

// Mock project data
const mockProjects: Record<string, any> = {
  'project-1': {
    id: 'project-1',
    projectCode: 'SCN-2026-01',
    projectName: 'BMW iX5 배터리 공급',
    productName: '배터리 모듈',
    customer: 'BMW',
    period: '2026 Q1-Q4',
    supplyChainCode: 'SC-2026-01',
  },
  'project-2': {
    id: 'project-2',
    projectCode: 'SCN-2026-02',
    projectName: 'Mercedes EQS 차세대 배터리',
    productName: '전고체 셀',
    customer: 'Mercedes-Benz',
    period: '2026 Q2-Q4',
    supplyChainCode: 'SC-2026-02',
  },
  'project-3': {
    id: 'project-3',
    projectCode: 'SCN-2026-03',
    projectName: 'Audi Q6 e-tron ESS',
    productName: 'ESS 팩',
    customer: 'Audi',
    period: '2026 Q1-Q3',
    supplyChainCode: 'SC-2026-03',
  },
};

export default function SupplyChainExcelPreview() {
  const { projectId } = useParams();
  const router = useRouter();
  const [activeSheet, setActiveSheet] = useState(0);
  
  // Mock data - in real app, fetch based on projectId
  const projectKey = Array.isArray(projectId) ? projectId[0] : projectId;
  const project = projectKey ? mockProjects[projectKey] : mockProjects['project-1'];
  
  if (!project) {
    return (
      <div className="p-6">
        <p className="text-gray-600">프로젝트를 찾을 수 없습니다.</p>
      </div>
    );
  }
  
  const currentSheet = sheetDefinitions[activeSheet];
  const fileName = `${project.supplyChainCode}_공급망통합데이터.xlsx`;

  const handleDownload = () => {
    toast.success('Excel 파일을 다운로드합니다');
    // In real implementation, this would trigger the actual file download
  };

  const renderTablePreview = () => {
    const sheetId = currentSheet.id as keyof typeof mockSheetData;
    const data = mockSheetData[sheetId];

    if (!data || data.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>미리보기 데이터가 없습니다</p>
        </div>
      );
    }

    const columns = Object.keys(data[0]);

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-[#217346] text-white sticky top-0">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="px-3 py-2 text-left text-xs font-semibold border border-green-700 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row: any, rowIdx: number) => (
              <tr
                key={rowIdx}
                className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className="px-3 py-2 text-sm border border-gray-300 whitespace-nowrap"
                  >
                    {row[col] !== null && row[col] !== undefined && row[col] !== ''
                      ? String(row[col])
                      : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
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
        <span className="text-gray-900 font-medium">Excel 다운로드 미리보기</span>
      </div>

      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            공급망 통합 Excel 미리보기
          </h1>
          <p className="text-lg text-gray-600">
            {project.supplyChainCode} | {project.projectName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="px-5 py-2.5 text-white rounded-lg flex items-center gap-2 font-medium transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
              boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
            }}
          >
            <Download className="w-4 h-4" />
            다운로드 실행
          </button>
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            뒤로가기
          </button>
        </div>
      </div>

      {/* File Meta Info Card */}
      <div
        className="bg-gradient-to-r from-blue-50 to-purple-50 p-6"
        style={{
          borderRadius: '20px',
          border: '1px solid #E5E7EB',
        }}
      >
        <div className="grid grid-cols-4 gap-6">
          <div>
            <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
              <FileSpreadsheet className="w-4 h-4" />
              생성 예정 파일명
            </div>
            <div className="font-bold text-[#5B3BFA]">{fileName}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
              <Package className="w-4 h-4" />
              제품명
            </div>
            <div className="font-semibold">{project.productName}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              고객사
            </div>
            <div className="font-semibold">{project.customer}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              기간
            </div>
            <div className="font-semibold">{project.period}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
              <Users className="w-4 h-4" />
              포함 회사 수
            </div>
            <div className="font-bold text-lg">14</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
              <Layers className="w-4 h-4" />
              포함 시트 수
            </div>
            <div className="font-bold text-lg">{sheetDefinitions.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
              <FileSpreadsheet className="w-4 h-4" />
              공급망 ID
            </div>
            <div className="font-semibold">{project.supplyChainCode}</div>
          </div>
        </div>
      </div>

      {/* Excel Workbook Preview UI */}
      <div className="flex gap-6 h-[600px]">
        {/* Left: Sheet Navigator */}
        <div
          className="w-64 flex-shrink-0 bg-white p-4 overflow-y-auto"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Sheet Navigator</h3>
          <div className="space-y-1">
            {sheetDefinitions.map((sheet, idx) => (
              <button
                key={sheet.id}
                onClick={() => setActiveSheet(idx)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  activeSheet === idx
                    ? 'bg-gradient-to-r from-[#5B3BFA] to-[#00B4FF] text-white font-semibold'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${
                    activeSheet === idx ? 'text-white' : 'text-gray-400'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="text-sm">{sheet.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Sheet Table Preview */}
        <div
          className="flex-1 bg-white flex flex-col overflow-hidden"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          {/* Sheet Info Bar */}
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{currentSheet.name}</h3>
                <p className="text-sm text-gray-600 mt-0.5">{currentSheet.description}</p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-gray-600">포함 대상: </span>
                  <span className={`font-semibold ${
                    currentSheet.target.includes('+') 
                      ? 'text-[#5B3BFA]' 
                      : 'text-gray-700'
                  }`}>
                    {currentSheet.target}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">컬럼 수: </span>
                  <span className="font-semibold">{currentSheet.columns}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table Preview */}
          <div className="flex-1 overflow-auto p-6">
            {renderTablePreview()}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700">
                <strong>참고:</strong> 위 표는 실제 다운로드될 데이터의 일부 샘플입니다. 
                실제 파일에는 전체 {currentSheet.recordCount}개 레코드가 포함됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}