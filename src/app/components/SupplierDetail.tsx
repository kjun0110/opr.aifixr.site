'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, MapPin, Package, TrendingUp, AlertTriangle, Download, Lock, Send } from 'lucide-react';
import { toast } from 'sonner';

// Mock Supplier company data
interface SupplierDetailData {
  id: string;
  companyName: string;
  companyNameEn: string;
  companyType: 'Supplier';
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  country: string;
  productType: string;
  deliveryVolume: string;
  pcfResult: number | null;
  status: string;
  
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
  
  productInfo: {
    materialId: string;
    productName: string;
    deliveryQuantity: number;
    unit: string;
    standardWeight: number;
    unitWeight: number;
    hsCode: string;
    mineralType: string;
    mineralContent: number;
    mineralRecyclingRatio: number;
    mineralOrigin: string;
  }[];
  
  productionInfo: {
    id: string;
    materialCategory: string;
    materialName: string;
    inputQuantity: number;
    inputUnit: string;
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
  
  contactInfo: {
    department: string;
    position: string;
    name: string;
    email: string;
    phone: string;
  }[];
}

// tier1-p1-1 베이스 데이터 (IIFE에서 재사용 - 초기화 순서 이슈 방지)
const baseTier1P1Data: SupplierDetailData = {
    id: 'tier1-p1-1',
    companyName: '한국배터리',
    companyNameEn: 'Korea Battery Co.',
    companyType: 'Supplier',
    tier: 'Tier 1',
    country: 'South Korea',
    productType: '배터리 셀',
    deliveryVolume: '30,000 kg',
    pcfResult: 12820.4,
    status: '검증완료',
    organizationInfo: {
      companyName: '한국배터리 (Korea Battery Co.)',
      businessRegistrationNumber: 'KR-1234567890',
      country: 'South Korea',
      address: 'Cheonan-si, Chungcheongnam-do, South Korea',
      dunsNumber: 'DUNS-123456789',
      taxId: 'TAX-KR-BATTERY',
      website: 'https://koreabattery.co.kr',
      ceoName: '김철수',
      ceoEmail: 'ceo@koreabattery.co.kr',
      ceoPhone: '+82-41-1234-5678',
      rmiSmelter: false,
      feoc: false,
      supplierType: 'Battery Manufacturer',
    },
    siteInfo: [
      {
        siteId: 'SITE-KB-001',
        siteName: '천안사업장',
        country: 'South Korea',
        address: 'Cheonan Industrial Complex, Cheonan-si',
        managerName: '박영희',
        managerEmail: 'park@koreabattery.co.kr',
        managerPhone: '+82-41-2345-6789',
        renewableEnergy: true,
        environmentalCertification: 'ISO 14001, ISO 50001',
        rmiSmelter: false,
        feoc: false,
      },
    ],
    productInfo: [
      {
        materialId: 'MAT-KB-001',
        productName: '배터리 셀',
        deliveryQuantity: 30000,
        unit: 'kg',
        standardWeight: 0.5,
        unitWeight: 0.48,
        hsCode: '8507.60.00',
        mineralType: '리튬, 니켈',
        mineralContent: 12.5,
        mineralRecyclingRatio: 5,
        mineralOrigin: 'South Korea, Australia',
      },
    ],
    productionInfo: [
      {
        id: 'prod-kb-1',
        materialCategory: '원자재',
        materialName: '리튬 화합물',
        inputQuantity: 2000,
        inputUnit: 'kg',
        recyclingRatio: 5,
        energyType: '전기 (그린)',
        energyUsage: 35000,
        energyUnit: 'kWh',
        transportType: '육상운송',
        transportMode: '트럭',
        standardWeight: 0.5,
        actualWeight: 0.48,
        output: 30000,
        scrap: 1200,
        waste: 300,
        emissionFactor: 2.8,
      },
      {
        id: 'prod-kb-2',
        materialCategory: '원자재',
        materialName: '니켈 소재',
        inputQuantity: 1800,
        inputUnit: 'kg',
        recyclingRatio: 8,
        energyType: '전기 (그린)',
        energyUsage: 8000,
        energyUnit: 'kWh',
        transportType: '육상운송',
        transportMode: '트럭',
        standardWeight: 0.15,
        actualWeight: 0.14,
        output: 30000,
        scrap: 150,
        waste: 50,
        emissionFactor: 1.5,
      },
    ],
    contactInfo: [
      {
        department: 'ESG팀',
        position: '팀장',
        name: '이민준',
        email: 'lee@koreabattery.co.kr',
        phone: '+82-41-3456-7890',
      },
      {
        department: '생산관리팀',
        position: '과장',
        name: '최서연',
        email: 'choi@koreabattery.co.kr',
        phone: '+82-41-4567-8901',
      },
    ],
};

const mockSupplierData: Record<string, SupplierDetailData> = {
  'tier1-p1-1': baseTier1P1Data,
  
  // 글로벌소재 (Global Materials Ltd.)
  'tier1-p1-2': {
    id: 'tier1-p1-2',
    companyName: '글로벌 소재',
    companyNameEn: 'Global Materials Ltd.',
    companyType: 'Supplier',
    tier: 'Tier 1',
    country: 'Germany',
    productType: '친환경 소재',
    deliveryVolume: '20,000 kg',
    pcfResult: 6050.2,
    status: 'PCF 계산 완료',
    organizationInfo: {
      companyName: '글로벌 소재 (Global Materials Ltd.)',
      businessRegistrationNumber: 'DE-8765432109',
      country: 'Germany',
      address: 'Munich, Bavaria, Germany',
      dunsNumber: 'DUNS-876543210',
      taxId: 'TAX-DE-GLOBAL',
      website: 'https://globalmaterials.de',
      ceoName: 'Hans Mueller',
      ceoEmail: 'mueller@globalmaterials.de',
      ceoPhone: '+49-89-1234-5678',
      rmiSmelter: false,
      feoc: true,
      supplierType: 'Materials Supplier',
    },
    siteInfo: [
      {
        siteId: 'SITE-GM-001',
        siteName: 'Munich Plant',
        country: 'Germany',
        address: 'Industrial Zone 5, Munich',
        managerName: 'Anna Schmidt',
        managerEmail: 'schmidt@globalmaterials.de',
        managerPhone: '+49-89-2345-6789',
        renewableEnergy: true,
        environmentalCertification: 'ISO 14001, EMAS',
        rmiSmelter: false,
        feoc: true,
      },
    ],
    productInfo: [
      {
        materialId: 'MAT-GM-001',
        productName: '친환경 소재',
        deliveryQuantity: 20000,
        unit: 'kg',
        standardWeight: 0.35,
        unitWeight: 0.33,
        hsCode: '3907.60.00',
        mineralType: '재활용 폴리머',
        mineralContent: 85.0,
        mineralRecyclingRatio: 60,
        mineralOrigin: 'Germany, France',
      },
    ],
    productionInfo: [
      {
        id: 'prod-gm-1',
        materialCategory: '재활용 원료',
        materialName: '재활용 폴리머',
        inputQuantity: 12000,
        inputUnit: 'kg',
        recyclingRatio: 60,
        energyType: '전기 (재생)',
        energyUsage: 18000,
        energyUnit: 'kWh',
        transportType: '육상운송',
        transportMode: '철도',
        standardWeight: 0.35,
        actualWeight: 0.33,
        output: 20000,
        scrap: 500,
        waste: 100,
        emissionFactor: 1.8,
      },
      {
        id: 'prod-gm-2',
        materialCategory: '부자재',
        materialName: '친환경 첨가제',
        inputQuantity: 800,
        inputUnit: 'kg',
        recyclingRatio: 0,
        energyType: '전기 (재생)',
        energyUsage: 3000,
        energyUnit: 'kWh',
        transportType: '육상운송',
        transportMode: '철도',
        standardWeight: 0.05,
        actualWeight: 0.04,
        output: 20000,
        scrap: 30,
        waste: 10,
        emissionFactor: 0.5,
      },
    ],
    contactInfo: [
      {
        department: 'Sustainability',
        position: 'Director',
        name: 'Klaus Weber',
        email: 'weber@globalmaterials.de',
        phone: '+49-89-3456-7890',
      },
      {
        department: 'Production',
        position: 'Manager',
        name: 'Maria Fischer',
        email: 'fischer@globalmaterials.de',
        phone: '+49-89-4567-8901',
      },
    ],
  },
  
  // 셀테크 (Cell Tech Inc.)
  'tier2-p1-1': {
    id: 'tier2-p1-1',
    companyName: '셀테크',
    companyNameEn: 'Cell Tech Inc.',
    companyType: 'Supplier',
    tier: 'Tier 2',
    country: 'China',
    productType: '리튬이온 셀',
    deliveryVolume: '20,000 kg',
    pcfResult: null,
    status: '계산 대기',
    organizationInfo: {
      companyName: '셀테크 (Cell Tech Inc.)',
      businessRegistrationNumber: 'CN-9876543210',
      country: 'China',
      address: 'Shenzhen, Guangdong Province, China',
      dunsNumber: 'DUNS-987654321',
      taxId: 'TAX-CN-CELL',
      website: 'https://celltech.cn',
      ceoName: 'Li Wei',
      ceoEmail: 'liwei@celltech.cn',
      ceoPhone: '+86-755-1234-5678',
      rmiSmelter: true,
      feoc: false,
      supplierType: 'Component Supplier',
    },
    siteInfo: [
      {
        siteId: 'SITE-CELL-001',
        siteName: 'Shenzhen Factory',
        country: 'China',
        address: 'No. 123 Industrial Park, Shenzhen',
        managerName: 'Zhang Ming',
        managerEmail: 'zhang@celltech.cn',
        managerPhone: '+86-755-2345-6789',
        renewableEnergy: false,
        environmentalCertification: 'ISO 14001',
        rmiSmelter: true,
        feoc: false,
      },
    ],
    productInfo: [
      {
        materialId: 'MAT-CELL-001',
        productName: '리튬이온 셀',
        deliveryQuantity: 20000,
        unit: 'kg',
        standardWeight: 0.45,
        unitWeight: 0.44,
        hsCode: '8507.60.00',
        mineralType: '리튬',
        mineralContent: 7.5,
        mineralRecyclingRatio: 0,
        mineralOrigin: 'Australia',
      },
    ],
    productionInfo: [
      {
        id: 'prod-1',
        materialCategory: '원자재',
        materialName: '리튬 화합물',
        inputQuantity: 1500,
        inputUnit: 'kg',
        recyclingRatio: 0,
        energyType: '전기',
        energyUsage: 25000,
        energyUnit: 'kWh',
        transportType: '육상운송',
        transportMode: '트럭',
        standardWeight: 0.45,
        actualWeight: 0.44,
        output: 20000,
        scrap: 800,
        waste: 200,
        emissionFactor: 3.5,
      },
      {
        id: 'prod-2',
        materialCategory: '부자재',
        materialName: '전해질',
        inputQuantity: 500,
        inputUnit: 'L',
        recyclingRatio: 0,
        energyType: '전기',
        energyUsage: 5000,
        energyUnit: 'kWh',
        transportType: '육상운송',
        transportMode: '트럭',
        standardWeight: 0.1,
        actualWeight: 0.09,
        output: 20000,
        scrap: 50,
        waste: 10,
        emissionFactor: 1.2,
      },
    ],
    contactInfo: [
      {
        department: 'ESG팀',
        position: 'Manager',
        name: 'Wang Fang',
        email: 'wang@celltech.cn',
        phone: '+86-755-3456-7890',
      },
      {
        department: '생산관리팀',
        position: 'Supervisor',
        name: 'Liu Chen',
        email: 'liu@celltech.cn',
        phone: '+86-755-4567-8901',
      },
    ],
  },
  
  // 리튬광산 (Lithium Mine Corp.)
  'tier3-p1-1': {
    id: 'tier3-p1-1',
    companyName: '리튬광산',
    companyNameEn: 'Lithium Mine Corp.',
    companyType: 'Supplier',
    tier: 'Tier 3',
    country: 'Australia',
    productType: '리튬 원광',
    deliveryVolume: '10,000 kg',
    pcfResult: 2101.8,
    status: '데이터 미제출',
    organizationInfo: {
      companyName: '리튬광산 (Lithium Mine Corp.)',
      businessRegistrationNumber: 'AU-5432109876',
      country: 'Australia',
      address: 'Pilbara Region, Western Australia',
      dunsNumber: 'DUNS-543210987',
      taxId: 'TAX-AU-LITHIUM',
      website: 'https://lithiummine.com.au',
      ceoName: 'John Smith',
      ceoEmail: 'jsmith@lithiummine.com.au',
      ceoPhone: '+61-8-9123-4567',
      rmiSmelter: false,
      feoc: false,
      supplierType: 'Raw Material Supplier',
    },
    siteInfo: [
      {
        siteId: 'SITE-LM-001',
        siteName: 'Pilbara Mining Site',
        country: 'Australia',
        address: 'Mining Area 47C, Pilbara Region',
        managerName: 'Sarah Johnson',
        managerEmail: 'sjohnson@lithiummine.com.au',
        managerPhone: '+61-8-9234-5678',
        renewableEnergy: true,
        environmentalCertification: 'ISO 14001',
        rmiSmelter: false,
        feoc: false,
      },
    ],
    productInfo: [
      {
        materialId: 'MAT-LM-001',
        productName: '리튬 원광',
        deliveryQuantity: 10000,
        unit: 'kg',
        standardWeight: 1.0,
        unitWeight: 0.95,
        hsCode: '2530.90.00',
        mineralType: '리튬 스포듀민',
        mineralContent: 6.0,
        mineralRecyclingRatio: 0,
        mineralOrigin: 'Australia',
      },
    ],
    productionInfo: [
      {
        id: 'prod-lm-1',
        materialCategory: '원광',
        materialName: '리튬 광석',
        inputQuantity: 15000,
        inputUnit: 'kg',
        recyclingRatio: 0,
        energyType: '디젤',
        energyUsage: 8000,
        energyUnit: 'L',
        transportType: '광산 운송',
        transportMode: '대형 트럭',
        standardWeight: 1.0,
        actualWeight: 0.95,
        output: 10000,
        scrap: 4500,
        waste: 500,
        emissionFactor: 2.7,
      },
      {
        id: 'prod-lm-2',
        materialCategory: '에너지',
        materialName: '전기 (파쇄 공정)',
        inputQuantity: 0,
        inputUnit: 'kg',
        recyclingRatio: 0,
        energyType: '전기 (그리드)',
        energyUsage: 12000,
        energyUnit: 'kWh',
        transportType: '-',
        transportMode: '-',
        standardWeight: 0,
        actualWeight: 0,
        output: 10000,
        scrap: 0,
        waste: 0,
        emissionFactor: 0.8,
      },
    ],
    contactInfo: [
      {
        department: 'Operations',
        position: 'Site Manager',
        name: 'Michael Brown',
        email: 'mbrown@lithiummine.com.au',
        phone: '+61-8-9345-6789',
      },
      {
        department: 'Environmental',
        position: 'Compliance Officer',
        name: 'Emma Wilson',
        email: 'ewilson@lithiummine.com.au',
        phone: '+61-8-9456-7890',
      },
    ],
  },

  // 협력사 포털 공급망 회사들 (DataView Audi 조회결과용)
  ...(() => {
    const base = baseTier1P1Data;
    const mk = (o: Partial<SupplierDetailData> & { id: string }) => ({
      ...base,
      ...o,
      organizationInfo: { ...base.organizationInfo, companyName: `${(o.companyName || base.companyName)} (${o.companyNameEn || base.companyNameEn})` },
    });
    return {
      'tier1-1': mk({ id: 'tier1-1', companyName: '동우전자부품', companyNameEn: 'Dongwoo Electronic Components', tier: 'Tier 1', productType: '전자부품', deliveryVolume: '25,000 kg', pcfResult: 18200, status: '미제출' }),
      'tier1-2': mk({ id: 'tier1-2', companyName: '한국소재산업', companyNameEn: 'Korea Material Industry', tier: 'Tier 1', productType: '소재', deliveryVolume: '18,000 kg', pcfResult: 9500, status: '검증실패' }),
      'tier1-3': mk({ id: 'tier1-3', companyName: '테크놀로지파트너스', companyNameEn: 'Technology Partners', tier: 'Tier 1', productType: '기술 부품', deliveryVolume: '7,000 kg', pcfResult: 3120, status: '제출완료' }),
      'tier2-1': mk({ id: 'tier2-1', companyName: '세진케미칼', companyNameEn: 'Sejin Chemical', tier: 'Tier 2', productType: '케미칼 소재', deliveryVolume: '15,000 kg', pcfResult: 8500, status: '보완필요' }),
      'tier2-2': mk({ id: 'tier2-2', companyName: '그린에너지솔루션', companyNameEn: 'Green Energy Solution', tier: 'Tier 2', productType: '에너지 부품', deliveryVolume: '10,000 kg', pcfResult: 4200, status: '미제출' }),
      'tier2-3': mk({ id: 'tier2-3', companyName: '글로벌메탈', companyNameEn: 'Global Metal', tier: 'Tier 2', productType: '금속 소재', country: 'Germany', deliveryVolume: '8,000 kg', pcfResult: 4100, status: '제출완료' }),
      'tier2-4': mk({ id: 'tier2-4', companyName: '에코플라스틱', companyNameEn: 'Eco Plastic', tier: 'Tier 2', productType: '플라스틱', deliveryVolume: '6,000 kg', pcfResult: 2800, status: '제출완료' }),
      'tier2-5': mk({ id: 'tier2-5', companyName: '바이오소재연구소', companyNameEn: 'Bio Material Research Institute', tier: 'Tier 2', productType: '바이오 소재', deliveryVolume: '4,000 kg', pcfResult: null, status: '미제출' }),
      'tier3-1': mk({ id: 'tier3-1', companyName: '디오케미칼', companyNameEn: 'Dio Chemical', tier: 'Tier 3', productType: '원료', deliveryVolume: '8,000 kg', pcfResult: null, status: '미제출' }),
      'tier3-2': mk({ id: 'tier3-2', companyName: '솔브런트', companyNameEn: 'Solvrent', tier: 'Tier 3', productType: '용매', deliveryVolume: '7,000 kg', pcfResult: 3200, status: '제출완료' }),
    };
  })(),
};

export default function SupplierDetail() {
  const { companyId } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestArea, setRequestArea] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  
  const companyKey = Array.isArray(companyId) ? companyId[0] : companyId;
  // DataView 새 구조(card-xxx-month-tier1-1 등) 지원: ID 패턴별 mock 매핑
  const getCompanyWithFallback = () => {
    if (!companyKey) return null;
    if (mockSupplierData[companyKey]) return mockSupplierData[companyKey];
    const patternToKey: [string, string][] = [
      ['-tier1-1', 'tier1-1'], ['-tier1-2', 'tier1-2'], ['-tier1-3', 'tier1-3'],
      ['-tier2-1', 'tier2-1'], ['-tier2-2', 'tier2-2'], ['-tier2-3', 'tier2-3'], ['-tier2-4', 'tier2-4'], ['-tier2-5', 'tier2-5'],
      ['-tier3-1', 'tier3-1'], ['-tier3-2', 'tier3-2'],
      ['-tier1-p1-1', 'tier1-p1-1'], ['-tier1-p1-2', 'tier1-p1-2'], ['-tier2-p1-1', 'tier2-p1-1'], ['-tier3-p1-1', 'tier3-p1-1'],
    ];
    for (const [pat, key] of patternToKey) {
      if (companyKey.includes(pat) && mockSupplierData[key]) return { ...mockSupplierData[key], id: companyKey };
    }
    return null;
  };
  const company = getCompanyWithFallback();
  
  if (!company) {
    return (
      <div className="p-6">
        <p className="text-gray-600">회사 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }
  
  const tabs = [
    { id: 0, name: '기업 및 조직 식별 정보' },
    { id: 1, name: '사업장 정보' },
    { id: 2, name: '납품 제품 정보' },
    { id: 3, name: '생산 및 투입 실적' },
    { id: 4, name: '담당자 정보' },
  ];

  const handleExcelDownload = () => {
    toast.success('Excel 파일을 다운로드합니다');
  };

  const handleRequestSubmit = () => {
    if (!requestArea || !requestMessage.trim()) {
      toast.error('요청 영역과 내용을 모두 입력해주세요');
      return;
    }
    toast.success('수정 요청이 전송되었습니다');
    setShowRequestModal(false);
    setRequestArea('');
    setRequestMessage('');
  };

  // 뒤로가기 시 조회조건 복원을 위한 플래그 (popstate = 브라우저 뒤로가기)
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
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">DUNS Number</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.dunsNumber}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">텍스 ID</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.taxId}</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">공식 홈페이지 주소</td>
                    <td className="px-4 py-3 text-sm border">
                      <a href={company.organizationInfo.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {company.organizationInfo.website}
                      </a>
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">대표자 명</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.ceoName}</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">대표 이메일</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.ceoEmail}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">대표자 연락처</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.ceoPhone}</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">RMI Smelter 여부</td>
                    <td className="px-4 py-3 text-sm border">
                      <span className={company.organizationInfo.rmiSmelter ? 'text-green-600' : 'text-gray-400'}>
                        {company.organizationInfo.rmiSmelter ? '해당' : '미해당'}
                      </span>
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">FEOC 여부</td>
                    <td className="px-4 py-3 text-sm border">
                      <span className={company.organizationInfo.feoc ? 'text-green-600' : 'text-gray-400'}>
                        {company.organizationInfo.feoc ? '해당' : '미해당'}
                      </span>
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">공급자 유형</td>
                    <td className="px-4 py-3 text-sm border">{company.organizationInfo.supplierType}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 1: // 사업장 정보
        return (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">종사업장번호</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">사업장 명</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">국가 소재지</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">상세주소</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">대표자 명</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">대표 이메일</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">대표자 연락처</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">신재생 에너지 사용</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">환경 인증</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">RMI Smelter</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">FEOC 여부</th>
                  </tr>
                </thead>
                <tbody>
                  {company.siteInfo.map((site: any, idx: number) => (
                    <tr key={site.siteId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-3 text-sm border">{site.siteId}</td>
                      <td className="px-3 py-3 text-sm border">{site.siteName}</td>
                      <td className="px-3 py-3 text-sm border">{site.country}</td>
                      <td className="px-3 py-3 text-sm border">{site.address}</td>
                      <td className="px-3 py-3 text-sm border">{site.managerName}</td>
                      <td className="px-3 py-3 text-sm border">{site.managerEmail}</td>
                      <td className="px-3 py-3 text-sm border">{site.managerPhone}</td>
                      <td className="px-3 py-3 text-sm border">
                        {site.renewableEnergy ? (
                          <span className="text-green-600">사용</span>
                        ) : (
                          <span className="text-gray-400">미사용</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm border">{site.environmentalCertification}</td>
                      <td className="px-3 py-3 text-sm border">
                        <span className={site.rmiSmelter ? 'text-green-600' : 'text-gray-400'}>
                          {site.rmiSmelter ? '해당' : '미해당'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm border">
                        <span className={site.feoc ? 'text-green-600' : 'text-gray-400'}>
                          {site.feoc ? '해당' : '미해당'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 2: // 납품 제품 정보
        return (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">자재ID</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">제품명</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">납품 수량</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">기본 단위</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">제품표준중량</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">제품 단위 중량</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">HS 코드 (제품)</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">광물 종류</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">광물 함량</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">광물 재활용 비율</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border">광물 원산지</th>
                  </tr>
                </thead>
                <tbody>
                  {company.productInfo.map((product: any, idx: number) => (
                    <tr key={product.materialId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-3 text-sm border">{product.materialId}</td>
                      <td className="px-3 py-3 text-sm border">{product.productName}</td>
                      <td className="px-3 py-3 text-sm border text-right">{product.deliveryQuantity.toLocaleString()}</td>
                      <td className="px-3 py-3 text-sm border">{product.unit}</td>
                      <td className="px-3 py-3 text-sm border text-right">{product.standardWeight}</td>
                      <td className="px-3 py-3 text-sm border text-right">{product.unitWeight}</td>
                      <td className="px-3 py-3 text-sm border">{product.hsCode}</td>
                      <td className="px-3 py-3 text-sm border">{product.mineralType}</td>
                      <td className="px-3 py-3 text-sm border text-right">{product.mineralContent}%</td>
                      <td className="px-3 py-3 text-sm border text-right">{product.mineralRecyclingRatio}%</td>
                      <td className="px-3 py-3 text-sm border">{product.mineralOrigin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 3: // 생산 및 투입 실적
        return (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">투입 자재 카테고리</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">투입자재명</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">투입수량</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">투입수량 단위</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">자재 재활용 비율</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">투입 에너지 유형</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">에너지 사용량</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">에너지 단위</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">운송유형</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">운송수단</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">제품 표준 중량</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">순중량 실측치</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">산출물(양품)</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">손실량(Scrap)</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">산출 폐기물</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 border">배출계수</th>
                  </tr>
                </thead>
                <tbody>
                  {company.productionInfo.map((prod: any, idx: number) => (
                    <tr key={prod.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 py-2 text-sm border">{prod.materialCategory}</td>
                      <td className="px-2 py-2 text-sm border">{prod.materialName}</td>
                      <td className="px-2 py-2 text-sm border text-right">{prod.inputQuantity.toLocaleString()}</td>
                      <td className="px-2 py-2 text-sm border">{prod.inputUnit}</td>
                      <td className="px-2 py-2 text-sm border text-right">{prod.recyclingRatio}%</td>
                      <td className="px-2 py-2 text-sm border">{prod.energyType}</td>
                      <td className="px-2 py-2 text-sm border text-right">{prod.energyUsage.toLocaleString()}</td>
                      <td className="px-2 py-2 text-sm border">{prod.energyUnit}</td>
                      <td className="px-2 py-2 text-sm border">{prod.transportType}</td>
                      <td className="px-2 py-2 text-sm border">{prod.transportMode}</td>
                      <td className="px-2 py-2 text-sm border text-right">{prod.standardWeight}</td>
                      <td className="px-2 py-2 text-sm border text-right">{prod.actualWeight}</td>
                      <td className="px-2 py-2 text-sm border text-right">{prod.output.toLocaleString()}</td>
                      <td className="px-2 py-2 text-sm border text-right">{prod.scrap.toLocaleString()}</td>
                      <td className="px-2 py-2 text-sm border text-right">{prod.waste.toLocaleString()}</td>
                      <td className="px-2 py-2 text-sm border text-right">{prod.emissionFactor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 4: // 담당자 정보
        return (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">부서명</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">직급</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">이름</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">이메일</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {company.contactInfo.map((contact: any, idx: number) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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
        <span className="text-gray-900 font-medium">협력사 상세</span>
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
                <h1 className="text-2xl font-bold text-gray-900">{company.companyName} ({company.companyNameEn})</h1>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                  {company.companyType}
                </span>
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
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
                  <span className="font-medium">{company.deliveryVolume}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">PCF 결과:</span>
                  <span className="font-medium">
                    {company.pcfResult ? `${company.pcfResult.toLocaleString()} kg CO₂e` : '미산정'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-gray-600">상태:</span>
                  <span className="font-medium text-yellow-600">
                    {company.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRequestModal(true)}
              className="px-5 py-2.5 text-white rounded-lg flex items-center gap-2 font-medium transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
              }}
            >
              <Send className="w-4 h-4" />
              수정 요청
            </button>
            <button
              onClick={handleExcelDownload}
              className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
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

      {/* Data Access Policy Notice */}
      <div
        className="bg-blue-50 border border-blue-200 p-4 flex items-start gap-3"
        style={{ borderRadius: '12px' }}
      >
        <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-blue-900 mb-1">🔒 협력사 입력 데이터 (Read Only)</h3>
          <p className="text-sm text-blue-700">
            원청사는 데이터를 직접 수정할 수 없습니다. 필요한 경우 협력사에 수정 요청을 보낼 수 있습니다.
          </p>
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
                  <Lock className="w-3 h-3 text-gray-400" />
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

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white w-full max-w-2xl"
            style={{
              borderRadius: '20px',
            }}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">협력사 데이터 수정 요청</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">요청 대상 회사</label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="font-medium text-gray-900">{company.companyName} ({company.companyNameEn})</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">요청 데이터 영역 선택</label>
                <select
                  value={requestArea}
                  onChange={(e) => setRequestArea(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                >
                  <option value="">선택해주세요</option>
                  <option value="organization">기업 정보</option>
                  <option value="site">사업장 정보</option>
                  <option value="product">납품 제품 정보</option>
                  <option value="production">생산 및 투입 실적</option>
                  <option value="contact">담당자 정보</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">요청 내용 입력</label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="수정이 필요한 내용을 상세히 입력해주세요..."
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowRequestModal(false);
                  setRequestArea('');
                  setRequestMessage('');
                }}
                className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleRequestSubmit}
                className="px-5 py-2.5 text-white rounded-lg flex items-center gap-2"
                style={{
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                }}
              >
                <Send className="w-4 h-4" />
                요청 전송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}