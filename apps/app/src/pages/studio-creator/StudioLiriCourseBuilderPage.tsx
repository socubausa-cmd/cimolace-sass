/**
 * StudioLiriCourseBuilderPage — Course Builder LIRI
 * Route: /studio/liri/cours
 * 10 étapes pédagogiques × 10 blocs par étape
 * Modes: IA (LIRI Agent) / Manuel
 * V2 port from isna_app V1
 */
import React, { useCallback, useState } from 'react';
import { DEFAULT_TENANT_SLUG } from '@/config/platform';
import { Link, useNavigate } from 'react-router-dom';
import {
  Brain, ChevronDown, ChevronRight, Sparkles, CheckCircle2,
  BookOpen, Target, Zap, MessageSquare, FileText, Layers,
  Eye, RefreshCw, Save, Loader2, ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';

// ── Constants ──────────────────────────────────────────────────────────────

const STEPS = [
  { numero: 1, tag: 'DÉCLENCHEUR', label: 'Atelier ouverture' },
  { numero: 2, tag: 'PARTICIPATION', label: 'Interaction élèves' },
  { numero: 3, tag: 'CONFLIT COGNITIF', label: 'Limites / réfutation' },
  { numero: 4, tag: 'ANNONCE', label: 'Introduction cours' },
  { numero: 5, tag: 'CONTEXTE HISTORIQUE', label: 'Historicité' },
  { numero: 6, tag: 'DÉFINITION PRÉCISE', label: 'Définition concept' },
  { numero: 7, tag: 'RAISONNEMENT', label: 'Démonstration' },
  { numero: 8, tag: 'ILLUSTRATION', label: 'Exemples variés' },
  { numero: 9, tag: 'SYNTHÈSE', label: 'Conclusion doctrinale' },
  { numero: 10, tag: 'SAGESSE & OUVERTURE', label: 'Adage & ouverture' },
];

const BLOCS = [
  { id: 'idee_generale', label: 'Idée générale', icon: BookOpen, accent: 'violet', placeholder: "L'idée centrale..." },
  { id: 'idee_specifique', label: 'Idée spécifique', icon: Target, accent: 'blue', placeholder: 'Contenu détaillé pour le SmartBoard...' },
  { id: 'connaissance', label: 'Connaissance cible', icon: Brain, accent: 'amber', placeholder: "Ce que l'élève doit comprendre..." },
  { id: 'competence', label: 'Compétence cible', icon: Zap, accent: 'emerald', placeholder: "Ce que l'élève doit faire..." },
  { id: 'demonstration', label: 'Démonstration', icon: Eye, accent: 'cyan', placeholder: 'Étapes de démonstration...', isArray: true },
  { id: 'analogie', label: 'Analogie', icon: RefreshCw, accent: 'purple', placeholder: 'Analogie mémorisable...' },
  { id: 'checkpoint', label: 'Checkpoint', icon: CheckCircle2, accent: 'teal', placeholder: 'Question cible...' },
  { id: 'mise_en_situation', label: 'Mise en situation', icon: MessageSquare, accent: 'orange', placeholder: "Exercice d'application..." },
  { id: 'masterscript', label: 'Master Script', icon: FileText, accent: 'rose', placeholder: 'Discours oral (6-10 phrases)...' },
  { id: 'script_mot_a_mot', label: 'Script mot à mot', icon: FileText, accent: 'pink', placeholder: 'Discours complet...' },
];

const ACCENTS: Record<string, string> = {
  violet: 'text-violet-400 bg-violet-500/10 border-violet-500/25',
  blue: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  amber: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
  purple: 'text-purple-400 bg-purple-500/10 border-purple-500/25',
  teal: 'text-teal-400 bg-teal-500/10 border-teal-500/25',
  orange: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
  rose: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
  pink: 'text-pink-400 bg-pink-500/10 border-pink-500/25',
};

type BlocData = Record<string, string | string[]>;

// ── Components ─────────────────────────────────────────────────────────────

function PedaBloc({ bloc, value, onChange }: {
  bloc: typeof BLOCS[0];
  value: string | string[];
  onChange: (v: string | string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = bloc.icon;
  const cls = (ACCENTS[bloc.accent] || ACCENTS.violet).split(' ');
  const hasContent = value && (Array.isArray(value) ? value.some(Boolean) : String(value).trim());

  return (
    <div className={cn('rounded-xl border overflow-hidden transition-all', open ? cls[2] : 'border-white/[0.07]')}>
      <button onClick={() => setOpen(v => !v)}
        className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-all',
          open ? cn(cls[1], 'border-b border-white/[0.07]') : 'hover:bg-white/[0.03]')}>
        <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', cls[1])}>
          <Icon className={cn('h-3.5 w-3.5', cls[0])} />
        </div>
        <span className={cn('flex-1 text-[12px] font-medium', open ? 'text-white/90' : 'text-white/50')}>{bloc.label}</span>
        {hasContent && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />}
        <ChevronDown className={cn('h-3.5 w-3.5 flex-shrink-0 text-white/22 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="bg-white/[0.01] px-4 py-3">
          {bloc.isArray
            ? (Array.isArray(value) ? value : ['', '', '']).map((line, i) => (
              <input key={i} value={line} onChange={e => {
                const a = Array.isArray(value) ? [...value] : ['', '', ''];
                a[i] = e.target.value;
                onChange(a);
              }}
                placeholder={`Étape ${i + 1}...`}
                className="w-full mb-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white placeholder-white/22 outline-none focus:border-white/20" />
            ))
            : <textarea value={String(value || '')} onChange={e => onChange(e.target.value)}
                placeholder={bloc.placeholder} rows={4}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 placeholder-white/22 outline-none focus:border-white/20 leading-relaxed" />
          }
        </div>
      )}
    </div>
  );
}

function ModeSwitch({ mode, setMode }: { mode: string; setMode: (m: string) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {[{ id: 'ia', label: 'IA', icon: Sparkles }, { id: 'manuel', label: 'Manuel', icon: FileText }].map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => setMode(id)}
          className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all',
            mode === id ? 'bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.35)]' : 'text-white/38 hover:text-white/70')}>
          <Icon className="h-3.5 w-3.5" />{label}
        </button>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function StudioLiriCourseBuilderPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'ia' | 'manuel'>('ia');
  const [blocs, setBlocs] = useState<Record<number, BlocData>>({});
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [sourceText, setSourceText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [error, setError] = useState('');

  const updateBloc = (stepNum: number, blocId: string, value: string | string[]) =>
    setBlocs(prev => ({ ...prev, [stepNum]: { ...(prev[stepNum] || {}), [blocId]: value } }));

  const score = (stepNum: number) => {
    const data = blocs[stepNum] || {};
    const filled = BLOCS.filter(b => {
      const v = data[b.id];
      return v && (Array.isArray(v) ? v.some(Boolean) : String(v).trim());
    }).length;
    return Math.round((filled / BLOCS.length) * 100);
  };

  const totalProgress = Math.round(
    STEPS.reduce((sum, s) => sum + score(s.numero), 0) / STEPS.length
  );

  const handleGenerate = useCallback(async () => {
    if (!sourceText.trim()) { setError('Saisissez un texte source'); return; }
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/masterclass-factory/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'X-Tenant-Slug': localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG,
        },
        body: JSON.stringify({ sourceText, pedagogicalModel: 'liri-v1' }),
      });
      const json = await res.json();
      if (json.data) setAiResult(json.data);
      else setError(json.error?.message || 'Erreur génération');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [sourceText]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a14] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-4">
          <Link to="/studio/liri" className="text-white/40 hover:text-white/70">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Course Builder</h1>
            <p className="text-[11px] text-white/30">10 étapes pédagogiques LIRI</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ModeSwitch mode={mode} setMode={setMode} />
          <div className="text-[11px] text-white/40">
            Progression : <span className="text-amber-400 font-medium">{totalProgress}%</span>
          </div>
          <button onClick={() => navigate('/studio/smartboard')}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500">
            <Layers className="h-3.5 w-3.5" /> Designer
          </button>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-500 disabled:opacity-50">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Générer IA
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left — Steps sidebar */}
        <aside className="flex w-52 flex-shrink-0 flex-col border-r border-white/[0.07]">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
            <Brain className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">Structure</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {mode === 'ia' ? (
              <div className="flex flex-col gap-3 p-2">
                <textarea value={sourceText} onChange={e => setSourceText(e.target.value)}
                  placeholder="Collez votre texte source ici pour la génération IA..."
                  rows={8}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 placeholder-white/22 outline-none focus:border-violet-500/40 leading-relaxed" />
                {error && <p className="text-[11px] text-red-400">{error}</p>}
                {aiResult && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[11px] text-emerald-400 font-medium">{aiResult.deck_title}</p>
                    <p className="text-[10px] text-white/40">{aiResult.chapters?.length || 0} chapitres générés</p>
                    <p className="text-[10px] text-white/30">Provider: {aiResult.provider || 'fallback'}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {STEPS.map(step => {
                  const s = score(step.numero);
                  const isActive = activeStep === step.numero;
                  return (
                    <button key={step.numero} onClick={() => setActiveStep(step.numero)}
                      className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left w-full transition-all',
                        isActive ? 'bg-amber-500/15 border border-amber-500/25' : 'hover:bg-white/5 border border-transparent')}>
                      <span className={cn('flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        s === 100 ? 'bg-emerald-500/25 text-emerald-300' : s > 0 ? 'bg-amber-500/25 text-amber-300' : 'bg-white/10 text-white/28')}>
                        {s === 100 ? '✓' : step.numero}
                      </span>
                      <div className="min-w-0">
                        <div className={cn('text-[11px] truncate', isActive ? 'text-white font-medium' : 'text-white/50')}>
                          {step.label}
                        </div>
                        <div className="text-[9px] text-white/22 truncate">{step.tag}</div>
                      </div>
                      {s > 0 && <span className="ml-auto text-[9px] text-amber-400/70 flex-shrink-0">{s}%</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Right — Blocs editor */}
        <main className="flex-1 overflow-y-auto p-6">
          {mode === 'manuel' && activeStep ? (
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 text-sm font-bold">
                  {activeStep}
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-white">
                    {STEPS.find(s => s.numero === activeStep)?.label}
                  </h2>
                  <p className="text-[11px] text-white/30">
                    {STEPS.find(s => s.numero === activeStep)?.tag} — {score(activeStep)}% complété
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {BLOCS.map(bloc => (
                  <PedaBloc key={bloc.id} bloc={bloc}
                    value={(blocs[activeStep] || {})[bloc.id] || (bloc.isArray ? ['', '', ''] : '')}
                    onChange={v => updateBloc(activeStep, bloc.id, v)} />
                ))}
              </div>
            </div>
          ) : mode === 'ia' ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="h-12 w-12 text-violet-400/30 mb-4" />
              <h2 className="text-lg font-semibold text-white/60 mb-2">Mode IA — LIRI Agent</h2>
              <p className="text-[13px] text-white/30 max-w-md">
                Collez votre texte source dans le panneau de gauche, puis cliquez sur <strong>Générer IA</strong>.
                Le moteur LIRI analysera le document et générera un cours complet avec 21 segments par chapitre.
              </p>
              {aiResult?.chapters && (
                <div className="mt-8 max-w-2xl w-full text-left">
                  <h3 className="text-[14px] font-semibold text-white mb-4">Chapitres générés ({aiResult.chapters.length})</h3>
                  <div className="flex flex-col gap-3">
                    {aiResult.chapters.map((ch: any, i: number) => (
                      <div key={ch.id || i} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[11px] font-bold text-violet-400">Ch.{i + 1}</span>
                          <span className="text-[13px] font-medium text-white">{ch.title}</span>
                        </div>
                        <p className="text-[11px] text-white/40 mb-2">{ch.objective}</p>
                        <div className="flex gap-2 flex-wrap">
                          {ch.segments?.slice(0, 5).map((seg: any) => (
                            <span key={seg.segment_id} className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] text-violet-300">
                              {seg.name}
                            </span>
                          ))}
                          {(ch.segments?.length || 0) > 5 && (
                            <span className="text-[10px] text-white/30">+{ch.segments.length - 5} segments</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Brain className="h-12 w-12 text-white/10 mb-4" />
              <h2 className="text-lg font-semibold text-white/40">Sélectionnez une étape</h2>
              <p className="text-[13px] text-white/20">Choisissez une étape dans le panneau de gauche pour éditer ses blocs pédagogiques.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
