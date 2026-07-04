/**
 * Masterclass Factory V2 — Pipeline séquentiel 4 étapes
 * Analyse → Blocs → Chapitres → Pédagogie → Export
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, FileText, Layers, BookOpen, Brain,
  LayoutTemplate, Mic, Download, ChevronRight,
  ArrowLeft, Play, Loader2, CheckCircle2, AlertCircle,
  Copy, ExternalLink, Activity, Upload, Clipboard,
  HelpCircle, X, Wand2, ChevronDown, Zap, Settings2,
  MessageSquare, RefreshCw, ArrowRight, RotateCcw, Search,
} from 'lucide-react';
import {
  useMasterclassProject,
  PEDAGOGICAL_MODELS,
  MAX_RAW_CHARS,
  DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS,
} from '@/hooks/useMasterclassProject';
import { useOrchestratorLiveStore } from '@/stores/orchestrator-live.store';

// ─── Design tokens ─────────────────────────────────────────────────────────
const BG      = '#080c14';
const SURFACE = '#0f1520';
const PANEL   = '#141c2d';
const BORDER  = '#1e2a40';
const GOLD    = '#D4AF37';
const VIOLET  = '#a78bfa';
const GREEN   = '#22c55e';
const CYAN    = '#38bdf8';

// ─── Étapes du pipeline ────────────────────────────────────────────────────
const STEPS = [
  { id: 0, icon: FileText,       label: 'Source',    sub: 'Texte brut'          },
  { id: 1, icon: Brain,          label: 'Analyse',   sub: 'Thème & structure'   },
  { id: 2, icon: Layers,         label: 'Blocs',     sub: 'Segments LIRI'       },
  { id: 3, icon: BookOpen,       label: 'Chapitres', sub: 'Architecture cours'  },
  { id: 4, icon: Sparkles,       label: 'Pédagogie', sub: '21 segments'         },
  { id: 5, icon: LayoutTemplate, label: 'Slides',    sub: 'SmartBoard ready'    },
  { id: 6, icon: Mic,            label: 'Script',    sub: 'Mot à mot'           },
  { id: 7, icon: Download,       label: 'Export',    sub: 'Multi-formats'       },
];

// ─── Utilitaire téléchargement sans leak mémoire ─────────────────────────────
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  // Libère l'URL object immédiatement après le clic (évite la fuite mémoire)
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/** Recherche plein texte locale (sans index IA). */
function findLocalTextMatches(text, query, maxResults = 80, contextChars = 44) {
  if (!text || !query?.trim()) return [];
  const q = query.trim();
  const lowerT = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const out = [];
  let i = 0;
  while (out.length < maxResults) {
    const j = lowerT.indexOf(lowerQ, i);
    if (j === -1) break;
    const start = j;
    const end = j + q.length;
    const c0 = Math.max(0, start - contextChars);
    const c1 = Math.min(text.length, end + contextChars);
    const snippet =
      (c0 > 0 ? '…' : '') +
      text.slice(c0, c1).replace(/\s+/g, ' ').trim() +
      (c1 < text.length ? '…' : '');
    out.push({ start, end, snippet });
    i = j + 1;
  }
  return out;
}

function StepAnalysisLocalSearch({ rawText, structureCharEnd }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('analyzed');
  const spanEnd = useMemo(() => {
    if (!rawText) return 0;
    const cap = structureCharEnd != null ? Math.min(structureCharEnd, rawText.length) : rawText.length;
    return Math.max(0, cap);
  }, [rawText, structureCharEnd]);
  const haystack = scope === 'analyzed' && rawText ? rawText.slice(0, spanEnd) : (rawText ?? '');
  const matches = useMemo(() => findLocalTextMatches(haystack, query), [haystack, query]);

  if (!rawText?.trim()) return null;

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2">
        <Search size={14} className="text-slate-500 shrink-0" />
        <p className="text-xs uppercase tracking-widest text-slate-500">Recherche dans le texte source</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Mot ou phrase…"
          className="flex-1 min-w-[140px] rounded-lg text-xs text-slate-200 placeholder:text-slate-500 outline-none px-3 py-2"
          style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
        />
        <div className="flex rounded-lg overflow-hidden text-[10px]" style={{ border: `1px solid ${BORDER}` }}>
          <button
            type="button"
            onClick={() => setScope('analyzed')}
            className="px-2.5 py-1.5 font-medium"
            style={{
              background: scope === 'analyzed' ? `${VIOLET}25` : PANEL,
              color: scope === 'analyzed' ? '#e2e8f0' : '#64748b',
            }}
          >
            Zone analysée
          </button>
          <button
            type="button"
            onClick={() => setScope('full')}
            className="px-2.5 py-1.5 font-medium"
            style={{
              background: scope === 'full' ? `${VIOLET}25` : PANEL,
              color: scope === 'full' ? '#e2e8f0' : '#64748b',
            }}
          >
            Texte complet
          </button>
        </div>
      </div>
      {query.trim() && (
        <p className="text-[10px] text-slate-500">
          {matches.length} occurrence{matches.length !== 1 ? 's' : ''}
          {scope === 'analyzed' && structureCharEnd != null && (
            <span>{' '}· positions dans les {spanEnd.toLocaleString('fr-FR')} premiers car.</span>
          )}
        </p>
      )}
      {matches.length > 0 && (
        <ul className="max-h-40 overflow-y-auto space-y-1.5 text-[10px] text-slate-400">
          {matches.slice(0, 40).map((m, idx) => (
            <li key={`${m.start}-${idx}`} className="leading-snug border-l-2 border-[#d97757]/30 pl-2">
              <span className="text-slate-500 tabular-nums">{m.start}–{m.end}</span>
              {' · '}
              <span className="text-slate-300">{m.snippet}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Composant Step Sidebar ─────────────────────────────────────────────────
function StepRail({ currentStep, completedSteps, stepStatus, onGoTo }) {
  return (
    <nav className="flex flex-col gap-1 py-6 px-3">
      {STEPS.map((s) => {
        const Icon    = s.icon;
        const done    = completedSteps.includes(s.id);
        const active  = currentStep === s.id;
        const running = stepStatus?.[s.id] === 'running';
        const errored = stepStatus?.[s.id] === 'error';

        return (
          <button
            key={s.id}
            onClick={() => onGoTo(s.id)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
            style={{
              background: active ? `${VIOLET}18` : 'transparent',
              border: `1px solid ${active ? VIOLET + '40' : 'transparent'}`,
              cursor: 'pointer',
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: errored ? '#f4363620' : done ? '#22c55e20' : active ? `${VIOLET}25` : '#ffffff08',
                border: `1px solid ${errored ? '#f4363640' : done ? '#22c55e40' : active ? VIOLET + '50' : '#ffffff10'}`,
              }}
            >
              {errored  ? <AlertCircle size={13} color="#f43636" />
              : running  ? <Loader2 size={13} color={VIOLET} className="animate-spin" />
              : done     ? <CheckCircle2 size={13} color="#22c55e" />
              : <Icon size={13} color={active ? VIOLET : '#64748b'} />}
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: active ? '#e2e8f0' : '#475569' }}>{s.label}</p>
              <p className="text-[10px]" style={{ color: active ? '#64748b' : '#334155' }}>{s.sub}</p>
            </div>
            {running && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: VIOLET }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Configs cours & IA ───────────────────────────────────────────────────
const COURSE_TYPES = [
  { id: 'masterclass',  label: 'Masterclass',          icon: '🎓', desc: 'Formation complète multi-chapitres'       },
  { id: 'conference',   label: 'Conférence de vente',   icon: '💼', desc: 'Persuasion, storytelling, conversion'     },
  { id: 'science',      label: 'Cours scientifique',    icon: '🔬', desc: 'Rigueur, preuves, démonstrations'         },
  { id: 'philosophie',  label: 'Philosophie / Sagesse', icon: '🧠', desc: 'Doctrine, réflexion, adage'              },
  { id: 'tutoriel',     label: 'Tutoriel pratique',     icon: '🛠️', desc: 'Étapes, exercices, résultats concrets'   },
  { id: 'webinaire',    label: 'Webinaire / Live',      icon: '📡', desc: 'Interaction, Q&A, engagement direct'     },
];

const AI_PROVIDERS = [
  { id: 'claude',   label: 'Claude',   model: 'claude-haiku-4-5', color: '#D4AF37', tokens: 180000, cost: '0.25$/1M' },
  { id: 'openai',   label: 'OpenAI',   model: 'gpt-4o-mini',      color: '#34d399', tokens: 128000, cost: '0.15$/1M' },
  { id: 'groq',     label: 'Groq',     model: 'llama-3.3-70b',    color: '#a78bfa', tokens:  32768, cost: '0.06$/1M' },
  { id: 'deepseek', label: 'DeepSeek', model: 'deepseek-chat',    color: '#38bdf8', tokens:  65536, cost: '0.14$/1M' },
];

// ─── Switcher de modèle pédagogique ──────────────────────────────────────────
function PedagogicalModelSwitcher({ value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">Modèle pédagogique</p>
      <div className="grid grid-cols-2 gap-2">
        {PEDAGOGICAL_MODELS.map(m => {
          const active = value === m.id;
          return (
            <button key={m.id} onClick={() => onChange(m.id)}
              className="flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all"
              style={{
                background: active ? `${m.color}15` : PANEL,
                border: `1px solid ${active ? m.color + '50' : BORDER}`,
                boxShadow: active ? `0 0 16px ${m.color}20` : 'none',
              }}>
              <span className="text-xl shrink-0 mt-0.5">{m.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold truncate" style={{ color: active ? m.color : '#94a3b8' }}>
                    {m.label}
                  </p>
                  {active && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0"
                      style={{ background: `${m.color}20`, color: m.color }}>
                      ACTIF
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{m.desc}</p>
                <p className="text-[9px] font-semibold mt-1.5" style={{ color: active ? m.color : '#475569' }}>
                  {m.segments} segments par chapitre
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {/* Badge comparatif */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <div className="rounded-lg px-3 py-2" style={{ background: `#D4AF3710`, border: `1px solid #D4AF3725` }}>
          <p className="text-[9px] text-slate-500 mb-0.5">LIRI 21</p>
          <p className="text-[10px] font-medium" style={{ color: '#D4AF37' }}>Méthode doctrinale structurée</p>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: `#f43f5e10`, border: `1px solid #f43f5e25` }}>
          <p className="text-[9px] text-slate-500 mb-0.5">Échec Productif 26</p>
          <p className="text-[10px] font-medium" style={{ color: '#f43f5e' }}>L\'élève échoue avant d\'apprendre</p>
        </div>
      </div>
    </div>
  );
}

// ─── Étape 0 — Source ──────────────────────────────────────────────────────
function StepSource({ rawText, onSetRaw, onLaunch, loading, onLoadDemo, onImportProject,
  courseType, onCourseType, aiProvider, onAiProvider,
  pedagogicalModel, onPedagogicalModel,
  documentAnalyzeOptions, onDocumentAnalyzeOptionsChange }) {

  const fileRef     = useRef(null);
  const jsonRef     = useRef(null);  // fichier JSON de restauration
  const textaRef    = useRef(null);
  const coachCtrlRef = useRef(null); // AbortController pour annuler les appels coach en doublon
  const [showHelp,      setShowHelp]      = useState(false);
  const [showCoach,     setShowCoach]     = useState(false);
  const [coachInput,    setCoachInput]    = useState('');
  const [coachReply,    setCoachReply]    = useState('');
  const [coachLoad,     setCoachLoad]     = useState(false);
  const [showTypes,     setShowTypes]     = useState(false);
  const [showProviders, setShowProviders] = useState(false);
  const [importError,   setImportError]   = useState('');

  const charCount = (rawText ?? '').length;
  const ready     = charCount >= 100;
  const estTokens = Math.ceil(charCount / 4);
  const selType   = COURSE_TYPES.find(t => t.id === courseType) ?? COURSE_TYPES[0];
  const selAI     = AI_PROVIDERS.find(p => p.id === aiProvider) ?? AI_PROVIDERS[0];

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onSetRaw?.(ev.target.result ?? '');
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }, [onSetRaw]);

  const handleImportJson = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result ?? '{}');
        // Validation minimale : doit ressembler à un projet LIRI
        if (!parsed.rawText && !parsed.chapters && !parsed.pedagogy && !parsed.analysis) {
          setImportError('Fichier non reconnu — ce JSON ne semble pas être un projet LIRI.');
          return;
        }
        setImportError('');
        onImportProject?.(parsed);
      } catch {
        setImportError('Fichier JSON invalide — vérifiez le format.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }, [onImportProject]);

  const handlePasteClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onSetRaw?.((rawText ?? '') + text);
    } catch {
      textaRef.current?.focus();
    }
  }, [rawText, onSetRaw]);

  const handleCoachReformat = useCallback(async () => {
    if (!coachInput.trim() && !(rawText ?? '').trim()) return;
    // Annuler tout appel précédent en cours (évite les race conditions)
    coachCtrlRef.current?.abort();
    const ctrl = new AbortController();
    coachCtrlRef.current = ctrl;
    setCoachLoad(true);
    try {
      const res = await fetch('/.netlify/functions/liri-neuronq-reformulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, instruction: coachInput || 'Reformule ce texte pour un cours pédagogique clair et structuré.' }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      setCoachReply(data.result ?? data.text ?? 'Pas de réponse du coach.');
    } catch (e) {
      if (e?.name !== 'AbortError') setCoachReply('Erreur de connexion au coach IA.');
    } finally {
      setCoachLoad(false);
    }
  }, [rawText, coachInput]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Contenu source</h2>
          <p className="text-slate-500 text-sm">Transcription, article, notes de cours, idée développée…</p>
        </div>
        <button onClick={() => setShowHelp(h => !h)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ background: PANEL, color: '#64748b', border: `1px solid ${BORDER}` }}>
          <HelpCircle size={12} /> Aide
        </button>
      </div>

      <AnimatePresence>
        {showHelp && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-xl p-4 text-sm" style={{ background: `${VIOLET}10`, border: `1px solid ${VIOLET}30` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-semibold">Pipeline séquentiel LIRI</p>
                <button onClick={() => setShowHelp(false)}><X size={13} color="#64748b" /></button>
              </div>
              <ul className="space-y-1.5 text-slate-400 text-xs">
                <li>① <strong className="text-slate-300">Analyse</strong> — Thème, audience, durée, structure globale</li>
                <li>② <strong className="text-slate-300">Blocs de sens</strong> — découpage du texte source en unités thématiques ; la <strong className="text-slate-300">factory</strong> produit en parallèle les chapitres × 21/26 segments LIRI</li>
                <li>③ <strong className="text-slate-300">Chapitres</strong> — Regroupement en chapitres avec objectifs</li>
                <li>④ <strong className="text-slate-300">Pédagogie</strong> — 21 segments par chapitre + slides + scripts</li>
                <li>📋 Collez votre texte, 📁 importez un fichier .txt, ou utilisez le texte démo</li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Type de cours</p>
          <button onClick={() => { setShowTypes(v => !v); setShowProviders(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
            style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
            <span>{selType.icon}</span>
            <span className="flex-1 text-slate-200 font-medium text-xs truncate">{selType.label}</span>
            <ChevronDown size={12} color="#475569" />
          </button>
          <AnimatePresence>
            {showTypes && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl overflow-hidden shadow-2xl"
                style={{ background: '#0f1520', border: `1px solid ${BORDER}` }}>
                {COURSE_TYPES.map(t => (
                  <button key={t.id} onClick={() => { onCourseType(t.id); setShowTypes(false); }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                    style={{ borderBottom: `1px solid ${BORDER}20` }}>
                    <span className="text-base shrink-0">{t.icon}</span>
                    <div>
                      <p className="text-white text-xs font-semibold">{t.label}</p>
                      <p className="text-slate-500 text-[10px]">{t.desc}</p>
                    </div>
                    {t.id === courseType && <CheckCircle2 size={12} color="#22c55e" className="ml-auto mt-0.5 shrink-0" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Moteur IA</p>
          <button onClick={() => { setShowProviders(v => !v); setShowTypes(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
            style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: selAI.color }} />
            <span className="flex-1 text-slate-200 font-medium text-xs">{selAI.label}</span>
            <span className="text-[10px] text-slate-500">{selAI.cost}</span>
            <ChevronDown size={12} color="#475569" />
          </button>
          <AnimatePresence>
            {showProviders && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl overflow-hidden shadow-2xl"
                style={{ background: '#0f1520', border: `1px solid ${BORDER}` }}>
                {AI_PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => { onAiProvider(p.id); setShowProviders(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                    style={{ borderBottom: `1px solid ${BORDER}20` }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                    <div className="flex-1">
                      <p className="text-white text-xs font-semibold">{p.label}</p>
                      <p className="text-slate-500 text-[10px]">{p.model} · {(p.tokens/1000).toFixed(0)}k ctx</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold" style={{ color: p.color }}>{p.cost}</p>
                    </div>
                    {p.id === aiProvider && <CheckCircle2 size={12} color="#22c55e" className="shrink-0" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {charCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg"
          style={{ background: `${selAI.color}08`, border: `1px solid ${selAI.color}20` }}>
          <Zap size={11} color={selAI.color} />
          <span className="text-[11px]" style={{ color: selAI.color }}>
            ~{estTokens.toLocaleString()} tokens estimés
          </span>
          <span className="text-[10px] text-slate-500 ml-auto">
            Contexte max : {(selAI.tokens/1000).toFixed(0)}k · {selAI.cost}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input ref={fileRef} type="file" accept=".txt,.md,.csv" className="hidden" onChange={handleFile} />
        <input ref={jsonRef} type="file" accept=".json"         className="hidden" onChange={handleImportJson} />
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/5"
          style={{ background: PANEL, color: '#94a3b8', border: `1px solid ${BORDER}` }}>
          <Upload size={12} /> Importer fichier
        </button>
        <button onClick={() => { setImportError(''); jsonRef.current?.click(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/5"
          style={{ background: PANEL, color: '#94a3b8', border: `1px solid ${BORDER}` }}>
          <Download size={12} /> Restaurer JSON
        </button>
        {importError && (
          <p className="w-full text-[10px] text-red-400 mt-1 px-1">{importError}</p>
        )}
        <button onClick={handlePasteClipboard}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/5"
          style={{ background: PANEL, color: '#94a3b8', border: `1px solid ${BORDER}` }}>
          <Clipboard size={12} /> Coller presse-papier
        </button>
        <button onClick={() => setShowCoach(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{ background: showCoach ? `${VIOLET}15` : PANEL, color: showCoach ? VIOLET : '#94a3b8',
            border: `1px solid ${showCoach ? VIOLET + '40' : BORDER}` }}>
          <MessageSquare size={12} /> Coach IA
        </button>
        <button onClick={onLoadDemo}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/5 ml-auto"
          style={{ background: 'transparent', color: '#334155', border: `1px solid transparent` }}>
          <RefreshCw size={11} /> Texte démo
        </button>
      </div>

      <AnimatePresence>
        {showCoach && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-xl p-4 space-y-3" style={{ background: `${VIOLET}08`, border: `1px solid ${VIOLET}25` }}>
              <div className="flex items-center gap-2 mb-1">
                <Wand2 size={13} color={VIOLET} />
                <p className="text-white font-semibold text-sm">Coach IA — Reformulation</p>
              </div>
              <textarea
                value={coachInput}
                onChange={e => setCoachInput(e.target.value)}
                placeholder="Donne une instruction au coach (ex: 'Rends ce texte plus pédagogique', 'Ajoute des exemples')…"
                rows={2}
                className="w-full rounded-lg text-xs text-slate-300 placeholder:text-slate-500 resize-none outline-none p-3"
                style={{ background: PANEL, border: `1px solid ${BORDER}`, fontFamily: 'inherit' }}
              />
              <div className="flex items-center gap-2">
                <button onClick={handleCoachReformat} disabled={coachLoad || !rawText?.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                  style={{ background: VIOLET, color: '#fff' }}>
                  {coachLoad ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                  Reformuler
                </button>
                {coachReply && (
                  <button onClick={() => { onSetRaw?.(coachReply); setCoachReply(''); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                    style={{ background: '#22c55e20', color: '#22c55e', border: '1px solid #22c55e30' }}>
                    <CheckCircle2 size={11} /> Utiliser ce texte
                  </button>
                )}
              </div>
              {coachReply && (
                <div className="rounded-lg p-3 text-xs text-slate-300 leading-relaxed max-h-40 overflow-y-auto"
                  style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
                  {coachReply}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <textarea
          ref={textaRef}
          value={rawText ?? ''}
          onChange={e => onSetRaw?.(e.target.value)}
          onPaste={e => { e.stopPropagation(); }}
          placeholder={`Collez votre texte ici (minimum 100 caractères)…\n\nExemples : transcription YouTube, notes de cours, article, conférence…`}
          className="w-full min-h-[280px] rounded-xl text-sm text-slate-200 placeholder:text-slate-500 resize-y outline-none p-5 leading-relaxed"
          style={{ background: PANEL, border: `1px solid ${ready ? '#22c55e30' : BORDER}`, fontFamily: 'inherit' }}
        />
        <div className="absolute bottom-3 right-4 flex items-center gap-2">
          {charCount > 0 && (
            <button onClick={() => onSetRaw?.('')}
              className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors px-2 py-1 rounded">
              Effacer
            </button>
          )}
          <span className="text-[10px]" style={{ color: charCount > MAX_RAW_CHARS ? '#f87171' : ready ? '#22c55e80' : '#64748b' }}>
            {charCount.toLocaleString()}{MAX_RAW_CHARS ? `/${MAX_RAW_CHARS.toLocaleString()}` : ''} car. {!ready && `(min. 100)`}
          </span>
        </div>
      </div>

      {/* Avertissement limite caractères */}
      {charCount > MAX_RAW_CHARS && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs"
          style={{ background: '#f8717110', border: '1px solid #f8717130', color: '#f87171' }}>
          <AlertCircle size={13} className="shrink-0" />
          <span>
            Le texte dépasse la limite recommandée de {MAX_RAW_CHARS.toLocaleString()} caractères
            ({(charCount - MAX_RAW_CHARS).toLocaleString()} en trop). L'IA pourrait tronquer le contenu.
          </span>
        </div>
      )}

      <div className="rounded-xl p-4 space-y-3" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2">
          <Settings2 size={14} className="text-slate-500 shrink-0" />
          <p className="text-white text-xs font-semibold">Options d'analyse du document</p>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Règlages pour le découpage horodaté et la couverture du texte (fonction Netlify dédiée).
        </p>
        <label className={`flex items-start gap-3 ${charCount > DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
          <input
            type="checkbox"
            className="mt-0.5 rounded border-slate-600"
            checked={!!documentAnalyzeOptions?.secondWindow}
            onChange={(e) => onDocumentAnalyzeOptionsChange?.({ secondWindow: e.target.checked })}
            disabled={charCount <= DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS}
          />
          <span>
            <span className="text-slate-200 text-xs font-medium block">
              2ᵉ fenêtre ({DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS.toLocaleString('fr-FR')} – {(DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS * 2).toLocaleString('fr-FR')} car.)
            </span>
            <span className="text-[10px] text-slate-500">
              {charCount <= DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS
                ? `Disponible lorsque le texte dépasse ${DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS.toLocaleString('fr-FR')} car.`
                : 'Analyse la suite du document et fusionne avec la première fenêtre. Allonge l\'exécution.'}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-slate-600"
            checked={documentAnalyzeOptions?.gapFill !== false}
            onChange={(e) => onDocumentAnalyzeOptionsChange?.({ gapFill: e.target.checked })}
          />
          <span>
            <span className="text-slate-200 text-xs font-medium block">Compléter les trous (gap-fill IA)</span>
            <span className="text-[10px] text-slate-500">
              Repasse sur les zones peu couvertes par les fragments pour améliorer la carte du texte.
            </span>
          </span>
        </label>
        {(documentAnalyzeOptions?.secondWindow && documentAnalyzeOptions?.gapFill !== false) && (
          <p className="text-[10px] text-amber-200/90 rounded-lg px-2 py-1.5"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
            Combiner les deux augmente le temps d'exécution et le risque de timeout côté hébergeur.
          </p>
        )}
      </div>

      {/* Sélecteur de modèle pédagogique */}
      <PedagogicalModelSwitcher value={pedagogicalModel} onChange={onPedagogicalModel} />

      <div className="flex items-center gap-4">
        <button onClick={onLaunch} disabled={!ready || loading}
          className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm transition-all"
          style={{
            background: ready ? GOLD : '#1e2a40',
            color: ready ? '#000' : '#334155',
            cursor: ready ? 'pointer' : 'not-allowed',
            boxShadow: ready ? `0 0 20px ${GOLD}30` : 'none',
          }}>
          {loading
            ? <><Loader2 size={15} className="animate-spin" /> Analyse en cours…</>
            : <><Play size={15} /> Étape 1 — Lancer l'analyse IA</>
          }
        </button>
        {!ready && (
          <span className="text-slate-500 text-xs ml-auto">{Math.max(0, 100 - charCount)} car. manquants</span>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard générique chargement étape ─────────────────────────────────
function GenericStepDashboard({ steps, insights, CenterIcon, iconColor, label, rawText }) {
  const [completedSteps, setCompletedSteps] = useState([]);
  const [activeStep,     setActiveStep]     = useState(0);
  const [liveInsights,   setLiveInsights]   = useState([]);
  const [elapsed,        setElapsed]        = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const timers = steps.map((s, i) =>
      setTimeout(() => {
        setCompletedSteps(prev => [...prev, s.id]);
        setActiveStep(i + 1);
      }, s.duration)
    );
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  useEffect(() => {
    const timers = insights.map((ins) =>
      setTimeout(() => setLiveInsights(prev => [...prev, ins]), ins.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [insights]);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 100);
    return () => clearInterval(id);
  }, []);

  const progress = (completedSteps.length / steps.length) * 100;

  return (
    <div className="flex gap-6 min-h-[480px]">
      {/* Gauche — étapes */}
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Progression</p>
        {steps.map((s, i) => {
          const done   = completedSteps.includes(s.id);
          const active = activeStep === i && !done;
          return (
            <motion.div key={s.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
              style={{
                background: done ? '#22c55e08' : active ? `${iconColor}10` : PANEL,
                border: `1px solid ${done ? '#22c55e25' : active ? iconColor + '40' : BORDER}`,
              }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-sm"
                style={{ background: done ? '#22c55e20' : active ? `${iconColor}25` : '#ffffff05' }}>
                {done ? '✓' : s.icon}
              </div>
              <span className="text-xs font-medium flex-1"
                style={{ color: done ? '#22c55e' : active ? '#e2e8f0' : '#334155' }}>
                {s.label}
              </span>
              {active && <Loader2 size={10} color={iconColor} className="animate-spin shrink-0" />}
              {done   && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#22c55e' }} />}
            </motion.div>
          );
        })}

        <div className="mt-3 px-1">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
            <span>Progression</span><span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: '#1e2a40' }}>
            <motion.div className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${iconColor}, ${CYAN})` }}
              animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
          </div>
        </div>
      </div>

      {/* Centre — animation */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 relative">
        <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="absolute rounded-full border"
              style={{
                width: 60 + i * 48, height: 60 + i * 48,
                borderColor: i === 0 ? iconColor : i === 1 ? `${iconColor}80` : '#1e2a4060',
              }}
              animate={{ scale: [1, 1.06, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2 + i * 0.6, repeat: Infinity, delay: i * 0.3 }} />
          ))}
          <motion.div className="absolute w-3 h-3 rounded-full"
            style={{ background: iconColor, top: 0, left: '50%', marginLeft: -6, originX: '6px', originY: '96px' }}
            animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
          <motion.div className="absolute w-2 h-2 rounded-full"
            style={{ background: CYAN, top: 8, left: '50%', marginLeft: -4, originX: '4px', originY: '72px' }}
            animate={{ rotate: -360 }} transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }} />
          <motion.div className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${iconColor}30, ${CYAN}20)`, border: `1px solid ${iconColor}40` }}
            animate={{ boxShadow: [`0 0 20px ${iconColor}30`, `0 0 40px ${iconColor}60`, `0 0 20px ${iconColor}30`] }}
            transition={{ duration: 2, repeat: Infinity }}>
            <CenterIcon size={26} color={iconColor} />
          </motion.div>
        </div>

        <div className="text-center">
          <AnimatePresence mode="wait">
            <motion.p key={activeStep}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="text-white font-semibold text-sm mb-1">
              {steps[Math.min(activeStep, steps.length - 1)]?.label ?? 'Finalisation…'}
            </motion.p>
          </AnimatePresence>
          <p className="text-slate-500 text-xs">{label}</p>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-center">
            <p className="text-white font-bold text-lg" style={{ color: iconColor }}>{elapsed}s</p>
            <p className="text-[10px] text-slate-500">écoulées</p>
          </div>
          <div className="w-px h-8" style={{ background: BORDER }} />
          <div className="text-center">
            <p className="text-white font-bold text-lg">{completedSteps.length}/{steps.length}</p>
            <p className="text-[10px] text-slate-500">étapes</p>
          </div>
        </div>

        <div className="w-48 h-1 rounded-full overflow-hidden" style={{ background: '#1e2a40' }}>
          <motion.div className="h-full w-16 rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${iconColor}, transparent)` }}
            animate={{ x: [-64, 192] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} />
        </div>
      </div>

      {/* Droite — rapport */}
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Rapport live</p>
        <div className="flex-1 rounded-xl p-3 space-y-2"
          style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
          {liveInsights.length === 0 && (
            <p className="text-slate-500 text-xs italic mt-4 text-center">En attente de données…</p>
          )}
          <AnimatePresence>
            {liveInsights.map((ins, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                className="rounded-lg px-3 py-2"
                style={{ background: '#0b1018', border: `1px solid ${BORDER}` }}>
                <p className="text-[10px] text-slate-500 mb-0.5">{ins.field}</p>
                <p className="text-slate-200 text-xs font-medium">{ins.value}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {liveInsights.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl p-3 text-center"
            style={{ background: `${iconColor}08`, border: `1px solid ${iconColor}25` }}>
            <p className="text-[10px] text-slate-500 mb-1">Confiance IA</p>
            <div className="flex items-center justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <motion.div key={i} className="w-4 h-1.5 rounded-full"
                  style={{ background: i < Math.ceil(liveInsights.length / insights.length * 5) ? iconColor : '#1e2a40' }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }} />
              ))}
            </div>
            <p className="text-[10px] font-bold mt-1" style={{ color: iconColor }}>
              {Math.round(liveInsights.length / insights.length * 100)}%
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard Analyse ────────────────────────────────────────────────────
const ANALYSIS_STEPS = [
  { id: 'read',      icon: '📖', label: 'Lecture du texte source',     duration: 800  },
  { id: 'theme',     icon: '🎯', label: 'Identification du thème',      duration: 1800 },
  { id: 'audience',  icon: '👥', label: 'Analyse de l\'audience',       duration: 2800 },
  { id: 'structure', icon: '📐', label: 'Détection de la structure',    duration: 4200 },
  { id: 'concepts',  icon: '💡', label: 'Extraction des concepts clés', duration: 6000 },
  { id: 'chapters',  icon: '📚', label: 'Architecture des chapitres',   duration: 8500 },
  { id: 'synthesis', icon: '✅', label: 'Synthèse et validation',       duration: 12000},
];
const ANALYSIS_INSIGHTS = [
  { delay: 1000,  field: 'Domaine',    value: 'Détection en cours…'           },
  { delay: 2500,  field: 'Langue',     value: 'Analyse lexicale…'             },
  { delay: 4000,  field: 'Audience',   value: 'Profil cible identifié'        },
  { delay: 5500,  field: 'Niveau',     value: 'Calibrage pédagogique…'        },
  { delay: 7000,  field: 'Ton',        value: 'Registre détecté'              },
  { delay: 9000,  field: 'Durée est.', value: 'Calcul en cours…'              },
  { delay: 11000, field: 'Chapitres',  value: 'Structure en construction…'    },
];

function AnalysisLoadingDashboard({ rawText }) {
  return <GenericStepDashboard
    steps={ANALYSIS_STEPS} insights={ANALYSIS_INSIGHTS}
    CenterIcon={Brain} iconColor={VIOLET}
    label="Intelligence artificielle en cours de traitement"
    rawText={rawText}
  />;
}

// ─── Dashboard Blocs ──────────────────────────────────────────────────────
const BLOCS_STEPS = [
  { id: 'read',    icon: '📖', label: 'Lecture du rapport d\'analyse', duration: 600  },
  { id: 'seg',     icon: '✂️', label: 'Segmentation du texte',          duration: 1500 },
  { id: 'phases',  icon: '🎭', label: 'Identification des phases LIRI', duration: 3000 },
  { id: 'map',     icon: '🗺️', label: 'Mappage modèle pédagogique',     duration: 5000 },
  { id: 'blocs',   icon: '🧩', label: 'Construction des blocs',         duration: 8000 },
  { id: 'valid',   icon: '✅', label: 'Validation de la structure',     duration: 11000},
];
function getBlocsInsights(pedagogicalModel) {
  const isV2 = pedagogicalModel === 'failure-v2';
  return isV2 ? [
    { delay: 800,   field: 'Modèle',      value: 'Échec Productif 26 seg activé'  },
    { delay: 2000,  field: 'Phase 1',     value: 'Amorce & Tension…'              },
    { delay: 3500,  field: 'Phase 2',     value: '⚠️ Défi sans leçon — cœur'     },
    { delay: 5000,  field: 'Phase 3',     value: 'Construction de la leçon…'      },
    { delay: 7000,  field: 'Phases 4-6',  value: 'Ancrage → Éval → Connexion'     },
    { delay: 9000,  field: 'Oral script', value: 'Génération scripts prof…'       },
    { delay: 10500, field: 'Remédiation', value: 'Boucles d\'erreurs intégrées'   },
  ] : [
    { delay: 800,   field: 'Modèle',      value: 'LIRI 21 segments activé'        },
    { delay: 2000,  field: 'Segmentation',value: 'Ruptures thématiques…'          },
    { delay: 3500,  field: 'Objectif',    value: 'Seg 1 — Compétence visée'       },
    { delay: 5000,  field: 'Révélation',  value: 'Seg 7 — Moment Ah Ha!'          },
    { delay: 7000,  field: 'JE RETIENS',  value: 'Seg 16 — Phrase mémorielle'     },
    { delay: 9000,  field: 'Oral script', value: 'Génération scripts prof…'       },
    { delay: 10500, field: 'Transitions', value: 'Seg 21 — Ponts narratifs'       },
  ];
}

function BlocsLoadingDashboard({ pedagogicalModel }) {
  const insights = getBlocsInsights(pedagogicalModel);
  const isV2 = pedagogicalModel === 'failure-v2';
  return <GenericStepDashboard
    steps={BLOCS_STEPS} insights={insights}
    CenterIcon={Layers} iconColor={isV2 ? '#f43f5e' : CYAN}
    label={isV2
      ? 'Blocs de sens + génération factory (chapitres × 26 segments)'
      : 'Blocs de sens + génération factory (chapitres × 21 segments LIRI)'}
  />;
}

// ─── Dashboard Chapitres ─────────────────────────────────────────────────
const CHAPTERS_STEPS = [
  { id: 'read',  icon: '📖', label: 'Lecture des blocs générés',    duration: 400  },
  { id: 'group', icon: '🗂️', label: 'Regroupement thématique',      duration: 1200 },
  { id: 'arch',  icon: '🏗️', label: 'Architecture progressive',     duration: 2500 },
  { id: 'bal',   icon: '⚖️', label: 'Équilibre des chapitres',      duration: 4000 },
  { id: 'obj',   icon: '🎯', label: 'Génération des objectifs',     duration: 5500 },
];
const CHAPTERS_INSIGHTS = [
  { delay: 600,  field: 'Blocs lus',  value: 'Analyse des connexions…'      },
  { delay: 1500, field: 'Regroupement',value: 'Par cohérence thématique'    },
  { delay: 3000, field: 'Structure',  value: 'Introduction → Conclusion'    },
  { delay: 4500, field: 'Durées',     value: 'Calcul des temps de cours'    },
  { delay: 5500, field: 'Objectifs',  value: 'Compétences visées générées'  },
];

function ChaptersLoadingDashboard() {
  return <GenericStepDashboard
    steps={CHAPTERS_STEPS} insights={CHAPTERS_INSIGHTS}
    CenterIcon={BookOpen} iconColor={GOLD}
    label="Construction de l'architecture pédagogique"
  />;
}

// ─── Dashboard Pédagogie ─────────────────────────────────────────────────
const PEDAGOGY_STEPS = [
  { id: 'read',  icon: '📖', label: 'Lecture des chapitres',       duration: 400  },
  { id: 'seg21', icon: '🧩', label: 'Mapping 21 segments',         duration: 1500 },
  { id: 'script',icon: '🎤', label: 'Scripts professeur',          duration: 3000 },
  { id: 'eleve', icon: '👨‍🎓', label: 'Activités élèves',           duration: 4500 },
  { id: 'slide', icon: '🖼️', label: 'Génération des slides',       duration: 6000 },
  { id: 'valid', icon: '✅', label: 'Validation pédagogique',      duration: 7500 },
];
const PEDAGOGY_INSIGHTS = [
  { delay: 600,  field: 'Segments',  value: '21 segments par chapitre'     },
  { delay: 1800, field: 'Scripts',   value: 'Oral mot-à-mot en cours…'     },
  { delay: 3200, field: 'Activités', value: 'Questions & ateliers…'        },
  { delay: 4800, field: 'Slides',    value: 'Format SmartBoard natif'      },
  { delay: 6500, field: 'Qualité',   value: 'Score pédagogique calculé'    },
];

function PedagogyLoadingDashboard({ stepStatus }) {
  const progress = stepStatus?.['4_progress'];
  const current  = stepStatus?.['4_current'];
  return (
    <div>
      {/* Progress live si disponible */}
      {(progress || current) && (
        <div className="mb-6 rounded-xl p-4 flex items-center gap-4"
          style={{ background: `${GREEN}10`, border: `1px solid ${GREEN}25` }}>
          <Loader2 size={18} style={{ color: GREEN }} className="animate-spin shrink-0" />
          <div>
            {progress && (
              <p className="text-white font-semibold text-sm">Chapitre {progress}</p>
            )}
            {current && (
              <p className="text-slate-400 text-xs mt-0.5 truncate max-w-xs">{current}</p>
            )}
          </div>
          {progress && (
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: '#1e2a40' }}>
                <div className="h-full rounded-full transition-all" style={{
                  background: GREEN,
                  width: `${(() => { const [a, b] = progress.split('/').map(Number); return b ? Math.round(a / b * 100) : 0; })()}%`
                }} />
              </div>
              <span className="text-[10px]" style={{ color: GREEN }}>{progress}</span>
            </div>
          )}
        </div>
      )}
      <GenericStepDashboard
        steps={PEDAGOGY_STEPS} insights={PEDAGOGY_INSIGHTS}
        CenterIcon={Sparkles} iconColor={GREEN}
        label="Génération de la matrice pédagogique complète"
      />
    </div>
  );
}

// ─── CTA bouton "Étape suivante" ──────────────────────────────────────────
function NextStepCTA({ label, sublabel, onLaunch, color = GOLD, loading = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="mt-8 rounded-2xl p-6 flex items-center justify-between"
      style={{ background: `${color}08`, border: `1px solid ${color}30` }}>
      <div>
        <p className="text-white font-bold text-base">{label}</p>
        <p className="text-slate-400 text-sm mt-0.5">{sublabel}</p>
      </div>
      <button onClick={onLaunch} disabled={loading}
        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
        style={{ background: color, color: '#000', boxShadow: `0 0 24px ${color}30` }}>
        {loading
          ? <><Loader2 size={14} className="animate-spin" /> En cours…</>
          : <><Play size={14} /> Lancer</>
        }
      </button>
    </motion.div>
  );
}

// ─── Étape 1 — Analyse ────────────────────────────────────────────────────
function StepAnalysis({ analysis, stepStatus, onLaunchBlocs, rawText }) {
  const running = stepStatus?.[1] === 'running';
  const blocsStatus = stepStatus?.[2];

  if (running) return <AnalysisLoadingDashboard rawText={rawText} />;
  if (!analysis) return <EmptyState label="Lance l'analyse pour voir le rapport" />;

  const fields = [
    { label: 'Sujet global',    value: analysis.global_subject     },
    { label: 'Audience cible',  value: analysis.target_audience    },
    { label: 'Durée estimée',   value: analysis.estimated_duration },
    { label: 'Niveau',          value: analysis.level              },
    { label: 'Ton pédagogique', value: analysis.pedagogical_tone   },
    { label: 'Chapitres',       value: analysis.chapters_count > 0 ? `${analysis.chapters_count} détectés` : undefined },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${VIOLET}20`, border: `1px solid ${VIOLET}40` }}>
          <CheckCircle2 size={16} color={VIOLET} />
        </div>
        <SectionHeader title="Analyse complète" sub="Vue d'ensemble générée par l'IA" />
      </div>

      <StepAnalysisLocalSearch
        rawText={rawText}
        structureCharEnd={analysis.structure_meta?.structure_char_end}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.filter(f => f.value).map(f => (
          <InfoCard key={f.label} label={f.label} value={f.value} />
        ))}
      </div>

      {analysis.document_stats && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
          <p className="text-xs uppercase tracking-widest text-slate-500">Statistiques source</p>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <span>{analysis.document_stats.word_count?.toLocaleString('fr-FR')} mots</span>
            <span>{analysis.document_stats.paragraph_count} paragraphes</span>
            <span>{analysis.document_stats.char_count?.toLocaleString('fr-FR')} car.</span>
          </div>
        </div>
      )}

      {analysis.structure_meta?.truncated && (
        <p className="text-amber-400/90 text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
          Analyse structurée limitée aux {analysis.structure_meta.structure_char_end?.toLocaleString('fr-FR')} premiers caractères — le reste du texte utilise le découpage heuristique si besoin.
        </p>
      )}

      {analysis.structure_meta?.analysis_quality && (
        <div
          className="rounded-xl p-4 space-y-2 text-xs"
          style={{
            background: analysis.structure_meta.analysis_quality.needs_review ? 'rgba(251,191,36,0.06)' : PANEL,
            border: `1px solid ${analysis.structure_meta.analysis_quality.needs_review ? 'rgba(251,191,36,0.3)' : BORDER}`,
          }}>
          <p className="uppercase tracking-widest text-slate-500">Couverture du texte (fragments)</p>
          <div className="flex flex-wrap gap-3 text-slate-300">
            <span>{Math.round((analysis.structure_meta.analysis_quality.coverage_ratio ?? 0) * 1000) / 10} % couvert</span>
            {analysis.structure_meta.fragment_count != null && (
              <span>{analysis.structure_meta.fragment_count} fragments</span>
            )}
            <span>{analysis.structure_meta.analysis_quality.gap_count ?? 0} trou(s)</span>
            <span>{analysis.structure_meta.analysis_quality.overlap_count ?? 0} chevauchement(s)</span>
          </div>
          {analysis.structure_meta.analysis_meta && (
            <p className="text-[10px] text-slate-500">
              Pipeline : {analysis.structure_meta.analysis_meta.window_count ?? 1} fenêtre(s) analysée(s)
              {analysis.structure_meta.analysis_meta.gap_fill_applied ? ' · complément des trous (IA)' : ''}
            </p>
          )}
          {analysis.structure_meta.analysis_quality.needs_review && (
            <p className="text-amber-200/90">
              Revue suggérée : couverture incomplète, chevauchements ou trou important — vérifie les blocs à l'étape suivante.
            </p>
          )}
          {(analysis.structure_meta.analysis_quality.gaps?.length > 0) && (
            <div className="text-[10px] text-slate-500 space-y-0.5">
              <span className="text-slate-400">Premiers trous (car. : début–fin)</span>
              {analysis.structure_meta.analysis_quality.gaps.slice(0, 4).map((g, i) => (
                <div key={i}>{g.start_char} → {g.end_char} ({g.length} car.)</div>
              ))}
            </div>
          )}
        </div>
      )}

      {analysis.structured_document?.topics?.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-slate-500">Sujets détectés (blocs horodatés)</p>
          <div className="grid gap-2">
            {analysis.structured_document.topics.map((t) => {
              const passes = analysis.structured_document.passages?.filter((p) => p.topic_id === t.id).length || 0;
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
                  style={{ background: `${VIOLET}10`, border: `1px solid ${VIOLET}25` }}>
                  <span className="text-white font-medium">{t.label}</span>
                  <span className="text-slate-500 text-xs shrink-0">{passes} passage{passes > 1 ? 's' : ''}</span>
                </div>
              );
            })}
          </div>
          {analysis.structured_document.recommended_chapter_order?.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Ordre d'enseignement recommandé</p>
              <ol className="list-decimal list-inside text-xs text-slate-400 space-y-0.5">
                {analysis.structured_document.recommended_chapter_order.map((tid) => {
                  const topic = analysis.structured_document.topics.find((x) => x.id === tid);
                  return <li key={tid}>{topic?.label || tid}</li>;
                })}
              </ol>
            </div>
          )}
          {analysis.pedagogical_reordering_rationale && (
            <p className="text-xs text-slate-500 leading-relaxed border-l-2 border-[#d97757]/40 pl-3">
              {analysis.pedagogical_reordering_rationale.slice(0, 1200)}
              {analysis.pedagogical_reordering_rationale.length > 1200 ? '…' : ''}
            </p>
          )}
          {analysis.search_index?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Index rapide (extraits)</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.search_index.slice(0, 16).map((row) => (
                  <span key={row.term} className="text-[10px] px-2 py-0.5 rounded-md text-slate-400"
                    style={{ background: `${CYAN}10`, border: `1px solid ${CYAN}20` }}>
                    {row.term} ({row.hits?.length || 0})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!blocsStatus && (
        <NextStepCTA
          label="Étape 2 — Blocs de sens + deck LIRI"
          sublabel="Segmentation du texte (blocs) et appel factory (chapitres × segments) — deux niveaux distincts"
          onLaunch={onLaunchBlocs}
          color={CYAN}
        />
      )}
      {blocsStatus === 'running' && (
        <div className="mt-6 flex items-center gap-3 text-slate-400 text-sm">
          <Loader2 size={14} color={CYAN} className="animate-spin" />
          Génération des blocs en cours…
        </div>
      )}
    </div>
  );
}

// ─── Étape 2 — Blocs de sens (≠ chapitres) ─────────────────────────────────
function StepBlocks({ blocks, factoryChapterCount = 0, stepStatus, onLaunchChapters, pedagogicalModel }) {
  const running = stepStatus?.[2] === 'running';
  const chapStatus = stepStatus?.[3];
  const isV2 = pedagogicalModel === 'failure-v2';
  const segCount = isV2 ? 26 : 21;

  if (running) return <BlocsLoadingDashboard pedagogicalModel={pedagogicalModel} />;
  if (!blocks?.length) return <EmptyState label="Aucun bloc généré — lancez d'abord l'analyse" />;

  /** Ancien stockage : cartes « chapitre » à l'étape 2 (confusion corrigée depuis) */
  const isLegacyChapterCards = blocks[0]?.type === 'chapter';

  const PHASE_COLOR = {
    ouverture: '#D4AF37', interaction_eleves: '#f59e0b', limites_refutation: '#f43f5e',
    introduction_cours: '#a78bfa', historicite: '#38bdf8', definition: '#34d399',
    demonstration: '#fb923c', exemples: '#a3e635', conclusion_doctrinale: '#c084fc',
    ouverture_finale: '#D4AF37', content: '#64748b', chapter: CYAN,
    sense_block: '#34d399',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${CYAN}20`, border: `1px solid ${CYAN}40` }}>
          <CheckCircle2 size={16} color={CYAN} />
        </div>
        <SectionHeader
          title={isLegacyChapterCards ? `${blocks.length} unités (ancien format — voir migration)` : `${blocks.length} blocs de sens`}
          sub={isLegacyChapterCards
            ? `Ancienne session : ces cartes mélangeaient chapitres et blocs. Rechargez l'étape 2 pour le nouveau découpage.`
            : `Cahier des charges : blocs = ruptures de sens dans le texte brut. Chapitres = fichier pédagogique (${segCount} segments) — étape 3.`}
        />
      </div>

      {!isLegacyChapterCards && factoryChapterCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium"
          style={{ background: `${GREEN}08`, border: `1px solid ${GREEN}22` }}>
          <CheckCircle2 size={12} color={GREEN} />
          <span style={{ color: GREEN }}>
            Deck factory prêt : {factoryChapterCount} chapitre{factoryChapterCount > 1 ? 's' : ''} × {segCount} segments — validation à l'étape « Chapitres ».
          </span>
        </div>
      )}

      {isLegacyChapterCards && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium"
          style={{ background: `${CYAN}08`, border: `1px solid ${CYAN}20` }}>
          <CheckCircle2 size={12} color={CYAN} />
          <span style={{ color: CYAN }}>
            Ancien export : cartes-chapitre à l'étape 2. Relancez l\'étape 2 pour séparer blocs de sens et deck LIRI.
          </span>
        </div>
      )}

      <div className="space-y-3">
        {blocks.map((b, i) => {
          const phaseKey = b.pedagogical_phase || b.type || 'content';
          const color = PHASE_COLOR[phaseKey] || '#64748b';
          return (
            <motion.div key={b.id ?? b.title ?? i}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl p-4" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: `${color}20`, color }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-white font-semibold text-sm">{b.title}</span>
                    {b.subject_label && !isLegacyChapterCards && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 truncate max-w-[140px]"
                        style={{ background: `${VIOLET}18`, color: VIOLET }} title={b.subject_label}>
                        {b.subject_label}
                      </span>
                    )}
                    {isLegacyChapterCards ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                        style={{ background: `${CYAN}15`, color: CYAN }}>
                        {b.segment_count || segCount} segments
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                        style={{ background: `${color}15`, color }}>
                        {b.type === 'sense_block' ? 'Bloc de sens' : b.type}
                      </span>
                    )}
                    {(b.duration || b.duration_minutes) && (
                      <span className="text-[10px] text-slate-500 ml-auto">
                        {b.duration || `${b.duration_minutes} min`}
                      </span>
                    )}
                  </div>
                  {(b.central_idea || b.objective) && (
                    <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">
                      {b.objective || b.central_idea}
                    </p>
                  )}
                  {b.lines_label && !isLegacyChapterCards && (
                    <p className="text-slate-600 text-[10px] mt-1">{b.lines_label}</p>
                  )}
                  {b.new_elements && !isLegacyChapterCards && (
                    <p className="text-amber-200/80 text-[10px] mt-1 border-l border-amber-500/30 pl-2">
                      + {b.new_elements}
                    </p>
                  )}
                  {b.key_points?.length > 0 && (
                    <p className="text-slate-500 text-[10px] mt-1">{b.key_points.slice(0, 2).join(' · ')}</p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* CTA étape suivante */}
      {!chapStatus && (
        <NextStepCTA
          label="Étape 3 — Valider les Chapitres"
          sublabel={isLegacyChapterCards
            ? `${blocks.length} unités (legacy) → organisation en chapitres pédagogiques`
            : (factoryChapterCount > 0
              ? `${factoryChapterCount} chapitres deck (${segCount} seg.) prêts + regroupement blocs si besoin`
              : `${blocks.length} blocs de sens → regroupement en chapitres (objectifs, durées)`)}
          onLaunch={onLaunchChapters}
          color={GOLD}
        />
      )}
      {chapStatus === 'running' && (
        <div className="mt-6 flex items-center gap-3 text-slate-400 text-sm">
          <Loader2 size={14} color={GOLD} className="animate-spin" />
          Construction des chapitres en cours…
        </div>
      )}
    </div>
  );
}

// ─── Étape 3 — Chapitres ─────────────────────────────────────────────────
function StepChapters({ chapters, stepStatus, onLaunchPedagogy }) {
  const running = stepStatus?.[3] === 'running';
  const pedaStatus = stepStatus?.[4];

  if (running) return <ChaptersLoadingDashboard />;
  if (!chapters?.length) return <EmptyState label="Aucun chapitre généré — lancez d'abord les blocs" />;

  const totalSegments = chapters.reduce((acc, ch) => acc + (ch.segment_count || ch.segments?.length || 21), 0);
  const hasRealSegments = chapters.some(ch => (ch.segments?.length ?? 0) >= 21);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}40` }}>
          <CheckCircle2 size={16} color={GOLD} />
        </div>
        <SectionHeader title={`${chapters.length} chapitres`} sub="Architecture complète du cours" />
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>{chapters.length} chapitres</span>
        <span className="w-px h-3" style={{ background: BORDER }} />
        <span style={{ color: GOLD }}>{totalSegments} segments total</span>
        {hasRealSegments && (
          <>
            <span className="w-px h-3" style={{ background: BORDER }} />
            <span style={{ color: GREEN }}>✓ Segments IA générés</span>
          </>
        )}
      </div>

      <div className="space-y-3">
        {chapters.map((ch, i) => {
          const segCount = ch.segment_count || ch.segments?.length || 0;
          const segsDone = ch.segments?.filter(s => s.status === 'done' || (s.content && s.content.length > 5)).length || 0;
          return (
            <motion.div key={ch.id ?? ch.title ?? i}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl p-5" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                    style={{ background: `${GOLD}15`, color: GOLD }}>
                    CH {i + 1}
                  </span>
                  <h4 className="text-white font-bold">{ch.title}</h4>
                </div>
                {segCount > 0 && (
                  <div className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-lg"
                    style={{ background: `${CYAN}10`, border: `1px solid ${CYAN}25` }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: segsDone === segCount ? GREEN : CYAN }} />
                    <span className="text-[10px] font-medium" style={{ color: CYAN }}>
                      {segsDone}/{segCount} segments
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {ch.objective && <MiniField label="Objectif" value={ch.objective.slice(0, 100)} />}
                {ch.duration  && <MiniField label="Durée"    value={ch.duration}   />}
                {ch.key_retain && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-slate-500 mb-1">À retenir (JE RETIENS)</p>
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{ch.key_retain}</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* CTA étape suivante */}
      {!pedaStatus && (
        <NextStepCTA
          label="Étape 4 — Finaliser la Pédagogie"
          sublabel={hasRealSegments
            ? `${chapters.length} chapitres × 21 segments déjà générés → finalisation slides + scripts`
            : `${chapters.length} chapitres → 21 segments × chapitre + slides + scripts professeur`}
          onLaunch={onLaunchPedagogy}
          color={GREEN}
        />
      )}
      {pedaStatus === 'running' && (
        <div className="mt-6 flex items-center gap-3 text-slate-400 text-sm">
          <Loader2 size={14} color={GREEN} className="animate-spin" />
          Génération de la matrice pédagogique en cours…
        </div>
      )}
    </div>
  );
}

// ─── Couleurs des segments par id ─────────────────────────────────────────
// Couleurs pour les 26 segments (couvre v1 21-seg et v2 26-seg)
const SEG_COLORS = {
  // v1 & v2 — segments 1-21
  1:  '#D4AF37', 2:  '#a78bfa', 3:  '#38bdf8', 4:  '#f59e0b', 5:  '#f43f5e',
  6:  '#fb923c', 7:  '#f43f5e', 8:  '#c084fc', 9:  '#fbbf24', 10: '#34d399',
  11: '#38bdf8', 12: '#c084fc', 13: '#34d399', 14: '#94a3b8', 15: '#34d399',
  16: '#f43f5e', 17: '#34d399', 18: '#64748b', 19: '#D4AF37', 20: '#38bdf8',
  21: '#f59e0b',
  // v2 uniquement — segments 22-26
  22: '#a78bfa', 23: '#fb923c', 24: '#34d399', 25: '#a78bfa', 26: '#64748b',
};

// ─── Étape 4 — Pédagogie ─────────────────────────────────────────────────
function StepPedagogy({ pedagogy, stepStatus }) {
  // Ouvrir le premier chapitre par défaut (identifié par chapterId, pas par index)
  const [openId, setOpenId] = useState(() => pedagogy?.[0]?.chapterId ?? pedagogy?.[0]?.id ?? null);
  const [expandSeg, setExpandSeg] = useState(null); // { chapterId, segId }
  const running = stepStatus?.[4] === 'running';

  if (running) return <PedagogyLoadingDashboard stepStatus={stepStatus} />;
  if (!pedagogy?.length) return <EmptyState label="Aucune pédagogie générée — lancez d'abord les chapitres" />;

  const expectedSegs = pedagogy[0]?.segments?.length || 21;
  const allDone = pedagogy.every(ch => ch.segments?.filter(s => s.status === 'done').length === expectedSegs);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${GREEN}20`, border: `1px solid ${GREEN}40` }}>
          <CheckCircle2 size={16} color={GREEN} />
        </div>
        <SectionHeader title="Matrice pédagogique" sub={`${expectedSegs} segments × ${pedagogy.length} chapitre${pedagogy.length > 1 ? 's' : ''}`} />
      </div>

      {pedagogy.map((ch, i) => {
        const chKey    = ch.chapterId ?? ch.id ?? i;
        const isOpen   = openId === chKey;
        const segsDone = ch.segments?.filter(s => s.status === 'done' || (s.content?.length > 5)).length || 0;
        return (
          <div key={chKey} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            <button onClick={() => setOpenId(isOpen ? null : chKey)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
              style={{ background: isOpen ? `${GREEN}10` : PANEL }}>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background: `${GOLD}15`, color: GOLD }}>CH {i + 1}</span>
                <span className="text-white font-semibold text-sm">{ch.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: '#1e2a40' }}>
                    <div className="h-full rounded-full" style={{ background: GREEN, width: `${(segsDone / expectedSegs) * 100}%` }} />
                  </div>
                  <span className="text-[10px]" style={{ color: segsDone === expectedSegs ? GREEN : '#64748b' }}>
                    {segsDone}/{expectedSegs}
                  </span>
                </div>
                <ChevronRight size={14} className="text-slate-500 transition-transform"
                  style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }} />
              </div>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                  className="overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4"
                    style={{ background: '#0b1018', borderTop: `1px solid ${BORDER}` }}>
                    {ch.segments?.map(seg => {
                      const color     = SEG_COLORS[seg.segment_id] || '#64748b';
                      const hasCont   = seg.content?.length > 5;
                      const isExpanded= expandSeg?.chapterId === chKey && expandSeg?.segId === seg.segment_id;
                      return (
                        <motion.div key={seg.segment_id}
                          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (seg.segment_id - 1) * 0.02 }}
                          className="rounded-lg overflow-hidden cursor-pointer"
                          style={{ background: PANEL, border: `1px solid ${hasCont ? color + '30' : BORDER}` }}
                          onClick={() => setExpandSeg(isExpanded ? null : { chapterId: chKey, segId: seg.segment_id })}>
                          <div className="flex items-center gap-2 px-3 py-2"
                            style={{ background: `${color}08`, borderBottom: `1px solid ${color}20` }}>
                            <div className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
                              style={{ background: `${color}20`, color }}>
                              {seg.segment_id}
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-wide flex-1" style={{ color }}>
                              {seg.name}
                            </span>
                            {hasCont && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />}
                          </div>
                          <div className="px-3 py-2">
                            {hasCont ? (
                              <>
                                <p className={`text-slate-300 text-xs leading-snug ${isExpanded ? '' : 'line-clamp-3'}`}>
                                  {seg.title && seg.title !== seg.name && (
                                    <span className="block text-slate-500 text-[10px] mb-0.5">{seg.title}</span>
                                  )}
                                  {seg.content}
                                </p>
                                {seg.key_points?.filter(kp => kp !== '—').length > 0 && isExpanded && (
                                  <ul className="mt-2 space-y-0.5">
                                    {seg.key_points.filter(kp => kp !== '—').map((kp, ki) => (
                                      <li key={ki} className="flex items-start gap-1.5 text-[10px] text-slate-500">
                                        <span style={{ color, marginTop: 1 }}>▪</span>{kp}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {seg.oral_script && isExpanded && (
                                  <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                                    <p className="text-[10px] text-slate-500 mb-1">Script oral</p>
                                    <p className="text-slate-400 text-[10px] leading-relaxed italic">{seg.oral_script}</p>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-slate-500 italic text-xs">En attente…</p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Badge succès pipeline complet */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-5 text-center"
        style={{ background: `${GREEN}08`, border: `1px solid ${GREEN}30` }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
          style={{ background: `${GREEN}20` }}>
          <CheckCircle2 size={24} color={GREEN} />
        </div>
        <p className="text-white font-bold text-base mb-1">
          {allDone ? 'Pipeline LIRI complet ✓' : 'Pédagogie structurée ✓'}
        </p>
        <p className="text-slate-500 text-sm">
          {allDone
            ? 'Cours prêt — accédez à l\'export pour télécharger ou ouvrir dans SmartBoard'
            : `${pedagogy.length} chapitres structurés — rendez-vous en Export ou SmartBoard`}
        </p>
      </motion.div>
    </div>
  );
}

// ─── Étapes 5/6 — Slides / Script ────────────────────────────────────────
function StepSlides({ slides, loading, onNext }) {
  if (loading) return <LoadingState label="Génération des slides…" sub="Format SmartBoard natif" />;
  if (!slides?.length) return <EmptyState label="Aucun slide généré" />;
  return (
    <div className="space-y-4">
      <SectionHeader title={`${slides.length} slides générés`} sub="Prêts pour SmartBoard Designer" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {slides.map((sl, i) => (
          <div key={sl.id ?? i} className="rounded-xl p-4" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
            <p className="text-[10px] text-slate-500 mb-1">Slide {i + 1}</p>
            <p className="text-white font-semibold text-sm mb-1">{sl.title}</p>
            {sl.subtitle && <p className="text-slate-400 text-xs mb-1">{sl.subtitle}</p>}
            {sl.content  && <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">{sl.content}</p>}
            {sl.segments?.find(s => s.segment_id === 16)?.content && (
              <p className="text-[10px] mt-2 font-medium" style={{ color: GOLD }}>
                ⭐ {sl.segments.find(s => s.segment_id === 16).content.slice(0, 80)}
              </p>
            )}
          </div>
        ))}
      </div>
      <NextStepCTA
        label="Étape 6 — Script professeur"
        sublabel={`${slides.length} slides construits — passez au script oral`}
        onLaunch={onNext}
        color={VIOLET}
      />
    </div>
  );
}

function StepScript({ scripts, loading, onNext }) {
  if (loading) return <LoadingState label="Rédaction du script…" sub="Texte mot à mot pour l'enseignant" />;
  if (!scripts?.length) return <EmptyState label="Aucun script généré" />;
  return (
    <div className="space-y-4">
      <SectionHeader title="Script professeur" sub="Prêt à lire à voix haute" />
      {scripts.map((sc, i) => (
        <div key={sc.id ?? i} className="rounded-xl p-5" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-slate-500 text-xs">Chapitre {i + 1}</p>
              <p className="text-white font-bold">{sc.title}</p>
            </div>
            {sc.duration && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${VIOLET}15`, color: VIOLET }}>
                {sc.duration}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {sc.lines?.map((l, j) => (
              <p key={j} className="text-slate-300 text-sm leading-relaxed border-l-2 pl-3"
                style={{ borderColor: VIOLET + '40' }}>{l}</p>
            ))}
          </div>
        </div>
      ))}
      <NextStepCTA
        label="Étape 7 — Exporter le cours"
        sublabel="Scripts complets — prêt pour l'export JSON, Markdown ou SmartBoard"
        onLaunch={onNext}
        color={GOLD}
      />
    </div>
  );
}

// ─── Étape 7 — Export ────────────────────────────────────────────────────
function StepExport({ project, rawText, onExportJson, onExportMarkdown, onOpenSmartboard, navigate }) {
  const hasPedagogy = (project.pedagogy?.length ?? 0) > 0;

  // ── Bridge Factory → SmartBoard Streaming ────────────────────────────────
  const handleOpenStreaming = () => {
    const { loadFromFactory } = useOrchestratorLiveStore.getState();
    if (hasPedagogy) {
      loadFromFactory(project.chapters, project.pedagogy);
      navigate('/dev/liri/streaming-v2');
    } else {
      onOpenSmartboard?.();
    }
  };

  // ── Bridge Factory → Orchestrator Live ───────────────────────────────────
  const handleSendToOrchestrator = () => {
    const { loadFromFactory, startProject } = useOrchestratorLiveStore.getState();
    if (hasPedagogy) {
      // Pédagogie disponible → charger directement dans le store sans passer par l'API
      loadFromFactory(project.chapters, project.pedagogy);
      navigate('/dev/liri/orchestrator-v2');
    } else {
      // Pas encore de pédagogie → lancer l'orchestrateur classique
      if (rawText?.trim()) startProject(rawText);
      navigate('/dev/liri/orchestrator-v2');
    }
  };

  const formats = [
    { label: 'JSON complet',        sub: 'Réimportable dans LIRI',              icon: Download,     action: onExportJson,           color: VIOLET },
    { label: 'Markdown',            sub: 'Lisible, partageable',                icon: FileText,     action: onExportMarkdown,       color: CYAN   },
    { label: 'SmartBoard Streaming',sub: hasPedagogy ? `${project.pedagogy.length} chapitres chargés` : 'Visualiser les slides', icon: ExternalLink, action: handleOpenStreaming,     color: GOLD   },
    { label: 'Orchestrator Live',   sub: hasPedagogy ? 'Segments déjà prêts ✓' : 'Lancer les 4 agents IA', icon: Activity, action: handleSendToOrchestrator, color: GREEN  },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Exporter le cours" sub="Choisissez votre destination" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {formats.map(f => {
          const Icon = f.icon;
          return (
            <button key={f.label} onClick={f.action}
              className="flex items-center gap-4 p-5 rounded-xl text-left transition-all hover:scale-[1.01]"
              style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${f.color}15`, border: `1px solid ${f.color}25` }}>
                <Icon size={18} style={{ color: f.color }} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{f.label}</p>
                <p className="text-slate-500 text-xs">{f.sub}</p>
              </div>
              <ChevronRight size={14} className="text-slate-500 ml-auto" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers UI ──────────────────────────────────────────────────────────
function LoadingState({ label, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 size={32} style={{ color: VIOLET }} className="animate-spin" />
      <div className="text-center">
        <p className="text-white font-semibold">{label}</p>
        <p className="text-slate-500 text-sm mt-1">{sub}</p>
      </div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
      <AlertCircle size={28} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div className="mb-2">
      <h3 className="text-white font-bold text-lg">{title}</h3>
      {sub && <p className="text-slate-400 text-sm">{sub}</p>}
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl p-4" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-slate-200 text-sm font-medium">{value}</p>
    </div>
  );
}

function MiniField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-slate-300 text-xs">{value}</p>
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────
export default function MasterclassFactoryV2() {
  const navigate = useNavigate();
  const m = useMasterclassProject();

  const step       = m.step ?? 0;
  const project    = m.project ?? {};
  const stepStatus = m.stepStatus ?? {};

  const rawText  = project.rawText ?? '';

  const [courseType, setCourseType] = useState('masterclass');
  const [aiProvider, setAiProvider] = useState('claude');
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile sidebar toggle

  const completedSteps = STEPS.filter(s => stepStatus[s.id] === 'done').map(s => s.id);

  const handleExportJson = () => {
    triggerDownload(
      new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
      'masterclass-export.json'
    );
  };
  const handleExportMarkdown = () => {
    const ana = project.analysis ?? {};
    const header = [
      `# ${ana.global_subject ?? project.chapters?.[0]?.title ?? 'Cours LIRI'}`,
      ana.target_audience    ? `\n**Public :** ${ana.target_audience}`    : '',
      ana.estimated_duration ? `\n**Durée :** ${ana.estimated_duration}`  : '',
      ana.level              ? `\n**Niveau :** ${ana.level}`              : '',
      ana.pedagogical_tone   ? `\n**Ton :** ${ana.pedagogical_tone}`      : '',
    ].filter(Boolean).join('');

    // Source : privilégier pedagogy (segments complets) puis chapters
    const source = project.pedagogy?.length ? project.pedagogy : (project.chapters ?? []);
    const body = source.map((ch, i) => {
      const segs  = ch.segments ?? [];
      const lines = [`\n## Chapitre ${i + 1} — ${ch.title ?? ch.chapterId}`,
                     ch.objective ? `\n> ${ch.objective}` : '',
                     ch.duration  ? `\n**Durée :** ${ch.duration}` : ''];

      segs.forEach(seg => {
        if (!seg.name) return;
        lines.push(`\n### ${seg.name}`);
        if (seg.title   && seg.title   !== seg.name) lines.push(`_${seg.title}_`);
        if (seg.content)     lines.push(`\n${seg.content}`);
        if (seg.key_points?.length) {
          lines.push('');
          seg.key_points.filter(Boolean).forEach(kp => lines.push(`- ${kp}`));
        }
        if (seg.oral_script) lines.push(`\n> **Script prof :** ${seg.oral_script}`);
        if (seg.teacher_note) lines.push(`\n> 📝 ${seg.teacher_note}`);
      });
      return lines.filter(Boolean).join('\n');
    }).join('\n\n---\n');

    const md = `${header}\n\n---\n${body}\n`;
    triggerDownload(new Blob([md], { type: 'text/markdown' }), 'masterclass.md');
  };

  const activeModel = PEDAGOGICAL_MODELS.find(pm => pm.id === m.pedagogicalModel) ?? PEDAGOGICAL_MODELS[0];

  const STEP_CONTENT = {
    0: <StepSource
          rawText={rawText}
          onSetRaw={m.setRawText}
          onLaunch={m.launchAnalysis}
          loading={stepStatus[1] === 'running'}
          onLoadDemo={m.loadDemo}
          onImportProject={m.importProject}
          courseType={courseType}
          onCourseType={setCourseType}
          aiProvider={aiProvider}
          onAiProvider={setAiProvider}
          pedagogicalModel={m.pedagogicalModel}
          onPedagogicalModel={m.setPedagogicalModel}
          documentAnalyzeOptions={m.documentAnalyzeOptions}
          onDocumentAnalyzeOptionsChange={m.setDocumentAnalyzeOptions}
        />,
    1: <StepAnalysis
          analysis={project.analysis}
          stepStatus={stepStatus}
          onLaunchBlocs={m.launchBlocs}
          rawText={rawText}
        />,
    2: <StepBlocks
          blocks={project.blocks}
          factoryChapterCount={project.factoryChapters?.length ?? 0}
          stepStatus={stepStatus}
          onLaunchChapters={m.launchChapters}
          pedagogicalModel={m.pedagogicalModel}
        />,
    3: <StepChapters
          chapters={project.chapters}
          stepStatus={stepStatus}
          onLaunchPedagogy={m.launchPedagogy}
        />,
    4: <StepPedagogy
          pedagogy={project.pedagogy}
          stepStatus={stepStatus}
        />,
    5: <StepSlides  slides={project.slides}  loading={stepStatus[5] === 'running'} onNext={() => m.goToStep(6)} />,
    6: <StepScript  scripts={project.scripts} loading={stepStatus[6] === 'running'} onNext={() => m.goToStep(7)} />,
    7: <StepExport
          project={project}
          rawText={rawText}
          onExportJson={handleExportJson}
          onExportMarkdown={handleExportMarkdown}
          onOpenSmartboard={() => navigate('/dev/smartboard-designer')}
          navigate={navigate}
        />,
  };

  return (
    <div className="min-h-screen flex" style={{ background: BG }}>
      {/* ── Overlay mobile (fond sombre derrière sidebar) ─────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-30
          w-56 shrink-0 flex flex-col border-r
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ background: SURFACE, borderColor: BORDER }}
      >
        <div className="px-5 py-5 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
          <button onClick={() => navigate('/dev/liri/studio')}
            className="text-slate-500 hover:text-slate-300 transition-colors mr-1">
            <ArrowLeft size={15} />
          </button>
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${VIOLET}20` }}>
            <Sparkles size={12} style={{ color: VIOLET }} />
          </div>
          <span className="text-white text-sm font-bold">Factory</span>
          {/* Bouton fermer sur mobile */}
          <button
            className="ml-auto md:hidden text-slate-500 hover:text-slate-300"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <StepRail currentStep={step} completedSteps={completedSteps} stepStatus={stepStatus} onGoTo={m.goToStep} />
        </div>

        {/* Badge modèle actif */}
        <div className="mx-3 mb-1 px-3 py-2 rounded-xl cursor-pointer"
          onClick={() => m.goToStep(0)}
          style={{ background: `${activeModel.color}10`, border: `1px solid ${activeModel.color}25` }}>
          <p className="text-[9px] text-slate-500 mb-0.5">Modèle actif</p>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{activeModel.icon}</span>
            <div>
              <p className="text-[10px] font-bold leading-tight" style={{ color: activeModel.color }}>
                {activeModel.label}
              </p>
              <p className="text-[9px] text-slate-500">{activeModel.segments} segments</p>
            </div>
          </div>
        </div>

        {/* Error badge */}
        {m.error && (
          <div className="mx-3 mb-2 p-2.5 rounded-xl"
            style={{ background: '#f4363610', border: '1px solid #f4363630' }}>
            <p className="text-[10px] text-red-400 leading-relaxed">{m.error}</p>
          </div>
        )}

        {/* Quality badge */}
        {project.quality?.score > 0 && (
          <div className="mx-3 mb-4 p-3 rounded-xl text-center"
            style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}25` }}>
            <p className="text-[10px] text-slate-500 mb-0.5">Score qualité</p>
            <p className="text-xl font-bold" style={{ color: GOLD }}>{project.quality.score}/100</p>
          </div>
        )}

        {/* Bouton nouveau cours */}
        <div className="mx-3 mb-4 mt-auto pt-2">
          <button
            onClick={() => {
              const hasWork = step > 0 || rawText.length > 50;
              if (!hasWork || window.confirm('Effacer le cours en cours et recommencer ?')) {
                m.reset();
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 transition-colors"
            style={{ background: 'transparent', border: `1px solid ${BORDER}` }}>
            <RotateCcw size={11} /> Nouveau cours
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="flex-1 overflow-y-auto px-4 md:px-10 py-6 md:py-10">
        {/* Bouton hamburger — mobile uniquement */}
        <button
          className="md:hidden flex items-center gap-2 mb-5 px-3 py-2 rounded-xl text-sm font-medium"
          style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: '#94a3b8' }}
          onClick={() => setSidebarOpen(true)}
        >
          <Settings2 size={14} />
          Étape {step + 1} — {STEPS[step]?.label}
        </button>
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >
              {STEP_CONTENT[step] ?? <EmptyState label="Étape non reconnue" />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Nav bas */}
      {step > 0 && (
        <div className="fixed bottom-6 right-8 flex items-center gap-3">
          {step > 1 && (
            <button onClick={() => m.goToStep(step - 1)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 transition-all hover:text-white"
              style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              ← Précédent
            </button>
          )}
          {step < 7 && (
            <button onClick={() => m.goToStep(step + 1)}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all"
              style={{ background: PANEL, color: '#94a3b8', border: `1px solid ${BORDER}` }}>
              Voir étape suivante <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
