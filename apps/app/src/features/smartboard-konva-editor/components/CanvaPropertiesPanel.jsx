/**
 * CanvaPropertiesPanel — panneau droite style Canva Pro.
 * Affiché quand un objet est sélectionné : alignement, couleurs, typographie, opacité, export PNG.
 */
import React, { useRef, useEffect } from 'react';
import {
  AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  ArrowUp, ArrowDown, ChevronsUp, ChevronsDown,
  Bold, Italic, Underline, AlignJustify,
  Layers, Copy, Trash2, Lock, Unlock, Eye, EyeOff,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { LIRI_TEXT_DESIGN_STYLES, liriTextStyleToSceneObjects } from '../lib/liriTextDesignPack';

/** Modes de fusion calques (Canvas 2D / Konva — équivalent modes Photoshop). */
const BLEND_MODE_OPTIONS = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Produit' },
  { value: 'screen', label: 'Superposition clair' },
  { value: 'overlay', label: 'Incrustation' },
  { value: 'darken', label: 'Obscurcir' },
  { value: 'lighten', label: 'Éclaircir' },
  { value: 'color-dodge', label: 'Densité couleur −' },
  { value: 'color-burn', label: 'Densité couleur +' },
  { value: 'hard-light', label: 'Lumière dure' },
  { value: 'soft-light', label: 'Lumière douce' },
  { value: 'difference', label: 'Différence' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Teinte (mode)' },
  { value: 'saturation', label: 'Saturation (mode)' },
  { value: 'color', label: 'Couleur' },
  { value: 'luminosity', label: 'Luminosité' },
];

function BlendModeRow({ st, updateStyle, hint }) {
  const v =
    typeof st.globalCompositeOperation === 'string' && st.globalCompositeOperation
      ? st.globalCompositeOperation
      : 'source-over';
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[13px] text-white/35">Mode de fusion (calque)</span>
      {hint ? (
        <p className="mb-1 text-[10px] leading-snug text-white/28">{hint}</p>
      ) : null}
      <select
        value={v}
        onChange={(e) => updateStyle({ globalCompositeOperation: e.target.value })}
        className="h-8 w-full rounded-md border border-white/12 bg-black/50 px-2 text-[12px] text-white"
      >
        {BLEND_MODE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const FONT_OPTIONS = [
  { label: 'Inter',       value: 'Inter, system-ui, sans-serif' },
  { label: 'Georgia',     value: 'Georgia, serif' },
  { label: 'Système',     value: 'system-ui, sans-serif' },
  { label: 'Playfair',    value: '\'Playfair Display\', Georgia, serif' },
  { label: 'Mono',        value: 'ui-monospace, SFMono-Regular, monospace' },
  { label: 'Impact',      value: 'Impact, Haettenschweiler, sans-serif' },
  { label: 'Courier',     value: '\'Courier New\', Courier, monospace' },
];

function SectionLabel({ children }) {
  return (
    <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/70">
      {children}
    </p>
  );
}

function IconBtn({ onClick, title, className, children, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md border text-white/70 transition-colors',
        active
          ? 'border-[#D4AF37]/60 bg-[#D4AF37]/20 text-[#f5dd8a]'
          : 'border-white/12 bg-white/[0.04] hover:border-[#D4AF37]/35 hover:bg-white/10',
        className,
      )}
    >
      {children}
    </button>
  );
}

export default function CanvaPropertiesPanel({
  selectedObj,
  selectedIds,
  objects,
  canvasWidth,
  canvasHeight,
  updateObject,
  alignSelected,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
  deleteSelected,
  setObjectOpacity,
  onExportPng,
  className,
}) {
  const cropXRef = useRef(null);
  const cropYRef = useRef(null);
  const cropWRef = useRef(null);
  const cropHRef = useRef(null);
  const maskXRef = useRef(null);
  const maskYRef = useRef(null);
  const maskWRef = useRef(null);
  const maskHRef = useRef(null);

  useEffect(() => {
    if (!selectedObj || selectedObj.type !== 'image') return;
    const cr = selectedObj.content?.crop;
    if (cropXRef.current) cropXRef.current.value = cr && cr.x != null ? String(cr.x) : '';
    if (cropYRef.current) cropYRef.current.value = cr && cr.y != null ? String(cr.y) : '';
    if (cropWRef.current) cropWRef.current.value = cr && cr.width != null ? String(cr.width) : '';
    if (cropHRef.current) cropHRef.current.value = cr && cr.height != null ? String(cr.height) : '';
    const m = selectedObj.style?.mask;
    if (maskXRef.current) maskXRef.current.value = m && m.x != null ? String(m.x) : '';
    if (maskYRef.current) maskYRef.current.value = m && m.y != null ? String(m.y) : '';
    if (maskWRef.current) maskWRef.current.value = m && m.width != null ? String(m.width) : '';
    if (maskHRef.current) maskHRef.current.value = m && m.height != null ? String(m.height) : '';
  }, [
    selectedObj,
    selectedObj?.id,
    selectedObj?.type,
    selectedObj?.content?.crop,
    selectedObj?.style?.mask?.x,
    selectedObj?.style?.mask?.y,
    selectedObj?.style?.mask?.width,
    selectedObj?.style?.mask?.height,
  ]);

  if (!selectedObj) {
    return (
      <div className={cn('flex flex-col gap-3 p-3', className)}>
        <SectionLabel>Alignement canvas</SectionLabel>
        <div className="text-[13px] text-white/30">Sélectionnez un objet pour modifier ses propriétés.</div>
        <div className="mt-4 border-t border-white/[0.07] pt-3">
          <SectionLabel>Export</SectionLabel>
          <button
            type="button"
            onClick={onExportPng}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/12 py-2.5 text-[12px] font-medium text-[#f5dd8a] hover:bg-[#D4AF37]/20"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter slide PNG
          </button>
        </div>
      </div>
    );
  }

  const isText = selectedObj.type === 'text';
  const isShape = ['rect', 'circle', 'ellipse', 'triangle', 'starshape', 'diamond', 'line'].includes(selectedObj.type);
  const isIcon = selectedObj.type === 'icon';
  const isImage = selectedObj.type === 'image';
  const isTable = selectedObj.type === 'table';
  const st = selectedObj.style || {};
  const opacity = selectedObj.opacity ?? 1;
  const isLocked = !!selectedObj.locked;
  const isVisible = selectedObj.visible !== false;

  function updateStyle(partial) {
    updateObject(selectedObj.id, { style: { ...st, ...partial } });
  }

  return (
    <div className={cn('flex flex-col gap-0 divide-y divide-white/[0.06] overflow-y-auto [scrollbar-width:thin]', className)}>

      {/* Multi-select indicator */}
      {selectedIds.length > 1 && (
        <div className="px-3 py-1.5">
          <span className="text-[13px] text-[#D4AF37]/80">{selectedIds.length} objets sélectionnés</span>
        </div>
      )}

      {/* ── Alignement canvas (1 objet) ou groupe (2+) ── */}
      <div className="px-3 py-2.5">
        <SectionLabel>Aligner</SectionLabel>
        <p className="mb-1.5 text-[10px] leading-snug text-white/35">
          1 objet : canvas · 2+ : groupe · Alt+clic : forcer le canvas
        </p>
        <div className="grid grid-cols-3 gap-1">
          <IconBtn
            onClick={(e) => alignSelected('left', { forceCanvas: e.altKey })}
            title="Gauche — 1 : canvas · 2+ : groupe · Alt+clic : canvas"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            onClick={(e) => alignSelected('centerH', { forceCanvas: e.altKey })}
            title="Centre H — 1 : canvas · 2+ : groupe · Alt+clic : canvas"
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            onClick={(e) => alignSelected('right', { forceCanvas: e.altKey })}
            title="Droite — 1 : canvas · 2+ : groupe · Alt+clic : canvas"
          >
            <AlignRight className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            onClick={(e) => alignSelected('top', { forceCanvas: e.altKey })}
            title="Haut — 1 : canvas · 2+ : groupe · Alt+clic : canvas"
          >
            <AlignStartVertical className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            onClick={(e) => alignSelected('centerV', { forceCanvas: e.altKey })}
            title="Centre V — 1 : canvas · 2+ : groupe · Alt+clic : canvas"
          >
            <AlignCenterVertical className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            onClick={(e) => alignSelected('bottom', { forceCanvas: e.altKey })}
            title="Bas — 1 : canvas · 2+ : groupe · Alt+clic : canvas"
          >
            <AlignEndVertical className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </div>

      {/* ── Ordre calques ── */}
      <div className="px-3 py-2.5">
        <SectionLabel>Ordre des calques</SectionLabel>
        <div className="grid grid-cols-4 gap-1">
          <IconBtn onClick={() => bringToFront(selectedObj.id)} title="Premier plan">
            <ChevronsUp className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn onClick={() => bringForward(selectedObj.id)} title="Avancer">
            <ArrowUp className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn onClick={() => sendBackward(selectedObj.id)} title="Reculer">
            <ArrowDown className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn onClick={() => sendToBack(selectedObj.id)} title="Arrière-plan">
            <ChevronsDown className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[13px] text-white/35">Calque</span>
          <input
            type="number"
            value={selectedObj.layer ?? 0}
            onChange={(e) => updateObject(selectedObj.id, { layer: Number(e.target.value) || 0 })}
            className="h-6 w-16 rounded-md border border-white/12 bg-black/45 px-1.5 text-[12px] text-white"
          />
        </div>
      </div>

      {/* ── Position & taille ── */}
      <div className="px-3 py-2.5">
        <SectionLabel>Position & taille</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: 'X', key: 'x' },
            { label: 'Y', key: 'y' },
            { label: 'L', key: 'width' },
            { label: 'H', key: 'height' },
          ].map(({ label, key }) => (
            <label key={key} className="flex flex-col gap-0.5">
              <span className="text-[13px] text-white/35">{label}</span>
              <input
                type="number"
                value={Math.round(selectedObj[key] ?? 0)}
                onChange={(e) => updateObject(selectedObj.id, { [key]: Number(e.target.value) || 0 })}
                className="h-7 rounded-md border border-white/12 bg-black/45 px-2 text-[12px] text-white"
              />
            </label>
          ))}
        </div>
        <label className="mt-1.5 flex flex-col gap-0.5">
          <span className="text-[13px] text-white/35">Rotation (°)</span>
          <input
            type="number"
            value={Math.round(selectedObj.rotation || 0)}
            onChange={(e) => updateObject(selectedObj.id, { rotation: Number(e.target.value) || 0 })}
            className="h-7 rounded-md border border-white/12 bg-black/45 px-2 text-[12px] text-white"
          />
        </label>
      </div>

      {/* ── Opacité & visibilité ── */}
      <div className="px-3 py-2.5">
        <SectionLabel>Opacité & visibilité</SectionLabel>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(e) => setObjectOpacity(selectedObj.id, Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full accent-[#D4AF37]"
          />
          <span className="w-8 text-right text-[13px] font-mono text-white/60">
            {Math.round(opacity * 100)}%
          </span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <IconBtn
            onClick={() => updateObject(selectedObj.id, { visible: !isVisible })}
            title={isVisible ? 'Masquer' : 'Afficher'}
            active={!isVisible}
          >
            {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </IconBtn>
          <IconBtn
            onClick={() => updateObject(selectedObj.id, { locked: !isLocked })}
            title={isLocked ? 'Déverrouiller' : 'Verrouiller'}
            active={isLocked}
          >
            {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </IconBtn>
        </div>
      </div>

      {/* ── Mode de fusion (texte) ── */}
      {isText && (
        <div className="px-3 py-2.5">
          <BlendModeRow
            st={st}
            updateStyle={updateStyle}
            hint="Combine le texte avec les calques inférieurs (effet type Photoshop)."
          />
        </div>
      )}

      {/* ── Typographie (text seulement) ── */}
      {isText && (
        <div className="px-3 py-2.5">
          <SectionLabel>Typographie</SectionLabel>
          <div className="mb-2 rounded-lg border border-[#D4AF37]/18 bg-[#0d1018]/90 p-2">
            <div className="mb-1 flex items-end gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#D4AF37]/75">
              <span>Presets</span>
              <LiriWordmark size="footer" className="text-[#D4AF37]/75" subtleGlow />
            </div>
            <p className="mb-1.5 text-[10px] leading-snug text-white/40">Applique le style typographique du pack (contenu du texte inchangé).</p>
            <select
              defaultValue=""
              onChange={(e) => {
                const styleId = e.target.value;
                e.target.value = '';
                if (!styleId) return;
                const objs = liriTextStyleToSceneObjects(styleId);
                const src = objs.find((o) => o.type === 'text');
                if (!src?.style) return;
                updateObject(selectedObj.id, {
                  style: { ...st, ...src.style },
                });
              }}
              className="h-8 w-full rounded-md border border-white/12 bg-black/50 px-2 text-[11px] text-white"
            >
              <option value="">Choisir un style…</option>
              {LIRI_TEXT_DESIGN_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label || s.id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {/* Police */}
            <div>
              <span className="mb-0.5 block text-[13px] text-white/35">Police</span>
              <select
                value={FONT_OPTIONS.some((f) => f.value === st.fontFamily) ? st.fontFamily : FONT_OPTIONS[0].value}
                onChange={(e) => updateStyle({ fontFamily: e.target.value })}
                className="h-7 w-full rounded-md border border-white/12 bg-black/45 px-1.5 text-[12px] text-white"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            {/* Taille & Couleur */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="mb-0.5 block text-[13px] text-white/35">Taille</span>
                <input
                  type="number"
                  min={6}
                  max={200}
                  value={Number(st.fontSize ?? 24)}
                  onChange={(e) => updateStyle({ fontSize: Number(e.target.value) || 24 })}
                  className="h-7 w-full rounded-md border border-white/12 bg-black/45 px-2 text-[12px] text-white"
                />
              </div>
              <div>
                <span className="mb-0.5 block text-[13px] text-white/35">Couleur</span>
                <input
                  type="color"
                  value={typeof st.fill === 'string' && st.fill.startsWith('#') ? st.fill : '#F7F2E8'}
                  onChange={(e) => updateStyle({ fill: e.target.value })}
                  className="h-7 w-full cursor-pointer rounded-md border border-white/12 bg-transparent"
                />
              </div>
            </div>
            {/* Gras / Italique / Souligné */}
            <div>
              <span className="mb-0.5 block text-[13px] text-white/35">Style</span>
              <div className="flex gap-1">
                <IconBtn
                  onClick={() => updateStyle({ fontWeight: st.fontWeight === 700 || st.fontWeight === '700' ? 400 : 700 })}
                  active={st.fontWeight === 700 || st.fontWeight === '700'}
                  title="Gras"
                >
                  <Bold className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  onClick={() => updateStyle({ fontStyle: st.fontStyle === 'italic' ? 'normal' : 'italic' })}
                  active={st.fontStyle === 'italic'}
                  title="Italique"
                >
                  <Italic className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  onClick={() => updateStyle({ textDecoration: st.textDecoration === 'underline' ? '' : 'underline' })}
                  active={st.textDecoration === 'underline'}
                  title="Souligné"
                >
                  <Underline className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </div>
            {/* Alignement texte */}
            <div>
              <span className="mb-0.5 block text-[13px] text-white/35">Alignement</span>
              <div className="flex gap-1">
                {[
                  { value: 'left',    Icon: AlignLeft },
                  { value: 'center',  Icon: AlignCenter },
                  { value: 'right',   Icon: AlignRight },
                  { value: 'justify', Icon: AlignJustify },
                ].map(({ value, Icon }) => (
                  <IconBtn
                    key={value}
                    onClick={() => updateStyle({ align: value })}
                    active={st.align === value}
                    title={value}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </IconBtn>
                ))}
              </div>
            </div>
            {/* Interligne */}
            <div>
              <span className="mb-0.5 block text-[13px] text-white/35">
                Interligne — {(st.lineHeight ?? 1.25).toFixed(2)}
              </span>
              <input
                type="range"
                min={0.8}
                max={3}
                step={0.05}
                value={st.lineHeight ?? 1.25}
                onChange={(e) => updateStyle({ lineHeight: Number(e.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#D4AF37]"
              />
            </div>
            {/* Ombre */}
            <div className="space-y-1 rounded-lg border border-white/[0.06] bg-black/20 p-2">
              <p className="text-[13px] font-semibold text-white/40">Ombre portée</p>
              <div className="grid grid-cols-2 gap-1">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-white/30">Couleur</span>
                  <input
                    type="color"
                    value={st.shadowColor && st.shadowColor.startsWith('#') ? st.shadowColor : '#000000'}
                    onChange={(e) => updateStyle({ shadowColor: e.target.value })}
                    className="h-7 w-full cursor-pointer rounded border border-white/12 bg-transparent"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-white/30">Flou</span>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={st.shadowBlur || 0}
                    onChange={(e) => updateStyle({ shadowBlur: Number(e.target.value) })}
                    className="h-7 rounded border border-white/12 bg-black/45 px-1.5 text-[12px] text-white"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Couleurs formes ── */}
      {isShape && (
        <div className="px-3 py-2.5">
          <SectionLabel>Apparence</SectionLabel>
          <div className="space-y-2">
            <BlendModeRow
              st={st}
              updateStyle={updateStyle}
              hint="Fusion avec l'arrière-plan et les calques sous cette forme."
            />
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="mb-0.5 block text-[13px] text-white/35">Remplissage</span>
                <input
                  type="color"
                  value={st.fill && st.fill.startsWith('#') ? st.fill : '#333333'}
                  onChange={(e) => updateStyle({ fill: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded-md border border-white/12 bg-transparent"
                />
              </div>
              <div>
                <span className="mb-0.5 block text-[13px] text-white/35">Contour</span>
                <input
                  type="color"
                  value={st.stroke && st.stroke.startsWith('#') ? st.stroke : '#D4AF37'}
                  onChange={(e) => updateStyle({ stroke: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded-md border border-white/12 bg-transparent"
                />
              </div>
            </div>
            <div>
              <span className="mb-0.5 block text-[13px] text-white/35">
                Épaisseur contour — {st.strokeWidth ?? 0}px
              </span>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={st.strokeWidth ?? 0}
                onChange={(e) => updateStyle({ strokeWidth: Number(e.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#D4AF37]"
              />
            </div>
            {selectedObj.type === 'rect' && (
              <div>
                <span className="mb-0.5 block text-[13px] text-white/35">
                  Arrondi coins — {st.cornerRadius ?? 0}px
                </span>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={st.cornerRadius ?? 0}
                  onChange={(e) => updateStyle({ cornerRadius: Number(e.target.value) })}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#D4AF37]"
                />
                <p className="mt-1.5 text-[10px] leading-snug text-white/28">
                  Astuce : barre d'outils du canvas — « Grille 8px » pour un repère type Photoshop ; « Snap 8px » pour magnétiser déplacement et redimensionnement sur la grille.
                </p>
              </div>
            )}
            {selectedObj.type === 'starshape' && (
              <div>
                <span className="mb-0.5 block text-[13px] text-white/35">
                  Branches — {st.numPoints ?? 5}
                </span>
                <input
                  type="range"
                  min={3}
                  max={12}
                  step={1}
                  value={st.numPoints ?? 5}
                  onChange={(e) => updateStyle({ numPoints: Number(e.target.value) })}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#D4AF37]"
                />
              </div>
            )}
            {selectedObj.type === 'line' && (
              <div>
                <span className="mb-0.5 block text-[13px] text-white/35">
                  Épaisseur — {st.strokeWidth ?? 3}px
                </span>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={st.strokeWidth ?? 3}
                  onChange={(e) => updateStyle({ strokeWidth: Number(e.target.value) })}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#D4AF37]"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Icône (glyphe) ── */}
      {isIcon && (
        <div className="px-3 py-2.5">
          <SectionLabel>Icône</SectionLabel>
          <p className="mb-2 text-[10px] leading-snug text-white/35">
            Glisser les poignées dorées sur le canvas pour redimensionner ; rotation et position ci-dessus.
          </p>
          <div className="mb-3">
            <BlendModeRow st={st} updateStyle={updateStyle} />
          </div>
          <label className="mb-2 block">
            <span className="mb-0.5 block text-[13px] text-white/35">Caractère / glyphe</span>
            <input
              type="text"
              maxLength={4}
              value={String(selectedObj.content?.glyph ?? '★')}
              onChange={(e) =>
                updateObject(selectedObj.id, {
                  content: { ...selectedObj.content, glyph: e.target.value.slice(0, 4) || '★' },
                })
              }
              className="h-8 w-full rounded-md border border-white/12 bg-black/45 px-2 text-[14px] text-white"
            />
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="mb-0.5 block text-[13px] text-white/35">Couleur</span>
              <input
                type="color"
                value={st.fill && st.fill.startsWith('#') ? st.fill : '#D4AF37'}
                onChange={(e) => updateStyle({ fill: e.target.value })}
                className="h-8 w-full cursor-pointer rounded-md border border-white/12 bg-transparent"
              />
            </div>
            <div>
              <span className="mb-0.5 block text-[13px] text-white/35">Taille glyphe</span>
              <input
                type="number"
                min={8}
                max={400}
                value={Math.round(Number(st.fontSize ?? Math.min(selectedObj.width, selectedObj.height) * 0.75))}
                onChange={(e) => updateStyle({ fontSize: Number(e.target.value) || 24 })}
                className="h-8 w-full rounded-md border border-white/12 bg-black/45 px-2 text-[12px] text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Image : compositing, étalonnage, effets ── */}
      {isImage && (
        <div className="px-3 py-2.5 space-y-3">
          <SectionLabel>Compositing &amp; étalonnage</SectionLabel>
          <BlendModeRow
            st={st}
            updateStyle={updateStyle}
            hint="Fusion avec les calques du dessous. Combinez avec l'opacité et l'ordre des calques (panneau de gauche)."
          />
          <p className="text-[10px] leading-snug text-violet-300/80">
            Scènes et retouches par langage naturel : panneau <span className="font-semibold text-violet-200">LONGIA</span> à droite (assistant studio, sur le même canvas).
          </p>
          {/* Arrondi */}
          <div>
            <span className="mb-0.5 block text-[13px] text-white/35">Arrondi — {st.cornerRadius ?? 0}px</span>
            <input type="range" min={0} max={80} step={1}
              value={st.cornerRadius ?? 0}
              onChange={(e) => updateStyle({ cornerRadius: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#D4AF37]"
            />
          </div>
          {/* Recadrage source (Konva crop) */}
          <div className="space-y-1.5 rounded-lg border border-white/[0.06] bg-black/20 p-2">
            <p className="text-[12px] font-semibold text-white/45">Recadrage (pixels dans l&apos;image source)</p>
            <p className="text-[10px] leading-snug text-white/30">
              Zone à afficher dans le cadre du canvas. Renseigner les quatre valeurs puis « Appliquer ».
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-white/35">X</span>
                <input ref={cropXRef} type="number" min={0} step={1} className="h-7 rounded border border-white/12 bg-black/45 px-1.5 text-[12px] text-white" />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-white/35">Y</span>
                <input ref={cropYRef} type="number" min={0} step={1} className="h-7 rounded border border-white/12 bg-black/45 px-1.5 text-[12px] text-white" />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-white/35">Largeur</span>
                <input ref={cropWRef} type="number" min={1} step={1} className="h-7 rounded border border-white/12 bg-black/45 px-1.5 text-[12px] text-white" />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-white/35">Hauteur</span>
                <input ref={cropHRef} type="number" min={1} step={1} className="h-7 rounded border border-white/12 bg-black/45 px-1.5 text-[12px] text-white" />
              </label>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const x = Number(cropXRef.current?.value);
                  const y = Number(cropYRef.current?.value);
                  const w = Number(cropWRef.current?.value);
                  const h = Number(cropHRef.current?.value);
                  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
                  updateObject(selectedObj.id, {
                    content: {
                      ...selectedObj.content,
                      crop: {
                        x: Number.isFinite(x) && x >= 0 ? x : 0,
                        y: Number.isFinite(y) && y >= 0 ? y : 0,
                        width: w,
                        height: h,
                      },
                    },
                  });
                }}
                className="flex-1 rounded-lg border border-[#D4AF37]/35 bg-[#D4AF37]/12 py-1.5 text-[11px] font-medium text-[#f5dd8a] hover:bg-[#D4AF37]/20"
              >
                Appliquer recadrage
              </button>
              <button
                type="button"
                onClick={() => {
                  updateObject(selectedObj.id, { content: { ...selectedObj.content, crop: undefined } });
                }}
                className="rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-white/45 hover:bg-white/[0.05]"
              >
                Effacer
              </button>
            </div>
          </div>
          {/* Masque rectangulaire (cadrage visible sur le cadre objet — coords locales) */}
          <div className="space-y-1.5 rounded-lg border border-cyan-500/15 bg-cyan-950/15 p-2">
            <p className="text-[12px] font-semibold text-cyan-200/70">Masque d&apos;écrêtage</p>
            <p className="text-[10px] leading-snug text-white/30">
              Rectangle en pixels dans le repère du cadre image (0,0 = coin haut-gauche du bloc). Laisse vide ou efface pour tout afficher.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-white/35">X</span>
                <input ref={maskXRef} type="number" min={0} step={1} className="h-7 rounded border border-white/12 bg-black/45 px-1.5 text-[12px] text-white" />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-white/35">Y</span>
                <input ref={maskYRef} type="number" min={0} step={1} className="h-7 rounded border border-white/12 bg-black/45 px-1.5 text-[12px] text-white" />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-white/35">Largeur</span>
                <input ref={maskWRef} type="number" min={1} step={1} className="h-7 rounded border border-white/12 bg-black/45 px-1.5 text-[12px] text-white" />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-white/35">Hauteur</span>
                <input ref={maskHRef} type="number" min={1} step={1} className="h-7 rounded border border-white/12 bg-black/45 px-1.5 text-[12px] text-white" />
              </label>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const x = Number(maskXRef.current?.value);
                  const y = Number(maskYRef.current?.value);
                  const w = Number(maskWRef.current?.value);
                  const h = Number(maskHRef.current?.value);
                  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
                  updateStyle({
                    mask: {
                      x: Number.isFinite(x) && x >= 0 ? x : 0,
                      y: Number.isFinite(y) && y >= 0 ? y : 0,
                      width: w,
                      height: h,
                    },
                  });
                }}
                className="flex-1 rounded-lg border border-cyan-500/35 bg-cyan-900/25 py-1.5 text-[11px] font-medium text-cyan-100 hover:bg-cyan-900/40"
              >
                Appliquer masque
              </button>
              <button
                type="button"
                onClick={() => updateStyle({ mask: undefined })}
                className="rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-white/45 hover:bg-white/[0.05]"
              >
                Effacer masque
              </button>
            </div>
          </div>
          {/* Flou (hors étalonnage couleur pur) */}
          <div>
            <span className="mb-0.5 block text-[13px] text-white/35">Flou — {st.blurRadius ?? 0}px</span>
            <input type="range" min={0} max={40} step={1}
              value={st.blurRadius ?? 0}
              onChange={(e) => updateStyle({ blurRadius: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-blue-400"
            />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37]/60">Étalonnage colorimétrique</p>
          {/* Luminosite */}
          <div>
            <span className="mb-0.5 block text-[13px] text-white/35">Luminosite — {st.brightness ?? 0}</span>
            <input type="range" min={-1} max={1} step={0.05}
              value={st.brightness ?? 0}
              onChange={(e) => updateStyle({ brightness: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-yellow-400"
            />
          </div>
          {/* Contraste */}
          <div>
            <span className="mb-0.5 block text-[13px] text-white/35">Contraste — {st.contrast ?? 0}</span>
            <input type="range" min={-100} max={100} step={5}
              value={st.contrast ?? 0}
              onChange={(e) => updateStyle({ contrast: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-orange-400"
            />
          </div>
          {/* Saturation */}
          <div>
            <span className="mb-0.5 block text-[13px] text-white/35">Saturation — {st.saturation ?? 0}</span>
            <input type="range" min={-2} max={4} step={0.1}
              value={st.saturation ?? 0}
              onChange={(e) => updateStyle({ saturation: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-green-400"
            />
          </div>
          {/* Teinte HSL */}
          <div>
            <span className="mb-0.5 block text-[13px] text-white/35">Teinte (HSL) — {st.hue ?? 0}°</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={st.hue ?? 0}
              onChange={(e) => updateStyle({ hue: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-fuchsia-400"
            />
          </div>
          {/* Shadow image */}
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="mb-0.5 block text-[13px] text-white/35">Ombre couleur</span>
              <input type="color"
                value={st.shadowColor && st.shadowColor.startsWith('#') ? st.shadowColor : '#000000'}
                onChange={(e) => updateStyle({ shadowColor: e.target.value })}
                className="h-7 w-full cursor-pointer rounded border border-white/10 bg-transparent"
              />
            </div>
            <div className="flex-1">
              <span className="mb-0.5 block text-[13px] text-white/35">Flou ombre — {st.shadowBlur ?? 0}</span>
              <input type="range" min={0} max={40} step={1}
                value={st.shadowBlur ?? 0}
                onChange={(e) => updateStyle({ shadowBlur: Number(e.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-purple-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="mb-0.5 block text-[13px] text-white/35">Ombre décalage X — {st.shadowOffsetX ?? 0}</span>
              <input
                type="range"
                min={-40}
                max={40}
                step={1}
                value={st.shadowOffsetX ?? 0}
                onChange={(e) => updateStyle({ shadowOffsetX: Number(e.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#D4AF37]/80"
              />
            </div>
            <div>
              <span className="mb-0.5 block text-[13px] text-white/35">Ombre décalage Y — {st.shadowOffsetY ?? 0}</span>
              <input
                type="range"
                min={-40}
                max={40}
                step={1}
                value={st.shadowOffsetY ?? 0}
                onChange={(e) => updateStyle({ shadowOffsetY: Number(e.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#D4AF37]/80"
              />
            </div>
          </div>
          {/* Reset effets */}
          <button
            type="button"
            onClick={() =>
              updateObject(selectedObj.id, {
                style: {
                  ...st,
                  blurRadius: 0,
                  brightness: 0,
                  contrast: 0,
                  saturation: 0,
                  hue: 0,
                  globalCompositeOperation: 'source-over',
                  mask: undefined,
                  shadowBlur: 0,
                  shadowOffsetX: 0,
                  shadowOffsetY: 0,
                },
                content: { ...selectedObj.content, crop: undefined },
              })
            }
            className="w-full rounded-lg border border-white/10 py-1 text-[13px] text-white/40 hover:bg-white/[0.05]"
          >
            Reinitialiser les effets (fusion + filtres + ombre + crop + masque)
          </button>
        </div>
      )}

      {/* ── Tableau LIRI Sheet ── */}
      {isTable && (
        <div className="px-3 py-2.5 space-y-2">
          <SectionLabel>Tableau</SectionLabel>
          {/* Edition des cellules */}
          <div className="max-h-52 overflow-y-auto [scrollbar-width:thin]">
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                {(selectedObj.content?.data || []).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="p-0.5">
                        <input
                          type="text"
                          value={String(cell ?? '')}
                          onChange={(e) => {
                            const newData = (selectedObj.content?.data || []).map((r, rr) =>
                              r.map((c, cc) => (rr === ri && cc === ci ? e.target.value : c))
                            );
                            updateObject(selectedObj.id, { content: { ...selectedObj.content, data: newData } });
                          }}
                          className={cn(
                            'w-full rounded border px-1 py-0.5 text-[13px] outline-none focus:border-[#D4AF37]/50',
                            ri === 0 && st.headerRow !== false
                              ? 'border-[#D4AF37]/30 bg-[#1a1f35] text-[#f5dd8a]'
                              : 'border-white/10 bg-black/40 text-white/80',
                          )}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Ajouter / supprimer lignes et colonnes */}
          <div className="flex flex-wrap gap-1">
            <button type="button"
              onClick={() => {
                const d = selectedObj.content?.data || [];
                const cols = d[0]?.length || 2;
                updateObject(selectedObj.id, { content: { ...selectedObj.content, data: [...d, Array(cols).fill('')] } });
              }}
              className="rounded-lg border border-white/10 px-2 py-1 text-[13px] text-white/50 hover:bg-white/[0.06]">
              + Ligne
            </button>
            <button type="button"
              onClick={() => {
                const d = selectedObj.content?.data || [];
                if (d.length <= 1) return;
                updateObject(selectedObj.id, { content: { ...selectedObj.content, data: d.slice(0, -1) } });
              }}
              className="rounded-lg border border-white/10 px-2 py-1 text-[13px] text-white/50 hover:bg-white/[0.06]">
              - Ligne
            </button>
            <button type="button"
              onClick={() => {
                const d = (selectedObj.content?.data || []).map((r) => [...r, '']);
                updateObject(selectedObj.id, { content: { ...selectedObj.content, data: d } });
              }}
              className="rounded-lg border border-white/10 px-2 py-1 text-[13px] text-white/50 hover:bg-white/[0.06]">
              + Col
            </button>
            <button type="button"
              onClick={() => {
                const d = (selectedObj.content?.data || []).map((r) => r.length > 1 ? r.slice(0, -1) : r);
                updateObject(selectedObj.id, { content: { ...selectedObj.content, data: d } });
              }}
              className="rounded-lg border border-white/10 px-2 py-1 text-[13px] text-white/50 hover:bg-white/[0.06]">
              - Col
            </button>
          </div>
          {/* Style */}
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="mb-0.5 block text-[13px] text-white/35">Taille police</span>
              <input type="number" min={8} max={28} value={st.fontSize || 14}
                onChange={(e) => updateStyle({ fontSize: Number(e.target.value) || 14 })}
                className="h-7 w-full rounded-lg border border-white/10 bg-black/40 px-2 text-[13px] text-white"
              />
            </div>
            <div className="flex-1">
              <span className="mb-0.5 block text-[13px] text-white/35">Couleur en-tete</span>
              <input type="color"
                value={st.headerFill && st.headerFill.startsWith('#') ? st.headerFill : '#f5dd8a'}
                onChange={(e) => updateStyle({ headerFill: e.target.value })}
                className="h-7 w-full cursor-pointer rounded border border-white/10 bg-transparent"
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/60">
            <input type="checkbox"
              checked={st.headerRow !== false}
              onChange={(e) => updateStyle({ headerRow: e.target.checked })}
              className="rounded border-white/20 bg-black/40"
            />
            Premiere ligne = en-tete
          </label>
        </div>
      )}

      {/* ── Fleche : controles specifiques ── */}
      {selectedObj.type === 'arrow' && (
        <div className="px-3 py-2.5 space-y-2">
          <SectionLabel>Fleche</SectionLabel>
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="mb-0.5 block text-[13px] text-white/35">Couleur</span>
              <input type="color"
                value={st.stroke && st.stroke.startsWith('#') ? st.stroke : '#D4AF37'}
                onChange={(e) => updateStyle({ stroke: e.target.value, fill: e.target.value })}
                className="h-7 w-full cursor-pointer rounded border border-white/10 bg-transparent"
              />
            </div>
            <div className="flex-1">
              <span className="mb-0.5 block text-[13px] text-white/35">Epaisseur — {st.strokeWidth ?? 3}px</span>
              <input type="range" min={1} max={20} step={1}
                value={st.strokeWidth ?? 3}
                onChange={(e) => updateStyle({ strokeWidth: Number(e.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#D4AF37]"
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/60">
            <input type="checkbox"
              checked={!!st.doubleArrow}
              onChange={(e) => updateStyle({ doubleArrow: e.target.checked })}
              className="rounded border-white/20 bg-black/40"
            />
            Double fleche
          </label>
          <div>
            <span className="mb-0.5 block text-[13px] text-white/35">Taille pointe — {st.pointerLength ?? 14}px</span>
            <input type="range" min={4} max={40} step={1}
              value={st.pointerLength ?? 14}
              onChange={(e) => updateStyle({ pointerLength: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-orange-400"
            />
          </div>
        </div>
      )}

      {/* ── Actions rapides ── */}
      <div className="px-3 py-2.5">
        <SectionLabel>Actions</SectionLabel>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={deleteSelected}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 py-2 text-[12px] text-red-300 hover:bg-red-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
        </div>
      </div>

      {/* ── Export PNG ── */}
      <div className="px-3 py-2.5">
        <SectionLabel>Export</SectionLabel>
        <button
          type="button"
          onClick={onExportPng}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/12 py-2.5 text-[12px] font-medium text-[#f5dd8a] hover:bg-[#D4AF37]/20"
        >
          <Download className="h-3.5 w-3.5" />
          Exporter slide PNG
        </button>
      </div>

      {/* ── Pédagogie ── */}
      <div className="px-3 py-2.5">
        <SectionLabel>Pédagogie</SectionLabel>
        <div className="space-y-1.5">
          <label className="block text-[13px] text-white/45">
            Visible pour
            <select
              value={selectedObj.visibleFor || 'both'}
              onChange={(e) => updateObject(selectedObj.id, { visibleFor: e.target.value })}
              className="mt-0.5 h-7 w-full rounded-md border border-white/12 bg-black/45 px-1.5 text-[12px] text-white"
            >
              <option value="both">Les deux</option>
              <option value="student">Élève seulement</option>
              <option value="teacher">Professeur seulement</option>
            </select>
          </label>
          <label className="block text-[13px] text-white/45">
            Étape d&apos;apparition
            <input
              type="number"
              min={0}
              value={selectedObj.step ?? 0}
              onChange={(e) => updateObject(selectedObj.id, { step: Number(e.target.value) || 0 })}
              className="mt-0.5 h-7 w-full rounded-md border border-white/12 bg-black/45 px-1.5 text-[12px] text-white"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
