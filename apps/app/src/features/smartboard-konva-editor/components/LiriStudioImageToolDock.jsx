import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MousePointer2,
  Square,
  Circle,
  PencilLine,
  Layers,
  X,
  Maximize2,
  Keyboard,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Crosshair,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';
import { applyWorkbenchInteractionTool } from '../hooks/useSmartboardDesignKeyboardShortcuts';
import DesignerLayersPanel from './DesignerLayersPanel';

const TOOLS = [
  { id: 'pointer', label: 'Déplacer / sélection', icon: MousePointer2, shortcut: '1' },
  { id: 'marquee-rect', label: 'Sélection rectangulaire', icon: Square, shortcut: '2' },
  { id: 'marquee-ellipse', label: 'Sélection elliptique', icon: Circle, shortcut: '3' },
  {
    id: 'marquee-lasso',
    label: 'Sélection au lasso (tracé libre, relâcher pour fermer la zone)',
    icon: PencilLine,
    shortcut: '4',
  },
  {
    id: 'crop-image',
    label: 'Recadrer l\'image sélectionnée (glisser sur le cadre, toute rotation)',
    icon: Maximize2,
    shortcut: '5',
  },
];

/**
 * Barre d'outils Studio Image : mode pointeur / sélection région + panneau calques.
 */
export default function LiriStudioImageToolDock({ className }) {
  const { toast } = useToast();
  const interactionTool = useSmartboardKonvaStore((s) => s.interactionTool);
  const getActiveScene = useSmartboardKonvaStore((s) => s.getActiveScene);
  const selectedIds = useSmartboardKonvaStore((s) => s.selectedIds);
  const selectOnly = useSmartboardKonvaStore((s) => s.selectOnly);
  const toggleObjectLock = useSmartboardKonvaStore((s) => s.toggleObjectLock);
  const toggleObjectVisibility = useSmartboardKonvaStore((s) => s.toggleObjectVisibility);
  const removeImageCrop = useSmartboardKonvaStore((s) => s.removeImageCrop);
  const distributeSelectedHorizontal = useSmartboardKonvaStore((s) => s.distributeSelectedHorizontal);
  const distributeSelectedVertical = useSmartboardKonvaStore((s) => s.distributeSelectedVertical);

  const [layersOpen, setLayersOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const applyToolSwitch = useCallback(
    (toolId) => applyWorkbenchInteractionTool(toolId, toast),
    [toast],
  );

  useEffect(() => {
    if (!shortcutsOpen) return undefined;
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setShortcutsOpen(false);
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [shortcutsOpen]);

  const activeScene = getActiveScene();
  const objects = activeScene?.objects ?? [];

  const selectedImage = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return objects.find((o) => o.id === selectedIds[0] && o.type === 'image') ?? null;
  }, [selectedIds, objects]);

  const layersLabel = useMemo(() => {
    const n = objects.length;
    return n ? `Calques (${n})` : 'Calques';
  }, [objects.length]);

  const canAlign = selectedIds.length > 0;
  const canDistribute = selectedIds.length >= 3;

  const ALIGN_ACTIONS = useMemo(
    () => [
      {
        dir: 'left',
        title:
          'Gauche — 1 objet : canvas · 2+ : groupe · Alt+clic : forcer le canvas',
        Icon: AlignLeft,
      },
      {
        dir: 'centerH',
        title:
          'Centre H — 1 objet : canvas · 2+ : groupe · Alt+clic : forcer le canvas',
        Icon: AlignCenter,
      },
      {
        dir: 'right',
        title:
          'Droite — 1 objet : canvas · 2+ : groupe · Alt+clic : forcer le canvas',
        Icon: AlignRight,
      },
      {
        dir: 'top',
        title:
          'Haut — 1 objet : canvas · 2+ : groupe · Alt+clic : forcer le canvas',
        Icon: AlignStartVertical,
      },
      {
        dir: 'centerV',
        title:
          'Centre V — 1 objet : canvas · 2+ : groupe · Alt+clic : forcer le canvas',
        Icon: AlignCenterVertical,
      },
      {
        dir: 'bottom',
        title:
          'Bas — 1 objet : canvas · 2+ : groupe · Alt+clic : forcer le canvas',
        Icon: AlignEndVertical,
      },
    ],
    [],
  );

  return (
    <>
      <div
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-1 border-b border-white/[0.08] bg-[#080a11] px-3 py-1.5',
          className,
        )}
      >
        <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30 sm:inline">
          Plan
        </span>
        <button
          type="button"
          title="Raccourcis clavier du plan de travail"
          aria-expanded={shortcutsOpen}
          aria-controls="liri-studio-shortcuts-panel"
          onClick={() => setShortcutsOpen((v) => !v)}
          className={cn(
            'mr-0.5 flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
            shortcutsOpen
              ? 'border-[#D4AF37]/45 bg-[#D4AF37]/12 text-[#f5dd8a]'
              : 'border-transparent text-white/40 hover:bg-white/[0.06] hover:text-white/75',
          )}
        >
          <Keyboard className="h-4 w-4" />
        </button>
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const on = interactionTool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              title={`${t.label} — raccourci ${t.shortcut}`}
              aria-pressed={on}
              onClick={() => applyToolSwitch(t.id)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                on
                  ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#f5dd8a]'
                  : 'border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/80',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
        <div className="mx-1 h-5 w-px bg-white/10" />
        <span className="mr-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30 sm:inline">
          Aligner
        </span>
        {ALIGN_ACTIONS.map(({ dir, title, Icon }) => (
          <button
            key={dir}
            type="button"
            title={title}
            disabled={!canAlign}
            onClick={(e) => {
              if (!canAlign) {
                toast({
                  variant: 'destructive',
                  title: 'Alignement',
                  description: 'Sélectionnez au moins un objet sur le canvas.',
                });
                return;
              }
              alignSelected(dir, { forceCanvas: e.altKey });
            }}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
              canAlign
                ? 'border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/80'
                : 'cursor-not-allowed border-transparent text-white/20',
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <button
          type="button"
          title="Centrer H+V — 1 objet : plan · 2+ : groupe · Alt+clic : chaque objet centré sur le plan"
          disabled={!canAlign}
          onClick={(e) => {
            if (!canAlign) {
              toast({
                variant: 'destructive',
                title: 'Alignement',
                description: 'Sélectionnez au moins un objet sur le canvas.',
              });
              return;
            }
            alignSelectedCenterBoth({ forceCanvas: e.altKey });
          }}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
            canAlign
              ? 'border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/80'
              : 'cursor-not-allowed border-transparent text-white/20',
          )}
        >
          <Crosshair className="h-4 w-4" />
        </button>
        <span className="mx-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30 sm:inline">
          Distrib.
        </span>
        <button
          type="button"
          title="Répartir horizontalement (3 objets min. — espacement égal entre bords)"
          disabled={!canDistribute}
          onClick={() => {
            if (!canDistribute) {
              toast({
                variant: 'destructive',
                title: 'Distribution',
                description: 'Sélectionnez au moins trois objets.',
              });
              return;
            }
            distributeSelectedHorizontal();
          }}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
            canDistribute
              ? 'border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/80'
              : 'cursor-not-allowed border-transparent text-white/20',
          )}
        >
          <AlignHorizontalDistributeCenter className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Répartir verticalement (3 objets min. — espacement égal entre bords)"
          disabled={!canDistribute}
          onClick={() => {
            if (!canDistribute) {
              toast({
                variant: 'destructive',
                title: 'Distribution',
                description: 'Sélectionnez au moins trois objets.',
              });
              return;
            }
            distributeSelectedVertical();
          }}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
            canDistribute
              ? 'border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/80'
              : 'cursor-not-allowed border-transparent text-white/20',
          )}
        >
          <AlignVerticalDistributeCenter className="h-4 w-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <button
          type="button"
          title={layersLabel}
          aria-expanded={layersOpen}
          onClick={() => setLayersOpen((v) => !v)}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] transition-colors',
            layersOpen
              ? 'border-[#D4AF37]/45 bg-[#D4AF37]/12 text-[#f5dd8a]'
              : 'border-white/10 text-white/55 hover:bg-white/[0.05] hover:text-white/85',
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          Calques
        </button>
        {selectedImage?.content?.crop &&
        typeof selectedImage.content.crop === 'object' &&
        Number(selectedImage.content.crop.width) > 0 ? (
          <button
            type="button"
            title="Réinitialiser le recadrage source (pleine texture)"
            onClick={() => removeImageCrop(selectedImage.id)}
            className="inline-flex h-8 shrink-0 items-center rounded-lg border border-amber-500/35 bg-amber-950/30 px-2.5 text-[11px] text-amber-100/90 hover:bg-amber-900/35"
          >
            Réinit. crop
          </button>
        ) : null}
        <p className="ml-auto hidden max-w-[min(52vw,440px)] text-[10px] leading-snug text-white/32 xl:block">
          1–5 outils · ⌘/Ctrl+Z annuler · ⌘/Ctrl+⇧+flèche aligner · voir clavier · Lasso · Distrib. 3+ · Échap : annuler
        </p>
      </div>

      {shortcutsOpen ? (
        <div
          className="fixed inset-0 z-[81] flex items-start justify-center pt-[52px] sm:pt-14"
          role="dialog"
          aria-label="Raccourcis Studio Image"
          id="liri-studio-shortcuts-panel"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Fermer"
            onClick={() => setShortcutsOpen(false)}
          />
          <div className="relative z-[1] m-3 w-[min(100vw-1.5rem,400px)] rounded-xl border border-white/10 bg-[#0c0e16] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-white/90">Raccourcis — plan de travail</p>
              <button
                type="button"
                className="rounded-lg p-1 text-white/40 hover:bg-white/[0.08] hover:text-white"
                onClick={() => setShortcutsOpen(false)}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-[11px] leading-snug text-white/45">
              Annuler / refaire : même raccourcis que dans tout l'éditeur Konva (hors champ texte). Touches{' '}
              <span className="text-white/60">1</span> à <span className="text-white/60">5</span> ici (sur AZERTY souvent{' '}
              <span className="text-white/60">Maj</span> + chiffre) : pas de Ctrl / Cmd / Alt. Aligner ci‑dessous : partout dans le designer.
            </p>
            <ul className="space-y-2 text-[12px] text-white/80">
              {TOOLS.map((t) => (
                <li key={t.id} className="flex items-start gap-3 border-b border-white/[0.06] pb-2 last:border-0 last:pb-0">
                  <kbd className="shrink-0 rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-[#f5dd8a]">
                    {t.shortcut}
                  </kbd>
                  <span className="leading-snug text-white/70">{t.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-white/35">Historique</p>
            <ul className="mt-2 space-y-1.5 text-[12px] text-white/65">
              <li>
                <kbd className="mr-1 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Ctrl</kbd>
                <span className="text-white/35"> / </span>
                <kbd className="mr-2 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Cmd</kbd>
                + <kbd className="mx-0.5 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Z</kbd>
                Annuler
              </li>
              <li>
                <kbd className="mr-1 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Ctrl</kbd>
                <span className="text-white/35"> / </span>
                <kbd className="mr-1 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Cmd</kbd>
                + <kbd className="mx-0.5 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Maj</kbd>
                + <kbd className="mx-0.5 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Z</kbd>
                Refaire (ou <kbd className="mx-0.5 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Ctrl</kbd>
                +<kbd className="mx-0.5 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Y</kbd> sous Windows)
              </li>
            </ul>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-white/35">Aligner (sélection requise)</p>
            <ul className="mt-2 space-y-1.5 text-[12px] text-white/65">
              <li>
                <kbd className="mr-1 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Ctrl</kbd>
                / <kbd className="mr-1 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Cmd</kbd>
                + <kbd className="mx-0.5 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Maj</kbd>
                + flèches : gauche / droite / haut / bas
              </li>
              <li className="text-white/50">
                + <kbd className="mx-0.5 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Alt</kbd>
                en même temps : aligner sur le canvas (plusieurs objets), comme Alt+clic sur la barre
              </li>
              <li>
                … + <kbd className="mx-0.5 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">[</kbd>
                {' / '}
                <kbd className="mx-0.5 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">]</kbd>
                (touches crochets) : centrer verticalement / horizontalement
              </li>
              <li>
                … + <kbd className="mx-0.5 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">G</kbd>
                : centrer le groupe (ou l'objet) sur le plan
              </li>
            </ul>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-white/35">Autres</p>
            <ul className="mt-2 space-y-1.5 text-[12px] text-white/65">
              <li>
                <kbd className="mr-2 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Échap</kbd>
                Annuler tracé région / crop en cours, quitter mode région ou recadrage
              </li>
              <li>
                <kbd className="mr-2 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Maj</kbd>
                + déplacer : axe verrouillé · + poignées transformer : proportions
              </li>
              <li>
                <kbd className="mr-2 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Alt</kbd>
                + clic aligner : forcer le canvas (plusieurs objets)
              </li>
              <li>
                <kbd className="mr-2 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Maj</kbd>
                / <kbd className="mx-0.5 rounded border border-white/12 bg-white/[0.05] px-1 font-mono text-[10px]">Alt</kbd>
                en fin de sélection région : union / soustraction
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      {layersOpen ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-end sm:justify-center" role="dialog" aria-label="Calques">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fermer"
            onClick={() => setLayersOpen(false)}
          />
          <div className="relative m-3 w-[min(100vw-1.5rem,380px)] max-h-[min(70vh,420px)] overflow-hidden rounded-xl border border-white/10 bg-[#0c0e16] p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-white/90">Calques de la scène</p>
              <button
                type="button"
                className="rounded-lg p-1 text-white/40 hover:bg-white/[0.08] hover:text-white"
                onClick={() => setLayersOpen(false)}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <DesignerLayersPanel
              objects={objects}
              selectedIds={selectedIds}
              onSelectOnly={(id) => selectOnly(id)}
              onToggleLock={(id) => toggleObjectLock(id)}
              onToggleVisibility={(id) => toggleObjectVisibility(id)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
