// ─────────────────────────────────────────────────────────────────────────────
// ConsultationToolCockpit — outils du TABLEAU de téléconsultation MEDOS, façon
// logiciel d'édition : BARRE D'EN-TÊTE + RAILS CONTEXTUELS + PALETTE « Plus ».
//
// ORGANISATION (demande USER, itérée) :
//   • BARRE EN HAUT épurée : outils LES PLUS UTILISÉS (Sélection · Crayon · Texte
//     · Gomme) + boutons de CATÉGORIES (Formes · Math · Graphiques · Image) +
//     Fond + couleur/épaisseur + Annuler/Refaire + Aperçu + « Plus ».
//   • Cliquer une catégorie → ses outils s'ouvrent dans un RAIL VERTICAL contextuel
//     à GAUCHE (s'adapte à la catégorie).
//   • « Plus » → PALETTE centrale (recherche + catégories) pour TOUS les autres
//     outils niche (transformations, LaTeX, arbre de proba…) : éphémère, on clique,
//     ça se ferme. Plus de « Avancé » qui redéversait le gros rail.
//
// Purement client : lit/écrit `useLiveWhiteboardStore`. Rien en lecture seule.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  MousePointer2, Pencil, Type, Eraser,
  Shapes, Square, Circle, Minus, MoveUpRight, Spline, Hexagon, Star, SquareDashed, TriangleRight,
  Ruler, Compass, Triangle, Grid3x3, Dot,
  BarChart3, PieChart, LineChart, ScatterChart, Table2, Sigma, Divide, Network,
  FlipHorizontal2, RotateCw, Scaling,
  Image as ImageIcon, LayoutTemplate, ChevronDown, X, Search,
  Undo2, Redo2, Trash2, Trash, Eye, LayoutGrid, PaintBucket, Zap, EyeOff, Sparkles,
} from 'lucide-react';
import { useLiveWhiteboardStore } from '@/components/liri/live-room/useLiveWhiteboardStore';

const GOLD = '#d4a36a';
const BAR_BG = 'rgba(24,20,16,0.96)';
const MENU_BG = 'rgba(24,20,16,0.98)';

type Tool = { id: string; label: string; Icon: any };
type Group = { key: string; label: string; Icon: any; tools: Tool[]; surface?: string };

const MOST_USED: Tool[] = [
  { id: 'select', label: 'Sélection', Icon: MousePointer2 },
  { id: 'pencil', label: 'Crayon', Icon: Pencil },
  { id: 'text', label: 'Texte', Icon: Type },
  { id: 'eraser', label: 'Gomme', Icon: Eraser },
];

// Catégories ouvertes dans le rail latéral contextuel.
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
      { id: 'frame', label: 'Cadre', Icon: SquareDashed },
    ],
  },
  {
    key: 'math', label: 'Math', Icon: Ruler, surface: 'geoplan',
    tools: [
      { id: 'compass', label: 'Compas', Icon: Compass },
      { id: 'protractor', label: 'Rapporteur', Icon: Triangle },
      { id: 'ruler', label: 'Règle', Icon: Ruler },
      { id: 'angle', label: 'Angle', Icon: Triangle },
      { id: 'right-angle', label: 'Angle droit', Icon: TriangleRight },
      { id: 'axes', label: 'Repère', Icon: Grid3x3 },
      { id: 'segment', label: 'Segment', Icon: Minus },
      { id: 'coord-point', label: 'Point', Icon: Dot },
    ],
  },
  {
    key: 'graphs', label: 'Graphiques', Icon: BarChart3, surface: 'geoplan',
    tools: [
      { id: 'function-plot', label: 'Courbe f(x)', Icon: LineChart },
      { id: 'histogram', label: 'Histogramme', Icon: BarChart3 },
      { id: 'pie-chart', label: 'Camembert', Icon: PieChart },
      { id: 'scatter-plot', label: 'Nuage', Icon: ScatterChart },
      { id: 'numberline', label: 'Droite num.', Icon: Ruler },
      { id: 'table', label: 'Tableau', Icon: Table2 },
      { id: 'sign-table', label: 'T. de signes', Icon: Table2 },
      { id: 'latex', label: 'LaTeX', Icon: Sigma },
      { id: 'fraction', label: 'Fraction', Icon: Divide },
      { id: 'prob-tree', label: 'Arbre proba', Icon: Network },
    ],
  },
  {
    key: 'image', label: 'Image', Icon: ImageIcon,
    tools: [
      { id: 'image-place', label: 'Placer image', Icon: ImageIcon },
      { id: 'template-place', label: 'Gabarit', Icon: LayoutTemplate },
    ],
  },
];

// Palette « Plus » : TOUS les outils, par catégorie + recherche.
const PALETTE: { label: string; tools: Tool[] }[] = [
  { label: 'Transformations', tools: [
    { id: 'symmetry', label: 'Symétrie', Icon: FlipHorizontal2 },
    { id: 'rotation', label: 'Rotation', Icon: RotateCw },
    { id: 'homothetie', label: 'Homothétie', Icon: Scaling },
  ] },
  { label: 'Naviguer', tools: [
    { id: 'marquee', label: 'Zone', Icon: SquareDashed },
    { id: 'laser', label: 'Laser', Icon: Dot },
    { id: 'measure', label: 'Mesurer', Icon: Ruler },
  ] },
  { label: 'Divers', tools: [
    { id: 'curtain', label: 'Rideau', Icon: EyeOff },
    { id: 'electric-component', label: 'Circuit élec.', Icon: Zap },
  ] },
];
const ALL_FLAT: Tool[] = [
  ...MOST_USED,
  ...GROUPS.flatMap((g) => g.tools),
  ...PALETTE.flatMap((c) => c.tools),
];

const SWATCHES = ['#ffffff', '#111111', '#d4a36a', '#e5484d', '#3b82f6', '#22c55e', '#eab308'];
const SIZES = [2, 4, 8, 14];
const SURFACES: { id: string; label: string }[] = [
  { id: 'dark', label: 'Sombre' },
  { id: 'chalkboard', label: 'Craie' },
  { id: 'geoplan', label: 'Géoplan' },
  { id: 'carreaux', label: 'Carreaux' },
];

export default function ConsultationToolCockpit({
  preview = false,
  onPreviewChange,
}: {
  preview?: boolean;
  onPreviewChange?: (v: boolean) => void;
} = {}) {
  const tool = useLiveWhiteboardStore((s) => s.tool);
  const setTool = useLiveWhiteboardStore((s) => s.setTool);
  const color = useLiveWhiteboardStore((s) => s.color);
  const setColor = useLiveWhiteboardStore((s) => s.setColor);
  const size = useLiveWhiteboardStore((s) => s.size);
  const setSize = useLiveWhiteboardStore((s) => s.setSize);
  const boardSurface = useLiveWhiteboardStore((s) => s.boardSurface);
  const setBoardSurface = useLiveWhiteboardStore((s) => s.setBoardSurface);
  const undoBoard = useLiveWhiteboardStore((s) => s.undoBoard);
  const redoBoard = useLiveWhiteboardStore((s) => s.redoBoard);
  const clearBoard = useLiveWhiteboardStore((s) => s.clearBoard);
  const boardSelection = useLiveWhiteboardStore((s) => s.boardSelection);
  const deleteBoardSelection = useLiveWhiteboardStore((s) => s.deleteBoardSelection);
  const updateStrokeProperties = useLiveWhiteboardStore((s) => s.updateStrokeProperties);
  const setPendingImage = useLiveWhiteboardStore((s) => s.setPendingImage);
  const neuroInkOpen = useLiveWhiteboardStore((s) => s.neuroInkOpen);
  const hasSelection = Array.isArray(boardSelection) && boardSelection.length > 0;
  const setNeuroInkOpen = useLiveWhiteboardStore((s) => s.setNeuroInkOpen);

  const [sideGroup, setSideGroup] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null); // 'color' | 'size' | 'fond'
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [q, setQ] = useState('');

  // « Placer image » : le compositeur attend un pendingImage {url,w,h}. On ouvre un
  // sélecteur de fichier, on lit l'image, on calcule un gabarit (aspect conservé),
  // puis on arme l'outil image-place → clic sur le tableau = pose. (Avant : sans effet.)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      if (!url) return;
      const img = new Image();
      img.onload = () => {
        const maxW = 420;
        const nw = img.naturalWidth || maxW;
        const nh = img.naturalHeight || Math.round(maxW * 0.66);
        const w = Math.min(maxW, nw);
        const h = Math.max(20, Math.round(w * (nh / nw)));
        setPendingImage?.({ url, w, h });
        setTool('image-place');
        setSideGroup(null);
        setPaletteOpen(false);
      };
      img.onerror = () => { setPendingImage?.({ url, w: 300, h: 200 }); setTool('image-place'); };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  if (preview) {
    return (
      <button
        type="button" onClick={() => onPreviewChange?.(false)} title="Quitter l'aperçu patient"
        style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 31,
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 999,
          border: `1px solid ${GOLD}`, background: BAR_BG, color: GOLD, fontSize: 12, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
        }}
      >
        <X size={15} aria-hidden="true" /> Aperçu patient · quitter
      </button>
    );
  }

  const pickTool = (id: string, surface?: string) => {
    // « Placer image » ouvre d'abord le sélecteur de fichier (l'outil s'arme ensuite).
    if (id === 'image-place') {
      fileInputRef.current?.click();
      setPaletteOpen(false);
      setSideGroup(null);
      return;
    }
    if (surface) setBoardSurface(surface);
    setTool(id);
    setPaletteOpen(false);
  };
  const toolBtn = (active: boolean) => ({
    width: 36, height: 36, borderRadius: 9, cursor: 'pointer', display: 'grid', placeItems: 'center',
    border: active ? `1px solid ${GOLD}` : '1px solid transparent',
    background: active ? 'rgba(212,163,106,0.16)' : 'rgba(255,255,255,0.04)',
    color: active ? GOLD : 'rgba(255,255,255,0.82)',
  } as const);
  const chip = (active: boolean) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 10px', borderRadius: 9,
    border: active ? `1px solid ${GOLD}` : '1px solid transparent',
    background: active ? 'rgba(212,163,106,0.14)' : 'rgba(255,255,255,0.04)',
    color: active ? GOLD : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  } as const);
  const divider = <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.09)' }} />;
  const propMenu = {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 32, display: 'flex', gap: 6, padding: 7,
    borderRadius: 12, background: MENU_BG, border: `1px solid rgba(212,163,106,0.30)`,
    boxShadow: '0 12px 36px rgba(0,0,0,0.5)', animation: 'ctcIn 0.15s cubic-bezier(0.2,0.7,0.3,1)',
  } as const;

  const activeGroup = GROUPS.find((g) => g.key === sideGroup) || null;
  const query = q.trim().toLowerCase();
  const results = useMemo(
    () => (query ? ALL_FLAT.filter((t) => t.label.toLowerCase().includes(query)) : null),
    [query],
  );

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFile} style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
      {(menu || paletteOpen) ? (
        <div onClick={() => { setMenu(null); setPaletteOpen(false); }} style={{ position: 'absolute', inset: 0, zIndex: 29 }} />
      ) : null}

      {/* ── BARRE D'EN-TÊTE ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, padding: '6px 8px',
        maxWidth: 'calc(100% - 88px)', borderRadius: 13, background: BAR_BG,
        border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 10px 30px rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
      }}>
        {MOST_USED.map((t) => (
          <button key={t.id} type="button" title={t.label} onClick={() => pickTool(t.id)} style={toolBtn(tool === t.id)}>
            <t.Icon size={17} aria-hidden="true" />
          </button>
        ))}
        {divider}
        {GROUPS.map((g) => {
          const open = sideGroup === g.key;
          const active = open || g.tools.some((x) => x.id === tool);
          return (
            <button key={g.key} type="button" title={`${g.label} — outils dans le rail latéral`}
              onClick={() => setSideGroup((k) => (k === g.key ? null : g.key))} style={chip(active)}>
              <g.Icon size={16} aria-hidden="true" /> {g.label}
              <ChevronDown size={13} aria-hidden="true" style={{ opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
          );
        })}
        {divider}
        {/* Fond (surface) */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button type="button" title="Fond du tableau" onClick={() => setMenu((m) => (m === 'fond' ? null : 'fond'))} style={chip(false)}>
            <PaintBucket size={15} aria-hidden="true" /> Fond <ChevronDown size={13} aria-hidden="true" style={{ opacity: 0.7 }} />
          </button>
          {menu === 'fond' ? (
            <div style={{ ...propMenu, flexDirection: 'column', minWidth: 120 }}>
              {SURFACES.map((s) => (
                <button key={s.id} type="button" onClick={() => { setBoardSurface(s.id); setMenu(null); }}
                  style={{ textAlign: 'left', padding: '7px 9px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                    border: boardSurface === s.id ? `1px solid ${GOLD}` : '1px solid transparent',
                    background: boardSurface === s.id ? 'rgba(212,163,106,0.16)' : 'transparent',
                    color: boardSurface === s.id ? GOLD : 'rgba(255,255,255,0.82)' }}>{s.label}</button>
              ))}
            </div>
          ) : null}
        </div>
        {/* Couleur */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button type="button" aria-label="Couleur" onClick={() => setMenu((m) => (m === 'color' ? null : 'color'))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 8px', borderRadius: 9, border: '1px solid transparent', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: color, border: '1px solid rgba(255,255,255,0.3)' }} />
            <ChevronDown size={14} aria-hidden="true" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
          {menu === 'color' ? (
            <div style={propMenu}>
              {SWATCHES.map((c) => (
                <button key={c} type="button" title={hasSelection ? `Recolorer la sélection en ${c}` : c}
                  onClick={() => { setColor(c); if (hasSelection) updateStrokeProperties?.({ color: c }); setMenu(null); }}
                  style={{ width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', padding: 0, background: c, border: color === c ? `2px solid ${GOLD}` : '1px solid rgba(255,255,255,0.25)' }} />
              ))}
            </div>
          ) : null}
        </div>
        {/* Épaisseur */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button type="button" aria-label="Épaisseur" onClick={() => setMenu((m) => (m === 'size' ? null : 'size'))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 8px', borderRadius: 9, border: '1px solid transparent', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}>
            <span style={{ width: 16, height: Math.max(2, size / 2), borderRadius: 9, background: 'rgba(255,255,255,0.85)' }} />
            <ChevronDown size={14} aria-hidden="true" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
          {menu === 'size' ? (
            <div style={{ ...propMenu, alignItems: 'center' }}>
              {SIZES.map((s) => (
                <button key={s} type="button" title={hasSelection ? `Épaisseur ${s} (sélection)` : `Épaisseur ${s}`}
                  onClick={() => { setSize(s); if (hasSelection) updateStrokeProperties?.({ lineWidth: s, size: s, fontSize: Math.max(12, s * 6) }); setMenu(null); }}
                  style={{ width: 34, height: 34, borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center', border: size === s ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.1)', background: size === s ? 'rgba(212,163,106,0.16)' : 'rgba(255,255,255,0.03)' }}>
                  <span style={{ width: 18, height: Math.max(2, s / 2), borderRadius: 9, background: '#fff' }} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {divider}
        {([
          { key: 'undo', title: 'Annuler', Icon: Undo2, run: () => undoBoard?.() },
          { key: 'redo', title: 'Refaire', Icon: Redo2, run: () => redoBoard?.() },
          { key: 'clear', title: 'Tout effacer', Icon: Trash2, run: () => clearBoard?.() },
        ] as const).map((a) => (
          <button key={a.key} type="button" title={a.title} onClick={a.run} style={toolBtn(false)}>
            <a.Icon size={16} aria-hidden="true" />
          </button>
        ))}
        {/* Supprimer UNIQUEMENT l'objet sélectionné (distinct de « Tout effacer ») —
            n'apparaît que si quelque chose est sélectionné. Alternative tactile à la
            touche Suppr (absente sur tablette). */}
        {Array.isArray(boardSelection) && boardSelection.length > 0 ? (
          <button
            type="button"
            title={`Supprimer la sélection (${boardSelection.length})`}
            onClick={() => deleteBoardSelection?.()}
            style={{ ...toolBtn(false), color: '#e5484d', border: '1px solid rgba(229,72,77,0.45)', background: 'rgba(229,72,77,0.12)' }}
          >
            <Trash size={16} aria-hidden="true" />
          </button>
        ) : null}
        {divider}
        <button type="button" title="NeuroInk — assistant IA du tableau (décrire, structurer, embellir)" onClick={() => setNeuroInkOpen?.(!neuroInkOpen)} style={chip(neuroInkOpen)}>
          <Sparkles size={15} aria-hidden="true" /> IA
        </button>
        <button type="button" title="Aperçu — voir le tableau comme le patient" onClick={() => onPreviewChange?.(true)} style={chip(false)}>
          <Eye size={15} aria-hidden="true" /> Aperçu
        </button>
        <button type="button" title="Plus d'outils — palette (recherche + catégories)" onClick={() => { setPaletteOpen(true); setQ(''); }} style={chip(paletteOpen)}>
          <LayoutGrid size={15} aria-hidden="true" /> Plus
        </button>
      </div>

      {/* ── RAIL LATÉRAL CONTEXTUEL (gauche) ─────────────────────────────── */}
      {activeGroup ? (
        <div style={{
          position: 'absolute', top: 58, left: 12, zIndex: 31, display: 'flex', flexDirection: 'column', gap: 4,
          padding: 8, borderRadius: 14, width: 78, maxHeight: 'calc(100% - 84px)', overflowY: 'auto',
          background: MENU_BG, border: `1px solid rgba(212,163,106,0.28)`, boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)', animation: 'ctcSideIn 0.18s cubic-bezier(0.2,0.7,0.3,1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1px 3px 3px' }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'rgba(212,163,106,0.9)' }}>{activeGroup.label}</span>
            <button type="button" aria-label="Fermer" onClick={() => setSideGroup(null)} style={{ width: 18, height: 18, borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <X size={13} aria-hidden="true" />
            </button>
          </div>
          {activeGroup.tools.map((t) => {
            const active = tool === t.id;
            return (
              <button key={t.id} type="button" title={t.label} onClick={() => pickTool(t.id, activeGroup.surface)}
                style={{ width: '100%', height: 52, borderRadius: 10, cursor: 'pointer', display: 'grid', placeItems: 'center', gap: 3,
                  border: active ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.08)',
                  background: active ? 'rgba(212,163,106,0.16)' : 'rgba(255,255,255,0.03)', color: active ? GOLD : 'rgba(255,255,255,0.85)' }}>
                <t.Icon size={18} aria-hidden="true" />
                <span style={{ fontSize: 8, fontWeight: 600, lineHeight: 1, textAlign: 'center' }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ── PALETTE « Plus » (centrale, recherche + catégories) ──────────── */}
      {paletteOpen ? (
        <div style={{
          position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 33, width: 'min(520px, calc(100% - 40px))',
          maxHeight: 'calc(100% - 120px)', overflowY: 'auto', padding: 12, borderRadius: 16,
          background: MENU_BG, border: `1px solid rgba(212,163,106,0.3)`, boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)', animation: 'ctcIn 0.16s cubic-bezier(0.2,0.7,0.3,1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: 10, top: 10, color: 'rgba(255,255,255,0.4)' }} />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un outil…"
                style={{ width: '100%', height: 34, padding: '0 10px 0 32px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="button" aria-label="Fermer" onClick={() => setPaletteOpen(false)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {results ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(76px,1fr))', gap: 6 }}>
              {results.length ? results.map((t) => <PalTool key={t.id} t={t} active={tool === t.id} onPick={pickTool} />) : (
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, gridColumn: '1 / -1', padding: 8 }}>Aucun outil pour « {q} ».</span>
              )}
            </div>
          ) : (
            <>
              {[{ label: 'Toutes catégories', tools: [] as Tool[] }].length ? null : null}
              {[...GROUPS.map((g) => ({ label: g.label, tools: g.tools })), ...PALETTE].map((cat) => (
                <div key={cat.label} style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'rgba(212,163,106,0.85)', margin: '4px 2px 6px' }}>{cat.label}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(76px,1fr))', gap: 6 }}>
                    {cat.tools.map((t) => <PalTool key={`${cat.label}-${t.id}`} t={t} active={tool === t.id} onPick={pickTool} />)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : null}

      <style>{`@keyframes ctcIn{from{opacity:0;transform:translate(-50%,-6px) scale(.98)}to{opacity:1;transform:translate(-50%,0) scale(1)}}@keyframes ctcSideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}`}</style>
    </>
  );
}

function PalTool({ t, active, onPick }: { t: Tool; active: boolean; onPick: (id: string) => void }) {
  return (
    <button type="button" title={t.label} onClick={() => onPick(t.id)}
      style={{ height: 60, borderRadius: 10, cursor: 'pointer', display: 'grid', placeItems: 'center', gap: 4, padding: 4,
        border: active ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.08)',
        background: active ? 'rgba(212,163,106,0.16)' : 'rgba(255,255,255,0.03)', color: active ? GOLD : 'rgba(255,255,255,0.85)' }}>
      <t.Icon size={18} aria-hidden="true" />
      <span style={{ fontSize: 8.5, fontWeight: 600, lineHeight: 1.1, textAlign: 'center' }}>{t.label}</span>
    </button>
  );
}
