import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AlertTriangle, CheckCircle, Clock, Building2 } from 'lucide-react';

interface SupplyChainMapProps {
  versionId: string;
  highlightedNode?: string | null;
}

interface SupplyChainNode {
  id: string;
  tier: string;
  name: string;
  nameEn: string;
  country: string;
  status: 'verified' | 'submitted' | 'pending';
  riskLevel: 'high' | 'medium' | 'low' | null;
}

// Mock data for supply chain nodes
const mockNodes: SupplyChainNode[] = [
  {
    id: '1',
    tier: 'Tier 1',
    name: '한국배터리',
    nameEn: 'Korea Battery Co.',
    country: 'South Korea',
    status: 'verified',
    riskLevel: 'low',
  },
  {
    id: '2',
    tier: 'Tier 2',
    name: '셀테크',
    nameEn: 'Cell Tech Inc.',
    country: 'China',
    status: 'submitted',
    riskLevel: 'medium',
  },
  {
    id: '3',
    tier: 'Tier 2',
    name: 'BMS Solutions',
    nameEn: 'BMS Solutions',
    country: 'Germany',
    status: 'verified',
    riskLevel: 'low',
  },
  {
    id: '4',
    tier: 'Tier 3',
    name: '리튬광산',
    nameEn: 'Lithium Mine Corp.',
    country: 'Australia',
    status: 'pending',
    riskLevel: 'low',
  },
  {
    id: '5',
    tier: 'Tier 3',
    name: '코발트광산',
    nameEn: 'Cobalt Mine Inc.',
    country: 'DRC',
    status: 'submitted',
    riskLevel: 'high',
  },
  {
    id: '6',
    tier: 'Tier 3',
    name: 'IC Manufacturer',
    nameEn: 'IC Manufacturer',
    country: 'Taiwan',
    status: 'verified',
    riskLevel: 'low',
  },
];

const CustomNode = ({ data }: any) => {
  const isHighlighted = data.highlighted;
  
  return (
    <div
      className={`px-6 py-4 rounded-xl border-2 transition-all ${
        isHighlighted
          ? 'border-[#5B3BFA] bg-gradient-to-r from-[#5B3BFA]/10 to-[#00B4FF]/10 shadow-lg'
          : 'border-gray-300 bg-white shadow-md hover:shadow-lg'
      }`}
      style={{ minWidth: '240px' }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      
      {/* Tier Badge */}
      <div className="mb-3">
        <span className="inline-block px-3 py-1 bg-[#5B3BFA] text-white rounded-full text-xs font-semibold">
          {data.tier}
        </span>
      </div>

      {/* Company Name */}
      <div className="mb-3">
        <div className="font-semibold text-gray-900 mb-1">{data.name}</div>
        <div className="text-sm text-gray-500">{data.nameEn}</div>
      </div>

      {/* Country */}
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600">{data.country}</span>
      </div>

      {/* Status and Risk */}
      <div className="flex items-center gap-2">
        {/* Status Badge */}
        <div className="flex items-center gap-1">
          {data.status === 'verified' ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-xs text-green-700">검증완료</span>
            </>
          ) : data.status === 'submitted' ? (
            <>
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-blue-700">제출완료</span>
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">대기중</span>
            </>
          )}
        </div>

        {/* Risk Badge */}
        {data.riskLevel && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
              data.riskLevel === 'high'
                ? 'bg-red-100 text-red-700'
                : data.riskLevel === 'medium'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            {data.riskLevel === 'high' ? '높음' : data.riskLevel === 'medium' ? '중간' : '낮음'}
          </span>
        )}
      </div>
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export default function SupplyChainMap({ versionId, highlightedNode }: SupplyChainMapProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    // Create nodes with positions
    const flowNodes: Node[] = mockNodes.map((node, index) => {
      const tier = parseInt(node.tier.split(' ')[1]);
      const nodesInTier = mockNodes.filter((n) => n.tier === node.tier);
      const indexInTier = nodesInTier.findIndex((n) => n.id === node.id);
      
      return {
        id: node.id,
        type: 'custom',
        position: {
          x: (tier - 1) * 350,
          y: indexInTier * 200 + 50,
        },
        data: {
          ...node,
          highlighted: highlightedNode === node.id,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    // Create edges
    const flowEdges: Edge[] = [
      {
        id: 'e1-2',
        source: '1',
        target: '2',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#5B3BFA', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#5B3BFA',
        },
      },
      {
        id: 'e1-3',
        source: '1',
        target: '3',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#5B3BFA', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#5B3BFA',
        },
      },
      {
        id: 'e2-4',
        source: '2',
        target: '4',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#00B4FF', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#00B4FF',
        },
      },
      {
        id: 'e2-5',
        source: '2',
        target: '5',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#00B4FF', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#00B4FF',
        },
      },
      {
        id: 'e3-6',
        source: '3',
        target: '6',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#00B4FF', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#00B4FF',
        },
      },
    ];

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [versionId, highlightedNode, setNodes, setEdges]);

  return (
    <div className="w-full h-full bg-[#F6F8FB]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#E5E7EB" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.data.highlighted) return '#5B3BFA';
            return '#E5E7EB';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-20 left-4 bg-white p-4 rounded-xl shadow-lg" style={{ maxWidth: '250px' }}>
        <h4 className="font-semibold mb-3 text-sm">범례</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-[#5B3BFA]"></div>
            <span>Tier 1 → Tier 2</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-[#00B4FF]"></div>
            <span>Tier 2 → Tier 3</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>검증완료</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>제출완료</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>대기중</span>
          </div>
        </div>
      </div>
    </div>
  );
}