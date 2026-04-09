'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Filter, Folder } from 'lucide-react';
import { toast } from 'sonner';
import MonthPicker from '@/app/components/MonthPicker';
import { Badge } from '@/app/components/ui/badge';
import { useMode } from '@/app/context/ModeContext';
import { apiFetch, restoreOprSessionFromCookie } from '@/lib/api/client';
import { API_PREFIX } from '@/lib/api/paths';
import { getOprAccessToken } from '@/lib/api/sessionAccessToken';
import { getOprBomPeriod, getOprTier0RowContext } from '@/lib/api/dataMgmtOpr';

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
  final_score: number;
  final_status: string;
  anomaly_reason: string | null;
  scoring_version: string;
};

type AnomalyNarrativeResponse = {
  anomaly_id: number;
  narrative: string;
  embedding_present: boolean;
  model_used: string;
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
  const [detectingByKey, setDetectingByKey] = useState<Record<string, boolean>>({});
  const [analysisByKey, setAnalysisByKey] = useState<Record<string, string>>({});

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
        const allBranchesNested = await Promise.all(
          customers.map(async (customer) => {
            try {
              const branches = await apiFetch<{ id: number; name?: string }[]>(
                `/api/supply-chain/project-supply-chain/customers/${customer.id}/branches`,
              );
              return branches.map((b) => ({ customer, branch: b }));
            } catch {
              return [];
            }
          }),
        );
        const allBranches = allBranchesNested.flat();

        const allProjectsResults = await Promise.all(
          allBranches.map(async ({ customer, branch }) => {
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
          }),
        );
        const allProjects = allProjectsResults.filter(
          (x): x is NonNullable<typeof x> => x !== null,
        );

        const allProductsNested = await Promise.all(
          allProjects.map(async ({ customer, branch, project }) => {
            try {
              const products = await apiFetch<{ id: number; name: string }[]>(
                `/api/supply-chain/project-supply-chain/projects/${project.id}/products`,
              );
              return products.map((prod) => ({ customer, branch, project, product: prod }));
            } catch {
              return [];
            }
          }),
        );
        const allProductsFlat = allProductsNested.flat();

        const allVariantsNested = await Promise.all(
          allProductsFlat.map(async (item) => {
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
          }),
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

  useEffect(() => {
    let mounted = true;
    const missingRows = filteredRowsForQuery.filter((r) => workplacesByRowKey[rowKeyOf(r)] == null);
    if (missingRows.length === 0) return;

    void (async () => {
      const next: Record<string, string[]> = {};
      await Promise.all(
        missingRows.map(async (r) => {
          const key = rowKeyOf(r);
          try {
            if (typeof window !== 'undefined' && !getOprAccessToken()) {
              await restoreOprSessionFromCookie();
            }
            const ctx = await getOprTier0RowContext(r.branchId, r.variantId);
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
        }),
      );
      if (!mounted) return;
      setWorkplacesByRowKey((prev) => ({ ...prev, ...next }));
    })();

    return () => {
      mounted = false;
    };
  }, [filteredRowsForQuery, workplacesByRowKey]);

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
    setResultCards(cards);
    setBomByKey({});
    setHasQueried(true);
    setExpandedCards(new Set(cards.map((c) => c.key)));
    setExpandedMonthByCard(new Set());
    toast.success(
      `사업장 ${cards.length}건 · ${workplaceFilter || '사업장 전체'} · ${monthLabelKo(ym)} (데모 지표)`,
    );

    void (async () => {
      const next: Record<string, string | null> = {};
      await Promise.all(
        cards.map(async (c) => {
          try {
            if (typeof window !== 'undefined' && !getOprAccessToken()) {
              await restoreOprSessionFromCookie();
            }
            const b = await getOprBomPeriod(c.variantId, c.branchId);
            next[c.key] = b.bom_code ?? null;
          } catch {
            next[c.key] = null;
          }
        }),
      );
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
          },
        },
      );
      const head = `이상치 탐지 (${monthLabelKo(ym)}, ${card.workplaceName})`;
      const ruleSummary = res.anomaly_reason?.trim() ?? '평가 결과가 없습니다.';
      let displayBody = `${head}\n\n[규칙 요약]\n${ruleSummary}`;
      try {
        const nar = await apiFetch<AnomalyNarrativeResponse>(
          `${API_PREFIX.ANOMALY}/v1/electricity-monthly/${res.anomaly_id}/narrative`,
          { method: 'POST' },
        );
        const embNote = nar.embedding_present ? '(임베딩 반영)' : '(임베딩 없음 — 배치 실행 시 반영)';
        displayBody = `${head}\n\n[규칙 요약]\n${ruleSummary}\n\n[화면 설명 · ${nar.model_used}] ${embNote}\n${nar.narrative}`;
      } catch {
        displayBody = `${head}\n\n[규칙 요약]\n${ruleSummary}\n\n(Gemini 화면 설명 생략: ANOMALY_AI_ENABLED 또는 API 오류)`;
      }
      setAnalysisByKey((prev) => ({ ...prev, [detectKey]: displayBody }));
      if (res.final_status === 'anomaly') {
        toast.warning(`${card.workplaceName}: 규칙 기준 이상 신호가 감지되었습니다.`);
      } else {
        toast.success(`${card.workplaceName}: 규칙 기준 이상 없음`);
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

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleQuery}
            className="px-6 py-3 text-white rounded-xl font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: gradient,
              boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
            }}
          >
            조회
          </button>
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
            const metrics =
              queryMonth != null
                ? demoMetricsForVariantMonth(queryMonth, card.key)
                : null;
            const detectKey = queryMonth ? `${card.key}|${queryMonth}` : '';
            const isDetecting = detectKey ? !!detectingByKey[detectKey] : false;
            const analysisText = detectKey ? analysisByKey[detectKey] : '';

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
                          disabled={!metrics || isDetecting}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!metrics || !queryMonth) return;
                            void runOutlierDetection(card, queryMonth, metrics);
                          }}
                        >
                          {isDetecting ? '탐지 중...' : '이상치 탐지'}
                        </button>
                        <span className="text-xs text-gray-500">지표(데모) → 서버 규칙 평가</span>
                      </div>
                    </div>

                    {isMonthOpen && metrics && (
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
                                <td className="border border-gray-200 px-4 py-3 tabular-nums text-right text-gray-800">
                                  {nf.format(metrics.electricityMwh)}
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
                        {analysisText && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            <span className="font-semibold">원인 분석</span>
                            <p className="mt-1 leading-6">{analysisText}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-xs text-gray-500 px-1">
            표에 보이는 수치는 데모 난수입니다. 전력은 MWh 단위로 전송됩니다. 이상치 탐지 클릭 시 동일 값이 KJ{' '}
            <code className="text-gray-600">/api/anomaly/v1/electricity-monthly/evaluate</code>로 전송되어{' '}
            DB에 적재되고 온톨로지 규칙(PHY_001~004)으로 평가됩니다. BOM 코드는 data-mgmt API로 조회합니다.
          </p>
        </div>
      )}
    </div>
  );
}
