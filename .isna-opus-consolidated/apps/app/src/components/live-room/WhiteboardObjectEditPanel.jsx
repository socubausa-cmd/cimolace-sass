/**
 * Panneau d'édition d'un objet scolaire sélectionné (double-clic).
 * Affiche les champs pertinents selon le `kind` du trait, applique un patch.
 */
import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  designerShellMicroLabel,
  designerShellChipGhost,
} from '@/lib/liriDesignerShellClasses';

/* ── Labels lisibles ─────────────────────────────────────────────────────── */
const KIND_LABELS = {
  'function-plot': 'Courbe f(x)',
  'value-table': 'Tableau de valeurs',
  'histogram': 'Histogramme',
  'pie-chart': 'Diagramme circulaire',
  'scatter-plot': 'Nuage de points',
  'variation-table': 'Tableau de variations',
  'sign-table': 'Tableau de signes',
  'segment': 'Segment / Droite',
  'vector': 'Vecteur',
  'axes': 'Repère (axes)',
  'numberline': 'Droite graduée',
  'latex': 'Formule LaTeX',
  'prob-tree': 'Arbre de probabilités',
  'electric-component': 'Composant électrique',
  'fraction': 'Fraction visuelle',
  'curtain': 'Rideau',
  'measure': 'Mesure de distance',
  'table': 'Tableau / grille',
  'arrow': 'Flèche',
  'polygon': 'Polygone régulier',
  'star': 'Étoile',
  'protractor': 'Rapporteur',
  'ruler': 'Règle graduée',
  'coord-point': 'Point A(x;y)',
};

/* ── Helpers d'initialisation et de patch ────────────────────────────────── */
function initState(stroke) {
  const k = stroke.kind;
  if (k === 'function-plot') return { expr: stroke.expr || 'x', xMin: stroke.xMin ?? -5, xMax: stroke.xMax ?? 5, scaleX: stroke.scaleX ?? 50 };
  if (k === 'value-table') return { expr: stroke.expr || 'x', xMin: stroke.xMin ?? -3, xMax: stroke.xMax ?? 3, xStep: stroke.xStep ?? 1 };
  if (k === 'histogram') return { title: stroke.title || '', labels: (stroke.labels || []).join(', '), values: (stroke.values || []).join(', ') };
  if (k === 'pie-chart') return { title: stroke.title || '', labels: (stroke.labels || []).join(', '), values: (stroke.values || []).join(', ') };
  if (k === 'scatter-plot') return { title: stroke.title || '', data: (stroke.data || []).map((p) => `${p.x},${p.y}${p.label ? ',' + p.label : ''}`).join('; '), connectDots: stroke.connectDots || false };
  if (k === 'variation-table') return {
    functionName: stroke.functionName || 'f',
    xValues: (stroke.xValues || []).join(', '),
    derivSigns: (stroke.derivSigns || []).join(', '),
    critFValues: (stroke.critFValues || []).join(', '),
    increasing: (stroke.increasing || []).join(', '),
    boundaryFValues: (stroke.boundaryFValues || []).join(', '),
  };
  if (k === 'sign-table') return {
    xValues: (stroke.xValues || []).join(', '),
    signRows: (stroke.rows || []).map((r) => `${r.label}: ${(r.signs || []).join(', ')}`).join('\n'),
  };
  if (k === 'segment') return { labelA: stroke.labelA || '', labelB: stroke.labelB || '', style: stroke.style || 'segment', showLength: stroke.showLength || false, tickCount: stroke.tickCount || 0 };
  if (k === 'vector') return { label: stroke.label || '' };
  if (k === 'axes') return { size: stroke.size || 150, tickStep: stroke.tickStep || 30, showLabels: stroke.showLabels !== false };
  if (k === 'numberline') return { min: stroke.min ?? 0, max: stroke.max ?? 10, step: stroke.step ?? 1, unit: stroke.unit || '', showLabels: stroke.showLabels !== false };
  if (k === 'latex') return { formula: stroke.formula || '', fontSize: stroke.fontSize || 24, displayMode: stroke.displayMode || false };
  if (k === 'prob-tree') return {
    l1: (stroke.l1 || []).map((b) => `${b.label}:${b.p}`).join(', '),
    l2_0: ((stroke.l2 || [])[0] || []).map((b) => `${b.label}:${b.p}`).join(', '),
    l2_1: ((stroke.l2 || [])[1] || []).map((b) => `${b.label}:${b.p}`).join(', '),
    l2_2: ((stroke.l2 || [])[2] || []).map((b) => `${b.label}:${b.p}`).join(', '),
    showProducts: stroke.showProducts !== false,
  };
  if (k === 'electric-component') return { component: stroke.component || 'resistor', label: stroke.label || '', size: stroke.size || 50, angleDeg: Math.round((stroke.angle || 0) * 180 / Math.PI) };
  if (k === 'fraction') return { numerator: stroke.numerator ?? 1, denominator: stroke.denominator ?? 4, style: stroke.style || 'bar', cellSize: stroke.cellSize || 32 };
  if (k === 'curtain') return { opacity: stroke.opacity ?? 0.97, label: stroke.label || '' };
  if (k === 'measure') return { label: stroke.label || '' };
  if (k === 'table') return { cols: stroke.cols || 3, rows: stroke.rows || 3 };
  if (k === 'coord-point') return { label: stroke.label || 'A', fontSize: stroke.fontSize || 14 };
  if (k === 'polygon') return { sides: stroke.sides || 6 };
  if (k === 'star') return { points: stroke.points || 5 };
  if (k === 'arrow') return { doubleArrow: stroke.doubleArrow || false };
  if (k === 'protractor') return { r: stroke.r || 80 };
  if (k === 'ruler') return { length: stroke.length || 240, divisions: stroke.divisions || 10 };
  return {};
}

function parseBranches(str) {
  return (str || '').split(',').map((item) => {
    const parts = item.trim().split(':');
    return { label: (parts[0] || '').trim(), p: (parts[1] || '').trim() };
  }).filter((b) => b.label);
}

function buildPatch(kind, state) {
  if (kind === 'function-plot') return { expr: state.expr, xMin: Number(state.xMin), xMax: Number(state.xMax), scaleX: Number(state.scaleX), scaleY: Number(state.scaleX) };
  if (kind === 'value-table') return { expr: state.expr, xMin: Number(state.xMin), xMax: Number(state.xMax), xStep: Math.max(0.01, Number(state.xStep)) };
  if (kind === 'histogram' || kind === 'pie-chart') {
    const rawLabels = state.labels.split(',').map((v) => v.trim()).filter(Boolean);
    const rawValues = state.values.split(',').map((v) => Number(v.trim())).filter((n) => !isNaN(n));
    const n = Math.max(rawLabels.length, rawValues.length);
    return {
      title: state.title,
      labels: Array.from({ length: n }, (_, i) => rawLabels[i] ?? ''),
      values: Array.from({ length: n }, (_, i) => rawValues[i] ?? 0),
    };
  }
  if (kind === 'scatter-plot') {
    const data = state.data.split(';').map((pair) => {
      const parts = pair.trim().split(',');
      const xv = parseFloat(parts[0]); const yv = parseFloat(parts[1]);
      return isFinite(xv) && isFinite(yv) ? { x: xv, y: yv, label: parts[2]?.trim() || '' } : null;
    }).filter(Boolean);
    return { title: state.title, data, connectDots: state.connectDots };
  }
  if (kind === 'variation-table') {
    const parseArr = (s) => (s || '').split(',').map((v) => v.trim());
    const parseBool = (s) => parseArr(s).map((v) => v.toLowerCase() !== 'false');
    return {
      functionName: state.functionName,
      xValues: parseArr(state.xValues),
      derivSigns: parseArr(state.derivSigns),
      critFValues: parseArr(state.critFValues),
      increasing: parseBool(state.increasing),
      boundaryFValues: parseArr(state.boundaryFValues),
    };
  }
  if (kind === 'sign-table') {
    const xValues = state.xValues.split(',').map((v) => v.trim());
    const rows = state.signRows.split('\n').map((line) => {
      const colonIdx = line.indexOf(':'); if (colonIdx < 0) return null;
      const label = line.slice(0, colonIdx).trim();
      const signs = line.slice(colonIdx + 1).split(',').map((v) => v.trim());
      return { label, signs, isFinal: label.toLowerCase().includes('produit') || label.toLowerCase().includes('quotient') };
    }).filter(Boolean);
    return { xValues, rows };
  }
  if (kind === 'segment') return { labelA: state.labelA, labelB: state.labelB, style: state.style, showLength: state.showLength, tickCount: Number(state.tickCount) };
  if (kind === 'vector') return { label: state.label };
  if (kind === 'axes') return { size: Number(state.size), tickStep: Number(state.tickStep), showLabels: state.showLabels };
  if (kind === 'numberline') return { min: Number(state.min), max: Number(state.max), step: Math.max(0.01, Number(state.step)), unit: state.unit, showLabels: state.showLabels };
  if (kind === 'latex') return { formula: state.formula, fontSize: Number(state.fontSize), displayMode: state.displayMode };
  if (kind === 'prob-tree') {
    const l1 = parseBranches(state.l1);
    const l2 = [parseBranches(state.l2_0), parseBranches(state.l2_1), parseBranches(state.l2_2)].filter((sub) => sub.length > 0);
    return { l1, l2, showProducts: state.showProducts };
  }
  if (kind === 'electric-component') return { component: state.component, label: state.label, size: Number(state.size), angle: Number(state.angleDeg) * Math.PI / 180 };
  if (kind === 'fraction') return { numerator: Math.max(0, Number(state.numerator)), denominator: Math.max(1, Number(state.denominator)), style: state.style, cellSize: Number(state.cellSize) };
  if (kind === 'curtain') return { opacity: Math.max(0.05, Math.min(1, Number(state.opacity))), label: state.label };
  if (kind === 'measure') return { label: state.label };
  if (kind === 'table') return { cols: Math.max(1, Number(state.cols)), rows: Math.max(1, Number(state.rows)) };
  if (kind === 'coord-point') return { label: state.label, fontSize: Number(state.fontSize) };
  if (kind === 'polygon') return { sides: Math.max(3, Math.min(12, Number(state.sides))) };
  if (kind === 'star') return { points: Math.max(3, Math.min(12, Number(state.points))) };
  if (kind === 'arrow') return { doubleArrow: state.doubleArrow };
  if (kind === 'protractor') return { r: Math.max(20, Number(state.r)) };
  if (kind === 'ruler') return { length: Math.max(30, Number(state.length)), divisions: Math.max(1, Number(state.divisions)) };
  return {};
}

/* ── Composant de champ générique ────────────────────────────────────────── */
function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className={designerShellMicroLabel}>{label}</span>
      {children}
    </label>
  );
}

const INPUT_CLS = 'w-full rounded-xl bg-white/[0.05] border border-white/10 text-white text-[11px] px-3 py-2 outline-none focus:border-amber-500/50';
const TA_CLS = `${INPUT_CLS} resize-none font-mono text-[10px] leading-relaxed`;

/* ── Panneau principal ───────────────────────────────────────────────────── */
export default function WhiteboardObjectEditPanel({ stroke, onApply, onClose }) {
  const [state, setState] = useState(() => initState(stroke));
  const set = useCallback((key, val) => setState((prev) => ({ ...prev, [key]: val })), []);

  const handleApply = () => {
    onApply(buildPatch(stroke.kind, state));
  };

  const kind = stroke.kind;
  const label = KIND_LABELS[kind] || kind;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[min(94vw,520px)] max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.11] bg-[#14131c]/98 p-5 shadow-[0_24px_80px_-20px_rgba(0,0,0,.9)] space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-bold text-white/90">Modifier — {label}</p>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white/75 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── function-plot ─────────────────────────────────────── */}
        {kind === 'function-plot' && (<>
          <Field label="Expression f(x)"><input type="text" value={state.expr} onChange={(e) => set('expr', e.target.value)} className={INPUT_CLS} placeholder="sin(x), x^2, 2*x+1…" spellCheck={false} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="x minimum"><input type="number" value={state.xMin} onChange={(e) => set('xMin', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="x maximum"><input type="number" value={state.xMax} onChange={(e) => set('xMax', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Échelle px/u"><input type="number" value={state.scaleX} onChange={(e) => set('scaleX', e.target.value)} className={INPUT_CLS} min={5} /></Field>
          </div>
        </>)}

        {/* ── value-table ───────────────────────────────────────── */}
        {kind === 'value-table' && (<>
          <Field label="Expression y = f(x)"><input type="text" value={state.expr} onChange={(e) => set('expr', e.target.value)} className={INPUT_CLS} spellCheck={false} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="x min"><input type="number" value={state.xMin} onChange={(e) => set('xMin', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="x max"><input type="number" value={state.xMax} onChange={(e) => set('xMax', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Pas"><input type="number" value={state.xStep} onChange={(e) => set('xStep', e.target.value)} className={INPUT_CLS} step={0.5} min={0.01} /></Field>
          </div>
        </>)}

        {/* ── histogram & pie-chart ─────────────────────────────── */}
        {(kind === 'histogram' || kind === 'pie-chart') && (<>
          <Field label="Titre"><input type="text" value={state.title} onChange={(e) => set('title', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="Étiquettes (virgule)"><input type="text" value={state.labels} onChange={(e) => set('labels', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="Valeurs (virgule)"><input type="text" value={state.values} onChange={(e) => set('values', e.target.value)} className={INPUT_CLS} /></Field>
        </>)}

        {/* ── scatter-plot ──────────────────────────────────────── */}
        {kind === 'scatter-plot' && (<>
          <Field label="Titre"><input type="text" value={state.title} onChange={(e) => set('title', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="Points (x,y; x,y; ...)"><textarea rows={4} value={state.data} onChange={(e) => set('data', e.target.value)} className={TA_CLS} spellCheck={false} /></Field>
          <label className="flex items-center gap-2 cursor-pointer text-[9px] text-white/60">
            <input type="checkbox" checked={state.connectDots} onChange={(e) => set('connectDots', e.target.checked)} className="accent-amber-500" />
            Relier les points
          </label>
        </>)}

        {/* ── variation-table ───────────────────────────────────── */}
        {kind === 'variation-table' && (<>
          <Field label="Nom de la fonction"><input type="text" maxLength={4} value={state.functionName} onChange={(e) => set('functionName', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="Valeurs de x (virgule)"><input type="text" value={state.xValues} onChange={(e) => set('xValues', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="Signes de f' (virgule)"><input type="text" value={state.derivSigns} onChange={(e) => set('derivSigns', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="f aux points critiques"><input type="text" value={state.critFValues} onChange={(e) => set('critFValues', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="Sens (true/false, virgule)"><input type="text" value={state.increasing} onChange={(e) => set('increasing', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="f aux frontières (gauche, droite)"><input type="text" value={state.boundaryFValues} onChange={(e) => set('boundaryFValues', e.target.value)} className={INPUT_CLS} /></Field>
        </>)}

        {/* ── sign-table ────────────────────────────────────────── */}
        {kind === 'sign-table' && (<>
          <Field label="Valeurs de x (virgule)"><input type="text" value={state.xValues} onChange={(e) => set('xValues', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="Lignes (label: s1, s2, ...)"><textarea rows={5} value={state.signRows} onChange={(e) => set('signRows', e.target.value)} className={TA_CLS} spellCheck={false} /></Field>
        </>)}

        {/* ── segment ───────────────────────────────────────────── */}
        {kind === 'segment' && (<>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Point A"><input type="text" maxLength={4} value={state.labelA} onChange={(e) => set('labelA', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Point B"><input type="text" maxLength={4} value={state.labelB} onChange={(e) => set('labelB', e.target.value)} className={INPUT_CLS} /></Field>
          </div>
          <Field label="Style">
            <select value={state.style} onChange={(e) => set('style', e.target.value)} className={INPUT_CLS}>
              {['segment', 'line', 'ray', 'dashed'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 cursor-pointer text-[9px] text-white/60">
            <input type="checkbox" checked={state.showLength} onChange={(e) => set('showLength', e.target.checked)} className="accent-amber-500" />
            Afficher la longueur
          </label>
          <Field label="Coches (0–3)"><input type="number" min={0} max={3} value={state.tickCount} onChange={(e) => set('tickCount', e.target.value)} className={INPUT_CLS} /></Field>
        </>)}

        {/* ── vector ────────────────────────────────────────────── */}
        {kind === 'vector' && (
          <Field label="Nom du vecteur"><input type="text" maxLength={4} value={state.label} onChange={(e) => set('label', e.target.value)} className={INPUT_CLS} placeholder="F, v, a…" /></Field>
        )}

        {/* ── axes ──────────────────────────────────────────────── */}
        {kind === 'axes' && (<>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Taille (px)"><input type="number" min={30} value={state.size} onChange={(e) => set('size', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Pas des graduations"><input type="number" min={5} value={state.tickStep} onChange={(e) => set('tickStep', e.target.value)} className={INPUT_CLS} /></Field>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-[9px] text-white/60">
            <input type="checkbox" checked={state.showLabels} onChange={(e) => set('showLabels', e.target.checked)} className="accent-amber-500" />
            Afficher les labels x/y/O
          </label>
        </>)}

        {/* ── numberline ────────────────────────────────────────── */}
        {kind === 'numberline' && (<>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Minimum"><input type="number" value={state.min} onChange={(e) => set('min', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Maximum"><input type="number" value={state.max} onChange={(e) => set('max', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Pas"><input type="number" value={state.step} onChange={(e) => set('step', e.target.value)} className={INPUT_CLS} step={0.5} min={0.01} /></Field>
          </div>
          <Field label="Unité (ex: cm, m/s)"><input type="text" value={state.unit} onChange={(e) => set('unit', e.target.value)} className={INPUT_CLS} /></Field>
          <label className="flex items-center gap-2 cursor-pointer text-[9px] text-white/60">
            <input type="checkbox" checked={state.showLabels} onChange={(e) => set('showLabels', e.target.checked)} className="accent-amber-500" />
            Afficher les valeurs
          </label>
        </>)}

        {/* ── latex ─────────────────────────────────────────────── */}
        {kind === 'latex' && (<>
          <Field label="Formule LaTeX / KaTeX"><textarea rows={3} value={state.formula} onChange={(e) => set('formula', e.target.value)} className={TA_CLS} spellCheck={false} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Taille (px)"><input type="number" min={10} max={80} value={state.fontSize} onChange={(e) => set('fontSize', e.target.value)} className={INPUT_CLS} /></Field>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-[9px] text-white/60">
            <input type="checkbox" checked={state.displayMode} onChange={(e) => set('displayMode', e.target.checked)} className="accent-amber-500" />
            Mode display (centré, grand)
          </label>
        </>)}

        {/* ── prob-tree ─────────────────────────────────────────── */}
        {kind === 'prob-tree' && (<>
          <Field label="Niveau 1 (label:proba, …)"><input type="text" value={state.l1} onChange={(e) => set('l1', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="Niveau 2 — branche 1"><input type="text" value={state.l2_0} onChange={(e) => set('l2_0', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="Niveau 2 — branche 2"><input type="text" value={state.l2_1} onChange={(e) => set('l2_1', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="Niveau 2 — branche 3 (optionnel)"><input type="text" value={state.l2_2} onChange={(e) => set('l2_2', e.target.value)} className={INPUT_CLS} /></Field>
          <label className="flex items-center gap-2 cursor-pointer text-[9px] text-white/60">
            <input type="checkbox" checked={state.showProducts} onChange={(e) => set('showProducts', e.target.checked)} className="accent-amber-500" />
            Afficher P(A∩B) aux feuilles
          </label>
        </>)}

        {/* ── electric-component ────────────────────────────────── */}
        {kind === 'electric-component' && (<>
          <Field label="Composant">
            <select value={state.component} onChange={(e) => set('component', e.target.value)} className={INPUT_CLS}>
              {['resistor','lamp','battery','switch-open','switch-closed','ammeter','voltmeter','generator','capacitor','diode','ground','junction'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Taille (px)"><input type="number" min={20} max={200} value={state.size} onChange={(e) => set('size', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Rotation (°)"><input type="number" value={state.angleDeg} onChange={(e) => set('angleDeg', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Étiquette"><input type="text" value={state.label} onChange={(e) => set('label', e.target.value)} className={INPUT_CLS} /></Field>
          </div>
        </>)}

        {/* ── fraction ──────────────────────────────────────────── */}
        {kind === 'fraction' && (<>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Numérateur"><input type="number" min={0} value={state.numerator} onChange={(e) => set('numerator', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Dénominateur"><input type="number" min={1} max={20} value={state.denominator} onChange={(e) => set('denominator', e.target.value)} className={INPUT_CLS} /></Field>
          </div>
          <Field label="Style">
            <select value={state.style} onChange={(e) => set('style', e.target.value)} className={INPUT_CLS}>
              <option value="bar">Barre</option><option value="pie">Camembert</option>
            </select>
          </Field>
        </>)}

        {/* ── curtain ───────────────────────────────────────────── */}
        {kind === 'curtain' && (<>
          <Field label="Opacité (0.05 – 1)"><input type="number" min={0.05} max={1} step={0.05} value={state.opacity} onChange={(e) => set('opacity', e.target.value)} className={INPUT_CLS} /></Field>
          <Field label="Étiquette"><input type="text" value={state.label} onChange={(e) => set('label', e.target.value)} className={INPUT_CLS} placeholder="Rideau (optionnel)" /></Field>
        </>)}

        {/* ── measure ───────────────────────────────────────────── */}
        {kind === 'measure' && (
          <Field label="Étiquette personnalisée"><input type="text" value={state.label} onChange={(e) => set('label', e.target.value)} className={INPUT_CLS} placeholder="AB = 5 cm" /></Field>
        )}

        {/* ── table ─────────────────────────────────────────────── */}
        {kind === 'table' && (<>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Colonnes"><input type="number" min={1} max={12} value={state.cols} onChange={(e) => set('cols', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Lignes"><input type="number" min={1} max={20} value={state.rows} onChange={(e) => set('rows', e.target.value)} className={INPUT_CLS} /></Field>
          </div>
        </>)}

        {/* ── coord-point ───────────────────────────────────────── */}
        {kind === 'coord-point' && (<>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nom du point"><input type="text" maxLength={4} value={state.label} onChange={(e) => set('label', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Taille police"><input type="number" min={8} max={32} value={state.fontSize} onChange={(e) => set('fontSize', e.target.value)} className={INPUT_CLS} /></Field>
          </div>
        </>)}

        {/* ── polygon ───────────────────────────────────────────── */}
        {kind === 'polygon' && (
          <Field label="Nombre de côtés"><input type="number" min={3} max={12} value={state.sides} onChange={(e) => set('sides', e.target.value)} className={INPUT_CLS} /></Field>
        )}

        {/* ── star ──────────────────────────────────────────────── */}
        {kind === 'star' && (
          <Field label="Nombre de branches"><input type="number" min={3} max={12} value={state.points} onChange={(e) => set('points', e.target.value)} className={INPUT_CLS} /></Field>
        )}

        {/* ── arrow ─────────────────────────────────────────────── */}
        {kind === 'arrow' && (
          <label className="flex items-center gap-2 cursor-pointer text-[9px] text-white/60">
            <input type="checkbox" checked={state.doubleArrow} onChange={(e) => set('doubleArrow', e.target.checked)} className="accent-amber-500" />
            Flèche double (↔)
          </label>
        )}

        {/* ── protractor ────────────────────────────────────────── */}
        {kind === 'protractor' && (
          <Field label="Rayon (px)"><input type="number" min={20} max={300} value={state.r} onChange={(e) => set('r', e.target.value)} className={INPUT_CLS} /></Field>
        )}

        {/* ── ruler ─────────────────────────────────────────────── */}
        {kind === 'ruler' && (<>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Longueur (px)"><input type="number" min={30} value={state.length} onChange={(e) => set('length', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Divisions"><input type="number" min={2} max={50} value={state.divisions} onChange={(e) => set('divisions', e.target.value)} className={INPUT_CLS} /></Field>
          </div>
        </>)}

        {/* Fallback si kind non géré */}
        {!Object.keys(initState(stroke)).length && (
          <p className="text-[10px] text-white/40 text-center py-4">
            Ce type d'objet n'a pas de propriétés éditables (couleur et épaisseur depuis le panneau propriétés).
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={handleApply}
            className="flex-1 rounded-xl border border-amber-500/45 bg-amber-500/16 py-2 text-[11px] font-bold text-amber-100 hover:bg-amber-500/24 transition-colors">
            ✓ Appliquer
          </button>
          <button type="button" onClick={onClose}
            className="px-5 rounded-xl border border-white/12 bg-white/4 text-[11px] text-white/55 hover:text-white/75 transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
