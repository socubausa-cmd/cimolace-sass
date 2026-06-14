import React, { useState, useCallback } from 'react';
import { WHITEBOARD_TEMPLATES, TEMPLATE_CATEGORIES } from '@/lib/whiteboardTemplates';
import {
  ArrowRight, ArrowLeftRight, Triangle, Star, Pentagon, Layers,
  Ruler, Compass, Table2, Sigma, Calculator, FlaskConical, Atom,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
  Grid3x3, LayoutGrid, Pencil, Frame, Minus,
  BookOpen, Microscope, Zap, Pi, Axis3D, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  designerShellCardInset,
  designerShellMicroLabel,
  designerShellChipGhost,
} from '@/lib/liriDesignerShellClasses';
import { useLiveWhiteboardStore } from './useLiveWhiteboardStore';

/* ── constantes ─────────────────────────────────────────────────────────── */
const RAIL_TITLE = 'font-serif text-[13px] font-semibold text-white/92 tracking-tight uppercase tracking-wide text-white/70 text-[11px]';

const SUBJECT_TABS = [
  { id: 'compas', label: 'Compas', Icon: Compass },
  { id: 'geo', label: 'Géométrie', Icon: Triangle },
  { id: 'math', label: 'Mathématiques', Icon: Sigma },
  { id: 'sciences', label: 'Sciences', Icon: Atom },
  { id: 'enseignant', label: 'Enseignant', Icon: BookOpen },
  { id: 'arrange', label: 'Arrangement', Icon: Layers },
];

const POLYGON_SIDES_OPTIONS = [3, 4, 5, 6, 7, 8, 10, 12];
const STAR_POINTS_OPTIONS = [4, 5, 6, 7, 8];
const TABLE_COLS_OPTIONS = [2, 3, 4, 5, 6];
const TABLE_ROWS_OPTIONS = [2, 3, 4, 5, 6, 8, 10];

/* ── helpers UI ─────────────────────────────────────────────────────────── */
function ToolBtn({ id, label, Icon, active, onClick, title }) {
  return (
    <button
      type="button"
      title={title || label}
      onClick={onClick}
      className={cn(
        designerShellChipGhost,
        'flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 text-[9px] font-medium min-w-0',
        active && 'border-amber-500/50 bg-amber-500/14 text-amber-100',
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate w-full text-center leading-tight">{label}</span>
    </button>
  );
}

function SectionTitle({ children }) {
  return <p className={cn(designerShellMicroLabel, 'mt-2 mb-1 text-white/45')}>{children}</p>;
}

function NumPicker({ value, options, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            designerShellChipGhost,
            'min-w-[26px] py-0.5 text-[9px]',
            value === v && 'border-amber-500/50 bg-amber-500/14 text-amber-100',
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/* ── onglet Compas ────────────────────────────────────────────────────── */
const CONSTRUCTIONS = [
  {
    id: 'circle',
    label: 'Tracer un cercle',
    steps: [
      '① Cliquez sur la feuille pour poser la pointe sèche (centre).',
      '② Glissez pour écarter les branches du compas → rayon souhaité.',
      '③ Relâchez → le cercle complet est tracé.',
    ],
    color: '#60a5fa',
  },
  {
    id: 'mediatrice',
    label: 'Médiatrice d\'un segment',
    steps: [
      '① Posez le centre du compas sur A, glissez au-delà du mi-point → tracez un arc.',
      '② Même rayon : posez sur B, tracez un second arc qui coupe le premier (2 intersections).',
      '③ Tracez la droite passant par les 2 intersections → médiatrice.',
    ],
    color: '#34d399',
  },
  {
    id: 'triangle_equi',
    label: 'Triangle équilatéral',
    steps: [
      '① Tracez un segment AB avec la règle.',
      '② Compas ouvert à r = AB. Centre A → arc au-dessus.',
      '③ Même rayon. Centre B → arc qui coupe le premier en C.',
      '④ Tracez AC et BC → triangle équilatéral ABC.',
    ],
    color: '#f87171',
  },
  {
    id: 'bissectrice',
    label: 'Bissectrice d\'un angle',
    steps: [
      '① Posez le compas au sommet de l\'angle (O), tracez un arc coupant les 2 côtés en A et B.',
      '② Même ouverture : centre A → arc intérieur. Centre B → arc qui coupe en C.',
      '③ Tracez OC → la bissectrice.',
    ],
    color: '#c084fc',
  },
  {
    id: 'angles_adj',
    label: 'Angles complémentaires / supplémentaires',
    steps: [
        "① Outil Angle (∠) : tracez un premier angle → la valeur s'affiche en degrés.",
      '② Tracez un deuxième angle adjacent au premier.',
      '③ Vérifiez : si les 2 angles font 90° ensemble → complémentaires ; 180° → supplémentaires.',
      '④ Utilisez le rapporteur (onglet Mathématiques) pour vérifier visuellement.',
    ],
    color: '#fb923c',
  },
  {
    id: 'perpendiculaire',
    label: 'Perpendiculaire par un point',
    steps: [
      '① Compas centré sur le point P, tracez 2 arcs qui coupent la droite en A et B.',
      '② Centre A puis B (même rayon, > AP) → tracez des arcs qui se croisent en C.',
      '③ Tracez PC → perpendiculaire à la droite passant par P.',
    ],
    color: '#D4AF37',
  },
];

function CompassTab() {
  const tool = useLiveWhiteboardStore((s) => s.tool);
  const setTool = useLiveWhiteboardStore((s) => s.setTool);
  const cfg = useLiveWhiteboardStore((s) => s.schoolConfig);
  const setCfg = useLiveWhiteboardStore((s) => s.setSchoolConfig);
  const [activeGuide, setActiveGuide] = useState(null);

  return (
    <>
      <SectionTitle>Outil compas</SectionTitle>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => { setTool('compass'); setCfg({ arcMode: false }); }}
          className={cn(
            designerShellChipGhost,
            'flex flex-col items-center gap-1 py-2.5 text-[9px] font-semibold',
            tool === 'compass' && !cfg.arcMode && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
          )}
          title="Cliquez pour placer le pivot, glissez pour le rayon → cercle complet"
        >
          <Compass className="h-4 w-4" />
          Cercle complet
        </button>
        <button
          type="button"
          onClick={() => { setTool('compass'); setCfg({ arcMode: true }); }}
          className={cn(
            designerShellChipGhost,
            'flex flex-col items-center gap-1 py-2.5 text-[9px] font-semibold',
            tool === 'compass' && cfg.arcMode && 'border-violet-500/55 bg-violet-500/16 text-violet-100',
          )}
          title="1er clic = centre, glisser = rayon, 2e clic = début arc, glisser = fin arc"
        >
          <Compass className="h-4 w-4" />
          Arc (partiel)
        </button>
      </div>

      {tool === 'compass' && (
        <div className={cn(designerShellCardInset, 'mt-2 space-y-1 text-[9px] text-white/65 leading-relaxed')}>
          {!cfg.arcMode ? (
            <>
              <p className="text-amber-200/80 font-semibold">Mode cercle complet</p>
              <p>① <strong className="text-white/80">Cliquez</strong> pour poser le pivot (aiguille).</p>
              <p>② <strong className="text-white/80">Glissez</strong> pour régler le rayon — le compas s'ouvre en temps réel.</p>
              <p>③ <strong className="text-white/80">Relâchez</strong> → cercle tracé.</p>
              <p className="text-white/38 text-[8px] mt-1">Appuyez Échap pour annuler.</p>
            </>
          ) : (
            <>
              <p className="text-violet-300/80 font-semibold">Mode arc (pour constructions)</p>
              <p>① <strong className="text-white/80">Cliquez</strong> pour le pivot. Glissez = rayon. Relâchez.</p>
              <p>② <strong className="text-white/80">2e clic</strong> = point de départ de l'arc.</p>
              <p>③ <strong className="text-white/80">Glissez</strong> autour du centre → arc tracé.</p>
              <p>④ <strong className="text-white/80">Relâchez</strong> → arc validé.</p>
            </>
          )}
        </div>
      )}

      <SectionTitle>Constructions classiques</SectionTitle>
      <p className={cn(designerShellMicroLabel, 'text-white/30 mb-2')}>
        Sélectionnez une construction pour voir le guide pas à pas.
      </p>
      <div className="space-y-1">
        {CONSTRUCTIONS.map((c) => (
          <div key={c.id}>
            <button
              type="button"
              onClick={() => setActiveGuide(activeGuide === c.id ? null : c.id)}
              className={cn(
                'w-full text-left rounded-lg px-2.5 py-2 text-[10px] font-semibold border transition-colors flex items-center justify-between gap-2',
                activeGuide === c.id
                  ? 'border-white/18 bg-white/6 text-white/90'
                  : 'border-white/8 bg-white/3 text-white/55 hover:border-white/15 hover:text-white/80',
              )}
            >
              <span style={{ color: c.color }}>●</span>
              {c.label}
              <span className="text-white/30 text-[9px]">{activeGuide === c.id ? '▲' : '▼'}</span>
            </button>
            {activeGuide === c.id && (
              <div
                className="mt-0.5 rounded-b-lg border-l-2 px-3 py-2 space-y-1.5"
                style={{ borderColor: c.color, background: `${c.color}0d` }}
              >
                {c.steps.map((step, i) => (
                  <p key={i} className="text-[9.5px] text-white/70 leading-relaxed">{step}</p>
                ))}
                <button
                  type="button"
                  onClick={() => { setTool('compass'); setCfg({ arcMode: c.id !== 'circle' }); }}
                  className="mt-1 w-full rounded-lg border py-1.5 text-[9px] font-bold transition-colors"
                  style={{ borderColor: `${c.color}55`, color: c.color, background: `${c.color}12` }}
                >
                  Activer le compas pour cette construction
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <SectionTitle>Angles</SectionTitle>
      <div className="grid grid-cols-2 gap-1 mb-1">
        <button
          type="button"
          onClick={() => setTool('angle')}
          className={cn(
            designerShellChipGhost,
            'flex flex-col items-center gap-1 py-2 text-[9px] font-semibold',
            tool === 'angle' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
          )}
          title="3 clics : sommet → point sur 1er côté → point sur 2e côté"
        >
          <span className="text-[16px] leading-none">∠</span>
          Angle
        </button>
        <button
          type="button"
          onClick={() => setTool('right-angle')}
          className={cn(
            designerShellChipGhost,
            'flex flex-col items-center gap-1 py-2 text-[9px] font-semibold',
            tool === 'right-angle' && 'border-emerald-500/55 bg-emerald-500/16 text-emerald-100',
          )}
          title="2 clics : sommet → direction du 1er côté (90° automatique)"
        >
          <span className="text-[16px] leading-none">⊾</span>
          Angle droit
        </button>
      </div>
      {(tool === 'angle' || tool === 'right-angle') && (
        <div className={cn(designerShellCardInset, 'space-y-1 text-[9px] text-white/65 leading-relaxed')}>
          {tool === 'angle' ? (
            <>
              <p className="text-amber-200/80 font-semibold">Tracer un angle</p>
              <p>① <strong className="text-white/80">Clic 1</strong> — sommet de l'angle (le point S).</p>
              <p>② <strong className="text-white/80">Clic 2</strong> — un point sur le 1er côté.</p>
              <p>③ <strong className="text-white/80">Clic 3</strong> — un point sur le 2e côté → angle tracé avec sa mesure en degrés.</p>
            </>
          ) : (
            <>
              <p className="text-emerald-300/80 font-semibold">Angle droit (90°)</p>
              <p>① <strong className="text-white/80">Clic 1</strong> — sommet de l'angle droit.</p>
              <p>② <strong className="text-white/80">Clic 2</strong> — direction du 1er côté (l'autre côté est automatiquement perpendiculaire).</p>
              <p className="text-white/38 text-[8px]">Le petit carré ⊾ est dessiné au sommet.</p>
            </>
          )}
          <p className="text-white/35 text-[8px] pt-0.5">Double-clic ou Échap pour annuler.</p>
        </div>
      )}

      <div className={cn(designerShellCardInset, 'mt-3 text-[9px] text-white/38 leading-relaxed')}>
        <Ruler className="inline h-3 w-3 mr-1 opacity-60" />
        Combinez compas + <strong className="text-white/55">Règle</strong> (onglet Mathématiques) + <strong className="text-white/55">Outil Ligne</strong> pour toutes les constructions géométriques.
      </div>
    </>
  );
}

/* ── onglet Géométrie ──────────────────────────────────────────────────── */
function GeoTab() {
  const tool = useLiveWhiteboardStore((s) => s.tool);
  const setTool = useLiveWhiteboardStore((s) => s.setTool);
  const cfg = useLiveWhiteboardStore((s) => s.schoolConfig);
  const setCfg = useLiveWhiteboardStore((s) => s.setSchoolConfig);
  const shapeFill = useLiveWhiteboardStore((s) => s.shapeFill);
  const setShapeFill = useLiveWhiteboardStore((s) => s.setShapeFill);

  return (
    <>
      <SectionTitle>Droite / Segment / Demi-droite</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('segment')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'segment' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Glissez pour tracer un segment nommé [AB]"
      >
        <Minus className="h-3.5 w-3.5 shrink-0" />
        Segment / Droite [AB]
      </button>
      {tool === 'segment' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <div className="flex gap-2">
            <label className="flex flex-col gap-0.5 flex-1">
              <span className={designerShellMicroLabel}>Point A</span>
              <input type="text" maxLength={3} value={cfg.segmentLabelA ?? 'A'}
                onChange={(e) => setCfg({ segmentLabelA: e.target.value })}
                className="w-full rounded px-2 py-1 text-[11px] bg-white/6 border border-white/12 text-white font-bold" />
            </label>
            <label className="flex flex-col gap-0.5 flex-1">
              <span className={designerShellMicroLabel}>Point B</span>
              <input type="text" maxLength={3} value={cfg.segmentLabelB ?? 'B'}
                onChange={(e) => setCfg({ segmentLabelB: e.target.value })}
                className="w-full rounded px-2 py-1 text-[11px] bg-white/6 border border-white/12 text-white font-bold" />
            </label>
          </div>
          <p className={designerShellMicroLabel}>Style</p>
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'segment', label: '[AB]' },
              { id: 'line', label: '(AB)' },
              { id: 'ray', label: '[AB)' },
              { id: 'dashed', label: '-- --' },
            ].map(({ id, label }) => (
              <button key={id} type="button" onClick={() => setCfg({ segmentStyle: id })}
                className={cn(designerShellChipGhost, 'flex-1 py-1 text-[9px] font-mono',
                  (cfg.segmentStyle || 'segment') === id && 'border-amber-500/45 bg-amber-500/14 text-amber-100')}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-1.5 cursor-pointer text-[9px] text-white/60">
              <input type="checkbox" checked={cfg.segmentShowLength || false}
                onChange={(e) => setCfg({ segmentShowLength: e.target.checked })}
                className="accent-amber-500/80" />
              Afficher la longueur
            </label>
          </div>
          <p className={designerShellMicroLabel}>Coches de codage (0–3)</p>
          <NumPicker value={cfg.segmentTickCount ?? 0} options={[0, 1, 2, 3]}
            onChange={(v) => setCfg({ segmentTickCount: v })} />
        </div>
      )}

      <SectionTitle>Symétrie axiale</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('symmetry')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'symmetry' && 'border-violet-500/55 bg-violet-500/16 text-violet-100',
        )}
        title="Sélectionnez d'abord des objets, puis glissez pour définir l'axe"
      >
        <span className="text-[14px] leading-none">⇌</span>
        Symétrie axiale
      </button>
      {tool === 'symmetry' && (
        <div className={cn(designerShellCardInset, 'space-y-1 text-[9px] text-white/65 leading-relaxed')}>
          <p className="text-violet-300/80 font-semibold">Réflexion axiale</p>
          <p>① <strong className="text-white/80">Sélectionnez</strong> les objets à réfléchir (outil Sélection).</p>
          <p>② Activez <strong className="text-white/80">Symétrie</strong>, puis <strong className="text-white/80">glissez</strong> pour tracer l'axe.</p>
          <p>③ En relâchant, les copies symétriques apparaissent + axe en tirets.</p>
          <p className="text-white/35 text-[8px]">Aucune sélection = aucun effet. Échap pour annuler.</p>
        </div>
      )}

      <SectionTitle>Mesure de distance</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('measure')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'measure' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="2 clics → affiche la distance AB"
      >
        <Ruler className="h-3.5 w-3.5 shrink-0" />
        Mesure distance AB
      </button>
      {tool === 'measure' && (
        <div className={cn(designerShellCardInset, 'space-y-1 text-[9px] text-white/65 leading-relaxed')}>
          <p className="text-amber-200/80 font-semibold">Ligne de cote</p>
          <p>① <strong className="text-white/80">Clic 1</strong> — point A.</p>
          <p>② <strong className="text-white/80">Clic 2</strong> — point B → la distance est affichée.</p>
          <label className="flex flex-col gap-0.5 mt-1">
            <span className={designerShellMicroLabel}>Étiquette personnalisée (optionnel)</span>
            <input type="text" value={cfg.measureLabel || ''}
              onChange={(e) => setCfg({ measureLabel: e.target.value })}
              placeholder="ex: AB = 5 cm"
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white" />
          </label>
        </div>
      )}

      <SectionTitle>Traits</SectionTitle>
      <div className="grid grid-cols-3 gap-1">
        <ToolBtn id="poly" label="Stylo libre" Icon={Pencil} active={tool === 'poly'} onClick={() => setTool('poly')} title="Stylo illimité — clic par clic ; double-clic pour valider" />
        <ToolBtn id="arrow" label="Flèche →" Icon={ArrowRight} active={tool === 'arrow'} onClick={() => setTool('arrow')} title="Flèche simple" />
        <ToolBtn id="arrow2" label="↔ Double" Icon={ArrowLeftRight} active={tool === 'arrow' && cfg.arrowDouble} onClick={() => { setTool('arrow'); setCfg({ arrowDouble: !cfg.arrowDouble }); }} title="Flèche double" />
      </div>

      <SectionTitle>Formes planes</SectionTitle>
      <div className="grid grid-cols-3 gap-1">
        <ToolBtn id="triangle" label="Triangle ▲" Icon={Triangle} active={tool === 'triangle'} onClick={() => setTool('triangle')} title="Triangle isocèle — glissez" />
        <ToolBtn id="tri-free" label="Triangle ABC" Icon={Triangle} active={tool === 'tri-free'} onClick={() => setTool('tri-free')} title="Triangle quelconque — 3 clics libres" />
        <ToolBtn id="polygon" label={`Polygone (${cfg.polygonSides})`} Icon={Pentagon} active={tool === 'polygon'} onClick={() => setTool('polygon')} />
        <ToolBtn id="star" label={`Étoile (${cfg.starPoints})`} Icon={Star} active={tool === 'star'} onClick={() => setTool('star')} />
      </div>
      {tool === 'tri-free' && (
        <div className={cn(designerShellCardInset, 'space-y-1 text-[9px] text-white/65 leading-relaxed')}>
          <p className="text-amber-200/80 font-semibold">Triangle quelconque (3 clics)</p>
          <p>① <strong className="text-white/80">Clic 1</strong> — sommet A.</p>
          <p>② <strong className="text-white/80">Clic 2</strong> — sommet B.</p>
          <p>③ <strong className="text-white/80">Clic 3</strong> — sommet C → triangle tracé.</p>
        </div>
      )}
      <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
        {tool === 'polygon' && (
          <>
            <p className={designerShellMicroLabel}>Côtés du polygone</p>
            <NumPicker value={cfg.polygonSides} options={POLYGON_SIDES_OPTIONS} onChange={(v) => setCfg({ polygonSides: v })} />
          </>
        )}
        {tool === 'star' && (
          <>
            <p className={designerShellMicroLabel}>Branches de l'étoile</p>
            <NumPicker value={cfg.starPoints} options={STAR_POINTS_OPTIONS} onChange={(v) => setCfg({ starPoints: v })} />
          </>
        )}
      </div>

      <SectionTitle>Angles</SectionTitle>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setTool('angle')}
          title="Angle — 3 clics"
          className={cn(designerShellChipGhost, 'flex flex-col items-center gap-0.5 py-1.5 text-[9px] font-semibold', tool === 'angle' && 'border-amber-500/50 bg-amber-500/14 text-amber-100')}
        >
          <span className="text-[14px] leading-none">∠</span>Angle
        </button>
        <button
          type="button"
          onClick={() => setTool('right-angle')}
          title="Angle droit 90° — 2 clics"
          className={cn(designerShellChipGhost, 'flex flex-col items-center gap-0.5 py-1.5 text-[9px] font-semibold', tool === 'right-angle' && 'border-emerald-500/50 bg-emerald-500/14 text-emerald-100')}
        >
          <span className="text-[14px] leading-none">⊾</span>Angle droit
        </button>
      </div>

      <SectionTitle>Transformations</SectionTitle>
      <p className={cn(designerShellMicroLabel, 'mb-1 text-white/30')}>
        Sélectionnez d'abord les objets, puis glissez pour appliquer.
      </p>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setTool('rotation')}
          className={cn(
            designerShellChipGhost,
            'flex flex-col items-center gap-1 py-2 text-[9px] font-semibold',
            tool === 'rotation' && 'border-violet-500/55 bg-violet-500/16 text-violet-100',
          )}
          title="Rotation autour d'un point — sélectionnez des objets, cliquez le centre, glissez l'angle"
        >
          <span className="text-[16px] leading-none">↻</span>
          Rotation
        </button>
        <button
          type="button"
          onClick={() => setTool('translation')}
          className={cn(
            designerShellChipGhost,
            'flex flex-col items-center gap-1 py-2 text-[9px] font-semibold',
            tool === 'translation' && 'border-emerald-500/55 bg-emerald-500/16 text-emerald-100',
          )}
          title="Translation selon un vecteur — sélectionnez des objets, glissez le vecteur"
        >
          <span className="text-[16px] leading-none">→</span>
          Translation
        </button>
        <button
          type="button"
          onClick={() => setTool('homothetie')}
          className={cn(
            designerShellChipGhost,
            'flex flex-col items-center gap-1 py-2 text-[9px] font-semibold col-span-2',
            tool === 'homothetie' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
          )}
          title="Homothétie — sélectionnez des objets, cliquez le centre, ratio k configuré ci-dessous"
        >
          <span className="text-[16px] leading-none">⊗</span>
          Homothétie (ratio k)
        </button>
      </div>
      {tool === 'homothetie' && (
        <div className={cn(designerShellCardInset, 'space-y-1.5')}>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Rapport k</span>
            <input type="number" value={cfg.homothetieRatio ?? 2} step={0.1}
              onChange={(e) => setCfg({ homothetieRatio: parseFloat(e.target.value) || 2 })}
              className="w-full rounded px-2 py-1 text-[11px] bg-white/6 border border-white/12 text-white font-mono" />
          </label>
          <div className="flex flex-wrap gap-1">
            {[0.25, 0.5, 2, 3, -1].map((k) => (
              <button key={k} type="button" onClick={() => setCfg({ homothetieRatio: k })}
                className={cn(designerShellChipGhost, 'px-2 py-0.5 text-[9px]',
                  cfg.homothetieRatio === k && 'border-amber-500/45 bg-amber-500/14 text-amber-100')}>
                k={k}
              </button>
            ))}
          </div>
          <p className="text-[8px] text-white/35 leading-relaxed">
            ① Sélectionnez les objets. ② Cliquez le centre → appliqué immédiatement.
            k{'>'}1 agrandit · k{'<'}1 réduit · k{`<`}0 retourne.
          </p>
        </div>
      )}
      {(tool === 'rotation') && (
        <div className={cn(designerShellCardInset, 'space-y-1 text-[9px] text-white/65 leading-relaxed')}>
          <p className="text-violet-300/80 font-semibold">Rotation</p>
          <p>① <strong className="text-white/80">Sélectionnez</strong> les objets (outil Sélection).</p>
          <p>② Activez Rotation, <strong className="text-white/80">cliquez</strong> le centre.</p>
          <p>③ <strong className="text-white/80">Glissez</strong> pour définir l'angle → les copies pivotent.</p>
          <p className="text-white/35 text-[8px]">Angle affiché en degrés pendant le tracé.</p>
        </div>
      )}
      {(tool === 'translation') && (
        <div className={cn(designerShellCardInset, 'space-y-1 text-[9px] text-white/65 leading-relaxed')}>
          <p className="text-emerald-300/80 font-semibold">Translation de vecteur ⃗u</p>
          <p>① <strong className="text-white/80">Sélectionnez</strong> les objets.</p>
          <p>② Glissez de A vers B → le vecteur (dx ; dy) est affiché.</p>
          <p>③ En relâchant, les objets se déplacent selon ⃗u.</p>
        </div>
      )}

      <SectionTitle>Vecteur</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('vector')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'vector' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Glissez pour tracer un vecteur nommé (notation ⃗F)"
      >
        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
        Vecteur ⃗ nommé
      </button>
      {tool === 'vector' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <p className={designerShellMicroLabel}>Nom du vecteur</p>
          <input
            type="text"
            maxLength={4}
            value={cfg.vectorLabel ?? 'F'}
            onChange={(e) => setCfg({ vectorLabel: e.target.value })}
            className="w-full rounded px-2 py-1 text-[11px] bg-white/6 border border-white/12 text-white font-bold italic"
            placeholder="F, v, a, u..."
          />
          <p className="text-[8px] text-white/38">Glissez queue → pointe. La lettre apparaît avec ⃗ au-dessus.</p>
        </div>
      )}

      <SectionTitle>Conteneur</SectionTitle>
      <div className="grid grid-cols-2 gap-1">
        <ToolBtn id="frame" label="Cadre" Icon={Frame} active={tool === 'frame'} onClick={() => setTool('frame')} title="Cadre / conteneur visuel (glissez pour créer)" />
      </div>

      <SectionTitle>Options</SectionTitle>
      <button
        type="button"
        onClick={() => setShapeFill(!shapeFill)}
        className={cn(
          designerShellChipGhost,
          'w-full py-1.5 text-[9px]',
          shapeFill && 'border-violet-500/40 bg-violet-500/14 text-violet-100',
        )}
      >
        {shapeFill ? '⬛ Remplissage activé' : '⬜ Remplissage désactivé'}
      </button>
    </>
  );
}

/* ── onglet Mathématiques ──────────────────────────────────────────────── */
function MathTab({ onLatexRequest }) {
  const tool = useLiveWhiteboardStore((s) => s.tool);
  const setTool = useLiveWhiteboardStore((s) => s.setTool);
  const cfg = useLiveWhiteboardStore((s) => s.schoolConfig);
  const setCfg = useLiveWhiteboardStore((s) => s.setSchoolConfig);

  return (
    <>
      <SectionTitle>Repères</SectionTitle>
      <div className="grid grid-cols-2 gap-1">
        <ToolBtn id="axes" label="Repère (x,y)" Icon={Axis3D} active={tool === 'axes'} onClick={() => setTool('axes')} title="Repère orthogonal — glissez pour définir la taille" />
        <ToolBtn id="numberline" label="Droite graduée" Icon={Minus} active={tool === 'numberline'} onClick={() => setTool('numberline')} title="Droite graduée — glissez" />
      </div>

      {tool === 'numberline' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <p className={designerShellMicroLabel}>Plage (min → max)</p>
          <div className="flex gap-1 items-center">
            <input
              type="number"
              value={cfg.numberlineMin}
              onChange={(e) => setCfg({ numberlineMin: Number(e.target.value) })}
              className="w-14 rounded px-1.5 py-0.5 text-[10px] bg-white/6 border border-white/12 text-white"
              step={1}
            />
            <span className="text-white/40 text-[10px]">→</span>
            <input
              type="number"
              value={cfg.numberlineMax}
              onChange={(e) => setCfg({ numberlineMax: Number(e.target.value) })}
              className="w-14 rounded px-1.5 py-0.5 text-[10px] bg-white/6 border border-white/12 text-white"
              step={1}
            />
            <span className="text-white/40 text-[10px]">pas</span>
            <input
              type="number"
              value={cfg.numberlineStep}
              onChange={(e) => setCfg({ numberlineStep: Number(e.target.value) || 1 })}
              className="w-12 rounded px-1.5 py-0.5 text-[10px] bg-white/6 border border-white/12 text-white"
              step={0.1}
              min={0.01}
            />
          </div>
        </div>
      )}

      <SectionTitle>Points sur un repère</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('coord-point')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'coord-point' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Cliquez sur le tableau pour placer un point A(x;y) — se cale automatiquement sur un repère proche"
      >
        <span className="text-[15px] leading-none">·</span>
        Point A(x ; y)
      </button>
      {tool === 'coord-point' && (
        <div className={cn(designerShellCardInset, 'space-y-0.5 text-[9px] text-white/60 leading-relaxed')}>
          <p className="text-amber-200/80 font-semibold">Placer un point sur le repère</p>
          <p>① Tracez d'abord un <strong className="text-white/75">Repère (x,y)</strong> ci-dessus.</p>
          <p>② Cliquez sur le tableau → le point A(x;y) est placé avec ses coordonnées calculées automatiquement.</p>
          <p>③ Les pointillés relient le point aux axes.</p>
          <p className="text-white/35 text-[8px]">Lettres A, B, C… auto-incrémentées.</p>
        </div>
      )}

      <SectionTitle>Mesures</SectionTitle>
      <div className="grid grid-cols-2 gap-1">
        <ToolBtn id="ruler" label="Règle" Icon={Ruler} active={tool === 'ruler'} onClick={() => setTool('ruler')} title="Règle graduée — glissez pour orienter" />
        <ToolBtn id="protractor" label="Rapporteur" Icon={Compass} active={tool === 'protractor'} onClick={() => setTool('protractor')} title="Rapporteur — glissez pour définir le rayon" />
      </div>

      <SectionTitle>Tableau / Grille</SectionTitle>
      <div className="grid grid-cols-1 gap-1 mb-1">
        <ToolBtn id="table" label="Tableau / grille" Icon={Grid3x3} active={tool === 'table'} onClick={() => setTool('table')} />
      </div>
      {tool === 'table' && (
        <div className={cn(designerShellCardInset, 'space-y-1.5')}>
          <p className={designerShellMicroLabel}>Colonnes</p>
          <NumPicker value={cfg.tableCols} options={TABLE_COLS_OPTIONS} onChange={(v) => setCfg({ tableCols: v })} />
          <p className={designerShellMicroLabel}>Lignes</p>
          <NumPicker value={cfg.tableRows} options={TABLE_ROWS_OPTIONS} onChange={(v) => setCfg({ tableRows: v })} />
        </div>
      )}

      <SectionTitle>Courbe f(x)</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('function-plot')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'function-plot' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Glissez pour définir l'échelle, place la courbe y = f(x)"
      >
        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
        Courbe y = f(x)
      </button>
      {tool === 'function-plot' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <p className={designerShellMicroLabel}>Expression (x variable)</p>
          <input
            type="text"
            value={cfg.fnExpr ?? 'x'}
            onChange={(e) => setCfg({ fnExpr: e.target.value })}
            className="w-full rounded px-2 py-1 text-[11px] bg-white/6 border border-white/12 text-white font-mono"
            placeholder="sin(x), x^2, 2*x+1..."
            spellCheck={false}
          />
          <p className={designerShellMicroLabel}>Plage x</p>
          <div className="flex gap-1 items-center">
            <input
              type="number"
              value={cfg.fnXMin ?? -5}
              onChange={(e) => setCfg({ fnXMin: Number(e.target.value) })}
              className="w-16 rounded px-1.5 py-0.5 text-[10px] bg-white/6 border border-white/12 text-white"
              step={1}
            />
            <span className="text-white/40 text-[10px]">→</span>
            <input
              type="number"
              value={cfg.fnXMax ?? 5}
              onChange={(e) => setCfg({ fnXMax: Number(e.target.value) })}
              className="w-16 rounded px-1.5 py-0.5 text-[10px] bg-white/6 border border-white/12 text-white"
              step={1}
            />
          </div>
          <p className="text-[8px] text-white/38 leading-relaxed">
            Glissez sur le tableau. La distance = l'échelle (px/unité). Fonctions : sin, cos, tan, sqrt, abs, log, exp, PI…
          </p>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {[
              { label: 'Droite', f: '2*x + 1' },
              { label: 'Parabole', f: 'x^2' },
              { label: 'Cubique', f: 'x^3' },
              { label: 'Sinus', f: 'sin(x)' },
              { label: 'Cosinus', f: 'cos(x)' },
              { label: 'Racine', f: 'sqrt(abs(x))' },
              { label: '1/x', f: '1/x' },
              { label: 'Exponentielle', f: 'exp(x/2)' },
            ].map(({ label, f }) => (
              <button
                key={label}
                type="button"
                onClick={() => setCfg({ fnExpr: f })}
                className={cn(
                  designerShellChipGhost,
                  'text-[8px] px-1.5 py-0.5',
                  cfg.fnExpr === f && 'border-amber-500/45 bg-amber-500/14 text-amber-100',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <SectionTitle>Fraction visuelle</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('fraction')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'fraction' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Cliquez pour placer une fraction visuelle"
      >
        <span className="font-serif text-[15px] leading-none">½</span>
        Fraction a/b
      </button>
      {tool === 'fraction' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <div className="flex gap-2 items-end">
            <label className="flex flex-col gap-0.5 flex-1">
              <span className={designerShellMicroLabel}>Numérateur</span>
              <input
                type="number"
                min={0}
                max={cfg.fracDenominator ?? 4}
                value={cfg.fracNumerator ?? 1}
                onChange={(e) => setCfg({ fracNumerator: Math.max(0, Math.min(Number(e.target.value), cfg.fracDenominator ?? 4)) })}
                className="w-full rounded px-2 py-1 text-[11px] bg-white/6 border border-white/12 text-white"
              />
            </label>
            <span className="text-white/50 text-lg pb-1">/</span>
            <label className="flex flex-col gap-0.5 flex-1">
              <span className={designerShellMicroLabel}>Dénominateur</span>
              <input
                type="number"
                min={1}
                max={20}
                value={cfg.fracDenominator ?? 4}
                onChange={(e) => setCfg({ fracDenominator: Math.max(1, Number(e.target.value)) })}
                className="w-full rounded px-2 py-1 text-[11px] bg-white/6 border border-white/12 text-white"
              />
            </label>
          </div>
          <p className={designerShellMicroLabel}>Style</p>
          <div className="flex gap-1">
            {[{ id: 'bar', label: 'Barre' }, { id: 'pie', label: 'Camembert' }].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCfg({ fracStyle: id })}
                className={cn(
                  designerShellChipGhost,
                  'flex-1 py-1 text-[9px]',
                  (cfg.fracStyle || 'bar') === id && 'border-amber-500/45 bg-amber-500/14 text-amber-100',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className={designerShellMicroLabel}>Taille (px/cellule)</p>
          <NumPicker
            value={cfg.fracCellSize ?? 32}
            options={[20, 24, 28, 32, 40, 48]}
            onChange={(v) => setCfg({ fracCellSize: v })}
          />
          <p className="text-[8px] text-white/38">Cliquez sur le tableau pour placer.</p>
        </div>
      )}

      <SectionTitle>Tableau de valeurs f(x)</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('value-table')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'value-table' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Cliquez pour placer un tableau de valeurs automatique"
      >
        <Table2 className="h-3.5 w-3.5 shrink-0" />
        Tableau x / y = f(x)
      </button>
      {tool === 'value-table' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <p className={designerShellMicroLabel}>Expression</p>
          <input type="text" value={cfg.vtExpr ?? 'x'}
            onChange={(e) => setCfg({ vtExpr: e.target.value })}
            className="w-full rounded px-2 py-1 text-[11px] bg-white/6 border border-white/12 text-white font-mono"
            placeholder="x^2, sin(x)..."
            spellCheck={false} />
          <div className="flex gap-1 items-center">
            <input type="number" value={cfg.vtXMin ?? -3}
              onChange={(e) => setCfg({ vtXMin: Number(e.target.value) })}
              className="w-14 rounded px-1.5 py-0.5 text-[10px] bg-white/6 border border-white/12 text-white" step={1} />
            <span className="text-white/40 text-[10px]">→</span>
            <input type="number" value={cfg.vtXMax ?? 3}
              onChange={(e) => setCfg({ vtXMax: Number(e.target.value) })}
              className="w-14 rounded px-1.5 py-0.5 text-[10px] bg-white/6 border border-white/12 text-white" step={1} />
            <span className="text-white/40 text-[10px]">pas</span>
            <input type="number" value={cfg.vtXStep ?? 1}
              onChange={(e) => setCfg({ vtXStep: Math.max(0.01, Number(e.target.value)) })}
              className="w-12 rounded px-1.5 py-0.5 text-[10px] bg-white/6 border border-white/12 text-white" step={0.5} min={0.01} />
          </div>
          <p className="text-[8px] text-white/35">Cliquez sur le tableau pour placer.</p>
        </div>
      )}

      <SectionTitle>Tableau de variations</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('variation-table')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'variation-table' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Cliquez pour placer un tableau de variations f'/f"
      >
        <span className="font-serif text-[13px] leading-none">↗↘</span>
        Tableau de variations
      </button>
      {tool === 'variation-table' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <div className="flex gap-2">
            <label className="flex flex-col gap-0.5 flex-1">
              <span className={designerShellMicroLabel}>Fonction</span>
              <input type="text" maxLength={4} value={cfg.vtFnName ?? 'f'}
                onChange={(e) => setCfg({ vtFnName: e.target.value })}
                className="w-full rounded px-2 py-1 text-[11px] bg-white/6 border border-white/12 text-white font-bold italic" />
            </label>
          </div>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Valeurs de x (virgule)</span>
            <input type="text" value={cfg.vtXVals ?? '-∞, 1, +∞'}
              onChange={(e) => setCfg({ vtXVals: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white font-mono" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Signes de f&apos; (intervalles)</span>
            <input type="text" value={cfg.vtDerivSigns ?? '+, -'}
              onChange={(e) => setCfg({ vtDerivSigns: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white font-mono"
              placeholder="+, -, +" />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-col gap-0.5 flex-1">
              <span className={designerShellMicroLabel}>f aux pts critiques</span>
              <input type="text" value={cfg.vtCritFVals ?? '3'}
                onChange={(e) => setCfg({ vtCritFVals: e.target.value })}
                className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white font-mono"
                placeholder="3, -1" />
            </label>
            <label className="flex flex-col gap-0.5 flex-1">
              <span className={designerShellMicroLabel}>f aux frontières</span>
              <input type="text" value={cfg.vtBoundaryFVals ?? ', '}
                onChange={(e) => setCfg({ vtBoundaryFVals: e.target.value })}
                className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white font-mono"
                placeholder=", (vide = ±∞)" />
            </label>
          </div>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Sens (true=↗ false=↘)</span>
            <input type="text" value={cfg.vtIncreasing ?? 'true, false'}
              onChange={(e) => setCfg({ vtIncreasing: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white font-mono" />
          </label>
          <p className="text-[8px] text-white/35 leading-relaxed">
            Cliquez sur le tableau pour placer. Ex : 3 valeurs de x = 2 intervalles.
          </p>
        </div>
      )}

      <SectionTitle>Tableau de signes</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('sign-table')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'sign-table' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Cliquez pour placer un tableau de signes"
      >
        <span className="font-serif text-[13px]">+/−</span>
        Tableau de signes
      </button>
      {tool === 'sign-table' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Valeurs de x (virgule)</span>
            <input type="text" value={cfg.signXVals ?? '-∞, -1, 0, 2, +∞'}
              onChange={(e) => setCfg({ signXVals: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white font-mono" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Lignes (label: s1, s2, s3…)</span>
            <textarea rows={4} value={cfg.signRows ?? '(x+1): -, 0, +, +, +, +, +\nx: -, -, -, 0, +, +, +\nProduit: +, 0, -, 0, +, 0, -'}
              onChange={(e) => setCfg({ signRows: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white font-mono resize-none"
              spellCheck={false} />
          </label>
          <p className="text-[8px] text-white/35 leading-relaxed">
            Une ligne = facteur. Format: label: sign1, sign2, …<br/>
            Signes: <code className="text-amber-200/70">+</code> vert · <code className="text-red-300/70">-</code> rouge · <code className="text-white/60">0</code> · <code className="text-white/60">||</code> discontinuité<br/>
            2×n−1 signes pour n valeurs de x.
          </p>
        </div>
      )}

      <SectionTitle>Histogramme / Diagramme en barres</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('histogram')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'histogram' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Glissez pour créer un histogramme"
      >
        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
        Histogramme
      </button>
      {tool === 'histogram' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Étiquettes (virgule)</span>
            <input type="text" value={cfg.histLabels ?? 'Lun, Mar, Mer, Jeu, Ven'}
              onChange={(e) => setCfg({ histLabels: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white"
              placeholder="A, B, C, D" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Valeurs (virgule)</span>
            <input type="text" value={cfg.histValues ?? '4, 7, 3, 8, 5'}
              onChange={(e) => setCfg({ histValues: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white font-mono"
              placeholder="4, 7, 3, 8, 5" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Titre (optionnel)</span>
            <input type="text" value={cfg.histTitle ?? ''}
              onChange={(e) => setCfg({ histTitle: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white"
              placeholder="Ex: Températures moyennes" />
          </label>
          <p className="text-[8px] text-white/35">Glissez pour définir la taille du graphique.</p>
        </div>
      )}

      <SectionTitle>Diagramme circulaire (camembert)</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('pie-chart')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'pie-chart' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Glissez pour définir le rayon"
      >
        <span className="text-[14px] leading-none">◑</span>
        Camembert / Secteurs
      </button>
      {tool === 'pie-chart' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Étiquettes (virgule)</span>
            <input type="text" value={cfg.pieLabels ?? 'Rouge, Bleu, Vert'}
              onChange={(e) => setCfg({ pieLabels: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Valeurs</span>
            <input type="text" value={cfg.pieValues ?? '30, 25, 45'}
              onChange={(e) => setCfg({ pieValues: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white font-mono" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Titre</span>
            <input type="text" value={cfg.pieTitle ?? ''}
              onChange={(e) => setCfg({ pieTitle: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white"
              placeholder="Ex: Couleurs préférées" />
          </label>
          <p className="text-[8px] text-white/35">Glissez depuis le centre pour définir le rayon.</p>
        </div>
      )}

      <SectionTitle>Nuage de points</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('scatter-plot')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'scatter-plot' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Glissez pour placer un nuage de points"
      >
        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
        Nuage de points
      </button>
      {tool === 'scatter-plot' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <p className={designerShellMicroLabel}>Points (x,y séparés par &apos;;&apos;)</p>
          <textarea
            value={cfg.scatterData ?? '1,2; 3,4; 5,1; 7,6'}
            onChange={(e) => setCfg({ scatterData: e.target.value })}
            rows={3}
            className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white font-mono resize-none"
            placeholder="1,2; 3,4; 5,1; 7,6; 2,5"
            spellCheck={false}
          />
          <p className="text-[8px] text-white/40">Format : x,y; x,y; x,y — optionnel : x,y,Label</p>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Titre</span>
            <input type="text" value={cfg.scatterTitle ?? ''}
              onChange={(e) => setCfg({ scatterTitle: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white" />
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-[9px] text-white/60">
            <input type="checkbox" checked={cfg.scatterConnect || false}
              onChange={(e) => setCfg({ scatterConnect: e.target.checked })}
              className="accent-amber-500/80" />
            Relier les points
          </label>
          <p className="text-[8px] text-white/35">Glissez pour définir l'échelle.</p>
        </div>
      )}

      <SectionTitle>Formule LaTeX / KaTeX</SectionTitle>
      <button
        type="button"
        onClick={onLatexRequest}
        className={cn(
          designerShellChipGhost,
          'w-full py-2 text-[10px] flex items-center justify-center gap-2',
          tool === 'latex' && 'border-amber-500/50 bg-amber-500/14 text-amber-100',
        )}
      >
        <Pi className="h-3.5 w-3.5" />
        Insérer une formule (ex. : <span className="font-mono text-[9px] text-amber-200/80">\frac&#123;a&#125;&#123;b&#125;</span>)
      </button>
      <p className={cn(designerShellMicroLabel, 'mt-1 text-white/30')}>
        Cliquez sur le tableau pour placer après saisie.
      </p>
    </>
  );
}

/* ── onglet Sciences ──────────────────────────────────────────────────── */
const ELECTRIC_SYMBOLS = [
  { id: 'resistor', label: 'Résistance' },
  { id: 'lamp', label: 'Lampe' },
  { id: 'battery', label: 'Pile' },
  { id: 'switch-open', label: 'Inter. ouvert' },
  { id: 'switch-closed', label: 'Inter. fermé' },
  { id: 'ammeter', label: 'Ampèremètre' },
  { id: 'voltmeter', label: 'Voltmètre' },
  { id: 'generator', label: 'Générateur' },
  { id: 'capacitor', label: 'Condensateur' },
  { id: 'diode', label: 'Diode' },
  { id: 'ground', label: 'Masse' },
  { id: 'junction', label: 'Nœud' },
];

function SciencesTab() {
  const tool = useLiveWhiteboardStore((s) => s.tool);
  const setTool = useLiveWhiteboardStore((s) => s.setTool);
  const cfg = useLiveWhiteboardStore((s) => s.schoolConfig);
  const setCfg = useLiveWhiteboardStore((s) => s.setSchoolConfig);

  const SCIENCE_TOOLS = [
    { id: 'vector', label: 'Vecteur ⃗F', Icon: ArrowRight, cfg: {} },
    { id: 'axes', label: 'Graphe (axes)', Icon: Calculator, cfg: {} },
    { id: 'function-plot', label: 'Courbe f(x)', Icon: TrendingUp, cfg: {} },
    { id: 'numberline', label: 'Axe temps', Icon: Minus, cfg: {} },
    { id: 'table', label: 'Tableau données', Icon: Table2, cfg: {} },
    { id: 'ruler', label: 'Règle mesure', Icon: Ruler, cfg: {} },
    { id: 'protractor', label: 'Angles', Icon: Compass, cfg: {} },
  ];

  const SUBJECT_STAMPS = [
    {
      label: 'Biologie',
      Icon: Microscope,
      tools: [
        { id: 'frame', icon: '🔬', label: 'Zone cellule' },
        { id: 'circle', icon: '⭕', label: 'Membrane' },
        { id: 'polygon', icon: '⬡', label: 'Noyau (hex)' },
      ],
    },
    {
      label: 'Physique',
      Icon: Zap,
      tools: [
        { id: 'arrow', icon: '→', label: 'Force (N)' },
        { id: 'axes', icon: '📊', label: 'Repère' },
        { id: 'ruler', icon: '📏', label: 'Mesure' },
      ],
    },
    {
      label: 'Chimie',
      Icon: FlaskConical,
      tools: [
        { id: 'circle', icon: '⚛', label: 'Atome' },
        { id: 'polygon', icon: '⬡', label: 'Molécule' },
        { id: 'table', icon: '▦', label: 'Tableau' },
      ],
    },
  ];

  return (
    <>
      <SectionTitle>Outils polyvalents sciences</SectionTitle>
      <div className="grid grid-cols-2 gap-1">
        {SCIENCE_TOOLS.map(({ id, label, Icon }) => (
          <ToolBtn key={`${id}-${label}`} id={id} label={label} Icon={Icon} active={tool === id} onClick={() => setTool(id)} />
        ))}
      </div>

      {SUBJECT_STAMPS.map(({ label, Icon, tools }) => (
        <div key={label}>
          <SectionTitle>
            <span className="flex items-center gap-1"><Icon className="h-3 w-3" />{label}</span>
          </SectionTitle>
          <div className="grid grid-cols-3 gap-1">
            {tools.map(({ id, icon, label: lbl }) => (
              <ToolBtn key={`${id}-${lbl}`} id={id} label={lbl} active={tool === id} onClick={() => setTool(id)} title={lbl} />
            ))}
          </div>
        </div>
      ))}

      <SectionTitle>Schéma électrique</SectionTitle>
      <p className={cn(designerShellMicroLabel, 'mb-1 text-white/30')}>
        Sélectionnez un composant, puis cliquez sur le tableau.
      </p>
      <button
        type="button"
        onClick={() => setTool('electric-component')}
        className={cn(
          designerShellChipGhost,
          'w-full py-1.5 text-[9px] font-semibold mb-1',
          tool === 'electric-component' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
      >
        {tool === 'electric-component' ? `▸ Cliquer pour placer : ${cfg.electricComp}` : 'Activer le placement'}
      </button>
      <div className="grid grid-cols-3 gap-1">
        {ELECTRIC_SYMBOLS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setCfg({ electricComp: id }); setTool('electric-component'); }}
            className={cn(
              designerShellChipGhost,
              'py-1 text-[8px] text-center',
              cfg.electricComp === id && tool === 'electric-component' && 'border-amber-500/45 bg-amber-500/14 text-amber-100',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tool === 'electric-component' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <div className="flex gap-2">
            <label className="flex flex-col gap-0.5 flex-1">
              <span className={designerShellMicroLabel}>Taille (px)</span>
              <NumPicker value={cfg.electricSize ?? 50} options={[30, 40, 50, 60, 80]}
                onChange={(v) => setCfg({ electricSize: v })} />
            </label>
          </div>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Rotation (°)</span>
            <NumPicker value={cfg.electricAngle ?? 0} options={[0, 45, 90, 135, 180, 270]}
              onChange={(v) => setCfg({ electricAngle: v })} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Étiquette</span>
            <input type="text" value={cfg.electricLabel ?? ''}
              onChange={(e) => setCfg({ electricLabel: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white"
              placeholder="R1, L1, U..." />
          </label>
        </div>
      )}

      <SectionTitle>Arbre de probabilités</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('prob-tree')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2 text-[9px] font-semibold',
          tool === 'prob-tree' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Cliquez pour placer un arbre de probabilités"
      >
        <span className="text-[13px] leading-none">🌿</span>
        Arbre de probabilités
      </button>
      {tool === 'prob-tree' && (
        <div className={cn(designerShellCardInset, 'mt-1 space-y-1.5')}>
          <label className="flex flex-col gap-0.5">
            <span className={designerShellMicroLabel}>Niveau 1 (label:proba, …)</span>
            <input type="text" value={cfg.probL1 ?? 'A:0.3, Ā:0.7'}
              onChange={(e) => setCfg({ probL1: e.target.value })}
              className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white font-mono" />
          </label>
          {['probL2A', 'probL2B', 'probL2C', 'probL2D'].slice(0, (cfg.probL1 || '').split(',').length).map((key, i) => (
            <label key={key} className="flex flex-col gap-0.5">
              <span className={designerShellMicroLabel}>Niveau 2 depuis branche {i + 1}</span>
              <input type="text" value={cfg[key] ?? (i === 0 ? 'B:0.4, B̄:0.6' : 'B:0.2, B̄:0.8')}
                onChange={(e) => setCfg({ [key]: e.target.value })}
                className="w-full rounded px-2 py-1 text-[10px] bg-white/6 border border-white/12 text-white font-mono" />
            </label>
          ))}
          <label className="flex items-center gap-2 cursor-pointer text-[9px] text-white/60">
            <input type="checkbox" checked={cfg.probShowProducts !== false}
              onChange={(e) => setCfg({ probShowProducts: e.target.checked })}
              className="accent-amber-500/80" />
            Afficher P(A∩B) aux feuilles
          </label>
          <p className="text-[8px] text-white/35">Cliquez sur le tableau pour placer.</p>
        </div>
      )}

      <div className={cn(designerShellCardInset, 'mt-2 text-[9px] text-white/38 leading-relaxed')}>
        <BookOpen className="inline h-3 w-3 mr-1 opacity-60" />
        Activez un outil puis tracez sur le tableau. Couleur et épaisseur depuis le rail principal.
      </div>
    </>
  );
}

/* ── onglet Arrangement (plan Z + parent) ────────────────────────────── */
function ArrangeTab() {
  const bringToFront = useLiveWhiteboardStore((s) => s.bringToFront);
  const sendToBack = useLiveWhiteboardStore((s) => s.sendToBack);
  const bringForward = useLiveWhiteboardStore((s) => s.bringForward);
  const sendBackward = useLiveWhiteboardStore((s) => s.sendBackward);
  const alignLeft = useLiveWhiteboardStore((s) => s.alignLeft);
  const alignRight = useLiveWhiteboardStore((s) => s.alignRight);
  const alignCenterH = useLiveWhiteboardStore((s) => s.alignCenterH);
  const alignTop = useLiveWhiteboardStore((s) => s.alignTop);
  const alignBottom = useLiveWhiteboardStore((s) => s.alignBottom);
  const alignCenterV = useLiveWhiteboardStore((s) => s.alignCenterV);
  const distributeH = useLiveWhiteboardStore((s) => s.distributeH);
  const distributeV = useLiveWhiteboardStore((s) => s.distributeV);
  const boardSelection = useLiveWhiteboardStore((s) => s.boardSelection);
  const hasSel = boardSelection.length > 0;
  const has2Sel = boardSelection.length >= 2;

  return (
    <>
      <p className={cn(designerShellMicroLabel, 'mb-1.5')}>
        Alignement (2+ objets sélectionnés)
      </p>
      <div className="grid grid-cols-3 gap-1 mb-2">
        {[
          { label: '⬛⬜⬜', title: 'Aligner à gauche', fn: alignLeft },
          { label: '⬜⬛⬜', title: 'Centrer horizontalement', fn: alignCenterH },
          { label: '⬜⬜⬛', title: 'Aligner à droite', fn: alignRight },
          { label: '⬛⬜⬜ (↑)', title: 'Aligner en haut', fn: alignTop },
          { label: '⬜⬛⬜ (↕)', title: 'Centrer verticalement', fn: alignCenterV },
          { label: '⬜⬜⬛ (↓)', title: 'Aligner en bas', fn: alignBottom },
        ].map(({ label, title, fn }) => (
          <button
            key={title}
            type="button"
            title={title}
            disabled={!has2Sel}
            onClick={fn}
            className={cn(
              designerShellChipGhost, 'py-1 text-[8px]',
              !has2Sel && 'pointer-events-none opacity-30',
            )}
          >
            {title.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1 mb-2">
        <button type="button" title="Distribuer horizontalement" disabled={!has2Sel} onClick={distributeH}
          className={cn(designerShellChipGhost, 'py-1 text-[8px]', !has2Sel && 'pointer-events-none opacity-30')}>
          ↔ Distribuer H
        </button>
        <button type="button" title="Distribuer verticalement" disabled={!has2Sel} onClick={distributeV}
          className={cn(designerShellChipGhost, 'py-1 text-[8px]', !has2Sel && 'pointer-events-none opacity-30')}>
          ↕ Distribuer V
        </button>
      </div>

      <p className={cn(designerShellMicroLabel, 'mb-2')}>
        Ordre des calques (sélectionnez d'abord)
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: 'Avant-plan', title: 'Premier plan (Ctrl+Maj+])', Icon: ChevronsUp, fn: bringToFront },
          { label: 'Arrière-plan', title: 'Arrière-plan total (Ctrl+Maj+[)', Icon: ChevronsDown, fn: sendToBack },
          { label: 'Monter', title: 'Un cran vers l\'avant (Ctrl+])', Icon: ChevronUp, fn: bringForward },
          { label: 'Descendre', title: 'Un cran vers l\'arrière (Ctrl+[)', Icon: ChevronDown, fn: sendBackward },
        ].map(({ label, title, Icon, fn }) => (
          <button
            key={label}
            type="button"
            title={title}
            disabled={!hasSel}
            onClick={fn}
            className={cn(
              designerShellChipGhost,
              'flex items-center gap-1.5 py-2 text-[10px]',
              !hasSel && 'pointer-events-none opacity-30',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      <div className={cn(designerShellCardInset, 'mt-3 space-y-1.5')}>
        <p className={designerShellMicroLabel}>Raccourcis clavier</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-white/45">
          {[
            ['Ctrl+]', 'Un cran ↑'],
            ['Ctrl+[', 'Un cran ↓'],
            ['Ctrl+Maj+]', 'Premier plan'],
            ['Ctrl+Maj+[', 'Arrière-plan'],
            ['Ctrl+G', 'Grouper'],
            ['Ctrl+Maj+G', 'Dégrouper'],
          ].map(([k, v]) => (
            <React.Fragment key={k}>
              <span className="font-mono text-amber-200/70 text-[8px]">{k}</span>
              <span>{v}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className={cn(designerShellCardInset, 'mt-2 text-[9px] text-white/38 leading-relaxed')}>
        <LayoutGrid className="inline h-3 w-3 mr-1 opacity-60" />
        Créez un <strong className="text-white/60">Cadre</strong> (onglet Géométrie) pour regrouper visuellement des éléments. Glissez ensuite les éléments dans le cadre pour les organiser.
      </div>
    </>
  );
}

/* ── LaTeX dialog ────────────────────────────────────────────────────────── */
function LatexDialog({ onClose, onInsert }) {
  const [formula, setFormula] = useState('\\frac{a}{b}');
  const [displayMode, setDisplayMode] = useState(true);

  const PRESETS = [
    { label: 'Fraction', f: '\\frac{a}{b}' },
    { label: 'Racine', f: '\\sqrt{x}' },
    { label: 'Somme Σ', f: '\\sum_{i=1}^{n} a_i' },
    { label: 'Intégrale', f: '\\int_{0}^{\\infty} e^{-x} dx' },
    { label: 'Dérivée', f: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}" },
    { label: 'Pythagore', f: 'a^2 + b^2 = c^2' },
    { label: 'Quadratique', f: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}' },
    { label: 'Euler', f: 'e^{i\\pi} + 1 = 0' },
    { label: 'Binôme', f: '(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^k b^{n-k}' },
    { label: 'Vecteur', f: '\\vec{AB} = \\begin{pmatrix} x_B - x_A \\\\ y_B - y_A \\end{pmatrix}' },
    { label: 'Énergie', f: 'E = mc^2' },
    { label: 'Loi Ohm', f: 'U = R \\cdot I' },
    { label: 'Matrice', f: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
    { label: 'Limite', f: '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1' },
    { label: 'Complexe', f: 'z = a + bi = re^{i\\theta}' },
    { label: 'Newton', f: 'F = m \\cdot a' },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className="w-[min(92vw,540px)] rounded-2xl border border-white/[0.11] bg-[#14131c]/98 p-5 shadow-[0_24px_80px_-20px_rgba(0,0,0,.8)] space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-bold text-white/90 tracking-tight">Formule LaTeX / KaTeX</p>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white/75 text-lg leading-none">✕</button>
        </div>

        <textarea
          className="w-full rounded-xl bg-white/[0.05] border border-white/10 text-white text-[11px] font-mono px-3 py-2 h-20 resize-none outline-none focus:border-amber-500/50 focus:bg-white/[0.07]"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder="\frac{a}{b}"
          spellCheck={false}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDisplayMode((v) => !v)}
            className={cn(
              'text-[9px] px-2.5 py-1 rounded-lg border',
              displayMode
                ? 'border-amber-500/40 bg-amber-500/12 text-amber-200'
                : 'border-white/12 bg-white/4 text-white/50',
            )}
          >
            {displayMode ? 'Mode display (centré)' : 'Mode inline'}
          </button>
        </div>

        <div>
          <p className={cn(designerShellMicroLabel, 'mb-1.5')}>Formules prêtes à l'emploi</p>
          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
            {PRESETS.map(({ label, f }) => (
              <button
                key={label}
                type="button"
                onClick={() => setFormula(f)}
                className="text-[9px] px-2 py-0.5 rounded-lg border border-white/10 bg-white/4 text-white/55 hover:border-amber-500/35 hover:text-amber-100 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => formula.trim() && onInsert(formula.trim(), displayMode)}
            className="flex-1 rounded-xl border border-amber-500/45 bg-amber-500/16 py-2 text-[11px] font-bold text-amber-100 hover:bg-amber-500/24 transition-colors"
          >
            ✓ Placer sur le tableau
          </button>
          <button type="button" onClick={onClose} className="px-4 rounded-xl border border-white/12 bg-white/4 text-[11px] text-white/55">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── onglet Enseignant ───────────────────────────────────────────────────── */
function EnseignantTab() {
  const tool = useLiveWhiteboardStore((s) => s.tool);
  const setTool = useLiveWhiteboardStore((s) => s.setTool);
  const boardSurface = useLiveWhiteboardStore((s) => s.boardSurface);
  const setBoardSurface = useLiveWhiteboardStore((s) => s.setBoardSurface);
  const setPendingTemplate = useLiveWhiteboardStore((s) => s.setPendingTemplate);
  const pendingTemplate = useLiveWhiteboardStore((s) => s.pendingTemplate);
  const [tplCat, setTplCat] = useState('geo');

  return (
    <>
      <SectionTitle>Cacher / Révéler</SectionTitle>
      <button
        type="button"
        onClick={() => setTool('curtain')}
        className={cn(
          designerShellChipGhost,
          'w-full flex items-center gap-2 py-2.5 text-[9px] font-semibold',
          tool === 'curtain' && 'border-amber-500/55 bg-amber-500/16 text-amber-100',
        )}
        title="Glissez pour couvrir une zone — déplacez/redimensionnez pour révéler"
      >
        <span className="text-[15px] leading-none">▓</span>
        Rideau (cacher / révéler)
      </button>
      <div className={cn(designerShellCardInset, 'mt-1 space-y-1 text-[9px] text-white/60 leading-relaxed')}>
        <p className="text-amber-200/75 font-semibold">Comment utiliser</p>
        <p>① Glissez pour dessiner le rideau sur la zone à cacher.</p>
        <p>② Sélectionnez le rideau → <strong className="text-white/75">glissez son bord</strong> pour révéler progressivement.</p>
        <p>③ Supprimez-le (Suppr) pour tout révéler.</p>
        <p className="text-white/35 text-[8px]">Le rideau prend automatiquement la couleur du fond actuel.</p>
      </div>

      <SectionTitle>Fond du tableau</SectionTitle>
      <div className="grid grid-cols-3 gap-1">
        {[
          { id: 'dark', label: 'Sombre', color: 'amber' },
          { id: 'chalkboard', label: 'Tableau vert', color: 'emerald' },
          { id: 'geoplan', label: 'Géoplan', color: 'blue' },
        ].map(({ id, label, color }) => (
          <button
            key={id}
            type="button"
            onClick={() => setBoardSurface(id)}
            className={cn(
              designerShellChipGhost,
              'py-1.5 text-[9px]',
              boardSurface === id && `border-${color}-500/45 bg-${color}-500/14 text-${color}-100`,
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className={cn(designerShellMicroLabel, 'mt-1 text-white/30 leading-relaxed')}>
        Le géoplan affiche une grille de points bleutés sur fond blanc — idéal pour la géométrie.
      </p>

      <SectionTitle>Modèles prêts-à-l'emploi</SectionTitle>
      <p className={cn(designerShellMicroLabel, 'mb-1.5 text-white/30')}>
        Cliquez un modèle puis cliquez sur le tableau pour le placer.
      </p>
      <div className="flex gap-1 mb-2 flex-wrap">
        {TEMPLATE_CATEGORIES.map(({ id, label }) => (
          <button key={id} type="button" onClick={() => setTplCat(id)}
            className={cn('rounded-lg px-2 py-1 text-[8px] font-semibold border transition-colors',
              tplCat === id
                ? 'border-amber-500/45 bg-amber-500/14 text-amber-100'
                : 'border-white/10 bg-white/4 text-white/45 hover:text-white/70')}>
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {WHITEBOARD_TEMPLATES.filter((t) => t.category === tplCat).map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => {
              setPendingTemplate(tpl);
              setTool('template-place');
            }}
            className={cn(
              'w-full text-left rounded-xl border px-3 py-2 transition-colors',
              tool === 'template-place' && pendingTemplate?.id === tpl.id
                ? 'border-amber-500/55 bg-amber-500/14 text-amber-100'
                : 'border-white/8 bg-white/3 text-white/60 hover:border-white/18 hover:text-white/85',
            )}
          >
            <span className="font-mono text-[14px] mr-2">{tpl.icon}</span>
            <span className="font-semibold text-[10px]">{tpl.label}</span>
            <p className="text-[8px] text-white/35 mt-0.5 leading-relaxed">{tpl.description}</p>
          </button>
        ))}
      </div>
      {tool === 'template-place' && pendingTemplate && (
        <div className={cn(designerShellCardInset, 'mt-2 text-[9px] text-amber-200/75 leading-relaxed')}>
          ▸ Cliquez sur le tableau pour placer <strong>{pendingTemplate.label}</strong>. Échap pour annuler.
        </div>
      )}
    </>
  );
}

/* ── Composant principal ─────────────────────────────────────────────────── */
export default function LiveWhiteboardSchoolTab({ className, onLatexInsertRequest }) {
  const [subTab, setSubTab] = useState('compas');
  const [latexOpen, setLatexOpen] = useState(false);
  const setTool = useLiveWhiteboardStore((s) => s.setTool);

  const handleLatexRequest = useCallback(() => {
    setLatexOpen(true);
  }, []);

  const handleLatexInsert = useCallback((formula, displayMode) => {
    setLatexOpen(false);
    setTool('latex');
    window.dispatchEvent(new CustomEvent('liri:wb:latex-pending', { detail: { formula, displayMode } }));
    onLatexInsertRequest?.(formula, displayMode);
  }, [setTool, onLatexInsertRequest]);

  return (
    <div className={className}>
      {latexOpen && (
        <LatexDialog
          onClose={() => setLatexOpen(false)}
          onInsert={handleLatexInsert}
        />
      )}

      <p className="font-serif text-[13px] font-semibold text-white/90 tracking-tight uppercase tracking-wide text-white/70 text-[11px] mb-2">
        Tableau Scolaire
      </p>
      <p className={cn(designerShellMicroLabel, 'mb-3 text-white/35')}>
        Outils géométrie, repères, formules, sciences
      </p>

      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap mb-3">
        {SUBJECT_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={cn(
              'flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-semibold border transition-colors',
              subTab === id
                ? 'border-amber-500/45 bg-amber-500/14 text-amber-100'
                : 'border-white/10 bg-white/4 text-white/50 hover:border-white/20 hover:text-white/70',
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-0.5">
      {subTab === 'compas' && <CompassTab />}
      {subTab === 'geo' && <GeoTab />}
      {subTab === 'math' && <MathTab onLatexRequest={handleLatexRequest} />}
      {subTab === 'sciences' && <SciencesTab />}
      {subTab === 'enseignant' && <EnseignantTab />}
      {subTab === 'arrange' && <ArrangeTab />}
      </div>
    </div>
  );
}
