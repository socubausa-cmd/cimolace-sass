/**
 * DocumentCoachPanel — IA Architect Documentaire (section AIHub)
 *
 * Rendu dans l'AIHub quand docType === 'document'.
 * Gère 6 phases : idle · detecting · questioning · generating · editing · reviewing
 *
 * Design tokens : #12111a · border-white/[0.07] · text-[10px..12px]
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
  ASSISTANCE_LEVELS,
} from '@/features/smartboard-konva-editor/store/useDocumentCoachStore';
import {
  DOMAIN_META,
  templateToKonvaObjects,
} from '@/features/smartboard-konva-editor/lib/documentTemplateLibrary';
import { useSmartboardKonvaStore as _useKStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import { useSmartboardKonvaStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';

/* ─── Tokens locaux ─────────────────────────────────────────────── */
const SEVERITY_STYLES = {
  error:   { icon: AlertTriangle, cls: 'text-red-400',     bg: 'bg-red-500/[0.07] border-red-500/20'     },
  warning: { icon: AlertTriangle, cls: 'text-amber-400',   bg: 'bg-amber-500/[0.07] border-amber-500/20' },
  info:    { icon: Info,          cls: 'text-blue-400',    bg: 'bg-blue-500/[0.07] border-blue-500/20'   },
};

const REWRITE_MODES = [
  { id: 'admin',     label: 'Administratif', icon: ScrollText },
  { id: 'formalize', label: 'Formel',        icon: BookOpen   },
  { id: 'simplify',  label: 'Simple',        icon: Lightbulb  },
  { id: 'legalize',  label: 'Juridique',     icon: Layers     },
  { id: 'expand',    label: 'Développer',    icon: Zap        },
  { id: 'compress',  label: 'Résumer',       icon: ScanLine   },
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
            : 'bg-emerald-500/[0.07] border border-emerald-500/15 text-white/80 rounded-tl-sm',
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
            className="flex-1 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] py-2 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors"
          >
            Oui
          </button>
          <button
            type="button" onClick={() => onAnswer('Non')}
            className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-[10px] font-semibold text-white/50 hover:bg-white/[0.06] transition-colors"
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
                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                  : 'border-white/[0.07] bg-white/[0.02] text-white/55 hover:bg-white/[0.05]',
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
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[10.5px] text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-500/30 focus:bg-cyan-500/[0.03] transition-colors"
            />
          ) : (
            <input
              ref={inputRef}
              value={value} onChange={e => setValue(e.target.value)} onKeyDown={handleKey}
              placeholder="Votre réponse…"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[10.5px] text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-500/30 transition-colors"
            />
          )}
          <div className="flex items-center justify-between">
            <button
              type="button" onClick={onSkip}
              className="text-[9.5px] text-white/25 hover:text-white/45 transition-colors"
            >
              Passer
            </button>
            <button
              type="button" onClick={submit} disabled={!value.trim()}
              className="flex items-center gap-1 rounded-lg border border-cyan-500/25 bg-cyan-500/[0.08] px-3 py-1.5 text-[10px] font-semibold text-cyan-400 hover:bg-cyan-500/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
  const assistanceLevel   = useDocumentCoachStore(s => s.assistanceLevel);
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
  const setAssistanceLevel = useDocumentCoachStore(s => s.setAssistanceLevel);
  const resetFlow          = useDocumentCoachStore(s => s.resetFlow);
  const validateDocument   = useDocumentCoachStore(s => s.validateDocument);
  const requestRewrite     = useDocumentCoachStore(s => s.requestRewrite);
  const buildDocumentPlan  = useDocumentCoachStore(s => s.buildDocumentPlan);

  /* Smartboard store — pour envoyer les messages au flux LONGIA */
  const addLongiaMessage = useSmartboardKonvaStore(s => s.addLongiaMessage);

  /* Local input state (phase idle/detecting) */
  const [intentInput, setIntentInput] = useState('');
  const [rewriteInput, setRewriteInput] = useState('');
  const [rewriteMode, setRewriteMode] = useState('formalize');
  const messagesEndRef = useRef(null);

  /* Auto-scroll aux messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const currentQuestion = guidedFlow[currentQIdx];
  const progressPct = guidedFlow.length
    ? Math.round((currentQIdx / guidedFlow.length) * 100)
    : 0;

  const meta = detectedType ? DOC_TYPE_META[detectedType] : null;

  return (
    <div className="space-y-2">
      {/* ── Header Document Coach ── */}
      <div className="mx-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
              <FileText className="h-3 w-3 text-emerald-400" />
            </div>
            <span className="text-[11px] font-bold text-emerald-300">Architect Documentaire</span>
          </div>
          {phase !== 'idle' && (
            <button type="button" onClick={resetFlow} title="Recommencer"
              className="flex h-5 w-5 items-center justify-center rounded-md text-white/20 hover:text-white/50 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
        <p className="text-[9.5px] text-white/40 leading-relaxed">
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
              className="h-1 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {/* ── Niveaux d'assistance ── */}
      {phase === 'idle' && (
        <div className="mx-3 space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Niveau d'assistance</p>
          {ASSISTANCE_LEVELS.map(lvl => (
            <button
              key={lvl.level} type="button"
              onClick={() => setAssistanceLevel(lvl.level)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all',
                assistanceLevel === lvl.level
                  ? 'border-cyan-500/30 bg-cyan-500/[0.07]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]',
              )}
            >
              <span className="text-[13px]">{lvl.icon}</span>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  'text-[10.5px] font-semibold',
                  assistanceLevel === lvl.level ? 'text-cyan-300' : 'text-white/60',
                )}>{lvl.label}</p>
                <p className="text-[9px] text-white/30">{lvl.desc}</p>
              </div>
              {assistanceLevel === lvl.level && (
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Input intention (idle / detecting) ── */}
      {(phase === 'idle' || phase === 'detecting') && (
        <div className="mx-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.03] px-2.5 py-2">
            <MessageSquare className="h-3 w-3 shrink-0 text-white/25" />
            <input
              value={intentInput}
              onChange={e => setIntentInput(e.target.value)}
              onKeyDown={handleIntentKey}
              placeholder="Ex : Je veux une lettre à une mairie…"
              className="flex-1 bg-transparent text-[10.5px] text-white/80 placeholder:text-white/20 outline-none"
            />
            <button
              type="button" onClick={handleIntentSubmit} disabled={!intentInput.trim()}
              className="flex h-5 w-5 items-center justify-center rounded-md text-emerald-400 disabled:text-white/15 hover:text-emerald-300 transition-colors"
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
                    <span className="text-[8.5px] text-white/40">{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Question guidée ── */}
      <AnimatePresence mode="wait">
        {phase === 'questioning' && currentQuestion && (
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
        {(phase === 'generating' || isGenerating) && (
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
              <p className="text-[9px] text-white/35">Construction du plan documentaire</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Plan documentaire (editing / reviewing) ── */}
      <AnimatePresence>
        {documentPlan && (phase === 'editing' || phase === 'reviewing') && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="mx-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden"
          >
            {/* Header du plan */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
              <span className="text-[14px]">{documentPlan.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-white/85">{documentPlan.label}</p>
                <p className="text-[9px] text-white/35">
                  {documentPlan.blocks.length} blocs · {documentPlan.pages} page{documentPlan.pages > 1 ? 's' : ''} · {documentPlan.tone}
                </p>
              </div>
            </div>

            {/* Liste des blocs */}
            <div className="p-2.5 space-y-1">
              {documentPlan.blocks.map((block, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/60 shrink-0" />
                  <span className="text-[10px] text-white/65 capitalize">{block}</span>
                </div>
              ))}
            </div>

            {/* ── Templates recommandés depuis la bibliothèque ── */}
            {matchedTemplates.length > 0 && (
              <div className="border-t border-white/[0.06] p-2.5 space-y-1.5">
                <p className="text-[8.5px] font-bold uppercase tracking-widest text-white/25 mb-1.5">
                  Modèles recommandés ({matchedTemplates.length})
                </p>
                <div className="space-y-1 max-h-44 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.07)_transparent]">
                  {matchedTemplates.slice(0, 8).map(tpl => {
                    const domMeta = DOMAIN_META[tpl.domain] ?? {};
                    const isSelected = documentPlan?.libraryTemplateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          selectTemplate(tpl.id);
                          setCanvasBg('#ffffff');
                          addObjects(templateToKonvaObjects(tpl));
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all',
                          isSelected
                            ? 'border-emerald-500/30 bg-emerald-500/[0.07]'
                            : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]',
                        )}
                      >
                        <span className="text-[13px] shrink-0">{domMeta.icon ?? '📄'}</span>
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            'text-[10px] font-semibold truncate',
                            isSelected ? 'text-emerald-300' : 'text-white/70',
                          )}>{tpl.name}</p>
                          <p className="text-[8.5px] text-white/30">
                            {tpl.style_variants?.length ?? 1} style{tpl.style_variants?.length > 1 ? 's' : ''} · {tpl.zones?.length ?? 0} zones
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />}
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] py-2 text-[10.5px] font-semibold text-amber-400 hover:bg-amber-500/12 transition-all"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Régénérer la structure
              </button>
              <button
                type="button"
                onClick={validateDocument}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-[10.5px] font-semibold text-white/55 hover:bg-white/[0.06] transition-all"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Valider le document
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Outils de reformulation (editing) ── */}
      {phase === 'editing' && (
        <div className="mx-3 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Reformulation</p>

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
                      ? 'border-violet-500/30 bg-violet-500/[0.07]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]',
                  )}
                >
                  <Icon className={cn('h-3 w-3', rewriteMode === m.id ? 'text-violet-400' : 'text-white/25')} />
                  <span className={cn('text-[8.5px]', rewriteMode === m.id ? 'text-violet-300' : 'text-white/35')}>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Input reformulation */}
          <div className="space-y-1.5">
            <textarea
              value={rewriteInput}
              onChange={e => setRewriteInput(e.target.value)}
              placeholder="Collez le texte à reformuler…"
              rows={3}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[10px] text-white/75 placeholder:text-white/20 outline-none focus:border-violet-500/30 transition-colors"
            />
            <button
              type="button"
              onClick={() => { if (rewriteInput.trim()) { requestRewrite(rewriteInput.trim(), rewriteMode); setRewriteInput(''); } }}
              disabled={!rewriteInput.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-500/[0.07] py-2 text-[10px] font-semibold text-violet-400 hover:bg-violet-500/12 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <PenLine className="h-3 w-3" />
              Reformuler en {REWRITE_MODES.find(m => m.id === rewriteMode)?.label}
            </button>
          </div>
        </div>
      )}

      {/* ── Suggestions intelligentes ── */}
      {suggestions.length > 0 && (phase === 'editing' || phase === 'reviewing') && (
        <div className="mx-3 space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Suggestions</p>
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
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Validation</p>
          {validationIssues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-[10.5px] font-semibold text-emerald-300">Document validé — prêt pour export</span>
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
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] py-2 text-[10px] text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition-all"
          >
            <RotateCcw className="h-3 w-3" /> Nouveau document
          </button>
        </div>
      )}

      {/* ── Flux messages du coach ── */}
      {coachMessages.length > 0 && (
        <div className="mx-3 space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Historique Architect</p>
          <div className="max-h-52 space-y-1.5 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.07)_transparent]">
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
