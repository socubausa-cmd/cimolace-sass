/**
 * MindmapCanvasView — rendu visuel interactif d'un mindmap.
 * Affiche les noeuds et connexions du segment actif.
 */
import React, { useCallback, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const NODE_W = 140;
const NODE_H = 44;
const H_GAP = 80;
const V_GAP = 60;

/**
 * Computes x/y for each node using a simple radial layout.
 */
function layoutNodes(root, cx = 600, cy = 300) {
  const positions = new Map();

  function place(node, x, y, depth, angleStart, angleEnd) {
    positions.set(node.id, { x, y, label: node.label, depth });
    const children = node.children ?? [];
    if (!children.length) return;
    const step = (angleEnd - angleStart) / children.length;
    const radius = depth === 0 ? 200 : 160;
    children.forEach((child, i) => {
      const angle = angleStart + step * i + step / 2;
      const childX = x + Math.cos(angle) * radius;
      const childY = y + Math.sin(angle) * radius;
      place(child, childX, childY, depth + 1, angle - Math.PI / 4, angle + Math.PI / 4);
    });
  }

  if (root) place(root, cx, cy, 0, 0, Math.PI * 2);
  return positions;
}

function MindmapNode({ id, x, y, label, depth, active, onClick }) {
  const colors = ['bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] text-[var(--school-accent)]', 'bg-blue-500/10 border-blue-500/30 text-blue-300', 'bg-white/[0.04] border-white/15 text-white/70'];
  const colorClass = colors[Math.min(depth, colors.length - 1)];

  return (
    <foreignObject x={x - NODE_W / 2} y={y - NODE_H / 2} width={NODE_W} height={NODE_H}>
      <div
        onClick={() => onClick(id)}
        className={cn(
          'flex h-full cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-[11px] font-medium transition-all',
          colorClass,
          active && 'ring-2 ring-[color-mix(in_srgb,var(--school-accent)_60%,transparent)]',
        )}
        title={label}
      >
        <span className="line-clamp-2 leading-tight">{label}</span>
      </div>
    </foreignObject>
  );
}

function MindmapEdge({ from, to }) {
  if (!from || !to) return null;
  const mx = (from.x + to.x) / 2;
  return (
    <path
      d={`M ${from.x} ${from.y} C ${mx} ${from.y} ${mx} ${to.y} ${to.x} ${to.y}`}
      fill="none"
      stroke="rgba(255,255,255,0.12)"
      strokeWidth={1.5}
    />
  );
}

export default function MindmapCanvasView({ mindmap, onUpdate, readOnly = false }) {
  const [activeId, setActiveId] = useState(null);

  const root = mindmap?.root;
  const positions = layoutNodes(root);

  const edges = [];
  function collectEdges(node) {
    if (!node) return;
    for (const child of node.children ?? []) {
      edges.push({ from: positions.get(node.id), to: positions.get(child.id) });
      collectEdges(child);
    }
  }
  collectEdges(root);

  if (!root) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[12px] text-white/30">Aucun mindmap. Générez-en un depuis le Course Builder.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#080a12]">
      <svg className="absolute inset-0 h-full w-full">
        {/* Edges */}
        {edges.map((e, i) => <MindmapEdge key={i} from={e.from} to={e.to} />)}
        {/* Nodes */}
        {[...positions.entries()].map(([id, pos]) => (
          <MindmapNode
            key={id}
            id={id}
            x={pos.x}
            y={pos.y}
            label={pos.label}
            depth={pos.depth}
            active={activeId === id}
            onClick={(nid) => setActiveId((prev) => prev === nid ? null : nid)}
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 rounded-lg border border-white/8 bg-black/50 px-3 py-2 text-[10px] text-white/30 backdrop-blur-sm">
        Mindmap — {[...positions.size].length > 0 ? positions.size : '?'} noeuds
      </div>
    </div>
  );
}
