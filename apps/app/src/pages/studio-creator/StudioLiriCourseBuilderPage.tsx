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

// Les dix blocs pédagogiques étaient distingués UNIQUEMENT par la couleur :
// c'est le seul repère visuel quand une étape est déployée. On conserve donc
// dix nuances distinctes — mais toutes CHAUDES. Les clés sont renommées avec
// des noms de teintes chaudes pour qu'aucun identifiant froid (`violet`,
// `blue`, `cyan`, `teal`, `purple`) ne survive dans le code.
const BLOCS = [
  { id: 'idee_generale', label: 'Idée générale', icon: BookOpen, accent: 'corail', placeholder: "L'idée centrale..." },
  { id: 'idee_specifique', label: 'Idée spécifique', icon: Target, accent: 'brique', placeholder: 'Contenu détaillé pour le SmartBoard...' },
  { id: 'connaissance', label: 'Connaissance cible', icon: Brain, accent: 'or', placeholder: "Ce que l'élève doit comprendre..." },
  { id: 'competence', label: 'Compétence cible', icon: Zap, accent: 'olive', placeholder: "Ce que l'élève doit faire..." },
  { id: 'demonstration', label: 'Démonstration', icon: Eye, accent: 'ambre', placeholder: 'Étapes de démonstration...', isArray: true },
  { id: 'analogie', label: 'Analogie', icon: RefreshCw, accent: 'terre', placeholder: 'Analogie mémorisable...' },
  { id: 'checkpoint', label: 'Checkpoint', icon: CheckCircle2, accent: 'sable', placeholder: 'Question cible...' },
  { id: 'mise_en_situation', label: 'Mise en situation', icon: MessageSquare, accent: 'argile', placeholder: "Exercice d'application..." },
  { id: 'masterscript', label: 'Master Script', icon: FileText, accent: 'brasier', placeholder: 'Discours oral (6-10 phrases)...' },
  { id: 'script_mot_a_mot', label: 'Script mot à mot', icon: FileText, accent: 'cuivre', placeholder: 'Discours complet...' },
];

// Rampe chaude LIRI. Chaque entrée = « encre  fond  bordure », dans cet ordre :
// PedaBloc découpe la chaîne par espace et utilise cls[0]/cls[1]/cls[2].
// Toutes les encres tiennent ≥ 5,1:1 sur le fond de page #262624.
const ACCENTS: Record<string, string> = {
  corail: 'text-[#e08a5f] bg-[#d97757]/10 border-[#d97757]/25',   // 5,75:1
  brique: 'text-[#daa07a] bg-[#cf7a52]/10 border-[#cf7a52]/25',   // 6,71:1
  or: 'text-[#e6b878] bg-[#d99a4e]/10 border-[#d99a4e]/25',       // 8,30:1
  olive: 'text-[#8fbf7a] bg-[#5a8f52]/10 border-[#5a8f52]/25',    // 7,15:1
  ambre: 'text-[#e0a458] bg-[#d4924a]/10 border-[#d4924a]/25',    // 6,95:1
  terre: 'text-[#dc9a72] bg-[#d8916a]/10 border-[#d8916a]/25',    // 6,43:1
  sable: 'text-[#e6c48f] bg-[#c9a25e]/10 border-[#c9a25e]/25',    // 9,14:1
  argile: 'text-[#e0976a] bg-[#cf8059]/10 border-[#cf8059]/25',   // 6,36:1
  brasier: 'text-[#ec8a72] bg-[#e0705a]/10 border-[#e0705a]/25',  // 6,10:1
  cuivre: 'text-[#dd8f6e] bg-[#c96544]/10 border-[#c96544]/25',   // 5,94:1
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
  // Repli sur le corail (l'ancien repli pointait sur la clé `violet`, supprimée).
  const cls = (ACCENTS[bloc.accent] || ACCENTS.corail).split(' ');
  const hasContent = value && (Array.isArray(value) ? value.some(Boolean) : String(value).trim());

  return (
    <div className={cn('rounded-xl border overflow-hidden transition-all', open ? cls[2] : 'border-[#f5f4ee]/[0.09]')}>
      <button onClick={() => setOpen(v => !v)}
        className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-all',
          open ? cn(cls[1], 'border-b border-[#f5f4ee]/[0.09]') : 'hover:bg-[#f5f4ee]/[0.04]')}>
        <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', cls[1])}>
          <Icon className={cn('h-3.5 w-3.5', cls[0])} />
        </div>
        {/* Le libellé replié était à /50 (4,4:1) : remonté à /65 (6,7:1). */}
        <span className={cn('flex-1 text-[12px] font-medium', open ? 'text-[#f5f4ee]' : 'text-[#f5f4ee]/65')}>{bloc.label}</span>
        {hasContent && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-[#8fbf7a]" />}
        <ChevronDown className={cn('h-3.5 w-3.5 flex-shrink-0 text-[#f5f4ee]/40 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        // Zone de saisie = #1f1e1c de la charte (aperçu média / bloc de saisie).
        <div className="bg-[#1f1e1c] px-4 py-3">
          {bloc.isArray
            ? (Array.isArray(value) ? value : ['', '', '']).map((line, i) => (
              <input key={i} value={line} onChange={e => {
                const a = Array.isArray(value) ? [...value] : ['', '', ''];
                a[i] = e.target.value;
                onChange(a);
              }}
                placeholder={`Étape ${i + 1}...`}
                className="w-full mb-2 rounded-lg border border-[#f5f4ee]/10 bg-[#2b2a27] px-3 py-2 text-[12px] text-[#f5f4ee] placeholder-[#f5f4ee]/45 outline-none focus:border-[#d97757]/50" />
            ))
            // Champ de saisie = #2b2a27 (charte). Placeholder remonté de /22
            // (2,0:1, illisible) à /45 sur ce fond.
            : <textarea value={String(value || '')} onChange={e => onChange(e.target.value)}
                placeholder={bloc.placeholder} rows={4}
                className="w-full resize-none rounded-lg border border-[#f5f4ee]/10 bg-[#2b2a27] px-3 py-2 text-[12px] text-[#f5f4ee]/80 placeholder-[#f5f4ee]/45 outline-none focus:border-[#d97757]/50 leading-relaxed" />
          }
        </div>
      )}
    </div>
  );
}

function ModeSwitch({ mode, setMode }: { mode: string; setMode: (m: string) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-[#f5f4ee]/10 bg-[#1f1e1c] p-1">
      {[{ id: 'ia', label: 'IA', icon: Sparkles }, { id: 'manuel', label: 'Manuel', icon: FileText }].map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => setMode(id)}
          // Pastille active : corail plein + encre SOMBRE. Le blanc sur corail
          // ne donne que 2,8:1 ; #1f1e1c sur #d97757 donne 5,3:1.
          className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all',
            mode === id ? 'bg-[#d97757] text-[#1f1e1c] shadow-[0_0_12px_rgba(217,119,87,0.35)]' : 'text-[#f5f4ee]/65 hover:text-[#f5f4ee]')}>
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
    <div className="flex flex-col min-h-screen bg-[#262624] text-[#f5f4ee]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#f5f4ee]/[0.09]">
        <div className="flex items-center gap-4">
          <Link to="/studio/liri" className="text-[#f5f4ee]/65 hover:text-[#d97757] transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[#f5f4ee]">Course Builder</h1>
            <p className="text-[11px] text-[#f5f4ee]/65">10 étapes pédagogiques LIRI</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ModeSwitch mode={mode} setMode={setMode} />
          <div className="text-[11px] text-[#f5f4ee]/65">
            Progression : <span className="text-[#e6b878] font-medium">{totalProgress}%</span>
          </div>
          {/* Deux actions côte à côte : on garde la hiérarchie qui était portée
              par violet vs ambre en jouant sur l'INTENSITÉ chaude — « Générer
              IA » (action principale) en corail plein, « Designer » (sortie
              secondaire) en or contourné. */}
          <button onClick={() => navigate('/studio/smartboard')}
            className="flex items-center gap-1.5 rounded-lg border border-[#d99a4e]/35 bg-[#d99a4e]/10 px-3 py-1.5 text-[11px] font-semibold text-[#e6b878] hover:bg-[#d99a4e]/20 transition-colors">
            <Layers className="h-3.5 w-3.5" /> Designer
          </button>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-1.5 rounded-lg bg-[#d97757] px-3 py-1.5 text-[11px] font-semibold text-[#1f1e1c] hover:bg-[#e08a5f] disabled:opacity-50 transition-colors">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Générer IA
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left — Steps sidebar */}
        <aside className="flex w-52 flex-shrink-0 flex-col border-r border-[#f5f4ee]/[0.09] bg-[#30302e]">
          <div className="flex items-center gap-2 border-b border-[#f5f4ee]/[0.09] px-4 py-3">
            <Brain className="h-3.5 w-3.5 text-[#e0a458]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f5f4ee]/65">Structure</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {mode === 'ia' ? (
              <div className="flex flex-col gap-3 p-2">
                <textarea value={sourceText} onChange={e => setSourceText(e.target.value)}
                  placeholder="Collez votre texte source ici pour la génération IA..."
                  rows={8}
                  className="w-full resize-none rounded-lg border border-[#f5f4ee]/10 bg-[#2b2a27] px-3 py-2 text-[12px] text-[#f5f4ee]/80 placeholder-[#f5f4ee]/45 outline-none focus:border-[#d97757]/50 leading-relaxed" />
                {/* Rouge d'alerte chaud. POURQUOI CETTE VALEUR : le fond RÉEL de ce
                    message n'est pas le fond de page #262624 mais le PANNEAU #30302e
                    de l'<aside> qui le contient — plus clair, donc moins contrasté.
                    #ef6a52 n'y tenait que 4,32:1, sous la norme de 4,5:1 pour du texte
                    courant ; éclairci en #f28a74 → 5,46:1 sur #30302e. Reste un rouge
                    (erreur), distinct du corail #d97757 qui porte LES ACTIONS. */}
                {error && <p className="text-[11px] text-[#f28a74]">{error}</p>}
                {aiResult && (
                  <div className="rounded-lg border border-[#5a8f52]/25 bg-[#5a8f52]/10 p-3">
                    <p className="text-[11px] text-[#8fbf7a] font-medium">{aiResult.deck_title}</p>
                    <p className="text-[10px] text-[#f5f4ee]/65">{aiResult.chapters?.length || 0} chapitres générés</p>
                    <p className="text-[10px] text-[#f5f4ee]/60">Moteur : {aiResult.provider || 'repli'}</p>
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
                        isActive ? 'bg-[#d97757]/15 border border-[#d97757]/30' : 'hover:bg-[#f5f4ee]/[0.05] border border-transparent')}>
                      {/* Pastille d'avancement : olive = terminé, or = entamé,
                          neutre = vierge. Trois états, trois teintes chaudes. */}
                      <span className={cn('flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        s === 100 ? 'bg-[#5a8f52]/25 text-[#9cc48a]' : s > 0 ? 'bg-[#d99a4e]/25 text-[#e6b878]' : 'bg-[#f5f4ee]/10 text-[#f5f4ee]/60')}>
                        {s === 100 ? '✓' : step.numero}
                      </span>
                      <div className="min-w-0">
                        <div className={cn('text-[11px] truncate', isActive ? 'text-[#f5f4ee] font-medium' : 'text-[#f5f4ee]/65')}>
                          {step.label}
                        </div>
                        <div className="text-[9px] text-[#f5f4ee]/60 truncate">{step.tag}</div>
                      </div>
                      {s > 0 && <span className="ml-auto text-[9px] text-[#e6b878] flex-shrink-0">{s}%</span>}
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
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d99a4e]/15 text-[#e6b878] text-sm font-bold">
                  {activeStep}
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-[#f5f4ee]">
                    {STEPS.find(s => s.numero === activeStep)?.label}
                  </h2>
                  <p className="text-[11px] text-[#f5f4ee]/65">
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
              <Sparkles className="h-12 w-12 text-[#d97757]/45 mb-4" />
              <h2 className="text-lg font-semibold text-[#f5f4ee]/80 mb-2">Mode IA — Agent LIRI</h2>
              <p className="text-[13px] text-[#f5f4ee]/65 max-w-md">
                Collez votre texte source dans le panneau de gauche, puis cliquez sur <strong>Générer IA</strong>.
                Le moteur LIRI analysera le document et générera un cours complet avec 21 segments par chapitre.
              </p>
              {aiResult?.chapters && (
                <div className="mt-8 max-w-2xl w-full text-left">
                  <h3 className="text-[14px] font-semibold text-[#f5f4ee] mb-4">Chapitres générés ({aiResult.chapters.length})</h3>
                  <div className="flex flex-col gap-3">
                    {aiResult.chapters.map((ch: any, i: number) => (
                      <div key={ch.id || i} className="rounded-xl border border-[#f5f4ee]/[0.09] bg-[#30302e] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[11px] font-bold text-[#e08a5f]">Ch.{i + 1}</span>
                          <span className="text-[13px] font-medium text-[#f5f4ee]">{ch.title}</span>
                        </div>
                        <p className="text-[11px] text-[#f5f4ee]/65 mb-2">{ch.objective}</p>
                        <div className="flex gap-2 flex-wrap">
                          {ch.segments?.slice(0, 5).map((seg: any) => (
                            <span key={seg.segment_id} className="rounded-full bg-[#d97757]/10 border border-[#d97757]/25 px-2 py-0.5 text-[10px] text-[#e8a97f]">
                              {seg.name}
                            </span>
                          ))}
                          {(ch.segments?.length || 0) > 5 && (
                            <span className="text-[10px] text-[#f5f4ee]/60">+{ch.segments.length - 5} segments</span>
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
              <Brain className="h-12 w-12 text-[#f5f4ee]/20 mb-4" />
              {/* État vide : c'était du /40 et du /20 (3,5:1 et 1,8:1) sur un
                  écran quasi vide — l'utilisateur ne voyait plus la consigne. */}
              <h2 className="text-lg font-semibold text-[#f5f4ee]/80">Sélectionnez une étape</h2>
              <p className="text-[13px] text-[#f5f4ee]/65">Choisissez une étape dans le panneau de gauche pour éditer ses blocs pédagogiques.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
