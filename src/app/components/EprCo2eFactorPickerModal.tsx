'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { restoreOprSessionFromCookie } from '@/lib/api/client';
import { getOprAccessToken } from '@/lib/api/sessionAccessToken';
import {
  formatEprCo2eFactorUnit,
  getEprCo2eDatasets,
  getEprCo2eMajors,
  getEprCo2eSubs,
  searchEprCo2eFactors,
  type RefEprCo2eFactorItem,
} from '@/lib/api/dataMgmtReference';
import { TableProperties, X } from 'lucide-react';
import { toast } from 'sonner';

export type EprCo2eApplyPayload = {
  co2eFactor: number;
  factorUnit: string;
  label: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onApply: (payload: EprCo2eApplyPayload) => void;
};

const PAGE = 40;

export function EprCo2eFactorPickerModal({ open, onClose, onApply }: Props) {
  const [datasetKey, setDatasetKey] = useState<string>('');
  const [datasets, setDatasets] = useState<{ dataset_key: string; row_count: number }[]>([]);
  const [majors, setMajors] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [major, setMajor] = useState('');
  const [sub, setSub] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<RefEprCo2eFactorItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const qRef = useRef(q);
  qRef.current = q;

  const loadList = useCallback(
    async (nextOffset: number) => {
      if (!datasetKey) return;
      setLoading(true);
      try {
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const res = await searchEprCo2eFactors({
          datasetKey,
          q: qRef.current || undefined,
          majorCategory: major || undefined,
          subCategory: sub || undefined,
          limit: PAGE,
          offset: nextOffset,
        });
        setItems(res.items);
        setTotal(res.total);
        setOffset(nextOffset);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '참조 계수를 불러오지 못했습니다.');
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [datasetKey, major, sub],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        if (typeof window !== 'undefined' && !getOprAccessToken()) {
          await restoreOprSessionFromCookie();
        }
        const d = await getEprCo2eDatasets();
        if (cancelled) return;
        setDatasets(d.items);
        const def = d.default_dataset_key || d.items[0]?.dataset_key || '';
        setDatasetKey(def);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : '데이터셋 목록을 불러오지 못했습니다.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !datasetKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const m = await getEprCo2eMajors(datasetKey);
        if (cancelled) return;
        setMajors(m);
        setMajor('');
        setSub('');
        setSubs([]);
      } catch {
        if (!cancelled) setMajors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, datasetKey]);

  useEffect(() => {
    if (!open || !datasetKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const s = await getEprCo2eSubs(datasetKey, major || null);
        if (cancelled) return;
        setSubs(s);
        setSub('');
      } catch {
        if (!cancelled) setSubs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, datasetKey, major]);

  useEffect(() => {
    if (!open || !datasetKey) return;
    void loadList(0);
  }, [open, datasetKey, loadList]);

  const handleSearch = () => {
    void loadList(0);
  };

  const pickRow = (row: RefEprCo2eFactorItem) => {
    const n = Number.parseFloat(row.co2e_factor);
    if (Number.isNaN(n)) {
      toast.error('계수 값을 해석할 수 없습니다.');
      return;
    }
    const factorUnit = formatEprCo2eFactorUnit(row.activity_unit);
    const label = `${row.major_category} › ${row.sub_category} — ${row.item_name}`;
    onApply({ co2eFactor: n, factorUnit, label });
    onClose();
  };

  if (!open) return null;

  const canPrev = offset > 0;
  const canNext = offset + items.length < total;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="epr-co2e-picker-title"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <TableProperties className="h-5 w-5 text-[#5B3BFA]" />
            <h2 id="epr-co2e-picker-title" className="text-lg font-bold text-gray-900">
              환경성적표지 참조 탄소발자국 계수
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 border-b border-gray-100 px-5 py-3">
          {datasets.length === 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              등록된 참조 계수가 없습니다. KJ에서 Alembic 마이그레이션 후{' '}
              <code className="rounded bg-amber-100 px-1">run_seed_ref_epr_co2e_factors.py</code> 를 실행하세요.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              데이터셋
              <select
                className="min-w-[10rem] rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                value={datasetKey}
                onChange={(e) => setDatasetKey(e.target.value)}
                disabled={datasets.length === 0}
              >
                {datasets.map((d) => (
                  <option key={d.dataset_key} value={d.dataset_key}>
                    {d.dataset_key} ({d.row_count})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              대분류
              <select
                className="min-w-[12rem] max-w-[14rem] rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
              >
                <option value="">전체</option>
                {majors.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              구분
              <select
                className="min-w-[10rem] max-w-[14rem] rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                value={sub}
                onChange={(e) => setSub(e.target.value)}
              >
                <option value="">전체</option>
                {subs.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-gray-600">
              검색어
              <input
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="항목명·대분류·구분"
              />
            </label>
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading || !datasetKey}
              className="rounded-lg bg-[#5B3BFA] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              검색
            </button>
          </div>
          <p className="text-xs text-gray-500">
            행을 클릭하면 배출계수·단위가 현재 편집 행에 채워집니다. ({total}건 중 {items.length}건 표시)
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-2 py-2">대분류</th>
                <th className="px-2 py-2">구분</th>
                <th className="px-2 py-2">원료·에너지</th>
                <th className="px-2 py-2 w-16">단위</th>
                <th className="px-2 py-2 w-28">탄소 (kg CO₂ eq.)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-gray-100 hover:bg-violet-50"
                  onClick={() => pickRow(row)}
                >
                  <td className="max-w-[8rem] truncate px-2 py-1.5" title={row.major_category}>
                    {row.major_category}
                  </td>
                  <td className="max-w-[8rem] truncate px-2 py-1.5" title={row.sub_category}>
                    {row.sub_category}
                  </td>
                  <td className="px-2 py-1.5" title={row.item_name}>
                    {row.item_name}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">{row.activity_unit}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-xs">{row.co2e_factor}</td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    결과가 없습니다. 검색어를 바꾸거나 시드를 적용했는지 확인하세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            disabled={!canPrev || loading}
            onClick={() => void loadList(Math.max(0, offset - PAGE))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-xs text-gray-500">
            {loading ? '불러오는 중…' : `${offset + 1}–${offset + items.length}`}
          </span>
          <button
            type="button"
            disabled={!canNext || loading}
            onClick={() => void loadList(offset + PAGE)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
