'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Filter, Folder } from 'lucide-react';
import { toast } from 'sonner';
import MonthPicker from '@/app/components/MonthPicker';
import { Badge } from '@/app/components/ui/badge';
import { useMode } from '@/app/context/ModeContext';
import { apiFetch, restoreOprSessionFromCookie } from '@/lib/api/client';
import { API_PREFIX } from '@/lib/api/paths';
import { getOprAccessToken } from '@/lib/api/sessionAccessToken';
import { getOprBomPeriod, getOprTier0RowContext } from '@/lib/api/dataMgmtOpr';
import { mapWithConcurrency } from '@/lib/asyncPool';

type ScaffoldVariantRow = {
  customerId: number;
  customerName: string;
  branchId: number;
  branchName: string;
  projectId: number;
  projectStartIso: string;
  projectEndIso: string;
  productId: number;
  productName: string;
  variantId: number;
  variantName: string;
  variantCode: string | null;
};

type AnomalyEvaluateResponse = {
  anomaly_id: number;
  workplace_name_norm: string;
  rule_evaluations: Array<{
    id: number;
    rule_code: string;
    rule_group: string;
    is_hit: boolean;
    score_contribution?: number | null;
    observed_value?: number | null;
    threshold_value?: number | null;
    evidence_json?: Record<string, unknown> | null;
  }>;
  rule_score: number;
  score_physical: number;
  score_timeseries: number;
  score_relation: number;
  final_score: number;
  final_threshold: number;
  final_status: string;
  anomaly_reason: string | null;
  scoring_version: string;
  /** artifacts/dladapter/tabular_mlp.pt 추론(있을 때) */
  ml_dladapter_loaded?: boolean;
  ml_dladapter_prediction?: string | null;
  ml_dladapter_anomaly_probability?: number | null;
  /** artifacts/FT-transformer/ft_transformer_trained.pt 추론(있을 때) */
  ml_ft_transformer_loaded?: boolean;
  ml_ft_transformer_prediction?: string | null;
  ml_ft_transformer_anomaly_probability?: number | null;
  relation_model_status?: string | null;
};

type AnomalyNarrativeResponse = {
  anomaly_id: number;
  narrative: string;
  embedding_present: boolean;
  model_used: string;
};

/** KJ `GET .../lookup-by-period` (found=false 이면 row 없음, HTTP는 항상 200) */
type ElectricityMonthlyRowLookupOut = {
  found: boolean;
  row: ElectricityMonthlyRowOut | null;
};

/** KJ DB 월별 지표 한 건 */
type ElectricityMonthlyRowOut = {
  anomaly_id: number;
  workplace_name: string;
  reporting_year: number;
  reporting_month: number;
  electricity_mwh: number;
  waste_ton: number | null;
  production_qty: number | null;
  temperature_c: number | null;
  contract_power_mwh: number | null;
  facility_capacity_mwh: number | null;
  final_status: string;
  anomaly_reason: string | null;
};

type OutlierVariantCard = {
  key: string;
  workplaceName: string;
  customerName: string;
  branchName: string;
  productName: string;
  variantName: string;
  variantCode: string | null;
  variantId: number;
  branchId: number;
  bomCode: string | null;
};

function parseIsoToYearMonth(iso: string): { y: number; m: number } {
  const d = new Date(iso);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function enumerateMonthsBetweenYm(startYm: string, endYm: string): string[] {
  if (!startYm || !endYm || startYm > endYm) return [];
  const [sy, sm] = startYm.split('-').map(Number);
  const [ey, em] = endYm.split('-').map(Number);
  const out: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

function monthsFromProjectIso(startIso: string, endIso: string): string[] {
  const s = parseIsoToYearMonth(startIso);
  const e = parseIsoToYearMonth(endIso);
  const startYm = `${s.y}-${String(s.m).padStart(2, '0')}`;
  const endYm = `${e.y}-${String(e.m).padStart(2, '0')}`;
  return enumerateMonthsBetweenYm(startYm, endYm);
}

function monthLabelKo(ym: string): string {
  const [y, mo] = ym.split('-').map(Number);
  return `${y}년 ${mo}월`;
}

function getDefaultQueryMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const prevMonth = now.getMonth();
  if (prevMonth === 0) return `${y - 1}-12`;
  return `${y}-${String(prevMonth).padStart(2, '0')}`;
}

function rowKeyOf(r: Pick<ScaffoldVariantRow, 'branchId' | 'variantId'>): string {
  return `b${r.branchId}-v${r.variantId}`;
}

/** 데모: 월 + 세부제품 키 기준 결정론적 지표 (추후 API로 대체) */
function demoMetricsForVariantMonth(ym: string, variantKey: string) {
  const s = `${ym}|${variantKey}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 2 ** 32;
  };
  return {
    /** 월별 전력 사용량 (MWh) */
    electricityMwh: Math.round((85 + u() * 95) * 100) / 100,
    wasteTon: Math.round((3.5 + u() * 42) * 100) / 100,
    production: Math.round(6_200 + u() * 18_000),
    temperatureC: Math.round((17 + u() * 15) * 10) / 10,
    /** 계약전력 (MWh) */
    contractPowerMwh: Math.round(1_200 + u() * 4_800),
    /** 설비용량 (MWh) */
    facilityCapacityMwh: Math.round((800 + u() * 3_200) * 10) / 10,
  };
}

type MonthlyMetricsRow = ReturnType<typeof demoMetricsForVariantMonth>;

const RULE_DETAIL_FALLBACK_KO: Record<string, string> = {
  PHY_CONTRACT: '전력 사용량이 계약전력을 초과한 것으로 판단됩니다.',
  PHY_FACILITY: '전력 사용량이 설비용량을 초과한 것으로 판단됩니다.',
  PHY_LOW30: '전력 사용량이 계약전력의 30% 미만입니다.',
  TS_MOM: '전월 대비 전력 증감이 과거 분포 대비 3σ를 초과했습니다.',
  TS_YOY: '전년 동월 대비 전력 증감이 3σ를 초과했습니다.',
  TS_3M: '직전 3개월 대비 전력이 3σ를 초과했습니다.',
  REL_RATIO: '전력 대비 생산량 비율이 과거 분포 대비 3σ를 초과했습니다.',
};

type AxisVerdictBlock = {
  verdict: '이상' | '정상';
  reasonLines: string[];
};

type OutlierAnalysisPanel = {
  physical: AxisVerdictBlock;
  timeseries: AxisVerdictBlock;
  relation: AxisVerdictBlock;
  finalStatus: string;
  narrativeBody: string;
  fallbackNote?: string;
};

function axisVerdictFromEvaluations(
  evaluations: AnomalyEvaluateResponse['rule_evaluations'],
  group: 'physical' | 'timeseries' | 'relation',
  score: number,
): AxisVerdictBlock {
  const verdict: '이상' | '정상' = score >= 0.5 ? '이상' : '정상';
  const hits = evaluations.filter((e) => e.rule_group === group && e.is_hit);

  if (hits.length === 0) {
    if (verdict === '정상') {
      const msg =
        group === 'physical'
          ? '계약전력·설비용량·계약대비 30% 미만 등 물리 규칙에서 이상 신호가 없습니다.'
          : group === 'timeseries'
            ? '전월·전년 동월·직전 3개월 대비 3σ 규칙에서 이상 신호가 없습니다.'
            : '관계분석(FT) 및 전력/생산 비율 규칙에서 이상 신호가 없거나, 관계 축이 미적용(s3=0)입니다.';
      return { verdict, reasonLines: [msg] };
    }
    return {
      verdict,
      reasonLines: ['축 점수는 이상이나 세부 규칙 적중 로그가 없습니다. 관리자에게 문의하세요.'],
    };
  }

  const reasonLines = hits.map((e) => {
    const ev = e.evidence_json as { detail_ko?: string } | null | undefined;
    const dk = ev?.detail_ko != null ? String(ev.detail_ko).trim() : '';
    return dk || RULE_DETAIL_FALLBACK_KO[e.rule_code] || e.rule_code;
  });
  return { verdict, reasonLines };
}

function rowToMetrics(row: ElectricityMonthlyRowOut): MonthlyMetricsRow {
  return {
    electricityMwh: row.electricity_mwh,
    wasteTon: row.waste_ton ?? 0,
    production: row.production_qty ?? 0,
    temperatureC: row.temperature_c ?? 0,
    contractPowerMwh: row.contract_power_mwh ?? 0,
    facilityCapacityMwh: row.facility_capacity_mwh ?? 0,
  };
}

export default function IfOutlierPage() {
  const { mode } = useMode();
  const accent = mode === 'procurement' ? '#5B3BFA' : '#00B4FF';
  const gradient =
    mode === 'procurement'
      ? 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)'
      : 'linear-gradient(90deg, #00B4FF 0%, #5B3BFA 100%)';
  const cardBg =
    mode === 'procurement'
      ? 'linear-gradient(90deg, rgba(91,59,250,0.05) 0%, rgba(0,180,255,0.05) 100%)'
      : 'linear-gradient(90deg, rgba(0,180,255,0.05) 0%, rgba(91,59,250,0.05) 100%)';
  const cardBorder =
    mode === 'procurement' ? 'rgba(91,59,250,0.2)' : 'rgba(0,180,255,0.2)';

  const [scaffoldVariants, setScaffoldVariants] = useState<ScaffoldVariantRow[]>([]);
  const [scaffoldLoading, setScaffoldLoading] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedWorkplace, setSelectedWorkplace] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedDetailProduct, setSelectedDetailProduct] = useState('');
  const [queryMonth, setQueryMonth] = useState<string | null>(() => getDefaultQueryMonth());

  const [hasQueried, setHasQueried] = useState(false);
  const [resultCards, setResultCards] = useState<OutlierVariantCard[]>([]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set());
  const [expandedMonthByCard, setExpandedMonthByCard] = useState<Set<string>>(() => new Set());
  const [bomByKey, setBomByKey] = useState<Record<string, string | null>>({});
  const [workplacesByRowKey, setWorkplacesByRowKey] = useState<Record<string, string[]>>({});
  /** 사업장명(tier0) API를 묶음으로 불러오는 중 — 무제한 병렬 호출 완화 */
  const [workplaceLoading, setWorkplaceLoading] = useState(false);
  const workplaceFetchSeq = useRef(0);
  /** effect 의존성에서 `workplacesByRowKey`를 빼 무한 재실행·로딩 고착을 막음 */
  const workplacesByRowKeyRef = useRef(workplacesByRowKey);
  workplacesByRowKeyRef.current = workplacesByRowKey;
  const [detectingByKey, setDetectingByKey] = useState<Record<string, boolean>>({});
  const [analysisPanelByKey, setAnalysisPanelByKey] = useState<Record<string, OutlierAnalysisPanel>>({});
  /** 이상치 탐지 직후 evaluate 의 final_status (전력 수정요청 버튼 표시용) */
  const [finalStatusByKey, setFinalStatusByKey] = useState<Record<string, string>>({});
  /** `${card.key}|${ym}` → KJ DB 행 또는 데모 폴백 */
  const [metricsByKey, setMetricsByKey] = useState<Record<string, MonthlyMetricsRow>>({});
  const [metricsSourceByKey, setMetricsSourceByKey] = useState<Record<string, 'db' | 'demo'>>({});
  const [metricsLoadingByKey, setMetricsLoadingByKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    let loadAttempted = false;

    const loadScaffold = async () => {
      if (loadAttempted) return;
      loadAttempted = true;
      setScaffoldLoading(true);
      try {
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const customers = await apiFetch<{ id: number; name: string }[]>(
          '/api/supply-chain/project-supply-chain/customers',
        );
        const allBranchesNested = await mapWithConcurrency(
          customers,
          12,
          async (customer) => {
            try {
              const branches = await apiFetch<{ id: number; name?: string }[]>(
                `/api/supply-chain/project-supply-chain/customers/${customer.id}/branches`,
              );
              return branches.map((b) => ({ customer, branch: b }));
            } catch {
              return [];
            }
          },
        );
        const allBranches = allBranchesNested.flat();

        const allProjectsResults = await mapWithConcurrency(
          allBranches,
          12,
          async ({ customer, branch }) => {
            try {
              const project = await apiFetch<{
                id: number;
                start_date: string;
                end_date: string;
              }>(`/api/supply-chain/project-supply-chain/branches/${branch.id}/project`);
              return { customer, branch, project };
            } catch {
              return null;
            }
          },
        );
        const allProjects = allProjectsResults.filter(
          (x): x is NonNullable<typeof x> => x !== null,
        );

        const allProductsNested = await mapWithConcurrency(
          allProjects,
          12,
          async ({ customer, branch, project }) => {
            try {
              const products = await apiFetch<{ id: number; name: string }[]>(
                `/api/supply-chain/project-supply-chain/projects/${project.id}/products`,
              );
              return products.map((prod) => ({ customer, branch, project, product: prod }));
            } catch {
              return [];
            }
          },
        );
        const allProductsFlat = allProductsNested.flat();

        const allVariantsNested = await mapWithConcurrency(
          allProductsFlat,
          12,
          async (item) => {
            try {
              const variants = await apiFetch<
                { id: number; name: string; code?: string | null }[]
              >(
                `/api/supply-chain/project-supply-chain/projects/${item.project.id}/products/${item.product.id}/product-variants`,
              );
              return variants.map((v) => ({ ...item, variant: v }));
            } catch {
              return [];
            }
          },
        );
        const allVariants = allVariantsNested.flat();

        const rows: ScaffoldVariantRow[] = allVariants.map((item) => ({
          customerId: item.customer.id,
          customerName: item.customer.name || `고객 #${item.customer.id}`,
          branchId: item.branch.id,
          branchName: item.branch.name ?? `지사 #${item.branch.id}`,
          projectId: item.project.id,
          projectStartIso: item.project.start_date,
          projectEndIso: item.project.end_date,
          productId: item.product.id,
          productName: item.product.name,
          variantId: item.variant.id,
          variantName: item.variant.name,
          variantCode: item.variant.code ?? null,
        }));

        if (mounted) setScaffoldVariants(rows);
      } catch (e) {
        console.error('IfOutlier scaffold load failed', e);
        if (mounted) {
          toast.error('고객사·제품 목록을 불러오지 못했습니다. 공급망 API를 확인해 주세요.');
        }
      } finally {
        if (mounted) setScaffoldLoading(false);
      }
    };

    void loadScaffold();
    return () => {
      mounted = false;
    };
  }, []);

  const customerOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const r of scaffoldVariants) {
      if (!byId.has(r.customerId)) byId.set(r.customerId, r.customerName);
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [scaffoldVariants]);

  const branchOptions = useMemo(() => {
    if (!selectedCustomer) return [];
    const cid = Number(selectedCustomer);
    if (!Number.isFinite(cid)) return [];
    const byId = new Map<number, string>();
    for (const r of scaffoldVariants) {
      if (r.customerId === cid && !byId.has(r.branchId)) byId.set(r.branchId, r.branchName);
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [scaffoldVariants, selectedCustomer]);

  const productOptions = useMemo(() => {
    const cid = selectedCustomer ? Number(selectedCustomer) : NaN;
    const hasCustomer = selectedCustomer && Number.isFinite(cid);
    const byId = new Map<number, string>();
    for (const r of scaffoldVariants) {
      if (hasCustomer && r.customerId !== cid) continue;
      if (selectedBranch) {
        const bid = Number(selectedBranch);
        if (!Number.isFinite(bid) || r.branchId !== bid) continue;
      }
      if (!byId.has(r.productId)) byId.set(r.productId, r.productName);
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [scaffoldVariants, selectedCustomer, selectedBranch]);

  const detailProductOptions = useMemo(() => {
    if (!selectedProduct) return [];
    const cid = selectedCustomer ? Number(selectedCustomer) : NaN;
    const hasCustomer = selectedCustomer && Number.isFinite(cid);
    const pid = Number(selectedProduct);
    if (!Number.isFinite(pid)) return [];
    const bid = selectedBranch ? Number(selectedBranch) : NaN;
    const hasBranch = selectedBranch && Number.isFinite(bid);
    return scaffoldVariants
      .filter((r) => {
        if (hasCustomer && r.customerId !== cid) return false;
        if (r.productId !== pid) return false;
        if (hasBranch) return r.branchId === bid;
        return true;
      })
      .sort((a, b) => a.variantName.localeCompare(b.variantName));
  }, [scaffoldVariants, selectedCustomer, selectedBranch, selectedProduct]);

  /** 조회 월 선택 가능 범위: 선택된 행들의 프로젝트 기간 합집합 */
  const enabledMonthsForPicker = useMemo(() => {
    const cid = selectedCustomer ? Number(selectedCustomer) : NaN;
    const hasCustomer = selectedCustomer && Number.isFinite(cid);
    const bid = selectedBranch ? Number(selectedBranch) : NaN;
    const hasBranch = selectedBranch && Number.isFinite(bid);
    const pid = selectedProduct ? Number(selectedProduct) : NaN;
    const hasProduct = selectedProduct && Number.isFinite(pid);
    const vid = selectedDetailProduct ? Number(selectedDetailProduct) : NaN;
    const hasVariant = selectedDetailProduct && Number.isFinite(vid);

    const acc = new Set<string>();
    for (const r of scaffoldVariants) {
      if (hasCustomer && r.customerId !== cid) continue;
      if (hasBranch && r.branchId !== bid) continue;
      if (hasProduct && r.productId !== pid) continue;
      if (hasVariant && r.variantId !== vid) continue;
      if (selectedWorkplace) {
        const ws = workplacesByRowKey[rowKeyOf(r)] ?? [];
        if (!ws.includes(selectedWorkplace)) continue;
      }
      monthsFromProjectIso(r.projectStartIso, r.projectEndIso).forEach((m) => acc.add(m));
    }
    const list = Array.from(acc).sort();
    return list.length > 0 ? list : undefined;
  }, [
    scaffoldVariants,
    selectedCustomer,
    selectedBranch,
    selectedWorkplace,
    selectedProduct,
    selectedDetailProduct,
    workplacesByRowKey,
  ]);

  const filteredRowsForQuery = useMemo(() => {
    const cid = selectedCustomer ? Number(selectedCustomer) : NaN;
    const hasCustomer = selectedCustomer && Number.isFinite(cid);
    const bid = selectedBranch ? Number(selectedBranch) : NaN;
    const hasBranch = selectedBranch && Number.isFinite(bid);
    const pid = selectedProduct ? Number(selectedProduct) : NaN;
    const hasProduct = selectedProduct && Number.isFinite(pid);
    const vid = selectedDetailProduct ? Number(selectedDetailProduct) : NaN;
    const hasVariant = selectedDetailProduct && Number.isFinite(vid);

    const seen = new Set<string>();
    const out: ScaffoldVariantRow[] = [];
    for (const r of scaffoldVariants) {
      if (hasCustomer && r.customerId !== cid) continue;
      if (hasBranch && r.branchId !== bid) continue;
      if (hasProduct && r.productId !== pid) continue;
      if (hasVariant && r.variantId !== vid) continue;
      const k = `${r.branchId}-${r.variantId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    return out.sort((a, b) => {
      const t = a.branchName.localeCompare(b.branchName);
      if (t !== 0) return t;
      return a.variantName.localeCompare(b.variantName);
    });
  }, [
    scaffoldVariants,
    selectedCustomer,
    selectedBranch,
    selectedProduct,
    selectedDetailProduct,
  ]);

  /** 사업장 목록(tier0)은 조회 월이 프로젝트 기간에 들어가는 행만 요청한다. 전체 변형을 미리 긁으면 API가 수백 번 호출되어 매우 느려진다. */
  useEffect(() => {
    if (!queryMonth) {
      setWorkplaceLoading(false);
      return;
    }
    const missingRows = filteredRowsForQuery.filter((r) => {
      if (workplacesByRowKeyRef.current[rowKeyOf(r)] != null) return false;
      const months = monthsFromProjectIso(r.projectStartIso, r.projectEndIso);
      return months.includes(queryMonth);
    });
    if (missingRows.length === 0) {
      setWorkplaceLoading(false);
      return;
    }

    const TIER0_FETCH_MS = 15_000;
    const runId = ++workplaceFetchSeq.current;
    void (async () => {
      setWorkplaceLoading(true);
      const next: Record<string, string[]> = {};
      try {
        await mapWithConcurrency(missingRows, 12, async (r) => {
          const key = rowKeyOf(r);
          try {
            if (typeof window !== 'undefined' && !getOprAccessToken()) {
              await restoreOprSessionFromCookie();
            }
            const ctx = await Promise.race([
              getOprTier0RowContext(r.branchId, r.variantId),
              new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('tier0-timeout')), TIER0_FETCH_MS);
              }),
            ]);
            const names = Array.from(
              new Set(
                (ctx.workplaces ?? [])
                  .map((w) => (w.workplace_name ?? '').trim())
                  .filter((n) => n.length > 0),
              ),
            ).sort((a, b) => a.localeCompare(b));
            next[key] = names;
          } catch {
            next[key] = [];
          }
        });
      } finally {
        if (runId === workplaceFetchSeq.current) {
          setWorkplaceLoading(false);
        }
      }
      if (runId !== workplaceFetchSeq.current) return;
      setWorkplacesByRowKey((prev) => ({ ...prev, ...next }));
    })();
  }, [filteredRowsForQuery, queryMonth]);

  /** resultCards(객체 배열) 대신 시그니처 문자열만 deps에 둬 React 19 의존성 배열 경고 방지 */
  const resultCardsSig =
    resultCards.length === 0
      ? ''
      : resultCards.map((c) => `${c.key}\x1e${c.workplaceName}`).sort().join('\x1f');

  /** 조회된 사업장·월별로 KJ `anomaly_electricity_monthly` 행을 조회해 표에 표시 (없으면 데모). */
  useEffect(() => {
    if (!hasQueried || !queryMonth || resultCards.length === 0) return;
    const ym = queryMonth;
    const cardsSnapshot = resultCards;
    let cancelled = false;

    void (async () => {
      await mapWithConcurrency(cardsSnapshot, 6, async (card) => {
        const dk = `${card.key}|${ym}`;
        try {
          if (typeof window !== 'undefined' && !getOprAccessToken()) {
            await restoreOprSessionFromCookie();
          }
          const [y, mo] = ym.split('-').map(Number);
          const path = `${API_PREFIX.ANOMALY}/v1/electricity-monthly/lookup-by-period?${new URLSearchParams({
            workplace_name: card.workplaceName,
            reporting_year: String(y),
            reporting_month: String(mo),
          }).toString()}`;
          const pack = await apiFetch<ElectricityMonthlyRowLookupOut>(path);
          if (cancelled) return;
          const row = pack.found ? pack.row : null;
          if (row) {
            setMetricsByKey((p) => ({ ...p, [dk]: rowToMetrics(row) }));
            setMetricsSourceByKey((p) => ({ ...p, [dk]: 'db' }));
            setFinalStatusByKey((p) => ({ ...p, [dk]: row.final_status }));
          } else {
            setMetricsByKey((p) => ({ ...p, [dk]: demoMetricsForVariantMonth(ym, card.key) }));
            setMetricsSourceByKey((p) => ({ ...p, [dk]: 'demo' }));
          }
        } catch {
          if (cancelled) return;
          setMetricsByKey((p) => ({ ...p, [dk]: demoMetricsForVariantMonth(ym, card.key) }));
          setMetricsSourceByKey((p) => ({ ...p, [dk]: 'demo' }));
        } finally {
          if (!cancelled) {
            setMetricsLoadingByKey((p) => ({ ...p, [dk]: false }));
          }
        }
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [hasQueried, queryMonth, resultCardsSig]);

  const workplaceOptions = useMemo(() => {
    const names = new Set<string>();
    for (const r of filteredRowsForQuery) {
      const key = rowKeyOf(r);
      const ws = workplacesByRowKey[key] ?? [];
      for (const w of ws) names.add(w);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [filteredRowsForQuery, workplacesByRowKey]);

  const handleQuery = () => {
    if (!queryMonth) {
      toast.error('조회 월을 선택해 주세요.');
      return;
    }
    const ym = queryMonth;
    const inRange = (r: ScaffoldVariantRow) => {
      const months = monthsFromProjectIso(r.projectStartIso, r.projectEndIso);
      return months.includes(ym);
    };
    const workplaceFilter = selectedWorkplace.trim();
    const rows = filteredRowsForQuery.filter((r) => {
      if (!inRange(r)) return false;
      if (!workplaceFilter) return true;
      const ws = workplacesByRowKey[rowKeyOf(r)] ?? [];
      return ws.includes(workplaceFilter);
    });
    if (rows.length === 0) {
      if (workplaceFilter) {
        toast.error('선택한 사업장·조회 월 조건에 맞는 데이터가 없습니다.');
      } else {
        toast.error('선택한 조회 월 조건에 맞는 데이터가 없습니다.');
      }
      return;
    }

    const rowByWorkplace = new Map<string, ScaffoldVariantRow>();
    for (const r of rows) {
      const ws = workplacesByRowKey[rowKeyOf(r)] ?? [];
      if (workplaceFilter) {
        if (!rowByWorkplace.has(workplaceFilter)) rowByWorkplace.set(workplaceFilter, r);
        continue;
      }
      for (const w of ws) {
        const label = (w || '').trim();
        if (!label) continue;
        if (!rowByWorkplace.has(label)) rowByWorkplace.set(label, r);
      }
      if (!workplaceFilter && ws.length === 0) {
        const synthetic = `${r.branchName} / ${r.variantName} · 사업장명 미확인`;
        if (!rowByWorkplace.has(synthetic)) rowByWorkplace.set(synthetic, r);
      }
    }
    const cards: OutlierVariantCard[] = Array.from(rowByWorkplace.entries()).map(([wname, r]) => ({
      key: `w${r.branchId}-${r.variantId}-${wname}`,
      workplaceName: wname,
      customerName: r.customerName,
      branchName: r.branchName,
      productName: r.productName,
      variantName: r.variantName,
      variantCode: r.variantCode,
      variantId: r.variantId,
      branchId: r.branchId,
      bomCode: r.variantCode,
    }));
    if (cards.length === 0) {
      toast.error('조회 조건에 맞는 사업장 데이터가 없습니다.');
      return;
    }
    const loadingInit: Record<string, boolean> = {};
    for (const c of cards) {
      loadingInit[`${c.key}|${ym}`] = true;
    }
    setMetricsByKey({});
    setMetricsSourceByKey({});
    setMetricsLoadingByKey(loadingInit);
    setResultCards(cards);
    setBomByKey({});
    setAnalysisPanelByKey({});
    setFinalStatusByKey({});
    setHasQueried(true);
    setExpandedCards(new Set(cards.map((c) => c.key)));
    setExpandedMonthByCard(new Set());
    toast.success(
      `사업장 ${cards.length}건 · ${workplaceFilter || '사업장 전체'} · ${monthLabelKo(ym)} — 월별 지표를 불러옵니다`,
    );

    void (async () => {
      const next: Record<string, string | null> = {};
      await mapWithConcurrency(cards, 8, async (c) => {
        try {
          if (typeof window !== 'undefined' && !getOprAccessToken()) {
            await restoreOprSessionFromCookie();
          }
          const b = await getOprBomPeriod(c.variantId, c.branchId);
          next[c.key] = b.bom_code ?? null;
        } catch {
          next[c.key] = null;
        }
      });
      setBomByKey((prev) => ({ ...prev, ...next }));
    })();
  };

  const handleReset = () => {
    setSelectedCustomer('');
    setSelectedBranch('');
    setSelectedWorkplace('');
    setSelectedProduct('');
    setSelectedDetailProduct('');
    setQueryMonth(getDefaultQueryMonth());
    setHasQueried(false);
    setResultCards([]);
    setExpandedCards(new Set());
    setExpandedMonthByCard(new Set());
    setBomByKey({});
    setFinalStatusByKey({});
    setMetricsByKey({});
    setMetricsSourceByKey({});
    setMetricsLoadingByKey({});
  };

  const toggleCard = (key: string) => {
    setExpandedCards((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const toggleMonthRow = (cardKey: string) => {
    setExpandedMonthByCard((prev) => {
      const n = new Set(prev);
      if (n.has(cardKey)) n.delete(cardKey);
      else n.add(cardKey);
      return n;
    });
  };

  const nf = useMemo(
    () => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }),
    [],
  );
  const ni = useMemo(() => new Intl.NumberFormat('ko-KR'), []);

  const runOutlierDetection = async (
    card: OutlierVariantCard,
    ym: string,
    metrics: ReturnType<typeof demoMetricsForVariantMonth>,
    /** KJ DB에서 불러온 지표일 때 true — CSV 시드 등 저장값을 evaluate 본문으로 덮어쓰지 않음 */
    preserveExistingMetrics = false,
  ) => {
    const detectKey = `${card.key}|${ym}`;
    setDetectingByKey((prev) => ({ ...prev, [detectKey]: true }));
    try {
      if (typeof window !== 'undefined' && !getOprAccessToken()) {
        await restoreOprSessionFromCookie();
      }
      const [y, m] = ym.split('-').map(Number);
      const res = await apiFetch<AnomalyEvaluateResponse>(
        `${API_PREFIX.ANOMALY}/v1/electricity-monthly/evaluate`,
        {
          method: 'POST',
          json: {
            workplace_name: card.workplaceName,
            reporting_year: y,
            reporting_month: m,
            electricity_mwh: metrics.electricityMwh,
            waste_ton: metrics.wasteTon,
            production_qty: metrics.production,
            temperature_c: metrics.temperatureC,
            contract_power_mwh: metrics.contractPowerMwh,
            facility_capacity_mwh: metrics.facilityCapacityMwh,
            preserve_existing_metrics: preserveExistingMetrics,
          },
        },
      );
      const physical = axisVerdictFromEvaluations(res.rule_evaluations, 'physical', res.score_physical);
      const timeseries = axisVerdictFromEvaluations(res.rule_evaluations, 'timeseries', res.score_timeseries);
      const relation = axisVerdictFromEvaluations(res.rule_evaluations, 'relation', res.score_relation);
      const panelBase = {
        physical,
        timeseries,
        relation,
        finalStatus: res.final_status,
      };
      try {
        const nar = await apiFetch<AnomalyNarrativeResponse>(
          `${API_PREFIX.ANOMALY}/v1/electricity-monthly/${res.anomaly_id}/narrative`,
          { method: 'POST' },
        );
        setAnalysisPanelByKey((prev) => ({
          ...prev,
          [detectKey]: {
            ...panelBase,
            narrativeBody: nar.narrative.trim(),
          },
        }));
      } catch {
        setAnalysisPanelByKey((prev) => ({
          ...prev,
          [detectKey]: {
            ...panelBase,
            narrativeBody: '',
            fallbackNote:
              '에이전트 종합 의견을 불러오지 못했습니다(ANOMALY_AI_ENABLED·GOOGLE_API_KEY·쿼터 확인). 위는 규칙 요약만 표시됩니다.',
          },
        }));
      }
      setFinalStatusByKey((prev) => ({ ...prev, [detectKey]: res.final_status }));
      if (res.final_status === 'anomaly') {
        toast.warning(`${card.workplaceName}: 규칙 기준 이상 신호가 감지되었습니다.`);
      } else {
        toast.success(`${card.workplaceName}: 규칙 기준 이상 없음`);
      }
      try {
        const refreshPath = `${API_PREFIX.ANOMALY}/v1/electricity-monthly/lookup-by-period?${new URLSearchParams({
          workplace_name: card.workplaceName,
          reporting_year: String(y),
          reporting_month: String(m),
        }).toString()}`;
        const refreshedPack = await apiFetch<ElectricityMonthlyRowLookupOut>(refreshPath);
        const refreshed = refreshedPack.found ? refreshedPack.row : null;
        if (refreshed) {
          setMetricsByKey((prev) => ({ ...prev, [detectKey]: rowToMetrics(refreshed) }));
          setMetricsSourceByKey((prev) => ({ ...prev, [detectKey]: 'db' }));
          setFinalStatusByKey((prev) => ({ ...prev, [detectKey]: refreshed.final_status }));
        }
      } catch {
        /* 표시는 evaluate 결과로 충분 */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`이상치 평가 실패: ${msg}`);
    } finally {
      setDetectingByKey((prev) => ({ ...prev, [detectKey]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">이상치 검정</h1>
        <p className="text-gray-600">인터페이스 해온 데이터의 이상치를 검정합니다.</p>
      </div>

      <div
        className="bg-white p-8"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        <h2 className="text-xl font-semibold mb-6">조회 조건</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">사업장</label>
            <select
              value={selectedWorkplace}
              disabled={scaffoldLoading}
              onChange={(e) => {
                setSelectedWorkplace(e.target.value);
                setHasQueried(false);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
              <option value="">전체</option>
              {workplaceOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              조회 월 <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <MonthPicker
              selectedMonth={queryMonth}
              onChange={(m) => {
                setQueryMonth(m);
                setHasQueried(false);
              }}
              placeholder="조회할 월을 선택하세요"
              enabledMonths={enabledMonthsForPicker}
              disabled={scaffoldLoading}
            />
            <p className="mt-2 text-xs text-gray-500">
              사업장과 조회 월 기준으로 이상치 검정 대상을 조회합니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleQuery}
              disabled={scaffoldLoading}
              className="px-6 py-3 text-white rounded-xl font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
              style={{
                background: gradient,
                boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
              }}
            >
              조회
            </button>
            {workplaceLoading && (
              <p className="text-sm text-amber-700 max-w-md leading-snug">
                사업장 정보를 불러오는 중입니다. 잠시만 기다려 주세요.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            초기화
          </button>
        </div>
      </div>

      {!hasQueried ? (
        <div
          className="bg-white p-12 text-center"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <Filter className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg">
            사업장·조회 월을 선택한 뒤 조회 버튼을 눌러주세요
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h3 className="text-lg font-semibold text-gray-900">세부제품별 I/F 데이터</h3>
            <span className="text-sm text-gray-500">
              <span style={{ color: accent, fontWeight: 600 }}>{resultCards.length}</span>건 ·{' '}
              {queryMonth ? monthLabelKo(queryMonth) : ''}
            </span>
          </div>

          {resultCards.map((card) => {
            const isCardOpen = expandedCards.has(card.key);
            const isMonthOpen = expandedMonthByCard.has(card.key);
            const workplaceLabel = card.workplaceName;
            const bom =
              bomByKey[card.key] !== undefined
                ? bomByKey[card.key] || '-'
                : card.bomCode || '-';
            const detectKey = queryMonth ? `${card.key}|${queryMonth}` : '';
            const metricsLoading = detectKey ? metricsLoadingByKey[detectKey] === true : false;
            const metrics: MonthlyMetricsRow | null = (() => {
              if (detectKey && metricsByKey[detectKey] != null) return metricsByKey[detectKey]!;
              if (metricsLoading || !queryMonth) return null;
              return demoMetricsForVariantMonth(queryMonth, card.key);
            })();
            const metricsSource = detectKey ? metricsSourceByKey[detectKey] : undefined;
            const isDetecting = detectKey ? !!detectingByKey[detectKey] : false;
            const analysisPanel = detectKey ? analysisPanelByKey[detectKey] : undefined;
            const finalStatusForMonth = detectKey ? finalStatusByKey[detectKey] : '';
            const showElectricityRevision =
              !!detectKey && finalStatusForMonth === 'anomaly';
            const analysisIsAnomaly = finalStatusForMonth === 'anomaly';

            return (
              <div key={card.key} className="mb-2">
                <div
                  role="button"
                  tabIndex={0}
                  className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all hover:shadow-md"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardBorder}`,
                  }}
                  onClick={() => toggleCard(card.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleCard(card.key);
                    }
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="p-1 rounded shrink-0">
                      {isCardOpen ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </span>
                    <Folder className={`w-5 h-5 shrink-0 ${mode === 'procurement' ? 'text-[#5B3BFA]' : 'text-[#00B4FF]'}`} />
                    <div className="flex-1 min-w-0 text-sm text-gray-700 flex flex-wrap gap-x-4 gap-y-1">
                      <Badge variant="outline" className="text-xs border-gray-300 text-gray-700 bg-white/70">
                        사업장: {workplaceLabel}
                      </Badge>
                    </div>
                  </div>
                </div>

                {isCardOpen && queryMonth && (
                  <div className="mt-2 bg-white rounded-xl overflow-hidden border border-gray-200">
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleMonthRow(card.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleMonthRow(card.key);
                        }
                      }}
                    >
                      <span className="p-1 rounded">
                        {isMonthOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </span>
                      <span className="font-medium text-gray-800">{monthLabelKo(queryMonth)}</span>
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60"
                          style={{ background: gradient }}
                          disabled={metricsLoading || !metrics || isDetecting}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!metrics || !queryMonth) return;
                            void runOutlierDetection(
                              card,
                              queryMonth,
                              metrics,
                              metricsSource === 'db',
                            );
                          }}
                        >
                          {isDetecting ? '탐지 중...' : '이상치 탐지'}
                        </button>
                        <span className="text-xs text-gray-500">
                          {metricsLoading
                            ? '지표 불러오는 중…'
                            : metricsSource === 'db'
                              ? 'DB 저장 지표 유지 · 규칙만 재평가(CSV 시드 보존)'
                              : '해당 월 DB 없음 · 데모 수치로 적재 후 평가'}
                        </span>
                      </div>
                    </div>

                    {isMonthOpen && metricsLoading && (
                      <div className="p-4 text-sm text-gray-500">KJ에서 월별 지표를 불러오는 중입니다…</div>
                    )}
                    {isMonthOpen && !metricsLoading && metrics && (
                      <div className="p-4 space-y-3">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[720px] border-collapse text-sm">
                            <thead>
                              <tr className="bg-[#F8F9FA]">
                                <th className="border border-gray-200 px-4 py-2.5 text-left font-semibold text-[var(--aifix-navy,#0f172a)]">
                                  전력 (MWh)
                                </th>
                                <th className="border border-gray-200 px-4 py-2.5 text-left font-semibold text-[var(--aifix-navy,#0f172a)]">
                                  폐기물 (ton)
                                </th>
                                <th className="border border-gray-200 px-4 py-2.5 text-left font-semibold text-[var(--aifix-navy,#0f172a)]">
                                  생산량
                                </th>
                                <th className="border border-gray-200 px-4 py-2.5 text-left font-semibold text-[var(--aifix-navy,#0f172a)]">
                                  온도 (°C)
                                </th>
                                <th className="border border-gray-200 px-4 py-2.5 text-left font-semibold text-[var(--aifix-navy,#0f172a)]">
                                  계약전력 (MWh)
                                </th>
                                <th className="border border-gray-200 px-4 py-2.5 text-left font-semibold text-[var(--aifix-navy,#0f172a)]">
                                  설비용량 (MWh)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="hover:bg-gray-50/80">
                                <td className="border border-gray-200 px-4 py-3 text-gray-800">
                                  <div className="flex flex-wrap items-center justify-end gap-2 tabular-nums">
                                    <span className="text-right">{nf.format(metrics.electricityMwh)}</span>
                                    {showElectricityRevision && queryMonth && (
                                      <button
                                        type="button"
                                        className="shrink-0 px-2.5 py-1 rounded-md text-xs font-medium border border-amber-600 text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const [yy, mm] = queryMonth.split('-').map(Number);
                                          toast.info(
                                            `${card.workplaceName} 사업장 ${yy}년 ${mm}월에 해당하는 전력사용량 수정을 요청하였습니다.`,
                                          );
                                        }}
                                      >
                                        수정요청
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="border border-gray-200 px-4 py-3 tabular-nums text-right text-gray-800">
                                  {nf.format(metrics.wasteTon)}
                                </td>
                                <td className="border border-gray-200 px-4 py-3 tabular-nums text-right text-gray-800">
                                  {ni.format(metrics.production)}
                                </td>
                                <td className="border border-gray-200 px-4 py-3 tabular-nums text-right text-gray-800">
                                  {nf.format(metrics.temperatureC)}
                                </td>
                                <td className="border border-gray-200 px-4 py-3 tabular-nums text-right text-gray-800">
                                  {ni.format(metrics.contractPowerMwh)}
                                </td>
                                <td className="border border-gray-200 px-4 py-3 tabular-nums text-right text-gray-800">
                                  {nf.format(metrics.facilityCapacityMwh)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        {analysisPanel && (
                          <div
                            className={
                              analysisIsAnomaly
                                ? 'rounded-lg border border-red-500 bg-red-50/80 px-4 py-4 text-sm text-gray-900 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.12)]'
                                : 'rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900'
                            }
                          >
                            <div className="mb-4 space-y-2 text-left">
                              <p
                                className={`text-base font-bold pb-3 border-b ${
                                  analysisIsAnomaly ? 'border-red-200' : 'border-amber-200'
                                }`}
                              >
                                <span className="text-gray-900">최종 판정</span>
                                <span className="text-gray-900"> : </span>
                                <span
                                  className={
                                    analysisPanel.finalStatus === 'anomaly'
                                      ? 'text-red-600'
                                      : 'text-emerald-700'
                                  }
                                >
                                  {analysisPanel.finalStatus === 'anomaly' ? '이상치' : '정상'}
                                </span>
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {monthLabelKo(queryMonth)} · {card.workplaceName}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                              {(
                                [
                                  ['물리적 분석', analysisPanel.physical],
                                  ['시계열 분석', analysisPanel.timeseries],
                                  ['관계 분석', analysisPanel.relation],
                                ] as const
                              ).map(([label, axis]) => (
                                <div
                                  key={label}
                                  className={`rounded-lg border px-3 py-2.5 min-h-[2.75rem] flex flex-wrap items-center justify-between gap-2 ${
                                    analysisIsAnomaly
                                      ? 'border-red-100 bg-white'
                                      : 'border-amber-100 bg-white'
                                  }`}
                                >
                                  <span className="text-sm font-semibold text-gray-800">{label}</span>
                                  <span
                                    className={`text-xs font-bold px-2.5 py-1 rounded-md shrink-0 ${
                                      axis.verdict === '이상'
                                        ? 'bg-orange-100 text-orange-900'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {axis.verdict}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {analysisPanel.narrativeBody ? (
                              <div className="mb-3">
                                <div className="text-[11px] font-semibold text-violet-700 mb-1.5">
                                  에이전트 종합 의견
                                </div>
                                <div
                                  className={`whitespace-pre-wrap rounded-md border px-3 py-3 text-sm leading-relaxed ${
                                    analysisIsAnomaly
                                      ? 'border-violet-200/90 bg-violet-50/90 text-violet-950'
                                      : 'border-violet-100 bg-violet-50/80 text-violet-950'
                                  }`}
                                >
                                  {analysisPanel.narrativeBody}
                                </div>
                              </div>
                            ) : null}

                            {analysisPanel.fallbackNote ? (
                              <p className="text-xs text-amber-900 border border-amber-300/60 rounded-md px-2 py-1.5 bg-amber-100/80 mt-2">
                                {analysisPanel.fallbackNote}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
