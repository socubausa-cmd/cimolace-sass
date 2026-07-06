// ─────────────────────────────────────────────────────────────────────────────
// ConsultationToolCockpit — barre d'outils du TABLEAU de téléconsultation MEDOS,
// façon logiciel d'édition (Figma/Canva).
//
// ORGANISATION (demande USER) : une BARRE EN EN-TÊTE (haut du tableau), épurée :
//   • seuls les OUTILS LES PLUS UTILISÉS sont visibles en permanence
//     (Sélection · Crayon · Texte · Gomme) ;
//   • les GROUPES sont des « déployeurs » (menus) qui s'ouvrent au clic
//     (Formes · Math · Image) → on ne voit QUE ce dont on a besoin ;
//   • le bouton d'un groupe montre le DERNIER outil choisi de ce groupe → un clic
//     le re-sélectionne sans rouvrir le menu (le chevron rouvre le menu) ;
//   • à droite : couleur + épaisseur (déployeurs), Annuler/Refaire, Aperçu/Avancé.
//
// Purement client : lit/écrit `useLiveWhiteboardStore`. Rien en lecture seule.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import {
  MousePointer2, Pencil, Type, Eraser,
  Shapes, Square, Circle, Minus, MoveUpRight, Spline, Hexagon, Star,
  Ruler, Compass, Triangle, LineChart,
  Image as ImageIcon, ChevronDown,
  Undo2, Redo2, Trash2, Eye, X, SlidersHorizontal,
} from 'lucide-react';
import { useLiveWhiteboardStore } from '@/components/liri/live-room/useLiveWhiteboardStore';

const GOLD = '#d4a36a';

type Tool = { id: string; label: string; Icon: any };
type Group = { key: string; label: string; Icon: any; tools: Tool[]; surface?: string };

// Les 4 outils toujours visibles (les plus utilisés en consultation).
const MOST_USED: Tool[] = [
  { id: 'select', label: 'Sélection', Icon: MousePointer2 },
  { id: 'pencil', label: 'Crayon', Icon: Pencil },
  { id: 'text', label: 'Texte', Icon: Type },
  { id: 'eraser', label: 'Gomme', Icon: Eraser },
];

// Groupes « déployés » au clic (mêmes ids que le moteur → aucune perte).
const GROUPS: Group[] = [
  {
    key: 'formes', label: 'Formes', Icon: Shapes,
    tools: [
      { id: 'rect', label: 'Rectangle', Icon: Square },
      { id: 'circle', label: 'Cercle', Icon: Circle },
      { id: 'line', label: 'Ligne', Icon: Minus },
      { id: 'arrow', label: 'Flèche', Icon: MoveUpRight },
      { id: 'curve', label: 'Courbe', Icon: Spline },
      { id: 'polygon', label: 'Polygone', Icon: Hexagon },
      { id: 'star', label: 'Étoile', Icon: Star },
    ],
  },
  {
    key: 'math', label: 'Math', Icon: Ruler, surface: 'geoplan',
    tools: [
      { id: 'compass', label: 'Compas', Icon: Compass },
      { id: 'protractor', label: 'Rapporteur', Icon: Triangle },
      { id: 'ruler', label: 'Règle', Icon: Ruler },
      { id: 'angle', label: 'Angle', Icon: Triangle },
      { id: 'axes', label: 'Repère', Icon: LineChart },
      { id: 'function-plot', label: 'Courbe f(x)', Icon: LineChart },
    ],
  },
  {
    key: 'image', label: 'Image', Icon: ImageIcon,
    tools: [
      { id: 'image-place', label: 'Placer image', Icon: ImageIcon },
    ],
  },
];

const SWATCHES = ['#ffffff', '#111111', '#d4a36a', '#e5484d', '#3b82f6', '#22c55e', '#eab308'];
const SIZES = [2, 4, 8, 14];

const BAR_BG = 'rgba(24,20,16,0.96)';
const MENU_BG = 'rgba(24,20,16,0.98)';

export default function ConsultationToolCockpit({
  preview = false,
  onPreviewChange,
  advancedOpen = false,
  onAdvancedChange,
}: {
  preview?: boolean;
  onPreviewChange?: (v: boolean) => void;
  advancedOpen?: boolean;
  onAdvancedChange?: (v: boolean) => void;
} = {}) {
  const tool = useLiveWhiteboardStore((s) => s.tool);
  const setTool = useLiveWhiteboardStore((s) => s.setTool);
  const color = useLiveWhiteboardStore((s) => s.color);
  const setColor = useLiveWhiteboardStore((s) => s.setColor);
  const size = useLiveWhiteboardStore((s) => s.size);
  const setSize = useLiveWhiteboardStore((s) => s.setSize);
  const setBoardSurface = useLiveWhiteboardStore((s) => s.setBoardSurface);
  const undoBoard = useLiveWhiteboardStore((s) => s.undoBoard);
  const redoBoard = useLiveWhiteboardStore((s) => s.redoBoard);
  const clearBoard = useLiveWhiteboardStore((s) => s.clearBoard);

  // Menu ouvert (null | clé de groupe | 'color' | 'size'). Dernier outil choisi
  // par groupe (pour l'afficher sur le bouton du groupe).
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [groupLast, setGroupLast] = useState<Record<string, string>>({});

  // APERÇU (C) : barre repliée → pastille « quitter ».
  if (preview) {
    return (
      <button
        type="button"
        onClick={() => onPreviewChange?.(false)}
        title="Quitter l'aperçu patient"
        style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 31,
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px',
          borderRadius: 999, border: `1px solid ${GOLD}`, background: BAR_BG,
          color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 10px 30px rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
        }}
      >
        <X size={15} aria-hidden="true" /> Aperçu patient · quitter
      </button>
    );
  }

  const pickTool = (id: string, groupKey?: string, surface?: string) => {
    if (surface) setBoardSurface(surface);
    setTool(id);
    if (groupKey) setGroupLast((p) => ({ ...p, [groupKey]: id }));
    setOpenMenu(null);
  };
  const toggleMenu = (key: string) => setOpenMenu((m) => (m === key ? null : key));

  const toolBtn = (active: boolean) => ({
    width: 36, height: 36, borderRadius: 9, cursor: 'pointer',
    display: 'grid', placeItems: 'center',
    border: active ? `1px solid ${GOLD}` : '1px solid transparent',
    background: active ? 'rgba(212,163,106,0.16)' : 'rgba(255,255,255,0.04)',
    color: active ? GOLD : 'rgba(255,255,255,0.82)',
  } as const);
  const divider = <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.09)' }} />;
  const menuBox = {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 32,
    display: 'flex', gap: 4, padding: 7, borderRadius: 12,
    background: MENU_BG, border: `1px solid rgba(212,163,106,0.30)`,
    boxShadow: '0 12px 36px rgba(0,0,0,0.5)', animation: 'ctcIn 0.15s cubic-bezier(0.2,0.7,0.3,1)',
  } as const;

  return (
    <>
      {openMenu ? (
        <div onClick={() => setOpenMenu(null)} style={{ position: 'absolute', inset: 0, zIndex: 29 }} />
      ) : null}

      <div
        style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, padding: '6px 8px',
          maxWidth: 'calc(100% - 88px)', borderRadius: 13, background: BAR_BG,
          border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Outils les plus utilisés — toujours visibles */}
        {MOST_USED.map((t) => (
          <button key={t.id} type="button" title={t.label} onClick={() => pickTool(t.id)} style={toolBtn(tool === t.id)}>
            <t.Icon size={17} aria-hidden="true" />
          </button>
        ))}

        {divider}

        {/* Groupes = déployeurs. Le bouton montre le DERNIER outil choisi. */}
        {GROUPS.map((g) => {
          const lastId = groupLast[g.key];
          const lastTool = g.tools.find((x) => x.id === lastId);
          const Shown = lastTool?.Icon || g.Icon;
          const active = g.tools.some((x) => x.id === tool);
          return (
            <div key={g.key} style={{ position: 'relative', display: 'inline-flex' }}>
              <div
                style={{
                  display: 'inline-flex', alignItems: 'center', height: 36, borderRadius: 9, overflow: 'hidden',
                  border: active ? `1px solid ${GOLD}` : '1px solid transparent',
                  background: active ? 'rgba(212,163,106,0.14)' : 'rgba(255,255,255,0.04)',
                }}
              >
                <button
                  type="button"
                  title={lastTool ? `${g.label} · ${lastTool.label}` : `${g.label} — choisir un outil`}
                  onClick={() => (lastId ? pickTool(lastId, g.key, g.surface) : toggleMenu(g.key))}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 6px 0 9px', height: 36,
                    border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                    color: active ? GOLD : 'rgba(255,255,255,0.8)',
                  }}
                >
                  <Shown size={16} aria-hidden="true" /> {g.label}
                </button>
                <button
                  type="button" aria-label={`Ouvrir ${g.label}`} onClick={() => toggleMenu(g.key)}
                  style={{
                    display: 'grid', placeItems: 'center', width: 22, height: 36, border: 'none',
                    background: openMenu === g.key ? 'rgba(212,163,106,0.18)' : 'transparent', cursor: 'pointer',
                    color: active ? GOLD : 'rgba(255,255,255,0.6)',
                  }}
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
              </div>
              {openMenu === g.key ? (
                <div style={menuBox}>
                  {g.tools.map((t) => (
                    <button
                      key={t.id} type="button" title={t.label} onClick={() => pickTool(t.id, g.key, g.surface)}
                      style={{
                        width: 44, height: 44, borderRadius: 10, cursor: 'pointer', display: 'grid', placeItems: 'center', gap: 2,
                        border: tool === t.id ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.08)',
                        background: tool === t.id ? 'rgba(212,163,106,0.16)' : 'rgba(255,255,255,0.03)',
                        color: tool === t.id ? GOLD : 'rgba(255,255,255,0.85)',
                      }}
                    >
                      <t.Icon size={17} aria-hidden="true" />
                      <span style={{ fontSize: 7.5, fontWeight: 600, lineHeight: 1 }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {divider}

        {/* Couleur — déployeur */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            type="button" aria-label="Couleur" onClick={() => toggleMenu('color')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 8px', borderRadius: 9,
              border: '1px solid transparent', background: 'rgba(255,255,255,0.04)', cursor: 'pointer',
            }}
          >
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: color, border: '1px solid rgba(255,255,255,0.3)' }} />
            <ChevronDown size={14} aria-hidden="true" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
          {openMenu === 'color' ? (
            <div style={{ ...menuBox, gap: 6 }}>
              {SWATCHES.map((c) => (
                <button
                  key={c} type="button" title={c} onClick={() => { setColor(c); setOpenMenu(null); }}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', padding: 0, background: c,
                    border: color === c ? `2px solid ${GOLD}` : '1px solid rgba(255,255,255,0.25)',
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Épaisseur — déployeur */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            type="button" aria-label="Épaisseur" onClick={() => toggleMenu('size')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 8px', borderRadius: 9,
              border: '1px solid transparent', background: 'rgba(255,255,255,0.04)', cursor: 'pointer',
            }}
          >
            <span style={{ width: 16, height: Math.max(2, size / 2), borderRadius: 9, background: 'rgba(255,255,255,0.85)' }} />
            <ChevronDown size={14} aria-hidden="true" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
          {openMenu === 'size' ? (
            <div style={{ ...menuBox, alignItems: 'center' }}>
              {SIZES.map((s) => (
                <button
                  key={s} type="button" title={`Épaisseur ${s}`} onClick={() => { setSize(s); setOpenMenu(null); }}
                  style={{
                    width: 34, height: 34, borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center',
                    border: size === s ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.1)',
                    background: size === s ? 'rgba(212,163,106,0.16)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <span style={{ width: 18, height: Math.max(2, s / 2), borderRadius: 9, background: '#fff' }} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {divider}

        {/* Annuler / Refaire / Effacer */}
        {([
          { key: 'undo', title: 'Annuler', Icon: Undo2, run: () => undoBoard?.() },
          { key: 'redo', title: 'Refaire', Icon: Redo2, run: () => redoBoard?.() },
          { key: 'clear', title: 'Tout effacer', Icon: Trash2, run: () => clearBoard?.() },
        ] as const).map((a) => (
          <button key={a.key} type="button" title={a.title} onClick={a.run} style={toolBtn(false)}>
            <a.Icon size={16} aria-hidden="true" />
          </button>
        ))}

        {divider}

        {/* Aperçu (C) + Avancé (rail complet) */}
        <button
          type="button" title="Aperçu — voir le tableau comme le patient"
          onClick={() => onPreviewChange?.(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 10px', borderRadius: 9,
            border: '1px solid transparent', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.78)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Eye size={15} aria-hidden="true" /> Aperçu
        </button>
        <button
          type="button" title="Avancé — tous les outils (math avancé, NeuroInk IA, pages, groupes…)"
          onClick={() => onAdvancedChange?.(!advancedOpen)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 10px', borderRadius: 9,
            border: advancedOpen ? `1px solid ${GOLD}` : '1px solid transparent',
            background: advancedOpen ? 'rgba(212,163,106,0.14)' : 'rgba(255,255,255,0.04)',
            color: advancedOpen ? GOLD : 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <SlidersHorizontal size={15} aria-hidden="true" /> Avancé
        </button>
      </div>

      <style>{`@keyframes ctcIn{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:none}}`}</style>
    </>
  );
}
