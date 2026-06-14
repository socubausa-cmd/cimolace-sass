/**
 * SmartboardEditorPanel — Panneau d'édition style Canva pour le SmartBoard.
 * Fournit une bibliothèque de fonds, typographies, icônes, éléments décoratifs
 * et templates complets pour personnaliser chaque slide manuellement.
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, ChevronDown, ChevronUp, Check, Sparkles } from 'lucide-react';
import {
  SB_BACKGROUNDS,
  SB_COLOR_PALETTES,
  SB_TYPO_PRESETS,
  SB_ICON_LIBRARY,
  SB_DECORATORS,
  SB_SLIDE_TEMPLATES,
  SB_LAYOUT_PRESETS,
  SB_EDITOR_TABS,
} from '@/config/smartboardEditorTools';

const isLiriPedagogyTemplate = (tpl) => typeof tpl?.id === 'string' && tpl.id.startsWith('tpl_liri_');
import { DEFAULT_SMARTBOARD_EDGE_FEATHER } from '@/lib/smartboardImmersiveMask';

// ─── Tab button ───────────────────────────────────────────────────────────────
function TabBtn({ tab, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-[10px] font-semibold transition-colors flex-shrink-0 min-w-[52px] ${
        active ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className="text-sm leading-none">{tab.icon}</span>
      <span className="leading-tight">{tab.label}</span>
    </button>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHead({ label, count }) {
  return (
    <p className="text-[9px] uppercase tracking-[0.22em] text-gray-500 font-bold mb-2 flex items-center justify-between">
      {label}
      {count != null && <span className="text-gray-600">{count}</span>}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SmartboardEditorPanel({
  /** slide state */
  title, points, bg, accentColor, bulletStyle, layout,
  progressiveEnabled = false,
  progressiveCoreIdea = '',
  progressiveSteps = [],
  /** callbacks */
  onTitleChange, onPointsChange, onBgChange,
  onAccentColorChange, onBulletStyleChange, onLayoutChange,
  onProgressiveEnabledChange,
  onProgressiveCoreIdeaChange,
  onProgressiveStepsChange,
  onAddDecorator, onAddIcon, onApplyTemplate,
  /** 0–100 : adoucir les bords (fondu dans l'écran intelligent), style Photoshop */
  edgeFeatherPercent = DEFAULT_SMARTBOARD_EDGE_FEATHER,
  onEdgeFeatherChange,
  onSave, onClose,
}) {
  const [activeTab, setActiveTab] = useState('templates');
  const [expandedIconCat, setExpandedIconCat] = useState('education');
  const [expandedDecCat, setExpandedDecCat] = useState('bullet');
  const [copiedColor, setCopiedColor] = useState(null);

  const copyColor = useCallback((c) => {
    navigator.clipboard?.writeText(c).catch(() => {});
    setCopiedColor(c);
    setTimeout(() => setCopiedColor(null), 1200);
  }, []);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0a1120] to-[#070d18] border-l border-white/10 w-[300px] flex-shrink-0 shadow-[-16px_0_45px_rgba(0,0,0,0.35)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span className="text-xs font-bold text-white">Éditeur SmartBoard</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-600/80 hover:bg-emerald-500 text-white transition-colors"
          >
            <Check className="w-3 h-3" /> Valider
          </button>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto gap-1 px-2 py-2 border-b border-white/10 no-scrollbar bg-black/10">
        {SB_EDITOR_TABS.map((tab) => (
          <TabBtn key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* ═══════════════════ TEMPLATES ═══════════════════ */}
        {activeTab === 'templates' && (
          <div className="space-y-5">
            {(() => {
              const liri = SB_SLIDE_TEMPLATES.filter(isLiriPedagogyTemplate);
              const general = SB_SLIDE_TEMPLATES.filter((t) => !isLiriPedagogyTemplate(t));
              const card = (tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onApplyTemplate?.(tpl)}
                  className="group relative rounded-xl overflow-hidden border border-white/10 hover:border-[#D4AF37]/60 transition-all text-left"
                >
                  <div
                    className="h-16 w-full flex items-center justify-center"
                    style={{ background: tpl.preview.bg }}
                  >
                    <span className="text-xs font-bold" style={{ color: tpl.preview.accent }}>Aa</span>
                  </div>
                  <div className="p-2 bg-[#0d1525]">
                    <p className="text-[10px] font-semibold text-white leading-tight truncate">{tpl.label}</p>
                    <p className="text-[9px] text-gray-500 leading-tight truncate">{tpl.description}</p>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <span className="text-[10px] font-bold text-white bg-[#D4AF37] rounded-full px-2 py-0.5">Appliquer</span>
                  </div>
                </button>
              );
              return (
                <>
                  <div className="space-y-3">
                    <SectionHead label="Méthode LIRI (Prorascience)" count={liri.length} />
                    <p className="text-[9px] text-gray-500 leading-snug -mt-1">
                      Modèles issus de l'éditeur LIRI SmartBoard : structure de slide + texte prêt à adapter.
                    </p>
                    <div className="grid grid-cols-2 gap-2">{liri.map(card)}</div>
                  </div>
                  <div className="space-y-3 pt-1 border-t border-white/10">
                    <SectionHead label="Styles SmartBoard" count={general.length} />
                    <div className="grid grid-cols-2 gap-2">{general.map(card)}</div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ═══════════════════ FONDS ═══════════════════════ */}
        {activeTab === 'backgrounds' && (
          <div className="space-y-4">
            {['gradient', 'light', 'solid'].map((cat) => {
              const items = SB_BACKGROUNDS.filter((b) => b.category === cat);
              const catLabel = { gradient: 'Dégradés sombres', light: 'Tons clairs', solid: 'Couleurs pleines' }[cat];
              return (
                <div key={cat}>
                  <SectionHead label={catLabel} count={items.length} />
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((bg_) => (
                      <button
                        key={bg_.id}
                        type="button"
                        onClick={() => onBgChange?.(bg_.css)}
                        className={`relative h-12 rounded-lg border-2 transition-all hover:scale-105 ${bg === bg_.css ? 'border-[#D4AF37]' : 'border-white/10 hover:border-white/30'}`}
                        style={{ background: bg_.css }}
                        title={bg_.label}
                      >
                        {bg === bg_.css && (
                          <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-[#D4AF37] flex items-center justify-center">
                            <Check className="w-2 h-2 text-black" />
                          </span>
                        )}
                        <span className="sr-only">{bg_.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════════ TYPOGRAPHIE ════════════════ */}
        {activeTab === 'typography' && (
          <div className="space-y-4">
            <SectionHead label="Préréglages typographiques" />
            <div className="space-y-2">
              {SB_TYPO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {/* future: apply typo to selected text block */}}
                  className="w-full text-left rounded-xl border border-white/8 bg-[#0d1525] p-3 hover:border-[#D4AF37]/40 transition-colors group"
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span style={preset.previewStyle} className="text-white">{preset.preview}</span>
                    <span className="text-[9px] text-gray-500 group-hover:text-[#D4AF37] transition-colors">{preset.label}</span>
                  </div>
                  <p className="text-[9px] text-gray-600">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════ ICÔNES ══════════════════════ */}
        {activeTab === 'icons' && (
          <div className="space-y-3">
            <SectionHead label="Bibliothèque d'icônes" />
            {Object.entries(SB_ICON_LIBRARY).map(([catKey, cat]) => (
              <div key={catKey} className="rounded-xl border border-white/8 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedIconCat(expandedIconCat === catKey ? null : catKey)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#0d1525] text-left hover:bg-[#101a2e] transition-colors"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold text-white">
                    <span>{cat.icon}</span> {cat.label}
                  </span>
                  {expandedIconCat === catKey ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                </button>
                <AnimatePresence>
                  {expandedIconCat === catKey && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-8 gap-1 p-2 bg-[#080e1c]">
                        {cat.items.map((icon, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => onAddIcon?.(icon)}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-sm hover:bg-[#D4AF37]/20 transition-colors"
                            title={`Ajouter ${icon}`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════ COULEURS ════════════════════ */}
        {activeTab === 'colors' && (
          <div className="space-y-4">
            <SectionHead label="Palettes de couleurs" />
            {SB_COLOR_PALETTES.map((palette) => (
              <div key={palette.id}>
                <p className="text-[10px] text-gray-500 mb-1.5">{palette.label}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {palette.colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        onAccentColorChange?.(color);
                        copyColor(color);
                      }}
                      className="group relative w-9 h-9 rounded-lg border-2 transition-all hover:scale-110"
                      style={{
                        background: color,
                        borderColor: accentColor === color ? '#ffffff' : 'transparent',
                      }}
                      title={color}
                    >
                      {copiedColor === color && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md text-[8px] text-white font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {/* Couleur personnalisée */}
            <div>
              <p className="text-[10px] text-gray-500 mb-1.5">Couleur personnalisée</p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  defaultValue={accentColor || '#D4AF37'}
                  onChange={(e) => onAccentColorChange?.(e.target.value)}
                  className="w-9 h-9 rounded-lg border-2 border-white/15 cursor-pointer bg-transparent"
                />
                <span className="text-[10px] text-gray-400 font-mono">{accentColor || '#D4AF37'}</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ ÉLÉMENTS DÉCORATIFS ═════════ */}
        {activeTab === 'elements' && (
          <div className="space-y-3">
            <SectionHead label="Éléments décoratifs" />
            {['bullet', 'divider', 'frame'].map((cat) => {
              const items = SB_DECORATORS.filter((d) => d.category === cat);
              const catLabel = { bullet: 'Puces personnalisées', divider: 'Séparateurs', frame: 'Encadrements' }[cat];
              return (
                <div key={cat} className="rounded-xl border border-white/8 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedDecCat(expandedDecCat === cat ? null : cat)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-[#0d1525] text-left hover:bg-[#101a2e] transition-colors"
                  >
                    <span className="text-xs font-semibold text-white">{catLabel}</span>
                    {expandedDecCat === cat ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                  </button>
                  <AnimatePresence>
                    {expandedDecCat === cat && (
                      <motion.div
                        initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-2 space-y-1 bg-[#080e1c]">
                          {items.map((dec) => (
                            <button
                              key={dec.id}
                              type="button"
                              onClick={() => {
                                if (cat === 'bullet') onBulletStyleChange?.(dec.element);
                                else onAddDecorator?.(dec);
                              }}
                              className={`w-full text-left flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors border ${
                                bulletStyle === dec.element
                                  ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#D4AF37]'
                                  : 'border-white/5 bg-white/2 text-gray-300 hover:border-white/20 hover:bg-white/5'
                              }`}
                            >
                              <span className="font-medium">{dec.label}</span>
                              <span className="font-mono opacity-70 truncate max-w-[80px]">{dec.element}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════════ IMMERSIF (fondu bords) ════════════════ */}
        {activeTab === 'immersive' && (
          <div className="space-y-4">
            <SectionHead label="Fusion avec l'écran intelligent" />
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Adoucit les bords du contenu pour le fondre dans le fond de la coque (masque radial), comme un flou de contour
              dans Photoshop. Pour un rendu optimal, importez des visuels PNG ou WebP avec transparence
              (export « sans fond » depuis Photoshop, Figma, etc.).
            </p>
            <div className="rounded-xl border border-white/10 bg-[#0d1525] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="sb-edge-feather" className="text-[10px] font-semibold text-gray-300">
                  Intensité du fondu des bords
                </label>
                <span className="text-[10px] tabular-nums text-[#D4AF37] font-mono">{edgeFeatherPercent}%</span>
              </div>
              <input
                id="sb-edge-feather"
                type="range"
                min={0}
                max={100}
                step={1}
                value={edgeFeatherPercent}
                onChange={(e) => onEdgeFeatherChange?.(Number(e.target.value))}
                className="w-full h-1.5 accent-[#D4AF37] cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-gray-600">
                <span>0 — bords nets</span>
                <span>100 — fondu fort</span>
              </div>
              <button
                type="button"
                onClick={() => onEdgeFeatherChange?.(DEFAULT_SMARTBOARD_EDGE_FEATHER)}
                className="w-full mt-1 text-[10px] py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/35 transition-colors"
              >
                Réinitialiser au réglage LIRI par défaut ({DEFAULT_SMARTBOARD_EDGE_FEATHER}%)
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════ MISE EN PAGE ════════════════ */}
        {activeTab === 'layout' && (
          <div className="space-y-4">
            <SectionHead label="Disposition du slide" />
            <div className="space-y-2">
              {SB_LAYOUT_PRESETS.map((lp) => (
                <button
                  key={lp.id}
                  type="button"
                  onClick={() => onLayoutChange?.(lp.id.replace('layout_', ''))}
                  className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    layout === lp.id.replace('layout_', '')
                      ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#D4AF37]'
                      : 'border-white/8 bg-[#0d1525] text-gray-300 hover:border-white/25'
                  }`}
                >
                  <span className="text-xl w-7 text-center flex-shrink-0">{lp.icon}</span>
                  <div>
                    <p className="text-xs font-semibold">{lp.label}</p>
                    <p className="text-[9px] text-gray-500 mt-0.5">{lp.description}</p>
                  </div>
                  {layout === lp.id.replace('layout_', '') && <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>

            {/* Contenu du slide — édition directe */}
            <div className="space-y-3 pt-2 border-t border-white/8">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Contenu du slide</p>
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">Titre</label>
                <input
                  value={title}
                  onChange={(e) => onTitleChange?.(e.target.value)}
                  className="w-full bg-[#0d1525] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]/50 transition-colors"
                  placeholder="Titre du chapitre"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 block">Points ({points?.length || 0})</label>
                {(points || []).map((pt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs opacity-40 w-4 flex-shrink-0">{i + 1}</span>
                    <input
                      value={pt}
                      onChange={(e) => {
                        const next = [...(points || [])];
                        next[i] = e.target.value;
                        onPointsChange?.(next);
                      }}
                      className="flex-1 bg-[#0d1525] border border-white/8 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-[#D4AF37]/40 transition-colors"
                      placeholder={`Point ${i + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => onPointsChange?.((points || []).filter((_, idx) => idx !== i))}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onPointsChange?.([...(points || []), ''])}
                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#D4AF37] transition-colors mt-1"
                >
                  <Plus className="w-3 h-3" /> Ajouter un point
                </button>
              </div>

              {/* Progressive Build Canvas */}
              <div className="space-y-2 pt-2 border-t border-white/8">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">
                    Progressive Build Canvas
                  </p>
                  <button
                    type="button"
                    onClick={() => onProgressiveEnabledChange?.(!progressiveEnabled)}
                    className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                      progressiveEnabled
                        ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    {progressiveEnabled ? 'Actif' : 'Activer'}
                  </button>
                </div>

                {progressiveEnabled && (
                  <>
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">Idée centrale</label>
                      <input
                        value={progressiveCoreIdea}
                        onChange={(e) => onProgressiveCoreIdeaChange?.(e.target.value)}
                        className="w-full bg-[#0d1525] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-400/45 transition-colors"
                        placeholder="Ex: Comprendre les fondations avant la pratique"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-400 block">
                        Étapes progressives ({(progressiveSteps || []).length})
                      </label>
                      {(progressiveSteps || []).map((st, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs opacity-40 w-4 flex-shrink-0">{i + 1}</span>
                          <input
                            value={st}
                            onChange={(e) => {
                              const next = [...(progressiveSteps || [])];
                              next[i] = e.target.value;
                              onProgressiveStepsChange?.(next);
                            }}
                            className="flex-1 bg-[#0d1525] border border-white/8 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-400/40 transition-colors"
                            placeholder={`Étape ${i + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => onProgressiveStepsChange?.((progressiveSteps || []).filter((_, idx) => idx !== i))}
                            className="text-gray-600 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => onProgressiveStepsChange?.([...(progressiveSteps || []), ''])}
                        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-indigo-300 transition-colors mt-1"
                      >
                        <Plus className="w-3 h-3" /> Ajouter une étape
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
