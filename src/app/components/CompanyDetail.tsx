 'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, MapPin, Package, TrendingUp, CheckCircle, AlertTriangle, Download } from 'lucide-react';
import { toast } from 'sonner';

// Mock company data
interface CompanyDetailData {
  id: string;
  companyName: string;
  companyNameEn: string;
  companyType: 'Operator' | 'Supplier';
  tier: string;
  country: string;
  productType: string;
  deliveryVolume: number;
  pcfResult: number | null;
  status: string;
  
  // Tab data
  organizationInfo: {
    companyName: string;
    businessRegistrationNumber: string;
    country: string;
    address: string;
    dunsNumber: string;
    taxId: string;
    website: string;
    ceoName: string;
    ceoEmail: string;
    ceoPhone: string;
    rmiSmelter: boolean;
    feoc: boolean;
    supplierType: string;
  };
  
  siteInfo: {
    siteId: string;
    siteName: string;
    country: string;
    address: string;
    managerName: string;
    managerEmail: string;
    managerPhone: string;
    renewableEnergy: boolean;
    environmentalCertification: string;
    rmiSmelter: boolean;
    feoc: boolean;
  }[];
  
  productInfo?: {
    productId: string;
    productName: string;
    deliveryQuantity: number;
    unit: string;
    standardWeight: number;
    unitWeight: number;
    hsCode: string;
    mineralType: string;
    mineralContent: number;
    recyclingRatio: number;
    mineralOrigin: string;
  }[];
  
  productionInfo?: {
    targetProduct: string;
    materialCategory: string;
    materialName: string;
    materialQuantity: number;
    unit: string;
    recyclingRatio: number;
    energyType: string;
    energyUsage: number;
    energyUnit: string;
    transportType: string;
    transportMode: string;
    standardWeight: number;
    actualWeight: number;
    output: number;
    loss: number;
    waste: number;
    emissionFactor: number;
  }[];
  
  materialInfo?: {
    materialName: string;
    unit: string;
    hsCode: string;
    emissionFactorId: string;
  }[];
  
  processInfo?: {
    processName: string;
    facilityNumber: string;
    facilityName: string;
    maxProductionRate: number;
    installationYear: number;
    energyType: string;
    materialCategory: string;
    materialName: string;
    materialQuantity: number;
    unit: string;
    recyclingRatio: number;
    energyUsage: number;
    energyUnit: string;
    transportType: string;
    transportMode: string;
    standardWeight: number;
    actualWeight: number;
    output: number;
    loss: number;
    waste: number;
    emissionFactor: number;
  }[];
  
  contactInfo: {
    department: string;
    position: string;
    name: string;
    email: string;
    phone: string;
  }[];
}

const mockCompanyData: CompanyDetailData = {
  id: 'tier1-p1-1',
  companyName: '한국배터리',
  companyNameEn: 'Korea Battery Co.',
  companyType: 'Supplier',
  tier: 'Tier 1',
  country: 'South Korea',
  productType: '배터리 셀',
  deliveryVolume: 30000,
  pcfResult: 12820.4,
  status: 'verified',
  
  organizationInfo: {
    companyName: '한국배터리',
    businessRegistrationNumber: '123-45-67890',
    country: 'South Korea',
    address: '서울특별시 강남구 테헤란로 123',
    dunsNumber: 'DUNS-123456789',
    taxId: 'TAX-KR-001',
    website: 'https://koreabattery.com',
    ceoName: '김철수',
    ceoEmail: 'ceo@koreabattery.com',
    ceoPhone: '+82-2-1234-5678',
    rmiSmelter: true,
    feoc: false,
    supplierType: 'Tier 1 Supplier',
  },
  
  siteInfo: [
    {
      siteId: 'SITE-001',
      siteName: '서울 본사 공장',
      country: 'South Korea',
      address: '서울특별시 강남구 테헤란로 123',
      managerName: '이영희',
      managerEmail: 'manager1@koreabattery.com',
      managerPhone: '+82-2-1234-5679',
      renewableEnergy: true,
      environmentalCertification: 'ISO 14001',
      rmiSmelter: true,
      feoc: false,
    },
    {
      siteId: 'SITE-002',
      siteName: '천안 제2공장',
      country: 'South Korea',
      address: '충청남도 천안시 서북구 공단로 456',
      managerName: '박민수',
      managerEmail: 'manager2@koreabattery.com',
      managerPhone: '+82-41-5678-9012',
      renewableEnergy: false,
      environmentalCertification: 'ISO 14001',
      rmiSmelter: false,
      feoc: false,
    },
  ],
  
  productInfo: [
    {
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
      productId: 'PROD-002',
      productName: '리튬이온 배터리 셀 (NCA)',
      deliveryQuantity: 15000,
      unit: 'EA',
      standardWeight: 0.5,
      unitWeight: 0.49,
      hsCode: '8507.60.00',
      mineralType: 'Lithium',
      mineralContent: 11.8,
      recyclingRatio: 3,
      mineralOrigin: 'Chile',
    },
  ],
  
  productionInfo: [
    {
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
    {
      targetProduct: '리튬이온 배터리 셀',
      materialCategory: '원자재',
      materialName: '음극재',
      materialQuantity: 3000,
      unit: 'kg',
      recyclingRatio: 3,
      energyType: '전기',
      energyUsage: 8000,
      energyUnit: 'kWh',
      transportType: '육상운송',
      transportMode: '트럭',
      standardWeight: 0.3,
      actualWeight: 0.29,
      output: 30000,
      loss: 300,
      waste: 150,
      emissionFactor: 1.8,
    },
  ],
  
  contactInfo: [
    {
      department: '영업팀',
      position: '팀장',
      name: '최영수',
      email: 'sales@koreabattery.com',
      phone: '+82-2-1234-5680',
    },
    {
      department: 'ESG팀',
      position: '담당자',
      name: '정은지',
      email: 'esg@koreabattery.com',
      phone: '+82-2-1234-5681',
    },
  ],
};

export default function CompanyDetail() {
  const { companyId } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  
  // Mock data - in real app, fetch based on companyId
  const company = mockCompanyData;
  const isOperator = company.companyType === 'Operator';
  
  // Tab definitions
  const supplierTabs = [
    '기업 기본정보',
    '담당자 정보',
    '사업장 정보',
    '생산(납품) 제품 정보',
    '자재 정보',
    '에너지 정보',
    '운송 정보',
  ];
  
  const operatorTabs = [
    '기업 및 조직 식별 정보',
    '사업장 정보',
    '자재 및 품목',
    '공정 운영 및 정밀 실적 정보',
    '담당자 정보',
  ];
  
  const tabs = isOperator ? operatorTabs : supplierTabs;

  const SUP_DETAIL_TABLE = 'w-full border-collapse border border-gray-300';
  const SUP_DETAIL_TABLE_EDITABLE =
    'w-full min-w-[1200px] table-fixed border-collapse border border-gray-300';
  // 긴 문자열(공백 없는 이메일/코드/URL 등)도 옆 칸을 침범하지 않도록 셀 내부에서 줄바꿈/절단 처리
  const SUP_DETAIL_TH =
    'border border-gray-300 bg-[#F8F9FA] py-4 px-4 text-left align-middle text-sm font-semibold text-[var(--aifix-navy)] min-w-0 overflow-hidden whitespace-normal break-words';
  const SUP_DETAIL_TD =
    'border border-gray-300 py-4 px-4 align-top min-w-0 overflow-hidden whitespace-normal break-words';
  const SUP_DETAIL_TD_LABEL =
    'border border-gray-300 bg-[#F9FAFB] py-4 px-4 align-top text-sm font-medium text-[var(--aifix-gray)] min-w-0 overflow-hidden whitespace-normal break-words';

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div
      className="bg-white rounded-[20px] overflow-x-hidden overflow-y-visible"
      style={{ boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.05)' }}
    >
      <div className="px-2 pb-8 pt-2">
        <div className="min-h-[28rem] sm:min-h-[32rem] border border-gray-200 rounded-xl bg-white [scrollbar-gutter:stable] overflow-x-auto [overflow-y:visible]">
          {children}
        </div>
      </div>
    </div>
  );

  const toYesNo = (v: boolean) => (v ? '해당' : '미해당');
  const toRmi = (v: boolean) => (v ? '인증됨' : '미인증');
  const safe = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));

  const facilitiesRows = useMemo(() => {
    const reg = company.organizationInfo.businessRegistrationNumber;
    return (company.siteInfo ?? []).map((s) => ({
      registrationNumber: reg,
      siteSubNumber: s.siteId,
      name: s.siteName,
      country: s.country,
      address: s.address,
      representative: s.managerName,
      email: s.managerEmail,
      phone: s.managerPhone,
      rmiSmelter: toRmi(s.rmiSmelter),
      feoc: toYesNo(s.feoc),
    }));
  }, [company.organizationInfo.businessRegistrationNumber, company.siteInfo]);

  const productRows = useMemo(() => {
    return (company.productInfo ?? []).map((p) => ({
      name: p.productName,
      origin: p.mineralOrigin,
      deliveryDate: '-',
      quantity: String(p.deliveryQuantity ?? '-'),
      unit: p.unit,
      standardWeight: String(p.standardWeight ?? '-'),
      wasteQuantity: '-',
      wasteEmissionFactor: '-',
      wasteEmissionFactorUnit: '-',
    }));
  }, [company.productInfo]);

  const materialRows = useMemo(() => {
    // 최소 예시 1행: productionInfo 기반으로 채우거나 빈 값
    const first = company.productionInfo?.[0];
    return [
      {
        productName: safe(first?.targetProduct),
        inputMaterialName: safe(first?.materialName),
        inputAmount: safe(first?.materialQuantity),
        inputAmountUnit: safe(first?.unit),
        materialEmissionFactor: '-',
        materialEmissionFactorUnit: '-',
        mineralType: '-',
        mineralAmount: '-',
        mineralOrigin: '-',
        mineralEmissionFactor: '-',
        mineralEmissionFactorUnit: '-',
      },
    ];
  }, [company.productionInfo]);

  const energyRows = useMemo(() => {
    const first = company.productionInfo?.[0];
    return [
      {
        productName: safe(first?.targetProduct),
        energyType: safe(first?.energyType),
        energyUsage: safe(first?.energyUsage),
        energyUnit: safe(first?.energyUnit),
        emissionFactor: safe(first?.emissionFactor),
        emissionFactorUnit: '-',
      },
    ];
  }, [company.productionInfo]);

  const transportRows = useMemo(() => {
    const first = company.productionInfo?.[0];
    return [
      {
        productName: safe(first?.targetProduct),
        originCountry: safe(company.country),
        originAddress: safe(company.organizationInfo.address),
        destinationCountry: safe(company.country),
        destinationAddress: safe(company.organizationInfo.address),
        transportMethod: safe(first?.transportMode),
        transportAmount: safe(company.deliveryVolume),
        transportAmountUnit: 'kg',
        emissionFactor: safe(first?.emissionFactor),
        emissionFactorUnit: '-',
      },
    ];
  }, [company.country, company.deliveryVolume, company.organizationInfo.address, company.productionInfo]);
  
  const handleExportExcel = () => {
    toast.success('Excel 파일을 다운로드합니다');
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
    if (isOperator) {
      // Operator tabs
      switch (activeTab) {
        case 0: // 기업 및 조직 식별 정보
          return (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 bg-gray-50 font-medium text-sm w-1/3">회사명</td>
                    <td className="px-4 py-3 text-sm">{company.organizationInfo.companyName}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 bg-gray-50 font-medium text-sm">사업자 등록번호</td>
                    <td className="px-4 py-3 text-sm">{company.organizationInfo.businessRegistrationNumber}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 bg-gray-50 font-medium text-sm">국가 소재지</td>
                    <td className="px-4 py-3 text-sm">{company.organizationInfo.country}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 bg-gray-50 font-medium text-sm">상세 주소</td>
                    <td className="px-4 py-3 text-sm">{company.organizationInfo.address}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 bg-gray-50 font-medium text-sm">DUNS Number</td>
                    <td className="px-4 py-3 text-sm">{company.organizationInfo.dunsNumber}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 bg-gray-50 font-medium text-sm">텍스 ID</td>
                    <td className="px-4 py-3 text-sm">{company.organizationInfo.taxId}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 bg-gray-50 font-medium text-sm">공식 홈페이지 주소</td>
                    <td className="px-4 py-3 text-sm">
                      <a href={company.organizationInfo.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {company.organizationInfo.website}
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 bg-gray-50 font-medium text-sm">대표자 명</td>
                    <td className="px-4 py-3 text-sm">{company.organizationInfo.ceoName}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 bg-gray-50 font-medium text-sm">대표 이메일</td>
                    <td className="px-4 py-3 text-sm">{company.organizationInfo.ceoEmail}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 bg-gray-50 font-medium text-sm">대표자 연락처</td>
                    <td className="px-4 py-3 text-sm">{company.organizationInfo.ceoPhone}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 bg-gray-50 font-medium text-sm">FEOC 여부</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${company.organizationInfo.feoc ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {company.organizationInfo.feoc ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
          
        case 1: // 사업장 정보
          return (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">종사업장번호</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">사업장 명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">국가 소재지</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">상세주소</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">대표자 명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">신재생 에너지</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">환경 인증</th>
                  </tr>
                </thead>
                <tbody>
                  {company.siteInfo.map((site, idx) => (
                    <tr key={site.siteId} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-3 text-sm">{site.siteId}</td>
                      <td className="px-4 py-3 text-sm font-medium">{site.siteName}</td>
                      <td className="px-4 py-3 text-sm">{site.country}</td>
                      <td className="px-4 py-3 text-sm">{site.address}</td>
                      <td className="px-4 py-3 text-sm">{site.managerName}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${site.renewableEnergy ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {site.renewableEnergy ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{site.environmentalCertification}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          
        case 2: // 자재 및 품목
          return (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">자재명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">기본 단위</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">HS 코드</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">배출계수 ID</th>
                  </tr>
                </thead>
                <tbody>
                  {company.materialInfo && company.materialInfo.map((material, idx) => (
                    <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-3 text-sm font-medium">{material.materialName}</td>
                      <td className="px-4 py-3 text-sm">{material.unit}</td>
                      <td className="px-4 py-3 text-sm">{material.hsCode}</td>
                      <td className="px-4 py-3 text-sm">{material.emissionFactorId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          
        case 3: // 공정 운영 및 정밀 실적 정보
          return (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">공정명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">설비명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">투입자재명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">투입량</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">에너지 사용량</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">산출물</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">손실량</th>
                  </tr>
                </thead>
                <tbody>
                  {company.processInfo && company.processInfo.map((process, idx) => (
                    <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-3 text-sm font-medium">{process.processName}</td>
                      <td className="px-4 py-3 text-sm">{process.facilityName}</td>
                      <td className="px-4 py-3 text-sm">{process.materialName}</td>
                      <td className="px-4 py-3 text-sm">{process.materialQuantity.toLocaleString()} {process.unit}</td>
                      <td className="px-4 py-3 text-sm">{process.energyUsage.toLocaleString()} {process.energyUnit}</td>
                      <td className="px-4 py-3 text-sm">{process.output.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">{process.loss.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          
        case 4: // 담당자 정보
          return (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">부서명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">직급</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">이름</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">이메일</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {company.contactInfo.map((contact, idx) => (
                    <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-3 text-sm">{contact.department}</td>
                      <td className="px-4 py-3 text-sm">{contact.position}</td>
                      <td className="px-4 py-3 text-sm font-medium">{contact.name}</td>
                      <td className="px-4 py-3 text-sm">{contact.email}</td>
                      <td className="px-4 py-3 text-sm">{contact.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          
        default:
          return null;
      }
    } else {
      // Supplier tabs
      switch (activeTab) {
        case 0: // 기업 기본정보
          return (
            <Shell>
              <table className={SUP_DETAIL_TABLE}>
                <tbody>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL} style={{ width: '200px' }}>회사명</td>
                    <td className={SUP_DETAIL_TD}>{safe(company.organizationInfo.companyName)}</td>
                  </tr>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL}>사업자등록번호</td>
                    <td className={SUP_DETAIL_TD}>{safe(company.organizationInfo.businessRegistrationNumber)}</td>
                  </tr>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL}>국가 소재지</td>
                    <td className={SUP_DETAIL_TD}>{safe(company.organizationInfo.country)}</td>
                  </tr>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL}>상세주소</td>
                    <td className={SUP_DETAIL_TD}>{safe(company.organizationInfo.address)}</td>
                  </tr>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL}>DUNS Number</td>
                    <td className={SUP_DETAIL_TD}>{safe(company.organizationInfo.dunsNumber)}</td>
                  </tr>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL}>텍스 ID</td>
                    <td className={SUP_DETAIL_TD}>{safe(company.organizationInfo.taxId)}</td>
                  </tr>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL}>공식 홈페이지 주소</td>
                    <td className={SUP_DETAIL_TD}>
                      <a
                        href={company.organizationInfo.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--aifix-primary)', textDecoration: 'underline' }}
                      >
                        {safe(company.organizationInfo.website)}
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL}>대표자명</td>
                    <td className={SUP_DETAIL_TD}>{safe(company.organizationInfo.ceoName)}</td>
                  </tr>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL}>대표 이메일</td>
                    <td className={SUP_DETAIL_TD}>{safe(company.organizationInfo.ceoEmail)}</td>
                  </tr>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL}>대표자 연락처</td>
                    <td className={SUP_DETAIL_TD}>{safe(company.organizationInfo.ceoPhone)}</td>
                  </tr>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL}>RMI 인증 여부</td>
                    <td className={SUP_DETAIL_TD}>{toRmi(company.organizationInfo.rmiSmelter)}</td>
                  </tr>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL}>FEOC 여부</td>
                    <td className={SUP_DETAIL_TD}>{toYesNo(company.organizationInfo.feoc)}</td>
                  </tr>
                  <tr>
                    <td className={SUP_DETAIL_TD_LABEL}>공급자 유형</td>
                    <td className={SUP_DETAIL_TD}>{safe(company.organizationInfo.supplierType)}</td>
                  </tr>
                </tbody>
              </table>
            </Shell>
          );
          
        case 1: // 담당자 정보
          return (
            <Shell>
              <table className={SUP_DETAIL_TABLE}>
                <thead>
                  <tr>
                    <th className={SUP_DETAIL_TH}>부서명</th>
                    <th className={SUP_DETAIL_TH}>직급</th>
                    <th className={SUP_DETAIL_TH}>이름</th>
                    <th className={SUP_DETAIL_TH}>이메일</th>
                    <th className={SUP_DETAIL_TH}>연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {(company.contactInfo ?? []).map((c, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className={SUP_DETAIL_TD}>{safe(c.department)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(c.position)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(c.name)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(c.email)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(c.phone)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Shell>
          );
          
        case 2: // 사업장 정보
          return (
            <Shell>
              <table className={SUP_DETAIL_TABLE_EDITABLE}>
                <thead>
                  <tr>
                    <th className={SUP_DETAIL_TH}>사업자등록번호</th>
                    <th className={SUP_DETAIL_TH}>종사업장번호</th>
                    <th className={SUP_DETAIL_TH}>사업장 명</th>
                    <th className={SUP_DETAIL_TH}>국가 소재지</th>
                    <th className={SUP_DETAIL_TH}>상세주소</th>
                    <th className={SUP_DETAIL_TH}>대표자명</th>
                    <th className={SUP_DETAIL_TH}>대표 이메일</th>
                    <th className={SUP_DETAIL_TH}>대표자 연락처</th>
                    <th className={SUP_DETAIL_TH}>RMI 인증 여부</th>
                    <th className={SUP_DETAIL_TH}>FEOC 여부</th>
                  </tr>
                </thead>
                <tbody>
                  {facilitiesRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className={SUP_DETAIL_TD}>{safe(r.registrationNumber)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.siteSubNumber)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.name)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.country)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.address)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.representative)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.email)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.phone)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.rmiSmelter)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.feoc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Shell>
          );
          
        case 3: // 생산(납품) 제품 정보
          return (
            <Shell>
              <table className={SUP_DETAIL_TABLE_EDITABLE}>
                <thead>
                  <tr>
                    <th className={SUP_DETAIL_TH}>제품명</th>
                    <th className={SUP_DETAIL_TH}>광물 원산지</th>
                    <th className={SUP_DETAIL_TH}>납품일</th>
                    <th className={SUP_DETAIL_TH}>납품 수량(생산량)</th>
                    <th className={SUP_DETAIL_TH}>납품 단위(unit)</th>
                    <th className={SUP_DETAIL_TH}>단위 실측 중량 (kg per unit)</th>
                    <th className={SUP_DETAIL_TH}>폐기물량</th>
                    <th className={SUP_DETAIL_TH}>폐기물 배출계수</th>
                    <th className={SUP_DETAIL_TH}>폐기물 배출계수 단위</th>
                  </tr>
                </thead>
                <tbody>
                  {(productRows.length > 0 ? productRows : [{ name: '-', origin: '-', deliveryDate: '-', quantity: '-', unit: '-', standardWeight: '-', wasteQuantity: '-', wasteEmissionFactor: '-', wasteEmissionFactorUnit: '-' }]).map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className={SUP_DETAIL_TD}>{safe(r.name)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.origin)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.deliveryDate)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.quantity)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.unit)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.standardWeight)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.wasteQuantity)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.wasteEmissionFactor)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.wasteEmissionFactorUnit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Shell>
          );

        case 4: // 자재 정보
          return (
            <Shell>
              <table className={SUP_DETAIL_TABLE_EDITABLE}>
                <thead>
                  <tr>
                    <th className={SUP_DETAIL_TH}>제품명</th>
                    <th className={SUP_DETAIL_TH}>투입 자재명</th>
                    <th className={SUP_DETAIL_TH}>투입량</th>
                    <th className={SUP_DETAIL_TH}>투입량 단위</th>
                    <th className={SUP_DETAIL_TH}>자재 배출계수</th>
                    <th className={SUP_DETAIL_TH}>자재 배출계수 단위</th>
                    <th className={SUP_DETAIL_TH}>투입 광물 종류</th>
                    <th className={SUP_DETAIL_TH}>투입 광물량</th>
                    <th className={SUP_DETAIL_TH}>광물 원산지</th>
                    <th className={SUP_DETAIL_TH}>광물 배출계수</th>
                    <th className={SUP_DETAIL_TH}>광물 배출계수 단위</th>
                  </tr>
                </thead>
                <tbody>
                  {materialRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className={SUP_DETAIL_TD}>{safe(r.productName)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.inputMaterialName)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.inputAmount)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.inputAmountUnit)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.materialEmissionFactor)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.materialEmissionFactorUnit)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.mineralType)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.mineralAmount)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.mineralOrigin)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.mineralEmissionFactor)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.mineralEmissionFactorUnit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Shell>
          );

        case 5: // 에너지 정보
          return (
            <Shell>
              <table className={SUP_DETAIL_TABLE_EDITABLE}>
                <thead>
                  <tr>
                    <th className={SUP_DETAIL_TH}>제품명</th>
                    <th className={SUP_DETAIL_TH}>에너지 유형</th>
                    <th className={SUP_DETAIL_TH}>에너지 사용량</th>
                    <th className={SUP_DETAIL_TH}>에너지 단위</th>
                    <th className={SUP_DETAIL_TH}>에너지 배출계수</th>
                    <th className={SUP_DETAIL_TH}>에너지 배출계수 단위</th>
                  </tr>
                </thead>
                <tbody>
                  {energyRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className={SUP_DETAIL_TD}>{safe(r.productName)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.energyType)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.energyUsage)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.energyUnit)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.emissionFactor)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.emissionFactorUnit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Shell>
          );

        case 6: // 운송 정보
          return (
            <Shell>
              <table className={SUP_DETAIL_TABLE_EDITABLE}>
                <thead>
                  <tr>
                    <th className={SUP_DETAIL_TH}>제품명</th>
                    <th className={SUP_DETAIL_TH}>출발지 국가</th>
                    <th className={SUP_DETAIL_TH}>출발지 상세 주소</th>
                    <th className={SUP_DETAIL_TH}>도착지 국가</th>
                    <th className={SUP_DETAIL_TH}>도착지 상세주소</th>
                    <th className={SUP_DETAIL_TH}>운송수단</th>
                    <th className={SUP_DETAIL_TH}>운송 물량</th>
                    <th className={SUP_DETAIL_TH}>물량 단위</th>
                    <th className={SUP_DETAIL_TH}>운송 배출계수</th>
                    <th className={SUP_DETAIL_TH}>운송 배출계수 단위</th>
                  </tr>
                </thead>
                <tbody>
                  {transportRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className={SUP_DETAIL_TD}>{safe(r.productName)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.originCountry)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.originAddress)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.destinationCountry)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.destinationAddress)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.transportMethod)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.transportAmount)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.transportAmountUnit)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.emissionFactor)}</td>
                      <td className={SUP_DETAIL_TD}>{safe(r.emissionFactorUnit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Shell>
          );
          
        default:
          return null;
      }
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
      
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">목록으로 돌아가기</span>
      </button>
      
      {/* Company Meta Information Card */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl">
              <Building2 className="w-8 h-8 text-[#5B3BFA]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{company.companyName}</h1>
              <p className="text-gray-600 mt-1">{company.companyNameEn}</p>
            </div>
          </div>
          
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Excel 다운로드
          </button>
        </div>
        
        <div className="grid grid-cols-4 gap-6">
          <div>
            <div className="text-sm text-gray-600 mb-1">회사 유형</div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                company.companyType === 'Operator' 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {company.companyType}
              </span>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 mb-1">Tier</div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#5B3BFA] text-white rounded-full text-sm font-semibold">
                {company.tier}
              </span>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 mb-1">국가</div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{company.country}</span>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 mb-1">납품 제품</div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{company.productType}</span>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 mb-1">납품량</div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="font-bold text-lg">{company.deliveryVolume.toLocaleString()} kg</span>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 mb-1">PCF 결과</div>
            <div className="font-bold text-lg text-[#00B4FF]">
              {company.pcfResult !== null 
                ? `${company.pcfResult.toLocaleString()} kg CO₂e` 
                : '미산정'
              }
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 mb-1">상태</div>
            <div>
              {company.status === 'verified' ? (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1 w-fit">
                  <CheckCircle className="w-3 h-3" />
                  검증완료
                </span>
              ) : (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium flex items-center gap-1 w-fit">
                  <AlertTriangle className="w-3 h-3" />
                  검증 대기
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="bg-white rounded-[20px] p-6" style={{ boxShadow: '0px 4px 16px rgba(0,0,0,0.05)' }}>
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 mb-6">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className="px-4 py-2 rounded-lg text-sm transition-all duration-200"
              style={
                activeTab === index
                  ? { background: 'var(--aifix-primary)', color: 'white', fontWeight: 700 }
                  : { background: '#F1F5F9', color: 'var(--aifix-navy)', fontWeight: 600 }
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {renderTabContent()}
      </div>
    </div>
  );
}
