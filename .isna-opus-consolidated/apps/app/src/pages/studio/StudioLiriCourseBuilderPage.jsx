/**
 * StudioLiriCourseBuilderPage — Course Builder LIRI v2
 * Route : /studio/liri/cours
 * Mode IA (LIRIAgent) + Mode manuel (blocs pédagogiques)
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, ChevronDown, ArrowRight, Sparkles, Layers,
  CheckCircle2, BookOpen, Target, Zap, MessageSquare,
  FileText, Radio, LayoutGrid, Plus, RefreshCw, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import StudioDesignerLikeShell from '@/components/liri-ecosystem/StudioDesignerLikeShell';
import LIRIAgent from '@/components/liri/LIRIAgent';

const STEPS_META = [
  { numero: 1,  tag: 'DÉCLENCHEUR',       label: 'Atelier ouverture' },
  { numero: 2,  tag: 'PARTICIPATION',      label: 'Interaction élèves' },
  { numero: 3,  tag: 'CONFLIT COGNITIF',   label: 'Limites / réfutation' },
  { numero: 4,  tag: 'ANNONCE',            label: 'Introduction cours' },
  { numero: 5,  tag: 'CONTEXTE HISTORIQUE',label: 'Historicité' },
  { numero: 6,  tag: 'DÉFINITION PRÉCISE', label: 'Définition concept' },
  { numero: 7,  tag: 'RAISONNEMENT',       label: 'Démonstration' },
  { numero: 8,  tag: 'ILLUSTRATION',       label: 'Exemples variés' },
  { numero: 9,  tag: 'SYNTHÈSE',           label: 'Conclusion doctrinale' },
  { numero: 10, tag: 'SAGESSE & OUVERTURE',label: 'Adage & ouverture' },
];

const BLOCS = [
  { id: 'idee_generale',    label: 'Idée générale',     icon: BookOpen,      accent: 'violet', placeholder: "L'idée centrale de cette étape..." },
  { id: 'idee_specifique',  label: 'Idée spécifique',   icon: Target,        accent: 'blue',   placeholder: 'Contenu détaillé pour le SmartBoard...' },
  { id: 'connaissance',     label: 'Connaissance cible',icon: Brain,         accent: 'amber',  placeholder: "Ce que l'élève doit comprendre..." },
  { id: 'competence',       label: 'Compétence cible',  icon: Zap,           accent: 'emerald',placeholder: "Ce que l'élève doit faire..." },
  { id: 'demonstration',    label: 'Démonstration',     icon: Eye,           accent: 'cyan',   placeholder: 'Étapes de démonstration...', isArray: true },
  { id: 'analogie',         label: 'Analogie',          icon: RefreshCw,     accent: 'purple', placeholder: 'Analogie mémorisable...' },
  { id: 'checkpoint',       label: 'Checkpoint',        icon: CheckCircle2,  accent: 'teal',   placeholder: "Question cible de compréhension..." },
  { id: 'mise_en_situation',label: 'Mise en situation', icon: MessageSquare, accent: 'orange', placeholder: "Exercice ou situation réelle d'application..." },
  { id: 'masterscript',     label: 'Master Script',     icon: FileText,      accent: 'rose',   placeholder: 'Discours oral du professeur (6-10 phrases)...' },
  { id: 'script_mot_a_mot', label: 'Script mot à mot',  icon: FileText,      accent: 'pink',   placeholder: 'Discours complet prêt à lire à voix haute...' },
];

const ACC = {
  violet: 'text-violet-400 bg-violet-500/10 border-violet-500/25',
  blue:   'text-blue-400 bg-blue-500/10 border-blue-500/25',
  amber:  'text-amber-400 bg-amber-500/10 border-amber-500/25',
  emerald:'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  cyan:   'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
  purple: 'text-purple-400 bg-purple-500/10 border-purple-500/25',
  teal:   'text-teal-400 bg-teal-500/10 border-teal-500/25',
  orange: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
  rose:   'text-rose-400 bg-rose-500/10 border-rose-500/25',
  pink:   'text-pink-400 bg-pink-500/10 border-pink-500/25',
};

function PedaBloc({ bloc, value, onChange }) {
  const [open, setOpen] = useState(false);
  const Icon = bloc.icon;
  const cls = (ACC[bloc.accent] || ACC.violet).split(' ');
  const hasContent = value && (Array.isArray(value) ? value.some(Boolean) : value.trim());
  return (
    <div className={cn('rounded-xl border overflow-hidden transition-all', open ? cls[2] : 'border-white/[0.07]')}>
      <button onClick={() => setOpen(v => !v)} className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-all', open ? cn(cls[1], 'border-b border-white/[0.07]') : 'hover:bg-white/[0.03]')}>
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
              <input key={i} value={line} onChange={e => { const a = Array.isArray(value) ? [...value] : ['', '', '']; a[i] = e.target.value; onChange(a); }}
                placeholder={`Étape ${i + 1}...`} className="w-full mb-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white placeholder-white/22 outline-none focus:border-white/20" />
            ))
            : <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={bloc.placeholder} rows={4}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 placeholder-white/22 outline-none focus:border-white/20 leading-relaxed" />
          }
        </div>
      )}
    </div>
  );
}

function ModeBtn({ mode, setMode }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {[{ id: 'ia', label: 'IA', icon: Sparkles }, { id: 'manuel', label: 'Manuel', icon: FileText }].map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => setMode(id)}
          className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all', mode === id ? 'bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.35)]' : 'text-white/38 hover:text-white/70')}>
          <Icon className="h-3.5 w-3.5" />{label}
        </button>
      ))}
    </div>
  );
}

export default function StudioLiriCourseBuilderPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('ia');
  const [blocs, setBlocs] = useState({});
  const [activeStep, setActiveStep] = useState(null);

  const updateBloc = (stepNum, blocId, value) =>
    setBlocs(prev => ({ ...prev, [stepNum]: { ...(prev[stepNum] || {}), [blocId]: value } }));

  const score = stepNum => {
    const data = blocs[stepNum] || {};
    const filled = BLOCS.filter(b => { const v = data[b.id]; return v && (Array.isArray(v) ? v.some(Boolean) : v.trim()); }).length;
    return Math.round((filled / BLOCS.length) * 100);
  };

  return (
    <StudioDesignerLikeShell
      railActiveKey="cours"
      pageLabel="Cours"
      pageAccent="amber"
      TitleIcon={Brain}
      titleLine="Course Builder"
      topBarActions={(
        <div className="flex items-center gap-2">
          <ModeBtn mode={mode} setMode={setMode} />
          <button type="button" onClick={() => navigate('/studio/smartboard-designer')}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.35)]">
            <Layers className="h-3.5 w-3.5" /> Designer
          </button>
        </div>
      )}
    >
      <div className="flex min-h-0 w-full flex-1">
        {/* Gauche — 10 étapes */}
        <aside className="flex w-52 flex-shrink-0 flex-col overflow-hidden border-r border-white/[0.07]">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
            <Brain className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">Structure</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {mode === 'manuel'
              ? <div className="flex flex-col gap-0.5">
                  {STEPS_META.map(step => {
                    const s = score(step.numero);
                    const isActive = activeStep === step.numero;
                    return (
                      <button key={step.numero} onClick={() => setActiveStep(step.numero)}
                        className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left w-full transition-all', isActive ? 'bg-amber-500/15 border border-amber-500/25' : 'hover:bg-white/5 border border-transparent')}>
                        <span className={cn('flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold', s === 100 ? 'bg-emerald-500/25 text-emerald-300' : s > 0 ? 'bg-amber-500/25 text-amber-300' : 'bg-white/10 text-white/28')}>
                          {s === 100 ? '✓' : step.numero}
                        </span>
                        <div className="min-w-0">
                          <div className={cn('text-[11px] font-medium truncate', isActive ? 'text-amber-300' : 'text-white/50')}>{step.label}</div>
                          <div className="text-[9px] text-white/22 truncate">{step.tag}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              : <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Sparkles className="h-7 w-7 text-amber-400/28 mb-3" />
                  <p className="text-[11px] text-white/22 leading-relaxed">Générez un cours avec LIRI pour voir les 10 étapes ici</p>
                </div>
            }
          </div>
        </aside>

        {/* Centre */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {mode === 'ia' ? (
            <div className="h-full">
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/[0.07] bg-[#0F1117]/95 px-6 py-2 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-[12px] text-white/45">Génération IA — méthode LIRI 10 étapes · MasterScript v2 · Checkpoints</span>
              </div>
              <div className="px-4 py-4"><LIRIAgent /></div>
            </div>
          ) : activeStep === null ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
              <Brain className="h-12 w-12 text-white/8 mb-4" />
              <h3 className="text-[16px] font-semibold text-white/55 mb-2">Sélectionnez une étape</h3>
              <p className="text-[13px] text-white/28 max-w-sm">Choisissez une des 10 étapes dans l'arbre à gauche pour remplir ses blocs pédagogiques.</p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl px-8 py-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-[12px] font-bold text-amber-300">{activeStep}</span>
                  <span className="text-[11px] uppercase tracking-[0.15em] text-amber-400 font-medium">{STEPS_META[activeStep - 1]?.tag}</span>
                </div>
                <h2 className="text-[18px] font-bold text-white">{STEPS_META[activeStep - 1]?.label}</h2>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500" style={{ width: `${score(activeStep)}%` }} />
                  </div>
                  <span className="text-[11px] text-white/32 flex-shrink-0">{score(activeStep)}%</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {BLOCS.map(bloc => (
                  <PedaBloc key={bloc.id} bloc={bloc} value={blocs[activeStep]?.[bloc.id]} onChange={val => updateBloc(activeStep, bloc.id, val)} />
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <button disabled={activeStep <= 1} onClick={() => setActiveStep(s => s - 1)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-[12px] text-white/45 transition-all hover:border-white/20 hover:text-white/80 disabled:opacity-28 disabled:cursor-not-allowed">
                  ← Précédente
                </button>
                {activeStep < 10
                  ? <button onClick={() => setActiveStep(s => s + 1)} className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 px-4 py-2 text-[12px] text-amber-300 transition-all hover:bg-amber-500/30">Suivante →</button>
                  : <button onClick={() => navigate('/studio/smartboard-designer')} className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.35)]">
                      <Layers className="h-3.5 w-3.5" /> Designer <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                }
              </div>
            </div>
          )}
        </main>

        {/* Droite */}
        <aside className="flex w-56 flex-shrink-0 flex-col overflow-hidden border-l border-white/[0.07]">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">Qualité</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="text-[11px] font-semibold text-white/45 mb-2">Règles LIRI v2</div>
              {['Jamais d\'affirmation sans structure','Toute connaissance = démonstration','Toute compétence = testable','1 segment = 1 idée centrale','Pas de progression sans checkpoint'].map((r, i) => (
                <div key={i} className="flex items-start gap-1.5 mb-1">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500/55 flex-shrink-0" />
                  <span className="text-[10px] text-white/32 leading-relaxed">{r}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
              <div className="flex items-center gap-2 mb-1.5"><LayoutGrid className="h-3.5 w-3.5 text-cyan-400" /><span className="text-[11px] font-semibold text-cyan-400">SmartBoard Ready</span></div>
              <p className="text-[10px] text-white/32 leading-relaxed">1 sous-chapitre = 1 slide<br />1 segment = 1 étape progressive</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="text-[11px] font-semibold text-amber-400 mb-2">Formule LIRI</div>
              <div className="text-[11px] text-amber-300/65 leading-loose">expérience → question → réflexion → démonstration → compréhension → application</div>
            </div>
          </div>
        </aside>
      </div>
    </StudioDesignerLikeShell>
  );
}
