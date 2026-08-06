/**
 * DocumentCoachPanel — IA Architect Documentaire (section AIHub)
 *
 * Rendu dans l'AIHub quand docType === 'document'.
 * Gère 6 phases : idle · detecting · questioning · generating · editing · reviewing
 *
 * Design tokens : #1f1e1c · border-white/[0.07] · text-[10px..12px]
 *
 * Couleurs — charte LIRI, ZÉRO froid. Correspondance appliquée ici (la même que
 * la table ACCENT de StudioDesignerLikeShell, pour que tout le Studio parle la
 * même langue) :
 *   cyan   → or/ocre  #e3aa6b   (sélection, choix en cours)
 *   violet → corail   #d97757 / #e08b6d en texte   (ACTIONS)
 *   emerald décoratif → argile  #cf8059  (identité « Architect »)
 *   blue (info)       → or      #e6cc92
 * Restent en l'état, parce qu'ils sont des CODES D'ÉTAT et non de la décoration :
 * rouge = erreur, ambre = avertissement. Le vert n'est gardé QUE pour un verdict
 * de validation, et en olive chaud (#5a8f52/#7bb06a/#9cc48a) — jamais en émeraude
 * bleutée — pour rester distinguable du rouge et de l'ambre.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  FileText, Sparkles, Wand2, CheckCircle2, AlertTriangle, ChevronRight,
  RotateCcw, MessageSquare, Lightbulb, Layers, PenLine, ScanLine,
  ArrowRight, Info, X, Zap, ScrollText, BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  useDocumentCoachStore,
  DOC_TYPE_META,
  GUIDED_FLOWS,
} from '@/features/smartboard-konva-editor/store/useDocumentCoachStore';
import {
  DOMAIN_META,
  templateToKonvaObjects,
} from '@/features/smartboard-konva-editor/lib/documentTemplateLibrary';
import { useSmartboardKonvaStore as _useKStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import { useSmartboardKonvaStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import DocumentSuggestionsPanel, {
  DocumentAiModeSelector,
  useDocumentAiModeStore,
} from '@/features/smartboard-konva-editor/components/DocumentSuggestionsPanel';
import { TextDiffPreview } from '@/features/smartboard-konva-editor/components/DocumentTextAiActions';
import {
  analyserContexteLocal,
  suggererFormulation,
} from '@/features/smartboard-konva-editor/lib/documentIntelligence';
import {
  DOC_PAGE,
  nextFlowPosition,
  estimateTextHeight,
  makeDocumentTextObject,
} from '@/features/smartboard-konva-editor/lib/documentBlockLayout';

const EMPTY_OBJECTS = [];

/* ─── Tokens locaux ─────────────────────────────────────────────── */
const SEVERITY_STYLES = {
  error:   { icon: AlertTriangle, cls: 'text-red-400',     bg: 'bg-red-500/[0.07] border-red-500/20'     },
  warning: { icon: AlertTriangle, cls: 'text-amber-400',   bg: 'bg-amber-500/[0.07] border-amber-500/20' },
  info:    { icon: Info,          cls: 'text-[#e6cc92]',   bg: 'bg-[#e6cc92]/[0.07] border-[#e6cc92]/25' },
};

/* Le mode choisi n'est plus décoratif : son `intention` part dans le prompt. */
const REWRITE_MODES = [
  { id: 'admin',     label: 'Administratif', icon: ScrollText, intention: 'registre administratif d\u2019usage, formulations consacrées' },
  { id: 'formalize', label: 'Formel',        icon: BookOpen,   intention: 'plus formel : vouvoiement, tournures soutenues, aucune familiarité' },
  { id: 'simplify',  label: 'Simple',        icon: Lightbulb,  intention: 'phrases courtes, vocabulaire accessible, aucune perte d\u2019information' },
  { id: 'legalize',  label: 'Juridique',     icon: Layers,     intention: 'registre juridique : termes exacts, formulations opposables, aucune référence légale inventée' },
  { id: 'expand',    label: 'Développer',    icon: Zap,        intention: 'version développée : précisions utiles uniquement, aucun fait inventé' },
  { id: 'compress',  label: 'Résumer',       icon: ScanLine,   intention: 'deux phrases maximum, tous les faits conservés' },
];

/* ─── Sous-composant : bulle de message ──────────────────────────── */
function CoachBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser && (
        <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-gradient-to-br from-amber-400/80 to-orange-600/70 flex items-center justify-center">
          <span className="text-[8px] text-white font-bold">✦</span>
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-2.5 py-2 text-[10.5px] leading-relaxed',
          isUser
            ? 'bg-white/[0.07] text-white/75 rounded-tr-sm'
            : 'bg-[#cf8059]/[0.08] border border-[#cf8059]/20 text-white/80 rounded-tl-sm',
        )}
      >
        {/* Bold markdown simple : **text** */}
        {msg.text.split(/(\*\*[^*]+\*\*)/).map((chunk, i) =>
          chunk.startsWith('**') && chunk.endsWith('**')
            ? <strong key={i} className="font-semibold text-white/90">{chunk.slice(2, -2)}</strong>
            : chunk.split('\n').map((line, j) => (
                <span key={j}>
                  {line}
                  {j < chunk.split('\n').length - 1 && <br />}
                </span>
              )),
        )}
      </div>
    </div>
  );
}

/* ─── Sous-composant : question guidée ───────────────────────────── */
function GuidedQuestion({ question, onAnswer, onSkip }) {
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { setValue(''); setSelected(''); inputRef.current?.focus(); }, [question.id]);

  const submit = useCallback(() => {
    const v = question.type === 'select' ? selected : value.trim();
    if (!v) return;
    onAnswer(v);
  }, [value, selected, question.type, onAnswer]);

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 space-y-2"
    >
      {/* Confirm (oui/non) */}
      {question.type === 'confirm' && (
        <div className="flex gap-2">
          <button
            type="button" onClick={() => onAnswer('Oui')}
            className="flex-1 rounded-lg border border-[#5a8f52]/35 bg-[#5a8f52]/[0.10] py-2 text-[10px] font-semibold text-[#9cc48a] hover:bg-[#5a8f52]/20 transition-colors"
          >
            Oui
          </button>
          <button
            type="button" onClick={() => onAnswer('Non')}
            className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-[10px] font-semibold text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            Non
          </button>
        </div>
      )}

      {/* Select */}
      {question.type === 'select' && (
        <div className="grid grid-cols-2 gap-1.5">
          {question.options.map(opt => (
            <button
              key={opt} type="button"
              onClick={() => { setSelected(opt); setTimeout(() => onAnswer(opt), 80); }}
              className={cn(
                'rounded-lg border px-2.5 py-2 text-[10px] font-medium transition-all',
                selected === opt
                  ? 'border-[#e3aa6b]/45 bg-[#e3aa6b]/10 text-[#e3aa6b]'
                  : 'border-white/[0.07] bg-white/[0.02] text-white/60 hover:bg-white/[0.05]',
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Text / Textarea */}
      {(question.type === 'text' || question.type === 'textarea') && (
        <>
          {question.type === 'textarea' ? (
            <textarea
              ref={inputRef}
              value={value} onChange={e => setValue(e.target.value)} onKeyDown={handleKey}
              rows={3}
              placeholder="Votre réponse…"
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-[#2b2a27] px-2.5 py-2 text-[10.5px] text-white/80 placeholder:text-white/50 outline-none focus:border-[#e3aa6b]/40 focus:bg-[#e3aa6b]/[0.04] transition-colors"
            />
          ) : (
            <input
              ref={inputRef}
              value={value} onChange={e => setValue(e.target.value)} onKeyDown={handleKey}
              placeholder="Votre réponse…"
              className="w-full rounded-lg border border-white/[0.08] bg-[#2b2a27] px-2.5 py-2 text-[10.5px] text-white/80 placeholder:text-white/50 outline-none focus:border-[#e3aa6b]/40 transition-colors"
            />
          )}
          <div className="flex items-center justify-between">
            <button
              type="button" onClick={onSkip}
              className="text-[9.5px] text-white/60 hover:text-white/85 transition-colors"
            >
              Passer
            </button>
            <button
              type="button" onClick={submit} disabled={!value.trim()}
              className="flex items-center gap-1 rounded-lg border border-[#d97757]/35 bg-[#d97757]/10 px-3 py-1.5 text-[10px] font-semibold text-[#e08b6d] hover:bg-[#d97757]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Suivant <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}

/* ─── Composant principal ────────────────────────────────────────── */
export default function DocumentCoachPanel() {
  /* Coach store */
  const phase             = useDocumentCoachStore(s => s.phase);
  const detectedType      = useDocumentCoachStore(s => s.detectedType);
  const guidedFlow        = useDocumentCoachStore(s => s.guidedFlow);
  const currentQIdx       = useDocumentCoachStore(s => s.currentQIdx);
  const documentPlan      = useDocumentCoachStore(s => s.documentPlan);
  const matchedTemplates  = useDocumentCoachStore(s => s.matchedTemplates);
  const suggestions       = useDocumentCoachStore(s => s.suggestions);
  const validationIssues  = useDocumentCoachStore(s => s.validationIssues);
  const coachMessages     = useDocumentCoachStore(s => s.coachMessages);
  const isGenerating      = useDocumentCoachStore(s => s.isGenerating);
  const selectTemplate    = useDocumentCoachStore(s => s.selectTemplate);

  /* Store Konva pour injecter les objets du template choisi */
  const addObjects       = _useKStore(s => s.addObjects);
  const setCanvasBg      = _useKStore(s => s.setCanvasBackground);

  const detectIntent       = useDocumentCoachStore(s => s.detectIntent);
  const answerQuestion     = useDocumentCoachStore(s => s.answerQuestion);
  const resetFlow          = useDocumentCoachStore(s => s.resetFlow);
  const validateDocument   = useDocumentCoachStore(s => s.validateDocument);
  const buildDocumentPlan  = useDocumentCoachStore(s => s.buildDocumentPlan);

  const addCoachMessage    = useDocumentCoachStore(s => s.addCoachMessage);

  /* Smartboard store — pour envoyer les messages au flux LONGIA */
  const addLongiaMessage = useSmartboardKonvaStore(s => s.addLongiaMessage);

  /* Canevas — bloc sélectionné (cible prioritaire de la reformulation).
     `addObjects` est déjà pris plus haut via _useKStore (même store). */
  const updateObject = useSmartboardKonvaStore(s => s.updateObject);
  const selectedIds  = useSmartboardKonvaStore(s => s.selectedIds);
  const sceneObjects = useSmartboardKonvaStore(s => {
    const p = s.project;
    return p?.scenes?.find(sc => sc.id === p.activeSceneId)?.objects ?? EMPTY_OBJECTS;
  });
  const selectedTextObj = sceneObjects.find(o => o.id === selectedIds[0] && o.type === 'text') ?? null;

  /* Mode d'assistance (Libre · Suggestions · Rédaction) */
  const aiMode = useDocumentAiModeStore(s => s.mode);
  const isFreeMode = aiMode === 'libre';

  /* Local input state (phase idle/detecting) */
  const [intentInput, setIntentInput] = useState('');
  const [rewriteInput, setRewriteInput] = useState('');
  const [rewriteMode, setRewriteMode] = useState('formalize');
  const [pendingTplId, setPendingTplId] = useState(/** @type {string|null} */ (null));
  const [rewriteBusy, setRewriteBusy] = useState(false);
  const [rewriteError, setRewriteError] = useState('');
  const [rewriteProposal, setRewriteProposal] = useState(
    /** @type {{ before: string, after: string, targetId: string|null, label: string }|null} */ (null),
  );
  const messagesEndRef = useRef(null);
  const messagesBoxRef = useRef(null);

  /**
   * Auto-défilement du fil de messages — CONFINÉ à sa propre boîte.
   *
   * ⛔ `scrollIntoView` remonte TOUS les ancêtres scrollables : depuis l'historique
   * Architect (en bas du panneau), il faisait défiler le hub LONGIA de 184 px et
   * sortait le sélecteur de mode (Libre / Suggestions / Rédaction auto) du champ
   * visible dès l'ouverture de l'onglet — la pièce centrale du panneau devenait
   * introuvable. On pilote donc `scrollTop` de la seule boîte des messages.
   */
  useEffect(() => {
    const box = messagesBoxRef.current;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
  }, [coachMessages.length]);

  /* Sync dernier message coach → flux LONGIA */
  const lastMsgRef = useRef(null);
  useEffect(() => {
    const last = coachMessages[coachMessages.length - 1];
    if (last && last.id !== lastMsgRef.current && last.role === 'ai') {
      lastMsgRef.current = last.id;
      addLongiaMessage({ role: 'ai', text: last.text });
    }
  }, [coachMessages, addLongiaMessage]);

  /* Handlers */
  const handleIntentSubmit = useCallback(() => {
    const t = intentInput.trim();
    if (!t) return;
    setIntentInput('');
    detectIntent(t);
  }, [intentInput, detectIntent]);

  const handleIntentKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleIntentSubmit(); }
  };

  /* ── Reformulation RÉELLE ──────────────────────────────────────
     ⛔ PIÈGE corrigé : l'ancien chemin vidait le textarea puis n'appelait rien
     (le texte collé était perdu). Ici le champ n'est vidé qu'APRÈS application. */
  const rewriteSource = (selectedTextObj?.content?.text ?? '').trim() || rewriteInput.trim();

  const runRewrite = useCallback(async () => {
    const source = (selectedTextObj?.content?.text ?? '').trim() || rewriteInput.trim();
    if (!source) return;
    const mode = REWRITE_MODES.find(m => m.id === rewriteMode);
    const label = mode?.label ?? rewriteMode;
    setRewriteError('');
    setRewriteBusy(true);
    try {
      const contexte = analyserContexteLocal(source, detectedType ?? undefined);
      const res = await suggererFormulation(source, contexte, {
        intention: mode?.intention,
        nombre: 2,
        titreDocument: documentPlan?.libraryTemplateName || DOC_TYPE_META[detectedType]?.label || 'Document',
        eviter: rewriteProposal ? [rewriteProposal.after] : [],
      });
      if (!res?.ok || !res.propositions?.length) {
        setRewriteError(res?.message || 'Reformulation indisponible.');
        return;
      }
      setRewriteProposal({
        before: source,
        after: res.propositions[0].texte,
        targetId: selectedTextObj?.id ?? null,
        label,
      });
    } catch (e) {
      setRewriteError(e?.message || 'Reformulation impossible.');
    } finally {
      setRewriteBusy(false);
    }
  }, [selectedTextObj, rewriteInput, rewriteMode, documentPlan, detectedType, rewriteProposal]);

  /** Applique la proposition : PATCH du bloc sélectionné, sinon nouveau bloc sous le contenu. */
  const applyRewrite = useCallback(() => {
    if (!rewriteProposal) return;
    const { after, targetId, label } = rewriteProposal;
    if (targetId) {
      updateObject(targetId, { content: { text: after } });
    } else {
      const h = estimateTextHeight(after, 13, DOC_PAGE.contentWidth);
      const pos = nextFlowPosition(sceneObjects, h);
      addObjects([makeDocumentTextObject({ text: after, x: pos.x, y: pos.y, width: pos.width })]);
    }
    addCoachMessage({
      role: 'ai',
      text: `✦ **${label}** appliqué ${targetId ? 'au bloc sélectionné' : 'en nouveau bloc'}.`,
    });
    setRewriteProposal(null);
    setRewriteInput('');
  }, [rewriteProposal, updateObject, addObjects, sceneObjects, addCoachMessage]);

  const currentQuestion = guidedFlow[currentQIdx];
  const progressPct = guidedFlow.length
    ? Math.round((currentQIdx / guidedFlow.length) * 100)
    : 0;

  const meta = detectedType ? DOC_TYPE_META[detectedType] : null;

  return (
    <div className="space-y-2">
      {/* ── Sélecteur de mode ÉPINGLÉ (Libre · Suggestions · Rédaction auto) ──
          Il vivait au fil du panneau, sous le header : le moindre défilement le
          sortait du champ visible alors que c'est lui qui pilote tout le reste
          (points 1-3 du cahier). `sticky top-0` le garde sous les yeux, et il passe
          en PREMIER : on choisit son niveau d'assistance avant de lire l'état. */}
      <div className="sticky top-0 z-20 -mt-3 bg-[#1f1e1c] pb-1 pt-3">
        <DocumentAiModeSelector className="mx-3" />
      </div>

      {/* ── Header Document Coach ── */}
      <div className="mx-3 rounded-2xl border border-[#cf8059]/25 bg-[#cf8059]/[0.06] p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#cf8059]/30 bg-[#cf8059]/10">
              <FileText className="h-3 w-3 text-[#cf8059]" />
            </div>
            <span className="text-[11px] font-bold text-[#e0a07e]">Architect Documentaire</span>
          </div>
          {phase !== 'idle' && (
            <button type="button" onClick={resetFlow} title="Recommencer"
              className="flex h-5 w-5 items-center justify-center rounded-md text-white/55 hover:text-white/85 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
        <p className="text-[9.5px] text-white/60 leading-relaxed">
          {phase === 'idle' && 'Décrivez votre document ou choisissez un mode ci-dessous.'}
          {phase === 'detecting' && 'Précisez le type de document souhaité.'}
          {phase === 'questioning' && meta && `${meta.icon} ${meta.label} · Question ${currentQIdx + 1}/${guidedFlow.length}`}
          {phase === 'generating' && 'Construction du plan documentaire…'}
          {phase === 'editing' && meta && `${meta.icon} ${meta.label} · ${documentPlan?.blocks?.length ?? 0} blocs prêts`}
          {phase === 'reviewing' && `${validationIssues.length === 0 ? '✓ Validé' : `${validationIssues.length} point(s) à corriger`}`}
        </p>

        {/* Barre de progression (questioning) */}
        {phase === 'questioning' && guidedFlow.length > 0 && (
          <div className="mt-2 h-1 w-full rounded-full bg-white/[0.06]">
            <motion.div
              className="h-1 rounded-full bg-gradient-to-r from-[#cf8059] to-[#e3aa6b]"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {/* Le sélecteur de mode (ex-« Niveau d'assistance ») est remonté ÉPINGLÉ en tête
          de panneau — voir plus haut. */}

      {/* ── Assistant IA (suggestions / rédaction / repos) ── */}
      <div className="mx-3">
        <DocumentSuggestionsPanel />
      </div>

      {/* ── Input intention (idle / detecting) ── */}
      {!isFreeMode && (phase === 'idle' || phase === 'detecting') && (
        <div className="mx-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-[#2b2a27] px-2.5 py-2">
            <MessageSquare className="h-3 w-3 shrink-0 text-white/50" />
            <input
              value={intentInput}
              onChange={e => setIntentInput(e.target.value)}
              onKeyDown={handleIntentKey}
              placeholder="Ex : Je veux une lettre à une mairie…"
              className="flex-1 bg-transparent text-[10.5px] text-white/80 placeholder:text-white/50 outline-none"
            />
            <button
              type="button" onClick={handleIntentSubmit} disabled={!intentInput.trim()}
              className="flex h-5 w-5 items-center justify-center rounded-md text-[#e08b6d] disabled:text-white/15 hover:text-[#f0a98d] transition-colors"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Raccourcis types de document */}
          {phase === 'idle' && (
            <div className="mt-2 grid grid-cols-3 gap-1">
              {['letter', 'contract', 'attestation', 'cv', 'report', 'invoice'].map(type => {
                const m = DOC_TYPE_META[type];
                return (
                  <button
                    key={type} type="button"
                    onClick={() => detectIntent(m.label.toLowerCase())}
                    className="flex flex-col items-center gap-0.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 hover:bg-white/[0.05] hover:border-white/10 transition-all"
                  >
                    <span className="text-[13px]">{m.icon}</span>
                    <span className="text-[8.5px] text-white/60">{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Question guidée ── */}
      <AnimatePresence mode="wait">
        {!isFreeMode && phase === 'questioning' && currentQuestion && (
          <div key={`q-${currentQIdx}`} className="mx-3">
            <GuidedQuestion
              question={currentQuestion}
              onAnswer={answerQuestion}
              onSkip={() => answerQuestion('—')}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Génération en cours ── */}
      <AnimatePresence>
        {!isFreeMode && (phase === 'generating' || isGenerating) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mx-3 flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-3"
          >
            <motion.div
              animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-500/30"
            >
              <Sparkles className="h-3 w-3 text-amber-400" />
            </motion.div>
            <div>
              <p className="text-[10.5px] font-semibold text-amber-300">Architect en cours…</p>
              <p className="text-[9px] text-white/60">Construction du plan documentaire</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Plan documentaire (editing / reviewing) ── */}
      <AnimatePresence>
        {!isFreeMode && documentPlan && (phase === 'editing' || phase === 'reviewing') && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="mx-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden"
          >
            {/* Header du plan */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
              <span className="text-[14px]">{documentPlan.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-white/85">{documentPlan.label}</p>
                <p className="text-[9px] text-white/60">
                  {documentPlan.blocks.length} blocs · {documentPlan.pages} page{documentPlan.pages > 1 ? 's' : ''} · {documentPlan.tone}
                </p>
              </div>
            </div>

            {/* Liste des blocs */}
            <div className="p-2.5 space-y-1">
              {documentPlan.blocks.map((block, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#cf8059]/75 shrink-0" />
                  <span className="text-[10px] text-white/65 capitalize">{block}</span>
                </div>
              ))}
            </div>

            {/* ── Templates recommandés depuis la bibliothèque ── */}
            {matchedTemplates.length > 0 && (
              <div className="border-t border-white/[0.06] p-2.5 space-y-1.5">
                <p className="text-[8.5px] font-bold uppercase tracking-widest text-white/60 mb-1.5">
                  Modèles recommandés ({matchedTemplates.length})
                </p>
                {pendingTplId ? (
                  <p className="mb-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-2 py-1.5 text-[9px] leading-relaxed text-amber-200/85">
                    La page contient déjà {sceneObjects.length} bloc(s). Le modèle sera <strong>ajouté par-dessus</strong>,
                    rien ne sera effacé. Recliquez pour confirmer.
                  </p>
                ) : null}
                <div className="space-y-1 max-h-44 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.07)_transparent]">
                  {matchedTemplates.slice(0, 8).map(tpl => {
                    const domMeta = DOMAIN_META[tpl.domain] ?? {};
                    const isSelected = documentPlan?.libraryTemplateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          /* ⛔ Poser un 2e modèle par-dessus le 1er superpose deux en-têtes
                             et deux signatures. On demande confirmation, on n'efface JAMAIS. */
                          if (sceneObjects.length > 0 && pendingTplId !== tpl.id) {
                            setPendingTplId(tpl.id);
                            return;
                          }
                          setPendingTplId(null);
                          selectTemplate(tpl.id);
                          setCanvasBg('#ffffff');
                          addObjects(templateToKonvaObjects(tpl));
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all',
                          isSelected
                            ? 'border-[#cf8059]/35 bg-[#cf8059]/[0.08]'
                            : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]',
                        )}
                      >
                        <span className="text-[13px] shrink-0">{domMeta.icon ?? '📄'}</span>
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            'text-[10px] font-semibold truncate',
                            isSelected ? 'text-[#e0a07e]' : 'text-white/70',
                          )}>{tpl.name}</p>
                          <p className="text-[8.5px] text-white/60">
                            {tpl.style_variants?.length ?? 1} style{tpl.style_variants?.length > 1 ? 's' : ''} · {tpl.zones?.length ?? 0} zones
                          </p>
                        </div>
                        {pendingTplId === tpl.id
                          ? <span className="shrink-0 text-[8.5px] font-bold text-amber-300">Cliquez pour confirmer</span>
                          : isSelected && <CheckCircle2 className="h-3 w-3 shrink-0 text-[#cf8059]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions principales */}
            <div className="border-t border-white/[0.06] p-2.5 space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  buildDocumentPlan(documentPlan.answers ?? {});
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] py-2 text-[10.5px] font-semibold text-amber-400 hover:bg-amber-500/10 transition-all"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Régénérer la structure
              </button>
              <button
                type="button"
                onClick={validateDocument}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-[10.5px] font-semibold text-white/65 hover:bg-white/[0.06] transition-all"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Valider le document
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Outils de reformulation (editing) ── */}
      {!isFreeMode && phase === 'editing' && (
        <div className="mx-3 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">Reformulation</p>

          {/* Cible : le bloc sélectionné sur la page prime sur le texte collé. */}
          <p className="text-[9px] leading-relaxed text-white/45">
            {selectedTextObj
              ? <>Cible : <strong className="text-[#e3aa6b]">bloc sélectionné</strong> sur la page.</>
              : <>Aucun bloc sélectionné — le texte collé ci-dessous sera reformulé puis ajouté en nouveau bloc.</>}
          </p>

          {/* Modes de réécriture */}
          <div className="grid grid-cols-3 gap-1">
            {REWRITE_MODES.map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id} type="button"
                  onClick={() => setRewriteMode(m.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border py-2 px-1 transition-all',
                    rewriteMode === m.id
                      ? 'border-[#d97757]/35 bg-[#d97757]/[0.09]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]',
                  )}
                >
                  <Icon className={cn('h-3 w-3', rewriteMode === m.id ? 'text-[#e08b6d]' : 'text-white/50')} />
                  <span className={cn('text-[8.5px]', rewriteMode === m.id ? 'text-[#e08b6d]' : 'text-white/60')}>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Input reformulation */}
          <div className="space-y-1.5">
            {!selectedTextObj && (
              <textarea
                value={rewriteInput}
                onChange={e => setRewriteInput(e.target.value)}
                placeholder="Collez le texte à reformuler…"
                rows={3}
                className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#2b2a27] px-2.5 py-2 text-[10px] text-white/80 placeholder:text-white/50 outline-none focus:border-[#d97757]/45 transition-colors"
              />
            )}
            <button
              type="button"
              onClick={runRewrite}
              disabled={!rewriteSource || rewriteBusy}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#d97757]/30 bg-[#d97757]/[0.09] py-2 text-[10px] font-semibold text-[#e08b6d] hover:bg-[#d97757]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {rewriteBusy
                ? <RotateCcw className="h-3 w-3 animate-spin" />
                : <PenLine className="h-3 w-3" />}
              Reformuler en {REWRITE_MODES.find(m => m.id === rewriteMode)?.label}
            </button>

            {rewriteError ? (
              <p className="rounded-lg border border-red-500/25 bg-red-500/[0.07] px-2 py-1.5 text-[9.5px] leading-relaxed text-red-300">
                {rewriteError}
              </p>
            ) : null}

            {rewriteProposal ? (
              <TextDiffPreview
                title={`Reformulation — ${rewriteProposal.label}`}
                before={rewriteProposal.before}
                after={rewriteProposal.after}
                busy={rewriteBusy}
                applyLabel={rewriteProposal.targetId ? 'Remplacer le bloc' : 'Ajouter en nouveau bloc'}
                onApply={applyRewrite}
                onRegenerate={runRewrite}
                onCancel={() => setRewriteProposal(null)}
              />
            ) : null}
          </div>
        </div>
      )}

      {/* ── Rappels du plan (heuristique locale, pas une analyse IA) ── */}
      {!isFreeMode && suggestions.length > 0 && (phase === 'editing' || phase === 'reviewing') && (
        <div className="mx-3 space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">Rappels du plan</p>
          {suggestions.map((s, i) => {
            const style = SEVERITY_STYLES[s.severity] ?? SEVERITY_STYLES.info;
            const Icon = style.icon;
            return (
              <div key={i} className={cn('flex items-center gap-2 rounded-xl border px-2.5 py-2', style.bg)}>
                <Icon className={cn('h-3 w-3 shrink-0', style.cls)} />
                <span className="text-[10px] text-white/65">{s.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Résultats de validation ── */}
      {phase === 'reviewing' && (
        <div className="mx-3 space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">Validation</p>
          {validationIssues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#5a8f52]/30 bg-[#5a8f52]/[0.10] px-2.5 py-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#7bb06a]" />
              <span className="text-[10.5px] font-semibold text-[#9cc48a]">Document validé — prêt pour export</span>
            </div>
          ) : (
            validationIssues.map((issue, i) => {
              const style = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info;
              const Icon = style.icon;
              return (
                <div key={i} className={cn('flex items-center gap-2 rounded-xl border px-2.5 py-2', style.bg)}>
                  <Icon className={cn('h-3 w-3 shrink-0', style.cls)} />
                  <span className="text-[10px] text-white/65">{issue.message}</span>
                </div>
              );
            })
          )}
          <button
            type="button" onClick={resetFlow}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] py-2 text-[10px] text-white/60 hover:text-white/85 hover:bg-white/[0.05] transition-all"
          >
            <RotateCcw className="h-3 w-3" /> Nouveau document
          </button>
        </div>
      )}

      {/* ── Flux messages du coach ── */}
      {coachMessages.length > 0 && (
        <div className="mx-3 space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">Historique Architect</p>
          <div ref={messagesBoxRef} className="max-h-52 space-y-1.5 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.07)_transparent]">
            {coachMessages.map(msg => (
              <CoachBubble key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
