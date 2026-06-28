/**
 * Outils LIRI avancés : packs Pro / Science, pont design texte.
 * Branché dans l'onglet « LIRI+ » du CanvaDesignPanel.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Atom, LayoutGrid, BookText } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LIRI_KONVA_PRO_PRESETS_PACK_V1,
  packPresetToSceneObjects,
  findTextPresetById,
  findElementPresetById,
  starterLayoutToSceneObjects,
} from '../lib/konvaProPresetsPackV1';
import {
  LIRI_KONVA_SCIENCE_DISCIPLINES,
  LIRI_KONVA_SCIENCE_ELEMENT_CATEGORY_LABELS,
  LIRI_KONVA_SCIENCE_PRESETS_PACK,
  findSciencePresetById,
  findScienceElementById,
  listSciencePresetsByDiscipline,
  listScienceElementsByCategory,
  sciencePresetToSceneObjects,
  scienceStarterLayoutToSceneObjects,
} from '../lib/konvaSciencePresetsPack';
import {
  LIRI_TEXT_DESIGN_STYLES,
  getTextLibraryCategoryNames,
  getTextLibrarySnippets,
  liriTextStyleToSceneObjects,
  liriClassificationToSceneObjects,
  textSnippetToTextObject,
  getClassificationForTextLibraryCategory,
} from '../lib/liriTextDesignPack';
import KonvaCoachSlidePanel from './KonvaCoachSlidePanel';
import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';

/** @param {{ addObjects: (objs: import('../model/sceneTypes').SbKonvaObjectBase[]) => void; className?: string; quickFilter?: string }} props */
export default function LiriKonvaToolkitPanel({ addObjects, className, quickFilter = '' }) {
  const qf = (quickFilter || '').trim().toLowerCase();
  const matchesQf = (s) => !qf || String(s).toLowerCase().includes(qf);
  const [library, setLibrary] = useState(/** @type {'pro' | 'science'} */ ('pro'));
  const [proKind, setProKind] = useState(/** @type {'text' | 'element' | 'layout'} */ ('text'));
  const [scienceKind, setScienceKind] = useState(/** @type {'preset' | 'element' | 'layout'} */ ('preset'));
  const [scienceDiscipline, setScienceDiscipline] = useState('biology');
  const [scienceElementCategory, setScienceElementCategory] = useState('arrows');
  const [pickId, setPickId] = useState('');

  const [liriStyleId, setLiriStyleId] = useState(() => LIRI_TEXT_DESIGN_STYLES[0]?.id || '');
  const [liriClassId, setLiriClassId] = useState('title');
  const [snippetCat, setSnippetCat] = useState(() => getTextLibraryCategoryNames()[0] || '');
  const [snippetIdx, setSnippetIdx] = useState(0);

  const scienceCategories = useMemo(
    () => Object.keys(LIRI_KONVA_SCIENCE_ELEMENT_CATEGORY_LABELS),
    [],
  );

  const pickOptions = useMemo(() => {
    if (library === 'pro') {
      if (proKind === 'text') return LIRI_KONVA_PRO_PRESETS_PACK_V1.textPresets.map((p) => ({ id: p.id, label: p.label }));
      if (proKind === 'element') return LIRI_KONVA_PRO_PRESETS_PACK_V1.elements.map((p) => ({ id: p.id, label: p.label }));
      return LIRI_KONVA_PRO_PRESETS_PACK_V1.starterLayouts.map((p) => ({ id: p.id, label: p.label }));
    }
    if (scienceKind === 'preset') {
      return listSciencePresetsByDiscipline(scienceDiscipline).map((p) => ({ id: p.id, label: p.label }));
    }
    if (scienceKind === 'element') {
      return listScienceElementsByCategory(scienceElementCategory).map((p) => ({ id: p.id, label: p.label }));
    }
    return LIRI_KONVA_SCIENCE_PRESETS_PACK.starterLayouts.map((p) => ({ id: p.id, label: p.label }));
  }, [library, proKind, scienceKind, scienceDiscipline, scienceElementCategory]);

  const filteredPickOptions = useMemo(
    () => pickOptions.filter((o) => matchesQf(o.label)),
    [pickOptions, qf],
  );

  useEffect(() => {
    const first = filteredPickOptions[0]?.id || '';
    setPickId((prev) => (filteredPickOptions.some((o) => o.id === prev) ? prev : first));
  }, [filteredPickOptions]);

  const filteredLiriTextStyles = useMemo(
    () => LIRI_TEXT_DESIGN_STYLES.filter((s) => matchesQf(s.label)),
    [qf],
  );

  useEffect(() => {
    if (!filteredLiriTextStyles.length) return;
    setLiriStyleId((prev) =>
      filteredLiriTextStyles.some((s) => s.id === prev) ? prev : filteredLiriTextStyles[0].id,
    );
  }, [filteredLiriTextStyles]);

  const snippetCategoryNames = useMemo(() => {
    const cats = getTextLibraryCategoryNames();
    if (!qf) return cats;
    return cats.filter(
      (cat) =>
        matchesQf(cat) || getTextLibrarySnippets(cat).some((line) => matchesQf(line)),
    );
  }, [qf]);

  useEffect(() => {
    if (!snippetCategoryNames.length) return;
    setSnippetCat((prev) => (snippetCategoryNames.includes(prev) ? prev : snippetCategoryNames[0]));
  }, [snippetCategoryNames]);

  const snippetLinesFiltered = useMemo(() => {
    const lines = getTextLibrarySnippets(snippetCat);
    if (!qf) return lines;
    return lines.filter((line) => matchesQf(line));
  }, [snippetCat, qf]);

  useEffect(() => {
    setSnippetIdx((i) => Math.min(i, Math.max(0, snippetLinesFiltered.length - 1)));
  }, [snippetLinesFiltered.length]);

  const onInsertPack = useCallback(() => {
    let objs = [];
    if (library === 'pro') {
      if (proKind === 'text') {
        const p = findTextPresetById(pickId);
        if (p) objs = packPresetToSceneObjects(p);
      } else if (proKind === 'element') {
        const p = findElementPresetById(pickId);
        if (p) objs = packPresetToSceneObjects(p);
      } else {
        objs = starterLayoutToSceneObjects(pickId);
      }
    } else if (scienceKind === 'preset') {
      const p = findSciencePresetById(pickId);
      if (p) objs = sciencePresetToSceneObjects(p);
    } else if (scienceKind === 'element') {
      const p = findScienceElementById(pickId);
      if (p) objs = sciencePresetToSceneObjects(p);
    } else {
      objs = scienceStarterLayoutToSceneObjects(pickId);
    }
    if (objs.length) addObjects(objs);
  }, [library, proKind, scienceKind, pickId, addObjects]);

  const insertLiriStyle = useCallback(() => {
    const objs = liriTextStyleToSceneObjects(liriStyleId);
    if (objs.length) addObjects(objs);
  }, [liriStyleId, addObjects]);

  const insertLiriClassification = useCallback(() => {
    const objs = liriClassificationToSceneObjects(liriClassId, 0);
    if (objs.length) addObjects(objs);
  }, [liriClassId, addObjects]);

  const insertSnippet = useCallback(() => {
    const line = snippetLinesFiltered[snippetIdx];
    if (!line) return;
    const classification = getClassificationForTextLibraryCategory(snippetCat);
    const o = textSnippetToTextObject(line, { classification });
    addObjects([o]);
  }, [snippetCat, snippetIdx, snippetLinesFiltered, addObjects]);

  const showParityQuickLink =
    !qf ||
    [
      'parcours',
      'export',
      'parité',
      'parite',
      'pdf',
      'workspace',
      'qualité',
      'qualite',
      'vue',
      'dédiée',
      'dediee',
      'ouvrir',
      'page',
      'smartboard',
      'konva',
    ].some((h) => matchesQf(h));

  return (
    <div className={cn('space-y-3', className)}>
      {showParityQuickLink ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[#0d1222]/90 px-2.5 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]">Parcours & exports</p>
          <p className="mt-1 text-[9px] leading-snug text-white/45">
            Exports PDF / workspace / qualité depuis le Designer (même écran).
          </p>
          <Link
            to="/studio/smartboard-designer"
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 text-[10px] text-[#93c5fd] hover:bg-white/[0.08]"
          >
            Ouvrir le Designer →
          </Link>
        </div>
      ) : null}

      <div className="space-y-2 rounded-xl border border-violet-500/25 bg-violet-950/20 p-2.5">
        <p className="flex items-center justify-center gap-1 text-center text-[9px] font-semibold uppercase tracking-wider text-violet-200/90">
          {library === 'science' ? <Atom className="h-3 w-3" /> : <LayoutGrid className="h-3 w-3" />}
          Bibliothèque IA
        </p>
        <select
          value={library}
          onChange={(e) => setLibrary(/** @type {'pro' | 'science'} */ (e.target.value))}
          className="w-full rounded-lg border border-white/12 bg-black/40 px-1.5 py-1 text-[10px] text-white"
        >
          <option value="pro">Pro premium (V1)</option>
          <option value="science">Science complet</option>
        </select>

        {library === 'science' ? (
          <select
            value={scienceKind}
            onChange={(e) =>
              setScienceKind(/** @type {'preset' | 'element' | 'layout'} */ (e.target.value))
            }
            className="w-full rounded-lg border border-white/12 bg-black/40 px-1.5 py-1 text-[10px] text-white"
          >
            <option value="preset">Presets par discipline</option>
            <option value="element">Éléments</option>
            <option value="layout">Mises en page</option>
          </select>
        ) : (
          <select
            value={proKind}
            onChange={(e) =>
              setProKind(/** @type {'text' | 'element' | 'layout'} */ (e.target.value))
            }
            className="w-full rounded-lg border border-white/12 bg-black/40 px-1.5 py-1 text-[10px] text-white"
          >
            <option value="text">Texte</option>
            <option value="element">Éléments</option>
            <option value="layout">Mises en page</option>
          </select>
        )}

        {library === 'science' && scienceKind === 'preset' ? (
          <select
            value={scienceDiscipline}
            onChange={(e) => setScienceDiscipline(e.target.value)}
            className="w-full rounded-lg border border-white/12 bg-black/40 px-1.5 py-1 text-[10px] text-white"
          >
            {LIRI_KONVA_SCIENCE_DISCIPLINES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        ) : null}

        {library === 'science' && scienceKind === 'element' ? (
          <select
            value={scienceElementCategory}
            onChange={(e) => setScienceElementCategory(e.target.value)}
            className="w-full rounded-lg border border-white/12 bg-black/40 px-1.5 py-1 text-[10px] text-white"
          >
            {scienceCategories.map((c) => (
              <option key={c} value={c}>
                {LIRI_KONVA_SCIENCE_ELEMENT_CATEGORY_LABELS[c] || c}
              </option>
            ))}
          </select>
        ) : null}

        <select
          value={pickId}
          onChange={(e) => setPickId(e.target.value)}
          className="max-h-36 w-full rounded-lg border border-white/12 bg-black/40 px-1.5 py-1 text-[10px] text-white"
        >
          {filteredPickOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {qf && !filteredPickOptions.length ? (
          <p className="text-[9px] text-white/40">Aucun preset ne correspond au filtre.</p>
        ) : null}

        <button
          type="button"
          disabled={!filteredPickOptions.length}
          onClick={onInsertPack}
          className="flex w-full items-center justify-center rounded-lg border border-violet-400/35 bg-violet-500/15 py-1.5 text-[9px] font-medium text-violet-100 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Insérer sur la scène
        </button>
        <p className="text-[7px] leading-snug text-white/35">
          {library === 'pro'
            ? `Pack Pro ${LIRI_KONVA_PRO_PRESETS_PACK_V1.meta?.version || 'V1'} · canvas ${LIRI_KONVA_PRO_PRESETS_PACK_V1.meta?.canvas?.width || 1037}×${LIRI_KONVA_PRO_PRESETS_PACK_V1.meta?.canvas?.height || 750}`
            : `${LIRI_KONVA_SCIENCE_PRESETS_PACK.meta?.name || 'Science'} v${LIRI_KONVA_SCIENCE_PRESETS_PACK.meta?.version || '1'}`}
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-cyan-500/25 bg-cyan-950/20 p-2.5">
        <p className="flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-cyan-200/90">
          <BookText className="h-3 w-3" />
          Design texte → Konva
        </p>
        <select
          value={liriStyleId}
          onChange={(e) => setLiriStyleId(e.target.value)}
          className="w-full rounded-lg border border-white/12 bg-black/40 px-1.5 py-1 text-[10px] text-white"
        >
          {filteredLiriTextStyles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {qf && !filteredLiriTextStyles.length ? (
          <p className="text-[9px] text-white/40">Aucun style texte ne correspond.</p>
        ) : null}
        <button
          type="button"
          disabled={!filteredLiriTextStyles.length}
          onClick={insertLiriStyle}
          className="flex w-full items-center justify-center rounded-lg border border-cyan-400/35 bg-cyan-500/15 py-1 text-[9px] font-medium text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Placer blocs (preset Pro équivalent)
        </button>
        <div className="flex flex-wrap gap-1">
          <select
            value={liriClassId}
            onChange={(e) => setLiriClassId(e.target.value)}
            className="min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[9px] text-white"
            title="Classification IA"
          >
            <option value="title">title</option>
            <option value="definition">definition</option>
            <option value="summary">summary</option>
            <option value="quote">quote</option>
          </select>
          <button
            type="button"
            onClick={insertLiriClassification}
            className="rounded border border-cyan-500/30 px-1.5 py-0.5 text-[8px] text-cyan-100 hover:bg-cyan-500/20"
          >
            1ᵉʳ style
          </button>
        </div>
        <p className="text-[7px] text-white/35">Phrases types (bibliothèque)</p>
        <div className="flex gap-1">
          <select
            value={snippetCat}
            onChange={(e) => {
              setSnippetCat(e.target.value);
              setSnippetIdx(0);
            }}
            className="min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[9px] text-white"
          >
            {snippetCategoryNames.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={String(snippetIdx)}
            onChange={(e) => setSnippetIdx(Number(e.target.value))}
            className="min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[9px] text-white"
          >
            {snippetLinesFiltered.map((line, idx) => (
              <option key={idx} value={String(idx)}>
                {line.length > 36 ? `${line.slice(0, 34)}…` : line}
              </option>
            ))}
          </select>
        </div>
        {qf && (!snippetCategoryNames.length || !snippetLinesFiltered.length) ? (
          <p className="text-[9px] text-white/40">Aucune phrase ne correspond au filtre.</p>
        ) : null}
        <button
          type="button"
          disabled={!snippetLinesFiltered.length}
          onClick={insertSnippet}
          className="flex w-full items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] py-1 text-[9px] text-white/85 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Insérer la phrase
        </button>
      </div>

      <KonvaCoachSlidePanel contextExtra="LIRI+ toolkit" />
    </div>
  );
}
