'use client';

import { useState, useRef } from 'react';
import {
  Play,
  Save,
  FolderOpen,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  BarChart3,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Zap,
  Leaf,
  Scale,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import ExportReportModal from './ExportReportModal';

interface SimulationResult {
  totalCostChange: {
    current: number;
    simulated: number;
    changePercent: number;
  };
  unitCostChange: {
    current: number;
    simulated: number;
    changePercent: number;
  };
  pcfChange: {
    current: number;
    simulated: number;
    changePercent: number;
  };
  affectedSuppliers: number;
}

interface RecommendedScenario {
  name: string;
  type: 'cost' | 'carbon' | 'balanced';
  totalCost: number;
  pcf: number;
  risk: number;
  /** 대체 공급처 */
  alternativeSupplier: string;
  /** 핵심 변경 */
  keyChange: string;
  /** 선정 기준 */
  selectionCriteria: string;
  /** 핵심 변화 요약 (1~2줄) */
  summary: string;
  /** 이 옵션을 추천한 이유 */
  reason: string;
  icon: typeof Zap;
}

type ExecutionStep =
  | '시나리오 적용 중'
  | '대체 공급처 탐색 중'
  | '비용 계산 중'
  | 'PCF 계산 중'
  | '추천안 생성 중';

export default function Simulation() {
  // 분석 대상 상태
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedDetailProduct, setSelectedDetailProduct] = useState('');

  // 시나리오 선택 (카드 기반)
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

  // 시나리오별 파라미터
  const [excludedSupplier, setExcludedSupplier] = useState('');
  const [disruptionLevel, setDisruptionLevel] = useState<'일시' | '완전'>('일시');
  const [autoSearchAlternative, setAutoSearchAlternative] = useState(true);
  const [materialPriceChange, setMaterialPriceChange] = useState(15);
  const [selectedMaterial, setSelectedMaterial] = useState('리튬');
  const [productionVolumeChange, setProductionVolumeChange] = useState(20);

  // UI 상태
  const [hasSimulated, setHasSimulated] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [executionStep, setExecutionStep] = useState<ExecutionStep | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // AI 분석 질문 (query-to-scenario)
  const [aiQuery, setAiQuery] = useState('');
  const [aiParseFeedback, setAiParseFeedback] = useState<string | null>(null);
  const [leftPanelHighlight, setLeftPanelHighlight] = useState(false);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // Mock 데이터
  const customers = ['BMW', 'Mercedes', 'Tesla', 'Hyundai'];
  const projects = ['Battery Module A', 'Battery Pack B', 'Display Panel C'];
  const products = ['Model X Battery', 'Model Y Battery', 'Standard Cell'];
  const detailProducts = ['Cell Type A-1', 'Cell Type A-2', 'Cell Type B-1', 'Module X-100', 'Module X-200'];
  const suppliers = ['협력사 A', '한국배터리', '셀테크', 'BMS Solutions', '리튬광산'];
  const materials = ['리튬', '코발트', '니켈', '망간'];

  // 시나리오 카드 데이터
  const scenarioCards = [
    {
      id: '협력사 공급 중단',
      title: '협력사 공급 중단',
      description: '특정 공급처가 중단될 경우 영향 분석',
      icon: AlertTriangle,
      color: 'from-red-500 to-orange-500',
    },
    {
      id: '원자재 가격 상승',
      title: '원자재 가격 상승',
      description: '원자재 시장 가격 변동 시 원가 영향',
      icon: TrendingUp,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: '생산량 증가',
      title: '생산량 증가',
      description: '생산 규모 확대에 따른 공급망 영향',
      icon: BarChart3,
      color: 'from-purple-500 to-pink-500',
    },
  ];

  const handleSimulation = () => {
    if (!isAnalysisTargetComplete || !selectedScenario) {
      toast.error('분석 대상과 시나리오를 선택해주세요');
      return;
    }

    setIsSimulating(true);
    setExecutionStep('시나리오 적용 중');

    const steps: ExecutionStep[] = excludedSupplier
      ? ['시나리오 적용 중', '대체 공급처 탐색 중', '비용 계산 중', 'PCF 계산 중', '추천안 생성 중']
      : ['시나리오 적용 중', '비용 계산 중', 'PCF 계산 중', '추천안 생성 중'];
    const intervals = excludedSupplier ? [400, 800, 1200, 1600] : [500, 1000, 1500];
    let stepIndex = 0;
    const timeouts = intervals.map((ms) =>
      setTimeout(() => {
        stepIndex += 1;
        if (stepIndex < steps.length) setExecutionStep(steps[stepIndex]);
      }, ms)
    );

    setTimeout(() => {
      timeouts.forEach((id) => clearTimeout(id));
      const mockResult: SimulationResult = {
        totalCostChange: {
          current: 125000000,
          simulated: 125000000 * (1 + materialPriceChange / 100 + productionVolumeChange / 100),
          changePercent: materialPriceChange + productionVolumeChange,
        },
        unitCostChange: {
          current: 12500,
          simulated: 12500 * (1 + materialPriceChange / 100),
          changePercent: materialPriceChange,
        },
        pcfChange: {
          current: 52.4,
          simulated: 52.4 * (1 - 0.04),
          changePercent: -4.0,
        },
        affectedSuppliers: excludedSupplier ? 3 : 1,
      };

      setSimulationResult(mockResult);
      setHasSimulated(true);
      setIsSimulating(false);
      setExecutionStep(null);
      toast.success('시나리오 분석이 완료되었습니다');
    }, 2000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      maximumFractionDigits: 1,
    }).format(value);
  };

  // 추천 시나리오 데이터
  const recommendedScenarios: RecommendedScenario[] = [
    {
      name: '저비용안',
      type: 'cost',
      totalCost: 121500000,
      pcf: 53.1,
      risk: 46,
      alternativeSupplier: 'Supplier B',
      keyChange: 'Tier2 양극재 공급처 변경',
      selectionCriteria: '비용 최소',
      summary: '저가 공급처로 변경하여 비용 감소, 단 PCF는 소폭 증가',
      reason: '비용 절감을 최우선으로 할 때 선택하는 안입니다. Tier2 공급처 전환으로 총 원가를 낮췄습니다.',
      icon: Zap,
    },
    {
      name: '저탄소안',
      type: 'carbon',
      totalCost: 127500000,
      pcf: 48.0,
      risk: 47,
      alternativeSupplier: 'Supplier C',
      keyChange: 'Tier1 운송 방식 및 친환경 공급처 선정',
      selectionCriteria: 'PCF 최소',
      summary: '친환경 공급처 선정으로 PCF 감소, 비용은 다소 상승',
      reason: '탄소 배출 감소를 최우선으로 할 때 선택하는 안입니다. PCF를 크게 낮출 수 있습니다.',
      icon: Leaf,
    },
    {
      name: '균형안',
      type: 'balanced',
      totalCost: 124000000,
      pcf: 49.8,
      risk: 44,
      alternativeSupplier: 'Supplier D',
      keyChange: 'Tier2 공급처 및 운송 경로 변경',
      selectionCriteria: '균형 점수 우수',
      summary: '비용·PCF·리스크의 균형을 맞춘 대안',
      reason: '비용, 탄소, 리스크를 종합했을 때 가장 균형이 좋아 AI가 추천하는 옵션입니다.',
      icon: Scale,
    },
  ];

  // AI 쿼리 파싱 → 좌측 시나리오 설정 자동 채우기
  const isAnalysisTargetComplete =
    !!selectedCustomer && !!selectedProject && !!selectedProduct && !!selectedDetailProduct;

  const handleAiParse = () => {
    if (!isAnalysisTargetComplete) {
      toast.error('분석 대상을 먼저 선택해주세요');
      return;
    }
    const q = aiQuery.trim();
    if (!q) {
      toast.error('분석 질문을 입력해주세요');
      return;
    }
    setAiParseFeedback(null);

    const lower = q.toLowerCase();
    let matched = false;
    let feedback = '';

    // 협력사 공급 중단 패턴
    if (
      /협력사|공급\s*중단|공급처\s*중단|중단되면/.test(q) ||
      /supplier|supply\s*disrupt/i.test(q)
    ) {
      setSelectedScenario('협력사 공급 중단');
      const supplierMatch = q.match(/협력사\s*([가-힣A-Za-z0-9\s]+?)(?:가|이|의|에|은|는|에서)|([가-힣A-Za-z]+)\s*(?:가|이)\s*공급\s*중단/);
      const found = suppliers.find((s) => q.includes(s));
      if (found) {
        setExcludedSupplier(found);
        feedback = `${found} 협력사 공급 중단 시나리오로 자동 설정되었습니다.`;
      } else if (supplierMatch) {
        const name = (supplierMatch[1] || supplierMatch[2] || '').trim();
        const matchSupplier = suppliers.find((s) => s.includes(name) || name.includes(s)) || (name === 'A' ? '협력사 A' : suppliers[0]);
        setExcludedSupplier(matchSupplier);
        feedback = `협력사 공급 중단 시나리오로 자동 설정되었습니다. (협력사: ${matchSupplier})`;
      } else {
        setExcludedSupplier(suppliers[0]);
        feedback = '협력사 공급 중단 시나리오로 자동 설정되었습니다.';
      }
      matched = true;
    }

    // 원자재 가격 변동 패턴
    if (!matched && (/원자재|가격|리튬|코발트|니켈|망간|원가/.test(q) || /가격\s*(상승|인상|변동)|가격\s*\d+%/.test(q))) {
      setSelectedScenario('원자재 가격 상승');
      const materials = ['리튬', '코발트', '니켈', '망간'];
      const mat = materials.find((m) => q.includes(m));
      if (mat) setSelectedMaterial(mat);
      const pctMatch = q.match(/(\d+)\s*%|(\d+)\s*퍼센트/);
      if (pctMatch) {
        const val = parseInt(pctMatch[1] || pctMatch[2], 10);
        setMaterialPriceChange(Math.min(200, Math.max(-50, val)));
        feedback = `원자재 가격 상승 시나리오로 자동 설정되었습니다. (가격 변동률: ${val}%)`;
      } else {
        feedback = '원자재 가격 상승 시나리오로 자동 설정되었습니다.';
      }
      matched = true;
    }

    // 생산량 증가 패턴
    if (!matched && (/생산량|생산\s*규모|증가/.test(q) || /생산량\s*\d+%|\d+\s*%\s*증가/.test(q))) {
      setSelectedScenario('생산량 증가');
      const pctMatch = q.match(/(\d+)\s*%|(\d+)\s*퍼센트/);
      if (pctMatch) {
        const val = parseInt(pctMatch[1] || pctMatch[2], 10);
        setProductionVolumeChange(Math.min(200, Math.max(0, val)));
        feedback = `생산량 증가 시나리오로 자동 설정되었습니다. (생산량: +${val}%)`;
      } else {
        feedback = '생산량 증가 시나리오로 자동 설정되었습니다.';
      }
      matched = true;
    }

    if (!matched) {
      toast.info('질문을 파악하지 못했습니다. 시나리오를 직접 선택해주세요.');
      setAiParseFeedback('입력 내용을 시나리오로 변환할 수 없습니다. 좌측에서 직접 설정해주세요.');
      return;
    }

    setAiParseFeedback(feedback);
    setLeftPanelHighlight(true);
    leftPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => setLeftPanelHighlight(false), 2500);
    toast.success('시나리오 조건이 자동 설정되었습니다');
  };

  const handleAiQueryReset = () => {
    setAiQuery('');
    setAiParseFeedback(null);
    setLeftPanelHighlight(false);
  };

  // KPI 위 인사이트 요약 문구 (시나리오/결과 기반)
  const insightSummaryText = excludedSupplier
    ? `협력사 공급 중단으로 인해 Tier1 공급망에 병목이 발생했으며, 총 비용이 크게 증가했습니다. ${autoSearchAlternative ? '대체 공급처 탐색을 통해 일부 회복이 가능합니다.' : ''}`
    : selectedScenario === '원자재 가격 상승'
    ? `원자재 가격 변동으로 제품당 원가와 총 원가에 영향을 주었습니다. 공급망 리스크는 현재 수준을 유지합니다.`
    : selectedScenario === '생산량 증가'
    ? `생산량 증가 시나리오에 따라 규모의 경제 효과와 함께 원가 구조가 달라졌습니다.`
    : `현재 시나리오에 따른 영향 요약입니다. 아래 추천 시나리오와 비교해 의사결정에 참고하세요.`;

  return (
    <div className="space-y-6">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">시뮬레이션</h1>
          <p className="text-gray-600">
            AI가 시나리오 영향을 분석하고 대안을 추천하는 공급망 의사결정 지원 도구입니다.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            onClick={() => toast.info('시나리오 저장 기능')}
          >
            <Save size={18} />
            저장
          </button>
          <button
            className="px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            onClick={() => toast.info('시나리오 불러오기 기능')}
          >
            <FolderOpen size={18} />
            불러오기
          </button>
          <button
            className="px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            onClick={() => setShowExportModal(true)}
          >
            <Download size={18} />
            보고서 내보내기
          </button>
        </div>
      </div>

      {/* 단계별 진행 표시: 1 → 2 → 3 */}
      <div className="flex items-center justify-center gap-2 py-4 px-4 bg-white rounded-xl border border-gray-200">
        <span
          className={`font-semibold text-sm px-4 py-2 rounded-lg transition-all ${
            !isAnalysisTargetComplete
              ? 'bg-[#5B3BFA] text-white ring-2 ring-[#5B3BFA] ring-offset-2'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          1. 분석 대상 선택
        </span>
        <span className="text-gray-400">→</span>
        <span
          className={`font-semibold text-sm px-4 py-2 rounded-lg transition-all ${
            isAnalysisTargetComplete && !hasSimulated
              ? 'bg-[#5B3BFA] text-white ring-2 ring-[#5B3BFA] ring-offset-2'
              : hasSimulated
              ? 'bg-gray-100 text-gray-700'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          2. 시나리오 설정
        </span>
        <span className="text-gray-400">→</span>
        <span
          className={`font-semibold text-sm px-4 py-2 rounded-lg transition-all ${
            hasSimulated ? 'bg-[#5B3BFA] text-white ring-2 ring-[#5B3BFA] ring-offset-2' : 'bg-gray-100 text-gray-400'
          }`}
        >
          3. 결과 확인
        </span>
      </div>

      {/* 메인 레이아웃: 좌측 고정폭(좁게) / 우측 나머지, 우측은 스크롤 가능 */}
      <div className="grid grid-cols-[minmax(260px,320px)_1fr] gap-6 items-stretch min-h-0">
        {/* 1️⃣ 좌측 패널: 시나리오 설정 (좁은 폭으로 효율적) */}
        <div
          ref={leftPanelRef}
          className={`bg-white p-5 sticky top-6 self-start max-h-[calc(100vh-140px)] overflow-y-auto overflow-x-hidden shrink-0 w-full max-w-[320px] min-w-0 transition-all duration-500 ${
            leftPanelHighlight ? 'ring-4 ring-[#5B3BFA] ring-offset-2 shadow-lg' : ''
          }`}
          style={{
            borderRadius: '20px',
            boxShadow: leftPanelHighlight ? '0px 8px 24px rgba(91, 59, 250, 0.2)' : '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <h2 className="text-lg font-bold text-gray-900 mb-6">시나리오 설정</h2>

          {/* STEP 1: 분석 대상 선택 */}
          <div
            className="mb-6 p-4 rounded-xl border-2 bg-gradient-to-br from-[#F5F3FF] to-white transition-all"
            style={{ borderColor: isAnalysisTargetComplete ? '#E0E7FF' : '#5B3BFA' }}
          >
            <h3 className="text-sm font-bold text-[#5B3BFA] mb-1">STEP 1. 분석 대상 선택</h3>
            <p className="text-xs text-gray-500 mb-3">먼저 분석할 공급망을 선택하세요</p>
            <div className="space-y-2.5">
              <div>
                <label className="sr-only">고객사</label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                >
                  <option value="">고객사 선택</option>
                  {customers.map((customer) => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sr-only">프로젝트</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                >
                  <option value="">프로젝트 선택</option>
                  {projects.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sr-only">제품</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    setSelectedDetailProduct('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                >
                  <option value="">제품 선택</option>
                  {products.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sr-only">세부제품</label>
                <select
                  value={selectedDetailProduct}
                  onChange={(e) => setSelectedDetailProduct(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                >
                  <option value="">세부제품 선택</option>
                  {detailProducts.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* STEP 2: 시나리오 설정 (분석 질문 + 시나리오 선택) */}
          <div
            className={`mb-6 border-t border-gray-200 pt-6 transition-opacity duration-300 ${
              !isAnalysisTargetComplete ? 'opacity-60 pointer-events-none' : 'opacity-100'
            }`}
          >
            <h3 className="text-sm font-bold text-[#5B3BFA] mb-1">STEP 2. 시나리오 설정</h3>
            <p className="text-xs text-gray-500 mb-4">
              자연어 질문 입력 또는 시나리오 카드를 선택하세요
            </p>

            {/* 분석 질문 (STEP 2 내) */}
            <div
              className="mb-5 p-4 rounded-xl border border-[#E0E7FF] bg-white/80 min-w-0 overflow-hidden"
              style={{ background: isAnalysisTargetComplete ? 'linear-gradient(135deg, #FAFAFF 0%, #F5F3FF 100%)' : undefined }}
            >
              <p className="text-xs font-semibold text-gray-700 mb-3">분석 질문</p>
              <div className="space-y-2 mb-2">
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => {
                    setAiQuery(e.target.value);
                    setAiParseFeedback(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && isAnalysisTargetComplete && handleAiParse()}
                  placeholder={
                    isAnalysisTargetComplete
                      ? '예: 협력사 A가 공급 중단되면 어떻게 돼?'
                      : '분석 대상을 먼저 선택해주세요.'
                  }
                  className={`w-full min-w-0 px-4 py-3 text-sm border-2 rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
                    isAnalysisTargetComplete
                      ? 'border-[#C4B5FD] focus:ring-[#5B3BFA] focus:border-[#5B3BFA] bg-white placeholder:text-gray-400'
                      : 'border-gray-300 bg-gray-50 placeholder:text-amber-600 cursor-not-allowed'
                  }`}
                  disabled={!isAnalysisTargetComplete}
                  title={isAnalysisTargetComplete ? undefined : '분석 대상을 먼저 선택해야 합니다.'}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAiParse}
                    disabled={!isAnalysisTargetComplete}
                    className={`flex-1 min-w-0 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      isAnalysisTargetComplete
                        ? 'text-white shadow-md hover:shadow-lg'
                        : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                    }`}
                    style={
                      isAnalysisTargetComplete
                        ? { background: 'linear-gradient(135deg, #5B3BFA 0%, #7C3AED 100%)' }
                        : undefined
                    }
                    title={isAnalysisTargetComplete ? undefined : '분석 대상을 먼저 선택해야 합니다.'}
                  >
                    <Sparkles size={14} />
                    AI로 조건 설정
                  </button>
                  <button
                    onClick={handleAiQueryReset}
                    className="px-3 py-2.5 text-xs border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors shrink-0"
                  >
                    초기화
                  </button>
                </div>
              </div>
              <div className="min-h-[18px]">
                {isAnalysisTargetComplete ? (
                  <p className="text-[11px] text-gray-600">
                    현재 분석 대상: {selectedCustomer} / {selectedProject} / {selectedProduct} / {selectedDetailProduct}
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-600 font-medium">분석 대상을 먼저 선택해주세요.</p>
                )}
              </div>
              {aiParseFeedback && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-[#5B3BFA]/10 border border-[#5B3BFA]/20 text-xs font-medium text-[#5B3BFA]">
                  ✓ {aiParseFeedback}
                </div>
              )}
            </div>

            {/* 시나리오 선택 (큰 카드) */}
            <h4 className="text-xs font-semibold text-gray-700 mb-3">시나리오 선택</h4>
            <div className="space-y-3">
              {scenarioCards.map((card) => {
                const Icon = card.icon;
                const isSelected = selectedScenario === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelectedScenario(card.id)}
                    className={`w-full min-w-0 text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-[#5B3BFA] bg-[#EDE9FE] shadow-lg ring-2 ring-[#5B3BFA] ring-offset-2'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center flex-shrink-0 shadow-md`}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h4 className={`font-semibold text-gray-900 ${isSelected ? 'text-base' : 'text-sm'}`}>
                            {card.title}
                          </h4>
                          {isSelected && (
                            <CheckCircle2 className="w-6 h-6 text-[#5B3BFA] flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">{card.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: 시나리오 조건 (동적) */}
          {selectedScenario && (
            <div className="mb-6 border-t border-gray-200 pt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">시나리오 조건</h3>
              <div className="space-y-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
                {selectedScenario === '협력사 공급 중단' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium mb-2 text-gray-600">협력사 선택</label>
                      <select
                        value={excludedSupplier}
                        onChange={(e) => setExcludedSupplier(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                      >
                        <option value="">선택하세요</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier} value={supplier}>
                            {supplier}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-2 text-gray-600">중단 수준</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDisruptionLevel('일시')}
                          className={`text-xs px-3 py-2 rounded-lg border font-medium ${
                            disruptionLevel === '일시'
                              ? 'border-[#5B3BFA] bg-[#F3F1FF] text-[#312e81]'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          일시 중단
                        </button>
                        <button
                          type="button"
                          onClick={() => setDisruptionLevel('완전')}
                          className={`text-xs px-3 py-2 rounded-lg border font-medium ${
                            disruptionLevel === '완전'
                              ? 'border-[#5B3BFA] bg-[#F3F1FF] text-[#312e81]'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          완전 중단
                        </button>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSearchAlternative}
                        onChange={(e) => setAutoSearchAlternative(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-[#5B3BFA] focus:ring-[#5B3BFA]"
                      />
                      대체 공급처 자동 탐색
                    </label>
                  </>
                )}

                {selectedScenario === '원자재 가격 상승' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium mb-2 text-gray-600">원자재 선택</label>
                      <select
                        value={selectedMaterial}
                        onChange={(e) => setSelectedMaterial(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                      >
                        {materials.map((material) => (
                          <option key={material} value={material}>
                            {material}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-2 text-gray-600">
                        가격 변동률: <span className="font-bold text-[#5B3BFA]">{materialPriceChange}%</span>
                      </label>
                      <input
                        type="range"
                        min="-50"
                        max="200"
                        value={materialPriceChange}
                        onChange={(e) => setMaterialPriceChange(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#5B3BFA]"
                      />
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span>-50%</span>
                        <span>+200%</span>
                      </div>
                    </div>
                  </>
                )}

                {selectedScenario === '생산량 증가' && (
                  <div>
                    <label className="block text-xs font-medium mb-2 text-gray-600">
                      생산량 증가: <span className="font-bold text-[#5B3BFA]">{productionVolumeChange}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={productionVolumeChange}
                      onChange={(e) => setProductionVolumeChange(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#5B3BFA]"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>0%</span>
                      <span>+200%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: 분석 실행 */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs font-bold text-[#5B3BFA] mb-2">STEP 3. 분석 실행</p>
            <button
              onClick={handleSimulation}
              disabled={isSimulating || !selectedScenario || !isAnalysisTargetComplete}
              className="w-full px-6 py-4 text-base text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              style={{
                background:
                  isSimulating || !selectedScenario || !isAnalysisTargetComplete
                    ? '#9CA3AF'
                    : 'linear-gradient(135deg, #5B3BFA 0%, #00B4FF 100%)',
              }}
          >
              <Play size={20} />
              {isSimulating ? '분석 실행 중...' : '시나리오 분석 실행'}
            </button>
          </div>
        </div>

        {/* 2️⃣ 우측 영역: 결과 중심 (65%), 스크롤로 한눈에 탐색 */}
        <div className="min-h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] overflow-y-auto overflow-x-hidden pr-2 space-y-6">
          {/* 실행 중: 단계별 상태 표시 */}
          {isSimulating && executionStep && (
            <div
              className="bg-white p-12 border-2 border-[#5B3BFA] rounded-2xl shadow-lg"
              style={{ boxShadow: '0px 8px 24px rgba(91, 59, 250, 0.15)' }}
            >
              <div className="max-w-md mx-auto text-center">
                <Loader2 className="w-14 h-14 text-[#5B3BFA] animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">시나리오 분석 실행 중</h3>
                <p className="text-[#5B3BFA] font-semibold text-base">{executionStep}</p>
                <p className="text-gray-500 text-sm mt-2">잠시만 기다려주세요.</p>
              </div>
            </div>
          )}

          {/* 아직 실행 전이면 안내 (단계별 메시지) */}
          {!hasSimulated && !isSimulating && (
            <div
              className={`p-20 text-center border-2 rounded-2xl transition-all duration-300 ${
                !isAnalysisTargetComplete
                  ? 'bg-amber-50/80 border-amber-200'
                  : 'bg-gradient-to-br from-gray-50 to-white border-dashed border-gray-300'
              }`}
            >
              <div className="max-w-lg mx-auto">
                {!isAnalysisTargetComplete ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-amber-600">1</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">먼저 분석 대상을 선택해주세요</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      좌측 패널에서 고객사, 프로젝트, 제품, 세부제품을 선택한 후
                      <br />
                      시나리오 설정과 분석을 진행할 수 있습니다.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5B3BFA] to-[#00B4FF] flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-white">2</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">이제 시나리오를 설정하거나 질문을 입력하세요</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      자연어로 질문하거나 시나리오 카드를 선택한 후
                      <br />
                      시나리오 분석 실행 버튼을 눌러주세요.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 분석 결과 영역 */}
          {hasSimulated && simulationResult && (
            <>
              {/* SECTION A: 인사이트 요약 + 영향 요약 (KPI 카드) */}
              <section
                className="bg-white p-6"
                style={{
                  borderRadius: '20px',
                  boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
                }}
              >
                <h2 className="text-lg font-bold text-gray-900 mb-4">영향 요약</h2>
                <div className="mb-5 p-4 bg-gradient-to-r from-[#F5F3FF] to-[#EEF2FF] rounded-xl border border-[#E0E7FF]">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {insightSummaryText}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {/* 총 원가 변화: 기준값 → 변경값 */}
                  <div className="border-2 border-gray-100 rounded-2xl p-5 bg-gradient-to-b from-white to-gray-50 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-600">총 원가 변화</span>
                      <DollarSign className="w-5 h-5 text-[#5B3BFA]" />
                    </div>
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      {formatCurrency(simulationResult.totalCostChange.current)} → {formatCurrency(simulationResult.totalCostChange.simulated)}
                    </div>
                    <div
                      className={`flex items-center gap-1.5 text-sm font-bold ${
                        simulationResult.totalCostChange.changePercent > 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {simulationResult.totalCostChange.changePercent > 0 ? (
                        <TrendingUp size={18} />
                      ) : (
                        <TrendingDown size={18} />
                      )}
                      {formatNumber(Math.abs(simulationResult.totalCostChange.changePercent))}%
                    </div>
                  </div>

                  {/* 제품당 원가 변화: 기준값 → 변경값 */}
                  <div className="border-2 border-gray-100 rounded-2xl p-5 bg-gradient-to-b from-white to-gray-50 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-600">제품당 원가 변화</span>
                      <BarChart3 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      {formatCurrency(simulationResult.unitCostChange.current)} → {formatCurrency(simulationResult.unitCostChange.simulated)}
                    </div>
                    <div
                      className={`flex items-center gap-1.5 text-sm font-bold ${
                        simulationResult.unitCostChange.changePercent > 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {simulationResult.unitCostChange.changePercent > 0 ? (
                        <TrendingUp size={18} />
                      ) : (
                        <TrendingDown size={18} />
                      )}
                      {formatNumber(Math.abs(simulationResult.unitCostChange.changePercent))}%
                    </div>
                  </div>

                  {/* 제품 PCF 변화: 기준값 → 변경값 */}
                  <div className="border-2 border-gray-100 rounded-2xl p-5 bg-gradient-to-b from-white to-gray-50 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-600">제품 PCF 변화</span>
                      <Leaf className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      {formatNumber(simulationResult.pcfChange.current)} → {formatNumber(simulationResult.pcfChange.simulated)} kgCO₂e
                    </div>
                    <div
                      className={`flex items-center gap-1.5 text-sm font-bold ${
                        simulationResult.pcfChange.changePercent > 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {simulationResult.pcfChange.changePercent > 0 ? (
                        <TrendingUp size={18} />
                      ) : (
                        <TrendingDown size={18} />
                      )}
                      {formatNumber(Math.abs(simulationResult.pcfChange.changePercent))}%
                    </div>
                  </div>

                  {/* 영향 공급처 수: 기준값 → 변경값 */}
                  <div className="border-2 border-gray-100 rounded-2xl p-5 bg-gradient-to-b from-white to-gray-50 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-600">영향 공급처 수</span>
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      기준 0개 → {simulationResult.affectedSuppliers}개
                    </div>
                    <div className="text-xs text-gray-500 font-medium">전체 공급망 중 {simulationResult.affectedSuppliers}/12</div>
                  </div>
                </div>
              </section>

              {/* SECTION B: 공급망 영향 시각화 */}
              <section
                className="bg-white p-6"
                style={{
                  borderRadius: '20px',
                  boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
                }}
              >
                <h2 className="text-lg font-bold text-gray-900 mb-5">공급망 영향 시각화</h2>
                <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 p-10 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-center gap-12">
                    {/* Tier 1: 중단=빨강, 영향=노랑, 정상=초록 */}
                    <div className="text-center">
                      <div
                        className={`w-32 h-32 rounded-full flex items-center justify-center mb-3 shadow-xl transition-all ${
                          excludedSupplier
                            ? 'bg-red-500 ring-4 ring-red-300'
                            : 'bg-green-500 ring-4 ring-green-200'
                        }`}
                      >
                        <div className="text-white text-center">
                          <div className="text-xs font-semibold mb-1 opacity-90">Tier 1</div>
                          <div className="text-2xl font-bold">4개</div>
                        </div>
                      </div>
                      <div
                        className={`text-sm font-bold px-3 py-1.5 rounded-full ${
                          excludedSupplier
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {excludedSupplier ? '중단' : '정상'}
                      </div>
                    </div>

                    <ArrowRight className="w-8 h-8 text-gray-400" />

                    {/* Tier 2: Tier1 중단 시 영향(노랑), 아니면 정상(초록) */}
                    <div className="text-center">
                      <div
                        className={`w-32 h-32 rounded-full flex items-center justify-center mb-3 shadow-xl transition-all ${
                          excludedSupplier ? 'bg-amber-400 ring-4 ring-amber-200' : 'bg-green-500 ring-4 ring-green-200'
                        }`}
                      >
                        <div className="text-white text-center">
                          <div className="text-xs font-semibold mb-1 opacity-90">Tier 2</div>
                          <div className="text-2xl font-bold">12개</div>
                        </div>
                      </div>
                      <div
                        className={`text-sm font-bold px-3 py-1.5 rounded-full ${
                          excludedSupplier ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {excludedSupplier ? '영향' : '정상'}
                      </div>
                    </div>

                    <ArrowRight className="w-8 h-8 text-gray-400" />

                    {/* Tier 3: 정상 */}
                    <div className="text-center">
                      <div className="w-32 h-32 rounded-full bg-green-500 ring-4 ring-green-200 flex items-center justify-center mb-3 shadow-xl">
                        <div className="text-white text-center">
                          <div className="text-xs font-semibold mb-1 opacity-90">Tier 3</div>
                          <div className="text-2xl font-bold">28개</div>
                        </div>
                      </div>
                      <div className="text-sm font-bold px-3 py-1.5 rounded-full bg-green-100 text-green-700">
                        정상
                      </div>
                    </div>
                  </div>

                  {excludedSupplier && (
                    <div className="mt-8 p-5 bg-red-50 border-2 border-red-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-bold text-red-900 mb-1">공급 중단 감지</div>
                          <div className="text-xs text-red-800 leading-relaxed">
                            <span className="font-bold">{excludedSupplier}</span>의 공급이 중단되어 Tier 1 공급망에
                            영향이 발생했습니다.
                            {autoSearchAlternative && ' 대체 공급처 자동 탐색이 활성화되어 있습니다.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* SECTION C: 추천 시나리오 (가장 중요, 시각적으로 강조) */}
              <section
                className="bg-gradient-to-br from-[#5B3BFA] to-[#00B4FF] p-8"
                style={{
                  borderRadius: '20px',
                  boxShadow: '0px 8px 24px rgba(91, 59, 250, 0.25)',
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <Sparkles className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-bold text-white">AI 추천 시나리오</h2>
                </div>
                <div className="grid grid-cols-3 gap-5">
                  {recommendedScenarios.map((scenario) => {
                    const Icon = scenario.icon;
                    return (
                      <div
                        key={scenario.name}
                        className="bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              scenario.type === 'cost'
                                ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                                : scenario.type === 'carbon'
                                ? 'bg-gradient-to-br from-green-400 to-emerald-600'
                                : 'bg-gradient-to-br from-purple-400 to-pink-500'
                            }`}
                          >
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{scenario.name}</h3>
                            {scenario.type === 'balanced' && (
                              <span className="text-xs font-bold text-purple-600">★ 추천</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">총 비용</span>
                            <span className="font-bold text-gray-900">{formatCurrency(scenario.totalCost)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">PCF</span>
                            <span className="font-bold text-gray-900">{scenario.pcf} kgCO₂e</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">리스크</span>
                            <span className="font-bold text-gray-900">{scenario.risk}점</span>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-gray-200 space-y-3">
                          <div>
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">대체 공급처</p>
                            <p className="text-sm font-medium text-gray-900">{scenario.alternativeSupplier}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">핵심 변경</p>
                            <p className="text-sm text-gray-800 leading-relaxed">{scenario.keyChange}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">선정 기준</p>
                            <p className="text-sm font-medium text-[#5B3BFA]">{scenario.selectionCriteria}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">핵심 변화 요약</p>
                            <p className="text-xs text-gray-700 leading-relaxed">{scenario.summary}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">이 옵션을 추천한 이유</p>
                            <p className="text-xs text-gray-600 leading-relaxed">{scenario.reason}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* SECTION D: 시나리오 비교 테이블 */}
              <section
                className="bg-white p-6"
                style={{
                  borderRadius: '20px',
                  boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
                }}
              >
                <h2 className="text-lg font-bold text-gray-900 mb-5">시나리오 비교</h2>
                <div className="overflow-hidden rounded-xl border-2 border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-left font-bold text-gray-800">시나리오</th>
                        <th className="px-6 py-4 text-right font-bold text-gray-800">총 비용</th>
                        <th className="px-6 py-4 text-right font-bold text-gray-800">제품 PCF</th>
                        <th className="px-6 py-4 text-right font-bold text-gray-800">리스크</th>
                        <th className="px-6 py-4 text-right font-bold text-gray-800">리드타임</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {[
                        {
                          name: '기준 공급망',
                          cost: formatCurrency(simulationResult.totalCostChange.current),
                          pcf: `${formatNumber(simulationResult.pcfChange.current)} kgCO₂e`,
                          risk: '45점',
                          leadTime: '32일',
                          isBaseline: true,
                          isActive: false,
                          isRecommended: false,
                        },
                        {
                          name: '실행 시나리오',
                          cost: formatCurrency(simulationResult.totalCostChange.simulated),
                          pcf: `${formatNumber(simulationResult.pcfChange.simulated)} kgCO₂e`,
                          risk: `${simulationResult.affectedSuppliers > 1 ? '65' : '42'}점`,
                          leadTime: '34.5일',
                          isBaseline: false,
                          isActive: true,
                          isRecommended: false,
                        },
                        ...recommendedScenarios.map((s) => ({
                          name: s.name,
                          cost: formatCurrency(s.totalCost),
                          pcf: `${s.pcf} kgCO₂e`,
                          risk: `${s.risk}점`,
                          leadTime: '33일',
                          isBaseline: false,
                          isActive: false,
                          isRecommended: s.type === 'balanced',
                        })),
                      ].map((row) => (
                        <tr
                          key={row.name}
                          className={`transition-colors ${
                            row.isActive
                              ? 'bg-purple-50'
                              : row.isRecommended
                              ? 'bg-emerald-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-6 py-4 text-left">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">{row.name}</span>
                              {row.isRecommended && (
                                <span className="px-2 py-1 text-[10px] font-bold bg-purple-100 text-purple-700 rounded">
                                  추천
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-gray-800">{row.cost}</td>
                          <td className="px-6 py-4 text-right font-semibold text-gray-800">{row.pcf}</td>
                          <td className="px-6 py-4 text-right font-semibold text-gray-800">{row.risk}</td>
                          <td className="px-6 py-4 text-right font-semibold text-gray-800">{row.leadTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportReportModal
          onClose={() => setShowExportModal(false)}
          onExport={(options) => {
            toast.success(
              options.format === 'excel'
                ? '시뮬레이션 Excel 보고서를 준비합니다'
                : '시뮬레이션 PDF 보고서를 준비합니다'
            );
            setShowExportModal(false);
          }}
        />
      )}
    </div>
  );
}
