'use client';

import { useState, useEffect, useRef } from 'react';
import { Download, Upload, Plus, Users, ChevronRight, CheckCircle, Clock, AlertTriangle, X, Network, ArrowRight, Info, FileText, BarChart3, Search, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useMode } from '../context/ModeContext';

// Supply Chain Node Data Structure
interface SupplyChainNode {
  id: string;
  companyName: string;
  tier: number;
  deliveryItems: string[];
  connectionStatus: 'connected' | 'invited' | 'pending' | 'disconnected';
  childrenCount: number;
  dataSubmissionStatus: 'submitted' | 'pending' | 'incomplete';
  country: string;
  site: string;
  parentId: string | null;
  children?: SupplyChainNode[];
}

// Product type
interface Product {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
}

// Supply Chain Group (공급망 그룹)
interface SupplyChainGroup {
  id: string;
  groupCode: string;
  groupName: string;
  productId: string;
  activeVersionId: string;
  description: string;
  totalSuppliers: number;
  lastModified: string;
  isStructureChanged: boolean;
  // Reference information
  usedInProjects: number;
  recentPcfCalculations: number;
}

// Supply Chain Version
interface SupplyChainVersion {
  id: string;
  groupId: string;
  versionCode: string; // SCV-2026-01 형태
  createdDate: string;
  createdReason: string; // 생성 사유
  supplierCount: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  dataCoverage: number;
}

// Mock Data - Products
const mockProducts: Product[] = [
  { id: 'prod1', code: 'BM-A-100', name: '배터리 모듈 A', description: '중형 전기차용 배터리 모듈', category: '배터리' },
  { id: 'prod2', code: 'SSC-200', name: '전고체 셀', description: '차세대 전고체 배터리 셀', category: '배터리' },
  { id: 'prod3', code: 'ESS-300', name: 'ESS 팩', description: '에너지 저장 시스템용 배터리 팩', category: 'ESS' },
];

// Mock Data - Supply Chain Groups
const mockSupplyChainGroups: SupplyChainGroup[] = [
  {
    id: 'group1',
    groupCode: 'SC-1',
    groupName: '표준 공급망',
    productId: 'prod1',
    activeVersionId: 'scv1',
    description: '배터리 모듈 A 기본 공급망 구조',
    totalSuppliers: 14,
    lastModified: '2026-03-01',
    isStructureChanged: false,
    usedInProjects: 3,
    recentPcfCalculations: 12,
  },
  {
    id: 'group2',
    groupCode: 'SC-2',
    groupName: '친환경 공급망',
    productId: 'prod1',
    activeVersionId: 'scv2',
    description: '재활용 소재 중심 공급망',
    totalSuppliers: 12,
    lastModified: '2026-02-20',
    isStructureChanged: true,
    usedInProjects: 1,
    recentPcfCalculations: 5,
  },
  {
    id: 'group3',
    groupCode: 'SC-3',
    groupName: '차세대 공급망',
    productId: 'prod2',
    activeVersionId: 'scv3',
    description: '전고체 셀 전용 공급망',
    totalSuppliers: 9,
    lastModified: '2026-02-15',
    isStructureChanged: false,
    usedInProjects: 2,
    recentPcfCalculations: 8,
  },
  {
    id: 'group4',
    groupCode: 'SC-4',
    groupName: 'ESS 표준 공급망',
    productId: 'prod3',
    activeVersionId: 'scv4',
    description: 'ESS 팩 기본 공급망',
    totalSuppliers: 11,
    lastModified: '2026-01-30',
    isStructureChanged: false,
    usedInProjects: 2,
    recentPcfCalculations: 6,
  },
];

// Mock Data - Supply Chain Versions
const mockVersions: SupplyChainVersion[] = [
  {
    id: 'scv1',
    groupId: 'group1',
    versionCode: 'SCV-2026-01',
    createdDate: '2026-03-01',
    createdReason: '1차 협력사 변경 (한국배터리 추가)',
    supplierCount: { tier1: 3, tier2: 7, tier3: 4 },
    dataCoverage: 95.5,
  },
  {
    id: 'scv1-1',
    groupId: 'group1',
    versionCode: 'SCV-2026-01-A',
    createdDate: '2026-02-25',
    createdReason: 'Tier2 소재 업체 추가',
    supplierCount: { tier1: 3, tier2: 6, tier3: 3 },
    dataCoverage: 92.3,
  },
  {
    id: 'scv2',
    groupId: 'group2',
    versionCode: 'SCV-ECO-01',
    createdDate: '2026-02-20',
    createdReason: '친환경 소재 협력사 구성',
    supplierCount: { tier1: 2, tier2: 6, tier3: 4 },
    dataCoverage: 88.7,
  },
  {
    id: 'scv3',
    groupId: 'group3',
    versionCode: 'SCV-SSB-01',
    createdDate: '2026-02-15',
    createdReason: '전고체 전용 공급망 초기 구성',
    supplierCount: { tier1: 2, tier2: 5, tier3: 2 },
    dataCoverage: 90.2,
  },
  {
    id: 'scv4',
    groupId: 'group4',
    versionCode: 'SCV-ESS-01',
    createdDate: '2026-01-30',
    createdReason: 'ESS 공급망 표준 구성',
    supplierCount: { tier1: 2, tier2: 6, tier3: 3 },
    dataCoverage: 91.5,
  },
];

// Mock Supply Chain Tree Data
const mockSupplyChainData: SupplyChainNode[] = [
  {
    id: 'tier1-1',
    companyName: '한국배터리',
    tier: 1,
    deliveryItems: ['배터리 셀', '전극 소재'],
    connectionStatus: 'connected',
    childrenCount: 3,
    dataSubmissionStatus: 'submitted',
    country: 'South Korea',
    site: '천안사업장',
    parentId: null,
    children: [
      {
        id: 'tier2-1',
        companyName: '셀테크',
        tier: 2,
        deliveryItems: ['리튬이온 셀'],
        connectionStatus: 'connected',
        childrenCount: 2,
        dataSubmissionStatus: 'submitted',
        country: 'China',
        site: 'Shenzhen Factory',
        parentId: 'tier1-1',
        children: [
          {
            id: 'tier3-1',
            companyName: '리튬소재',
            tier: 3,
            deliveryItems: ['리튬 원료'],
            connectionStatus: 'connected',
            childrenCount: 0,
            dataSubmissionStatus: 'submitted',
            country: 'Chile',
            site: 'Santiago Plant',
            parentId: 'tier2-1',
          },
          {
            id: 'tier3-2',
            companyName: '광물자원',
            tier: 3,
            deliveryItems: ['니켈 원료'],
            connectionStatus: 'invited',
            childrenCount: 0,
            dataSubmissionStatus: 'pending',
            country: 'Australia',
            site: 'Perth Mine',
            parentId: 'tier2-1',
          },
        ],
      },
      {
        id: 'tier2-2',
        companyName: '글로벌소재',
        tier: 2,
        deliveryItems: ['친환경 소재'],
        connectionStatus: 'connected',
        childrenCount: 1,
        dataSubmissionStatus: 'submitted',
        country: 'Germany',
        site: 'Munich Plant',
        parentId: 'tier1-1',
        children: [
          {
            id: 'tier3-3',
            companyName: '유럽소재',
            tier: 3,
            deliveryItems: ['재활용 소재'],
            connectionStatus: 'pending',
            childrenCount: 0,
            dataSubmissionStatus: 'incomplete',
            country: 'France',
            site: 'Paris Facility',
            parentId: 'tier2-2',
          },
        ],
      },
      {
        id: 'tier2-3',
        companyName: '전극소재',
        tier: 2,
        deliveryItems: ['양극재', '음극재'],
        connectionStatus: 'connected',
        childrenCount: 0,
        dataSubmissionStatus: 'submitted',
        country: 'South Korea',
        site: '포항공장',
        parentId: 'tier1-1',
      },
    ],
  },
  {
    id: 'tier1-2',
    companyName: '파워셀 테크놀로지',
    tier: 1,
    deliveryItems: ['전력 셀', '배터리 팩'],
    connectionStatus: 'connected',
    childrenCount: 1,
    dataSubmissionStatus: 'pending',
    country: 'Japan',
    site: 'Tokyo Plant',
    parentId: null,
    children: [
      {
        id: 'tier2-4',
        companyName: '아시아소재',
        tier: 2,
        deliveryItems: ['전해액'],
        connectionStatus: 'connected',
        childrenCount: 0,
        dataSubmissionStatus: 'incomplete',
        country: 'Taiwan',
        site: 'Taipei Factory',
        parentId: 'tier1-2',
      },
    ],
  },
  {
    id: 'tier1-3',
    companyName: '에코 패키징',
    tier: 1,
    deliveryItems: ['포장재', '보호 필름'],
    connectionStatus: 'invited',
    childrenCount: 0,
    dataSubmissionStatus: 'pending',
    country: 'USA',
    site: 'California Plant',
    parentId: null,
  },
];

export default function SupplyChainManagement() {
  const { mode } = useMode();
  
  // Selection states (재구성된 계층)
  const [selectedProduct, setSelectedProduct] = useState<string>(mockProducts[0].id);
  const [selectedGroup, setSelectedGroup] = useState<string>(mockSupplyChainGroups[0].id);
  const [selectedVersion, setSelectedVersion] = useState<string>(mockVersions[0].id);
  
  // UI states
  const [selectedNode, setSelectedNode] = useState<SupplyChainNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['tier1-1', 'tier2-1']));
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products by search query
  const filteredProducts = mockProducts.filter(p => 
    p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  // Filter groups by selected product
  const availableGroups = mockSupplyChainGroups.filter(g => g.productId === selectedProduct);
  
  // Filter versions by selected group
  const availableVersions = mockVersions.filter(v => v.groupId === selectedGroup);
  
  // Get selected data
  const selectedProductData = mockProducts.find(p => p.id === selectedProduct);
  const selectedGroupData = mockSupplyChainGroups.find(g => g.id === selectedGroup);
  const selectedVersionData = mockVersions.find(v => v.id === selectedVersion);

  const handleCreateVersion = () => {
    toast.success('새로운 공급망 버전을 생성합니다');
  };

  const handleCreateGroup = () => {
    toast.success('새로운 공급망 그룹을 생성합니다');
  };

  const handleExportStructure = () => {
    toast.success('공급망 구조를 내보냅니다');
  };

  const handleImportFromSRM = () => {
    toast.success('SRM/ERP에서 협력사 데이터를 불러옵니다');
  };

  const handleManualAdd = () => {
    toast.info('1차 협력사를 수동으로 추가합니다');
  };

  const toggleNodeExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const getConnectionStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">연결됨</span>;
      case 'invited':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">초대중</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">대기중</span>;
      case 'disconnected':
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">미연결</span>;
      default:
        return null;
    }
  };

  const getDataStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-3 h-3" />
            <span className="text-xs">제출완료</span>
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-yellow-600">
            <Clock className="w-3 h-3" />
            <span className="text-xs">대기중</span>
          </span>
        );
      case 'incomplete':
        return (
          <span className="flex items-center gap-1 text-red-600">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-xs">미완료</span>
          </span>
        );
      default:
        return null;
    }
  };

  // Calculate supply chain health metrics
  const calculateHealthMetrics = () => {
    const flattenNodes = (nodes: SupplyChainNode[]): SupplyChainNode[] => {
      return nodes.reduce((acc, node) => {
        acc.push(node);
        if (node.children) {
          acc.push(...flattenNodes(node.children));
        }
        return acc;
      }, [] as SupplyChainNode[]);
    };

    const allNodes = flattenNodes(mockSupplyChainData);
    
    return {
      totalSuppliers: allNodes.length,
      notInvited: allNodes.filter(n => n.connectionStatus === 'pending' || n.connectionStatus === 'disconnected').length,
      dataNotSubmitted: allNodes.filter(n => n.dataSubmissionStatus !== 'submitted').length,
      recentChanges: 3,
    };
  };

  const healthMetrics = calculateHealthMetrics();

  // Render tree node recursively with flow arrows
  const renderTreeNode = (node: SupplyChainNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <div key={node.id} className="relative">
        {/* Flow Arrow (left side) */}
        {level > 0 && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-6 flex items-center">
            <ArrowRight className="w-4 h-4 text-purple-400" />
          </div>
        )}

        <div style={{ marginLeft: level > 0 ? '32px' : '0' }}>
          <div
            className={`p-4 mb-2 rounded-lg border-2 transition-all cursor-pointer ${
              selectedNode?.id === node.id
                ? 'border-[#5B3BFA] bg-purple-50'
                : 'border-gray-200 bg-white hover:border-[#5B3BFA] hover:bg-purple-50'
            }`}
            onClick={() => setSelectedNode(node)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {hasChildren && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNodeExpand(node.id);
                      }}
                      className="p-1 hover:bg-gray-200 rounded transition-transform"
                      style={{
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    node.tier === 1 ? 'bg-purple-100 text-purple-700' :
                    node.tier === 2 ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    Tier {node.tier}
                  </span>
                  
                  <h3 className="font-bold text-base">{node.companyName}</h3>
                  
                  {getConnectionStatusBadge(node.connectionStatus)}
                </div>

                <div className="text-sm text-gray-600 ml-6">
                  <div className="mb-1">
                    <span className="font-medium">납품 품목:</span> {node.deliveryItems.join(', ')}
                  </div>
                  <div className="text-xs text-gray-500">{node.country} · {node.site}</div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {getDataStatusBadge(node.dataSubmissionStatus)}
                {hasChildren && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Users className="w-3 h-3" />
                    <span>하위 {node.childrenCount}개</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Render children if expanded */}
          {hasChildren && isExpanded && (
            <div className="ml-4 border-l-2 border-purple-200 pl-2 relative">
              {node.children!.map(child => renderTreeNode(child, level + 1))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)]">
      {/* Left Panel - Product & Supply Chain Group List */}
      <div className="w-80 flex-shrink-0 space-y-4 overflow-y-auto">
        {/* Product Selection */}
        <div
          className="bg-white p-4"
          style={{
            borderRadius: '16px',
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#5B3BFA]" />
            제품 선택 (1계층)
          </h3>
          
          <div className="relative" ref={productDropdownRef}>
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => {
                  setProductSearchQuery(e.target.value);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
                placeholder="제품 검색 (코드, 이름, 설명)"
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
              />
              <ChevronDown 
                className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${showProductDropdown ? 'rotate-180' : ''}`}
              />
            </div>
            
            {/* Dropdown List */}
            {showProductDropdown && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                {filteredProducts.length > 0 ? (
                  <div className="p-2 space-y-1">
                    {filteredProducts.map(product => (
                      <div
                        key={product.id}
                        onClick={() => {
                          setSelectedProduct(product.id);
                          setProductSearchQuery('');
                          setShowProductDropdown(false);
                          const newGroups = mockSupplyChainGroups.filter(g => g.productId === product.id);
                          if (newGroups.length > 0) {
                            setSelectedGroup(newGroups[0].id);
                            const newVersions = mockVersions.filter(v => v.groupId === newGroups[0].id);
                            if (newVersions.length > 0) {
                              setSelectedVersion(newVersions[0].id);
                            }
                          }
                        }}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          selectedProduct === product.id
                            ? 'bg-purple-50 border border-[#5B3BFA]'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-semibold text-sm">{product.name}</div>
                          <span className="text-xs text-gray-500">{product.code}</span>
                        </div>
                        <p className="text-xs text-gray-600">{product.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">
                    검색 결과가 없습니다
                  </div>
                )}
                
                {/* Load from Source System Button */}
                <div className="border-t border-gray-200 p-2">
                  <button
                    onClick={() => {
                      toast.info('원천 시스템(ERP/PLM)에서 제품 데이터를 불러옵니다');
                      setShowProductDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-[#5B3BFA] hover:bg-purple-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    원천 시스템에서 불러오기
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Selected Product Display */}
          {selectedProductData && !showProductDropdown && (
            <div className="mt-3 p-3 rounded-lg bg-purple-50 border border-[#5B3BFA]">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-sm">{selectedProductData.name}</div>
                <span className="text-xs text-gray-500">{selectedProductData.code}</span>
              </div>
              <p className="text-xs text-gray-600">{selectedProductData.description}</p>
              <div className="text-xs text-gray-500 mt-1">
                {mockSupplyChainGroups.filter(g => g.productId === selectedProductData.id).length}개 공급망 그룹
              </div>
            </div>
          )}
        </div>

        {/* Supply Chain Groups List */}
        <div
          className="bg-white p-4"
          style={{
            borderRadius: '16px',
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Network className="w-4 h-4 text-[#5B3BFA]" />
            공급망 그룹 목록
          </h3>

          {availableGroups.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              해당 제품의 공급망 그룹이 없습니다
            </p>
          ) : (
            <div className="space-y-2">
              {availableGroups.map(group => (
                <div
                  key={group.id}
                  onClick={() => {
                    setSelectedGroup(group.id);
                    const versions = mockVersions.filter(v => v.groupId === group.id);
                    if (versions.length > 0) {
                      setSelectedVersion(versions[0].id);
                    }
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedGroup === group.id
                      ? 'border-[#5B3BFA] bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-[#5B3BFA]">{group.groupCode}</span>
                        <span className="font-semibold text-sm">{group.groupName}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{group.description}</p>
                    </div>
                    {group.isStructureChanged && (
                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs flex-shrink-0 ml-2">
                        변경됨
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                    <span>협력사 {group.totalSuppliers}개</span>
                    <span>{group.lastModified}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Create New Group Button - Only visible in procurement mode */}
          {mode === 'procurement' && (
            <button
              onClick={handleCreateGroup}
              className="w-full mt-3 px-4 py-2.5 text-sm text-[#5B3BFA] border-2 border-dashed border-[#5B3BFA] rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              신규 생성
            </button>
          )}
        </div>
      </div>

      {/* Right Panel - Supply Chain Structure */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        {/* Read-only banner for PCF mode */}
        {mode === 'pcf' && (
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-[#00B4FF] p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-[#00B4FF] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-[#00B4FF] mb-1">ESG 직무 - 읽기 전용 모드</h3>
                <p className="text-sm text-gray-700">
                  PCF 담당자는 공급망 구조를 조회할 수 있으나, 구조 변경 및 협력사 추가/삭제 권한은 없습니다. 
                  공급망을 수정하려면 우측 상단에서 "구매 직무"로 전환하세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header with Philosophy Statement */}
        <div
          className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 border-2 border-purple-200"
          style={{
            borderRadius: '16px',
          }}
        >
          <div className="flex items-start gap-3">
            <Info className="w-6 h-6 text-[#5B3BFA] flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">제품 기준 공급망 자산 관리</h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                이 화면은 <strong className="text-[#5B3BFA]">고객사/프로젝트와 무관하게 제품 기준 공급망 구조를 관리</strong>합니다.
                <br />
                공급망은 제품의 자재 흐름을 기준으로 한 <strong>"1계층 구조 자산"</strong>이며, 
                PCF 계산 및 계약 관리와는 독립적으로 버전 관리됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* Version Selection & Actions */}
        <div
          className="bg-white p-6"
          style={{
            borderRadius: '16px',
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2">공급망 그룹</label>
                  <div className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg text-sm font-medium">
                    {selectedGroupData?.groupCode} - {selectedGroupData?.groupName}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2">공급망 버전</label>
                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3BFA]"
                  >
                    {availableVersions.map(v => (
                      <option key={v.id} value={v.id}>{v.versionCode}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 ml-4">
              <button
                onClick={handleCreateVersion}
                disabled={mode === 'pcf'}
                className={`px-4 py-2 text-sm border rounded-lg transition-colors whitespace-nowrap ${
                  mode === 'pcf' 
                    ? 'border-gray-300 text-gray-400 cursor-not-allowed bg-gray-100' 
                    : 'border-[#5B3BFA] text-[#5B3BFA] hover:bg-purple-50'
                }`}
              >
                버전 생성
              </button>
              <button
                onClick={handleExportStructure}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                내보내기
              </button>
            </div>
          </div>

          {/* Version Meta Information Card */}
          {selectedVersionData && (
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-[#5B3BFA] mt-0.5" />
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">버전 기준일:</span>
                      <span className="ml-2 font-medium">{selectedVersionData.createdDate}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">생성 사유:</span>
                      <span className="ml-2 font-medium">{selectedVersionData.createdReason}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reference Information (공급망 사용 현황) */}
          {selectedGroupData && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-blue-600 mt-0.5" />
                <h4 className="text-sm font-semibold text-blue-900">공급망 사용 현황 (참조 정보)</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">사용 중 프로젝트:</span>
                  <button
                    onClick={() => setShowUsageModal(true)}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    {selectedGroupData.usedInProjects}건
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">최근 PCF 계산:</span>
                  <button
                    onClick={() => setShowUsageModal(true)}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    {selectedGroupData.recentPcfCalculations}건
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                ※ 참조 정보로만 제공되며, 이 화면에서 직접 수정할 수 없습니다.
              </p>
            </div>
          )}
        </div>

        {/* Supply Chain Summary Cards */}
        {selectedVersionData && (
          <div className="grid grid-cols-4 gap-4">
            <div
              className="bg-white p-4"
              style={{
                borderRadius: '12px',
                boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              <div className="text-sm text-gray-600 mb-1">Tier 1 협력사</div>
              <div className="text-2xl font-bold text-purple-600">{selectedVersionData.supplierCount.tier1}개</div>
            </div>

            <div
              className="bg-white p-4"
              style={{
                borderRadius: '12px',
                boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              <div className="text-sm text-gray-600 mb-1">Tier 2 협력사</div>
              <div className="text-2xl font-bold text-blue-600">{selectedVersionData.supplierCount.tier2}개</div>
            </div>

            <div
              className="bg-white p-4"
              style={{
                borderRadius: '12px',
                boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              <div className="text-sm text-gray-600 mb-1">Tier 3+ 협력사</div>
              <div className="text-2xl font-bold text-green-600">{selectedVersionData.supplierCount.tier3}개</div>
            </div>

            <div
              className="bg-white p-4"
              style={{
                borderRadius: '12px',
                boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              <div className="text-sm text-gray-600 mb-1">데이터 커버리지</div>
              <div className="text-2xl font-bold text-[#5B3BFA]">{selectedVersionData.dataCoverage}%</div>
            </div>
          </div>
        )}

        {/* Tier 1 Supplier Registration Panel (Compact) */}
        <div
          className="bg-white p-4"
          style={{
            borderRadius: '16px',
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-sm">1차 협력사 등록</h3>
              <span className="text-sm text-gray-600">
                등록된 1차 협력사: <span className="font-bold text-[#5B3BFA]">{mockSupplyChainData.length}개</span>
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleManualAdd}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                1차 협력사 추가
              </button>
            </div>
          </div>
        </div>

        {/* Supply Chain Structure Visualization */}
        <div
          className="bg-white p-6"
          style={{
            borderRadius: '16px',
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          {/* Enhanced Title with Product Name */}
          <div className="mb-6 pb-4 border-b-2 border-purple-100">
            <div className="flex items-center gap-3 mb-2">
              <Network className="w-7 h-7 text-[#5B3BFA]" />
              <h2 className="text-2xl font-bold">제품 기준 공급망 구조</h2>
              <span className="text-xl text-gray-600">—</span>
              <span className="text-xl font-bold text-[#5B3BFA]">
                {selectedProductData?.name}
              </span>
            </div>
            <p className="text-sm text-gray-600 ml-10">
              제품의 자재 흐름을 기준으로 한 공급망 구조를 표시합니다. (원청 → 1차 → 2차 → 3차)
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-100 border-2 border-purple-700"></div>
                <span>Tier 1</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-100 border-2 border-blue-700"></div>
                <span>Tier 2</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-100 border-2 border-green-700"></div>
                <span>Tier 3+</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ArrowRight className="w-4 h-4 text-purple-400" />
              <span>자재 흐름 방향</span>
            </div>
          </div>

          {/* Tree Structure */}
          <div className="space-y-2">
            {/* Root Node - Samsung SDI */}
            <div className="p-5 mb-4 rounded-lg border-2 border-[#5B3BFA] bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-[#5B3BFA] text-white">
                  원청
                </span>
                <h3 className="font-bold text-xl">삼성SDI</h3>
                <ArrowRight className="w-5 h-5 text-purple-400 ml-2" />
                <span className="text-sm text-gray-600">
                  {selectedProductData?.name} 제품 공급망
                </span>
              </div>
            </div>

            {/* Tier 1 and below */}
            {mockSupplyChainData.map(node => renderTreeNode(node))}
          </div>
        </div>

        {/* Supply Chain Health Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div
            className="bg-white p-4"
            style={{
              borderRadius: '12px',
              boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <div className="text-2xl font-bold text-[#5B3BFA] mb-1">{healthMetrics.totalSuppliers}</div>
            <div className="text-sm text-gray-600">전체 협력사 수</div>
          </div>

          <div
            className="bg-white p-4"
            style={{
              borderRadius: '12px',
              boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <div className="text-2xl font-bold text-yellow-600 mb-1">{healthMetrics.notInvited}</div>
            <div className="text-sm text-gray-600">미초대 협력사 수</div>
          </div>

          <div
            className="bg-white p-4"
            style={{
              borderRadius: '12px',
              boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <div className="text-2xl font-bold text-red-600 mb-1">{healthMetrics.dataNotSubmitted}</div>
            <div className="text-sm text-gray-600">데이터 미제출 업체 수</div>
          </div>

          <div
            className="bg-white p-4"
            style={{
              borderRadius: '12px',
              boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <div className="text-2xl font-bold text-blue-600 mb-1">{healthMetrics.recentChanges}</div>
            <div className="text-sm text-gray-600">최근 구조 변경 건수</div>
          </div>
        </div>
      </div>

      {/* Right Side Panel - Node Detail */}
      {selectedNode && (
        <>
          <div
            className="fixed right-0 top-0 h-full bg-white shadow-2xl z-50 overflow-y-auto"
            style={{ width: '480px' }}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-lg font-bold">{selectedNode.companyName}</h2>
                <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-bold ${
                  selectedNode.tier === 1 ? 'bg-purple-100 text-purple-700' :
                  selectedNode.tier === 2 ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  Tier {selectedNode.tier}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold mb-3">기업 기본 정보</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">회사명:</span>
                    <span className="font-medium">{selectedNode.companyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">국가:</span>
                    <span>{selectedNode.country}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">사업장:</span>
                    <span>{selectedNode.site}</span>
                  </div>
                </div>
              </div>

              {/* Parent Supplier */}
              {selectedNode.parentId && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">상위 협력사</h3>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    {mockSupplyChainData.find(n => n.id === selectedNode.parentId)?.companyName || '삼성SDI (원청)'}
                  </div>
                </div>
              )}

              {/* Child Suppliers */}
              {selectedNode.children && selectedNode.children.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">하위 협력사 ({selectedNode.children.length}개)</h3>
                  <div className="space-y-2">
                    {selectedNode.children.map(child => (
                      <div key={child.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{child.companyName}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            child.tier === 2 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            Tier {child.tier}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">{child.deliveryItems.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connection Status */}
              <div>
                <h3 className="text-sm font-semibold mb-3">초대 상태</h3>
                <div className="p-3 bg-gray-50 rounded-lg">
                  {getConnectionStatusBadge(selectedNode.connectionStatus)}
                </div>
              </div>

              {/* Data Submission Status */}
              <div>
                <h3 className="text-sm font-semibold mb-3">데이터 제출 상태</h3>
                <div className="p-3 bg-gray-50 rounded-lg">
                  {getDataStatusBadge(selectedNode.dataSubmissionStatus)}
                </div>
              </div>

              {/* Delivery Items */}
              <div>
                <h3 className="text-sm font-semibold mb-3">납품 품목</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedNode.deliveryItems.map((item, idx) => (
                    <span key={idx} className="px-3 py-1 bg-purple-50 text-[#5B3BFA] rounded-full text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => toast.success(`${selectedNode.companyName}의 하위 협력사를 초대합니다`)}
                  className="w-full px-4 py-2 text-white rounded-lg"
                  style={{
                    background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                  }}
                >
                  위 협력사 초대
                </button>
                <button
                  onClick={() => toast.info('연결 정보를 수정합니다')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  연결 수정
                </button>
                <button
                  onClick={() => toast.error('공급망 구조에서 제외합니다')}
                  className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  구조에서 제외
                </button>
              </div>
            </div>
          </div>

          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-40"
            onClick={() => setSelectedNode(null)}
          />
        </>
      )}

      {/* Usage Modal */}
      {showUsageModal && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div
              className="bg-white w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
              style={{
                borderRadius: '20px',
              }}
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-2xl font-bold">공급망 사용 현황</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedGroupData?.groupCode} - {selectedGroupData?.groupName}
                  </p>
                </div>
                <button
                  onClick={() => setShowUsageModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">사용 중인 프로젝트 ({selectedGroupData?.usedInProjects}건)</h3>
                    <div className="space-y-2">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium">BMW iX5 배터리 공급</div>
                        <div className="text-sm text-gray-600 mt-1">프로젝트 코드: SCN-2026-01</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium">Mercedes EQS 차세대 배터리</div>
                        <div className="text-sm text-gray-600 mt-1">프로젝트 코드: SCN-2026-02</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium">Audi Q6 e-tron ESS</div>
                        <div className="text-sm text-gray-600 mt-1">프로젝트 코드: SCN-2026-03</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">최근 PCF 계산 이력 ({selectedGroupData?.recentPcfCalculations}건)</h3>
                    <div className="space-y-2">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium">2026-Q1 PCF 계산</div>
                        <div className="text-sm text-gray-600 mt-1">계산일: 2026-03-01</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium">2025-Q4 PCF 계산</div>
                        <div className="text-sm text-gray-600 mt-1">계산일: 2025-12-15</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    ※ 이 정보는 참조용이며, 공급망 관리 화면에서 직접 수정할 수 없습니다.
                  </div>
                  <button
                    onClick={() => setShowUsageModal(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}