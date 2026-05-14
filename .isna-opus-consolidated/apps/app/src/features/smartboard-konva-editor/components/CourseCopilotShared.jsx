import React from 'react';
import { ClipboardCopy } from 'lucide-react';
import { cn } from '@/lib/utils';

export function copyText(text) {
  if (!text) return;
  void navigator.clipboard?.writeText(text);
}

/**
 * Réduit l’arbre mindmap aux branches dont le libellé matche `query` (ou descendants).
 * @param {unknown} node
 * @param {string} [query]
 */
export function filterMindmapNodeByQuery(node, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q || !node || typeof node !== 'object') return node;
  const walk = (n) => {
    if (!n || typeof n !== 'object') return null;
    const labelMatch = String(n.label || '').toLowerCase().includes(q);
    const rawKids = Array.isArray(n.children) ? n.children : [];
    const kids = rawKids.map(walk).filter(Boolean);
    if (labelMatch || kids.length) {
      return { ...n, children: kids };
    }
    return null;
  };
  return walk(node);
}

export function MindmapTree({ node }) {
  if (!node) return null;
  return (
    <li className="text-[10px] text-white/80">
      <span className="font-medium text-[#e8c76b]">{node.label}</span>
      {node.children?.length ? (
        <ul className="ml-2 mt-1 space-y-0.5 border-l border-[#D4AF37]/22 pl-2">
          {node.children.map((ch) => (
            <MindmapTree key={ch.id} node={ch} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Carte section — style premium cohérent */
export function CopilotCard({ title, icon: Icon, accent = 'gold', children, className }) {
  const accents = {
    gold: 'border-[#D4AF37]/25 shadow-[0_0_24px_-8px_rgba(212,175,55,0.15)]',
    violet: 'border-violet-500/25 shadow-[0_0_24px_-8px_rgba(139,92,246,0.12)]',
    teal: 'border-teal-500/20 shadow-[0_0_20px_-10px_rgba(45,212,191,0.12)]',
    rose: 'border-rose-500/20',
  };
  const labels = {
    gold: 'text-[#f0d78c]',
    violet: 'text-violet-200/95',
    teal: 'text-teal-200/95',
    rose: 'text-rose-200/95',
  };
  return (
    <section
      className={cn(
        'rounded-2xl border bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-3 backdrop-blur-sm',
        accents[accent],
        className,
      )}
    >
      <div
        className={cn(
          'mb-2.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]',
          labels[accent],
        )}
      >
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" /> : null}
        {title}
      </div>
      {children}
    </section>
  );
}

export function CopyRow({ label, text, className }) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/35 p-2.5',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[8px] font-medium uppercase tracking-wide text-white/40">{label}</p>
        <p className="mt-1 whitespace-pre-wrap text-[10px] leading-relaxed text-white/[0.88]">{text}</p>
      </div>
      <button
        type="button"
        title="Copier"
        onClick={() => copyText(text)}
        className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/45 transition-colors hover:border-[#D4AF37]/40 hover:text-[#D4AF37]"
      >
        <ClipboardCopy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Zone slide : rôle + consigne + copier le bloc */
export function ZoneCopyCard({ zone, index }) {
  const bundle = `${zone.role}\n\n${zone.hint}`;
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/30 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-white/35">Zone {index + 1}</p>
          <p className="mt-0.5 text-[11px] font-medium text-[#e8c76b]">{zone.role}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-white/65">{zone.hint}</p>
        </div>
        <button
          type="button"
          onClick={() => copyText(bundle)}
          className="shrink-0 rounded-lg border border-[#D4AF37]/28 bg-black/35 px-2 py-1.5 text-[9px] font-medium text-[#e8c76b]/95 transition-colors hover:bg-[#D4AF37]/12"
        >
          Copier
        </button>
      </div>
    </div>
  );
}
