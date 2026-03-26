'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Upload, Plus, FileText, Eye, Send, CheckCircle, Clock, AlertCircle, Check, XCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useMode } from '../context/ModeContext';
import { getInvitationHistory, postOprInvitation, type InvitationHistoryItem } from '@/lib/api/invitation';
import { apiFetch } from '@/lib/api/client';
import { approveSignupRequest, rejectSignupRequest } from '@/lib/api/iam';

type Recipient = { company: string; email: string; contactName: string; scopeId?: string };
type Tier1Supplier = {
  id: string;
  name: string;
  nameEn?: string;
  supplierId?: number;
  projectId?: number;
  productId?: number;
  productVariantId?: number;
};

type RecipientCardProps = {
  index: number;
  recipient: Recipient;
  onChange: (next: Recipient) => void;
  onRemove?: () => void;
  eligibleTier1Suppliers: Array<Tier1Supplier>;
  supplierEmailById: Record<string, string>;
};

function RecipientCard({
  index,
  recipient,
  onChange,
  onRemove,
  eligibleTier1Suppliers,
  supplierEmailById,
}: RecipientCardProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = recipient.company.trim().toLowerCase();
    if (!q) return eligibleTier1Suppliers;
    return eligibleTier1Suppliers.filter(
      s =>
        s.name.trim().toLowerCase().includes(q) || (s.nameEn ?? '').toLowerCase().includes(q),
    );
  }, [recipient.company, eligibleTier1Suppliers]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  return (
    <div className="p-4 border border-gray-200 rounded-2xl bg-white">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="text-sm font-semibold text-gray-900">발신인 {index + 1}</div>
        {index > 0 && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-all"
            aria-label="발신인 카드 삭제"
            title="삭제"
          >
            <XCircle size={18} className="text-gray-500" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">회사명</label>
          <div ref={wrapRef} className="relative">
            <input
              type="text"
              value={recipient.company}
              onChange={(e) => onChange({ ...recipient, company: e.target.value, scopeId: undefined })}
              onFocus={() => setOpen(true)}
              placeholder="회사명 (등록된 1차 협력사)"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />

            {open && (
              <div className="absolute left-0 right-0 z-20 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {filtered.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-gray-500">검색 결과가 없습니다</div>
                ) : (
                  filtered.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onChange({
                          ...recipient,
                          company: s.name,
                          scopeId: s.id,
                          email: recipient.email.trim()
                            ? recipient.email
                            : (supplierEmailById[s.id] ?? ''),
                        });
                        setOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-purple-50 transition-all"
                    >
                      <div className="text-sm font-medium text-gray-900">{s.name}</div>
                      {s.nameEn ? <div className="text-xs text-gray-500">{s.nameEn}</div> : null}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">담당자 이름</label>
            <input
              type="text"
              value={recipient.contactName}
              onChange={(e) => onChange({ ...recipient, contactName: e.target.value })}
              placeholder="담당자 이름"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">담당자 이메일</label>
            <input
              type="email"
              value={recipient.email}
              onChange={(e) => onChange({ ...recipient, email: e.target.value })}
              placeholder="이메일"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Invite() {
  const { mode } = useMode();

  const [recipients, setRecipients] = useState<Array<Recipient>>([
    { company: '', email: '', contactName: '' },
  ]);
  const [eligibleTier1Suppliers, setEligibleTier1Suppliers] = useState<Array<Tier1Supplier>>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [subject, setSubject] = useState('[AIFIX] 공급망 관리 시스템 회원가입 안내');
  const [body, setBody] = useState(`안녕하세요,

귀사와의 원활한 공급망 관리를 위해 AIFIX 시스템 회원가입을 안내드립니다.

아래 링크를 통해 회원가입을 진행해 주시기 바랍니다:
https://aifix.com/signup

회원가입 시 제3자 제공 동의서에 대한 동의가 필요하며, 첨부된 문서를 확인해 주시기 바랍니다.

감사합니다.`);
  const [selectedVersion, setSelectedVersion] = useState('v2.0 (2026.01)');

  const contractVersions = [
    { value: 'v1.0 (2025.02)', label: 'v1.0 (2025.02)' },
    { value: 'v1.1 (2025.05)', label: 'v1.1 (2025.05)' },
    { value: 'v2.0 (2026.01)', label: 'v2.0 (2026.01)' },
  ];

  const [sentHistory, setSentHistory] = useState<Array<{
    company: string;
    email: string;
    sentDate: string;
    version: string;
    status: string;
    opened: boolean;
    projectAccess: string;
    signupRequestId?: number;
  }>>([
    { company: '(주)테크노소재', email: 'contact@techno.com', sentDate: '2026.02.28 14:30', version: 'v2.0', status: 'opened', opened: true, projectAccess: 'approved' },
    { company: '글로벌파트너스', email: 'info@global.com', sentDate: '2026.02.27 11:20', version: 'v2.0', status: 'sent', opened: false, projectAccess: 'pending' },
    { company: '신소재산업(주)', email: 'admin@newmat.com', sentDate: '2026.02.26 16:45', version: 'v2.0', status: 'opened', opened: true, projectAccess: 'pending' },
    { company: '한국부품제조', email: 'parts@korea.com', sentDate: '2026.02.25 09:15', version: 'v1.1', status: 'sent', opened: false, projectAccess: 'pending' },
    { company: '아시아컴포넌트', email: 'contact@asia.com', sentDate: '2026.02.24 13:00', version: 'v2.0', status: 'opened', opened: true, projectAccess: 'approved' },
    { company: '(주)녹색소재', email: 'green@eco.com', sentDate: '2026.02.23 10:30', version: 'v2.0', status: 'failed', opened: false, projectAccess: 'rejected' },
  ]);

  const csvInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // DB에서 등록된 1차 협력사 목록 가져오기
    const loadTier1Suppliers = async () => {
      setLoadingSuppliers(true);
      try {
        const customers = await apiFetch<any[]>('/api/supply-chain/project-supply-chain/customers');
        
        const allTier1: Tier1Supplier[] = [];
        
        for (const customer of customers) {
          const branches = await apiFetch<any[]>(`/api/supply-chain/project-supply-chain/customers/${customer.id}/branches`);
          
          for (const branch of branches) {
            const project = await apiFetch<any>(`/api/supply-chain/project-supply-chain/branches/${branch.id}/project`);
            const products = await apiFetch<any[]>(`/api/supply-chain/project-supply-chain/projects/${project.id}/products`);
            
            for (const product of products) {
              const variants = await apiFetch<any[]>(`/api/supply-chain/project-supply-chain/projects/${project.id}/products/${product.id}/product-variants`);
              
              for (const variant of variants) {
                const nodes = await apiFetch<any[]>(`/api/supply-chain/project-supply-chain/projects/${project.id}/product-variants/${variant.id}/nodes`);
                
                const tier1Nodes = nodes.filter((n: any) => 
                  (n.tier === 1 || (n.tier === null && n.status === 'added'))
                );
                
                for (const node of tier1Nodes) {
                  // supplier_id로 중복 체크 (같은 협력사가 여러 프로젝트/제품에 있어도 한 번만 표시)
                  if (!allTier1.some(t => t.supplierId === node.supplier_id)) {
                    const compositeId = `${project.id}:${product.id}:${variant.id}:${node.supplier_id}`;
                    allTier1.push({
                      id: compositeId,
                      name: node.supplier_name,
                      nameEn: node.supplier_code || undefined,
                      supplierId: node.supplier_id,
                      projectId: project.id,
                      productId: product.id,
                      productVariantId: variant.id,
                    });
                  }
                }
              }
            }
          }
        }
        
        setEligibleTier1Suppliers(allTier1);
      } catch (error) {
        console.error('1차 협력사 목록 로드 실패:', error);
        toast.error('1차 협력사 목록을 불러오는데 실패했습니다');
      } finally {
        setLoadingSuppliers(false);
      }
    };

    void loadTier1Suppliers();

    // 초대 페이지 진입 시 최근 이력 조회
    void getInvitationHistory({ limit: 50 })
      .then((rows) => {
        console.log('초대 히스토리 API 응답:', rows);
        const mapped = rows.map((r: InvitationHistoryItem) => ({
          company: r.invitee_company_hint || '-',
          email: r.invitee_email || '-',
          sentDate: new Date(r.created_at).toLocaleString(),
          version: 'v2.0',
          status: r.status === 'failed' ? 'failed' : 'sent',
          opened: r.status === 'in_progress' || r.status === 'completed',
          projectAccess:
            r.status === 'completed'
              ? 'approved'
              : r.status === 'revoked'
                ? 'rejected'
                : r.status === 'in_progress'
                  ? 'pending'
                  : 'waiting',
          signupRequestId: r.last_signup_request_id ?? undefined,
        }));
        console.log('매핑된 히스토리:', mapped);
        setSentHistory(mapped);
      })
      .catch((error) => {
        console.error('초대 히스토리 조회 실패:', error);
        // 이력 API 실패 시 기존 mock 표시 유지
      });
  }, []);

  const supplierEmailById = useMemo(() => {
    return {} as Record<string, string>;
  }, []);

  const normalizeTier1Company = (companyInput: string, scopeId?: string) => {
    if (scopeId) {
      const byScope = eligibleTier1Suppliers.find(s => s.id === scopeId);
      if (byScope) return byScope;
    }
    const normalizedCompany = companyInput.trim().toLowerCase();
    if (!normalizedCompany) return undefined;

    const exactMatch =
      eligibleTier1Suppliers.find(s => s.name.trim().toLowerCase() === normalizedCompany) ??
      eligibleTier1Suppliers.find(s => (s.nameEn ?? '').trim().toLowerCase() === normalizedCompany);

    const partialMatches = eligibleTier1Suppliers.filter((s) => {
      const nameKo = s.name.trim().toLowerCase();
      const nameEn = (s.nameEn ?? '').trim().toLowerCase();
      return nameKo.includes(normalizedCompany) || nameEn.includes(normalizedCompany);
    });

    return exactMatch ?? (partialMatches.length === 1 ? partialMatches[0] : undefined);
  };

  const handleAddSender = () => {
    setRecipients(prev => [...prev, { company: '', email: '', contactName: '' }]);
  };

  const handleSend = async () => {
    const nonEmptyCards = recipients.filter(r => r.company.trim() || r.email.trim() || r.contactName.trim());

    if (nonEmptyCards.length === 0) {
      toast.error('발신인을 추가해주세요');
      return;
    }

    for (const r of nonEmptyCards) {
      if (!r.company.trim()) {
        toast.error('회사명을 입력해주세요');
        return;
      }
      if (!r.email.trim()) {
        toast.error('이메일을 입력해주세요');
        return;
      }
      if (!r.contactName.trim()) {
        toast.error('담당자 이름을 입력해주세요');
        return;
      }

      const matched = normalizeTier1Company(r.company, r.scopeId);
      if (!matched) {
        toast.error('등록된 1차 협력사에서 회사를 선택해주세요');
        return;
      }
      if (!matched.projectId || !matched.productVariantId || !matched.supplierId) {
        toast.error('공급망에서 등록한 1차 협력사 항목을 다시 선택해 주세요');
        return;
      }
    }

    let success = 0;
    const failMessages: string[] = [];
    for (const r of nonEmptyCards) {
      const matched = normalizeTier1Company(r.company, r.scopeId);
      if (!matched?.supplierId || !matched.productVariantId) continue;
      try {
        await postOprInvitation({
          product_variant_id: matched.productVariantId,
          supplier_id: matched.supplierId,
          invitee: {
            company_name: r.company.trim(),
            contact_name: r.contactName.trim(),
            email: r.email.trim(),
          },
          expire_days: 3,
        });
        success += 1;
      } catch (e) {
        failMessages.push(e instanceof Error ? e.message : '발송 실패');
      }
    }
    if (success > 0) {
      toast.success(`${success}건 초대 메일 발송 완료`);
      setRecipients([{ company: '', email: '', contactName: '' }]);
      try {
        const rows = await getInvitationHistory({ limit: 50 });
        const mapped = rows.map((r: InvitationHistoryItem) => ({
          company: r.invitee_company_hint || '-',
          email: r.invitee_email || '-',
          sentDate: new Date(r.created_at).toLocaleString(),
          version: 'v2.0',
          status: r.status === 'failed' ? 'failed' : 'sent',
          opened: r.status === 'in_progress' || r.status === 'completed',
          projectAccess:
            r.status === 'completed'
              ? 'approved'
              : r.status === 'revoked'
                ? 'rejected'
                : r.status === 'in_progress'
                  ? 'pending'
                  : 'waiting',
        }));
        setSentHistory(mapped);
      } catch {
        // ignore refresh fail
      }
    }
    if (failMessages.length > 0) {
      toast.error(`실패 ${failMessages.length}건: ${failMessages[0]}`);
    }
  };

  const parseCSVLine = (line: string) => {
    // 간단한 CSV 파서(콤마 + 큰따옴표 처리)
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const handleCSVUpload = () => {
    csvInputRef.current?.click();
  };

  const onCsvFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const rows = text
          .replace(/\r/g, '')
          .split('\n')
          .map(r => r.trim())
          .filter(Boolean);

        if (rows.length === 0) {
          toast.error('CSV 파일이 비어있습니다');
          return;
        }

        // 헤더 여부 체크(대충 포함되는 키워드로 판단)
        const header = parseCSVLine(rows[0]).map(c => c.toLowerCase());
        const hasHeader = header.some(c => c.includes('회사') || c.includes('company')) ||
          header.some(c => c.includes('email')) ||
          header.some(c => c.includes('담당') || c.includes('contact'));

        const startIdx = hasHeader ? 1 : 0;

        const normalizedSuppliers = eligibleTier1Suppliers.map(s => ({
          id: s.id,
          name: s.name.trim().toLowerCase(),
        }));

        let successCount = 0;
        let skippedCount = 0;
        const next: Recipient[] = [];

        for (let i = startIdx; i < rows.length; i++) {
          const cols = parseCSVLine(rows[i]);
          const company = cols[0] ?? '';
          const email = cols[1] ?? '';
          const contactName = cols[2] ?? '';

          const companyKey = company.trim().toLowerCase();
          if (!companyKey || !email.trim()) continue;

          const isRegistered = normalizedSuppliers.some(s => s.name === companyKey);
          if (!isRegistered) {
            skippedCount++;
            continue;
          }

          const matched = eligibleTier1Suppliers.find(s => s.name.trim().toLowerCase() === companyKey);
          next.push({
            company: matched?.name ?? company.trim(),
            email: email.trim(),
            contactName: contactName.trim() || '-',
          });
          successCount++;
        }

        setRecipients(next.length > 0 ? next : [{ company: '', email: '', contactName: '' }]);
        toast.success(`CSV 업로드 완료: 성공 ${successCount}건, 스킵 ${skippedCount}건`);
      } catch {
        toast.error('CSV 파싱에 실패했습니다');
      } finally {
        if (csvInputRef.current) csvInputRef.current.value = '';
      }
    };

    reader.readAsText(file, 'utf-8');
  };

  const getStatusIcon = (status: string, opened: boolean) => {
    if (status === 'failed') {
      return <AlertCircle size={16} className="text-red-500" />;
    }
    if (opened) {
      return <CheckCircle size={16} className="text-teal-500" />;
    }
    return <Clock size={16} className="text-gray-400" />;
  };

  const getStatusText = (status: string, opened: boolean) => {
    if (status === 'failed') return '전송실패';
    if (opened) return '열람확인';
    return '전송완료';
  };

  const handleApprove = async (index: number) => {
    const item = sentHistory[index];
    if (!item.signupRequestId) {
      toast.error('가입 신청 ID가 없습니다');
      return;
    }
    
    try {
      await approveSignupRequest(item.signupRequestId);
      const updatedHistory = [...sentHistory];
      updatedHistory[index].projectAccess = 'approved';
      setSentHistory(updatedHistory);
      toast.success(`${item.company}의 프로젝트 진입을 승인했습니다`);
    } catch (error) {
      console.error('승인 실패:', error);
      toast.error('승인 처리에 실패했습니다');
    }
  };

  const handleReject = async (index: number) => {
    const item = sentHistory[index];
    if (!item.signupRequestId) {
      toast.error('가입 신청 ID가 없습니다');
      return;
    }
    
    try {
      await rejectSignupRequest(item.signupRequestId, '원청 담당자가 반려했습니다');
      const updatedHistory = [...sentHistory];
      updatedHistory[index].projectAccess = 'rejected';
      setSentHistory(updatedHistory);
      toast.error(`${item.company}의 프로젝트 진입을 반려했습니다`);
    } catch (error) {
      console.error('반려 실패:', error);
      toast.error('반려 처리에 실패했습니다');
    }
  };

  const getProjectAccessBadge = (projectAccess: string) => {
    switch (projectAccess) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            승인완료
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium">
            <XCircle className="w-3 h-3" />
            반려됨
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-medium">
            <Clock className="w-3 h-3" />
            승인대기
          </span>
        );
      case 'waiting':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
            <Clock className="w-3 h-3" />
            진입대기
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* 페이지 헤더 */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">협력사 초대</h1>
            <p className="text-gray-600">1차 협력사에게 회원가입 안내 메일을 발송하세요</p>
          </div>
          
          {/* ESG 직무 View Only 배지 */}
          {mode === 'pcf' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-2 border-blue-300 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">View Only – PCF 담당자 권한</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 좌측: 메일 작성 영역 */}
        <div
          className="bg-white p-6"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <h2 className="text-lg font-bold text-gray-900 mb-6">초대 메일 작성</h2>

          {/* ESG 직무: 안내 문구 표시 */}
          {mode === 'pcf' ? (
            <div className="py-20 text-center">
              <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-blue-400" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">협력사 초대는 구매 직무 전용 기능입니다</h3>
              <p className="text-gray-600 mb-2">
                협력사 초대 및 공급망 관계 관리는 구매 직무에서 수행하는 업무입니다.
              </p>
              <p className="text-gray-500 text-sm">
                PCF 담당자는 초대 현황 조회만 가능합니다.
              </p>
              <div className="mt-6 inline-block px-4 py-2 bg-gray-100 rounded-lg">
                <p className="text-sm text-gray-700">
                  초대가 필요한 경우 <span className="font-semibold text-purple-600">구매 담당자</span>에게 문의해주세요.
                </p>
              </div>
            </div>
          ) : (
            /* 구매 직무: 기존 메일 작성 영역 */
            <div className="space-y-5">
              {/* 발신인 입력 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-700">발신인</label>
                </div>

                <div className="space-y-3 mb-4">
                  {recipients.map((recipient, idx) => (
                    <RecipientCard
                      key={idx}
                      index={idx}
                      recipient={recipient}
                      eligibleTier1Suppliers={eligibleTier1Suppliers}
                      supplierEmailById={supplierEmailById}
                      onChange={(next) => {
                        setRecipients(prev => prev.map((r, i) => (i === idx ? next : r)));
                      }}
                      onRemove={() => {
                        setRecipients(prev => {
                          const next = prev.filter((_, i) => i !== idx);
                          return next.length > 0 ? next : [{ company: '', email: '', contactName: '' }];
                        });
                      }}
                    />
                  ))}
                </div>

                {eligibleTier1Suppliers.length === 0 && (
                  <p className="text-xs text-gray-500 mb-3">
                    프로젝트/공급망 탭에서 1차 협력사를 먼저 등록한 뒤 다시 오세요.
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleAddSender}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-purple-500 text-purple-600 font-medium rounded-xl hover:bg-purple-50 transition-all"
                  >
                    <Plus size={16} />
                    발신인 추가
                  </button>

                  <button
                    onClick={handleCSVUpload}
                    className="flex items-center gap-2 px-4 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
                  >
                    <Upload size={16} />
                    CSV 업로드
                  </button>

                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={onCsvFileChange}
                  />
                </div>
              </div>

              {/* 메일 제목 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">메일 제목</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* 메일 본문 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">메일 본문</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* 제3자 제공 동의서 버전 선택 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">제3자 제공 동의서 버전</label>
                <div className="flex gap-3">
                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                    disabled
                  >
                    {contractVersions.map((version) => (
                      <option key={version.value} value={version.value}>
                        {version.label}
                      </option>
                    ))}
                  </select>
                  <button className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2">
                    <Eye size={16} />
                    미리보기
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">* 제3자 제공 동의서는 법무 확정 PDF로 자동 첨부되며 수정 불가합니다</p>
              </div>

              {/* 첨부파일 표시 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">첨부파일</label>
                <div className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">DATA_CONTRACT_{selectedVersion}.pdf</p>
                      <p className="text-xs text-gray-500">자동 첨부됨</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 발송 버튼 */}
              <button
                onClick={handleSend}
                disabled={!recipients.some(r => r.company.trim() && r.email.trim() && r.contactName.trim())}
                className="w-full py-3.5 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: recipients.some(r => r.company.trim() && r.email.trim() && r.contactName.trim())
                    ? 'linear-gradient(90deg, #5B3BFA, #00B4FF)'
                    : '#e5e7eb',
                  borderRadius: '14px',
                }}
              >
                <Send size={18} />
                초대 메일 발송
              </button>
            </div>
          )}
        </div>

        {/* 우측: 발송 기록 */}
        <div
          className="bg-white p-6"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <h2 className="text-lg font-bold text-gray-900 mb-6">발송 기록</h2>

          <div className="space-y-3">
            {sentHistory.map((item, idx) => (
              <div
                key={idx}
                className="p-4 border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 mb-1">{item.company}</p>
                    <p className="text-sm text-gray-600 mb-2">{item.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(item.status, item.opened)}
                    <span className={`text-xs font-medium ${
                      item.status === 'failed' ? 'text-red-600' : 
                      item.opened ? 'text-teal-600' : 'text-gray-600'
                    }`}>
                      {getStatusText(item.status, item.opened)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span>{item.sentDate}</span>
                  <span className="px-2 py-1 bg-gray-100 rounded-md">{item.version}</span>
                </div>

                {/* 프로젝트 진입 승인 상태 및 버튼 - 구매 직무만 액션 가능 */}
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600 font-medium">프로젝트 진입 승인</div>
                    
                    {/* ESG 직무: 상태 조회만 가능 */}
                    {mode === 'pcf' ? (
                      getProjectAccessBadge(item.projectAccess)
                    ) : (
                      /* 구매 직무: 승인/반려 버튼 표시 */
                      item.projectAccess === 'pending' ? (
                        <div className="flex items-center gap-2">
                          {getProjectAccessBadge(item.projectAccess)}
                          <button
                            onClick={() => handleApprove(idx)}
                            className="px-3 py-1.5 bg-gradient-to-r from-[#00B4FF] to-[#5B3BFA] text-white text-xs font-medium rounded-lg hover:shadow-md transition-all flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            승인
                          </button>
                          <button
                            onClick={() => handleReject(idx)}
                            className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-all flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            반려
                          </button>
                        </div>
                      ) : (
                        getProjectAccessBadge(item.projectAccess)
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>안내:</strong> 발송된 메일은 사내 메일 시스템과 AIFIX 내부에 모두 기록됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}