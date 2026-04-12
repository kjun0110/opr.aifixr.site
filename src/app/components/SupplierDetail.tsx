'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, MapPin, Package, TrendingUp, AlertTriangle, Download, Lock, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadSupplierDetailSnapshot,
  type SupplierDetailSnapshot,
} from '@/lib/dataViewSupplierSnapshot';
import { useMode } from '../context/ModeContext';

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

function normalizeSupplierTier(raw: string): SupplierDetailData['tier'] {
  if (raw === 'Tier 1' || raw === 'Tier 2' || raw === 'Tier 3') return raw;
  if (raw === 'Tier 0') return 'Tier 1';
  const m = /^Tier\s*(\d+)/i.exec(raw);
  if (m) {
    const n = Math.min(3, Math.max(1, parseInt(m[1], 10)));
    return `Tier ${n}` as SupplierDetailData['tier'];
  }
  return 'Tier 1';
}

/** API·목록에서 넘긴 스냅샷 → 기존 상세 UI용 데이터 (미입력 필드는 템플릿 기본값) */
function snapshotToSupplierDetailData(id: string, s: SupplierDetailSnapshot): SupplierDetailData {
  const base = baseTier1P1Data;
  const name = s.companyName?.trim() || '이름 미등록 협력사';
  const nameEn = s.companyNameEn?.trim() || '';
  const tier = normalizeSupplierTier(s.tier);
  return {
    ...base,
    id,
    companyName: name,
    companyNameEn: nameEn,
    tier,
    country: s.country?.trim() || '-',
    productType: s.productType?.trim() || '-',
    pcfResult: s.pcfResult,
    status: s.status?.trim() || '목록에서 조회',
    organizationInfo: {
      ...base.organizationInfo,
      companyName: nameEn ? `${name} (${nameEn})` : name,
      country: s.country?.trim() || '-',
    },
  };
}

function resolveSupplierCompany(companyKey: string | undefined): SupplierDetailData | null {
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
  const snap = loadSupplierDetailSnapshot(companyKey);
  if (snap) return snapshotToSupplierDetailData(companyKey, snap);
  return null;
}

type ParentCompanyHeader =
  | { kind: 'node'; tier: string; companyName: string; companyNameEn?: string }
  | { kind: 'legacy'; text: string };

export default function SupplierDetail() {
  const { companyId } = useParams();
  const router = useRouter();
  const { mode } = useMode();
  const [activeTab, setActiveTab] = useState(0);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestArea, setRequestArea] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [parentCompanyRow, setParentCompanyRow] = useState<ParentCompanyHeader>({
    kind: 'legacy',
    text: '-',
  });

  const companyKey = Array.isArray(companyId) ? companyId[0] : companyId;
  const [company, setCompany] = useState<SupplierDetailData | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    setCompany(resolveSupplierCompany(companyKey));
    setResolved(true);
  }, [companyKey]);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem('aifix_data_view_selected_parent_company_v1');
      if (!v?.trim()) {
        setParentCompanyRow({ kind: 'legacy', text: '-' });
        return;
      }
      const t = v.trim();
      if (t.startsWith('{')) {
        const p = JSON.parse(t) as {
          tier?: string;
          companyName?: string;
          companyNameEn?: string;
        };
        const name = typeof p.companyName === 'string' ? p.companyName.trim() : '';
        if (name) {
          setParentCompanyRow({
            kind: 'node',
            tier: typeof p.tier === 'string' ? p.tier.trim() : '',
            companyName: name,
            companyNameEn:
              typeof p.companyNameEn === 'string' && p.companyNameEn.trim()
                ? p.companyNameEn.trim()
                : undefined,
          });
          return;
        }
      }
      setParentCompanyRow({ kind: 'legacy', text: t });
    } catch {
      setParentCompanyRow({ kind: 'legacy', text: '-' });
    }
  }, []);

  const parentTierBadgeStyle = useMemo(() => {
    if (parentCompanyRow.kind !== 'node' || !parentCompanyRow.tier) return null;
    const tier = parentCompanyRow.tier;
    const main = mode === 'procurement' ? '#5B3BFA' : '#00B4FF';
    const rgb = mode === 'procurement' ? '91, 59, 250' : '0, 180, 255';
    switch (tier) {
      case 'Tier 0':
        return { bg: `rgba(${rgb}, 0.12)`, text: main, border: `2px solid ${main}` };
      case 'Tier 1':
        return { bg: main, text: '#FFFFFF' };
      case 'Tier 2':
        return { bg: `rgba(${rgb}, 0.55)`, text: '#FFFFFF' };
      case 'Tier 3':
        return { bg: `rgba(${rgb}, 0.28)`, text: main };
      default:
        return { bg: '#E5E7EB', text: '#374151' };
    }
  }, [mode, parentCompanyRow]);

  const parentDisplayTitle = useMemo(() => {
    if (parentCompanyRow.kind === 'node') {
      return [parentCompanyRow.tier, parentCompanyRow.companyName, parentCompanyRow.companyNameEn]
        .filter((x): x is string => Boolean(x))
        .join(' ');
    }
    return parentCompanyRow.text;
  }, [parentCompanyRow]);

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

  const safe = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));
  const toYesNo = (v: boolean) => (v ? '해당' : '미해당');
  const toRmi = (v: boolean) => (v ? '인증됨' : '미인증');

  const facilitiesRows = useMemo(() => {
    if (!company) return [];
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
  }, [company]);

  const productRows = useMemo(() => {
    if (!company) return [];
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
  }, [company]);

  const materialRows = useMemo(() => {
    if (!company) return [];
    const first = company.productionInfo?.[0];
    return [
      {
        productName: safe(company.productInfo?.[0]?.productName),
        inputMaterialName: safe(first?.materialName),
        inputAmount: safe(first?.inputQuantity),
        inputAmountUnit: safe(first?.inputUnit),
        materialEmissionFactor: '-',
        materialEmissionFactorUnit: '-',
        mineralType: '-',
        mineralAmount: '-',
        mineralOrigin: '-',
        mineralEmissionFactor: '-',
        mineralEmissionFactorUnit: '-',
      },
    ];
  }, [company]);

  const energyRows = useMemo(() => {
    if (!company) return [];
    const first = company.productionInfo?.[0];
    return [
      {
        productName: safe(company.productInfo?.[0]?.productName),
        energyType: safe(first?.energyType),
        energyUsage: safe(first?.energyUsage),
        energyUnit: safe(first?.energyUnit),
        emissionFactor: safe(first?.emissionFactor),
        emissionFactorUnit: '-',
      },
    ];
  }, [company]);

  const transportRows = useMemo(() => {
    if (!company) return [];
    const first = company.productionInfo?.[0];
    return [
      {
        productName: safe(company.productInfo?.[0]?.productName),
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
  }, [company]);

  if (!companyKey) {
    return (
      <div className="p-6">
        <p className="text-gray-600">잘못된 경로입니다.</p>
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="p-6">
        <p className="text-gray-600">불러오는 중…</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6">
        <p className="text-gray-600">회사 정보를 찾을 수 없습니다.</p>
        <p className="text-sm text-gray-500 mt-2 max-w-lg">
          데이터 관리 화면에서 해당 행의 「상세보기」를 눌러 이동해 주세요. URL만 북마크하거나 새 탭에 붙여 넣으면
          목록에서 넘긴 정보가 없어 이 메시지가 납니다. 초대 직후에는 협력사명이 DB에 아직 비어 목록에 &quot;-&quot;로
          보일 수 있으며, 그 경우에도 상세에는 「이름 미등록 협력사」로 표시됩니다.
        </p>
      </div>
    );
  }

  const tabs = [
    { id: 0, name: '기업 기본정보' },
    { id: 1, name: '담당자 정보' },
    { id: 2, name: '사업장 정보' },
    { id: 3, name: '생산(납품) 제품 정보' },
    { id: 4, name: '자재 정보' },
    { id: 5, name: '에너지 정보' },
    { id: 6, name: '운송 정보' },
  ];

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
      <div className="px-2 pb-6 pt-0">
        <div className="min-h-[28rem] sm:min-h-[32rem] border border-gray-200 rounded-xl bg-white [scrollbar-gutter:stable] overflow-x-auto [overflow-y:visible]">
          {children}
        </div>
      </div>
    </div>
  );

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
      case 0: // 기업 기본정보
        return (
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
        );
      
      case 1: // 담당자 정보
        return (
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
              {company.contactInfo.map((contact: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className={SUP_DETAIL_TD}>{safe(contact.department)}</td>
                  <td className={SUP_DETAIL_TD}>{safe(contact.position)}</td>
                  <td className={SUP_DETAIL_TD}>{safe(contact.name)}</td>
                  <td className={SUP_DETAIL_TD}>{safe(contact.email)}</td>
                  <td className={SUP_DETAIL_TD}>{safe(contact.phone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      
      case 2: // 사업장 정보
        return (
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
                  <td className={`${SUP_DETAIL_TD} min-w-[220px] whitespace-normal break-all`}>
                    {safe(r.email)}
                  </td>
                  <td className={`${SUP_DETAIL_TD} min-w-[160px] whitespace-normal break-words`}>
                    {safe(r.phone)}
                  </td>
                  <td className={SUP_DETAIL_TD}>{safe(r.rmiSmelter)}</td>
                  <td className={SUP_DETAIL_TD}>{safe(r.feoc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      
      case 3: // 생산(납품) 제품 정보
        return (
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
              {(productRows.length > 0
                ? productRows
                : [{ name: '-', origin: '-', deliveryDate: '-', quantity: '-', unit: '-', standardWeight: '-', wasteQuantity: '-', wasteEmissionFactor: '-', wasteEmissionFactorUnit: '-' }]
              ).map((r, idx) => (
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
        );
      
      case 4: // 자재 정보
        return (
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
        );

      case 5: // 에너지 정보
        return (
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
        );

      case 6: // 운송 정보
        return (
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600 whitespace-nowrap">직상위차사:</span>
                  {parentCompanyRow.kind === 'node' ? (
                    <span
                      className="flex items-center gap-2 min-w-0 font-medium text-gray-900"
                      title={parentDisplayTitle}
                    >
                      {parentCompanyRow.tier && parentTierBadgeStyle ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                          style={{
                            backgroundColor: parentTierBadgeStyle.bg,
                            color: parentTierBadgeStyle.text,
                            ...(parentTierBadgeStyle.border && { border: parentTierBadgeStyle.border }),
                          }}
                        >
                          {parentCompanyRow.tier}
                        </span>
                      ) : null}
                      <span className="flex flex-col min-w-0">
                        <span className="truncate">{parentCompanyRow.companyName}</span>
                        {parentCompanyRow.companyNameEn ? (
                          <span className="text-xs text-gray-500 font-normal truncate">
                            {parentCompanyRow.companyNameEn}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  ) : (
                    <span className="font-medium text-gray-900 truncate" title={parentDisplayTitle}>
                      {parentCompanyRow.text}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600 whitespace-nowrap">납품량:</span>
                  <span className="font-medium text-gray-900 truncate" title={company.deliveryVolume}>
                    {company.deliveryVolume || '-'}
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <TrendingUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600 whitespace-nowrap">PCF 결과:</span>
                  <span className="font-medium text-gray-900 truncate">
                    {company.pcfResult !== null
                      ? `부분 ${company.pcfResult.toLocaleString()} / 최종 ${company.pcfResult.toLocaleString()} kg CO₂e`
                      : '부분 - / 최종 -'}
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
        <div className="p-6 pb-0">
          <div className="flex gap-2 border-b border-gray-200 mb-3 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-6 py-4 border-b-2 transition-all duration-200 whitespace-nowrap"
                style={{
                  borderBottomColor: activeTab === tab.id ? 'var(--aifix-primary)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--aifix-primary)' : 'var(--aifix-gray)',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  backgroundColor: 'white',
                }}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-6 pb-6 pt-0">
          <Shell>{renderTabContent()}</Shell>
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