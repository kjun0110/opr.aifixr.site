'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, FileText, Calculator, ChevronRight, ChevronDown, Info, Database, TrendingUp, CheckCircle, Clock, Package, Zap, Truck, Factory, Leaf } from 'lucide-react';

// Types
interface ComputationNode {
  id: string;
  name: string;
  type: 'total' | 'oem' | 'tier1' | 'tier2' | 'tier3' | 'item';
  emission: number;
  percentage: number;
  children?: ComputationNode[];
  details?: EmissionDetail[];
}

interface EmissionDetail {
  id: string;
  itemName: string;
  activityData: number;
  unit: string;
  emissionFactor: number;
  efSource: string;
  efVersion: string;
  calculatedEmission: number;
  formula: string;
}

interface EmissionFactorUsage {
  id: string;
  efName: string;
  value: number;
  version: string;
  source: string;
  dataType: '1차 데이터' | '2차 데이터' | '국가 평균' | '내부 계산';
  unit: string;
}

interface CalculationLog {
  id: string;
  executedAt: string;
  executor: string;
  supplyChainVersion: string;
  mbomVersion: string;
  isRecalculation: boolean;
  note: string;
}

// Mock Calculation Tree
const mockComputationTree: ComputationNode = {
  id: 'total',
  name: '총 PCF',
  type: 'total',
  emission: 32420.3,
  percentage: 100,
  children: [
    {
      id: 'oem',
      name: '원청 직접 배출 (삼성SDI)',
      type: 'oem',
      emission: 8240.5,
      percentage: 25.4,
      children: [
        {
          id: 'oem-electricity',
          name: '전력 사용',
          type: 'item',
          emission: 3672.0,
          percentage: 11.3,
          details: [
            {
              id: 'detail1',
              itemName: '제조 공정 전력',
              activityData: 8000,
              unit: 'kWh',
              emissionFactor: 0.459,
              efSource: 'KR Grid 2026',
              efVersion: 'v2.1',
              calculatedEmission: 3672.0,
              formula: '8,000 kWh × 0.459 kgCO₂e/kWh = 3,672 kgCO₂e',
            },
          ],
        },
        {
          id: 'oem-lng',
          name: 'LNG 사용',
          type: 'item',
          emission: 2450.0,
          percentage: 7.6,
          details: [
            {
              id: 'detail2',
              itemName: '공정 열원 LNG',
              activityData: 500,
              unit: 'Nm³',
              emissionFactor: 4.9,
              efSource: 'IPCC 2019',
              efVersion: 'v5.0',
              calculatedEmission: 2450.0,
              formula: '500 Nm³ × 4.9 kgCO₂e/Nm³ = 2,450 kgCO₂e',
            },
          ],
        },
        {
          id: 'oem-process',
          name: '공정 배출',
          type: 'item',
          emission: 1520.0,
          percentage: 4.7,
          details: [
            {
              id: 'detail3',
              itemName: '화학 반응 배출',
              activityData: 1520,
              unit: 'kg',
              emissionFactor: 1.0,
              efSource: '내부 측정',
              efVersion: '2026-Q1',
              calculatedEmission: 1520.0,
              formula: '1,520 kg × 1.0 kgCO₂e/kg = 1,520 kgCO₂e',
            },
          ],
        },
        {
          id: 'oem-logistics',
          name: '사내 물류',
          type: 'item',
          emission: 598.5,
          percentage: 1.8,
          details: [
            {
              id: 'detail4',
              itemName: '지게차 운행',
              activityData: 120,
              unit: 'L',
              emissionFactor: 4.9875,
              efSource: 'GHG Protocol',
              efVersion: '2022',
              calculatedEmission: 598.5,
              formula: '120 L × 4.9875 kgCO₂e/L = 598.5 kgCO₂e',
            },
          ],
        },
      ],
    },
    {
      id: 'tier1-1',
      name: 'Tier 1 – 한국배터리',
      type: 'tier1',
      emission: 15200.8,
      percentage: 46.9,
      children: [
        {
          id: 'tier1-1-lithium',
          name: '리튬 원료',
          type: 'item',
          emission: 8500.0,
          percentage: 26.2,
          details: [
            {
              id: 'detail5',
              itemName: '리튬 카보네이트',
              activityData: 15.5,
              unit: 'kg',
              emissionFactor: 548.4,
              efSource: 'Ecoinvent 3.9',
              efVersion: 'v3.9.1',
              calculatedEmission: 8500.2,
              formula: '15.5 kg × 548.4 kgCO₂e/kg = 8,500.2 kgCO₂e',
            },
          ],
        },
        {
          id: 'tier1-1-cathode',
          name: '음극재 가공',
          type: 'item',
          emission: 4200.3,
          percentage: 13.0,
          details: [
            {
              id: 'detail6',
              itemName: 'NCM811 양극재',
              activityData: 12.3,
              unit: 'kg',
              emissionFactor: 341.5,
              efSource: 'Primary Data (협력사)',
              efVersion: '2026-Q1',
              calculatedEmission: 4200.45,
              formula: '12.3 kg × 341.5 kgCO₂e/kg = 4,200.45 kgCO₂e',
            },
          ],
        },
        {
          id: 'tier1-1-electricity',
          name: '전력 사용',
          type: 'item',
          emission: 2500.5,
          percentage: 7.7,
          details: [
            {
              id: 'detail7',
              itemName: '제조 공정 전력',
              activityData: 5450,
              unit: 'kWh',
              emissionFactor: 0.459,
              efSource: 'KR Grid 2026',
              efVersion: 'v2.1',
              calculatedEmission: 2501.55,
              formula: '5,450 kWh × 0.459 kgCO₂e/kWh = 2,501.55 kgCO₂e',
            },
          ],
        },
      ],
    },
    {
      id: 'tier1-2',
      name: 'Tier 1 – 파워셀 테크놀로지',
      type: 'tier1',
      emission: 5800.0,
      percentage: 17.9,
      children: [
        {
          id: 'tier1-2-bms',
          name: 'BMS 제조',
          type: 'item',
          emission: 3600.0,
          percentage: 11.1,
          details: [
            {
              id: 'detail8',
              itemName: 'BMS 회로 기판',
              activityData: 1,
              unit: 'SET',
              emissionFactor: 3600,
              efSource: 'Primary Data (협력사)',
              efVersion: '2026-Q1',
              calculatedEmission: 3600.0,
              formula: '1 SET × 3,600 kgCO₂e/SET = 3,600 kgCO₂e',
            },
          ],
        },
        {
          id: 'tier1-2-transport',
          name: '운송',
          type: 'item',
          emission: 2200.0,
          percentage: 6.8,
          details: [
            {
              id: 'detail9',
              itemName: '해상 운송 (일본-한국)',
              activityData: 500,
              unit: 'tkm',
              emissionFactor: 4.4,
              efSource: 'GaBi Database',
              efVersion: '2025',
              calculatedEmission: 2200.0,
              formula: '500 tkm × 4.4 kgCO₂e/tkm = 2,200 kgCO₂e',
            },
          ],
        },
      ],
    },
    {
      id: 'tier2-1',
      name: 'Tier 2 – 셀테크',
      type: 'tier2',
      emission: 3179.0,
      percentage: 9.8,
      children: [
        {
          id: 'tier2-1-mining',
          name: '리튬 채굴',
          type: 'item',
          emission: 2100.0,
          percentage: 6.5,
          details: [
            {
              id: 'detail10',
              itemName: '리튬 광석 채굴',
              activityData: 30,
              unit: 'kg',
              emissionFactor: 70.0,
              efSource: 'Ecoinvent 3.9',
              efVersion: 'v3.9.1',
              calculatedEmission: 2100.0,
              formula: '30 kg × 70.0 kgCO₂e/kg = 2,100 kgCO₂e',
            },
          ],
        },
        {
          id: 'tier2-1-transport',
          name: '운송 (칠레-중국)',
          type: 'item',
          emission: 1079.0,
          percentage: 3.3,
          details: [
            {
              id: 'detail11',
              itemName: '해상 운송',
              activityData: 8500,
              unit: 'tkm',
              emissionFactor: 0.127,
              efSource: 'GaBi Database',
              efVersion: '2025',
              calculatedEmission: 1079.5,
              formula: '8,500 tkm × 0.127 kgCO₂e/tkm = 1,079.5 kgCO₂e',
            },
          ],
        },
      ],
    },
  ],
};

// Mock Emission Factor Usage
const mockEmissionFactors: EmissionFactorUsage[] = [
  { id: 'ef1', efName: 'KR Grid 2026', value: 0.459, version: 'v2.1', source: 'KEA (한국에너지공단)', dataType: '국가 평균', unit: 'kgCO₂e/kWh' },
  { id: 'ef2', efName: 'IPCC LNG 배출계수', value: 4.9, version: 'v5.0', source: 'IPCC 2019', dataType: '2차 데이터', unit: 'kgCO₂e/Nm³' },
  { id: 'ef3', efName: '리튬 카보네이트', value: 548.4, version: 'v3.9.1', source: 'Ecoinvent 3.9', dataType: '2차 데이터', unit: 'kgCO₂e/kg' },
  { id: 'ef4', efName: 'NCM811 양극재', value: 341.5, version: '2026-Q1', source: '한국배터리 (협력사 제출)', dataType: '1차 데이터', unit: 'kgCO₂e/kg' },
  { id: 'ef5', efName: 'BMS 회로 기판', value: 3600, version: '2026-Q1', source: '파워셀 테크놀로지 (협력사 제출)', dataType: '1차 데이터', unit: 'kgCO₂e/SET' },
  { id: 'ef6', efName: '해상 운송', value: 4.4, version: '2025', source: 'GaBi Database', dataType: '2차 데이터', unit: 'kgCO₂e/tkm' },
  { id: 'ef7', efName: '화학 반응 배출', value: 1.0, version: '2026-Q1', source: '삼성SDI 내부 측정', dataType: '내부 계산', unit: 'kgCO₂e/kg' },
];

// Mock Calculation Log
const mockCalculationLogs: CalculationLog[] = [
  { id: 'log1', executedAt: '2026-03-04 10:23:15', executor: '김민수 (PCF 담당)', supplyChainVersion: 'v1.2', mbomVersion: 'M-BOM v2.3', isRecalculation: false, note: '최초 계산' },
  { id: 'log2', executedAt: '2026-03-01 14:12:05', executor: '이지은 (PCF 담당)', supplyChainVersion: 'v1.2', mbomVersion: 'M-BOM v2.3', isRecalculation: true, note: 'EF 업데이트 반영' },
];

export default function PcfCalculationDetail() {
  const router = useRouter();
  const { calculationId } = useParams();

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['total', 'oem', 'tier1-1', 'tier1-2']));
  const [showFormulaId, setShowFormulaId] = useState<string | null>(null);

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const toggleFormula = (detailId: string) => {
    setShowFormulaId(showFormulaId === detailId ? null : detailId);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'total':
        return <Calculator className="w-4 h-4" />;
      case 'oem':
        return <Factory className="w-4 h-4" />;
      case 'tier1':
        return <Package className="w-4 h-4" />;
      case 'tier2':
        return <Truck className="w-4 h-4" />;
      case 'item':
        return <Leaf className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'total':
        return 'bg-gradient-to-r from-purple-100 to-blue-100 border-purple-300';
      case 'oem':
        return 'bg-blue-50 border-blue-300';
      case 'tier1':
        return 'bg-cyan-50 border-cyan-300';
      case 'tier2':
        return 'bg-teal-50 border-teal-300';
      case 'tier3':
        return 'bg-green-50 border-green-300';
      case 'item':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const getDataTypeBadge = (dataType: string) => {
    switch (dataType) {
      case '1차 데이터':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">1차 데이터</span>;
      case '2차 데이터':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">2차 데이터</span>;
      case '국가 평균':
        return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">국가 평균</span>;
      case '내부 계산':
        return <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">내부 계산</span>;
      default:
        return null;
    }
  };

  // Render Computation Tree Node
  const renderComputationNode = (node: ComputationNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const hasDetails = node.details && node.details.length > 0;

    return (
      <div key={node.id} style={{ marginLeft: level > 0 ? '24px' : '0' }} className="mb-2">
        {/* Node Header */}
        <div
          className={`p-3 border rounded-lg ${getNodeColor(node.type)}`}
          style={{
            borderRadius: '12px',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {hasChildren && (
                <button
                  onClick={() => toggleNode(node.id)}
                  className="p-1 hover:bg-white/50 rounded transition-transform"
                  style={{
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {!hasChildren && <div className="w-6"></div>}

              {getNodeIcon(node.type)}
              <span className={`font-semibold ${node.type === 'total' ? 'text-lg' : 'text-sm'}`}>
                {node.name}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className={`font-bold ${node.type === 'total' ? 'text-xl text-[#5B3BFA]' : 'text-base text-gray-700'}`}>
                  {node.emission.toLocaleString()} kgCO₂e
                </div>
                <div className="text-xs text-gray-600">
                  {node.percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Detail Table (if item-level) */}
          {hasDetails && isExpanded && (
            <div className="mt-3 bg-white/80 rounded-lg p-3 border border-gray-200">
              <table className="w-full text-xs">
                <thead className="border-b border-gray-300">
                  <tr>
                    <th className="text-left py-2 font-semibold">항목</th>
                    <th className="text-left py-2 font-semibold">활동 데이터</th>
                    <th className="text-left py-2 font-semibold">단위</th>
                    <th className="text-left py-2 font-semibold">배출계수(EF)</th>
                    <th className="text-left py-2 font-semibold">EF 출처</th>
                    <th className="text-right py-2 font-semibold">계산 결과</th>
                    <th className="text-center py-2 font-semibold">수식</th>
                  </tr>
                </thead>
                <tbody>
                  {node.details!.map((detail) => (
                    <>
                      <tr key={detail.id} className="border-b border-gray-100">
                        <td className="py-2 font-medium">{detail.itemName}</td>
                        <td className="py-2">{detail.activityData.toLocaleString()}</td>
                        <td className="py-2">{detail.unit}</td>
                        <td className="py-2 font-mono text-blue-600">{detail.emissionFactor}</td>
                        <td className="py-2 text-gray-600">{detail.efSource}</td>
                        <td className="py-2 text-right font-bold text-[#00B4FF]">
                          {detail.calculatedEmission.toLocaleString()} kgCO₂e
                        </td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => toggleFormula(detail.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Calculator className="w-4 h-4 text-[#5B3BFA]" />
                          </button>
                        </td>
                      </tr>
                      {showFormulaId === detail.id && (
                        <tr>
                          <td colSpan={7} className="py-2 bg-purple-50">
                            <div className="flex items-center gap-2 px-3 py-2">
                              <Info className="w-4 h-4 text-[#5B3BFA]" />
                              <span className="font-mono text-sm text-gray-700">{detail.formula}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Children Nodes */}
        {hasChildren && isExpanded && (
          <div className="mt-2">
            {node.children!.map((child) => renderComputationNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Data Quality Metrics
  const primaryDataRatio = 35.2;
  const secondaryDataRatio = 52.8;
  const nationalAvgRatio = 8.5;
  const internalCalcRatio = 3.5;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/pcf-calculation')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">PCF 계산 상세 (감사 추적용)</h1>
          <p className="text-sm text-gray-600 mt-1">
            계산 구조 투명성 확보 및 규제 대응을 위한 상세 페이지
          </p>
        </div>
      </div>

      {/* 1. Calculation Meta Info Card */}
      <div
        className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border border-blue-200"
        style={{
          borderRadius: '20px',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-[#5B3BFA]" />
          <h2 className="text-lg font-bold">계산 메타 정보</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">PCF 계산 ID</div>
            <div className="font-bold text-[#5B3BFA] font-mono">{calculationId || 'PCF-2026-001'}</div>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">프로젝트명</div>
            <div className="font-bold text-gray-700">삼성SDI 배터리 프로젝트</div>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">제품명</div>
            <div className="font-bold text-gray-700">배터리 모듈 A</div>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">적용 공급망 버전</div>
            <div className="font-bold text-blue-600">v1.2</div>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">적용 M-BOM 버전</div>
            <div className="font-bold text-blue-600">M-BOM v2.3</div>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">적용 기간</div>
            <div className="font-bold text-gray-700">2026-Q1</div>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">계산일</div>
            <div className="font-bold text-gray-700">2026-03-01</div>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">총 배출량</div>
            <div className="font-bold text-[#5B3BFA] text-xl">32,420.3 kgCO₂e</div>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">전체 커버리지</div>
            <div className="font-bold text-green-600 text-lg">95.5%</div>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">평균 DQR</div>
            <div className="font-bold text-green-600 text-lg">1.6</div>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">계산 상태</div>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="font-bold text-green-600">완료</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Computation Tree (Core) */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-[#00B4FF]" />
          <h2 className="text-lg font-bold">계산 트리 (Computation Tree)</h2>
          <span className="text-xs text-gray-500 ml-2">
            ※ 각 노드를 클릭하여 상세 계산식을 확인하세요
          </span>
        </div>

        <div className="mt-4">
          {renderComputationNode(mockComputationTree)}
        </div>
      </div>

      {/* 3. Emission Factor Usage */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-[#00B4FF]" />
          <h2 className="text-lg font-bold">배출계수(EF) 사용 현황</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F0F9FF] border-b border-blue-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold">EF명</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">값</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">버전</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">출처</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">데이터 유형</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">단위</th>
              </tr>
            </thead>
            <tbody>
              {mockEmissionFactors.map((ef, idx) => (
                <tr key={ef.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 text-sm font-medium">{ef.efName}</td>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">{ef.value}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{ef.version}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{ef.source}</td>
                  <td className="px-4 py-3 text-xs">{getDataTypeBadge(ef.dataType)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{ef.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Data Quality Summary */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-[#00B4FF]" />
          <h2 className="text-lg font-bold">데이터 품질 요약</h2>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-xs text-gray-600 mb-1">1차 데이터 비율</div>
            <div className="text-2xl font-bold text-green-600">{primaryDataRatio}%</div>
            <div className="text-xs text-gray-500 mt-1">협력사 제출 데이터</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs text-gray-600 mb-1">2차 데이터 비율</div>
            <div className="text-2xl font-bold text-blue-600">{secondaryDataRatio}%</div>
            <div className="text-xs text-gray-500 mt-1">LCI DB 기반</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-xs text-gray-600 mb-1">국가 평균 비율</div>
            <div className="text-2xl font-bold text-yellow-600">{nationalAvgRatio}%</div>
            <div className="text-xs text-gray-500 mt-1">국가 통계</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-xs text-gray-600 mb-1">내부 계산 비율</div>
            <div className="text-2xl font-bold text-purple-600">{internalCalcRatio}%</div>
            <div className="text-xs text-gray-500 mt-1">자체 측정</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Tier 1 커버리지</div>
            <div className="text-xl font-bold text-gray-700">100%</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Tier 2 커버리지</div>
            <div className="text-xl font-bold text-gray-700">95.5%</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">데이터 공백 항목</div>
            <div className="text-xl font-bold text-red-600">2개</div>
          </div>
        </div>
      </div>

      {/* 5. Calculation Log History */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-[#00B4FF]" />
          <h2 className="text-lg font-bold">계산 로그 이력</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F0F9FF] border-b border-blue-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold">계산 실행 일시</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">실행자</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">공급망 버전</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">M-BOM 버전</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">재계산 여부</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">비고</th>
              </tr>
            </thead>
            <tbody>
              {mockCalculationLogs.map((log, idx) => (
                <tr key={log.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 text-sm font-mono">{log.executedAt}</td>
                  <td className="px-4 py-3 text-sm">{log.executor}</td>
                  <td className="px-4 py-3 text-sm text-blue-600">{log.supplyChainVersion}</td>
                  <td className="px-4 py-3 text-sm text-blue-600">{log.mbomVersion}</td>
                  <td className="px-4 py-3 text-xs">
                    {log.isRecalculation ? (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium">재계산</span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium">최초</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{log.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
