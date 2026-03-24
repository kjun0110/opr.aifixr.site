import { useState } from 'react';
import { X, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Edit2, FileText, Clock } from 'lucide-react';

interface SupplyChainVersion {
  id: string;
  scvCode: string;
  productName: string;
  customer: string;
  project: string;
  appliedPeriod: string;
  version: string;
  supplierCount: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  dataCoverage: number;
  averageDqr: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'review_requested' | 'rejected';
  pcfResult: number | null;
  lastCalculated: string | null;
  changeReason: string;
}

interface SupplierNode {
  id: string;
  tier: string;
  companyName: string;
  site: string;
  dataStatus: 'complete' | 'partial' | 'missing';
  dataSource: 'supplier_submitted' | 'internal_db' | 'estimated';
  scope1: number;
  scope2: number;
  totalEmission: number;
  children?: SupplierNode[];
}

interface EFTracking {
  tier: string;
  companyName: string;
  site: string;
  dataItem: string; // 전력, LNG, 소재투입, 운송 등
  activityValue: number;
  activityUnit: string;
  efId: string;
  efSource: string; // Internal DB, ecoinvent, DEFRA, EPA 등
  efCountry: string;
  efYear: number;
  calculatedEmission: number;
}

interface AuditLog {
  timestamp: string;
  user: string;
  action: string;
  target: string;
  oldValue: string;
  newValue: string;
}

interface PcfCalculationDetailModalProps {
  scv: SupplyChainVersion;
  onClose: () => void;
}

// Mock supplier tree data
const mockSupplierTree: SupplierNode[] = [
  {
    id: 'tier0-1',
    tier: 'Tier 0',
    companyName: '삼성SDI',
    site: '천안사업장',
    dataStatus: 'complete',
    dataSource: 'internal_db',
    scope1: 2850.5,
    scope2: 7150.8,
    totalEmission: 10001.3,
    children: [
      {
        id: 'tier1-1',
        tier: 'Tier 1',
        companyName: '한국배터리',
        site: '울산공장',
        dataStatus: 'complete',
        dataSource: 'supplier_submitted',
        scope1: 1050.2,
        scope2: 2850.6,
        totalEmission: 3900.8,
        children: [
          {
            id: 'tier2-1',
            tier: 'Tier 2',
            companyName: '셀테크',
            site: '선전공장',
            dataStatus: 'partial',
            dataSource: 'supplier_submitted',
            scope1: 580.3,
            scope2: 1550.7,
            totalEmission: 2131.0,
          },
          {
            id: 'tier2-2',
            tier: 'Tier 2',
            companyName: 'BMS 솔루션즈',
            site: '타이페이사업장',
            dataStatus: 'complete',
            dataSource: 'supplier_submitted',
            scope1: 320.5,
            scope2: 780.3,
            totalEmission: 1100.8,
          },
        ],
      },
      {
        id: 'tier1-2',
        tier: 'Tier 1',
        companyName: '글로벌 소재',
        site: '베를린공장',
        dataStatus: 'complete',
        dataSource: 'supplier_submitted',
        scope1: 620.8,
        scope2: 1580.5,
        totalEmission: 2201.3,
      },
    ],
  },
];

// Mock EF tracking data
const mockEFTracking: EFTracking[] = [
  {
    tier: 'Tier 0',
    companyName: '삼성SDI',
    site: '천안사업장',
    dataItem: '전력 사용',
    activityValue: 15000,
    activityUnit: 'kWh',
    efId: 'EF-KR-ELEC-2024-001',
    efSource: 'Internal DB v3.2',
    efCountry: 'South Korea',
    efYear: 2024,
    calculatedEmission: 7150.8,
  },
  {
    tier: 'Tier 0',
    companyName: '삼성SDI',
    site: '천안사업장',
    dataItem: 'LNG 연소',
    activityValue: 2000,
    activityUnit: 'Nm³',
    efId: 'EF-KR-LNG-2024-002',
    efSource: 'K-ETS Database',
    efCountry: 'South Korea',
    efYear: 2024,
    calculatedEmission: 2850.5,
  },
  {
    tier: 'Tier 1',
    companyName: '한국배터리',
    site: '울산공장',
    dataItem: '전력 사용',
    activityValue: 6200,
    activityUnit: 'kWh',
    efId: 'EF-KR-ELEC-2024-001',
    efSource: 'Internal DB v3.2',
    efCountry: 'South Korea',
    efYear: 2024,
    calculatedEmission: 2850.6,
  },
  {
    tier: 'Tier 1',
    companyName: '한국배터리',
    site: '울산공장',
    dataItem: '소재 투입 (리튬)',
    activityValue: 500,
    activityUnit: 'kg',
    efId: 'EF-ECOINVENT-LITHIUM-2023-045',
    efSource: 'ecoinvent 3.8',
    efCountry: 'Global',
    efYear: 2023,
    calculatedEmission: 1050.2,
  },
  {
    tier: 'Tier 2',
    companyName: '셀테크',
    site: '선전공장',
    dataItem: '전력 사용',
    activityValue: 8500,
    activityUnit: 'kWh',
    efId: 'EF-CN-ELEC-2024-003',
    efSource: 'DEFRA 2023',
    efCountry: 'China',
    efYear: 2024,
    calculatedEmission: 1550.7,
  },
  {
    tier: 'Tier 2',
    companyName: '셀테크',
    site: '선전공장',
    dataItem: '디젤 사용',
    activityValue: 300,
    activityUnit: 'L',
    efId: 'EF-CN-DIESEL-2024-005',
    efSource: 'IPCC 2019',
    efCountry: 'China',
    efYear: 2024,
    calculatedEmission: 580.3,
  },
  {
    tier: 'Tier 2',
    companyName: 'BMS 솔루션즈',
    site: '타이페이사업장',
    dataItem: '전력 사용',
    activityValue: 4200,
    activityUnit: 'kWh',
    efId: 'EF-TW-ELEC-2024-002',
    efSource: 'Taiwan LCI Database',
    efCountry: 'Taiwan',
    efYear: 2024,
    calculatedEmission: 780.3,
  },
  {
    tier: 'Tier 1',
    companyName: '글로벌 소재',
    site: '베를린공장',
    dataItem: '전력 사용',
    activityValue: 7800,
    activityUnit: 'kWh',
    efId: 'EF-DE-ELEC-2024-001',
    efSource: 'EPA Database',
    efCountry: 'Germany',
    efYear: 2024,
    calculatedEmission: 1580.5,
  },
  {
    tier: 'Tier 1',
    companyName: '글로벌 소재',
    site: '베를린공장',
    dataItem: '천연가스 사용',
    activityValue: 1500,
    activityUnit: 'Nm³',
    efId: 'EF-DE-GAS-2024-003',
    efSource: 'EU ETS Database',
    efCountry: 'Germany',
    efYear: 2024,
    calculatedEmission: 620.8,
  },
];

// Mock audit logs
const mockAuditLogs: AuditLog[] = [
  {
    timestamp: '2026-03-01 14:32:15',
    user: 'kim.pcf@samsungsdi.com',
    action: 'EF 변경',
    target: 'Tier 1 | 한국배터리 | 전력 사용',
    oldValue: 'EF-KR-ELEC-2023-001',
    newValue: 'EF-KR-ELEC-2024-001',
  },
  {
    timestamp: '2026-03-01 11:20:08',
    user: 'park.data@samsungsdi.com',
    action: '데이터 수정',
    target: 'Tier 2 | 셀테크 | Scope 1',
    oldValue: '560.5 kg',
    newValue: '580.3 kg',
  },
  {
    timestamp: '2026-02-28 16:45:22',
    user: 'lee.esg@samsungsdi.com',
    action: 'PCF 산정 실행',
    target: 'SCV-2026-01',
    oldValue: '—',
    newValue: '32,420.3 kg CO₂e',
  },
  {
    timestamp: '2026-02-28 09:12:35',
    user: 'choi.supplier@samsungsdi.com',
    action: '데이터 검증',
    target: 'Tier 1 | 글로벌 소재 | 전체',
    oldValue: '미검증',
    newValue: '검증완료',
  },
];

export default function PcfCalculationDetailModal({ scv, onClose }: PcfCalculationDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'mapping' | 'ef' | 'result'>('mapping');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['tier0-1']));

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const getDataStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            완료
          </span>
        );
      case 'partial':
        return (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            부분입력
          </span>
        );
      case 'missing':
        return (
          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            누락
          </span>
        );
      default:
        return null;
    }
  };

  const getDataSourceBadge = (source: string) => {
    switch (source) {
      case 'supplier_submitted':
        return <span className="text-xs text-blue-600">협력사 제출</span>;
      case 'internal_db':
        return <span className="text-xs text-purple-600">원청 내부 데이터</span>;
      case 'estimated':
        return <span className="text-xs text-orange-600">시스템 추정치</span>;
      default:
        return null;
    }
  };

  const renderSupplierNode = (node: SupplierNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className="border-b border-gray-100 hover:bg-gray-50"
          style={{ paddingLeft: `${depth * 40 + 16}px` }}
        >
          <div className="flex items-center py-4 pr-4 gap-4">
            {/* Toggle */}
            <div className="w-6 flex-shrink-0">
              {hasChildren && (
                <button
                  onClick={() => toggleNode(node.id)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            {/* Tier */}
            <div className="w-24 flex-shrink-0">
              <span className="px-3 py-1 bg-[#00B4FF] text-white rounded-full text-sm font-semibold">
                {node.tier}
              </span>
            </div>

            {/* Company & Site */}
            <div className="flex-1 min-w-0">
              <div className="font-medium">{node.companyName}</div>
              <div className="text-sm text-gray-500">{node.site}</div>
            </div>

            {/* Data Status */}
            <div className="w-32 flex-shrink-0">{getDataStatusBadge(node.dataStatus)}</div>

            {/* Data Source */}
            <div className="w-32 flex-shrink-0">{getDataSourceBadge(node.dataSource)}</div>

            {/* Scope 1 */}
            <div className="w-32 flex-shrink-0 text-sm">{node.scope1.toLocaleString()} kg</div>

            {/* Scope 2 */}
            <div className="w-32 flex-shrink-0 text-sm">{node.scope2.toLocaleString()} kg</div>

            {/* Total Emission */}
            <div className="w-36 flex-shrink-0 font-bold text-[#00B4FF]">
              {node.totalEmission.toLocaleString()} kg
            </div>
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>{node.children!.map((child) => renderSupplierNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white w-full h-full relative flex flex-col"
        style={{
          maxWidth: '1400px',
          maxHeight: '90vh',
          borderRadius: '20px',
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">PCF 산정 상세</h2>
              <p className="text-sm text-gray-600 mt-1">
                {scv.scvCode} | {scv.productName} | {scv.version}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-blue-50 p-4 rounded-xl">
              <div className="text-sm text-gray-600 mb-1">적용 기간</div>
              <div className="font-bold text-lg">{scv.appliedPeriod}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl">
              <div className="text-sm text-gray-600 mb-1">PCF 결과</div>
              <div className="font-bold text-lg text-[#00B4FF]">
                {scv.pcfResult ? `${scv.pcfResult.toLocaleString()} kg` : '—'}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-xl">
              <div className="text-sm text-gray-600 mb-1">데이터 커버리지</div>
              <div className="font-bold text-lg text-green-700">{scv.dataCoverage.toFixed(1)}%</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-xl">
              <div className="text-sm text-gray-600 mb-1">DQR 평균</div>
              <div className="font-bold text-lg text-orange-700">{scv.averageDqr.toFixed(1)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <div className="text-sm text-gray-600 mb-1">협력사 수</div>
              <div className="font-bold text-lg">
                {scv.supplierCount.tier1 + scv.supplierCount.tier2 + scv.supplierCount.tier3}개
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-4">
            <button
              className="px-4 py-2 text-white rounded-lg font-medium transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
              }}
            >
              {scv.pcfResult ? 'PCF 재산정' : 'PCF 산정 실행'}
            </button>
            {scv.pcfResult && (
              <button className="px-4 py-2 border-2 border-green-500 text-green-700 rounded-lg font-medium hover:bg-green-50 transition-colors">
                결과 확정
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-1 px-6">
            <button
              onClick={() => setActiveTab('mapping')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'mapping'
                  ? 'text-[#00B4FF] border-b-2 border-[#00B4FF]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              공급망 데이터 매핑
            </button>
            <button
              onClick={() => setActiveTab('ef')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'ef'
                  ? 'text-[#00B4FF] border-b-2 border-[#00B4FF]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              배출계수(EF) 추적
            </button>
            <button
              onClick={() => setActiveTab('result')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'result'
                  ? 'text-[#00B4FF] border-b-2 border-[#00B4FF]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              산정 결과 및 감사 추적
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Tab A: Data Mapping */}
          {activeTab === 'mapping' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-bold mb-2">공급망 계층별 데이터 현황</h3>
                <p className="text-sm text-gray-600">
                  각 협력사별 제출 데이터 및 필수 필드 누락 여부를 확인합니다
                </p>
              </div>

              <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
                {/* Table Header */}
                <div className="bg-gradient-to-r from-[#5B3BFA] to-[#00B4FF] text-white px-4 py-3">
                  <div className="flex items-center gap-4">
                    <div className="w-6"></div>
                    <div className="w-24">Tier</div>
                    <div className="flex-1">회사명 / 사업장</div>
                    <div className="w-32">데이터 상태</div>
                    <div className="w-32">데이터 출처</div>
                    <div className="w-32">Scope 1</div>
                    <div className="w-32">Scope 2</div>
                    <div className="w-36">총 배출량</div>
                  </div>
                </div>

                {/* Table Body */}
                {mockSupplierTree.map((node) => renderSupplierNode(node))}
              </div>
            </div>
          )}

          {/* Tab B: EF Tracking */}
          {activeTab === 'ef' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-bold mb-2">배출계수(EF) 추적</h3>
                <p className="text-sm text-gray-600">
                  각 협력사 및 항목별 배출계수 ID, 출처, 국가, 연도를 추적합니다
                </p>
              </div>

              <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-[#5B3BFA] to-[#00B4FF] text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Tier</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">회사명</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">사업장</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">데이터 항목</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">활동량</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">EF ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">EF 출처/DB</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">국가</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">연도</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">계산 배출량</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockEFTracking.map((ef, index) => (
                        <tr
                          key={index}
                          className={`border-b border-gray-100 hover:bg-gray-50 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-[#00B4FF] text-white rounded text-xs font-semibold">
                              {ef.tier}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">{ef.companyName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{ef.site}</td>
                          <td className="px-4 py-3 text-sm">{ef.dataItem}</td>
                          <td className="px-4 py-3 text-sm">
                            {ef.activityValue.toLocaleString()} {ef.activityUnit}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-1 rounded">
                              {ef.efId}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-blue-700">{ef.efSource}</td>
                          <td className="px-4 py-3 text-sm">{ef.efCountry}</td>
                          <td className="px-4 py-3 text-sm">{ef.efYear}</td>
                          <td className="px-4 py-3 font-bold text-[#00B4FF]">
                            {ef.calculatedEmission.toLocaleString()} kg
                          </td>
                          <td className="px-4 py-3">
                            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors">
                              <Edit2 className="w-4 h-4 text-gray-600" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab C: Result & Audit */}
          {activeTab === 'result' && (
            <div className="space-y-6">
              {/* PCF Result Summary */}
              <div>
                <h3 className="text-lg font-bold mb-4">최종 PCF 결과 요약</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div
                    className="p-6 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, #5B3BFA 0%, #00B4FF 100%)',
                    }}
                  >
                    <div className="text-white text-sm mb-2">총 배출량</div>
                    <div className="text-white text-3xl font-bold">
                      {scv.pcfResult?.toLocaleString() || '—'}
                    </div>
                    <div className="text-white text-sm mt-1">kg CO₂e</div>
                  </div>
                  <div className="p-6 bg-blue-50 rounded-xl">
                    <div className="text-gray-700 text-sm mb-2">Scope 1 기여도</div>
                    <div className="text-blue-700 text-3xl font-bold">32.5%</div>
                    <div className="text-gray-600 text-sm mt-1">10,536.6 kg CO₂e</div>
                  </div>
                  <div className="p-6 bg-purple-50 rounded-xl">
                    <div className="text-gray-700 text-sm mb-2">Scope 2 기여도</div>
                    <div className="text-purple-700 text-3xl font-bold">67.5%</div>
                    <div className="text-gray-600 text-sm mt-1">21,883.7 kg CO₂e</div>
                  </div>
                </div>
              </div>

              {/* Supplier Contribution Ranking */}
              <div>
                <h3 className="text-lg font-bold mb-4">협력사별 배출 기여도 랭킹</h3>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold">순위</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Tier</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">회사명</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">배출량</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">기여도</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">진행률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { rank: 1, tier: 'Tier 0', company: '삼성SDI', emission: 10001.3, ratio: 30.8 },
                        { rank: 2, tier: 'Tier 1', company: '한국배터리', emission: 3900.8, ratio: 12.0 },
                        { rank: 3, tier: 'Tier 1', company: '글로벌 소재', emission: 2201.3, ratio: 6.8 },
                        { rank: 4, tier: 'Tier 2', company: '셀테크', emission: 2131.0, ratio: 6.6 },
                        { rank: 5, tier: 'Tier 2', company: 'BMS 솔루션즈', emission: 1100.8, ratio: 3.4 },
                      ].map((item) => (
                        <tr key={item.rank} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-6 py-4 font-bold text-lg">{item.rank}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-[#00B4FF] text-white rounded text-xs font-semibold">
                              {item.tier}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium">{item.company}</td>
                          <td className="px-6 py-4 font-bold text-[#00B4FF]">
                            {item.emission.toLocaleString()} kg
                          </td>
                          <td className="px-6 py-4 font-semibold">{item.ratio}%</td>
                          <td className="px-6 py-4">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${item.ratio * 3}%`,
                                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                                }}
                              ></div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Audit Log */}
              <div>
                <h3 className="text-lg font-bold mb-4">변경 로그 (최근 10건)</h3>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold">시간</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">사용자</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">작업</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">대상</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">변경 내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockAuditLogs.map((log, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-600">{log.timestamp}</td>
                          <td className="px-6 py-4 text-sm">{log.user}</td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium">{log.target}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className="text-red-600 line-through">{log.oldValue}</span>
                            {' → '}
                            <span className="text-green-600 font-medium">{log.newValue}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-600">
            마지막 산정: {scv.lastCalculated || '—'}
          </div>
          <div className="flex items-center gap-3">
            <button className="px-6 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              보고서 다운로드
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 text-white rounded-xl font-medium transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
