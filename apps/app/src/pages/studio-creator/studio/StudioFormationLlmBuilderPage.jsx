import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { invokeSupabaseFunction } from '@/lib/supabaseEdgeInvoke';
import StudioDesignerLikeShell from '@/components/liri/liri-ecosystem/StudioDesignerLikeShell';
import { usePublishToClassroom } from '@/hooks/usePublishToClassroom';
import { agentCourseToClassroomDraft } from '@/lib/precepteur/toClassroomDraft';

const PEDAGOGICAL_PROFILES = [
  { id: 'auto', label: 'Auto' },
  { id: 'maitre_pedagogue', label: 'Maître pédagogique' },
  { id: 'architecte', label: 'Architecte' },
  { id: 'cours_rapide', label: 'Cours rapide' },
  { id: 'assistant_eco', label: 'Assistant éco' },
];

function Badge({ ready, label }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      ready
        ? 'border border-[#d97757]/30 bg-[#d97757]/12 text-[#e3aa6b]'
        : 'border border-white/[0.12] bg-white/[0.04] text-white/60'
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
  const [publishing, setPublishing] = useState(false);
  const navigate = useNavigate();
  const { publish } = usePublishToClassroom();

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
        throw new Error('Réponse LLM invalide : aucune étape retournée.');
      }
      setResult(cours);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur génération.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // PUBLIER EN CLASSE : le cours généré (etapes) → formation réelle (courses + structure)
  // via le point de convergence usePublishToClassroom → visible dans l'OS /liri/formations.
  const handlePublish = async () => {
    if (!result || publishing) return;
    setPublishing(true);
    setError('');
    try {
      const draft = agentCourseToClassroomDraft(result);
      const { id, error: pErr } = await publish(draft);
      if (pErr) { setError('Publication impossible : ' + (pErr.message || pErr)); return; }
      navigate(id ? `/liri/formations?course=${id}` : '/liri/formations');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publication impossible.');
    } finally {
      setPublishing(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-[12px] text-[#f5f1e9] outline-none transition-all focus:border-[#d97757]/50 focus:bg-white/[0.06]';

  return (
    <StudioDesignerLikeShell
      railActiveKey="constructeurs"
      pageLabel="Création de cours par LLM"
      pageAccent="violet"
      TitleIcon={Sparkles}
      titleLine="Formation LLM Builder"
    >
      <div className="mx-auto max-w-[1320px] px-4 py-5">
        <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-white/[0.08] bg-transparent p-4">
            <h1 className="text-[20px] font-bold text-[#f5f1e9]">Création de cours par LLM</h1>
            <p className="mt-1 text-[12px] text-white/55">
              Écran dédié uniquement à la génération pédagogique. Aucun mélange avec SmartBoard Designer ici.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-white/60">Titre de la formation / cours</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex : Introduction à la logique mathématique"
                  className={inputCls}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] text-white/60">Contexte</label>
                  <input
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-white/60">Niveau</label>
                  <input
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-white/60">Profil IA</label>
                  <select
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                    className={`${inputCls} cursor-pointer`}
                  >
                    {PEDAGOGICAL_PROFILES.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-white/60">Brief pédagogique</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={7}
                  placeholder="Objectifs, public, style pédagogique, contraintes..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-[#d97757] px-3 py-2 text-[11px] font-semibold text-white transition-all hover:bg-[#c9673f] disabled:opacity-40 shadow-[0_0_14px_rgba(217,119,87,0.32)]"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Générer le cours
              </button>
            </div>
          </aside>

          <section className="rounded-2xl border border-white/[0.08] bg-transparent p-4">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#e3aa6b]" />
              <h2 className="text-[14px] font-semibold text-white/90">Résultat de génération</h2>
              <div className="ml-auto flex gap-1.5">
                <Badge ready={Boolean(result?.titre)} label="Titre" />
                <Badge ready={steps.length > 0} label="Étapes" />
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                {error}
              </div>
            ) : null}

            {!result && !loading ? (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-10 text-center text-[12px] text-white/45">
                Lance une génération pour afficher la structure du cours ici.
              </div>
            ) : null}

            {result ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">Titre</p>
                  <p className="mt-1 text-[16px] font-semibold text-[#f5f1e9]">{result.titre || 'Sans titre'}</p>
                  <p className="mt-1 text-[12px] text-white/55">{result.objectif || result.sous_titre || '-'}</p>
                </div>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#d97757] px-3 py-2.5 text-[12px] font-semibold text-white transition-all hover:bg-[#c9673f] disabled:opacity-40 shadow-[0_0_14px_rgba(217,119,87,0.32)]"
                >
                  {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Publier en classe (Mes formations)
                </button>
                <div className="space-y-2">
                  {steps.map((step, idx) => (
                    <div key={idx} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#e3aa6b]/85">Étape {step?.numero || idx + 1}</p>
                      <p className="mt-1 text-[13px] font-semibold text-white/90">{step?.smartboard?.titre || step?.tag || `Étape ${idx + 1}`}</p>
                      <p className="mt-1 text-[12px] text-white/55">{step?.smartboard?.contenu || step?.smartboard?.idee || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </StudioDesignerLikeShell>
  );
}
