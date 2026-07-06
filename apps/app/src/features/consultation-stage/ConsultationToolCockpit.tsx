// ─────────────────────────────────────────────────────────────────────────────
// ConsultationToolCockpit — « cockpit d'outils » compact pour le TABLEAU de la
// salle de téléconsultation MEDOS (praticien).
//
// PROBLÈME (demande USER) : le rail d'outils complet (LiveWhiteboardToolsSidebar,
// ~960 lignes) affiche TOUT en permanence → vue surchargée + long scroll pour
// trouver un outil. On veut un fonctionnement « cockpit » : on ouvre une FAMILLE
// (Écrire, Formes, Math, Naviguer) et SEULS ces outils apparaissent en petit rail
// overlay dans un coin, sélectionnables au clic. Couleur + épaisseur toujours à
// portée.
//
// Purement client : lit/écrit `useLiveWhiteboardStore` (tool/color/size/surface),
// exactement comme le grand rail. Aucun état réseau. Ne rend rien en lecture seule.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import {
  Pencil, PenLine, Type, Eraser,
  Square, Circle, Minus, Spline,
  Hand, MousePointer2, BoxSelect, Crosshair,
  Compass, Ruler, Grid3x3,
} from 'lucide-react';
import { useLiveWhiteboardStore } from '@/components/liri/live-room/useLiveWhiteboardStore';

const GOLD = '#d4a36a';

type ToolDef = { id: string; label: string; Icon: any };
type Family = { key: string; label: string; Icon: any; tools: ToolDef[]; surface?: string };

// Familles = regroupement des outils EXISTANTS (mêmes ids que le grand rail →
// aucune perte de fonction). « Math » bascule aussi la surface Géoplan.
const FAMILIES: Family[] = [
  {
    key: 'write', label: 'Écrire', Icon: Pencil,
    tools: [
      { id: 'pencil', label: 'Crayon', Icon: Pencil },
      { id: 'poly', label: 'Stylo', Icon: PenLine },
      { id: 'text', label: 'Texte', Icon: Type },
      { id: 'eraser', label: 'Gomme', Icon: Eraser },
    ],
  },
  {
    key: 'shapes', label: 'Formes', Icon: Square,
    tools: [
      { id: 'rect', label: 'Rectangle', Icon: Square },
      { id: 'circle', label: 'Cercle', Icon: Circle },
      { id: 'line', label: 'Ligne', Icon: Minus },
      { id: 'curve', label: 'Courbe', Icon: Spline },
    ],
  },
  {
    key: 'math', label: 'Math', Icon: Compass, surface: 'geoplan',
    tools: [
      { id: 'line', label: 'Segment', Icon: Ruler },
      { id: 'circle', label: 'Cercle', Icon: Compass },
      { id: 'curve', label: 'Courbe', Icon: Spline },
    ],
  },
  {
    key: 'nav', label: 'Naviguer', Icon: Hand,
    tools: [
      { id: 'hand', label: 'Main', Icon: Hand },
      { id: 'select', label: 'Sélection', Icon: MousePointer2 },
      { id: 'marquee', label: 'Zone', Icon: BoxSelect },
      { id: 'laser', label: 'Laser', Icon: Crosshair },
    ],
  },
];

const SWATCHES = ['#ffffff', '#111111', '#d4a36a', '#e5484d', '#3b82f6', '#22c55e', '#eab308'];
const SIZES = [2, 4, 8, 14];

export default function ConsultationToolCockpit() {
  const tool = useLiveWhiteboardStore((s) => s.tool);
  const setTool = useLiveWhiteboardStore((s) => s.setTool);
  const color = useLiveWhiteboardStore((s) => s.color);
  const setColor = useLiveWhiteboardStore((s) => s.setColor);
  const size = useLiveWhiteboardStore((s) => s.size);
  const setSize = useLiveWhiteboardStore((s) => s.setSize);
  const setBoardSurface = useLiveWhiteboardStore((s) => s.setBoardSurface);

  // Famille ouverte (null = seule la barre de familles est visible).
  const [openFamily, setOpenFamily] = useState<string | null>('write');

  const family = FAMILIES.find((f) => f.key === openFamily) || null;

  const pickFamily = (f: Family) => {
    setOpenFamily((prev) => (prev === f.key ? null : f.key));
    if (f.surface) setBoardSurface(f.surface);
  };

  return (
    <div
      style={{
        position: 'absolute', left: 12, bottom: 12, zIndex: 30,
        display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start',
        pointerEvents: 'auto',
      }}
    >
      {/* Rail overlay de la famille ouverte (au-dessus de la barre de familles) */}
      {family ? (
        <div
          style={{
            display: 'flex', gap: 6, padding: 7, borderRadius: 14,
            background: 'rgba(24,20,16,0.92)', border: '1px solid rgba(212,163,106,0.28)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            animation: 'ctcIn 0.18s cubic-bezier(0.2,0.7,0.3,1)',
          }}
        >
          {family.tools.map((t) => {
            const active = tool === t.id;
            return (
              <button
                key={`${family.key}-${t.id}`}
                type="button"
                title={t.label}
                onClick={() => setTool(t.id)}
                style={{
                  width: 44, height: 44, borderRadius: 11, cursor: 'pointer',
                  display: 'grid', placeItems: 'center', gap: 2,
                  border: active ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.08)',
                  background: active ? 'rgba(212,163,106,0.16)' : 'rgba(255,255,255,0.03)',
                  color: active ? GOLD : 'rgba(255,255,255,0.82)',
                }}
              >
                <t.Icon size={17} aria-hidden="true" />
                <span style={{ fontSize: 8, fontWeight: 600, lineHeight: 1 }}>{t.label}</span>
              </button>
            );
          })}
          {/* Couleur + épaisseur — toujours à portée dans le rail actif */}
          <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 2px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {SWATCHES.map((c) => (
                <button
                  key={c} type="button" title={c} onClick={() => setColor(c)}
                  style={{
                    width: 15, height: 15, borderRadius: '50%', cursor: 'pointer', padding: 0,
                    background: c,
                    border: color === c ? `2px solid ${GOLD}` : '1px solid rgba(255,255,255,0.25)',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {SIZES.map((s) => (
                <button
                  key={s} type="button" title={`Épaisseur ${s}`} onClick={() => setSize(s)}
                  style={{
                    width: 22, height: 15, borderRadius: 6, cursor: 'pointer', display: 'grid', placeItems: 'center',
                    border: size === s ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.12)',
                    background: size === s ? 'rgba(212,163,106,0.16)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <span style={{ display: 'block', width: Math.min(16, s + 2), height: Math.max(2, s / 2), borderRadius: 99, background: color === '#ffffff' ? '#fff' : color }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Barre de familles (toujours visible) */}
      <div
        style={{
          display: 'flex', gap: 5, padding: 6, borderRadius: 14,
          background: 'rgba(24,20,16,0.92)', border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
        }}
      >
        {FAMILIES.map((f) => {
          const isOpen = openFamily === f.key;
          return (
            <button
              key={f.key}
              type="button"
              title={f.label}
              onClick={() => pickFamily(f)}
              style={{
                minWidth: 52, height: 40, borderRadius: 10, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 9px',
                border: isOpen ? `1px solid ${GOLD}` : '1px solid transparent',
                background: isOpen ? 'rgba(212,163,106,0.14)' : 'rgba(255,255,255,0.03)',
                color: isOpen ? GOLD : 'rgba(255,255,255,0.75)',
                fontSize: 11, fontWeight: 600,
              }}
            >
              <f.Icon size={15} aria-hidden="true" />
              {f.label}
            </button>
          );
        })}
      </div>

      <style>{`@keyframes ctcIn{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
