/**
 * Mindmap cours (arbre récursif) — données Copilot `course.mindmap`.
 * Clic « Canvas » : envoie le libellé vers la scène active (texte Konva).
 */
import React from 'react';
import { PlusSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @param {{
 *   node: import('../model/courseCopilotTypes').CourseMindmapNode;
 *   depth: number;
 *   onInsert?: (p: { nodeId: string; label: string }) => void;
 * }} props
 */
function MindNode({ node, depth, onInsert }) {
  if (!node) return null;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const label = (node.label || '—').trim();
  const nid = node.id || `mm-${label.slice(0, 24)}`;

  return (
    <div className={cn('border-l border-white/[0.08]', depth > 0 && 'ml-2 pl-2')}>
      <div className="group flex items-start gap-1.5">
        <p className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-white/85">{label}</p>
        {typeof onInsert === 'function' ? (
          <button
            type="button"
            onClick={() => onInsert({ nodeId: nid, label })}
            title="Insérer sur le canvas (texte)"
            className="shrink-0 rounded border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#e8c76b] opacity-80 hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] hover:opacity-100"
          >
            <span className="inline-flex items-center gap-0.5">
              <PlusSquare className="h-3 w-3" />
              Canvas
            </span>
          </button>
        ) : null}
      </div>
      {hasChildren ? (
        <div className="mt-1 space-y-1">
          {node.children.map((ch) => (
            <MindNode key={ch.id || ch.label} node={ch} depth={depth + 1} onInsert={onInsert} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   root: import('../model/courseCopilotTypes').CourseMindmapNode | null | undefined;
 *   activeSlideTitle?: string | null;
 *   onInsertNode?: (p: { nodeId: string; label: string }) => void;
 *   className?: string;
 * }} props
 */
export default function CourseMindmapTree({ root, activeSlideTitle, onInsertNode, className }) {
  const hasTree = root && (root.label || (root.children && root.children.length));

  return (
    <div className={cn('flex flex-col gap-3 p-3', className)}>
      <div className="rounded-xl border border-violet-500/25 bg-violet-950/20 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-violet-200/90">Mindmap du parcours</p>
        <p className="mt-1 text-[9px] leading-relaxed text-white/40">
          Vue issue du plan Copilot (structure globale du cours). Utilisez <span className="text-violet-200/80">Canvas</span> pour placer un libellé sur la scène.
        </p>
        {activeSlideTitle ? (
          <p className="mt-2 truncate text-[10px] text-[color-mix(in_srgb,var(--school-accent)_75%,transparent)]">
            Fiche canvas liée (Copilot) : <span className="font-medium text-[#f5dd8a]/90">{activeSlideTitle}</span>
          </p>
        ) : null}
      </div>

      {!hasTree ? (
        <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-center text-[11px] leading-relaxed text-white/45">
          Aucune mindmap — analysez une source dans le panneau cours ou importez un plan pour remplir l'arborescence.
        </p>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3 [scrollbar-width:thin]">
          <MindNode node={root} depth={0} onInsert={onInsertNode} />
        </div>
      )}
    </div>
  );
}
