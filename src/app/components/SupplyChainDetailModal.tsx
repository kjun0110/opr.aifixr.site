import { X, CheckCircle, AlertTriangle, Package, Building2 } from 'lucide-react';

interface DataNode {
  id: string;
  tier: string;
  companyName: string;
  companyNameEn: string;
  country: string;
  supplierType: string;
  feoc: boolean;
  rmi: boolean;
  certExpiry: string | null;
  connectedProducts: number;
  riskLevel: 'high' | 'medium' | 'low';
  alternativeAvailable: boolean;
  scope1: number;
  scope2: number;
  mainMaterial: string;
  emissionSource: string;
  pcfResult: number;
  dqr: number;
  submissionStatus: 'verified' | 'submitted' | 'pending';
  lastUpdate: string;
  children?: DataNode[];
}

interface Props {
  company: DataNode;
  onClose: () => void;
}

// Mock connected products
const mockConnectedProducts = [
  { id: '1', name: 'Battery Module A', project: 'BMW Munich', tier: 'Tier 1' },
  { id: '2', name: 'Battery Module B', project: 'BMW Berlin', tier: 'Tier 1' },
  { id: '3', name: 'Power Pack C', project: 'Audi Q5', tier: 'Tier 2' },
];

// Mock certification details
const mockCertifications = [
  {
    type: 'RMI Conformant Smelter',
    number: 'RMI-2023-001234',
    issueDate: '2023-01-15',
    expiryDate: '2026-12-31',
    status: 'active',
  },
  {
    type: 'ISO 14001',
    number: 'ISO-14001-2024',
    issueDate: '2024-03-01',
    expiryDate: '2027-02-28',
    status: 'active',
  },
];

// Mock alternative suppliers
const mockAlternatives = [
  { id: '1', name: 'Alternative Battery Co.', country: 'Japan', tier: 'Tier 1', certified: true },
  { id: '2', name: 'Backup Cell Tech', country: 'Taiwan', tier: 'Tier 2', certified: true },
];

export default function SupplyChainDetailModal({ company, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white w-full overflow-auto"
        style={{
          maxWidth: '1200px',
          minHeight: '650px',
          maxHeight: '90vh',
          borderRadius: '20px',
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">{company.companyName}</h2>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    company.tier === 'Tier 0'
                      ? 'bg-gray-100 text-gray-700 border-2 border-[#5B3BFA]'
                      : 'bg-[#5B3BFA] text-white'
                  }`}
                >
                  {company.tier}
                </span>
                {company.tier === 'Tier 0' && (
                  <span className="inline-block px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-semibold">
                    원청
                  </span>
                )}
              </div>
              <p className="text-gray-600">{company.companyNameEn}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div
            className="p-6 bg-[#F6F8FB]"
            style={{
              borderRadius: '16px',
            }}
          >
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#5B3BFA]" />
              기본 정보
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-600">국가:</span>
                <p className="font-medium">{company.country}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">공급자 유형:</span>
                <p className="font-medium">{company.supplierType}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">리스크 등급:</span>
                <div className="mt-1">
                  {company.riskLevel === 'high' && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      높음
                    </span>
                  )}
                  {company.riskLevel === 'medium' && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                      중간
                    </span>
                  )}
                  {company.riskLevel === 'low' && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      낮음
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-600">연결 제품 수:</span>
                <p className="font-medium text-[#5B3BFA]">{company.connectedProducts}개</p>
              </div>
            </div>
          </div>

          {/* Connected Products */}
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#5B3BFA]" />
              연결 제품 리스트
            </h3>
            <div className="space-y-2">
              {mockConnectedProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-4 bg-white border border-gray-200 hover:border-[#5B3BFA] transition-colors"
                  style={{ borderRadius: '12px' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-600">{product.project}</div>
                    </div>
                    <span className="px-3 py-1 bg-[#5B3BFA] text-white rounded-full text-sm font-semibold">
                      {product.tier}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supply Chain Structure */}
          <div>
            <h3 className="text-lg font-bold mb-4">공급망 차수 구조</h3>
            <div className="p-4 bg-[#F6F8FB]" style={{ borderRadius: '12px' }}>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="px-4 py-2 bg-white border-2 border-[#5B3BFA] rounded-lg font-semibold">
                    Tier 0
                  </div>
                  <div className="text-xs text-gray-600 mt-1">원청</div>
                </div>
                <div className="text-2xl text-gray-400">→</div>
                <div className="text-center">
                  <div className="px-4 py-2 bg-[#5B3BFA] text-white rounded-lg font-semibold">
                    {company.tier}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">현재</div>
                </div>
                {company.tier !== 'Tier 3' && (
                  <>
                    <div className="text-2xl text-gray-400">→</div>
                    <div className="text-center">
                      <div className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg font-semibold">
                        Tier {parseInt(company.tier.split(' ')[1]) + 1}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">하위 차수</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Certification Details */}
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#5B3BFA]" />
              인증 상세 정보
            </h3>
            <div className="space-y-3">
              {mockCertifications.map((cert, index) => (
                <div
                  key={index}
                  className="p-4 bg-white border border-gray-200"
                  style={{ borderRadius: '12px' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium">{cert.type}</div>
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      활성
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">인증번호:</span>
                      <p className="font-medium">{cert.number}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">발급일:</span>
                      <p className="font-medium">{cert.issueDate}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">만료일:</span>
                      <p className="font-medium">{cert.expiryDate}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Critical Minerals */}
          <div>
            <h3 className="text-lg font-bold mb-4">핵심 광물 포함 여부</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200" style={{ borderRadius: '12px' }}>
                <div className="text-sm text-gray-600 mb-1">리튬 (Lithium)</div>
                <div className="text-2xl font-bold text-blue-700">15%</div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200" style={{ borderRadius: '12px' }}>
                <div className="text-sm text-gray-600 mb-1">코발트 (Cobalt)</div>
                <div className="text-2xl font-bold text-purple-700">8%</div>
              </div>
              <div className="p-4 bg-green-50 border border-green-200" style={{ borderRadius: '12px' }}>
                <div className="text-sm text-gray-600 mb-1">니켈 (Nickel)</div>
                <div className="text-2xl font-bold text-green-700">12%</div>
              </div>
            </div>
          </div>

          {/* FEOC & RMI Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#F6F8FB]" style={{ borderRadius: '12px' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">FEOC 상태</span>
                {company.feoc ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
              </div>
              <p className="text-lg font-semibold">
                {company.feoc ? 'FEOC 준수' : 'FEOC 미준수'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                최근 업데이트: 2026-02-15
              </p>
            </div>

            <div className="p-4 bg-[#F6F8FB]" style={{ borderRadius: '12px' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">RMI 인증</span>
                {company.rmi ? (
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <p className="text-lg font-semibold">
                {company.rmi ? 'RMI 인증 보유' : 'RMI 미인증'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {company.certExpiry ? `만료일: ${company.certExpiry}` : '-'}
              </p>
            </div>
          </div>

          {/* Alternative Suppliers */}
          {company.alternativeAvailable && (
            <div>
              <h3 className="text-lg font-bold mb-4">대체 공급사</h3>
              <div className="space-y-2">
                {mockAlternatives.map((alt) => (
                  <div
                    key={alt.id}
                    className="p-4 bg-white border border-gray-200 hover:border-[#5B3BFA] transition-colors"
                    style={{ borderRadius: '12px' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{alt.name}</div>
                        <div className="text-sm text-gray-600">{alt.country}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-[#5B3BFA] text-white rounded-full text-sm font-semibold">
                          {alt.tier}
                        </span>
                        {alt.certified && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Update Information */}
          <div className="p-4 bg-gray-50 border border-gray-200" style={{ borderRadius: '12px' }}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">최근 업데이트:</span>
              <span className="font-medium">2026-03-01 14:25</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}