/**
 * DocumentSuggestionsPanel — l'intelligence documentaire rendue ATTEIGNABLE.
 *
 * Trois modes choisis explicitement par l'utilisateur (cahier des charges § 1, 2, 3) :
 *   · Contrôle libre — l'IA se tait. Aucune suggestion, aucun appel réseau.
 *   · Suggestions    — l'IA propose des BLOCS qu'on insère ou régénère un par un.
 *   · Rédaction auto — l'IA rédige le document entier, l'utilisateur l'insère.
 *
 * Le moteur est `documentIntelligence.js` (il PROPOSE, il n'écrit jamais sur le canvas).
 * Ce panneau est le seul à décider d'une insertion, et il ne fait qu'AJOUTER :
 * la pose passe par `layoutDocumentBlocks`, sous le contenu existant, en un seul lot
 * → un Ctrl+Z annule toute la rédaction.
 *
 * ⛔ Les propositions ne vivent PLUS en état local : elles sont dans
 * `useDocumentSuggestionsStore`. Le panneau est démonté à chaque fermeture du hub
 * LONGIA et à chaque changement d'onglet ; un `useState` détruisait alors du travail
 * modèle déjà payé (mesuré : 0 bloc survivant). Seul le transitoire (chargement,
 * erreur, carte occupée) reste local — il DOIT mourir avec le panneau.
 *
 * Glisser-déposer : les cartes sont `draggable` et écrivent le payload
 * `application/liri-document-bloc` (format et mode d'emploi de la réception en tête
 * de `useDocumentSuggestionsStore.js`). ⚠️ Le `onDrop` du canevas
 * (SmartboardKonvaEditorV1) n'accepte à ce jour que `application/liri-library` : tant
 * qu'il n'appelle pas `lireBlocDnd`, le dépôt sur la page ne pose rien. Le bouton
 * « Insérer ici » reste donc le chemin garanti — le glisser s'y AJOUTE, il ne le
 * remplace pas.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import {
  Sparkles, Loader2, Plus, RotateCcw, PenLine, Hand, Lightbulb, Zap, AlertTriangle, Check,
  GripVertical, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDocumentCoachStore, DOC_TYPE_META } from '@/features/smartboard-konva-editor/store/useDocumentCoachStore';
import { useSmartboardKonvaStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import {
  MODES_ASSISTANCE,
  definirModeAssistance,
  analyserContexteLocal,
  detecterContexte,
  suggererBlocs,
  regenererSuggestion,
  redigerDocumentComplet,
} from '@/features/smartboard-konva-editor/lib/documentIntelligence';
import {
  DOC_PAGE,
  estimateTextHeight,
  nextFlowPosition,
  makeDocumentTextObject,
  layoutDocumentBlocks,
} from '@/features/smartboard-konva-editor/lib/documentBlockLayout';
import {
  useDocumentSuggestionsStore,
  cleContexteDocument,
  ecrireBlocDnd,
  DOC_BLOC_DND_DEFAUTS,
} from '@/features/smartboard-konva-editor/store/useDocumentSuggestionsStore';

const EMPTY_OBJECTS = [];
const MODE_ICONS = { libre: Hand, suggestions: Lightbulb, auto: Zap };

/**
 * ⚠️ Le mode vit à deux endroits : ici pour que React se rafraîchisse, et dans
 * `documentIntelligence` (verrou de module `definirModeAssistance`) pour qu'aucun
 * appel oublié ne parte en mode libre. `setMode` synchronise les deux — ne jamais
 * écrire l'un sans l'autre.
 */
export const useDocumentAiModeStore = create((set) => ({
  mode: 'suggestions',
  setMode: (mode) => set({ mode: definirModeAssistance(mode) }),
}));

/* ─── Sélecteur de mode (rendu en tête du panneau Architect) ─────── */
export function DocumentAiModeSelector({ className = '' }) {
  const mode = useDocumentAiModeStore((s) => s.mode);
  const setMode = useDocumentAiModeStore((s) => s.setMode);

  /* Le verrou de module doit refléter l'état affiché dès le montage. */
  useEffect(() => { definirModeAssistance(mode); }, [mode]);

  const current = MODES_ASSISTANCE.find((m) => m.id === mode) ?? MODES_ASSISTANCE[1];

  return (
    <div className={className}>
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-white/60">Mode d'assistance</p>
      <div className="grid grid-cols-3 gap-1">
        {MODES_ASSISTANCE.map((m) => {
          const Icon = MODE_ICONS[m.id] ?? Lightbulb;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              title={m.desc}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-all',
                active
                  ? 'border-[#e3aa6b]/45 bg-[#e3aa6b]/[0.10]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]',
              )}
            >
              <Icon className={cn('h-3 w-3', active ? 'text-[#e3aa6b]' : 'text-white/45')} />
              <span className={cn('text-[8.5px] font-semibold leading-tight', active ? 'text-[#e3aa6b]' : 'text-white/55')}>
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[9px] leading-relaxed text-white/45">{current.desc}</p>
    </div>
  );
}

/**
 * Carte de proposition — tirable ET insérable.
 *
 * `draggable` n'annule pas « Insérer ici » : le glisser dépend d'une réception
 * côté canevas qui n'existe pas encore (cf. en-tête), le bouton, lui, marche.
 */
function SuggestionCard({ suggestion, bloc, busy, onInsert, onRegenerate }) {
  const onDragStart = useCallback(
    (e) => {
      const ok = ecrireBlocDnd(e.dataTransfer, {
        texte: suggestion.texte,
        bloc,
        suggestionId: suggestion.id,
        origine: 'suggestions',
      });
      /* Bloc vide : pas d'affordance de dépôt qui ne poserait rien. */
      if (!ok) e.preventDefault();
    },
    [suggestion, bloc],
  );

  return (
    <div
      draggable
      onDragStart={onDragStart}
      title="Glisser sur la page, ou utiliser « Insérer ici »"
      className="group rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 transition-colors hover:border-[#e3aa6b]/25 active:cursor-grabbing"
    >
      <div className="mb-1.5 flex items-start gap-1.5">
        <GripVertical className="mt-[1px] h-3 w-3 shrink-0 cursor-grab text-white/20 transition-colors group-hover:text-white/45" />
        <p className="min-w-0 flex-1 whitespace-pre-wrap text-[10px] leading-relaxed text-white/75">{suggestion.texte}</p>
      </div>
      {suggestion.note ? (
        <p className="mb-2 text-[9px] italic leading-relaxed text-white/40">{suggestion.note}</p>
      ) : null}
      <div className="flex items-center gap-1.5">
        <button
          type="button" onClick={onInsert} disabled={busy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#d97757]/35 bg-[#d97757]/[0.10] py-1.5 text-[9.5px] font-semibold text-[#e08b6d] transition-all hover:bg-[#d97757]/20 disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> Insérer ici
        </button>
        <button
          type="button" onClick={onRegenerate} disabled={busy}
          title="Proposer autre chose pour ce même bloc"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 transition-all hover:text-white/85 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

/* ─── Panneau ────────────────────────────────────────────────────── */
export default function DocumentSuggestionsPanel() {
  const mode = useDocumentAiModeStore((s) => s.mode);

  /* Coach — lecture seule : le cycle de vie du plan lui appartient. */
  const detectedType = useDocumentCoachStore((s) => s.detectedType);
  const documentPlan = useDocumentCoachStore((s) => s.documentPlan);
  const answers = useDocumentCoachStore((s) => s.answers);

  /* Canevas */
  const addObjects = useSmartboardKonvaStore((s) => s.addObjects);
  const sceneObjects = useSmartboardKonvaStore((s) => {
    const p = s.project;
    return p?.scenes?.find((sc) => sc.id === p.activeSceneId)?.objects ?? EMPTY_OBJECTS;
  });

  /* ── Travail modèle : hors de React, il survit au démontage du panneau. ── */
  const blocCible = useDocumentSuggestionsStore((s) => s.blocCible);
  const setBlocCible = useDocumentSuggestionsStore((s) => s.setBlocCible);
  const items = useDocumentSuggestionsStore((s) => s.propositions);
  const blocPropose = useDocumentSuggestionsStore((s) => s.blocPropose);
  const draft = useDocumentSuggestionsStore((s) => s.brouillon);
  const contexteProduction = useDocumentSuggestionsStore((s) => s.contexte);
  const setPropositions = useDocumentSuggestionsStore((s) => s.setPropositions);
  const remplacerProposition = useDocumentSuggestionsStore((s) => s.remplacerProposition);
  const setBrouillon = useDocumentSuggestionsStore((s) => s.setBrouillon);
  const viderBrouillon = useDocumentSuggestionsStore((s) => s.viderBrouillon);
  const toutOublier = useDocumentSuggestionsStore((s) => s.toutOublier);

  /* ── Transitoire : ces valeurs DOIVENT mourir avec le panneau. ── */
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(/** @type {string|null} */ (null));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const titreDocument = useMemo(() => {
    const meta = detectedType ? DOC_TYPE_META[detectedType] : null;
    return documentPlan?.libraryTemplateName || meta?.label || 'Document administratif';
  }, [detectedType, documentPlan]);

  /** Ce que l'utilisateur a réellement dit — sert de matière au registre et aux prompts. */
  const matiere = useMemo(() => {
    const entries = Object.entries(answers ?? {}).filter(
      ([, v]) => v && String(v).trim() && String(v).trim() !== '—',
    );
    return entries.map(([k, v]) => `${k} : ${String(v).trim()}`).join(' · ').slice(0, 900);
  }, [answers]);

  /* Contexte local instantané (aucun réseau) — affiné par le modèle à l'appel. */
  const contexteLocal = useMemo(
    () => analyserContexteLocal(matiere || titreDocument, detectedType ?? undefined),
    [matiere, titreDocument, detectedType],
  );

  const blocks = useMemo(() => {
    const fromPlan = Array.isArray(documentPlan?.blocks) ? documentPlan.blocks : null;
    if (fromPlan?.length) return fromPlan.map(String).slice(0, 10);
    const meta = detectedType ? DOC_TYPE_META[detectedType] : null;
    return Array.isArray(meta?.requiredBlocks) ? meta.requiredBlocks.map(String).slice(0, 10) : [];
  }, [documentPlan, detectedType]);

  useEffect(() => {
    if (!blocCible && blocks.length) setBlocCible(blocks[0]);
  }, [blocks, blocCible, setBlocCible]);

  /**
   * Clé du document courant. ⛔ Elle ne sert qu'à AVERTIR : purger d'office les
   * propositions dès que le type ou le modèle change referait la perte qu'on corrige.
   */
  const cleCourante = useMemo(
    () => cleContexteDocument({ detectedType, templateId: documentPlan?.libraryTemplateId ?? null }),
    [detectedType, documentPlan],
  );
  const contextePerime =
    Boolean(contexteProduction) && contexteProduction !== cleCourante && Boolean(items.length || draft);

  /* ── Insertion d'un bloc, sous le contenu existant ── */
  const insertText = useCallback((texte) => {
    /* Mêmes corps et largeur que le payload du glisser : bouton et dépôt doivent
       poser exactement le même bloc. */
    const { fontSize } = DOC_BLOC_DND_DEFAUTS;
    const h = estimateTextHeight(texte, fontSize, DOC_PAGE.contentWidth);
    const pos = nextFlowPosition(sceneObjects, h);
    addObjects([makeDocumentTextObject({ text: texte, x: pos.x, y: pos.y, width: pos.width, fontSize })]);
    setNotice(
      pos.overflow
        ? 'Bloc inséré — il dépasse le bas de la page A4, déplacez-le ou ajoutez une page.'
        : 'Bloc inséré sous le contenu existant.',
    );
  }, [sceneObjects, addObjects]);

  /* ── Mode Suggestions ── */
  const demanderSuggestions = useCallback(async () => {
    const bloc = blocCible || blocks[0];
    if (!bloc) { setError('Aucun bloc à proposer — décrivez d\'abord le document.'); return; }
    setError(''); setNotice(''); setLoading(true);
    try {
      const contexte = await detecterContexte(matiere || titreDocument, detectedType ?? undefined);
      const res = await suggererBlocs(contexte, bloc, {
        titreDocument,
        reponses: answers,
        nombre: 3,
        eviter: items.map((s) => s.texte),
      });
      if (!res?.ok) { setError(res?.message || 'Suggestions indisponibles.'); return; }
      setPropositions(bloc, res.propositions ?? [], cleCourante);
      if (res.source === 'admin_document') {
        setNotice('Propositions produites par le canal de repli (rédaction administrative).');
      }
    } catch (e) {
      setError(e?.message || 'Appel impossible.');
    } finally {
      setLoading(false);
    }
  }, [blocCible, blocks, matiere, titreDocument, detectedType, answers, items, setPropositions, cleCourante]);

  /** ⛔ Patch d'un seul emplacement : régénérer une carte ne jette pas les autres. */
  const regenererUne = useCallback(async (suggestion) => {
    setError(''); setBusyId(suggestion.id);
    try {
      const res = await regenererSuggestion(suggestion, {
        contexte: contexteLocal,
        reponses: answers,
        titreDocument,
        eviter: items.filter((s) => s.id !== suggestion.id).map((s) => s.texte),
      });
      if (!res?.ok || !res.propositions?.length) {
        setError(res?.message || 'Régénération impossible.');
        return;
      }
      remplacerProposition(suggestion.id, res.propositions[0]);
    } catch (e) {
      setError(e?.message || 'Régénération impossible.');
    } finally {
      setBusyId(null);
    }
  }, [contexteLocal, answers, titreDocument, items, remplacerProposition]);

  /* ── Mode Rédaction automatique ── */
  const redigerTout = useCallback(async () => {
    if (!blocks.length) return;
    setError(''); setNotice(''); setLoading(true);
    try {
      const contexte = await detecterContexte(matiere || titreDocument, detectedType ?? undefined);
      const res = await redigerDocumentComplet(detectedType ?? 'letter', contexte, answers, {
        blocsRequis: blocks,
        titreDocument,
        modeleNom: documentPlan?.libraryTemplateName ?? undefined,
      });
      if (!res?.ok) { setError(res?.message || 'Rédaction impossible.'); return; }
      setBrouillon(res, cleCourante);
    } catch (e) {
      setError(e?.message || 'Rédaction impossible.');
    } finally {
      setLoading(false);
    }
  }, [blocks, matiere, titreDocument, detectedType, answers, documentPlan, setBrouillon, cleCourante]);

  /** L'insertion reste un geste explicite : le brouillon est relu avant d'atterrir. */
  const poserBrouillon = useCallback(() => {
    if (!draft?.blocs?.length) return;
    const { objects, overflow } = layoutDocumentBlocks(draft.blocs, sceneObjects);
    if (!objects.length) { setError('Aucun bloc exploitable à poser.'); return; }
    addObjects(objects);
    setNotice(
      `${draft.blocs.length} bloc(s) posés sous le contenu existant. Ctrl+Z annule l'ensemble.`
      + (overflow ? ' ⚠ Le contenu dépasse la page A4 — ajoutez une page.' : ''),
    );
    viderBrouillon();
  }, [draft, sceneObjects, addObjects, viderBrouillon]);

  /* ── Mode Libre : l'IA est visiblement au repos ── */
  if (mode === 'libre') {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
            <Hand className="h-3 w-3 text-white/40" />
          </div>
          <span className="text-[10.5px] font-semibold text-white/55">IA au repos</span>
        </div>
        <p className="mt-1.5 text-[9.5px] leading-relaxed text-white/45">
          Mode <strong className="text-white/65">Contrôle libre</strong> : aucune suggestion n'est
          calculée, aucun appel n'est envoyé. Passez en <strong className="text-white/65">Suggestions</strong> ou
          <strong className="text-white/65"> Rédaction auto</strong> pour appeler l'assistant.
        </p>
        <p className="mt-1.5 text-[9px] leading-relaxed text-white/30">
          Registre pressenti : {contexteLocal.registreLabel} · {contexteLocal.formaliteLabel} (analyse locale, sans réseau).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Le travail modèle survit à la fermeture du hub : il peut donc dater d'un
          autre document. On le dit, on ne l'efface pas d'office. */}
      {contextePerime ? (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-2 py-1.5">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="text-[9.5px] leading-relaxed text-amber-200/85">
              Ces propositions ont été produites pour un autre document (type ou modèle changé
              depuis). Elles sont conservées — à vous de les garder ou de les jeter.
            </p>
            <button
              type="button"
              onClick={() => { toutOublier(); setNotice(''); setError(''); }}
              className="mt-1 flex items-center gap-1 rounded-md border border-white/[0.10] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/60 transition-all hover:text-white/90"
            >
              <Trash2 className="h-2.5 w-2.5" /> Jeter ces propositions
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Suggestions ── */}
      {mode === 'suggestions' && (
        <>
          {blocks.length > 1 && (
            <div>
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-white/50">Bloc à proposer</p>
              <div className="flex flex-wrap gap-1">
                {blocks.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBlocCible(b)}
                    className={cn(
                      'rounded-md border px-1.5 py-0.5 text-[9px] capitalize transition-all',
                      blocCible === b
                        ? 'border-[#e3aa6b]/45 bg-[#e3aa6b]/10 text-[#e3aa6b]'
                        : 'border-white/[0.07] bg-white/[0.03] text-white/55 hover:bg-white/[0.06]',
                    )}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={demanderSuggestions}
            disabled={loading || !blocks.length}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#cf8059]/30 bg-[#cf8059]/[0.09] py-2 text-[10.5px] font-semibold text-[#e0a07e] transition-all hover:bg-[#cf8059]/[0.16] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {items.length ? 'Proposer autre chose' : `Proposer des blocs${blocCible ? ` — ${blocCible}` : ''}`}
          </button>

          {items.length > 0 && (
            <div className="space-y-1.5">
              {items.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  bloc={blocPropose || blocCible}
                  busy={busyId === s.id || loading}
                  onInsert={() => insertText(s.texte)}
                  onRegenerate={() => regenererUne(s)}
                />
              ))}
            </div>
          )}

          {!items.length && !loading && !error ? (
            <p className="text-[9.5px] leading-relaxed text-white/40">
              Chaque carte se glisse sur la page ou s'insère par son bouton.
              L'assistant propose trois formulations pour le bloc choisi, dans le registre
              <strong className="text-white/60"> {contexteLocal.registreLabel}</strong>. Chaque bloc
              s'insère sous le contenu existant — rien n'est écrasé.
            </p>
          ) : null}
        </>
      )}

      {/* ── Rédaction automatique ── */}
      {mode === 'auto' && (
        <>
          {blocks.length ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-white/50">
                {blocks.length} bloc{blocks.length > 1 ? 's' : ''} à rédiger
              </p>
              <div className="flex flex-wrap gap-1">
                {blocks.map((b) => (
                  <span key={b} className="rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[9px] capitalize text-white/55">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-2 text-[9.5px] leading-relaxed text-amber-200/85">
              Aucune structure connue. Décrivez d'abord le document (ou choisissez un modèle) pour
              que l'assistant sache quels blocs rédiger.
            </p>
          )}

          <button
            type="button"
            onClick={redigerTout}
            disabled={loading || !blocks.length}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d97757]/40 bg-[#d97757]/[0.12] py-2.5 text-[10.5px] font-bold text-[#f0a98d] transition-all hover:bg-[#d97757]/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
            {loading ? 'Rédaction en cours…' : 'Générer le document'}
          </button>

          {draft ? (
            <div className="space-y-1.5 rounded-xl border border-[#e3aa6b]/30 bg-[#e3aa6b]/[0.06] p-2.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#e3aa6b]">
                Brouillon — {draft.blocs.length} bloc{draft.blocs.length > 1 ? 's' : ''}
              </p>
              <div className="max-h-56 space-y-1.5 overflow-y-auto [scrollbar-width:thin]">
                {/* Chaque bloc du brouillon est tirable seul — poser le tout reste
                    possible par « Poser sur la page ». */}
                {draft.blocs.map((b) => (
                  <div
                    key={b.cle}
                    draggable
                    onDragStart={(e) => {
                      const ok = ecrireBlocDnd(e.dataTransfer, {
                        texte: b.texte,
                        bloc: b.cle || b.titre,
                        suggestionId: null,
                        origine: 'redaction-auto',
                      });
                      if (!ok) e.preventDefault();
                    }}
                    title="Glisser ce bloc seul sur la page"
                    className="group flex items-start gap-1.5 rounded-lg border border-white/[0.07] bg-black/25 px-2 py-1.5 active:cursor-grabbing"
                  >
                    <GripVertical className="mt-[3px] h-3 w-3 shrink-0 cursor-grab text-white/20 transition-colors group-hover:text-white/45" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[8.5px] font-semibold uppercase tracking-wider text-white/40">{b.titre || b.cle}</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-[10px] leading-relaxed text-white/75">{b.texte}</p>
                    </div>
                  </div>
                ))}
              </div>

              {draft.avertissements?.length ? (
                <ul className="space-y-0.5">
                  {draft.avertissements.slice(0, 4).map((a, i) => (
                    <li key={i} className="flex items-start gap-1 text-[9px] leading-relaxed text-amber-200/85">
                      <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" /> {a}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex items-center gap-1.5">
                <button
                  type="button" onClick={poserBrouillon}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#d97757]/40 bg-[#d97757]/15 py-1.5 text-[10px] font-semibold text-[#f0a98d] transition-all hover:bg-[#d97757]/25"
                >
                  <Check className="h-3 w-3" /> Poser sur la page
                </button>
                <button
                  type="button" onClick={redigerTout} disabled={loading}
                  title="Rédiger une autre version"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 transition-all hover:text-white/85 disabled:opacity-40"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
                <button
                  type="button" onClick={viderBrouillon}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[9.5px] text-white/50 transition-all hover:text-white/85"
                >
                  Jeter
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[9px] leading-relaxed text-white/40">
              Le brouillon est relu <strong className="text-white/60">avant</strong> d'atterrir sur la page,
              et s'ajoute <strong className="text-white/60">sous</strong> le contenu déjà présent — rien n'est
              effacé. Les informations manquantes restent en <span className="font-mono">[crochets]</span>.
            </p>
          )}
        </>
      )}

      {/* ── Retours ── */}
      {error ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-red-500/25 bg-red-500/[0.07] px-2 py-1.5 text-[9.5px] leading-relaxed text-red-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {error}
        </p>
      ) : null}
      {notice ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-[#5a8f52]/30 bg-[#5a8f52]/[0.09] px-2 py-1.5 text-[9.5px] leading-relaxed text-[#9cc48a]">
          <Check className="mt-0.5 h-3 w-3 shrink-0" /> {notice}
        </p>
      ) : null}
    </div>
  );
}
