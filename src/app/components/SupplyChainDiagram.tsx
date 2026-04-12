'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  Position,
  NodeMouseHandler,
  Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AlertCircle, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { dedupeSupplyChainNodesForDiagram } from '@/lib/supplyChainDiagramNodes';

// Node data structure
interface CompanyNodeData {
  id: string;
  tier: 'Tier 0' | 'Tier 1' | 'Tier 2' | 'Tier 3';
  companyName: string;
  companyNameEn: string;
  country: string;
  materialType: string;
  isHighlighted: boolean;
  bomInclusion: { [bomName: string]: boolean };
  pcfContribution?: number;
  showBomComparison: boolean;
  isHovered?: boolean;
  zoomLevel?: number;
  signupStatus: 'invited_only' | 'joined';
}

interface SupplyChainDiagramProps {
  selectedDetailProduct: string;
  detailProducts: Array<{ id: string; displayName: string; bomCode: string; suppliers: string[] }>;
  useApiData?: boolean;
  apiNodes?: Array<{
    id: number;
    parent_node_id: number | null;
    supplier_name: string;
    tier: number | null;
    status: string;
  }>;
}

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'Tier 0':
      return '#5B3BFA';
    case 'Tier 1':
      return '#2A64E0';
    case 'Tier 2':
      return '#00A3B5';
    case 'Tier 3':
      return '#8C8C8C';
    default:
      return '#8C8C8C';
  }
};

// Custom Compact Node Component
function CompactCompanyNode({ data }: { data: CompanyNodeData }) {
  const tierColor = getTierColor(data.tier);
  const zoomLevel = data.zoomLevel || 1;
  const isZoomedOut = zoomLevel < 0.6;

  // Shortened name for zoomed out view
  const displayName = isZoomedOut ? data.companyNameEn : data.companyName;
  const isInvitedOnly = data.signupStatus === 'invited_only';

  return (
    <div
      className="bg-white rounded-2xl shadow-lg transition-all cursor-pointer hover:shadow-xl relative"
      style={{
        border: data.isHighlighted || data.isHovered ? `2px solid ${tierColor}` : '1px solid #E5E7EB',
        opacity: data.isHighlighted ? 1 : 0.3,
        width: '150px',
        minHeight: '90px',
        padding: '10px',
        backgroundColor: isInvitedOnly
          ? '#FFF7ED'
          : data.isHighlighted || data.isHovered
            ? 'rgba(91, 59, 250, 0.02)'
            : '#FFFFFF',
        transform: data.isHovered ? 'scale(1.05)' : 'scale(1)',
        transition: 'all 200ms ease-in-out',
      }}
    >
      {/* React Flow Handles */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      {/* Signup Status Badge */}
      <div className="absolute top-2 right-2">
        {isInvitedOnly ? (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border"
            style={{ backgroundColor: '#FFF4E6', borderColor: '#FDBA74', color: '#C2410C' }}
            title="등록됨 / 회원가입 미완료"
          >
            <AlertCircle size={10} />
            <span className="text-[9px] font-semibold leading-none">등록만</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border"
            style={{ backgroundColor: '#ECFDF3', borderColor: '#86EFAC', color: '#166534' }}
            title="등록됨 / 회원가입 완료"
          >
            <CheckCircle2 size={10} />
            <span className="text-[9px] font-semibold leading-none">가입완료</span>
          </div>
        )}
      </div>

      {/* Tier Badge */}
      <div className="mb-1.5">
        <span
          className="px-2 py-0.5 text-[10px] font-semibold text-white rounded-full"
          style={{ backgroundColor: tierColor }}
        >
          {data.tier}
        </span>
      </div>

      {/* Company Name */}
      <h4 className="text-sm font-bold text-gray-900 mb-1 truncate" title={data.companyName}>
        {displayName}
      </h4>

      {/* Country & Material */}
      <div className="text-xs text-gray-600 mb-2 truncate" title={`${data.country} | ${data.materialType}`}>
        {data.country} | {data.materialType}
      </div>

      {/* CO₂ Contribution Bar */}
      {data.pcfContribution !== undefined && data.isHighlighted && !isZoomedOut && !isInvitedOnly && (
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-gray-600">CO₂</span>
            <span className="text-[10px] font-semibold text-gray-900">{data.pcfContribution}%</span>
          </div>
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${data.pcfContribution}%`,
                background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const NODE_TYPES = {
  company: CompactCompanyNode,
} as const;

// Supply chain tree structure definition
interface SupplyChainTreeNode {
  id: string;
  tier: 'Tier 0' | 'Tier 1' | 'Tier 2' | 'Tier 3';
  companyName: string;
  companyNameEn: string;
  country: string;
  materialType: string;
  pcfContribution: number;
  signupStatus: 'invited_only' | 'joined';
  children?: SupplyChainTreeNode[];
}

const supplyChainTree: SupplyChainTreeNode = {
  id: 'tier0-1',
  tier: 'Tier 0',
  companyName: '삼성SDI',
  companyNameEn: 'Samsung SDI',
  country: 'South Korea',
  materialType: '배터리 모듈',
  pcfContribution: 100,
  signupStatus: 'joined',
  children: [
    {
      id: 'tier1-1',
      tier: 'Tier 1',
      companyName: '한국배터리',
      companyNameEn: 'Korea Battery',
      country: 'South Korea',
      materialType: '배터리 셀',
      pcfContribution: 42,
      signupStatus: 'joined',
      children: [
        {
          id: 'tier2-1',
          tier: 'Tier 2',
          companyName: '글로벌소재',
          companyNameEn: 'G. Materials',
          country: 'Germany',
          materialType: '양극재',
          pcfContribution: 18,
          signupStatus: 'joined',
          children: [
            {
              id: 'tier3-1',
              tier: 'Tier 3',
              companyName: '리튬광산',
              companyNameEn: 'Lithium Mine',
              country: 'Australia',
              materialType: '리튬 원광',
              pcfContribution: 8,
              signupStatus: 'invited_only',
            },
            {
              id: 'tier3-2',
              tier: 'Tier 3',
              companyName: '니켈광산',
              companyNameEn: 'Nickel Mine',
              country: 'Indonesia',
              materialType: '니켈 원광',
              pcfContribution: 7,
              signupStatus: 'joined',
            },
          ],
        },
        {
          id: 'tier2-2',
          tier: 'Tier 2',
          companyName: '화학소재',
          companyNameEn: 'Chemical Mat.',
          country: 'South Korea',
          materialType: '전해질',
          pcfContribution: 15,
          signupStatus: 'invited_only',
          children: [
            {
              id: 'tier3-3',
              tier: 'Tier 3',
              companyName: '염소화학',
              companyNameEn: 'Chlorine Chem',
              country: 'South Korea',
              materialType: '리튬염',
              pcfContribution: 6,
              signupStatus: 'joined',
            },
          ],
        },
      ],
    },
    {
      id: 'tier1-2',
      tier: 'Tier 1',
      companyName: '글로벌셀',
      companyNameEn: 'Global Cell',
      country: 'Japan',
      materialType: '배터리 팩',
      pcfContribution: 28,
      signupStatus: 'invited_only',
      children: [
        {
          id: 'tier2-3',
          tier: 'Tier 2',
          companyName: '셀테크',
          companyNameEn: 'Cell Tech',
          country: 'China',
          materialType: '음극재',
          pcfContribution: 12,
          signupStatus: 'joined',
          children: [
            {
              id: 'tier3-4',
              tier: 'Tier 3',
              companyName: '흑연광산',
              companyNameEn: 'Graphite Mine',
              country: 'China',
              materialType: '천연흑연',
              pcfContribution: 5,
              signupStatus: 'joined',
            },
            {
              id: 'tier3-5',
              tier: 'Tier 3',
              companyName: '실리콘소재',
              companyNameEn: 'Silicon Mat.',
              country: 'USA',
              materialType: '실리콘',
              pcfContribution: 4,
              signupStatus: 'invited_only',
            },
          ],
        },
        {
          id: 'tier2-4',
          tier: 'Tier 2',
          companyName: '분리막소재',
          companyNameEn: 'Separator Mat.',
          country: 'Japan',
          materialType: '분리막',
          pcfContribution: 9,
          signupStatus: 'joined',
          children: [
            {
              id: 'tier3-6',
              tier: 'Tier 3',
              companyName: '폴리머화학',
              companyNameEn: 'Polymer Chem',
              country: 'Japan',
              materialType: 'PE/PP',
              pcfContribution: 4,
              signupStatus: 'joined',
            },
          ],
        },
      ],
    },
    {
      id: 'tier1-3',
      tier: 'Tier 1',
      companyName: 'LG에너지',
      companyNameEn: 'LG Energy',
      country: 'South Korea',
      materialType: '배터리 셀',
      pcfContribution: 30,
      signupStatus: 'joined',
      children: [
        {
          id: 'tier2-5',
          tier: 'Tier 2',
          companyName: '중국양극재',
          companyNameEn: 'CN Cathode',
          country: 'China',
          materialType: 'NCM 양극재',
          pcfContribution: 14,
          signupStatus: 'joined',
          children: [
            {
              id: 'tier3-7',
              tier: 'Tier 3',
              companyName: '코발트광산',
              companyNameEn: 'Cobalt Mine',
              country: 'Congo',
              materialType: '코발트 원광',
              pcfContribution: 7,
              signupStatus: 'invited_only',
            },
            {
              id: 'tier3-8',
              tier: 'Tier 3',
              companyName: '망간광산',
              companyNameEn: 'Manganese Mine',
              country: 'South Africa',
              materialType: '망간 원광',
              pcfContribution: 5,
              signupStatus: 'joined',
            },
          ],
        },
        {
          id: 'tier2-6',
          tier: 'Tier 2',
          companyName: '일본전해질',
          companyNameEn: 'JP Electrolyte',
          country: 'Japan',
          materialType: '액체 전해질',
          pcfContribution: 11,
          signupStatus: 'invited_only',
          children: [
            {
              id: 'tier3-9',
              tier: 'Tier 3',
              companyName: '유기용제',
              companyNameEn: 'Organic Solv.',
              country: 'Japan',
              materialType: 'EC/DMC',
              pcfContribution: 5,
              signupStatus: 'joined',
            },
          ],
        },
      ],
    },
  ],
};

// Calculate tree layout positions
function calculateTreeLayout(
  node: SupplyChainTreeNode,
  depth: number = 0,
  offset: number = 0,
  nodeWidth: number = 160,
  nodeHeight: number = 100,
  horizontalSpacing: number = 120,
  verticalSpacing: number = 140
): { nodes: { node: SupplyChainTreeNode; x: number; y: number }[]; width: number } {
  const result: { node: SupplyChainTreeNode; x: number; y: number }[] = [];
  const y = depth * verticalSpacing;

  if (!node.children || node.children.length === 0) {
    result.push({ node, x: offset, y });
    return { nodes: result, width: nodeWidth };
  }

  let currentOffset = offset;
  const childResults: { nodes: { node: SupplyChainTreeNode; x: number; y: number }[]; width: number }[] = [];

  node.children.forEach((child) => {
    const childResult = calculateTreeLayout(
      child,
      depth + 1,
      currentOffset,
      nodeWidth,
      nodeHeight,
      horizontalSpacing,
      verticalSpacing
    );
    childResults.push(childResult);
    result.push(...childResult.nodes);
    currentOffset += childResult.width + horizontalSpacing;
  });

  if (childResults.length === 0) {
    result.push({ node, x: offset, y });
    return { nodes: result, width: nodeWidth };
  }
  const firstChildX = childResults[0].nodes[0]?.x ?? offset;
  const lastChildX = childResults[childResults.length - 1].nodes[0]?.x ?? offset;
  const parentX = (firstChildX + lastChildX) / 2;

  result.push({ node, x: parentX, y });

  const totalWidth = currentOffset - offset - horizontalSpacing;
  return { nodes: result, width: totalWidth };
}

// Get all ancestors and descendants of a node
function getNodePath(nodeId: string, tree: SupplyChainTreeNode): Set<string> {
  const path = new Set<string>();

  function findPath(node: SupplyChainTreeNode, targetId: string, ancestors: string[]): boolean {
    if (node.id === targetId) {
      ancestors.forEach(id => path.add(id));
      path.add(node.id);
      function addDescendants(n: SupplyChainTreeNode) {
        path.add(n.id);
        n.children?.forEach(addDescendants);
      }
      addDescendants(node);
      return true;
    }

    if (node.children) {
      for (const child of node.children) {
        if (findPath(child, targetId, [...ancestors, node.id])) {
          return true;
        }
      }
    }

    return false;
  }

  findPath(tree, nodeId, []);
  return path;
}

// Build edges from tree structure
function buildEdges(node: SupplyChainTreeNode): { source: string; target: string }[] {
  const edges: { source: string; target: string }[] = [];

  if (node.children) {
    node.children.forEach((child) => {
      edges.push({ source: node.id, target: child.id });
      edges.push(...buildEdges(child));
    });
  }

  return edges;
}

// Calculate supplier counts by tier for a BOM
function calculateSupplierCounts(suppliers: string[]): { tier1: number; tier2: number; tier3: number } {
  const counts = { tier1: 0, tier2: 0, tier3: 0 };
  
  suppliers.forEach(supplierId => {
    if (supplierId.startsWith('tier1')) counts.tier1++;
    else if (supplierId.startsWith('tier2')) counts.tier2++;
    else if (supplierId.startsWith('tier3')) counts.tier3++;
  });
  
  return counts;
}

// Calculate total PCF for a BOM (mock calculation)
function calculatePCFTotal(suppliers: string[]): number {
  // Mock: Each supplier contributes ~3-8 kgCO₂e
  return suppliers.filter(s => !s.startsWith('tier0')).length * 5.2;
}

export default function SupplyChainDiagram({
  selectedDetailProduct,
  detailProducts,
  useApiData = false,
  apiNodes = [],
}: SupplyChainDiagramProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredNodeData, setHoveredNodeData] = useState<CompanyNodeData | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const activeTree = useMemo<SupplyChainTreeNode>(() => {
    if (!useApiData && !apiNodes.length) return supplyChainTree;
    const rows = dedupeSupplyChainNodesForDiagram(apiNodes as unknown[]);
    const map = new Map<number, SupplyChainTreeNode>();
    const parentIds = new Map<number, number | null>();
    for (const n of rows) {
      const tierNo = n.tier ?? (n.parent_node_id == null ? 1 : 2);
      const tierLabel = (`Tier ${Math.max(1, Math.min(3, tierNo))}` as SupplyChainTreeNode['tier']);
      map.set(n.id, {
        id: `node-${n.id}`,
        tier: tierLabel,
        companyName: n.supplier_name,
        companyNameEn: n.supplier_name,
        country: '-',
        materialType: '-',
        pcfContribution: 0,
        signupStatus: n.status === 'approved' ? 'joined' : 'invited_only',
        children: [],
      });
      parentIds.set(n.id, n.parent_node_id);
    }
    const roots: SupplyChainTreeNode[] = [];
    for (const [id, node] of map.entries()) {
      const parentId = parentIds.get(id);
      if (parentId != null && map.has(parentId)) {
        map.get(parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }
    return {
      id: 'tier0-root',
      tier: 'Tier 0',
      companyName: '원청사',
      companyNameEn: 'Operator',
      country: '-',
      materialType: '-',
      pcfContribution: 100,
      signupStatus: 'joined',
      children: roots,
    };
  }, [apiNodes, useApiData]);

  // Calculate tree layout
  const layoutResult = useMemo(() => {
    return calculateTreeLayout(activeTree);
  }, [activeTree]);

  // Get hovered path
  const hoveredPath = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    return getNodePath(hoveredNodeId, activeTree);
  }, [hoveredNodeId, activeTree]);

  // Determine which BOM to use for highlighting
  const effectiveSelectedProduct = selectedDetailProduct;

  // Create nodes
  const initialNodes: Node<CompanyNodeData>[] = useMemo(() => {
    const isNodeHighlighted = (nodeId: string) => {
      if (useApiData) return true;
      if (effectiveSelectedProduct === 'ALL') return true;
      const currentDetailProduct = detailProducts.find(dp => dp.id === effectiveSelectedProduct);
      return currentDetailProduct?.suppliers.includes(nodeId) || false;
    };

    const getBomInclusion = (nodeId: string) => {
      const inclusion: { [bomName: string]: boolean } = {};
      detailProducts.forEach(dp => {
        inclusion[dp.displayName] = dp.suppliers.includes(nodeId);
      });
      return inclusion;
    };

    return layoutResult.nodes
      .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
      .map(({ node, x, y }) => ({
      id: node.id,
      type: 'company',
      position: {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
      },
      data: {
        id: node.id,
        tier: node.tier,
        companyName: node.companyName,
        companyNameEn: node.companyNameEn,
        country: node.country,
        materialType: node.materialType,
        isHighlighted: isNodeHighlighted(node.id),
        bomInclusion: getBomInclusion(node.id),
        pcfContribution: node.pcfContribution,
        signupStatus: node.signupStatus,
        showBomComparison: true,
        isHovered: hoveredPath.has(node.id),
        zoomLevel,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      draggable: true,
    }));
  }, [effectiveSelectedProduct, detailProducts, layoutResult, hoveredPath, zoomLevel]);

  // Create edges
  const initialEdges: Edge[] = useMemo(() => {
    const isEdgeHighlighted = (sourceId: string, targetId: string) => {
      if (useApiData) return true;
      if (effectiveSelectedProduct === 'ALL') return true;
      const currentDetailProduct = detailProducts.find(dp => dp.id === effectiveSelectedProduct);
      return (
        (currentDetailProduct?.suppliers.includes(sourceId) || false) &&
        (currentDetailProduct?.suppliers.includes(targetId) || false)
      );
    };

    const isEdgeInPath = (sourceId: string, targetId: string) => {
      return hoveredPath.has(sourceId) && hoveredPath.has(targetId);
    };

    const edges = buildEdges(activeTree);

    return edges.map(edge => {
      const highlighted = isEdgeHighlighted(edge.source, edge.target);
      const inPath = isEdgeInPath(edge.source, edge.target);
      const isFiltering = effectiveSelectedProduct !== 'ALL';

      return {
        id: `e-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: ConnectionLineType.SmoothStep,
        animated: inPath,
        style: {
          stroke: inPath ? '#5B3BFA' : highlighted && isFiltering ? '#5B3BFA' : '#D9D9D9',
          strokeWidth: inPath ? 3 : highlighted && isFiltering ? 2.5 : 1.5,
          opacity: highlighted ? 1 : isFiltering ? 0.25 : 1,
          transition: 'all 200ms ease-in-out',
        },
      };
    });
  }, [effectiveSelectedProduct, detailProducts, hoveredPath, activeTree, useApiData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // initialNodes/initialEdges 변경 시 상태 동기화
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const canRenderMiniMap = useMemo(() => {
    const positioned = nodes.filter(
      (n) => Number.isFinite(n.position?.x) && Number.isFinite(n.position?.y),
    );
    if (positioned.length === 0) return false;

    const xs = positioned.map((n) => n.position.x);
    const ys = positioned.map((n) => n.position.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // MiniMap은 폭/높이가 0인 경우(view bounds degenerate) 내부 viewBox 계산에서 NaN이 발생할 수 있다.
    return Number.isFinite(minX) && Number.isFinite(maxX) && Number.isFinite(minY) && Number.isFinite(maxY) && maxX > minX && maxY > minY;
  }, [nodes]);

  const onNodeMouseEnter: NodeMouseHandler = useCallback((event, node) => {
    setHoveredNodeId(node.id);
    setHoveredNodeData(node.data as CompanyNodeData);
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNodeId(null);
    setHoveredNodeData(null);
  }, []);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node.data);
  }, []);

  const handleAutoArrange = useCallback(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  const handleResetLayout = useCallback(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  return (
    <div className="w-full relative">
      {/* Layout Controls */}
      <div className="flex items-center justify-end gap-3 mb-4">
        {/* Signup status legend */}
        <div className="mr-auto flex items-center gap-2 text-xs">
          <span className="font-semibold text-gray-600">상태</span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border" style={{ backgroundColor: '#FFF4E6', borderColor: '#FDBA74', color: '#C2410C' }}>
            <AlertCircle size={12} />
            등록만(미가입)
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border" style={{ backgroundColor: '#ECFDF3', borderColor: '#86EFAC', color: '#166534' }}>
            <CheckCircle2 size={12} />
            회원가입 완료
          </span>
        </div>

        {/* Auto Arrange Button */}
        <button
          onClick={handleAutoArrange}
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-purple-600 text-purple-600 rounded-xl font-medium transition-all hover:bg-purple-50"
        >
          <Sparkles size={16} />
          Auto Arrange
        </button>

        {/* Reset Layout Button */}
        <button
          onClick={handleResetLayout}
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-medium transition-all hover:bg-gray-50"
        >
          <RotateCcw size={16} />
          Reset Layout
        </button>
      </div>

      {/* Graph Canvas */}
      <div className="w-full h-[700px] bg-[#F6F8FB] rounded-2xl overflow-hidden relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          nodeTypes={NODE_TYPES}
          connectionLineType={ConnectionLineType.SmoothStep}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          onlyRenderVisibleElements
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
          onMove={(event, viewport) => {
            setZoomLevel(viewport.zoom);
          }}
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#E5E7EB" gap={16} />
          <Controls className="bg-white rounded-lg shadow-lg" />
          {canRenderMiniMap && (
            <MiniMap
              className="bg-white rounded-lg shadow-lg"
              style={{ width: '180px', height: '120px' }}
              nodeColor={(node) => {
                const data = node.data as CompanyNodeData;
                return getTierColor(data.tier);
              }}
              maskColor="rgba(0, 0, 0, 0.06)"
            />
          )}
        </ReactFlow>

        {/* Hover Tooltip */}
        {hoveredNodeData && (
          <div
            className="absolute top-4 right-4 bg-white rounded-2xl shadow-2xl p-4 z-50"
            style={{
              width: '280px',
              border: `2px solid ${getTierColor(hoveredNodeData.tier)}`,
            }}
          >
            {/* Tier Badge */}
            <div className="mb-2">
              <span
                className="px-3 py-1 text-xs font-semibold text-white rounded-full"
                style={{ backgroundColor: getTierColor(hoveredNodeData.tier) }}
              >
                {hoveredNodeData.tier}
              </span>
            </div>

            {/* Company Name */}
            <h3 className="text-lg font-bold text-gray-900 mb-1">{hoveredNodeData.companyName}</h3>
            <p className="text-sm text-gray-500 mb-3">{hoveredNodeData.companyNameEn}</p>

            {/* Details */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">국가</span>
                <span className="font-medium text-gray-900">{hoveredNodeData.country}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">제품 역할</span>
                <span className="font-medium text-gray-900">{hoveredNodeData.materialType}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">가입 상태</span>
                <span className={`font-semibold ${hoveredNodeData.signupStatus === 'joined' ? 'text-green-700' : 'text-orange-700'}`}>
                  {hoveredNodeData.signupStatus === 'joined' ? '회원가입 완료' : '등록만(미가입)'}
                </span>
              </div>
            </div>

            {/* CO₂ Contribution */}
            {hoveredNodeData.pcfContribution !== undefined && hoveredNodeData.signupStatus !== 'invited_only' && (
              <div className="mb-3 p-3 bg-purple-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">CO₂ 기여도</span>
                  <span className="text-lg font-bold text-gray-900">{hoveredNodeData.pcfContribution}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${hoveredNodeData.pcfContribution}%`,
                      background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* BOM Inclusion */}
            {Object.keys(hoveredNodeData.bomInclusion).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">BOM 포함 여부</h4>
                <div className="space-y-1">
                  {Object.entries(hoveredNodeData.bomInclusion).map(([bomName, isIncluded]) => (
                    <div key={bomName} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{bomName}</span>
                      <span className={`font-medium ${isIncluded ? 'text-green-600' : 'text-gray-400'}`}>
                        {isIncluded ? '✓ 포함' : '- 미포함'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}