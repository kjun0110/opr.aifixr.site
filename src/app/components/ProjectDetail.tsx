 'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit, Plus, Package, Network, FileText, Trash2, Play, CheckCircle, Clock, AlertTriangle, Calendar, Building2, Info, BarChart3, X } from 'lucide-react';
import { toast } from 'sonner';
import { useMode } from '../context/ModeContext';

// Product Connection type
interface ProductConnection {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  supplyChainGroupId: string | null;
  supplyChainGroupCode: string | null;
  supplyChainVersionId: string | null;
  supplyChainVersionCode: string | null;
  mbomVersionId: string | null;
  mbomVersionCode: string | null;
  pcfStatus: 'not-calculated' | 'calculating' | 'completed' | 'error';
  pcfResult: {
    totalEmission: number;
    coverage: number;
    dqrAverage: number;
    lastCalculated: string;
  } | null;
}

// Supply Chain Group & Version (from SupplyChainManagement)
interface SupplyChainGroup {
  id: string;
  groupCode: string;
  groupName: string;
  productId: string;
}

interface SupplyChainVersion {
  id: string;
  groupId: string;
  versionCode: string;
  createdDate: string;
  createdReason: string;
  isStructureChanged: boolean;
}

// M-BOM Version
interface MBomVersion {
  id: string;
  versionCode: string;
  productId: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
}

// Mock Data
const mockSupplyChainGroups: SupplyChainGroup[] = [
  { id: 'sg1', groupCode: 'SC-1', groupName: '표준 공급망', productId: 'prod1' },
  { id: 'sg2', groupCode: 'SC-2', groupName: '친환경 공급망', productId: 'prod1' },
  { id: 'sg3', groupCode: 'SC-3', groupName: '차세대 공급망', productId: 'prod2' },
];

const mockSupplyChainVersions: SupplyChainVersion[] = [
  { id: 'scv1', groupId: 'sg1', versionCode: 'SC-1.2', createdDate: '2026-03-01', createdReason: '1차 협력사 변경', isStructureChanged: false },
  { id: 'scv2', groupId: 'sg1', versionCode: 'SC-1.1', createdDate: '2026-02-15', createdReason: 'Tier2 소재 업체 추가', isStructureChanged: true },
  { id: 'scv3', groupId: 'sg2', versionCode: 'SC-2.1', createdDate: '2026-02-20', createdReason: '친환경 소재 협력사 구성', isStructureChanged: false },
];

const mockMBomVersions: MBomVersion[] = [
  { id: 'mb1', versionCode: 'MBOM-2026-01', productId: 'prod1', validFrom: '2026-01-01', validTo: '2026-12-31', isActive: true },
  { id: 'mb2', versionCode: 'MBOM-2025-08', productId: 'prod1', validFrom: '2025-08-01', validTo: '2025-12-31', isActive: false },
  { id: 'mb3', versionCode: 'MBOM-2026-02', productId: 'prod2', validFrom: '2026-02-01', validTo: '2026-12-31', isActive: true },
];

const mockProducts = [
  { id: 'prod1', code: 'BM-A-100', name: '배터리 모듈 A' },
  { id: 'prod2', code: 'SSC-200', name: '전고체 셀' },
  { id: 'prod3', code: 'ESS-300', name: 'ESS 팩' },
];

// Mock Project Detail
const mockProjectDetail = {
  id: 'proj1',
  projectCode: 'SCN-2026-01',
  projectName: 'BMW iX5 배터리 공급',
  customerId: 'cust1',
  customerName: 'BMW',
  deliveryRegion: 'Germany',
  deliveryPlant: 'Munich Plant',
  legalEntity: 'BMW AG',
  productionSite: 'Ulsan Factory',
  period: { start: '2026-01-01', end: '2026-12-31' },
  status: 'completed' as const,
  createdDate: '2026-01-15',
  lastModified: '2026-03-01',
};

const mockProductConnections: ProductConnection[] = [
  {
    id: 'pc1',
    productId: 'prod1',
    productName: '배터리 모듈 A',
    productCode: 'BM-A-100',
    supplyChainGroupId: 'sg1',
    supplyChainGroupCode: 'SC-1',
    supplyChainVersionId: 'scv1',
    supplyChainVersionCode: 'SC-1.2',
    mbomVersionId: 'mb1',
    mbomVersionCode: 'MBOM-2026-01',
    pcfStatus: 'completed',
    pcfResult: {
      totalEmission: 32420.3,
      coverage: 95.5,
      dqrAverage: 1.5,
      lastCalculated: '2026-03-01',
    },
  },
  {
    id: 'pc2',
    productId: 'prod2',
    productName: '전고체 셀',
    productCode: 'SSC-200',
    supplyChainGroupId: 'sg3',
    supplyChainGroupCode: 'SC-3',
    supplyChainVersionId: null,
    supplyChainVersionCode: null,
    mbomVersionId: 'mb3',
    mbomVersionCode: 'MBOM-2026-02',
    pcfStatus: 'not-calculated',
    pcfResult: null,
  },
];

export default function ProjectDetail() {
  const { projectId } = useParams();
  const router = useRouter();
  const { mode } = useMode();

  // UI States
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingConnectionId, setDeletingConnectionId] = useState<string | null>(null);
  const [productConnections, setProductConnections] = useState<ProductConnection[]>(mockProductConnections);
  const [editingConnection, setEditingConnection] = useState<ProductConnection | null>(null);

  // Form states for adding/editing product connection
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedSupplyChainGroup, setSelectedSupplyChainGroup] = useState<string>('');
  const [selectedSupplyChainVersion, setSelectedSupplyChainVersion] = useState<string>('');
  const [selectedMBomVersion, setSelectedMBomVersion] = useState<string>('');

  // Filter available options based on selected product
  const availableSupplyChainGroups = selectedProduct 
    ? mockSupplyChainGroups.filter(g => g.productId === selectedProduct)
    : [];

  const availableSupplyChainVersions = selectedSupplyChainGroup
    ? mockSupplyChainVersions.filter(v => v.groupId === selectedSupplyChainGroup)
    : [];

  const availableMBomVersions = selectedProduct
    ? mockMBomVersions.filter(m => m.productId === selectedProduct)
    : [];

  const handleAddProduct = () => {
    setSelectedProduct('');
    setSelectedSupplyChainGroup('');
    setSelectedSupplyChainVersion('');
    setSelectedMBomVersion('');
    setEditingConnection(null);
    setShowAddProductModal(true);
  };

  const handleEditConnection = (connection: ProductConnection) => {
    setSelectedProduct(connection.productId);
    setSelectedSupplyChainGroup(connection.supplyChainGroupId || '');
    setSelectedSupplyChainVersion(connection.supplyChainVersionId || '');
    setSelectedMBomVersion(connection.mbomVersionId || '');
    setEditingConnection(connection);
    setShowAddProductModal(true);
  };

  const handleRemoveConnection = (connectionId: string) => {
    setProductConnections(prev => prev.filter(pc => pc.id !== connectionId));
    toast.success('제품 연결이 해제되었습니다');
  };

  const handleSaveConnection = () => {
    const product = mockProducts.find(p => p.id === selectedProduct);
    const scGroup = mockSupplyChainGroups.find(g => g.id === selectedSupplyChainGroup);
    const scVersion = mockSupplyChainVersions.find(v => v.id === selectedSupplyChainVersion);
    const mbomVersion = mockMBomVersions.find(m => m.id === selectedMBomVersion);

    if (!product) {
      toast.error('제품을 선택해주세요');
      return;
    }

    if (editingConnection) {
      // Update existing connection
      setProductConnections(prev => prev.map(pc => 
        pc.id === editingConnection.id
          ? {
              ...pc,
              supplyChainGroupId: selectedSupplyChainGroup || null,
              supplyChainGroupCode: scGroup?.groupCode || null,
              supplyChainVersionId: selectedSupplyChainVersion || null,
              supplyChainVersionCode: scVersion?.versionCode || null,
              mbomVersionId: selectedMBomVersion || null,
              mbomVersionCode: mbomVersion?.versionCode || null,
            }
          : pc
      ));
      toast.success('제품 연결 정보가 수정되었습니다');
    } else {
      // Add new connection
      const newConnection: ProductConnection = {
        id: `pc-${Date.now()}`,
        productId: selectedProduct,
        productName: product.name,
        productCode: product.code,
        supplyChainGroupId: selectedSupplyChainGroup || null,
        supplyChainGroupCode: scGroup?.groupCode || null,
        supplyChainVersionId: selectedSupplyChainVersion || null,
        supplyChainVersionCode: scVersion?.versionCode || null,
        mbomVersionId: selectedMBomVersion || null,
        mbomVersionCode: mbomVersion?.versionCode || null,
        pcfStatus: 'not-calculated',
        pcfResult: null,
      };
      setProductConnections(prev => [...prev, newConnection]);
      toast.success('제품이 연결되었습니다');
    }

    setShowAddProductModal(false);
  };

  const handleRunPcfCalculation = (connectionId: string) => {
    setProductConnections(prev => prev.map(pc => 
      pc.id === connectionId
        ? { ...pc, pcfStatus: 'calculating' as const }
        : pc
    ));
    toast.success('PCF 계산을 시작합니다');

    // Simulate calculation completion
    setTimeout(() => {
      setProductConnections(prev => prev.map(pc => 
        pc.id === connectionId
          ? {
              ...pc,
              pcfStatus: 'completed' as const,
              pcfResult: {
                totalEmission: 32420.3 + Math.random() * 1000,
                coverage: 90 + Math.random() * 10,
                dqrAverage: 1 + Math.random() * 2,
                lastCalculated: new Date().toISOString().split('T')[0],
              },
            }
          : pc
      ));
      toast.success('PCF 계산이 완료되었습니다');
    }, 2000);
  };

  // 제품 연결 상태 표시 함수
  const getConnectionStatusBadge = (connection: ProductConnection) => {
    if (!connection.supplyChainVersionCode) {
      return <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">공급망 미선택</span>;
    }
    if (!connection.mbomVersionCode) {
      return <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">M-BOM 미선택</span>;
    }
    if (connection.pcfStatus === 'not-calculated') {
      return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">PCF 미계산</span>;
    }
    if (connection.pcfStatus === 'calculating') {
      return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center gap-1">
        <Clock className="w-3 h-3" />
        PCF 계산 중
      </span>;
    }
    if (connection.pcfStatus === 'completed') {
      return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        PCF 완료
      </span>;
    }
    return null;
  };

  const getPcfStatusBadge = (status: ProductConnection['pcfStatus']) => {
    switch (status) {
      case 'not-calculated':
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">미계산</span>;
      case 'calculating':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs flex items-center gap-1">
          <Clock className="w-3 h-3" />
          계산 중
        </span>;
      case 'completed':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          완료
        </span>;
      case 'error':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">오류</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Read-only banner for PCF mode */}
      {mode === 'pcf' && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-[#00B4FF] p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#00B4FF] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-[#00B4FF] mb-1">ESG 직무 - 읽기 전용 모드</h3>
              <p className="text-sm text-gray-700">
                PCF 담당자는 프로젝트 정보를 조회할 수 있으나, 제품 연결 및 수정 권한은 없습니다. 
                프로젝트를 수정하려면 우측 상단에서 "구매 직무"로 전환하세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/dashboard/project-management')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">프로젝트 목록으로</span>
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{mockProjectDetail.projectName}</h1>
            <p className="text-gray-600 mt-1">{mockProjectDetail.projectCode}</p>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            disabled={mode === 'pcf'}
          >
            <Edit className="w-4 h-4" />
            프로젝트 정보 수정
          </button>
        </div>
      </div>

      {/* Basic Information Card */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-[#5B3BFA]" />
          기본 정보
        </h2>

        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-gray-600 mb-1">고객사명</div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-lg">{mockProjectDetail.customerName}</span>
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-1">납품 기간</div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="font-medium">
                {mockProjectDetail.period.start} ~ {mockProjectDetail.period.end}
              </span>
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-1">생성일 / 수정일</div>
            <div className="font-medium">
              {mockProjectDetail.createdDate} / {mockProjectDetail.lastModified}
            </div>
          </div>
        </div>
      </div>

      {/* Connected Products Section */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-[#5B3BFA]" />
            연결 제품 ({productConnections.length})
          </h2>
          <button
            onClick={handleAddProduct}
            className="px-4 py-2 text-white rounded-lg flex items-center gap-2 font-medium"
            style={{
              background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
            }}
            disabled={mode === 'pcf'}
          >
            <Plus className="w-4 h-4" />
            제품 추가
          </button>
        </div>

        {productConnections.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>연결된 제품이 없습니다</p>
            <p className="text-sm mt-2">제품을 추가하여 공급망과 M-BOM을 연결하세요</p>
          </div>
        ) : (
          <div className="space-y-4">
            {productConnections.map((connection) => (
              <div
                key={connection.id}
                className="p-5 border-2 border-gray-200 rounded-xl hover:border-purple-300 transition-colors"
              >
                {/* Product Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">{connection.productName}</h3>
                      <span className="text-sm text-gray-500">{connection.productCode}</span>
                      {getPcfStatusBadge(connection.pcfStatus)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditConnection(connection)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      disabled={mode === 'pcf'}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDeletingConnectionId(connection.id);
                        setShowDeleteConfirm(true);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      disabled={mode === 'pcf'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Connection Details Grid */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {/* Supply Chain */}
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Network className="w-4 h-4 text-[#5B3BFA]" />
                      <span className="text-xs font-semibold text-gray-700">적용 공급망</span>
                    </div>
                    {connection.supplyChainVersionCode ? (
                      <div>
                        <div className="font-bold text-[#5B3BFA]">{connection.supplyChainVersionCode}</div>
                        <div className="text-xs text-gray-600 mt-1">{connection.supplyChainGroupCode}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">미선택</div>
                    )}
                  </div>

                  {/* M-BOM */}
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-semibold text-gray-700">적용 M-BOM</span>
                    </div>
                    {connection.mbomVersionCode ? (
                      <div className="font-bold text-blue-600">{connection.mbomVersionCode}</div>
                    ) : (
                      <div className="text-sm text-gray-400">미선택</div>
                    )}
                  </div>

                  {/* PCF Status (Read-only) */}
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-gray-600" />
                      <span className="text-xs font-semibold text-gray-700">PCF 상태</span>
                    </div>
                    <div className="space-y-1">
                      {connection.pcfResult ? (
                        <div className="flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          <span>계산 완료</span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">미계산</div>
                      )}
                      {connection.pcfResult && (
                        <div className="text-xs text-gray-600">
                          {connection.pcfResult.lastCalculated}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => router.push('/dashboard/pcf-calculation')}
                      className="w-full mt-2 px-3 py-1.5 bg-white border border-[#5B3BFA] text-[#5B3BFA] rounded-lg text-xs font-medium hover:bg-purple-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <BarChart3 className="w-3 h-3" />
                      PCF 탭에서 계산하기
                    </button>
                  </div>
                </div>

                {/* PCF Result Card */}
                {connection.pcfResult && (
                  <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      PCF 계산 결과
                    </h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-gray-600 mb-1">총 배출량</div>
                        <div className="font-bold text-lg text-green-700">
                          {connection.pcfResult.totalEmission.toLocaleString()} kg
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 mb-1">커버리지</div>
                        <div className="font-bold text-lg text-blue-600">
                          {connection.pcfResult.coverage.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 mb-1">DQR 평균</div>
                        <div className="font-bold text-lg text-purple-600">
                          {connection.pcfResult.dqrAverage.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 mb-1">계산일</div>
                        <div className="font-medium text-sm text-gray-700">
                          {connection.pcfResult.lastCalculated}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            style={{
              borderRadius: '20px',
            }}
          >
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  {editingConnection ? '제품 연결 수정' : '제품 연결'}
                </h2>
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                프로젝트에 제품을 연결하고 공급망 버전과 M-BOM을 선택하세요
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Step 1: Product Selection */}
              <div>
                <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-[#5B3BFA] text-white rounded-full text-xs">1</span>
                  제품 선택
                </label>
                <select
                  value={selectedProduct}
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    setSelectedSupplyChainGroup('');
                    setSelectedSupplyChainVersion('');
                    setSelectedMBomVersion('');
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  disabled={!!editingConnection}
                >
                  <option value="">제품을 선택하세요</option>
                  {mockProducts.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Supply Chain Group Selection */}
              {selectedProduct && (
                <div>
                  <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 bg-[#5B3BFA] text-white rounded-full text-xs">2</span>
                    공급망 그룹 선택
                  </label>
                  <select
                    value={selectedSupplyChainGroup}
                    onChange={(e) => {
                      setSelectedSupplyChainGroup(e.target.value);
                      setSelectedSupplyChainVersion('');
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  >
                    <option value="">공급망 그룹을 선택하세요</option>
                    {availableSupplyChainGroups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.groupCode} - {group.groupName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Step 3: Supply Chain Version Selection */}
              {selectedSupplyChainGroup && (
                <div>
                  <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 bg-[#5B3BFA] text-white rounded-full text-xs">3</span>
                    공급망 버전 선택
                  </label>
                  <div className="space-y-2">
                    {availableSupplyChainVersions.map(version => (
                      <div
                        key={version.id}
                        onClick={() => setSelectedSupplyChainVersion(version.id)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedSupplyChainVersion === version.id
                            ? 'border-[#5B3BFA] bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-bold text-[#5B3BFA]">{version.versionCode}</span>
                              {version.isStructureChanged && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                  구조 변경됨
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              <div>기준일: {version.createdDate}</div>
                              <div>생성 사유: {version.createdReason}</div>
                            </div>
                          </div>
                          {selectedSupplyChainVersion === version.id && (
                            <CheckCircle className="w-5 h-5 text-[#5B3BFA]" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: M-BOM Version Selection */}
              {selectedProduct && (
                <div>
                  <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 bg-[#5B3BFA] text-white rounded-full text-xs">4</span>
                    M-BOM 버전 선택
                  </label>
                  <div className="space-y-2">
                    {availableMBomVersions.map(mbom => (
                      <div
                        key={mbom.id}
                        onClick={() => setSelectedMBomVersion(mbom.id)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedMBomVersion === mbom.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-bold text-blue-600">{mbom.versionCode}</span>
                              {mbom.isActive && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                  현재 적용 중
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              유효기간: {mbom.validFrom} ~ {mbom.validTo}
                            </div>
                          </div>
                          {selectedMBomVersion === mbom.id && (
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={() => setShowAddProductModal(false)}
                className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleSaveConnection}
                className="px-5 py-2 text-white rounded-lg font-medium"
                style={{
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                }}
              >
                {editingConnection ? '수정 완료' : '제품 연결'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            style={{
              borderRadius: '20px',
            }}
          >
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold">프로젝트 정보 수정</h2>
              <p className="text-sm text-gray-600 mt-1">
                고객사 납품 맥락을 정의합니다
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">프로젝트명</label>
                <input
                  type="text"
                  defaultValue={mockProjectDetail.projectName}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">납품 시작일</label>
                  <input
                    type="date"
                    defaultValue={mockProjectDetail.period.start}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">납품 종료일</label>
                  <input
                    type="date"
                    defaultValue={mockProjectDetail.period.end}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">납품 지역</label>
                  <select
                    defaultValue={mockProjectDetail.deliveryRegion}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  >
                    <option value="">지역 선택</option>
                    <option value="Korea">Korea</option>
                    <option value="Germany">Germany</option>
                    <option value="USA">USA</option>
                    <option value="China">China</option>
                    <option value="Japan">Japan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">납품 공장명</label>
                  <input
                    type="text"
                    defaultValue={mockProjectDetail.deliveryPlant}
                    placeholder="예: Munich Plant"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">법인명 (선택)</label>
                  <input
                    type="text"
                    defaultValue={mockProjectDetail.legalEntity}
                    placeholder="예: BMW AG"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">생산 거점 (선택)</label>
                  <input
                    type="text"
                    defaultValue={mockProjectDetail.productionSite}
                    placeholder="예: Ulsan Factory"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                취소
              </button>
              <button
                onClick={() => {
                  toast.success('프로젝트 정보가 수정되었습니다');
                  setShowEditModal(false);
                }}
                className="px-5 py-2 text-white rounded-lg font-medium"
                style={{
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white w-full max-w-2xl"
            style={{
              borderRadius: '20px',
            }}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold">제품 연결 해제 확인</h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                선택한 제품 연결을 해제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (deletingConnectionId) {
                    handleRemoveConnection(deletingConnectionId);
                  }
                  setShowDeleteConfirm(false);
                }}
                className="px-5 py-2 text-white rounded-lg font-medium"
                style={{
                  background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}