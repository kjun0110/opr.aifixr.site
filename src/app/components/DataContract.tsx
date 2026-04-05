'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Download,
  Eye,
  GitCompare,
  Plus,
  Lock,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Calendar,
  User,
  Search,
  Filter,
  MoreVertical,
  Send,
  Edit,
} from 'lucide-react';
import { toast } from 'sonner';

import type { ContractRevisionListItem, ContractRevisionCurrentResponse } from '@/lib/api/data-contract';
import {
  displayVersionCode,
  downloadContractRevisionPdf,
  fetchContractRevisionPdfBlob,
  getContractRevisionStatusCounts,
  getCurrentContractRevision,
  listContractRevisions,
} from '@/lib/api/data-contract';

function mapApiRevisionStatus(
  s: string,
): 'Draft' | 'Review' | 'Approved' | 'Active' | 'Retired' {
  const k = s.toLowerCase();
  if (k === 'draft') return 'Draft';
  if (k === 'review') return 'Review';
  if (k === 'approved') return 'Approved';
  if (k === 'active') return 'Active';
  if (k === 'retired') return 'Retired';
  return 'Draft';
}

function formatDateYmd(iso: string): string {
  return iso.slice(0, 10);
}

interface ConsentItem {
  id: string;
  title: string;
  required: boolean;
  target: string;
  summary: string;
  detail: string;
  linkedVersion: string;
  status: 'Active' | 'Scheduled' | 'Retired';
}

interface SupplierConsent {
  id: string;
  companyName: string;
  tier: string;
  country: string;
  email: string;
  version: string;
  status: 'Pending' | 'Agreed' | 'Refused' | 'OnHold';
  agreedDate?: string;
}

export default function DataContract() {
  const [activeTab, setActiveTab] = useState<'items' | 'status'>('items');
  const [revisions, setRevisions] = useState<ContractRevisionListItem[]>([]);
  const [currentRevision, setCurrentRevision] = useState<ContractRevisionCurrentResponse | null>(null);
  const [statusCountsApi, setStatusCountsApi] = useState<{
    draft: number;
    review: number;
    approved: number;
    active: number;
    retired: number;
  } | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null);
  /** 목록 API만 — PDF(수십 MB)와 무관하게 빨리 끝냄 */
  const [revisionsLoading, setRevisionsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  /** 실제로 iframe에 올릴 PDF만 이 id일 때 네트워크 로드 (선택만으로는 로드 안 함) */
  const [previewTargetId, setPreviewTargetId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showLogDrawer, setShowLogDrawer] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  // Filter states
  const [filterVersion, setFilterVersion] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRevisionsLoading(true);
    setListError(null);

    listContractRevisions({ limit: 50 })
      .then((list) => {
        if (cancelled) return;
        setRevisions(list);
        const sel =
          list.find((r) => r.is_current)?.id ?? list[0]?.id ?? null;
        setSelectedRevisionId(sel);
        setPreviewTargetId(null);
      })
      .catch((e) => {
        if (!cancelled) {
          setListError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setRevisionsLoading(false);
      });

    getCurrentContractRevision()
      .then((c) => {
        if (!cancelled) setCurrentRevision(c);
      })
      .catch(() => {
        if (!cancelled) setCurrentRevision(null);
      });

    getContractRevisionStatusCounts()
      .then((c) => {
        if (!cancelled) setStatusCountsApi(c);
      })
      .catch(() => {
        if (!cancelled) setStatusCountsApi(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (previewTargetId == null) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }
    let objectUrl: string | null = null;
    let alive = true;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    fetchContractRevisionPdfBlob(previewTargetId)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((err) => {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : 'PDF를 불러오지 못했습니다.';
        setPreviewError(msg);
        toast.error('PDF 미리보기를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (alive) setPreviewLoading(false);
      });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewTargetId]);

  const selectedRev = revisions.find((r) => r.id === selectedRevisionId) ?? null;

  /** API current 우선, 없으면 목록의 is_current 행으로 카드 즉시 표시 */
  const showCurrentForCard = useMemo(
    () => currentRevision ?? revisions.find((r) => r.is_current) ?? null,
    [currentRevision, revisions],
  );

  const displayCurrentVersionLabel = useMemo(
    () => (showCurrentForCard ? displayVersionCode(showCurrentForCard.version_code) : '—'),
    [showCurrentForCard],
  );

  const handleDownload = useCallback(async (revisionId: number, fileName: string) => {
    try {
      await downloadContractRevisionPdf(revisionId, fileName);
      toast.success('다운로드를 시작했습니다.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '다운로드에 실패했습니다.');
    }
  }, []);

  const parseApproverLine = (label: string | null | undefined) => {
    if (!label?.trim()) return { department: '—', approver: '—' };
    const parts = label.split('|').map((s) => s.trim());
    if (parts.length >= 2) return { department: parts[0], approver: parts.slice(1).join(' | ') };
    return { department: '—', approver: label };
  };

  const consentItems: ConsentItem[] = [
    {
      id: '1',
      title: '제3자 개인정보 제공 동의',
      required: true,
      target: '전체',
      summary: '공급망 관리를 위한 개인정보 제3자 제공에 동의합니다',
      detail: '귀하의 개인정보는 AIFIX 플랫폼을 통한 공급망 관리 목적으로 원청사에 제공됩니다...',
      linkedVersion: '3P-2026-03',
      status: 'Active',
    },
    {
      id: '2',
      title: '마케팅 정보 수신 동의',
      required: false,
      target: '전체',
      summary: 'AIFIX 플랫폼 관련 마케팅 정보 수신에 동의합니다',
      detail: '신규 서비스, 이벤트, 공지사항 등의 마케팅 정보를 이메일로 받아보실 수 있습니다...',
      linkedVersion: '3P-2026-03',
      status: 'Active',
    },
    {
      id: '3',
      title: 'ESG 데이터 활용 동의',
      required: true,
      target: '전체',
      summary: 'ESG 평가 및 분석을 위한 데이터 활용에 동의합니다',
      detail: '귀사의 ESG 데이터는 공급망 리스크 분석 및 평가 목적으로 활용됩니다...',
      linkedVersion: '3P-2026-03',
      status: 'Active',
    },
  ];

  const supplierConsents: SupplierConsent[] = [
    {
      id: '1',
      companyName: '한국배터리',
      tier: 'Tier 1',
      country: 'South Korea',
      email: 'contact@koreabattery.com',
      version: '3P-2026-03',
      status: 'Agreed',
      agreedDate: '2026-03-01 14:23',
    },
    {
      id: '2',
      companyName: '셀테크',
      tier: 'Tier 2',
      country: 'China',
      email: 'info@celltech.cn',
      version: '3P-2026-03',
      status: 'Agreed',
      agreedDate: '2026-03-02 09:15',
    },
    {
      id: '3',
      companyName: 'BMS Solutions',
      tier: 'Tier 2',
      country: 'Germany',
      email: 'contact@bmssolutions.de',
      version: '3P-2026-02',
      status: 'Pending',
    },
    {
      id: '4',
      companyName: '리튬광산',
      tier: 'Tier 3',
      country: 'Australia',
      email: 'info@lithiummine.au',
      version: '3P-2026-03',
      status: 'Refused',
      agreedDate: '2026-03-01 16:45',
    },
  ];

  const getStatusColor = (status: string) => {
    const colors = {
      Draft: 'bg-gray-100 text-gray-700',
      Review: 'bg-blue-100 text-blue-700',
      Approved: 'bg-green-100 text-green-700',
      Active: 'bg-purple-100 text-purple-700',
      Retired: 'bg-gray-100 text-gray-500',
      Pending: 'bg-yellow-100 text-yellow-700',
      Agreed: 'bg-green-100 text-green-700',
      Refused: 'bg-red-100 text-red-700',
      OnHold: 'bg-orange-100 text-orange-700',
      Scheduled: 'bg-blue-100 text-blue-700',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const statusCounts = {
    invited: 156,
    started: 132,
    agreed: 124,
    refused: 8,
  };

  const currentApprover = showCurrentForCard
    ? parseApproverLine(showCurrentForCard.approver_label)
    : { department: '—', approver: '—' };

  const reviewRevisions = revisions.filter((r) => r.status.toLowerCase() === 'review');
  const firstReview = reviewRevisions[0];

  const counts = statusCountsApi ?? {
    draft: 0,
    review: 0,
    approved: 0,
    active: 0,
    retired: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">제3자 제공 동의서</h1>
        <p className="text-gray-600">개인정보 동의서 버전 관리 및 협력사 동의 현황 추적</p>
      </div>

      {listError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {listError}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-6">
        {/* Current Active Version */}
        <div
          className="bg-white p-6"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-bold text-gray-900">현재 적용 중인 동의서</h2>
                {showCurrentForCard ? (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                      mapApiRevisionStatus(showCurrentForCard.status),
                    )}`}
                  >
                    {mapApiRevisionStatus(showCurrentForCard.status)}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                    —
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-[#5B3BFA] mb-1">
                {revisionsLoading
                  ? '…'
                  : showCurrentForCard
                    ? displayVersionCode(showCurrentForCard.version_code)
                    : '등록된 현재 버전 없음'}
              </div>
            </div>
            <FileText className="w-12 h-12 text-[#5B3BFA] opacity-20" />
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">적용 시작일:</span>
              <span className="font-medium text-gray-900">
                {showCurrentForCard ? formatDateYmd(showCurrentForCard.effective_from) : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">담당 부서:</span>
              <span className="font-medium text-gray-900">{currentApprover.department}</span>
              <span className="text-gray-400">|</span>
              <span className="font-medium text-gray-900">{currentApprover.approver}</span>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-600">{showCurrentForCard?.summary?.trim() || '—'}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={!showCurrentForCard}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#5B3BFA] to-[#00B4FF] text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                if (!showCurrentForCard) return;
                setSelectedRevisionId(showCurrentForCard.id);
                setPreviewTargetId(showCurrentForCard.id);
              }}
            >
              <Eye size={18} />
              PDF 미리보기
            </button>
            <button
              type="button"
              disabled={!showCurrentForCard}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() =>
                showCurrentForCard &&
                void handleDownload(showCurrentForCard.id, showCurrentForCard.document_storage_key)
              }
            >
              <Download size={18} />
              다운로드
            </button>
          </div>

          <button
            type="button"
            className="w-full mt-3 text-sm text-[#5B3BFA] hover:text-[#4829d4] transition-colors flex items-center justify-center gap-1"
          >
            변경 이력 보기
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Request Status */}
        <div
          className="bg-white p-6"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <h2 className="text-lg font-bold text-gray-900 mb-4">요청/승인 진행 현황</h2>

          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Draft', count: counts.draft, color: 'text-gray-600' },
              { label: 'Review', count: counts.review, color: 'text-blue-600' },
              { label: 'Approved', count: counts.approved, color: 'text-green-600' },
              { label: 'Active', count: counts.active, color: 'text-purple-600' },
              { label: 'Retired', count: counts.retired, color: 'text-gray-400' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className={`text-2xl font-bold ${item.color}`}>{item.count}</div>
                <div className="text-xs text-gray-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>

          {firstReview ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-blue-900 mb-1">
                    검토 중인 요청 {reviewRevisions.length}건
                  </div>
                  <div className="text-xs text-blue-700">
                    {displayVersionCode(firstReview.version_code)} — {firstReview.title}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="w-full px-4 py-3 bg-gradient-to-r from-[#5B3BFA] to-[#00B4FF] text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            onClick={() => setShowRequestModal(true)}
          >
            <Plus size={18} />
            새 버전 등록 요청
          </button>
        </div>
      </div>

      {/* Version Management Section */}
      <div className="grid grid-cols-2 gap-6">
        {/* Version List */}
        <div
          className="bg-white p-6"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <h2 className="text-lg font-bold text-gray-900 mb-4">동의서 버전 목록</h2>

          <div className="space-y-3">
            {revisionsLoading && (
              <div className="text-sm text-gray-500 py-8 text-center">버전 목록을 불러오는 중…</div>
            )}
            {!revisionsLoading &&
              revisions.map((version) => {
                const uiStatus = mapApiRevisionStatus(version.status);
                return (
                  <div
                    key={version.id}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedRevisionId === version.id
                        ? 'border-[#5B3BFA] bg-[#5B3BFA]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedRevisionId(version.id);
                      setPreviewTargetId(null);
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">
                            {displayVersionCode(version.version_code)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(uiStatus)}`}
                          >
                            {uiStatus}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDateYmd(version.effective_from)}
                          {version.effective_until
                            ? ` ~ ${formatDateYmd(version.effective_until)}`
                            : ''}
                        </div>
                      </div>
                      <button type="button" className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical size={16} className="text-gray-400" />
                      </button>
                    </div>

                    <div className="text-sm text-gray-600 mb-3">{version.summary || '—'}</div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                      <FileText size={14} />
                      {version.document_storage_key}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRevisionId(version.id);
                          setPreviewTargetId(version.id);
                        }}
                      >
                        <Eye size={14} />
                        미리보기
                      </button>
                      <button
                        type="button"
                        className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDownload(version.id, version.document_storage_key);
                        }}
                      >
                        <Download size={14} />
                        다운로드
                      </button>
                    </div>
                  </div>
                );
              })}
            {!revisionsLoading && revisions.length === 0 && (
              <div className="text-sm text-gray-500 py-8 text-center">등록된 동의서 버전이 없습니다.</div>
            )}
          </div>
        </div>

        {/* PDF Preview Panel */}
        <div
          className="bg-white p-6"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <h2 className="text-lg font-bold text-gray-900 mb-4">PDF 미리보기</h2>

          {selectedRevisionId != null && selectedRev ? (
            <>
              {/* Meta Info */}
              <div className="bg-[#F6F8FB] p-4 rounded-xl mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs mb-1">버전</div>
                    <div className="font-semibold text-gray-900">
                      {displayVersionCode(selectedRev.version_code)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">상태</div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        mapApiRevisionStatus(selectedRev.status),
                      )}`}
                    >
                      {mapApiRevisionStatus(selectedRev.status)}
                    </span>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">적용일</div>
                    <div className="font-medium text-gray-900">
                      {formatDateYmd(selectedRev.effective_from)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">승인·담당</div>
                    <div className="font-medium text-gray-900">
                      {selectedRev.approver_label?.trim() || '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-100 rounded-xl aspect-[3/4] overflow-hidden flex flex-col min-h-[480px]">
                {previewTargetId === selectedRevisionId && previewLoading && (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                    PDF 불러오는 중…
                  </div>
                )}
                {previewTargetId === selectedRevisionId && !previewLoading && previewError && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-red-600">
                    <span>{previewError}</span>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs hover:bg-red-50"
                      onClick={() => {
                        setPreviewTargetId(null);
                        queueMicrotask(() => setPreviewTargetId(selectedRev.id));
                      }}
                    >
                      다시 시도
                    </button>
                  </div>
                )}
                {previewTargetId === selectedRevisionId && !previewLoading && !previewError && previewUrl && (
                  <iframe
                    title="데이터 컨트랙트 PDF"
                    src={previewUrl}
                    className="w-full flex-1 min-h-[480px] border-0 bg-white"
                  />
                )}
                {(previewTargetId == null || previewTargetId !== selectedRevisionId) &&
                  !previewLoading && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-6">
                      <FileText className="w-16 h-16 text-gray-300" />
                      <p className="text-sm text-gray-500 text-center max-w-sm">
                        PDF 용량이 클 수 있어, 버전만 선택했을 때는 자동으로 불러오지 않습니다.
                      </p>
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#5B3BFA] to-[#00B4FF] text-white text-sm font-medium"
                        onClick={() => setPreviewTargetId(selectedRev.id)}
                      >
                        PDF 미리보기 불러오기
                      </button>
                      <div className="text-xs text-gray-400 break-all text-center">
                        {selectedRev.document_storage_key}
                      </div>
                    </div>
                  )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                  onClick={() => void handleDownload(selectedRev.id, selectedRev.document_storage_key)}
                >
                  이 버전 다운로드
                </button>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 rounded-xl aspect-[3/4] flex items-center justify-center">
              <div className="text-center text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <div className="text-sm">버전을 선택하세요</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Section */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        {/* Tab Navigation */}
        <div className="flex gap-4 border-b border-gray-200 mb-6">
          <button
            className={`px-4 py-3 font-semibold transition-all relative ${
              activeTab === 'items'
                ? 'text-[#5B3BFA]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('items')}
          >
            동의 항목 관리
            {activeTab === 'items' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B3BFA]"></div>
            )}
          </button>
          <button
            className={`px-4 py-3 font-semibold transition-all relative ${
              activeTab === 'status'
                ? 'text-[#5B3BFA]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('status')}
          >
            적용 현황
            {activeTab === 'status' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B3BFA]"></div>
            )}
          </button>
        </div>

        {/* Tab Content: Consent Items */}
        {activeTab === 'items' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Items List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">동의 항목 목록</h3>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
                    onClick={() => toast.info('수정 요청')}
                  >
                    <Lock size={14} />
                    수정 요청
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {consentItems.map((item) => (
                  <div key={item.id} className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{item.title}</span>
                          {item.required ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold">
                              필수
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                              선택
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          노출 대상: {item.target} | 버전: {displayCurrentVersionLabel}
                        </div>
                        <p className="text-sm text-gray-600">{item.summary}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ml-2 ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-yellow-900">읽기 전용 모드</div>
                    <div className="text-xs text-yellow-700 mt-1">
                      동의 항목 수정은 법무/관리자 권한이 필요합니다. 변경이 필요한 경우 [수정 요청] 버튼을 이용해주세요.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Panel */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">협력사 회원가입 동의 화면 미리보기</h3>
              <div className="bg-[#F6F8FB] p-6 rounded-xl">
                <div className="bg-white p-6 rounded-xl shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-4">개인정보 제3자 제공 동의</h4>

                  <div className="space-y-4 mb-4">
                    {consentItems.map((item) => (
                      <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="mt-1 w-5 h-5 rounded border-gray-300 text-[#5B3BFA] focus:ring-[#5B3BFA]"
                          disabled
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{item.title}</span>
                            {item.required && (
                              <span className="text-red-500 text-sm">*</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{item.summary}</p>
                          <button className="text-xs text-[#5B3BFA] hover:underline mt-1">
                            상세 내용 보기
                          </button>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <label className="flex items-center gap-3 cursor-pointer mb-4">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded border-gray-300 text-[#5B3BFA] focus:ring-[#5B3BFA]"
                        disabled
                      />
                      <span className="font-semibold text-gray-900">전체 동의</span>
                    </label>

                    <button className="w-full px-4 py-3 bg-gray-200 text-gray-400 font-medium rounded-xl cursor-not-allowed">
                      동의하고 계속하기
                    </button>

                    <button className="w-full mt-2 text-sm text-[#5B3BFA] hover:underline">
                      동의서 PDF 보기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Status */}
        {activeTab === 'status' && (
          <div>
            {/* Filters */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">동의서 버전</label>
                <select
                  value={filterVersion}
                  onChange={(e) => setFilterVersion(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                >
                  <option value="">전체</option>
                  {revisions.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      {displayVersionCode(v.version_code)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">동의 상태</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                >
                  <option value="">전체</option>
                  <option value="Pending">미동의</option>
                  <option value="Agreed">동의완료</option>
                  <option value="Refused">동의거부</option>
                  <option value="OnHold">보류</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">검색</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="협력사명 또는 이메일 검색"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  />
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-[#F6F8FB] p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">초대 발송</span>
                  <Send className="w-5 h-5 text-[#5B3BFA]" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{statusCounts.invited}</div>
              </div>
              <div className="bg-[#F6F8FB] p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">가입 시작</span>
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{statusCounts.started}</div>
              </div>
              <div className="bg-[#F6F8FB] p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">동의 완료</span>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{statusCounts.agreed}</div>
              </div>
              <div className="bg-[#F6F8FB] p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">거부/보류</span>
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{statusCounts.refused}</div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">협력사명</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tier</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">국가</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">담당자 이메일</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">동의서 버전</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">동의 상태</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">동의 일시</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierConsents.map((supplier) => (
                    <tr key={supplier.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4 font-medium text-gray-900">{supplier.companyName}</td>
                      <td className="px-4 py-4">
                        <span className="inline-block px-3 py-1 bg-[#5B3BFA] text-white rounded-full text-sm font-semibold">
                          {supplier.tier}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-600">{supplier.country}</td>
                      <td className="px-4 py-4 text-gray-600">{supplier.email}</td>
                      <td className="px-4 py-4 text-gray-900">{supplier.version}</td>
                      <td className="px-4 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(supplier.status)}`}>
                          {supplier.status === 'Agreed' ? '동의완료' : supplier.status === 'Refused' ? '거부' : supplier.status === 'OnHold' ? '보류' : '미동의'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-600 text-sm">
                        {supplier.agreedDate || '-'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => {
                              setSelectedSupplier(supplier.id);
                              setShowLogDrawer(true);
                            }}
                          >
                            로그 보기
                          </button>
                          {supplier.status === 'Pending' && (
                            <button
                              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => toast.info('재발송')}
                            >
                              재발송
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white w-full max-w-2xl"
            style={{
              borderRadius: '20px',
              boxShadow: '0px 4px 16px rgba(0,0,0,0.1)',
            }}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">새 버전 등록 요청</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">요청 유형</label>
                <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]">
                  <option>새 버전 등록</option>
                  <option>기존 버전 적용</option>
                  <option>수정 요청</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">적용 예정일</label>
                <input
                  type="date"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">변경 사유/요약</label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  placeholder="변경이 필요한 이유를 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">검토자 지정</label>
                <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]">
                  <option>김법무 (법무팀)</option>
                  <option>이관리 (관리팀)</option>
                </select>
              </div>

              {/* Status Flow */}
              <div className="bg-[#F6F8FB] p-4 rounded-xl">
                <div className="text-sm font-semibold text-gray-700 mb-3">예상 처리 흐름</div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg font-medium">Draft</div>
                  <ChevronRight size={16} className="text-gray-400" />
                  <div className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium">Review</div>
                  <ChevronRight size={16} className="text-gray-400" />
                  <div className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg font-medium">Approved</div>
                  <ChevronRight size={16} className="text-gray-400" />
                  <div className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg font-medium">Active</div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowRequestModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowRequestModal(false);
                  toast.success('요청이 제출되었습니다');
                }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#5B3BFA] to-[#00B4FF] text-white font-medium rounded-xl transition-all"
              >
                요청 제출
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Drawer */}
      {showLogDrawer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end z-50" onClick={() => setShowLogDrawer(false)}>
          <div
            className="bg-white w-full max-w-md h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">동의 이력 로그</h2>
                <button
                  onClick={() => setShowLogDrawer(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle size={20} className="text-gray-400" />
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {supplierConsents.find(s => s.id === selectedSupplier)?.companyName}
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {[
                  { time: '2026-03-01 14:23', event: '동의 완료', status: 'success' },
                  { time: '2026-03-01 14:20', event: '동의 화면 진입', status: 'info' },
                  { time: '2026-03-01 14:15', event: '가입 시작', status: 'info' },
                  { time: '2026-02-28 10:00', event: '초대 발송', status: 'info' },
                ].map((log, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${log.status === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                      {idx < 3 && <div className="w-0.5 h-12 bg-gray-200 my-1"></div>}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="font-semibold text-gray-900">{log.event}</div>
                      <div className="text-xs text-gray-500 mt-1">{log.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
