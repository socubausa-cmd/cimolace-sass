import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clapperboard,
  GraduationCap,
  LayoutGrid,
  Loader2,
  Sparkles,
  UploadCloud,
  Wand2,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { invokeSupabaseFunction } from '@/lib/supabaseEdgeInvoke';

const LOCAL_RUN_KEY = 'isna_pipeline_run_v1';
const PHASE3_HANDOFF_KEY = 'isna_phase3_handoff_v1';

const PHASES = [
  {
    id: 'p1',
    title: 'Phase 1 - Ingestion video',
    description: 'Importer la video source, preparer la matiere brute et lancer la chaine initiale.',
    cta: 'Ouvrir Course Lab',
    href: '/studio/course-lab',
    icon: UploadCloud,
  },
  {
    id: 'p2',
    title: 'Phase 2 - Structuration pedagogique',
    description: 'Transformer le contenu en cours structure (etapes, blocs, objectifs, scripts).',
    cta: 'Ouvrir Course Builder LIRI',
    href: '/studio/liri/cours',
    icon: Wand2,
  },
  {
    id: 'p3',
    title: 'Phase 3 - Slides & SmartBoard',
    description: 'Composer le rendu visuel, les scenes et les elements de tableau interactif.',
    cta: 'Ouvrir SmartBoard Designer',
    href: '/studio/smartboard-designer',
    icon: LayoutGrid,
  },
  {
    id: 'p4',
    title: 'Phase 4 - LongIA & intelligence live',
    description: 'Passer au mode live et activer les briques d assistance IA pour l orchestration.',
    cta: 'Ouvrir Live Lab',
    href: '/studio/live-lab',
    icon: Bot,
  },
  {
    id: 'p5',
    title: 'Phase 5 - Export & publication',
    description: 'Exporter, relire, puis publier les artefacts finaux dans le flux de production.',
    cta: 'Ouvrir Export Center',
    href: '/studio/export-center',
    icon: Clapperboard,
  },
];

const emptyPhase1 = { status: 'idle', message: '', transcript: [] };
const emptyPhase2 = { status: 'idle', message: '', courseJson: null, meta: null };

const isMissingTableError = (error) => {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('relation');
};

export default function StudioIsnaPipelinePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [videoUrl, setVideoUrl] = useState('');
  const [courseBrief, setCourseBrief] = useState('');
  const [niveau, setNiveau] = useState('intermediaire');
  const [contexte, setContexte] = useState('ISNA');
  const [profilPedagogique, setProfilPedagogique] = useState('auto');
  const [phase1State, setPhase1State] = useState(emptyPhase1);
  const [phase2State, setPhase2State] = useState(emptyPhase2);
  const [runId, setRunId] = useState(null);
  const [persistenceStatus, setPersistenceStatus] = useState('pending');
  const [persistenceMessage, setPersistenceMessage] = useState('');
  const [historyRows, setHistoryRows] = useState([]);

  const transcriptPreview = useMemo(
    () => phase1State.transcript.slice(0, 4).map((line) => `${line.time || '0:00'} - ${line.text}`).join('\n'),
    [phase1State.transcript],
  );

  const buildSnapshot = useCallback(() => ({
    videoUrl,
    courseBrief,
    niveau,
    contexte,
    profilPedagogique,
    phase1State,
    phase2State,
    savedAt: new Date().toISOString(),
  }), [videoUrl, courseBrief, niveau, contexte, profilPedagogique, phase1State, phase2State]);

  const hydrateFromSnapshot = useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') return;
    setVideoUrl(String(snapshot.videoUrl || ''));
    setCourseBrief(String(snapshot.courseBrief || ''));
    setNiveau(String(snapshot.niveau || 'intermediaire'));
    setContexte(String(snapshot.contexte || 'ISNA'));
    setProfilPedagogique(String(snapshot.profilPedagogique || 'auto'));
    setPhase1State(snapshot.phase1State && typeof snapshot.phase1State === 'object' ? snapshot.phase1State : emptyPhase1);
    setPhase2State(snapshot.phase2State && typeof snapshot.phase2State === 'object' ? snapshot.phase2State : emptyPhase2);
  }, []);

  const saveLocalSnapshot = useCallback((snapshot) => {
    try {
      localStorage.setItem(LOCAL_RUN_KEY, JSON.stringify(snapshot));
    } catch {
      // no-op
    }
  }, []);

  const saveRun = useCallback(async () => {
    const snapshot = buildSnapshot();
    saveLocalSnapshot(snapshot);
    setPersistenceStatus('running');
    setPersistenceMessage('Sauvegarde du run...');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess?.session?.user?.id;
      if (!userId) {
        setPersistenceStatus('local');
        setPersistenceMessage('Sauvegarde locale uniquement (session introuvable).');
        return;
      }

      const payload = {
        created_by: userId,
        video_url: snapshot.videoUrl,
        course_brief: snapshot.courseBrief,
        niveau: snapshot.niveau,
        contexte: snapshot.contexte,
        profil_pedagogique: snapshot.profilPedagogique,
        phase1_status: snapshot.phase1State?.status || 'idle',
        phase1_message: snapshot.phase1State?.message || '',
        phase1_transcript: Array.isArray(snapshot.phase1State?.transcript) ? snapshot.phase1State.transcript : [],
        phase2_status: snapshot.phase2State?.status || 'idle',
        phase2_message: snapshot.phase2State?.message || '',
        course_json: snapshot.phase2State?.courseJson || {},
        meta_json: snapshot.phase2State?.meta || {},
        snapshot_json: snapshot,
      };

      let error = null;
      let data = null;
      if (runId) {
        const res = await supabase
          .from('isna_pipeline_runs')
          .update(payload)
          .eq('id', runId)
          .select('id, updated_at')
          .single();
        error = res.error;
        data = res.data;
      } else {
        const res = await supabase
          .from('isna_pipeline_runs')
          .insert(payload)
          .select('id, updated_at')
          .single();
        error = res.error;
        data = res.data;
      }

      if (error) {
        if (isMissingTableError(error)) {
          setPersistenceStatus('local');
          setPersistenceMessage('Table DB absente: fallback localStorage actif.');
          return;
        }
        throw error;
      }

      if (data?.id) setRunId(data.id);
      setPersistenceStatus('saved');
      setPersistenceMessage('Run sauvegarde en base et en local.');
    } catch (error) {
      setPersistenceStatus('local');
      setPersistenceMessage(error instanceof Error ? error.message : 'Sauvegarde locale uniquement.');
    }
  }, [buildSnapshot, runId, saveLocalSnapshot]);

  const loadRunHistory = useCallback(async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess?.session?.user?.id;
      if (!userId) return;
      const { data, error } = await supabase
        .from('isna_pipeline_runs')
        .select('id, updated_at, phase1_status, phase2_status, video_url')
        .eq('created_by', userId)
        .order('updated_at', { ascending: false })
        .limit(5);
      if (error) {
        if (isMissingTableError(error)) return;
        throw error;
      }
      setHistoryRows(Array.isArray(data) ? data : []);
    } catch {
      // no-op
    }
  }, []);

  const handleStartNewRun = useCallback(() => {
    setRunId(null);
    setVideoUrl('');
    setCourseBrief('');
    setNiveau('intermediaire');
    setContexte('ISNA');
    setProfilPedagogique('auto');
    setPhase1State(emptyPhase1);
    setPhase2State(emptyPhase2);
    setPersistenceStatus('pending');
    setPersistenceMessage('Nouveau run initialise.');
    try {
      localStorage.removeItem(LOCAL_RUN_KEY);
    } catch {
      // no-op
    }
  }, []);

  const handleRestoreRun = useCallback(async (targetRunId) => {
    if (!targetRunId) return;
    setPersistenceStatus('running');
    setPersistenceMessage('Restauration du run...');
    try {
      const { data, error } = await supabase
        .from('isna_pipeline_runs')
        .select('id, snapshot_json, updated_at')
        .eq('id', targetRunId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.snapshot_json) throw new Error('Snapshot introuvable pour ce run.');
      hydrateFromSnapshot(data.snapshot_json);
      setRunId(data.id);
      saveLocalSnapshot(data.snapshot_json);
      setPersistenceStatus('saved');
      setPersistenceMessage(`Run restaure (${new Date(data.updated_at).toLocaleString()}).`);
    } catch (error) {
      setPersistenceStatus('error');
      setPersistenceMessage(error instanceof Error ? error.message : 'Echec restauration run.');
    }
  }, [hydrateFromSnapshot, saveLocalSnapshot]);

  const handleDeleteRun = useCallback(async (targetRunId) => {
    if (!targetRunId) return;
    try {
      const { error } = await supabase.from('isna_pipeline_runs').delete().eq('id', targetRunId);
      if (error && !isMissingTableError(error)) throw error;
      if (runId === targetRunId) {
        handleStartNewRun();
      }
      await loadRunHistory();
      setPersistenceStatus('saved');
      setPersistenceMessage('Run supprime.');
    } catch (error) {
      setPersistenceStatus('error');
      setPersistenceMessage(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  }, [handleStartNewRun, loadRunHistory, runId]);

  const handleContinuePhase3 = useCallback(() => {
    const handoff = {
      videoUrl,
      transcript: Array.isArray(phase1State.transcript) ? phase1State.transcript : [],
      courseJson: phase2State.courseJson || null,
      meta: phase2State.meta || null,
      savedAt: new Date().toISOString(),
      source: 'studio-constructeur-isna',
      runId,
    };
    try {
      localStorage.setItem(PHASE3_HANDOFF_KEY, JSON.stringify(handoff));
    } catch {
      // no-op
    }
    navigate('/studio/smartboard-designer');
  }, [navigate, phase1State.transcript, phase2State.courseJson, phase2State.meta, runId, videoUrl]);

  useEffect(() => {
    let mounted = true;
    const loadInitialRun = async () => {
      try {
        const localRaw = localStorage.getItem(LOCAL_RUN_KEY);
        if (localRaw && mounted) {
          const localSnapshot = JSON.parse(localRaw);
          hydrateFromSnapshot(localSnapshot);
          setPersistenceStatus('local');
          setPersistenceMessage('Run local restaure.');
        }
      } catch {
        // no-op
      }

      try {
        const { data: sess } = await supabase.auth.getSession();
        const userId = sess?.session?.user?.id;
        if (!userId) return;
        const { data, error } = await supabase
          .from('isna_pipeline_runs')
          .select('id, snapshot_json')
          .eq('created_by', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          if (isMissingTableError(error)) return;
          throw error;
        }
        if (mounted && data?.snapshot_json) {
          hydrateFromSnapshot(data.snapshot_json);
          setRunId(data.id || null);
          setPersistenceStatus('saved');
          setPersistenceMessage('Dernier run DB restaure.');
        }
      } catch {
        // no-op
      }
      await loadRunHistory();
    };
    loadInitialRun();
    return () => {
      mounted = false;
    };
  }, [hydrateFromSnapshot, loadRunHistory]);

  useEffect(() => {
    const targetRunId = String(searchParams.get('runId') || '').trim();
    if (!targetRunId) return;
    void handleRestoreRun(targetRunId).finally(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('runId');
        return next;
      }, { replace: true });
    });
  }, [handleRestoreRun, searchParams, setSearchParams]);

  const phaseStatusBadge = (status) => {
    if (status === 'running') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/40 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </span>
      );
    }
    if (status === 'success') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
          <CheckCircle2 className="h-3 w-3" />
          Success
        </span>
      );
    }
    if (status === 'error') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-200">
          <AlertTriangle className="h-3 w-3" />
          Error
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full border border-white/20 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-white/60">
        Pending
      </span>
    );
  };

  const handleRunPhase1 = async () => {
    if (!videoUrl.trim()) {
      setPhase1State((prev) => ({ ...prev, status: 'error', message: 'Ajoute une URL video avant de lancer la phase 1.' }));
      return;
    }
    setPhase1State((prev) => ({ ...prev, status: 'running', message: 'Transcription en cours...' }));
    try {
      const body = await invokeSupabaseFunction(supabase, 'generate-transcript', {
        body: { url: videoUrl.trim(), language: 'fr' },
      });
      const transcript = Array.isArray(body?.transcript) ? body.transcript : [];
      if (transcript.length === 0) throw new Error('Transcription vide');
      setPhase1State({
        status: 'success',
        message: `${transcript.length} lignes transcrites.`,
        transcript,
      });
      await saveRun();
    } catch (error) {
      setPhase1State({
        status: 'error',
        message: error instanceof Error ? error.message : 'Erreur inconnue phase 1',
        transcript: [],
      });
    }
  };

  const handleRunPhase2 = async () => {
    const fallbackSujet = phase1State.transcript.map((line) => line.text).join(' ').slice(0, 6000).trim();
    const sujet = courseBrief.trim() || fallbackSujet;
    if (!sujet) {
      setPhase2State((prev) => ({ ...prev, status: 'error', message: 'Ajoute un brief ou lance la phase 1 pour alimenter le sujet.' }));
      return;
    }
    setPhase2State((prev) => ({ ...prev, status: 'running', message: 'Structuration pedagogique IA en cours...' }));
    try {
      const body = await invokeSupabaseFunction(supabase, 'liri-agent-course-generate', {
        body: {
          sujet,
          niveau,
          contexte,
          profil_pedagogique: profilPedagogique,
        },
      });
      const etapes = Array.isArray(body?.cours?.etapes) ? body.cours.etapes : [];
      if (etapes.length === 0) throw new Error('Reponse IA invalide (etapes manquantes).');
      setPhase2State({
        status: 'success',
        message: `Plan pedagogique genere avec ${etapes.length} etapes.`,
        courseJson: body?.cours || null,
        meta: body?.meta || null,
      });
      await saveRun();
      await loadRunHistory();
    } catch (error) {
      setPhase2State({
        status: 'error',
        message: error instanceof Error ? error.message : 'Erreur inconnue phase 2',
        courseJson: null,
        meta: null,
      });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#070b14] text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-5">
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
            ISNA Course Constructor
          </span>
          <span className="ml-auto rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-white/50">
            {runId ? `Run ${String(runId).slice(0, 8)}...` : 'Nouveau run'}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-white/10 bg-[#0c1324] p-3">
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              <GraduationCap className="h-3.5 w-3.5 text-[var(--school-accent)]" />
              Pipeline
            </p>
            <div className="space-y-2">
              {PHASES.map((phase) => {
                const Icon = phase.icon;
                const status = phase.id === 'p1' ? phase1State.status : phase.id === 'p2' ? phase2State.status : 'idle';
                return (
                  <Link
                    key={phase.id}
                    to={phase.href}
                    className="block rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-cyan-400/30 hover:bg-cyan-500/[0.06]"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-200">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {phaseStatusBadge(status)}
                    </div>
                    <p className="text-[12px] font-semibold text-white/90">{phase.title}</p>
                    <p className="mt-0.5 text-[11px] text-white/45">{phase.description}</p>
                  </Link>
                );
              })}
            </div>
          </aside>

          <section className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#0c1324] p-4">
              <h1 className="text-[22px] font-bold text-white">Control Room - Video vers cours</h1>
              <p className="mt-1 text-[12px] text-white/55">
                Interface logicielle: ingestion, structuration pedagogique, puis handoff direct vers le Designer.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveRun}
                  className="rounded-lg border border-white/20 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white/85 transition hover:bg-white/[0.1]"
                >
                  Sauvegarder
                </button>
                <button
                  type="button"
                  onClick={handleStartNewRun}
                  className="rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-200 transition hover:bg-red-500/20"
                >
                  Nouveau run
                </button>
                <Link
                  to="/studio/liri/constructeurs"
                  className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-200 transition hover:bg-violet-500/20"
                >
                  Hub cours global
                </Link>
                <Link
                  to="/studio/formation-llm-builder"
                  className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                >
                  Formation LLM Builder
                </Link>
              </div>
              {persistenceMessage ? (
                <p className="mt-2 text-[11px] text-white/55">Persistance ({persistenceStatus}): {persistenceMessage}</p>
              ) : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/[0.07] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-fuchsia-100">Phase 1 - Ingestion video</h2>
                  {phaseStatusBadge(phase1State.status)}
                </div>
                <label className="mb-1 block text-[11px] text-white/55">URL video source</label>
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-white/15 bg-[#080c16] px-3 py-2 text-[12px] text-white outline-none focus:border-fuchsia-400/40"
                />
                <button
                  type="button"
                  onClick={handleRunPhase1}
                  disabled={phase1State.status === 'running'}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-fuchsia-500/80 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
                >
                  {phase1State.status === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                  Lancer ingestion
                </button>
                {phase1State.message ? <p className="mt-2 text-[11px] text-white/75">{phase1State.message}</p> : null}
                {transcriptPreview ? (
                  <pre className="mt-2 max-h-44 overflow-auto rounded-xl border border-white/10 bg-[#050812] p-3 text-[11px] text-white/70 whitespace-pre-wrap">{transcriptPreview}</pre>
                ) : null}
              </article>

              <article className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.07] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-cyan-100">Phase 2 - Structuration pedagogique</h2>
                  {phaseStatusBadge(phase2State.status)}
                </div>
                <label className="mb-1 block text-[11px] text-white/55">Brief pedagogique</label>
                <textarea
                  value={courseBrief}
                  onChange={(e) => setCourseBrief(e.target.value)}
                  rows={4}
                  placeholder="Objectifs, audience, niveau, contraintes..."
                  className="w-full resize-none rounded-lg border border-white/15 bg-[#080c16] px-3 py-2 text-[12px] text-white outline-none focus:border-cyan-400/40"
                />
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <input
                    value={niveau}
                    onChange={(e) => setNiveau(e.target.value)}
                    placeholder="niveau"
                    className="rounded-lg border border-white/15 bg-[#080c16] px-3 py-2 text-[11px] text-white outline-none focus:border-cyan-400/40"
                  />
                  <input
                    value={contexte}
                    onChange={(e) => setContexte(e.target.value)}
                    placeholder="contexte"
                    className="rounded-lg border border-white/15 bg-[#080c16] px-3 py-2 text-[11px] text-white outline-none focus:border-cyan-400/40"
                  />
                  <select
                    value={profilPedagogique}
                    onChange={(e) => setProfilPedagogique(e.target.value)}
                    className="rounded-lg border border-white/15 bg-[#080c16] px-3 py-2 text-[11px] text-white outline-none focus:border-cyan-400/40"
                  >
                    <option value="auto">auto</option>
                    <option value="maitre_pedagogue">maitre_pedagogue</option>
                    <option value="architecte">architecte</option>
                    <option value="cours_rapide">cours_rapide</option>
                    <option value="assistant_eco">assistant_eco</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleRunPhase2}
                  disabled={phase2State.status === 'running'}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-cyan-500/80 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                >
                  {phase2State.status === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  Generer le cours
                </button>
                {phase2State.message ? <p className="mt-2 text-[11px] text-white/75">{phase2State.message}</p> : null}
                {phase2State.courseJson ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link to="/studio/liri/cours" className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] text-cyan-200 transition hover:bg-cyan-500/20">
                      Ouvrir Course Builder
                    </Link>
                    <button
                      type="button"
                      onClick={handleContinuePhase3}
                      className="rounded-md border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-1.5 text-[11px] text-fuchsia-200 transition hover:bg-fuchsia-500/20"
                    >
                      Envoyer au Designer
                    </button>
                  </div>
                ) : null}
              </article>
            </div>

            {historyRows.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#0c1324] p-4">
                <h3 className="text-[13px] font-semibold text-white/90">Historique des runs</h3>
                <div className="mt-2 space-y-2">
                  {historyRows.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70">
                      <span>{new Date(row.updated_at).toLocaleString()}</span>
                      <span>P1: {row.phase1_status || '-'}</span>
                      <span>P2: {row.phase2_status || '-'}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleRestoreRun(row.id)}
                          className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200 transition hover:bg-cyan-500/20"
                        >
                          Restaurer
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRun(row.id)}
                          className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-200 transition hover:bg-red-500/20"
                        >
                          Supprimer
                        </button>
                      </div>
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
