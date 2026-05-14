import React, { useMemo } from 'react';
import { Layers, Type, Square, Circle, Image as ImageIcon, Sparkles, Code, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_ICONS = {
  text: Type,
  rect: Square,
  circle: Circle,
  image: ImageIcon,
  icon: Sparkles,
  html: Code,
};

/**
 * Panneau "Calques" — ordre z, lock/hide par objet.
 */
function layerLabel(o) {
  return o.type === 'text'
    ? String(o.content?.text || 'Texte').slice(0, 28)
    : `${o.type} · ${String(o.id).slice(-6)}`;
}

export default function DesignerLayersPanel({
  objects = [],
  selectedIds = [],
  onSelectOnly,
  onToggleLock,
  onToggleVisibility,
  /** Filtre texte sur le libellé affiché (recherche panneau gauche) */
  filterQuery = '',
  className,
}) {
  const q = (filterQuery || '').trim().toLowerCase();
  const sorted = useMemo(
    () => [...objects].sort((a, b) => (b.layer ?? 0) - (a.layer ?? 0)),
    [objects],
  );
  const visible = useMemo(() => {
    if (!q) return sorted;
    return sorted.filter((o) => layerLabel(o).toLowerCase().includes(q));
  }, [sorted, q]);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c9a227]/90">Calques</p>
        <span className="text-[11px] text-white/35">
          {q ? `${visible.length}/${sorted.length}` : sorted.length}
        </span>
      </div>
      <div className="max-h-[min(40vh,220px)] space-y-0.5 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/25 p-1 [scrollbar-width:thin]">
        {sorted.length === 0 ? (
          <p className="px-2 py-3 text-center text-[12px] leading-relaxed text-white/35">
            Ajoutez des objets depuis la barre d&apos;outils.
          </p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-3 text-center text-[12px] leading-relaxed text-white/35">
            Aucun calque ne correspond au filtre.
          </p>
        ) : (
          visible.map((o) => {
            const Icon = TYPE_ICONS[o.type] || Layers;
            const sel = selectedIds.includes(o.id);
            const label = layerLabel(o);
            return (
              <div
                key={o.id}
                className={cn(
                  'group flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[12px] transition-colors',
                  sel
                    ? 'bg-[#D4AF37]/15 text-[#f5dd8a] ring-1 ring-[#D4AF37]/35'
                    : o.hidden
                      ? 'text-white/25 hover:bg-white/[0.04]'
                      : 'text-white/72 hover:bg-white/[0.06]',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectOnly(o.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5"
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', o.hidden ? 'text-white/20' : 'text-white/45')} />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <span className="shrink-0 tabular-nums text-[11px] text-white/30">{o.layer ?? 0}</span>
                </button>
                {/* Lock */}
                <button
                  type="button"
                  title={o.locked ? 'Deverrouiller' : 'Verrouiller'}
                  onClick={(e) => { e.stopPropagation(); onToggleLock?.(o.id); }}
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors',
                    o.locked
                      ? 'text-amber-400/80 hover:text-amber-300'
                      : 'text-white/0 group-hover:text-white/30 hover:!text-white/60',
                  )}
                >
                  {o.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </button>
                {/* Visibility */}
                <button
                  type="button"
                  title={o.hidden ? 'Afficher' : 'Masquer'}
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility?.(o.id); }}
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors',
                    o.hidden
                      ? 'text-white/30 hover:text-white/60'
                      : 'text-white/0 group-hover:text-white/30 hover:!text-white/60',
                  )}
                >
                  {o.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
