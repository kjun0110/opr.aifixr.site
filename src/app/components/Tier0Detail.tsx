'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { restoreOprSessionFromCookie } from '@/lib/api/client';
import { getOprAccessToken } from '@/lib/api/sessionAccessToken';
import {
  getOprAnchorCompany,
  getOprTier0RowContext,
  getOprTier0FactoryData,
  downloadOprTier0ExportXlsx,
  postOprTier0ImportPreview,
  putOprTier0FactoryData,
  type OprAnchorCompanyResponse,
  type OprTier0EnergyRowApi,
  type OprTier0FactoryDataSaveRequest,
  type OprTier0ImportPreviewResponse,
  type OprTier0MaterialRowApi,
  type OprTier0ProductionRowApi,
  type OprTier0RowContextResponse,
  type OprTier0WorkplaceContactRowApi,
} from '@/lib/api/dataMgmtOpr';
import { getOprDataViewContacts, type OprDataViewContactRow } from '@/lib/api/iamOpr';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Download,
  Upload,
  Plus,
  Trash2,
  Lock,
  FileText,
  Save,
  ChevronDown,
  X,
  TableProperties,
} from 'lucide-react';
import { EprCo2eFactorPickerModal } from './EprCo2eFactorPickerModal';
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
  /** 부분 PCF(공정/범위 산정) */
  pcfResult: number | null;
  /** 최종 PCF(전체 제품 단위); null이면 미산정 */
  pcfResultFinal: number | null;
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
    /** DB 사업장 행: 종사업장번호 */
    workplaceNo?: string;
    /** DB 사업장 행: 사업장 단위 사업자등록번호 */
    businessRegNo?: string;
  }[];
  
  materialInfo: {
    materialId: string;
    materialName: string;
    unit: string;
    hsCode: string;
    emissionFactorId: string;
    /** 공급망 1차사와 계약된 품목(투입 자재명 제안 목록 필터용; API 연동 시 서버 값으로 대체 가능) */
    tier1Contract?: boolean;
  }[];
  
  facilityInfo: {
    processName: string;
    facilityNumber: string;
    facilityName: string;
    maxOutput: number;
    standardProduction: number;
    installationYear: number;
    energyType: string;
    /** 행별 사업장명(opr_equipments → workplace); 없으면 설비 탭에서 첫 사업장 등으로 폴백 */
    siteName?: string;
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
    pcfResultFinal: null,
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
        tier1Contract: true,
      },
      {
        materialId: 'MAT-002',
        materialName: 'BMS 모듈',
        unit: 'SET',
        hsCode: '8537.10.00',
        emissionFactorId: 'EF-2026-002',
        tier1Contract: true,
      },
      {
        materialId: 'MAT-003',
        materialName: '알루미늄 하우징',
        unit: 'kg',
        hsCode: '7606.12.00',
        emissionFactorId: 'EF-2026-003',
        tier1Contract: false,
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
    pcfResultFinal: null,
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
        tier1Contract: true,
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
    pcfResultFinal: null,
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
        tier1Contract: true,
      },
      {
        materialId: 'MAT-004',
        materialName: 'ESS 제어 시스템',
        unit: 'SET',
        hsCode: '8537.10.00',
        emissionFactorId: 'EF-2026-004',
        tier1Contract: true,
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

/** DataView 카드: `card-{cust_branch_id}-{product_variant_id}-{idx}-{YYYY-MM}-tier0` */
function parseDataViewTier0CardKey(rawKey: string): {
  custBranchId: number;
  productVariantId: number;
  cardIdx: number;
  yearMonth: string;
} | null {
  let decoded = rawKey;
  try {
    decoded = decodeURIComponent(rawKey);
  } catch {
    /* keep rawKey */
  }
  const m = decoded.match(/^card-(\d+)-(\d+)-(\d+)-(\d{4}-\d{2})-tier0$/);
  if (!m) return null;
  return {
    custBranchId: parseInt(m[1], 10),
    productVariantId: parseInt(m[2], 10),
    cardIdx: parseInt(m[3], 10),
    yearMonth: m[4],
  };
}

function tier0NewRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseQtyCell(raw: string | undefined): number {
  if (raw == null || String(raw).trim() === '') return 0;
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

export default function Tier0Detail() {
  const { companyId } = useParams();
  const router = useRouter();
  const { mode } = useMode();
  const [activeTab, setActiveTab] = useState(1);
  const [showUploadModal, setShowUploadModal] = useState(false);
  /** 원청사 엑셀 다운로드: 사업장·담당자·설비·기업기본·사업장담당자·자재·에너지·생산 시트 선택 */
  const [showExcelDownloadModal, setShowExcelDownloadModal] = useState(false);
  const [excelDownloadModalTabIds, setExcelDownloadModalTabIds] = useState<number[]>([
    1, 2, 3, 8, 4, 5, 6, 7,
  ]);
  const [excelExporting, setExcelExporting] = useState(false);
  /** Tier0 엑셀 업로드: 덮어쓰기 | 기존 행 뒤에 추가 */
  const [tier0UploadMergeMode, setTier0UploadMergeMode] = useState<'overwrite' | 'append'>(
    'overwrite',
  );
  const [tier0ImportBusy, setTier0ImportBusy] = useState(false);
  const tier0ExcelFileInputRef = useRef<HTMLInputElement>(null);
  const [eprPickerTarget, setEprPickerTarget] = useState<{
    kind: 'material' | 'energy';
    rowIndex: number;
  } | null>(null);
  const [editableSiteManagers, setEditableSiteManagers] = useState<
    {
      rowId: string;
      siteName: string;
      department: string;
      position: string;
      name: string;
      email: string;
      phone: string;
    }[]
  >([]);
  const [editableEnergyInfo, setEditableEnergyInfo] = useState<
    {
      rowId: string;
      detailProductName: string;
      processName: string;
      energyType: string;
      energyUsage: number;
      energyUnit: string;
      emissionFactor: number;
      emissionFactorUnit: string;
    }[]
  >([]);

  const [editableMaterials, setEditableMaterials] = useState<
    {
      rowId: string;
      detailProductName: string;
      processName: string;
      inputMaterialName: string;
      inputAmount: number;
      inputAmountUnit: string;
      materialEmissionFactor: number;
      materialEmissionFactorUnit: string;
      mineralType: string;
      mineralAmount: number;
      mineralOrigin: string;
      mineralEmissionFactor: number;
      mineralEmissionFactorUnit: string;
    }[]
  >([]);

  const [editableProductionRows, setEditableProductionRows] = useState<any[]>([]);

  const [siteManagerEditCell, setSiteManagerEditCell] = useState<{
    rowIndex: number;
    field: string;
    snapshot: any;
  } | null>(null);

  const [materialEditCell, setMaterialEditCell] = useState<{
    rowIndex: number;
    field: string;
    snapshot: any;
  } | null>(null);

  const [energyEditCell, setEnergyEditCell] = useState<{
    rowIndex: number;
    field: string;
    snapshot: any;
  } | null>(null);

  const [productionEditCell, setProductionEditCell] = useState<{
    rowIndex: number;
    field: string;
    snapshot: any;
  } | null>(null);

  const companyKey = Array.isArray(companyId) ? companyId[0] : companyId;
  const isDataViewTier0Card =
    typeof companyKey === 'string' && parseDataViewTier0CardKey(companyKey) !== null;
  // DataView 새 구조(card-xxx-month-tier0) 지원: mock에 없으면 플레이스홀더(회사명은 DB에서 덮어씀)
  const baseCompany = companyKey
    ? (mockTier0Data[companyKey] ??
        (companyKey.endsWith('-tier0')
          ? {
              ...mockTier0Data['tier0-p1'],
              id: companyKey,
              companyName: '우리회사',
              // 데이터뷰 Tier0: 사업장·설비는 tier0-row-context(DB)만 사용
              siteInfo: isDataViewTier0Card ? [] : mockTier0Data['tier0-p1'].siteInfo,
              facilityInfo: isDataViewTier0Card ? [] : mockTier0Data['tier0-p1'].facilityInfo,
              // 공정명 콤보는 processPerformanceInfo에서도 후보를 모으므로 mock 공정이 섞이지 않게 비움
              processPerformanceInfo: isDataViewTier0Card
                ? []
                : mockTier0Data['tier0-p1'].processPerformanceInfo,
              organizationInfo: {
                ...mockTier0Data['tier0-p1'].organizationInfo,
                companyName: '우리회사',
              },
            }
          : null))
    : null;

  const [anchorOprCompany, setAnchorOprCompany] = useState<OprAnchorCompanyResponse | null>(null);
  const [tier0RowContext, setTier0RowContext] = useState<OprTier0RowContextResponse | null>(null);
  const [tier0RowFetched, setTier0RowFetched] = useState(false);
  const [oprDataViewContacts, setOprDataViewContacts] = useState<OprDataViewContactRow[] | null>(
    null,
  );

  useEffect(() => {
    const key = typeof companyKey === 'string' ? companyKey : String(companyKey ?? '');
    if (!key.endsWith('-tier0')) return;
    let cancelled = false;
    void (async () => {
      try {
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const data = await getOprAnchorCompany();
        if (!cancelled) setAnchorOprCompany(data);
      } catch {
        if (!cancelled) setAnchorOprCompany(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyKey]);

  useEffect(() => {
    const key = typeof companyKey === 'string' ? companyKey : String(companyKey ?? '');
    const parsed = parseDataViewTier0CardKey(key);
    if (!parsed) {
      setTier0RowContext(null);
      setTier0RowFetched(false);
      return;
    }
    setTier0RowFetched(false);
    let cancelled = false;
    void (async () => {
      try {
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const data = await getOprTier0RowContext(parsed.custBranchId, parsed.productVariantId);
        if (!cancelled) setTier0RowContext(data);
      } catch {
        if (!cancelled) setTier0RowContext(null);
      } finally {
        if (!cancelled) setTier0RowFetched(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyKey]);

  useEffect(() => {
    if (!isDataViewTier0Card) {
      setOprDataViewContacts(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const data = await getOprDataViewContacts();
        if (!cancelled) setOprDataViewContacts(data.rows ?? []);
      } catch {
        if (!cancelled) setOprDataViewContacts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDataViewTier0Card]);

  const pickAnchor = (rec: OprAnchorCompanyResponse, k: keyof OprAnchorCompanyResponse, camel: string): string | null | undefined => {
    const raw = rec[k] ?? (rec as unknown as Record<string, unknown>)[camel];
    if (raw == null) return undefined;
    const s = String(raw).trim();
    return s === '' ? undefined : s;
  };

  const company = useMemo(() => {
    if (!baseCompany) return null;
    const key = typeof companyKey === 'string' ? companyKey : String(companyKey ?? '');
    if (!key.endsWith('-tier0')) return baseCompany;

    let merged: Tier0DetailData = { ...baseCompany };

    if (anchorOprCompany) {
      const org = anchorOprCompany;
      const cn =
        pickAnchor(org, 'company_name', 'companyName') ?? merged.companyName;
      merged = {
        ...merged,
        companyName: cn,
        organizationInfo: {
          ...merged.organizationInfo,
          companyName: pickAnchor(org, 'company_name', 'companyName') ?? merged.organizationInfo.companyName,
          businessRegistrationNumber:
            pickAnchor(org, 'business_reg_no', 'businessRegNo') ??
            merged.organizationInfo.businessRegistrationNumber,
          country: pickAnchor(org, 'country', 'country') ?? merged.organizationInfo.country,
          address: pickAnchor(org, 'address', 'address') ?? merged.organizationInfo.address,
          dunsNumber: pickAnchor(org, 'duns_number', 'dunsNumber') ?? merged.organizationInfo.dunsNumber,
          taxId: pickAnchor(org, 'tax_id', 'taxId') ?? merged.organizationInfo.taxId,
          website: pickAnchor(org, 'website_url', 'websiteUrl') ?? merged.organizationInfo.website,
          ceoName: pickAnchor(org, 'rep_name', 'repName') ?? merged.organizationInfo.ceoName,
          ceoEmail: pickAnchor(org, 'rep_email', 'repEmail') ?? merged.organizationInfo.ceoEmail,
          ceoPhone: pickAnchor(org, 'rep_contact', 'repContact') ?? merged.organizationInfo.ceoPhone,
        },
      };
    }

    if (tier0RowContext) {
      merged = {
        ...merged,
        productType: tier0RowContext.product_variant_name || merged.productType,
      };
    }

    const dataViewTier = parseDataViewTier0CardKey(key);
    if (dataViewTier) {
      if (tier0RowFetched) {
        const rows =
          tier0RowContext?.workplaces.map((w, i) => ({
            siteId: `wp-${w.workplace_no ?? i}-${i}`,
            siteName: w.workplace_name,
            country: w.country ?? '',
            address: w.address ?? '',
            managerName: w.rep_name ?? '',
            managerEmail: w.rep_email ?? '',
            managerPhone: w.rep_contact ?? '',
            processName: '',
            renewableEnergy: false,
            environmentalCertification: '',
            workplaceNo: w.workplace_no ?? undefined,
            businessRegNo: w.business_reg_no ?? undefined,
          })) ?? [];
        const equipRows = tier0RowContext?.equipments ?? [];
        merged = {
          ...merged,
          siteInfo: rows,
          facilityInfo: equipRows.map((e) => ({
            siteName: e.workplace_name,
            processName: e.process_name ?? '',
            facilityNumber: e.equipment_no,
            facilityName: e.equipment_name,
            energyType: e.equipment_type ?? '',
            maxOutput: 0,
            standardProduction: 0,
            installationYear: 0,
          })),
        };
      } else {
        merged = { ...merged, siteInfo: [], facilityInfo: [] };
      }
    }

    if (isDataViewTier0Card) {
      if (oprDataViewContacts !== null) {
        merged = {
          ...merged,
          contactInfo: oprDataViewContacts.map((r) => ({
            employeeId: (r.employee_id && String(r.employee_id).trim()) || `OPR-${r.user_id}`,
            department: (r.department_name && String(r.department_name).trim()) || '',
            position: (r.position && String(r.position).trim()) || '',
            name: r.name || '',
            email: (r.email && String(r.email).trim()) || '',
            phone: (r.contact && String(r.contact).trim()) || '',
          })),
        };
      } else {
        merged = { ...merged, contactInfo: [] };
      }
    }

    return merged;
  }, [
    baseCompany,
    companyKey,
    anchorOprCompany,
    tier0RowContext,
    tier0RowFetched,
    isDataViewTier0Card,
    oprDataViewContacts,
  ]);

  if (!company) {
    return (
      <div className="p-6">
        <p className="text-gray-600">회사 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const deliveryUnit = 'EA';
  const decodedCompanyId = (() => {
    const raw = typeof companyKey === 'string' ? companyKey : String(companyKey ?? '');
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();

  const tier0CardParsed = parseDataViewTier0CardKey(decodedCompanyId);

  const parsedHeaderFromCompanyId = (() => {
    if (tier0CardParsed) {
      return {
        yearMonth: tier0CardParsed.yearMonth,
        customer: '',
        branch: '',
        product: '',
        detailProduct: '',
      };
    }
    const monthMatch = decodedCompanyId.match(/(\d{4}-\d{2})-tier0$/);
    const yearMonth = monthMatch?.[1] ?? '';

    const withoutMonth = yearMonth
      ? decodedCompanyId.replace(new RegExp(`-${yearMonth}-tier0$`), '')
      : decodedCompanyId.replace(/-tier0$/, '');

    const cardPrefix = 'card-';
    if (!withoutMonth.startsWith(cardPrefix)) {
      return { yearMonth, customer: '', branch: '', product: '', detailProduct: '' };
    }

    const tokens = withoutMonth.slice(cardPrefix.length).split('-');
    const idxToken = tokens.pop();
    const customer = tokens[0] ?? '';
    const branch = tokens[1] ?? '';
    const product = tokens[2] ?? '';
    const detailProduct = tokens.slice(3).join('-');

    const valid = typeof idxToken === 'string' && idxToken.length > 0;
    return { yearMonth: valid ? yearMonth : '', customer, branch, product, detailProduct };
  })();

  const sessionHeader = (() => {
    try {
      const raw = sessionStorage.getItem('aifix_data_view_filters_v1');
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  })();

  const contractPeriodLabelFromSession =
    String(sessionHeader.selectedContractPeriodLabel ?? '') ||
    (sessionHeader.selectedPeriodStart && sessionHeader.selectedPeriodEnd
      ? `${String(sessionHeader.selectedPeriodStart).replace('-', '.')} ~ ${String(sessionHeader.selectedPeriodEnd).replace('-', '.')}`
      : '');

  const mBomLabel = String(
    tier0RowContext?.bom_code ?? sessionHeader.selectedBomCode ?? '',
  ).trim();

  const formatYmSlash = (ym: string) => (ym ? ym.replace('-', '/') : '');
  const formatYmDot = (ym: string) => (ym ? ym.replace('-', '.') : '');
  const formatDeliveryDate = (ym: string) => (ym ? `${formatYmDot(ym)}.01` : '');
  const formatProjectMonthRange = (start: string, end: string) => {
    const s = (start ?? '').slice(0, 7).replace('-', '.');
    const e = (end ?? '').slice(0, 7).replace('-', '.');
    return s && e ? `${s} - ${e}` : '';
  };

  const customerLabel =
    tier0RowContext?.customer_name ||
    parsedHeaderFromCompanyId.customer ||
    String(sessionHeader.selectedCustomer ?? '');
  const branchLabel =
    tier0RowContext?.branch_name ||
    parsedHeaderFromCompanyId.branch ||
    String(sessionHeader.selectedBranch ?? '');
  const productLabel =
    tier0RowContext?.product_name ||
    parsedHeaderFromCompanyId.product ||
    String(sessionHeader.selectedProduct ?? '');
  const detailProductLabel =
    tier0RowContext?.product_variant_name ||
    parsedHeaderFromCompanyId.detailProduct ||
    String(sessionHeader.selectedDetailProduct ?? '');

  const contractPeriodLabel =
    (tier0RowContext
      ? formatProjectMonthRange(tier0RowContext.project_start, tier0RowContext.project_end)
      : '') ||
    contractPeriodLabelFromSession ||
    '-';
  const yearMonthLabel = parsedHeaderFromCompanyId.yearMonth ? formatYmSlash(parsedHeaderFromCompanyId.yearMonth) : '-';
  const deliveryDateLabel = parsedHeaderFromCompanyId.yearMonth ? formatDeliveryDate(parsedHeaderFromCompanyId.yearMonth) : '-';

  const pcfPartialValue = company.pcfResult;
  const pcfFinalValue = company.pcfResultFinal ?? null;
  const pcfPrimaryKpiValue = pcfFinalValue !== null ? pcfFinalValue : pcfPartialValue;
  
  const tabs = [
    { id: 1, name: '사업장 정보' },
    { id: 2, name: '담당자 정보' },
    { id: 3, name: '설비 정보' },
    { id: 4, name: '사업장 담당자 정보' },
    { id: 5, name: '자재 정보' },
    { id: 6, name: '에너지 정보' },
    { id: 7, name: '생산 정보' },
  ];

  const tier0ExcelSheetTabIds: number[] = [1, 2, 3, 8, 4, 5, 6, 7];
  const tier0ExcelDownloadOptions = [
    ...tabs.filter((t) => [1, 2, 3].includes(t.id)),
    { id: 8, name: '기업 기본정보' },
    ...tabs.filter((t) => [4, 5, 6, 7].includes(t.id)),
  ];

  // 구매 직무: 전체 탭 잠금
  // ESG 직무: 앞 3개(사업장/담당자/설비) 인터페이스 조회 전용 잠금, 탭 4~7만 수정 가능
  const isTabEditable = (tabId: number) => {
    if (mode === 'procurement') return false;
    return tabId >= 4;
  };

  // 전체 공정 활동 데이터 (공정명 컬럼으로 통합 표시)
  const allActivityData = company.processPerformanceInfo;

  // SupplierDetail(협력사 화면)과 동일 테이블 스타일로 통일
  const SUP_DETAIL_TABLE = 'w-full border-collapse border border-gray-300';
  const SUP_DETAIL_TABLE_EDITABLE =
    'w-full min-w-[1200px] table-fixed border-collapse border border-gray-300';
  const SUP_DETAIL_TH =
    'border border-gray-300 bg-[#F8F9FA] py-4 px-4 text-left align-middle text-sm font-semibold text-[var(--aifix-navy)] min-w-0 overflow-hidden whitespace-normal break-words';
  const SUP_DETAIL_TD =
    'border border-gray-300 py-4 px-4 align-top min-w-0 overflow-hidden whitespace-normal break-words';
  /** 아이콘 2개만 두므로 고정 폭 — table-fixed에서 남는 폭이 과하게 쌓이지 않게 함 */
  const SUP_DETAIL_TH_ACTION =
    'border border-gray-300 bg-[#F8F9FA] py-2 px-1.5 w-[5.25rem] min-w-[5.25rem] max-w-[5.25rem] text-center align-middle text-sm font-semibold text-[var(--aifix-navy)] whitespace-nowrap sticky right-0 z-[2] shadow-[-8px_0_16px_-10px_rgba(15,23,42,0.25)]';
  const SUP_DETAIL_TD_ACTION =
    'border border-gray-300 bg-white py-2 px-1.5 w-[5.25rem] min-w-[5.25rem] max-w-[5.25rem] align-top sticky right-0 z-[1] group-hover:bg-gray-50 shadow-[-8px_0_16px_-10px_rgba(15,23,42,0.2)]';
  const SUP_DETAIL_COMBO_TRIGGER =
    'box-border flex h-8 min-h-[32px] w-full min-w-0 max-w-full items-center justify-between gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 text-left text-sm text-[var(--aifix-navy)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--aifix-primary)]';

  const cellShellClass =
    'box-border flex h-8 min-h-[32px] w-full min-w-0 max-w-full items-center rounded-md border border-[#E2E8F0] bg-white px-2 text-sm';

  const safeValue = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? '-' : String(v));
  const detailProductName = company.productType ?? '';
  const siteNameOptions = (company.siteInfo ?? []).map((s) => s.siteName).filter(Boolean);
  const processNameOptions = Array.from(
    new Set(
      [
        ...(company.facilityInfo ?? []).map((f) => String(f.processName ?? '').trim()),
        ...editableMaterials.map((r) => String(r.processName ?? '').trim()),
        ...editableEnergyInfo.map((r) => String(r.processName ?? '').trim()),
        ...editableProductionRows.map((r) => String(r.processName ?? '').trim()),
        ...((company.processPerformanceInfo ?? []).map((p) => String(p.processName ?? '').trim())),
      ].filter(Boolean),
    ),
  );
  const mineralOriginOptions = Array.from(new Set((company.siteInfo ?? []).map((s) => s.country).filter(Boolean)));
  /** 투입 자재명 제안: DB `opr_supply_contracts`(데이터뷰) 또는 mock `tier1Contract`; 검색·신규 추가는 동일 */
  const materialNameTier1ContractOptions = useMemo(() => {
    if (isDataViewTier0Card && tier0RowFetched) {
      return [...(tier0RowContext?.tier1_contract_supplied_item_names ?? [])];
    }
    return Array.from(
      new Set(
        (company.materialInfo ?? [])
          .filter((m) => m.tier1Contract === true)
          .map((m) => String(m.materialName ?? '').trim())
          .filter(Boolean),
      ),
    );
  }, [
    isDataViewTier0Card,
    tier0RowFetched,
    tier0RowContext?.tier1_contract_supplied_item_names,
    company.materialInfo,
  ]);
  const unitBaseOptions = ['kg', 'g', 'ton', 'EA', 'm3', 'L'];
  const mineralTypeBaseOptions = ['리튬', '니켈', '코발트', '망간', '흑연'];
  const energyTypeBaseOptions = ['전기', '스팀', 'LNG', '경유', '수소'];
  const materialEfUnitBaseOptions = ['kgCO2e/kg', 'kgCO2e/ton', 'kgCO2e/L', 'kgCO2e/Nm3'];
  const mineralEfUnitBaseOptions = ['kgCO2e/kg', 'kgCO2e/ton'];
  const energyEfUnitBaseOptions = ['kgCO2e/kWh', 'kgCO2e/MJ', 'kgCO2e/Nm3', 'kgCO2e/L'];

  function SearchableSelectStrict({
    value,
    onChange,
    options,
    placeholder = '검색',
    emptyLabel = '선택',
  }: {
    value: string;
    onChange: (v: string) => void;
    options: readonly string[];
    placeholder?: string;
    emptyLabel?: string;
  }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const rootRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuBox, setMenuBox] = useState<{
      top: number;
      left: number;
      width: number;
      maxH: number;
    } | null>(null);

    const updateMenuBox = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const pad = 8;
      const below = r.bottom + 4;
      const maxH = Math.min(280, Math.max(120, window.innerHeight - below - pad));
      setMenuBox({
        top: below,
        left: r.left,
        width: Math.max(r.width, 220),
        maxH,
      });
    };

    useLayoutEffect(() => {
      if (!open) {
        setMenuBox(null);
        return;
      }
      updateMenuBox();
      const onScrollResize = () => updateMenuBox();
      window.addEventListener('resize', onScrollResize);
      window.addEventListener('scroll', onScrollResize, true);
      return () => {
        window.removeEventListener('resize', onScrollResize);
        window.removeEventListener('scroll', onScrollResize, true);
      };
    }, [open]);

    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        const t = e.target as Node;
        if (rootRef.current?.contains(t)) return;
        if (menuRef.current?.contains(t)) return;
        setOpen(false);
      };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const filtered = useMemo(() => {
      const s = q.trim().toLowerCase();
      if (!s) return [...options];
      return options.filter((o) => o.toLowerCase().includes(s));
    }, [options, q]);

    const menu =
      open &&
      menuBox &&
      typeof document !== 'undefined' &&
      createPortal(
        <div
          ref={menuRef}
          className="fixed z-[300] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          style={{
            top: menuBox.top,
            left: menuBox.left,
            width: menuBox.width,
            maxHeight: menuBox.maxH,
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="box-border w-full border-b border-gray-100 px-2 py-1.5 text-sm outline-none"
          />
          <ul className="max-h-40 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left text-sm text-gray-400 hover:bg-gray-50"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setQ('');
                }}
              >
                {emptyLabel}
              </button>
            </li>
            {filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-sm text-[var(--aifix-navy)] hover:bg-violet-50"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setQ('');
                  }}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      );

    return (
      <div className="relative min-w-0 max-w-full" ref={rootRef}>
        <button
          ref={btnRef}
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            if (open) setQ('');
          }}
          className={SUP_DETAIL_COMBO_TRIGGER}
        >
          <span className="min-w-0 flex-1 truncate">{value.trim() ? value : emptyLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
        {menu}
      </div>
    );
  }

  function SearchableSelectCreatable({
    value,
    onChange,
    baseOptions,
    placeholder = '검색 또는 입력',
    emptyLabel = '선택',
  }: {
    value: string;
    onChange: (v: string) => void;
    baseOptions: readonly string[];
    placeholder?: string;
    emptyLabel?: string;
  }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [extra, setExtra] = useState<string[]>([]);
    const rootRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuBox, setMenuBox] = useState<{
      top: number;
      left: number;
      width: number;
      maxH: number;
    } | null>(null);

    const updateMenuBox = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const pad = 8;
      const below = r.bottom + 4;
      const maxH = Math.min(280, Math.max(120, window.innerHeight - below - pad));
      setMenuBox({
        top: below,
        left: r.left,
        width: Math.max(r.width, 220),
        maxH,
      });
    };

    useLayoutEffect(() => {
      if (!open) {
        setMenuBox(null);
        return;
      }
      updateMenuBox();
      const onScrollResize = () => updateMenuBox();
      window.addEventListener('resize', onScrollResize);
      window.addEventListener('scroll', onScrollResize, true);
      return () => {
        window.removeEventListener('resize', onScrollResize);
        window.removeEventListener('scroll', onScrollResize, true);
      };
    }, [open]);

    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        const t = e.target as Node;
        if (rootRef.current?.contains(t)) return;
        if (menuRef.current?.contains(t)) return;
        setOpen(false);
      };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const allOptions = useMemo(
      () => Array.from(new Set([...baseOptions, ...extra, ...(value ? [value] : [])])),
      [baseOptions, extra, value],
    );
    const filtered = useMemo(() => {
      const t = q.trim().toLowerCase();
      if (!t) return allOptions;
      return allOptions.filter((o) => o.toLowerCase().includes(t));
    }, [allOptions, q]);
    const canAdd = q.trim().length > 0 && !allOptions.some((o) => o.toLowerCase() === q.trim().toLowerCase());

    const menu =
      open &&
      menuBox &&
      typeof document !== 'undefined' &&
      createPortal(
        <div
          ref={menuRef}
          className="fixed z-[300] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          style={{
            top: menuBox.top,
            left: menuBox.left,
            width: menuBox.width,
            maxHeight: menuBox.maxH,
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="box-border w-full border-b border-gray-100 px-2 py-1.5 text-sm outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canAdd) {
                e.preventDefault();
                const v = q.trim();
                setExtra((prev) => Array.from(new Set([...prev, v])));
                onChange(v);
                setQ('');
                setOpen(false);
              }
            }}
          />
          <ul className="max-h-40 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left text-sm text-gray-400 hover:bg-gray-50"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setQ('');
                }}
              >
                {emptyLabel}
              </button>
            </li>
            {filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-sm text-[var(--aifix-navy)] hover:bg-violet-50"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setQ('');
                  }}
                >
                  {opt}
                </button>
              </li>
            ))}
            {canAdd && (
              <li>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-sm text-[var(--aifix-primary)] hover:bg-violet-50"
                  onClick={() => {
                    const v = q.trim();
                    setExtra((prev) => Array.from(new Set([...prev, v])));
                    onChange(v);
                    setOpen(false);
                    setQ('');
                  }}
                >
                  &quot;{q.trim()}&quot; 추가
                </button>
              </li>
            )}
          </ul>
        </div>,
        document.body,
      );

    return (
      <div className="relative min-w-0 max-w-full" ref={rootRef}>
        <button
          ref={btnRef}
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            if (open) setQ('');
          }}
          className={SUP_DETAIL_COMBO_TRIGGER}
        >
          <span className="min-w-0 flex-1 truncate">{value.trim() ? value : emptyLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
        {menu}
      </div>
    );
  }

  /** Tier0 생산량은 제품 납품 단위와 동일하게 EA 고정 */
  const PRODUCTION_QTY_UNIT = 'EA';

  const createEmptyProductionRow = () => ({
    rowId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    detailProductName: company.productType ?? '',
    siteName: '',
    productionAmount: 0,
    productionUnit: PRODUCTION_QTY_UNIT,
    wasteAmount: 0,
    wasteEmissionFactor: 0,
    wasteEmissionFactorUnit: '',
  });

  const createEmptySiteManagerRow = () => ({
    rowId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    siteName: '',
    department: '',
    position: '',
    name: '',
    email: '',
    phone: '',
  });

  const createEmptyMaterialRow = () => ({
    rowId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    detailProductName: company.productType ?? '',
    processName: '',
    inputMaterialName: '',
    inputAmount: 0,
    inputAmountUnit: '',
    materialEmissionFactor: 0,
    materialEmissionFactorUnit: '',
    mineralType: '',
    mineralAmount: 0,
    mineralOrigin: '',
    mineralEmissionFactor: 0,
    mineralEmissionFactorUnit: '',
  });

  const createEmptyEnergyRow = () => ({
    rowId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    detailProductName: company.productType ?? '',
    processName: '',
    energyType: '',
    energyUsage: 0,
    energyUnit: '',
    emissionFactor: 0,
    emissionFactorUnit: '',
  });

  const mapFactoryToSiteManagers = (rows: OprTier0WorkplaceContactRowApi[]) => {
    if (!rows.length) return [createEmptySiteManagerRow()];
    return rows.map((r) => ({
      rowId: tier0NewRowId(),
      siteName: r.site_name ?? '',
      department: r.department ?? '',
      position: [r.position, r.job_title].filter((x) => (x ?? '').trim()).join(' / '),
      name: r.name ?? '',
      email: r.email ?? '',
      phone: r.phone ?? '',
    }));
  };

  const mapFactoryToMaterials = (rows: OprTier0MaterialRowApi[]) => {
    if (!rows.length) return [createEmptyMaterialRow()];
    return rows.map((r) => ({
      rowId: tier0NewRowId(),
      detailProductName: r.detail_product_name ?? company.productType ?? '',
      processName: r.process_name ?? '',
      inputMaterialName: r.input_material_name ?? '',
      inputAmount: parseQtyCell(r.input_amount),
      inputAmountUnit: r.input_amount_unit ?? '',
      materialEmissionFactor: parseQtyCell(r.material_emission_factor),
      materialEmissionFactorUnit: r.material_emission_factor_unit ?? '',
      mineralType: r.mineral_type ?? '',
      mineralAmount: parseQtyCell(r.mineral_amount),
      mineralOrigin: r.mineral_origin ?? '',
      mineralEmissionFactor: parseQtyCell(r.mineral_emission_factor),
      mineralEmissionFactorUnit: r.mineral_emission_factor_unit ?? '',
    }));
  };

  const mapFactoryToEnergy = (rows: OprTier0EnergyRowApi[]) => {
    if (!rows.length) return [createEmptyEnergyRow()];
    return rows.map((r) => ({
      rowId: tier0NewRowId(),
      detailProductName: r.detail_product_name ?? company.productType ?? '',
      processName: r.process_name ?? '',
      energyType: r.energy_type ?? '',
      energyUsage: parseQtyCell(r.energy_usage),
      energyUnit: r.energy_unit ?? '',
      emissionFactor: parseQtyCell(r.energy_emission_factor),
      emissionFactorUnit: r.energy_emission_factor_unit ?? '',
    }));
  };

  const mapFactoryToProduction = (rows: OprTier0ProductionRowApi[]) => {
    if (!rows.length) return [createEmptyProductionRow()];
    return rows.map((r) => ({
      rowId: tier0NewRowId(),
      detailProductName: r.detail_product_name ?? company.productType ?? '',
      siteName: r.site_name ?? '',
      productionAmount: parseQtyCell(r.production_qty),
      productionUnit: PRODUCTION_QTY_UNIT,
      wasteAmount: parseQtyCell(r.waste_qty),
      wasteEmissionFactor: parseQtyCell(r.waste_emission_factor),
      wasteEmissionFactorUnit: r.waste_emission_factor_unit ?? '',
    }));
  };

  const applyTier0ImportPreview = (preview: OprTier0ImportPreviewResponse) => {
    const sm = mapFactoryToSiteManagers(preview.workplace_contacts ?? []);
    const mats = mapFactoryToMaterials(preview.materials ?? []);
    const ene = mapFactoryToEnergy(preview.energy_rows ?? []);
    const prod = mapFactoryToProduction(preview.production_rows ?? []);
    if (tier0UploadMergeMode === 'overwrite') {
      setEditableSiteManagers(sm);
      setEditableMaterials(mats);
      setEditableEnergyInfo(ene);
      setEditableProductionRows(prod);
    } else {
      setEditableSiteManagers((prev) => [...prev, ...sm]);
      setEditableMaterials((prev) => [...prev, ...mats]);
      setEditableEnergyInfo((prev) => [...prev, ...ene]);
      setEditableProductionRows((prev) => [...prev, ...prod]);
    }
    setSiteManagerEditCell(null);
    setMaterialEditCell(null);
    setEnergyEditCell(null);
    setProductionEditCell(null);
  };

  useEffect(() => {
    const key = typeof companyKey === 'string' ? companyKey : String(companyKey ?? '');
    if (parseDataViewTier0CardKey(key)) {
      return;
    }
    setEditableSiteManagers([createEmptySiteManagerRow()]);
    setEditableEnergyInfo([createEmptyEnergyRow()]);
    setEditableMaterials([createEmptyMaterialRow()]);

    const mappedProduction = (company.processPerformanceInfo ?? []).map((p) => ({
      rowId: p.id,
      detailProductName: company.productType ?? '',
      siteName: company.siteInfo?.[0]?.siteName ?? '',
      productionAmount: p.output ?? 0,
      productionUnit: PRODUCTION_QTY_UNIT,
      wasteAmount: p.waste ?? 0,
      wasteEmissionFactor: p.emissionFactor ?? 0,
      wasteEmissionFactorUnit: '',
    }));
    const productionRows =
      mappedProduction.length > 0 ? mappedProduction : [createEmptyProductionRow()];
    setEditableProductionRows(
      productionRows.map((r) => ({ ...r, productionUnit: PRODUCTION_QTY_UNIT })),
    );
    setProductionEditCell(null);
    setSiteManagerEditCell(null);
    setMaterialEditCell(null);
    setEnergyEditCell(null);
  }, [companyKey]);

  useEffect(() => {
    const key = typeof companyKey === 'string' ? companyKey : String(companyKey ?? '');
    const parsed = parseDataViewTier0CardKey(key);
    if (!parsed) return;
    let cancelled = false;
    void (async () => {
      try {
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const ym = parsed.yearMonth.split('-');
        const reportingYear = parseInt(ym[0] ?? '', 10);
        const reportingMonth = parseInt(ym[1] ?? '', 10);
        if (!reportingYear || !reportingMonth) return;
        const data = await getOprTier0FactoryData({
          custBranchId: parsed.custBranchId,
          productVariantId: parsed.productVariantId,
          reportingYear,
          reportingMonth,
        });
        if (cancelled) return;
        setEditableSiteManagers(mapFactoryToSiteManagers(data.workplace_contacts ?? []));
        setEditableMaterials(mapFactoryToMaterials(data.materials ?? []));
        setEditableEnergyInfo(mapFactoryToEnergy(data.energy_rows ?? []));
        setEditableProductionRows(mapFactoryToProduction(data.production_rows ?? []));
        setProductionEditCell(null);
        setSiteManagerEditCell(null);
        setMaterialEditCell(null);
        setEnergyEditCell(null);
      } catch {
        if (!cancelled) {
          setEditableSiteManagers([createEmptySiteManagerRow()]);
          setEditableMaterials([createEmptyMaterialRow()]);
          setEditableEnergyInfo([createEmptyEnergyRow()]);
          setEditableProductionRows([createEmptyProductionRow()]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyKey]);

  const openExcelDownloadModal = () => {
    setExcelDownloadModalTabIds([...tier0ExcelSheetTabIds]);
    setShowExcelDownloadModal(true);
  };

  const handleExcelDownloadConfirm = async () => {
    if (excelDownloadModalTabIds.length === 0) {
      toast.error('엑셀 다운로드에 포함할 항목을 1개 이상 선택해주세요.');
      return;
    }
    if (!tier0CardParsed) {
      toast.error(
        '데이터 관리 조회 화면에서 Tier0 카드를 연 경우에만 DB 기준 엑셀을 받을 수 있습니다.',
      );
      return;
    }
    const ymParts = tier0CardParsed.yearMonth.split('-');
    const reportingYear = parseInt(ymParts[0] ?? '', 10);
    const reportingMonth = parseInt(ymParts[1] ?? '', 10);
    if (!reportingYear || !reportingMonth) {
      toast.error('조회 월(YYYY-MM)을 확인할 수 없습니다.');
      return;
    }
    setExcelExporting(true);
    try {
      if (typeof window !== 'undefined' && !getOprAccessToken()) {
        await restoreOprSessionFromCookie();
      }
      const blob = await downloadOprTier0ExportXlsx({
        custBranchId: tier0CardParsed.custBranchId,
        productVariantId: tier0CardParsed.productVariantId,
        reportingYear,
        reportingMonth,
        sheetTabIds: excelDownloadModalTabIds,
      });
      const yyyymm = `${reportingYear}${String(reportingMonth).padStart(2, '0')}`;
      const sanitizeExcelNamePart = (raw: string) =>
        String(raw ?? '')
          .trim()
          .replace(/[\\/:*?"<>|]/g, '_')
          .replace(/\s+/g, ' ');
      const nameTail = [customerLabel, productLabel, detailProductLabel]
        .map(sanitizeExcelNamePart)
        .filter((p) => p.length > 0 && p !== '-');
      let base =
        nameTail.length > 0
          ? `${yyyymm} ${nameTail.join(' ')}`
          : `tier0_pv${tier0CardParsed.productVariantId}_${yyyymm}`;
      base = base.trimEnd().replace(/[. ]+$/, '');
      if (base.length > 180) base = `${base.slice(0, 177)}...`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}.xlsx`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setShowExcelDownloadModal(false);
      toast.success('엑셀 파일을 저장했습니다.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '다운로드에 실패했습니다.');
    } finally {
      setExcelExporting(false);
    }
  };

  const handleExcelUpload = () => {
    setShowUploadModal(true);
  };

  const handleAddRow = () => {
    if (!isTabEditable(activeTab)) {
      toast.info('수정 권한이 없습니다.');
      return;
    }

    if (activeTab === 4) {
      setEditableSiteManagers((prev) => [...prev, createEmptySiteManagerRow()]);
      setSiteManagerEditCell(null);
    } else if (activeTab === 5) {
      setEditableMaterials((prev) => [...prev, createEmptyMaterialRow()]);
      setMaterialEditCell(null);
    } else if (activeTab === 6) {
      setEditableEnergyInfo((prev) => [...prev, createEmptyEnergyRow()]);
      setEnergyEditCell(null);
    } else if (activeTab === 7) {
      setEditableProductionRows((prev) => [...prev, createEmptyProductionRow()]);
      setProductionEditCell(null);
    }
    toast.info('새 행을 추가합니다');
  };

  const buildTier0FactorySaveBody = (): OprTier0FactoryDataSaveRequest => ({
    workplace_contacts: editableSiteManagers.map((r) => ({
      site_name: r.siteName,
      department: r.department,
      position: r.position,
      job_title: '',
      name: r.name,
      email: r.email,
      phone: r.phone,
    })),
    materials: editableMaterials.map((r) => ({
      detail_product_name: r.detailProductName,
      process_name: r.processName,
      input_material_name: r.inputMaterialName,
      input_amount: String(r.inputAmount ?? ''),
      input_amount_unit: r.inputAmountUnit,
      material_emission_factor: String(r.materialEmissionFactor ?? ''),
      material_emission_factor_unit: r.materialEmissionFactorUnit,
      mineral_type: r.mineralType,
      mineral_amount: String(r.mineralAmount ?? ''),
      mineral_origin: r.mineralOrigin,
      mineral_emission_factor: String(r.mineralEmissionFactor ?? ''),
      mineral_emission_factor_unit: r.mineralEmissionFactorUnit,
    })),
    energy_rows: editableEnergyInfo.map((r) => ({
      detail_product_name: r.detailProductName,
      process_name: r.processName,
      energy_type: r.energyType,
      energy_usage: String(r.energyUsage ?? ''),
      energy_unit: r.energyUnit,
      energy_emission_factor: String(r.emissionFactor ?? ''),
      energy_emission_factor_unit: r.emissionFactorUnit,
    })),
    production_rows: editableProductionRows.map((r) => ({
      detail_product_name: r.detailProductName ?? company.productType,
      site_name: r.siteName,
      production_qty: String(r.productionAmount ?? ''),
      production_qty_unit: PRODUCTION_QTY_UNIT,
      waste_qty: String(r.wasteAmount ?? ''),
      waste_emission_factor: String(r.wasteEmissionFactor ?? ''),
      waste_emission_factor_unit: r.wasteEmissionFactorUnit,
    })),
  });

  const handleSave = async () => {
    if (tier0CardParsed) {
      if (mode !== 'pcf') {
        toast.info('구매 직무에서는 저장할 수 없습니다. PCF 관점으로 전환하세요.');
        return;
      }
      try {
        const ymParts = tier0CardParsed.yearMonth.split('-');
        const reportingYear = parseInt(ymParts[0] ?? '', 10);
        const reportingMonth = parseInt(ymParts[1] ?? '', 10);
        if (!reportingYear || !reportingMonth) {
          toast.error('조회 월(YYYY-MM)을 확인할 수 없습니다.');
          return;
        }
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const res = await putOprTier0FactoryData({
          custBranchId: tier0CardParsed.custBranchId,
          productVariantId: tier0CardParsed.productVariantId,
          reportingYear,
          reportingMonth,
          team: 'pcf',
          body: buildTier0FactorySaveBody(),
        });
        if (res.warnings?.length) {
          toast.message(res.warnings.join('\n'), { duration: 8000 });
        }
        toast.success(res.message ?? '저장되었습니다.');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '저장에 실패했습니다.');
      }
      return;
    }
    toast.success('저장되었습니다');
  };

  const handleTier0ExcelUploadConfirm = async () => {
    const input = tier0ExcelFileInputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      toast.error('Excel 파일을 선택하세요.');
      return;
    }
    setTier0ImportBusy(true);
    try {
      if (typeof window !== 'undefined' && !getOprAccessToken()) {
        await restoreOprSessionFromCookie();
      }
      const preview = await postOprTier0ImportPreview(file);
      if (preview.warnings?.length) {
        toast.message(preview.warnings.join('\n'), { duration: 6000 });
      }
      applyTier0ImportPreview(preview);
      toast.success('엑셀 내용을 화면에 반영했습니다. 확인 후 수정 완료를 누르면 DB에 저장됩니다.');
      setShowUploadModal(false);
      if (input) input.value = '';
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '엑셀 미리보기에 실패했습니다.');
    } finally {
      setTier0ImportBusy(false);
    }
  };

  const handleInsertProductionRowAfter = (rowIndex: number) => {
    setEditableProductionRows((prev) => {
      const next = [...prev];
      next.splice(rowIndex + 1, 0, createEmptyProductionRow());
      return next;
    });
    setProductionEditCell(null);
  };

  const handleRemoveProductionRowAt = (rowIndex: number) => {
    setEditableProductionRows((prev) => {
      if (prev.length <= 1) return [createEmptyProductionRow()];
      return prev.filter((_, i) => i !== rowIndex);
    });
    setProductionEditCell(null);
  };

  const handleInsertSiteManagerRowAfter = (rowIndex: number) => {
    setEditableSiteManagers((prev) => {
      const next = [...prev];
      next.splice(rowIndex + 1, 0, createEmptySiteManagerRow());
      return next;
    });
    setSiteManagerEditCell(null);
  };

  const handleRemoveSiteManagerRowAt = (rowIndex: number) => {
    setEditableSiteManagers((prev) => {
      if (prev.length <= 1) return [createEmptySiteManagerRow()];
      return prev.filter((_, i) => i !== rowIndex);
    });
    setSiteManagerEditCell(null);
  };

  const handleInsertMaterialRowAfter = (rowIndex: number) => {
    setEditableMaterials((prev) => {
      const next = [...prev];
      next.splice(rowIndex + 1, 0, createEmptyMaterialRow());
      return next;
    });
    setMaterialEditCell(null);
  };

  const handleRemoveMaterialRowAt = (rowIndex: number) => {
    setEditableMaterials((prev) => {
      if (prev.length <= 1) return [createEmptyMaterialRow()];
      return prev.filter((_, i) => i !== rowIndex);
    });
    setMaterialEditCell(null);
  };

  const handleInsertEnergyRowAfter = (rowIndex: number) => {
    setEditableEnergyInfo((prev) => {
      const next = [...prev];
      next.splice(rowIndex + 1, 0, createEmptyEnergyRow());
      return next;
    });
    setEnergyEditCell(null);
  };

  const handleRemoveEnergyRowAt = (rowIndex: number) => {
    setEditableEnergyInfo((prev) => {
      if (prev.length <= 1) return [createEmptyEnergyRow()];
      return prev.filter((_, i) => i !== rowIndex);
    });
    setEnergyEditCell(null);
  };

  const formatProductionValue = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : String(value);
    return String(value);
  };

  const renderProductionValueContent = (rowIndex: number, field: string, value: any) => {
    if (!isTabEditable(7)) return formatProductionValue(value);

    const editing =
      productionEditCell?.rowIndex === rowIndex && productionEditCell?.field === field;

    if (!editing) {
      return (
        <div className={cellShellClass} style={{ color: 'var(--aifix-navy)' }}>
          <span
            className="min-w-0 flex-1 cursor-default truncate"
            onDoubleClick={() =>
              setProductionEditCell({
                rowIndex,
                field,
                snapshot: value,
              })
            }
            title="더블클릭하여 수정"
          >
            {formatProductionValue(value) || '\u00a0'}
          </span>
        </div>
      );
    }

    const snapshot = productionEditCell?.snapshot;

    return (
      <div className={`${cellShellClass} outline-none ring-2 ring-inset ring-[var(--aifix-primary)]`}>
        <input
          autoFocus
          value={String(value ?? '')}
          onChange={(e) => {
            const raw = e.target.value;
            const nextValue = typeof value === 'number' ? Number(raw || 0) : raw;
            setEditableProductionRows((prev) =>
              prev.map((r, i) => (i === rowIndex ? { ...r, [field]: nextValue } : r)),
            );
          }}
          onBlur={() => setProductionEditCell(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditableProductionRows((prev) =>
                prev.map((r, i) =>
                  i === rowIndex ? { ...r, [field]: snapshot } : r,
                ),
              );
              setProductionEditCell(null);
              return;
            }
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="m-0 h-full min-h-0 w-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm text-[var(--aifix-navy)] outline-none"
        />
      </div>
    );
  };

  const renderSiteManagerValueContent = (
    rowIndex: number,
    field: 'department' | 'position' | 'name' | 'email' | 'phone',
    value: any,
  ) => {
    if (!isTabEditable(4)) return safeValue(value);

    const editing = siteManagerEditCell?.rowIndex === rowIndex && siteManagerEditCell?.field === field;

    if (!editing) {
      return (
        <div className={cellShellClass} style={{ color: 'var(--aifix-navy)' }}>
          <span
            className="min-w-0 flex-1 cursor-default truncate"
            onDoubleClick={() => setSiteManagerEditCell({ rowIndex, field, snapshot: value })}
            title="더블클릭하여 수정"
          >
            {String(value ?? '') || '\u00a0'}
          </span>
        </div>
      );
    }

    const snapshot = siteManagerEditCell?.snapshot;
    return (
      <div className={`${cellShellClass} outline-none ring-2 ring-inset ring-[var(--aifix-primary)]`}>
        <input
          autoFocus
          value={String(value ?? '')}
          onChange={(e) => {
            const next = e.target.value;
            setEditableSiteManagers((prev) =>
              prev.map((r, i) => (i === rowIndex ? { ...r, [field]: next } : r)),
            );
          }}
          onBlur={() => setSiteManagerEditCell(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditableSiteManagers((prev) =>
                prev.map((r, i) => (i === rowIndex ? { ...r, [field]: snapshot } : r)),
              );
              setSiteManagerEditCell(null);
              return;
            }
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="m-0 h-full min-h-0 w-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm text-[var(--aifix-navy)] outline-none"
        />
      </div>
    );
  };

  const renderMaterialValueContent = (
    rowIndex: number,
    field:
      | 'processName'
      | 'inputMaterialName'
      | 'inputAmount'
      | 'inputAmountUnit'
      | 'materialEmissionFactor'
      | 'materialEmissionFactorUnit'
      | 'mineralType'
      | 'mineralAmount'
      | 'mineralOrigin'
      | 'mineralEmissionFactor'
      | 'mineralEmissionFactorUnit',
    value: any,
  ) => {
    if (!isTabEditable(5)) return safeValue(value);

    const editing = materialEditCell?.rowIndex === rowIndex && materialEditCell?.field === field;

    if (!editing) {
      return (
        <div className={cellShellClass} style={{ color: 'var(--aifix-navy)' }}>
          <span
            className="min-w-0 flex-1 cursor-default truncate"
            onDoubleClick={() => setMaterialEditCell({ rowIndex, field, snapshot: value })}
            title="더블클릭하여 수정"
          >
            {String(value ?? '') || '\u00a0'}
          </span>
        </div>
      );
    }

    const snapshot = materialEditCell?.snapshot;
    return (
      <div className={`${cellShellClass} outline-none ring-2 ring-inset ring-[var(--aifix-primary)]`}>
        <input
          autoFocus
          value={String(value ?? '')}
          onChange={(e) => {
            const next = e.target.value;
            setEditableMaterials((prev) =>
              prev.map((r, i) => (i === rowIndex ? { ...r, [field]: next } : r)),
            );
          }}
          onBlur={() => setMaterialEditCell(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditableMaterials((prev) =>
                prev.map((r, i) => (i === rowIndex ? { ...r, [field]: snapshot } : r)),
              );
              setMaterialEditCell(null);
              return;
            }
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="m-0 h-full min-h-0 w-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm text-[var(--aifix-navy)] outline-none"
        />
      </div>
    );
  };

  const renderEnergyValueContent = (
    rowIndex: number,
    field:
      | 'processName'
      | 'energyType'
      | 'energyUsage'
      | 'energyUnit'
      | 'emissionFactor'
      | 'emissionFactorUnit',
    value: any,
  ) => {
    if (!isTabEditable(6)) return safeValue(value);

    const editing = energyEditCell?.rowIndex === rowIndex && energyEditCell?.field === field;

    if (!editing) {
      return (
        <div className={cellShellClass} style={{ color: 'var(--aifix-navy)' }}>
          <span
            className="min-w-0 flex-1 cursor-default truncate"
            onDoubleClick={() => setEnergyEditCell({ rowIndex, field, snapshot: value })}
            title="더블클릭하여 수정"
          >
            {String(value ?? '') || '\u00a0'}
          </span>
        </div>
      );
    }

    const snapshot = energyEditCell?.snapshot;
    return (
      <div className={`${cellShellClass} outline-none ring-2 ring-inset ring-[var(--aifix-primary)]`}>
        <input
          autoFocus
          value={String(value ?? '')}
          onChange={(e) => {
            const raw = e.target.value;
            const nextValue =
              field === 'energyUsage' || field === 'emissionFactor' ? Number(raw || 0) : raw;
            setEditableEnergyInfo((prev) =>
              prev.map((r, i) => (i === rowIndex ? { ...r, [field]: nextValue } : r)),
            );
          }}
          onBlur={() => setEnergyEditCell(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditableEnergyInfo((prev) =>
                prev.map((r, i) => (i === rowIndex ? { ...r, [field]: snapshot } : r)),
              );
              setEnergyEditCell(null);
              return;
            }
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="m-0 h-full min-h-0 w-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm text-[var(--aifix-navy)] outline-none"
        />
      </div>
    );
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
      case 0: // 납품 정보
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
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">납품 제품</td>
                    <td className="px-4 py-3 text-sm border">{company.productType}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">납품량</td>
                    <td className="px-4 py-3 text-sm border">{company.deliveryVolume.toLocaleString()} EA</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">PCF 결과</td>
                    <td className="px-4 py-3 text-sm border">
                      {company.pcfResult !== null
                        ? `부분산정 ${company.pcfResult.toLocaleString()} kg CO₂e`
                        : '부분산정 N/A'}
                      {pcfFinalValue !== null
                        ? ` · 최종 ${pcfFinalValue.toLocaleString()} kg CO₂e`
                        : ' · 최종 미산정 (하위차 데이터 부족)'}
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm border font-medium text-gray-600">상태</td>
                    <td className="px-4 py-3 text-sm border">{company.status}</td>
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
              <table className={SUP_DETAIL_TABLE_EDITABLE}>
                <thead>
                  <tr>
                    <th className={SUP_DETAIL_TH}>사업장명</th>
                    <th className={SUP_DETAIL_TH}>사업자등록번호</th>
                    <th className={SUP_DETAIL_TH}>종사업장번호</th>
                    <th className={SUP_DETAIL_TH}>국가 소재지</th>
                    <th className={SUP_DETAIL_TH}>상세주소</th>
                    <th className={SUP_DETAIL_TH}>대표자명</th>
                    <th className={SUP_DETAIL_TH}>대표 이메일</th>
                    <th className={SUP_DETAIL_TH}>대표 연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {isDataViewTier0Card && !tier0RowFetched ? (
                    <tr>
                      <td colSpan={8} className={`${SUP_DETAIL_TD} text-center text-gray-500`}>
                        원청 사업장 정보를 불러오는 중입니다.
                      </td>
                    </tr>
                  ) : isDataViewTier0Card && tier0RowFetched && company.siteInfo.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={`${SUP_DETAIL_TD} text-center text-gray-500`}>
                        등록된 원청 사업장이 없습니다. 시드·마스터(opr_workplaces, 본법인×제품)를 확인하세요.
                      </td>
                    </tr>
                  ) : (
                    company.siteInfo.map((site) => (
                      <tr key={site.siteId} className="hover:bg-gray-50 transition-colors">
                        <td className={SUP_DETAIL_TD}>{site.siteName}</td>
                        <td className={SUP_DETAIL_TD}>
                          {safeValue(
                            site.businessRegNo ?? company.organizationInfo.businessRegistrationNumber,
                          )}
                        </td>
                        <td className={SUP_DETAIL_TD}>{safeValue(site.workplaceNo ?? site.siteId)}</td>
                        <td className={SUP_DETAIL_TD}>{site.country}</td>
                        <td className={SUP_DETAIL_TD}>{site.address}</td>
                        <td className={SUP_DETAIL_TD}>{site.managerName}</td>
                        <td className={SUP_DETAIL_TD}>{site.managerEmail}</td>
                        <td className={SUP_DETAIL_TD}>{site.managerPhone}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 5: // 자재 정보
        return (
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {isTabEditable(5) ? (
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
              {isTabEditable(5) && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExcelUpload}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    파일 업로드
                  </button>
                  <button
                    onClick={handleAddRow}
                    className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-2 transition-all cursor-pointer"
                    style={{
                      background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    + 행추가
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    수정 완료
                  </button>
                </div>
              )}
            </div>

            <div className="min-h-[28rem] sm:min-h-[32rem] overflow-x-auto overflow-y-visible border border-gray-200 rounded-xl bg-white [scrollbar-gutter:stable]">
              <table className={SUP_DETAIL_TABLE_EDITABLE}>
                <thead>
                  <tr>
                    <th className={SUP_DETAIL_TH}>세부제품명</th>
                    <th className={SUP_DETAIL_TH}>공정명</th>
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
                    {isTabEditable(5) && <th className={SUP_DETAIL_TH_ACTION}>작업</th>}
                  </tr>
                </thead>
                <tbody>
                  {editableMaterials.map((row, idx) => (
                    <tr key={row.rowId ?? idx} className="group hover:bg-gray-50 transition-colors">
                      <td className={SUP_DETAIL_TD}>{detailProductName}</td>
                      <td className={SUP_DETAIL_TD}>
                        {isTabEditable(5) ? (
                          <SearchableSelectCreatable
                            value={row.processName}
                            onChange={(v) =>
                              setEditableMaterials((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, processName: v } : r)),
                              )
                            }
                            baseOptions={processNameOptions}
                            placeholder="공정명 검색·추가"
                          />
                        ) : safeValue(row.processName)}
                      </td>
                      <td className={SUP_DETAIL_TD}>
                        {isTabEditable(5) ? (
                          <SearchableSelectCreatable
                            value={row.inputMaterialName}
                            onChange={(v) =>
                              setEditableMaterials((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, inputMaterialName: v } : r)),
                              )
                            }
                            baseOptions={materialNameTier1ContractOptions}
                            placeholder="투입 자재명 검색·추가"
                          />
                        ) : safeValue(row.inputMaterialName)}
                      </td>
                      <td className={SUP_DETAIL_TD}>{renderMaterialValueContent(idx, 'inputAmount', row.inputAmount)}</td>
                      <td className={SUP_DETAIL_TD}>
                        {isTabEditable(5) ? (
                          <SearchableSelectCreatable
                            value={row.inputAmountUnit}
                            onChange={(v) =>
                              setEditableMaterials((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, inputAmountUnit: v } : r)),
                              )
                            }
                            baseOptions={unitBaseOptions}
                            placeholder="투입량 단위 검색·추가"
                          />
                        ) : safeValue(row.inputAmountUnit)}
                      </td>
                      <td className={SUP_DETAIL_TD}>
                        <div className="flex min-w-0 items-center gap-1">
                          <div className="min-w-0 flex-1">
                            {renderMaterialValueContent(
                              idx,
                              'materialEmissionFactor',
                              row.materialEmissionFactor,
                            )}
                          </div>
                          {isTabEditable(5) && (
                            <button
                              type="button"
                              title="환경성적표지 참조 계수에서 선택"
                              className="shrink-0 rounded-md p-1 text-[#5B3BFA] hover:bg-violet-50"
                              onClick={() => setEprPickerTarget({ kind: 'material', rowIndex: idx })}
                            >
                              <TableProperties className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className={SUP_DETAIL_TD}>
                        {isTabEditable(5) ? (
                          <SearchableSelectCreatable
                            value={row.materialEmissionFactorUnit}
                            onChange={(v) =>
                              setEditableMaterials((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, materialEmissionFactorUnit: v } : r)),
                              )
                            }
                            baseOptions={materialEfUnitBaseOptions}
                            placeholder="자재 배출계수 단위 검색·추가"
                          />
                        ) : safeValue(row.materialEmissionFactorUnit)}
                      </td>
                      <td className={SUP_DETAIL_TD}>
                        {isTabEditable(5) ? (
                          <SearchableSelectCreatable
                            value={row.mineralType}
                            onChange={(v) =>
                              setEditableMaterials((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, mineralType: v } : r)),
                              )
                            }
                            baseOptions={mineralTypeBaseOptions}
                            placeholder="투입 광물 종류 검색·추가"
                          />
                        ) : safeValue(row.mineralType)}
                      </td>
                      <td className={SUP_DETAIL_TD}>{renderMaterialValueContent(idx, 'mineralAmount', row.mineralAmount)}</td>
                      <td className={SUP_DETAIL_TD}>
                        {isTabEditable(5) ? (
                          <SearchableSelectStrict
                            value={row.mineralOrigin}
                            onChange={(v) =>
                              setEditableMaterials((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, mineralOrigin: v } : r)),
                              )
                            }
                            options={mineralOriginOptions}
                            placeholder="광물 원산지 검색"
                          />
                        ) : safeValue(row.mineralOrigin)}
                      </td>
                      <td className={SUP_DETAIL_TD}>{renderMaterialValueContent(idx, 'mineralEmissionFactor', row.mineralEmissionFactor)}</td>
                      <td className={SUP_DETAIL_TD}>
                        {isTabEditable(5) ? (
                          <SearchableSelectCreatable
                            value={row.mineralEmissionFactorUnit}
                            onChange={(v) =>
                              setEditableMaterials((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, mineralEmissionFactorUnit: v } : r)),
                              )
                            }
                            baseOptions={mineralEfUnitBaseOptions}
                            placeholder="광물 배출계수 단위 검색·추가"
                          />
                        ) : safeValue(row.mineralEmissionFactorUnit)}
                      </td>
                      {isTabEditable(5) && (
                        <td className={SUP_DETAIL_TD_ACTION}>
                          <div className="flex h-8 items-center justify-center gap-0">
                            <button
                              type="button"
                              onClick={() => handleInsertMaterialRowAfter(idx)}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md p-0 text-gray-500 hover:bg-gray-100 transition-colors"
                              title="이 행 아래에 새 행 추가"
                              aria-label="이 행 아래에 새 행 추가"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterialRowAt(idx)}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md p-0 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="이 행 삭제"
                              aria-label="이 행 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 3: // 설비 정보 — 인터페이스 연동(ESG에서 사업장·담당자와 동일 잠금)
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Lock className="w-4 h-4" />
                <span>🔗 Source : ERP / MES Interface | Data Sync : 자동 연동</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className={SUP_DETAIL_TABLE_EDITABLE}>
                <thead>
                  <tr>
                    <th className={SUP_DETAIL_TH}>사업장명</th>
                    <th className={SUP_DETAIL_TH}>설비유형</th>
                    <th className={SUP_DETAIL_TH}>공정명</th>
                    <th className={SUP_DETAIL_TH}>설비명</th>
                    <th className={SUP_DETAIL_TH}>설비 고유 번호</th>
                  </tr>
                </thead>
                <tbody>
                  {isDataViewTier0Card && !tier0RowFetched ? (
                    <tr>
                      <td colSpan={5} className={`${SUP_DETAIL_TD} text-center text-gray-500`}>
                        설비 정보를 불러오는 중입니다.
                      </td>
                    </tr>
                  ) : isDataViewTier0Card && tier0RowFetched && company.facilityInfo.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={`${SUP_DETAIL_TD} text-center text-gray-500`}>
                        등록된 설비가 없습니다. run_seed_opr_equipments_product_a_dev.py 로
                        opr_equipments 를 넣었는지 확인하세요.
                      </td>
                    </tr>
                  ) : (
                    company.facilityInfo.map((facility, idx) => (
                      <tr
                        key={`${facility.facilityNumber}-${idx}`}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className={SUP_DETAIL_TD}>
                          {safeValue(facility.siteName ?? company.siteInfo?.[0]?.siteName)}
                        </td>
                        <td className={SUP_DETAIL_TD}>{facility.energyType ?? '-'}</td>
                        <td className={SUP_DETAIL_TD}>{facility.processName}</td>
                        <td className={SUP_DETAIL_TD}>{facility.facilityName}</td>
                        <td className={SUP_DETAIL_TD}>{facility.facilityNumber}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 4: // 사업장 담당자 정보 (Editable for ESG)
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
                    onClick={handleExcelUpload}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    파일 업로드
                  </button>
                  <button
                    onClick={handleAddRow}
                    className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-2 transition-all cursor-pointer"
                    style={{
                      background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    + 행추가
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    수정 완료
                  </button>
                </div>
              )}
            </div>

            <div className="min-h-[28rem] sm:min-h-[32rem] overflow-x-auto overflow-y-visible border border-gray-200 rounded-xl bg-white [scrollbar-gutter:stable]">
              <table className={SUP_DETAIL_TABLE_EDITABLE}>
                <thead>
                  <tr>
                    <th className={SUP_DETAIL_TH}>사업장명(원천시스템에서 인터페이스)</th>
                    <th className={SUP_DETAIL_TH}>부서명</th>
                    <th className={SUP_DETAIL_TH}>직급 및 직책</th>
                    <th className={SUP_DETAIL_TH}>이름</th>
                    <th className={SUP_DETAIL_TH}>이메일</th>
                    <th className={SUP_DETAIL_TH}>연락처</th>
                    {isTabEditable(4) && <th className={SUP_DETAIL_TH_ACTION}>작업</th>}
                  </tr>
                </thead>
                <tbody>
                  {editableSiteManagers.map((row, idx) => (
                    <tr key={row.rowId ?? idx} className="group hover:bg-gray-50 transition-colors">
                      <td className={SUP_DETAIL_TD}>
                        {isTabEditable(4) ? (
                          <SearchableSelectStrict
                            value={row.siteName}
                            onChange={(v) =>
                              setEditableSiteManagers((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, siteName: v } : r)),
                              )
                            }
                            options={siteNameOptions}
                            placeholder="사업장명 검색"
                          />
                        ) : safeValue(row.siteName)}
                      </td>
                      <td className={SUP_DETAIL_TD}>{renderSiteManagerValueContent(idx, 'department', row.department)}</td>
                      <td className={SUP_DETAIL_TD}>{renderSiteManagerValueContent(idx, 'position', row.position)}</td>
                      <td className={SUP_DETAIL_TD}>{renderSiteManagerValueContent(idx, 'name', row.name)}</td>
                      <td className={`${SUP_DETAIL_TD} min-w-[240px] whitespace-normal break-all`}>{renderSiteManagerValueContent(idx, 'email', row.email)}</td>
                      <td className={`${SUP_DETAIL_TD} min-w-[180px] whitespace-normal break-words`}>{renderSiteManagerValueContent(idx, 'phone', row.phone)}</td>
                      {isTabEditable(4) && (
                        <td className={SUP_DETAIL_TD_ACTION}>
                          <div className="flex h-8 items-center justify-center gap-0">
                            <button
                              type="button"
                              onClick={() => handleInsertSiteManagerRowAfter(idx)}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md p-0 text-gray-500 hover:bg-gray-100 transition-colors"
                              title="이 행 아래에 새 행 추가"
                              aria-label="이 행 아래에 새 행 추가"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSiteManagerRowAt(idx)}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md p-0 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="이 행 삭제"
                              aria-label="이 행 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 6: // 에너지 정보 (Editable for ESG)
        return (
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {isTabEditable(6) ? (
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

              {isTabEditable(6) && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExcelUpload}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    파일 업로드
                  </button>
                  <button
                    onClick={handleAddRow}
                    className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-2 transition-all cursor-pointer"
                    style={{
                      background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    + 행추가
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    수정 완료
                  </button>
                </div>
              )}
            </div>

            <div className="min-h-[28rem] sm:min-h-[32rem] overflow-x-auto overflow-y-visible border border-gray-200 rounded-xl bg-white [scrollbar-gutter:stable]">
              <table className={SUP_DETAIL_TABLE_EDITABLE}>
                <thead>
                  <tr>
                    <th className={SUP_DETAIL_TH}>세부제품명</th>
                    <th className={SUP_DETAIL_TH}>공정명</th>
                    <th className={SUP_DETAIL_TH}>에너지 유형</th>
                    <th className={SUP_DETAIL_TH}>에너지 사용량</th>
                    <th className={SUP_DETAIL_TH}>에너지 단위</th>
                    <th className={SUP_DETAIL_TH}>에너지 배출계수</th>
                    <th className={SUP_DETAIL_TH}>에너지 배출계수 단위</th>
                    {isTabEditable(6) && <th className={SUP_DETAIL_TH_ACTION}>작업</th>}
                  </tr>
                </thead>
                <tbody>
                  {editableEnergyInfo.map((row, idx) => (
                    <tr key={row.rowId ?? idx} className="group hover:bg-gray-50 transition-colors">
                      <td className={SUP_DETAIL_TD}>{detailProductName}</td>
                      <td className={SUP_DETAIL_TD}>
                        {isTabEditable(6) ? (
                          <SearchableSelectCreatable
                            value={row.processName}
                            onChange={(v) =>
                              setEditableEnergyInfo((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, processName: v } : r)),
                              )
                            }
                            baseOptions={processNameOptions}
                            placeholder="공정명 검색·추가"
                          />
                        ) : (
                          safeValue(row.processName)
                        )}
                      </td>
                      <td className={SUP_DETAIL_TD}>
                        {isTabEditable(6) ? (
                          <SearchableSelectCreatable
                            value={row.energyType}
                            onChange={(v) =>
                              setEditableEnergyInfo((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, energyType: v } : r)),
                              )
                            }
                            baseOptions={energyTypeBaseOptions}
                            placeholder="에너지 유형 검색·추가"
                          />
                        ) : safeValue(row.energyType)}
                      </td>
                      <td className={SUP_DETAIL_TD}>{renderEnergyValueContent(idx, 'energyUsage', row.energyUsage)}</td>
                      <td className={SUP_DETAIL_TD}>
                        {isTabEditable(6) ? (
                          <SearchableSelectCreatable
                            value={row.energyUnit}
                            onChange={(v) =>
                              setEditableEnergyInfo((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, energyUnit: v } : r)),
                              )
                            }
                            baseOptions={unitBaseOptions}
                            placeholder="에너지 단위 검색·추가"
                          />
                        ) : safeValue(row.energyUnit)}
                      </td>
                      <td className={SUP_DETAIL_TD}>
                        <div className="flex min-w-0 items-center gap-1">
                          <div className="min-w-0 flex-1">
                            {renderEnergyValueContent(idx, 'emissionFactor', row.emissionFactor)}
                          </div>
                          {isTabEditable(6) && (
                            <button
                              type="button"
                              title="환경성적표지 참조 계수에서 선택"
                              className="shrink-0 rounded-md p-1 text-[#5B3BFA] hover:bg-violet-50"
                              onClick={() => setEprPickerTarget({ kind: 'energy', rowIndex: idx })}
                            >
                              <TableProperties className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className={SUP_DETAIL_TD}>
                        {isTabEditable(6) ? (
                          <SearchableSelectCreatable
                            value={row.emissionFactorUnit}
                            onChange={(v) =>
                              setEditableEnergyInfo((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, emissionFactorUnit: v } : r)),
                              )
                            }
                            baseOptions={energyEfUnitBaseOptions}
                            placeholder="배출계수 단위 검색·추가"
                          />
                        ) : safeValue(row.emissionFactorUnit)}
                      </td>
                      {isTabEditable(6) && (
                        <td className={SUP_DETAIL_TD_ACTION}>
                          <div className="flex h-8 items-center justify-center gap-0">
                            <button
                              type="button"
                              onClick={() => handleInsertEnergyRowAfter(idx)}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md p-0 text-gray-500 hover:bg-gray-100 transition-colors"
                              title="이 행 아래에 새 행 추가"
                              aria-label="이 행 아래에 새 행 추가"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveEnergyRowAt(idx)}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md p-0 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="이 행 삭제"
                              aria-label="이 행 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 7: // 생산 정보 (Editable)
        return (
          <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {isTabEditable(7) ? (
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
                {isTabEditable(7) && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExcelUpload}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      파일 업로드
                    </button>
                    <button
                      onClick={handleAddRow}
                      className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-2 transition-all cursor-pointer"
                      style={{
                        background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      + 행추가
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      수정 완료
                    </button>
                  </div>
                )}
              </div>

              <div className="min-h-[28rem] sm:min-h-[32rem] overflow-x-auto overflow-y-visible border border-gray-200 rounded-xl bg-white [scrollbar-gutter:stable]">
                <table className={SUP_DETAIL_TABLE_EDITABLE}>
                  <thead>
                    <tr>
                      <th className={SUP_DETAIL_TH}>세부제품명</th>
                      <th className={SUP_DETAIL_TH}>사업장명</th>
                      <th className={SUP_DETAIL_TH}>생산량</th>
                      <th className={SUP_DETAIL_TH}>생산량 단위</th>
                      <th className={SUP_DETAIL_TH}>폐기물량</th>
                      <th className={SUP_DETAIL_TH}>폐기물 배출계수</th>
                      <th className={SUP_DETAIL_TH}>폐기물 배출계수 단위</th>
                      {isTabEditable(7) && <th className={SUP_DETAIL_TH_ACTION}>작업</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(editableProductionRows ?? []).length > 0 ? (
                      editableProductionRows.map((row, idx) => (
                        <tr key={row.rowId ?? idx} className="group hover:bg-gray-50 transition-colors">
                          <td className={SUP_DETAIL_TD}>{detailProductName}</td>
                          <td className={SUP_DETAIL_TD}>
                            {isTabEditable(7) ? (
                              <select
                                value={row.siteName ?? ''}
                                onChange={(e) =>
                                  setEditableProductionRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, siteName: e.target.value } : r)),
                                  )
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded"
                              >
                                <option value="">선택</option>
                                {siteNameOptions.map((siteName) => (
                                  <option key={siteName} value={siteName}>
                                    {siteName}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              safeValue(row.siteName)
                            )}
                          </td>
                          <td className={SUP_DETAIL_TD}>{renderProductionValueContent(idx, 'productionAmount', row.productionAmount)}</td>
                          <td className={SUP_DETAIL_TD}>
                            <div className={cellShellClass} style={{ color: 'var(--aifix-navy)' }}>
                              <span className="min-w-0 flex-1 truncate text-gray-700">{PRODUCTION_QTY_UNIT}</span>
                            </div>
                          </td>
                          <td className={SUP_DETAIL_TD}>{renderProductionValueContent(idx, 'wasteAmount', row.wasteAmount)}</td>
                          <td className={SUP_DETAIL_TD}>{renderProductionValueContent(idx, 'wasteEmissionFactor', row.wasteEmissionFactor)}</td>
                          <td className={SUP_DETAIL_TD}>
                            {isTabEditable(7) ? (
                              <SearchableSelectCreatable
                                value={row.wasteEmissionFactorUnit}
                                onChange={(v) =>
                                  setEditableProductionRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, wasteEmissionFactorUnit: v } : r,
                                    ),
                                  )
                                }
                                baseOptions={materialEfUnitBaseOptions}
                                placeholder="폐기물 배출계수 단위 검색·추가"
                              />
                            ) : (
                              safeValue(row.wasteEmissionFactorUnit)
                            )}
                          </td>
                          {isTabEditable(7) && (
                            <td className={SUP_DETAIL_TD_ACTION}>
                              <div className="flex h-8 items-center justify-center gap-0">
                                <button
                                  type="button"
                                  onClick={() => handleInsertProductionRowAfter(idx)}
                                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md p-0 text-gray-500 hover:bg-gray-100 transition-colors"
                                  title="이 행 아래에 새 행 추가"
                                  aria-label="이 행 아래에 새 행 추가"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProductionRowAt(idx)}
                                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md p-0 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  title="이 행 삭제"
                                  aria-label="이 행 삭제"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={isTabEditable(7) ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                          생산 정보가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
          </div>
        );
      
      case 2: // 담당자 정보 — 데이터뷰 Tier0: 로그인 본인 + 동일 법인 구매팀(IAM)
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Lock className="w-4 h-4" />
                <span>
                  {isDataViewTier0Card
                    ? '로그인 계정 및 구매팀(opr_profiles) — 동일 원청 법인'
                    : '🔗 Source : ERP / MES Interface | Data Sync : 자동 연동'}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">사번</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">부서명</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">직급 및 직책</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">이름</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">이메일</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {isDataViewTier0Card && oprDataViewContacts === null ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 border">
                        담당자 정보를 불러오는 중입니다.
                      </td>
                    </tr>
                  ) : isDataViewTier0Card && company.contactInfo.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 border">
                        표시할 담당자가 없습니다. 원청 프로필(opr_profiles)을 확인하세요.
                      </td>
                    </tr>
                  ) : (
                    company.contactInfo.map((contact, idx) => (
                      <tr
                        key={`${contact.employeeId}-${idx}`}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-4 py-3 text-sm border">{contact.employeeId}</td>
                        <td className="px-4 py-3 text-sm border">{contact.department}</td>
                        <td className="px-4 py-3 text-sm border">{contact.position}</td>
                        <td className="px-4 py-3 text-sm border">{contact.name}</td>
                        <td className="px-4 py-3 text-sm border">{contact.email}</td>
                        <td className="px-4 py-3 text-sm border">{contact.phone}</td>
                      </tr>
                    ))
                  )}
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
              </div>

              {/* Inline KPI: PCF (박스 없음, 레이아웃 부담 최소) */}
              <div className="mt-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm text-gray-500">PCF 결과</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-xl font-semibold tabular-nums text-gray-900 sm:text-2xl">
                      {pcfPrimaryKpiValue !== null ? pcfPrimaryKpiValue.toLocaleString() : '-'}
                    </span>
                    {pcfFinalValue === null && (
                      <span
                        className="inline-flex shrink-0 text-amber-500"
                        title="최종 PCF 미산정 (하위차 데이터 부족)"
                        role="img"
                        aria-label="최종 PCF 미산정, 하위차 데이터 부족 주의"
                      >
                        <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-gray-600">kg CO₂e</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  부분산정 {pcfPartialValue !== null ? `${pcfPartialValue.toLocaleString()} kg CO₂e` : '-'} · 최종{' '}
                  {pcfFinalValue !== null
                    ? `${pcfFinalValue.toLocaleString()} kg CO₂e`
                    : '미산정 (하위차 데이터 부족)'}
                </p>
              </div>

              {/* 메타: 4열 — 고객·지사 | 납품 | 제품·BOM | 계약·조회 월 (라벨-값 간격 축소) */}
              <div className="mt-6 grid w-full grid-cols-1 gap-x-3 gap-y-6 text-sm lg:grid-cols-4 lg:gap-x-3 lg:items-start">
                <div className="min-w-0 space-y-2.5">
                  {[
                    { label: '고객사', value: customerLabel || '-', title: customerLabel || '-' },
                    { label: '지사', value: branchLabel || '-', title: branchLabel || '-' },
                  ].map((row) => (
                    <div key={row.label} className="flex min-w-0 gap-1.5">
                      <span className="w-20 shrink-0 text-gray-500">{row.label}</span>
                      <span className="min-w-0 flex-1 font-semibold text-gray-900 break-words" title={row.title}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="min-w-0 space-y-2.5">
                  {[
                    { label: '납품일', value: deliveryDateLabel, title: deliveryDateLabel },
                    {
                      label: '납품량',
                      value: `${company.deliveryVolume.toLocaleString()} ${deliveryUnit}`,
                      title: `${company.deliveryVolume.toLocaleString()} ${deliveryUnit}`,
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex min-w-0 gap-1.5">
                      <span className="w-20 shrink-0 text-gray-500">{row.label}</span>
                      <span className="min-w-0 flex-1 font-semibold text-gray-900 break-words" title={row.title}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="min-w-0 space-y-2.5">
                  {[
                    { label: '제품', value: productLabel || '-', title: productLabel || '-' },
                    { label: '세부제품', value: detailProductLabel || '-', title: detailProductLabel || '-' },
                    { label: 'M-BOM', value: mBomLabel || '-', title: mBomLabel || '-' },
                  ].map((row) => (
                    <div key={row.label} className="flex min-w-0 gap-1.5">
                      <span className="w-20 shrink-0 text-gray-500">{row.label}</span>
                      <span className="min-w-0 flex-1 font-semibold text-gray-900 break-words" title={row.title}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="min-w-0 space-y-2.5">
                  {[
                    { label: '계약기간', value: contractPeriodLabel, title: contractPeriodLabel },
                    { label: '조회 월', value: yearMonthLabel, title: yearMonthLabel },
                  ].map((row) => (
                    <div key={row.label} className="flex min-w-0 gap-1.5">
                      <span className="w-20 shrink-0 text-gray-500">{row.label}</span>
                      <span className="min-w-0 flex-1 font-semibold text-gray-900 break-words" title={row.title}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openExcelDownloadModal}
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
        <div className="p-6 pb-0">
          <div className="flex gap-2 border-b border-gray-200 mb-6 overflow-x-auto">
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
                <span className="inline-flex items-center gap-2">
                  {tab.name}
                  {!isTabEditable(tab.id) && <Lock className="w-3 h-3 opacity-60" />}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-6 pb-6 pt-0">
          {renderTabContent()}
        </div>
      </div>
      <datalist id="tier0-process-options">
        {processNameOptions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* 엑셀 다운로드 — 사업장 담당자·자재·에너지·생산 시트 선택 */}
      {showExcelDownloadModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowExcelDownloadModal(false)}
        >
          <div
            className="bg-white rounded-[20px] w-full max-w-[900px] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900">엑셀 다운로드</h3>
              <button
                type="button"
                onClick={() => setShowExcelDownloadModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="닫기"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              <p className="mb-4 text-sm text-gray-600">
                다운로드할 세부탭을 선택하면, 선택한 탭별로 시트가 생성됩니다. (컬럼 포맷은 동일하게
                유지됩니다)
              </p>

              <div className="flex items-center justify-end gap-2 mb-4">
                <button
                  type="button"
                  onClick={() =>
                    setExcelDownloadModalTabIds(tier0ExcelDownloadOptions.map((t) => t.id))
                  }
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 bg-white font-semibold text-sm hover:bg-gray-50"
                >
                  전체선택
                </button>
                <button
                  type="button"
                  onClick={() => setExcelDownloadModalTabIds([])}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 bg-white font-semibold text-sm hover:bg-gray-50"
                >
                  전체해지
                </button>
              </div>

              <div className="flex flex-wrap gap-4">
                {tier0ExcelDownloadOptions.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={excelDownloadModalTabIds.includes(t.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setExcelDownloadModalTabIds((prev) => {
                          if (checked) return Array.from(new Set([...prev, t.id]));
                          return prev.filter((id) => id !== t.id);
                        });
                      }}
                      className="w-4 h-4 rounded border-gray-300"
                      style={{ accentColor: '#5B3BFA' }}
                    />
                    <span className="text-gray-900 font-semibold">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                disabled={excelExporting}
                onClick={() => setShowExcelDownloadModal(false)}
                className="px-6 py-3 rounded-xl border border-gray-300 text-gray-900 bg-white font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={excelExporting}
                onClick={() => void handleExcelDownloadConfirm()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                }}
              >
                <Download className="w-5 h-5" />
                {excelExporting ? '다운로드 중…' : '엑셀로 다운받기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Upload Modal — 다운로드와 동일 포맷 → 미리보기(API) → 화면 반영 → 수정 완료 시 DB */}
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
              <p className="mt-2 text-sm text-gray-500">
                사업장 정보·담당자 정보·설비 정보 시트는 업로드해도 읽지 않으며, 해당 탭 화면은 바뀌지
                않습니다. 사업장 담당자·자재·에너지·생산 시트만 읽어 화면에 반영합니다. DB 반영은 확인 후
                「수정 완료」를 누르세요.
              </p>
            </div>
            <div className="p-6">
              <input
                ref={tier0ExcelFileInputRef}
                type="file"
                accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                aria-hidden
              />
              <button
                type="button"
                onClick={() => tier0ExcelFileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#5B3BFA] transition-colors cursor-pointer"
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-700 font-medium mb-2">파일을 드래그하거나 클릭하여 선택</p>
                <p className="text-sm text-gray-500">xlsx 파일 (다운로드한 tier0/export와 동일 구조)</p>
              </button>
              <div className="mt-6 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tier0UploadMode"
                    checked={tier0UploadMergeMode === 'overwrite'}
                    onChange={() => setTier0UploadMergeMode('overwrite')}
                    className="text-[#5B3BFA]"
                  />
                  <span className="text-sm">기존 화면 데이터 덮어쓰기</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tier0UploadMode"
                    checked={tier0UploadMergeMode === 'append'}
                    onChange={() => setTier0UploadMergeMode('append')}
                    className="text-[#5B3BFA]"
                  />
                  <span className="text-sm">기존 화면 데이터 유지 + 엑셀 행 추가</span>
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  if (tier0ExcelFileInputRef.current) tier0ExcelFileInputRef.current.value = '';
                }}
                className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                disabled={tier0ImportBusy}
                onClick={() => void handleTier0ExcelUploadConfirm()}
                className="px-5 py-2.5 text-white rounded-lg disabled:opacity-50"
                style={{
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                }}
              >
                {tier0ImportBusy ? '처리 중…' : '미리보기 반영'}
              </button>
            </div>
          </div>
        </div>
      )}

      <EprCo2eFactorPickerModal
        open={eprPickerTarget !== null}
        onClose={() => setEprPickerTarget(null)}
        onApply={({ co2eFactor, factorUnit, label }) => {
          const t = eprPickerTarget;
          if (!t) return;
          if (t.kind === 'material') {
            setEditableMaterials((prev) =>
              prev.map((r, i) =>
                i === t.rowIndex
                  ? { ...r, materialEmissionFactor: co2eFactor, materialEmissionFactorUnit: factorUnit }
                  : r,
              ),
            );
          } else {
            setEditableEnergyInfo((prev) =>
              prev.map((r, i) =>
                i === t.rowIndex ? { ...r, emissionFactor: co2eFactor, emissionFactorUnit: factorUnit } : r,
              ),
            );
          }
          setMaterialEditCell(null);
          setEnergyEditCell(null);
          toast.success(`배출계수 반영: ${label}`);
        }}
      />
    </div>
  );
}