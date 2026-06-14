import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { invokeSupabaseFunction } from '@/lib/supabaseEdgeInvoke';

const PEDAGOGICAL_PROFILES = [
  { id: 'auto', label: 'Auto' },
  { id: 'maitre_pedagogue', label: 'Maitre pedagogique' },
  { id: 'architecte', label: 'Architecte' },
  { id: 'cours_rapide', label: 'Cours rapide' },
  { id: 'assistant_eco', label: 'Assistant eco' },
];

function Badge({ ready, label }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      ready
        ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
        : 'border border-white/20 bg-white/[0.04] text-white/60'
    }`}>
      {ready ? <CheckCircle2 className="h-3 w-3" /> : null}
      {label}
    </span>
  );
}

export default function StudioFormationLlmBuilderPage() {
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('ISNA');
  const [level, setLevel] = useState('intermediaire');
  const [profile, setProfile] = useState('auto');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const steps = useMemo(() => (Array.isArray(result?.etapes) ? result.etapes : []), [result]);
  const canGenerate = title.trim().length > 3 || prompt.trim().length > 10;

  const handleGenerate = async () => {
    if (!canGenerate || loading) return;
    setLoading(true);
    setError('');
    try {
      const sujet = [title.trim(), prompt.trim()].filter(Boolean).join('\n\n');
      const body = await invokeSupabaseFunction(supabase, 'liri-agent-course-generate', {
        body: {
          sujet,
          niveau: level,
          contexte: context,
          profil_pedagogique: profile,
        },
      });
      const cours = body?.cours;
      if (!cours || !Array.isArray(cours.etapes) || cours.etapes.length === 0) {
        throw new Error('Reponse LLM invalide: aucune etape retournee.');
      }
      setResult(cours);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur generation.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#070b14] text-white">
      <div className="mx-auto max-w-[1320px] px-4 py-5">
        <div className="mb-4 flex items-center gap-2">
          <Link
            to="/studio"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/75 transition hover:border-white/25 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Studio
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
            <Sparkles className="h-3 w-3" />
            Formation LLM Builder
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-white/10 bg-[#0c1324] p-4">
            <h1 className="text-[20px] font-bold text-white">Creation de cours par LLM</h1>
            <p className="mt-1 text-[12px] text-white/55">
              Ecran dedie uniquement a la generation pedagogique. Aucun melange avec SmartBoard Designer ici.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-white/60">Titre de la formation / cours</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Introduction a la logique mathematique"
                  className="w-full rounded-lg border border-white/15 bg-[#080c16] px-3 py-2 text-[12px] text-white outline-none focus:border-cyan-400/40"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] text-white/60">Contexte</label>
                  <input
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-[#080c16] px-3 py-2 text-[12px] text-white outline-none focus:border-cyan-400/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-white/60">Niveau</label>
                  <input
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-[#080c16] px-3 py-2 text-[12px] text-white outline-none focus:border-cyan-400/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-white/60">Profil IA</label>
                  <select
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-[#080c16] px-3 py-2 text-[12px] text-white outline-none focus:border-cyan-400/40"
                  >
                    {PEDAGOGICAL_PROFILES.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-white/60">Brief pedagogique</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={7}
                  placeholder="Objectifs, public, style pedagogique, contraintes..."
                  className="w-full resize-none rounded-lg border border-white/15 bg-[#080c16] px-3 py-2 text-[12px] text-white outline-none focus:border-cyan-400/40"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/80 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Generer le cours
              </button>
            </div>
          </aside>

          <section className="rounded-2xl border border-white/10 bg-[#0c1324] p-4">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan-300" />
              <h2 className="text-[14px] font-semibold text-white/90">Resultat de generation</h2>
              <div className="ml-auto flex gap-1.5">
                <Badge ready={Boolean(result?.titre)} label="Titre" />
                <Badge ready={steps.length > 0} label="Etapes" />
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                {error}
              </div>
            ) : null}

            {!result && !loading ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-[12px] text-white/45">
                Lance une generation pour afficher la structure du cours ici.
              </div>
            ) : null}

            {result ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">Titre</p>
                  <p className="mt-1 text-[16px] font-semibold text-white">{result.titre || 'Sans titre'}</p>
                  <p className="mt-1 text-[12px] text-white/55">{result.objectif || result.sous_titre || '-'}</p>
                </div>
                <div className="space-y-2">
                  {steps.map((step, idx) => (
                    <div key={idx} className="rounded-xl border border-white/10 bg-[#0a0f1d] p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-cyan-300/80">Etape {step?.numero || idx + 1}</p>
                      <p className="mt-1 text-[13px] font-semibold text-white/90">{step?.smartboard?.titre || step?.tag || `Etape ${idx + 1}`}</p>
                      <p className="mt-1 text-[12px] text-white/55">{step?.smartboard?.contenu || step?.smartboard?.idee || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
