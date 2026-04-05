'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Filter, Folder } from 'lucide-react';
import { toast } from 'sonner';
import MonthPicker from '@/app/components/MonthPicker';
import { useMode } from '@/app/context/ModeContext';
import { apiFetch, restoreOprSessionFromCookie } from '@/lib/api/client';
import { getOprAccessToken } from '@/lib/api/sessionAccessToken';
import { getOprBomPeriod } from '@/lib/api/dataMgmtOpr';

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

type OutlierVariantCard = {
  key: string;
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
    electricityKwh: Math.round(85_000 + u() * 95_000),
    wasteTon: Math.round((3.5 + u() * 42) * 100) / 100,
    production: Math.round(6_200 + u() * 18_000),
    temperatureC: Math.round((17 + u() * 15) * 10) / 10,
    /** 계약전력 (kW) */
    contractPowerKw: Math.round(1_200 + u() * 4_800),
    /** 설비용량 (kVA) */
    facilityCapacityKva: Math.round((800 + u() * 3_200) * 10) / 10,
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
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedDetailProduct, setSelectedDetailProduct] = useState('');
  const [queryMonth, setQueryMonth] = useState<string | null>(null);

  const [hasQueried, setHasQueried] = useState(false);
  const [resultCards, setResultCards] = useState<OutlierVariantCard[]>([]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set());
  const [expandedMonthByCard, setExpandedMonthByCard] = useState<Set<string>>(() => new Set());
  const [bomByKey, setBomByKey] = useState<Record<string, string | null>>({});

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
    if (!selectedCustomer) return [];
    const cid = Number(selectedCustomer);
    if (!Number.isFinite(cid)) return [];
    const byId = new Map<number, string>();
    for (const r of scaffoldVariants) {
      if (r.customerId !== cid) continue;
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
    if (!selectedCustomer || !selectedProduct) return [];
    const cid = Number(selectedCustomer);
    const pid = Number(selectedProduct);
    if (!Number.isFinite(cid) || !Number.isFinite(pid)) return [];
    const bid = selectedBranch ? Number(selectedBranch) : NaN;
    const hasBranch = selectedBranch && Number.isFinite(bid);
    return scaffoldVariants
      .filter((r) => {
        if (r.customerId !== cid || r.productId !== pid) return false;
        if (hasBranch) return r.branchId === bid;
        return true;
      })
      .sort((a, b) => a.variantName.localeCompare(b.variantName));
  }, [scaffoldVariants, selectedCustomer, selectedBranch, selectedProduct]);

  /** 조회 월 선택 가능 범위: 선택된 행들의 프로젝트 기간 합집합 */
  const enabledMonthsForPicker = useMemo(() => {
    const cid = Number(selectedCustomer);
    if (!Number.isFinite(cid)) return undefined;
    const bid = selectedBranch ? Number(selectedBranch) : NaN;
    const hasBranch = selectedBranch && Number.isFinite(bid);
    const pid = selectedProduct ? Number(selectedProduct) : NaN;
    const hasProduct = selectedProduct && Number.isFinite(pid);
    const vid = selectedDetailProduct ? Number(selectedDetailProduct) : NaN;
    const hasVariant = selectedDetailProduct && Number.isFinite(vid);

    const acc = new Set<string>();
    for (const r of scaffoldVariants) {
      if (r.customerId !== cid) continue;
      if (hasBranch && r.branchId !== bid) continue;
      if (hasProduct && r.productId !== pid) continue;
      if (hasVariant && r.variantId !== vid) continue;
      monthsFromProjectIso(r.projectStartIso, r.projectEndIso).forEach((m) => acc.add(m));
    }
    const list = Array.from(acc).sort();
    return list.length > 0 ? list : undefined;
  }, [
    scaffoldVariants,
    selectedCustomer,
    selectedBranch,
    selectedProduct,
    selectedDetailProduct,
  ]);

  const filteredRowsForQuery = useMemo(() => {
    const cid = Number(selectedCustomer);
    if (!Number.isFinite(cid)) return [];
    const bid = selectedBranch ? Number(selectedBranch) : NaN;
    const hasBranch = selectedBranch && Number.isFinite(bid);
    const pid = selectedProduct ? Number(selectedProduct) : NaN;
    const hasProduct = selectedProduct && Number.isFinite(pid);
    const vid = selectedDetailProduct ? Number(selectedDetailProduct) : NaN;
    const hasVariant = selectedDetailProduct && Number.isFinite(vid);

    const seen = new Set<string>();
    const out: ScaffoldVariantRow[] = [];
    for (const r of scaffoldVariants) {
      if (r.customerId !== cid) continue;
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

  const handleQuery = () => {
    if (!selectedCustomer) {
      toast.error('고객사를 선택해 주세요.');
      return;
    }
    if (!queryMonth) {
      toast.error('조회 월을 선택해 주세요.');
      return;
    }
    const ym = queryMonth;
    const inRange = (r: ScaffoldVariantRow) => {
      const months = monthsFromProjectIso(r.projectStartIso, r.projectEndIso);
      return months.includes(ym);
    };
    const rows = filteredRowsForQuery.filter(inRange);
    if (rows.length === 0) {
      toast.error('선택한 월이 프로젝트 기간에 포함되는 세부제품이 없습니다.');
      return;
    }

    const cards: OutlierVariantCard[] = rows.map((r) => ({
      key: `b${r.branchId}-v${r.variantId}`,
      customerName: r.customerName,
      branchName: r.branchName,
      productName: r.productName,
      variantName: r.variantName,
      variantCode: r.variantCode,
      variantId: r.variantId,
      branchId: r.branchId,
      bomCode: r.variantCode,
    }));
    setResultCards(cards);
    setBomByKey({});
    setHasQueried(true);
    setExpandedCards(new Set(cards.map((c) => c.key)));
    setExpandedMonthByCard(new Set());
    toast.success(`세부제품 ${cards.length}건 · ${monthLabelKo(ym)} (데모 지표)`);

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
    setSelectedProduct('');
    setSelectedDetailProduct('');
    setQueryMonth(null);
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              고객사 <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              value={selectedCustomer}
              disabled={scaffoldLoading}
              onChange={(e) => {
                setSelectedCustomer(e.target.value);
                setSelectedBranch('');
                setSelectedProduct('');
                setSelectedDetailProduct('');
                setQueryMonth(null);
                setHasQueried(false);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
              <option value="">
                {scaffoldLoading ? '목록 불러오는 중…' : '고객사를 선택하세요'}
              </option>
              {customerOptions.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">지사</label>
            <select
              value={selectedBranch}
              disabled={!selectedCustomer || scaffoldLoading}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setSelectedProduct('');
                setSelectedDetailProduct('');
                setQueryMonth(null);
                setHasQueried(false);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
              <option value="">전체</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">제품</label>
            <select
              value={selectedProduct}
              disabled={!selectedCustomer || scaffoldLoading}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                setSelectedDetailProduct('');
                setQueryMonth(null);
                setHasQueried(false);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
              <option value="">전체</option>
              {productOptions.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">세부제품</label>
            <select
              value={selectedDetailProduct}
              disabled={!selectedProduct || scaffoldLoading}
              onChange={(e) => {
                setSelectedDetailProduct(e.target.value);
                setQueryMonth(null);
                setHasQueried(false);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] disabled:bg-gray-100"
            >
              <option value="">전체</option>
              {detailProductOptions.map((d) => (
                <option key={d.variantId} value={String(d.variantId)}>
                  {d.variantCode ? `${d.variantName} | ${d.variantCode}` : d.variantName}
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
              disabled={!selectedCustomer || scaffoldLoading}
            />
            <p className="mt-2 text-xs text-gray-500">
              데이터 관리와 동일한 공급망·제품 스코프입니다. 제품 카드를 펼치면 해당 월의 I/F 지표 스키마를
              확인합니다.
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
            고객사·조회 월을 선택한 뒤 조회 버튼을 눌러주세요
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
            const bom =
              bomByKey[card.key] !== undefined
                ? bomByKey[card.key] || '-'
                : card.bomCode || '-';
            const metrics =
              queryMonth != null
                ? demoMetricsForVariantMonth(queryMonth, card.key)
                : null;

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
                      <span>
                        고객사: <span className="font-medium">{card.customerName}</span>
                      </span>
                      <span>
                        지사: <span className="font-medium">{card.branchName}</span>
                      </span>
                      <span>
                        제품: <span className="font-medium">{card.productName}</span>
                      </span>
                      <span>
                        세부제품:{' '}
                        <span className="font-medium">
                          {card.variantCode
                            ? `${card.variantName} | ${card.variantCode}`
                            : card.variantName}
                        </span>
                      </span>
                      <span>
                        BOM 코드:{' '}
                        <span className={`font-semibold ${mode === 'procurement' ? 'text-[#5B3BFA]' : 'text-[#00B4FF]'}`}>
                          {bom}
                        </span>
                      </span>
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
                      <span className="text-xs text-gray-500 ml-auto">인터페이스 지표 (데모)</span>
                    </div>

                    {isMonthOpen && metrics && (
                      <div className="overflow-x-auto p-4">
                        <table className="w-full min-w-[720px] border-collapse text-sm">
                          <thead>
                            <tr className="bg-[#F8F9FA]">
                              <th className="border border-gray-200 px-4 py-2.5 text-left font-semibold text-[var(--aifix-navy,#0f172a)]">
                                전력 (kWh)
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
                                계약전력 (kW)
                              </th>
                              <th className="border border-gray-200 px-4 py-2.5 text-left font-semibold text-[var(--aifix-navy,#0f172a)]">
                                설비용량 (kVA)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="hover:bg-gray-50/80">
                              <td className="border border-gray-200 px-4 py-3 tabular-nums text-right text-gray-800">
                                {ni.format(metrics.electricityKwh)}
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
                                {ni.format(metrics.contractPowerKw)}
                              </td>
                              <td className="border border-gray-200 px-4 py-3 tabular-nums text-right text-gray-800">
                                {nf.format(metrics.facilityCapacityKva)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-xs text-gray-500 px-1">
            데모 지표입니다. BOM 코드는 data-mgmt API로 조회하며, 전력·폐기물·생산량·온도·계약전력·설비용량은
            추후 MES/ERP I/F API와 연결할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
