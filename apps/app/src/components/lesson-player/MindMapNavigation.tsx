import React, { useEffect, useMemo } from 'react';
import ReactFlow, { Background, Controls, useEdgesState, useNodesState } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { MindMapNode, tsToSeconds } from './types';

type Props = {
  mindmap: MindMapNode | null;
  onSeek: (timeSeconds: number) => void;
  heightClassName?: string;
  onSelectNode?: (node: MindMapNode) => void;
  onRawNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
  hideLabel?: boolean;
  clickedNodeIds?: Set<string>;
};

type FlatNode = { id: string; label: string; timeSeconds: number; parentId?: string };

const flattenWithMap = (root: MindMapNode): { flat: FlatNode[]; byId: Map<string, MindMapNode> } => {
  const flat: FlatNode[] = [];
  const byId = new Map<string, MindMapNode>();
  const walk = (n: MindMapNode, parentId?: string) => {
    const t = tsToSeconds(n) ?? 0;
    flat.push({ id: n.id, label: n.label, timeSeconds: t, parentId });
    byId.set(n.id, n);
    (n.children || []).forEach((c) => walk(c, n.id));
  };
  walk(root);
  return { flat, byId };
};

const MindMapNavigation: React.FC<Props> = ({ mindmap, onSeek, heightClassName, onSelectNode, onRawNodeClick, selectedNodeId, hideLabel, clickedNodeIds }) => {
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!mindmap) return { initialNodes: [] as Node[], initialEdges: [] as Edge[] };
    const { flat } = flattenWithMap(mindmap);

    // simple layout: levels by depth, vertical list per depth
    const depthMap = new Map<string, number>();
    depthMap.set(flat[0]?.id, 0);

    const byId = new Map(flat.map((f) => [f.id, f] as const));
    const getDepth = (id: string): number => {
      if (depthMap.has(id)) return depthMap.get(id)!;
      const n = byId.get(id);
      if (!n) return 0;
      const d = n.parentId ? getDepth(n.parentId) + 1 : 0;
      depthMap.set(id, d);
      return d;
    };

    const columns = new Map<number, FlatNode[]>();
    flat.forEach((f) => {
      const d = getDepth(f.id);
      const arr = columns.get(d) || [];
      arr.push(f);
      columns.set(d, arr);
    });

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    Array.from(columns.entries()).forEach(([d, arr]) => {
      arr.forEach((f, idx) => {
        nodes.push({
          id: f.id,
          position: { x: d * 260, y: idx * 90 },
          data: { label: f.label, timeSeconds: f.timeSeconds },
          style: {
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'white',
            borderRadius: 10,
            padding: 10,
            width: 220,
          },
        });

        if (f.parentId) {
          edges.push({
            id: `${f.parentId}-${f.id}`,
            source: f.parentId,
            target: f.id,
            animated: false,
            style: { stroke: 'rgba(212,175,55,0.35)' },
          });
        }
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [mindmap]);

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);

  const nodeById = useMemo(() => {
    if (!mindmap) return new Map<string, MindMapNode>();
    return flattenWithMap(mindmap).byId;
  }, [mindmap]);

  useEffect(() => {
    setNodes(
      (initialNodes || []).map((n) => {
        const baseStyle = n.style || {};
        const isSelected = selectedNodeId && n.id === selectedNodeId;
        const isClicked = clickedNodeIds?.has(n.id);
        const style =
          isSelected
            ? { border: '1px solid rgba(96,165,250,0.9)', boxShadow: '0 0 0 2px rgba(59,130,246,0.15)', background: 'rgba(59,130,246,0.08)' }
            : isClicked
            ? { border: '1px solid rgba(212,175,55,0.7)', boxShadow: '0 0 6px rgba(212,175,55,0.2)', background: 'rgba(212,175,55,0.06)' }
            : { border: '1px solid rgba(255,255,255,0.10)', boxShadow: 'none', background: 'rgba(255,255,255,0.04)' };
        return { ...n, style: { ...baseStyle, ...style } };
      })
    );
  }, [initialNodes, selectedNodeId, clickedNodeIds, setNodes]);

  const isValid = Boolean(mindmap && mindmap.id && mindmap.label);

  return (
    <div className={hideLabel ? 'flex flex-col h-full min-h-0' : 'h-full'}>
      {!hideLabel && <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Mind map</div>}
      {!isValid ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500">
          <div className="text-2xl">🗺️</div>
          <div className="text-sm">Aucune mindmap disponible</div>
          <div className="text-xs text-gray-600 text-center max-w-[220px]">Génère la mindmap dans la post-production de la vidéo.</div>
        </div>
      ) : (
        <div className={`${hideLabel ? 'flex-1 min-h-0' : (heightClassName || 'h-[420px]')} rounded-lg overflow-hidden border border-white/10 bg-black`}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            onNodeClick={(_, node) => {
              const t = Number((node.data as any)?.timeSeconds);
              if (Number.isFinite(t)) onSeek(t);
              if (onRawNodeClick) onRawNodeClick(node.id);
              const raw = nodeById.get(node.id);
              if (onSelectNode) {
                onSelectNode(raw ?? {
                  id: node.id,
                  label: String((node.data as any)?.label || node.id),
                  timeSeconds: Number.isFinite(t) ? t : undefined,
                });
              }
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} color="rgba(255,255,255,0.06)" />
            <Controls />
          </ReactFlow>
        </div>
      )}
    </div>
  );
};

export default MindMapNavigation;
