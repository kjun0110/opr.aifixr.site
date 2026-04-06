'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ThumbsDown, ThumbsUp, Calendar as CalendarIcon, RotateCcw } from 'lucide-react';
import {
  listMyNotifications,
  markNotificationRead,
  type NotificationItemOut,
} from '../../../lib/api/notification';
import { approveSignupRequest, rejectSignupRequest } from '../../../lib/api/iam';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Calendar } from '../../components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Separator } from '../../components/ui/separator';
import { cn } from '../../components/ui/utils';

type NotificationType =
  | 'DATA_UPDATE'
  | 'PCF_CALC'
  | 'APPROVAL_REQUEST'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUBMITTED'
  | 'PARTNER_ENTRY';

type Notification = {
  id: string;
  type: NotificationType;
  tier: number;
  customerId: string;
  customerName: string;
  productName: string;
  siteName: string;
  companyName: string;
  timestamp: string; // ISO string
  message: string;
  isActionRequired: boolean; // 승인 요청 시 true (원청사가 승인/반려 필요)
  isRead?: boolean; // 미읽음 여부
  direction: 'inbox' | 'outbox'; // 수신함: 협력사→원청사, 발신함: 원청사→협력사
  /** KJ nt_user_notifications.id */
  backendId?: number;
  fromApi?: boolean;
  signupRequestId?: number;

  // APPROVAL_REQUEST 상세에 쓰는 필드
  requesterName?: string;
  requesterEmail?: string;
  requestMessage?: string;
  dataContractVersion?: string;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// 협력사 테이블용: 날짜/시간 분리
const formatDatePart = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};
const formatTimePart = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const getTypeBadge = (type: NotificationType) => {
  switch (type) {
    case 'DATA_UPDATE':
      return { label: '데이터 제출', className: 'bg-teal-100 text-teal-800 border-teal-200' };
    case 'PCF_CALC':
      return { label: 'PCF 산정', className: 'bg-blue-100 text-blue-800 border-blue-200' };
    case 'APPROVAL_REQUEST':
      return { label: '승인 요청', className: 'bg-yellow-100 text-yellow-900 border-yellow-200' };
    case 'APPROVED':
      return { label: '승인 완료', className: 'bg-green-100 text-green-800 border-green-200' };
    case 'REJECTED':
      return { label: '반려', className: 'bg-red-100 text-red-800 border-red-200' };
    case 'SUBMITTED':
      return { label: '전송/제출', className: 'bg-purple-100 text-purple-800 border-purple-200' };
    case 'PARTNER_ENTRY':
      return { label: '협력사 진입', className: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
    default:
      return { label: type, className: 'bg-gray-100 text-gray-800 border-gray-200' };
  }
};

function mapKjNotification(row: NotificationItemOut): Notification {
  const ts = row.created_at || new Date().toISOString();
  const isRead = Boolean(row.read_at);
  const shared = {
    id: `kj-${row.id}`,
    backendId: row.id,
    fromApi: true as const,
    tier: 1,
    customerId: '',
    customerName: row.title,
    productName: '',
    siteName: '—',
    timestamp: ts,
    isRead,
    direction: 'inbox' as const,
  };

  if (row.notification_type === 'signup_submitted_for_review') {
    const companyMatch = row.body?.match(/「([^」]+)」/);
    const companyName = companyMatch?.[1]?.replace(/님$/, '')?.trim() || '협력사';
    const st = row.signup_request_status;
    const pending =
      st === 'pending_approval' || st === null || st === undefined || st === '';
    let resolvedType: NotificationType = 'APPROVAL_REQUEST';
    if (st === 'approved') resolvedType = 'APPROVED';
    else if (st === 'rejected') resolvedType = 'REJECTED';
    const message = row.body || '프로젝트 진입 요청이 발생했습니다.';
    return {
      ...shared,
      type: resolvedType,
      companyName,
      customerName: row.title,
      message,
      isActionRequired: pending,
      signupRequestId: row.signup_request_id ?? undefined,
      requesterName: `${companyName} 담당자`,
      requestMessage: row.body || undefined,
    };
  }

  if (row.notification_type === 'signup_approved_broadcast') {
    return {
      ...shared,
      type: 'PARTNER_ENTRY',
      companyName: '협력사',
      message: row.body || '',
      isActionRequired: false,
    };
  }

  return {
    ...shared,
    type: 'DATA_UPDATE',
    companyName: '협력사',
    message: row.body || row.title,
    isActionRequired: false,
  };
}

type DateRange = { from?: Date; to?: Date };

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [mailbox, setMailbox] = useState<'inbox' | 'outbox'>('inbox');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showActionRequiredOnly, setShowActionRequiredOnly] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [search, setSearch] = useState<string>('');

  const loadNotifications = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const rows = await listMyNotifications({ limit: 100, offset: 0 });
      setNotifications(rows.map(mapKjNotification));
    } catch (e) {
      setListError(e instanceof Error ? e.message : '알림을 불러오지 못했습니다.');
      setNotifications([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return notifications
      .filter((n) => {
        if (n.direction !== mailbox) return false;

        if (mailbox === 'inbox') {
          if (showUnreadOnly && n.isRead) return false;
          if (showActionRequiredOnly && !n.isActionRequired) return false;
        }

        if (dateRange?.from) {
          const notifDate = startOfDay(new Date(n.timestamp));
          if (dateRange.to) {
            const rangeStart = startOfDay(dateRange.from);
            const rangeEnd = endOfDay(dateRange.to);
            if (!isWithinInterval(notifDate, { start: rangeStart, end: rangeEnd })) return false;
          } else {
            const targetDay = startOfDay(dateRange.from);
            if (notifDate.getTime() !== targetDay.getTime()) return false;
          }
        }

        if (!query) return true;
        const haystack = `${n.companyName} ${n.customerName} ${n.productName} ${n.siteName} ${n.message}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications, mailbox, showUnreadOnly, showActionRequiredOnly, dateRange, search]);

  const inboxCounts = useMemo(() => ({
    total: notifications.filter((n) => n.direction === 'inbox').length,
    unread: notifications.filter((n) => n.direction === 'inbox' && !n.isRead).length,
    actionRequired: notifications.filter((n) => n.direction === 'inbox' && n.isActionRequired).length,
  }), [notifications]);

  const outboxCount = useMemo(
    () => notifications.filter((n) => n.direction === 'outbox').length,
    [notifications]
  );

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return notifications.find((n) => n.id === selectedId) ?? null;
  }, [notifications, selectedId]);

  // 필터 결과에서 선택된 항목이 제외되면 선택 해제 (자동 선택 없음, 협력사와 동일하게 클릭 시에만 상세 표시)
  React.useEffect(() => {
    if (filtered.length === 0 || !selectedId) return;
    if (filtered.some((n) => n.id === selectedId)) return;
    setSelectedId(null);
  }, [filtered, selectedId]);

  const handleSelectNotification = (id: string) => {
    setSelectedId(id);
    const n = notifications.find((x) => x.id === id);
    if (n?.fromApi && n.backendId != null && !n.isRead) {
      void markNotificationRead(n.backendId)
        .then(() => {
          setNotifications((prev) =>
            prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)),
          );
        })
        .catch(() => {
          setNotifications((prev) =>
            prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)),
          );
        });
    } else {
      setNotifications((prev) =>
        prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)),
      );
    }
  };

  const handleApprove = async () => {
    if (!selected?.signupRequestId) return;
    setActionLoading(true);
    try {
      await approveSignupRequest(selected.signupRequestId);
      setSelectedId(null);
      await loadNotifications();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '승인 처리에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected?.signupRequestId) return;
    const reason = window.prompt('반려 사유(선택)') ?? '';
    setActionLoading(true);
    try {
      await rejectSignupRequest(selected.signupRequestId, reason.trim() || undefined);
      setSelectedId(null);
      await loadNotifications();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '반려 처리에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const shouldShowApprovalActions =
    selected?.type === 'APPROVAL_REQUEST' &&
    selected?.isActionRequired &&
    Boolean(selected.signupRequestId);

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">알림</h1>
        {listError && (
          <p className="text-sm text-red-600 mb-2" role="alert">
            {listError}
          </p>
        )}
        {listLoading && <p className="text-sm text-gray-500">알림을 불러오는 중…</p>}
      </div>

      {/* 필터 영역 - 기간 선택 + 검색 (협력사와 동일) */}
      <div
        className="bg-white p-6 rounded-2xl border border-gray-200 mb-6"
        style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}
      >
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block mb-2 text-base font-medium text-gray-700">기간 선택</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'min-w-[260px] justify-start text-left font-normal',
                    !dateRange?.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'yyyy.MM.dd', { locale: ko })} ~{' '}
                        {format(dateRange.to, 'yyyy.MM.dd', { locale: ko })}
                      </>
                    ) : (
                      format(dateRange.from, 'yyyy.MM.dd', { locale: ko })
                    )
                  ) : (
                    '기간을 선택하세요 (하루 또는 구간)'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  defaultMonth={dateRange?.from ?? new Date()}
                  selected={
                    dateRange?.from
                      ? { from: dateRange.from, to: dateRange.to }
                      : undefined
                  }
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ko}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex-1 min-w-[200px] max-w-md">
            <label className="block mb-2 text-base font-medium text-gray-700">검색</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="협력사/메시지 검색"
                className="pl-9"
              />
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              setDateRange(undefined);
              setSearch('');
              setShowUnreadOnly(false);
              setShowActionRequiredOnly(false);
            }}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            필터 초기화
          </Button>
        </div>
      </div>

      {/* 수신함 / 발신함 탭 */}
      <div className="flex items-center gap-2 border-b border-gray-200 mb-4">
        <button
          type="button"
          onClick={() => {
            setMailbox('inbox');
          }}
          className={cn(
            'px-4 py-3 text-xl font-bold border-b-2 -mb-px transition-colors',
            mailbox === 'inbox'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          수신함 ({inboxCounts.total}건)
        </button>
        <button
          type="button"
          onClick={() => {
            setMailbox('outbox');
            setShowUnreadOnly(false);
            setShowActionRequiredOnly(false);
          }}
          className={cn(
            'px-4 py-3 text-xl font-bold border-b-2 -mb-px transition-colors',
            mailbox === 'outbox'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          발신함 ({outboxCount}건)
        </button>

        {/* 수신함 전용: 미읽음 / 액션 필요 필터 칩 */}
        {mailbox === 'inbox' && (
          <div className="ml-6 flex items-center gap-2">
            <span className="text-sm text-gray-500">빠른 필터:</span>
            <button
              type="button"
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                showUnreadOnly
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', showUnreadOnly ? 'bg-purple-500' : 'bg-gray-400')} />
              미읽음 {inboxCounts.unread > 0 && `(${inboxCounts.unread})`}
            </button>
            <button
              type="button"
              onClick={() => setShowActionRequiredOnly(!showActionRequiredOnly)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                showActionRequiredOnly
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', showActionRequiredOnly ? 'bg-amber-500' : 'bg-gray-400')} />
              액션 필요 {inboxCounts.actionRequired > 0 && `(${inboxCounts.actionRequired})`}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 리스트 (협력사와 동일: 7:5 비율) */}
        <Card className="col-span-7 overflow-hidden min-w-0">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-xl font-bold">
              {mailbox === 'inbox' ? '수신함' : '발신함'} 목록
            </CardTitle>
            <div className="text-base text-gray-500">{filtered.length}건</div>
          </CardHeader>
          <CardContent className="p-0">
            {mailbox === 'outbox' ? (
              <div className="p-4 text-base text-gray-500">
                발신함은 추후 연동 예정입니다. 수신함에서 프로젝트 진입 요청을 확인해 주세요.
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-base text-gray-500">표시할 알림이 없습니다.</div>
            ) : (
              <>
                {/* 테이블 헤더 */}
                <div
                  className="grid grid-cols-12 gap-2 px-6 py-4 border-b"
                  style={{ backgroundColor: '#F9FAFB' }}
                >
                  <div className="col-span-2 text-sm font-semibold text-gray-500 shrink-0">시간</div>
                  <div className="col-span-2 text-sm font-semibold text-gray-500 shrink-0">유형</div>
                  <div className="col-span-4 text-sm font-semibold text-gray-500 shrink-0">프로젝트</div>
                  <div className="col-span-4 text-sm font-semibold text-gray-500 min-w-0">발신 → 수신</div>
                </div>
                {/* 테이블 바디 */}
                <div className="max-h-[640px] overflow-auto">
                  {filtered.map((n) => {
                    const typeBadge = getTypeBadge(n.type);
                    const active = n.id === selectedId;
                    const projectDisplay = `${n.customerName} / ${n.productName}`;
                    const fromToDisplay = `${n.companyName} → 원청사`;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleSelectNotification(n.id)}
                        className={cn(
                          'w-full text-left grid grid-cols-12 gap-2 px-6 py-4 border-b border-gray-100 transition-all hover:bg-gray-50 min-w-0 relative',
                          !n.isRead && mailbox === 'inbox' && 'bg-blue-50/50'
                        )}
                        style={{ backgroundColor: active ? 'var(--aifix-secondary-light)' : undefined }}
                      >
                        {/* 시간 (미읽음 시 파란점 표시) */}
                        <div className="col-span-2 shrink-0 flex items-start gap-1.5">
                          {mailbox === 'inbox' && !n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-800">
                              {formatDatePart(n.timestamp)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatTimePart(n.timestamp)}
                            </div>
                          </div>
                        </div>
                        {/* 유형 */}
                        <div className="col-span-2 flex flex-wrap items-center gap-1 shrink-0">
                          <Badge className={`border text-sm ${typeBadge.className}`} asChild>
                            <span>{typeBadge.label}</span>
                          </Badge>
                        </div>
                        {/* 프로젝트 */}
                        <div className="col-span-4 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate block">
                            {projectDisplay}
                          </div>
                          <div className="text-sm text-gray-500 truncate block mt-0.5">
                            {n.companyName} · {n.siteName}
                          </div>
                        </div>
                        {/* 발신 → 수신 */}
                        <div className="col-span-4 min-w-0">
                          <div className="text-sm text-gray-800 truncate">
                            <span className="font-medium">{n.companyName}</span>
                            <span className="text-gray-400 mx-0.5">→</span>
                            <span className="font-medium">원청사</span>
                          </div>
                        </div>
                        {/* 간략한 설명 - 협력사와 동일한 형식 */}
                        <div className="col-span-12 mt-1.5 pt-1.5 border-t border-gray-100 text-sm text-gray-500 min-w-0 overflow-hidden">
                          <span className="truncate block">{n.message}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 상세 (협력사와 동일: 더 좁은 영역) */}
        <Card className="col-span-5 min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-bold">알림 상세</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-5">
              {!selected ? (
                <div className="py-12 text-center text-base text-gray-500">
                  알림을 선택하면 상세 정보가 표시됩니다.
                </div>
              ) : (
                <div className="space-y-5">
                  {/* 헤더: 배지 + ID */}
                  <div className="flex items-start justify-between gap-3">
                    <Badge className={`border text-sm ${getTypeBadge(selected.type).className}`} asChild>
                      <span>{getTypeBadge(selected.type).label}</span>
                    </Badge>
                    <span className="text-sm text-gray-400 shrink-0">ID: {selected.id}</span>
                  </div>

                  {/* 프로젝트/제품 */}
                  <div>
                    <div className="text-base font-semibold text-gray-900 break-words">
                      {selected.customerName} / {selected.productName}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {selected.companyName} · {selected.siteName}
                    </div>
                  </div>

                  {/* 시간 */}
                  <div className="text-sm text-gray-500">
                    {formatDateTime(selected.timestamp)}
                  </div>

                  <Separator className="my-4" />

                  {/* 메시지 */}
                  <div className="text-sm text-gray-700 break-words leading-relaxed">
                    {selected.message}
                  </div>

                  {/* 발신 → 수신 */}
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{selected.companyName}</span>
                    <span className="text-gray-400 mx-1">→</span>
                    <span className="font-medium">원청사</span>
                  </div>

                  {/* 승인 요청 상세 */}
                  {shouldShowApprovalActions && (
                    <div className="space-y-4 pt-2">
                      <Separator />
                      <div>
                        <div className="text-sm font-semibold text-gray-900 mb-3">승인 요청 상세</div>
                        <div className="space-y-2 text-sm">
                          <div className="flex gap-2">
                            <span className="text-gray-500 shrink-0 w-20">요청자</span>
                            <span className="text-gray-800">{selected.requesterName ?? '-'}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-500 shrink-0 w-20">이메일</span>
                            <span className="text-gray-800 break-all">{selected.requesterEmail ?? '-'}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-500 shrink-0 w-20">동의서 버전</span>
                            <span className="text-gray-800">{selected.dataContractVersion ?? '-'}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-500 shrink-0 w-20">요청 메시지</span>
                            <span className="text-gray-800 break-words">{selected.requestMessage ?? '-'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => void handleApprove()}
                          size="sm"
                          disabled={actionLoading}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <ThumbsUp size={14} className="mr-1.5" />
                          승인
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleReject()}
                          disabled={actionLoading}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <ThumbsDown size={14} className="mr-1.5" />
                          반려
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/dashboard/project-supply-chain">공급망 보기</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

