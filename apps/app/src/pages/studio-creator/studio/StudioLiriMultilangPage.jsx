/**
 * StudioLiriMultilangPage — Multilingue live + vidéo (pack liri_complete_multilang_system intégré).
 * Route : /studio/liri/multilang
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Languages, Radio, Film, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import StudioDesignerLikeShell from '@/components/liri/liri-ecosystem/StudioDesignerLikeShell';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import {
  listLiveSessions,
  listVideoProjects,
  startLiveSessionEdge,
  createVideoProjectEdge,
  parseLangList,
  estimateLiveCredits,
  estimateVideoCredits,
  upsertVideoTranslations,
  fetchVideoTranslations,
} from '@/lib/liriMultilangApi';
import { synthesizeMultilangTtsOnce } from '@/lib/liriMultilangTtsEdge';
import { downloadSubtitleFile } from '@/lib/generateSrtFromLines';

const inputCls =
  'w-full rounded-lg border border-white/12 bg-black/30 px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30';

export default function StudioLiriMultilangPage() {
  const { user, loading: authLoading } = useAuth();
  const [liveRows, setLiveRows] = useState([]);
  const [videoRows, setVideoRows] = useState([]);
  const [loadErr, setLoadErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState(null);

  const [liveRoom, setLiveRoom] = useState('');
  const [liveSource, setLiveSource] = useState('fr');
  const [liveTargets, setLiveTargets] = useState('en, es');
  const [liveMinutes, setLiveMinutes] = useState(60);
  const [liveParticipants, setLiveParticipants] = useState(1);

  const [videoTitle, setVideoTitle] = useState('');
  const [videoSource, setVideoSource] = useState('fr');
  const [videoTargets, setVideoTargets] = useState('en, pt');
  const [videoDuration, setVideoDuration] = useState(10);

  const [selectedVideoProjectId, setSelectedVideoProjectId] = useState('');
  const [videoTranscriptBody, setVideoTranscriptBody] = useState('');
  const [videoTranslateMsg, setVideoTranslateMsg] = useState(null);
  const [videoTtsExportLang, setVideoTtsExportLang] = useState('en');
  const [srtTranslations, setSrtTranslations] = useState([]);
  const [srtBusy, setSrtBusy] = useState(false);
  const [srtErr, setSrtErr] = useState(null);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoadErr(null);
    const [l, v] = await Promise.all([listLiveSessions(supabase), listVideoProjects(supabase)]);
    if (l.error) setLoadErr(l.error.message || 'Sessions live');
    else setLiveRows(l.data || []);
    if (v.error) setLoadErr(v.error.message || 'Projets vidéo');
    else setVideoRows(v.data || []);
  }, [user]);

  useEffect(() => {
    if (user) void loadAll();
  }, [user, loadAll]);

  useEffect(() => {
    if (!selectedVideoProjectId && videoRows.length > 0) {
      setSelectedVideoProjectId(String(videoRows[0].id));
    }
  }, [videoRows, selectedVideoProjectId]);

  const onTranslateVideoTranscript = async (e) => {
    e.preventDefault();
    setFormErr(null);
    setVideoTranslateMsg(null);
    const proj = videoRows.find((r) => String(r.id) === String(selectedVideoProjectId));
    if (!proj) {
      setFormErr('Sélectionnez un projet vidéo.');
      return;
    }
    const rawLines = String(videoTranscriptBody || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!rawLines.length) {
      setFormErr('Collez au moins une ligne de transcript.');
      return;
    }
    const targets = Array.isArray(proj.target_langs) && proj.target_langs.length
      ? proj.target_langs.map((x) => String(x).toLowerCase().slice(0, 12)).filter(Boolean)
      : ['en'];
    setBusy(true);
    try {
      for (const targetLang of targets) {
        const merged = [];
        for (let i = 0; i < rawLines.length; i += 400) {
          const batch = rawLines.slice(i, i + 400).map((text) => ({ text }));
          const { data, error } = await supabase.functions.invoke('translate-transcript', {
            body: { transcript: batch, targetLang },
          });
          if (error) throw new Error(error.message || 'translate-transcript');
          if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'translate-transcript');
          const lines = Array.isArray(data?.transcript) ? data.transcript : [];
          merged.push(...lines);
        }
        const { error: upErr } = await upsertVideoTranslations(supabase, proj.id, targetLang, merged);
        if (upErr) throw new Error(upErr.message || 'Sauvegarde traduction');
      }
      setVideoTranslateMsg(`Enregistré : ${targets.length} langue(s), ${rawLines.length} segment(s).`);
    } catch (err) {
      setFormErr(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const onDownloadTtsExportSample = async () => {
    setFormErr(null);
    setVideoTranslateMsg(null);
    const first = String(videoTranscriptBody || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)[0];
    if (!first) {
      setFormErr('Collez au moins une ligne dans le transcript pour générer un extrait audio.');
      return;
    }
    const lang = String(videoTtsExportLang || 'en')
      .trim()
      .toLowerCase()
      .slice(0, 12);
    setBusy(true);
    try {
      const { data, error } = await synthesizeMultilangTtsOnce(supabase, {
        text: first.slice(0, 4500),
        languageCode: lang,
        tier: 'export',
      });
      if (error) throw error;
      if (!data?.audioBase64) throw new Error('Réponse TTS vide');
      const bin = atob(String(data.audioBase64));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liri-tts-multilingual-${lang}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
      setVideoTranslateMsg(
        `Audio export (ElevenLabs Multilingual v2 → fallback Google si besoin) : ${data.provider || '?'}`,
      );
    } catch (err) {
      setFormErr(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const onLoadSrtTranslations = async () => {
    setSrtErr(null);
    setSrtTranslations([]);
    if (!selectedVideoProjectId) { setSrtErr('Sélectionnez un projet.'); return; }
    setSrtBusy(true);
    const { data, error } = await fetchVideoTranslations(supabase, selectedVideoProjectId);
    setSrtBusy(false);
    if (error) { setSrtErr(error.message || 'Erreur chargement'); return; }
    setSrtTranslations(Array.isArray(data) ? data : []);
    if (!data?.length) setSrtErr('Aucune traduction enregistrée pour ce projet. Traduisez d\'abord le transcript.');
  };

  const onStartLive = async (e) => {
    e.preventDefault();
    setFormErr(null);
    setBusy(true);
    const target_langs = parseLangList(liveTargets);
    const langs = target_langs.length ? target_langs : ['en'];
    const body = {
      room_label: liveRoom.trim() || undefined,
      source_lang: liveSource.trim() || 'fr',
      target_langs: langs,
      estimated_minutes: liveMinutes,
      participant_hint: liveParticipants,
    };
    const { data, error } = await startLiveSessionEdge(supabase, body);
    const edgeFailed = error || (data && typeof data === 'object' && 'error' in data && data.error);
    if (edgeFailed) {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setBusy(false);
        setFormErr(error?.message || (typeof data?.error === 'string' ? data.error : 'Session requise'));
        return;
      }
      const credits = estimateLiveCredits({
        targetLangs: langs,
        estimatedMinutes: liveMinutes,
        participants: liveParticipants,
      });
      const { error: insErr } = await supabase.from('liri_multilang_live_sessions').insert({
        user_id: u.user.id,
        room_label: liveRoom.trim() || null,
        source_lang: (liveSource.trim() || 'fr').slice(0, 12),
        target_langs: langs,
        status: 'active',
        credits_estimate: credits,
        metadata: {},
      });
      setBusy(false);
      if (insErr) {
        setFormErr(insErr.message || 'Insertion session impossible (migration + Edge à déployer)');
        return;
      }
      await loadAll();
      return;
    }
    setBusy(false);
    await loadAll();
  };

  const onCreateVideo = async (e) => {
    e.preventDefault();
    setFormErr(null);
    setBusy(true);
    const target_langs = parseLangList(videoTargets);
    const langs = target_langs.length ? target_langs : ['en'];
    const body = {
      title: videoTitle.trim() || undefined,
      source_lang: videoSource.trim() || 'fr',
      target_langs: langs,
      duration_minutes: videoDuration,
    };
    const { data, error } = await createVideoProjectEdge(supabase, body);
    const edgeFailed = error || (data && typeof data === 'object' && 'error' in data && data.error);
    if (edgeFailed) {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setBusy(false);
        setFormErr(error?.message || (typeof data?.error === 'string' ? data.error : 'Session requise'));
        return;
      }
      const credits = estimateVideoCredits({ targetLangs: langs, durationMinutes: videoDuration });
      const title = videoTitle.trim() || 'Projet vidéo multilingue';
      const { error: insErr } = await supabase.from('liri_multilang_video_projects').insert({
        user_id: u.user.id,
        title,
        source_lang: (videoSource.trim() || 'fr').slice(0, 12),
        target_langs: langs,
        status: 'draft',
        credits_estimate: credits,
        metadata: {},
      });
      setBusy(false);
      if (insErr) {
        setFormErr(insErr.message || 'Insertion projet impossible (migration requise)');
        return;
      }
      await loadAll();
      return;
    }
    setBusy(false);
    await loadAll();
  };

  const livePreview = estimateLiveCredits({
    targetLangs: parseLangList(liveTargets).length ? parseLangList(liveTargets) : ['en'],
    estimatedMinutes: liveMinutes,
    participants: liveParticipants,
  });
  const videoPreview = estimateVideoCredits({
    targetLangs: parseLangList(videoTargets).length ? parseLangList(videoTargets) : ['en'],
    durationMinutes: videoDuration,
  });

  return (
    <StudioDesignerLikeShell
      railActiveKey="multilang"
      pageLabel="Multilingue"
      pageAccent="emerald"
      TitleIcon={Languages}
      titleLine="Live translate · Vidéo multilingue"
      breadcrumbMiddle={[{ label: 'LIRI', href: '/studio/liri' }]}
      footer={
        <footer className="flex h-14 flex-shrink-0 items-center gap-3 border-t border-white/[0.07] px-3" style={{ background: '#1f1e1c' }}>
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-400/80" />
          <p className="truncate text-[11px] text-white/38">
            <span className="text-white/55">Pack liri_complete_multilang_system</span>
            {' '}
            — tables + Edge <code className="rounded bg-white/[0.06] px-1 text-[10px]">liri-multilang-live</code>
            {' / '}
            <code className="rounded bg-white/[0.06] px-1 text-[10px]">liri-multilang-video</code>
            . Déployez les fonctions Supabase après <code className="rounded bg-white/[0.06] px-1 text-[10px]">db push</code>.
          </p>
          <Link
            to="/studio/liri"
            className="ml-auto hidden shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-300/90 sm:flex"
          >
            Hub <ArrowRight className="h-3 w-3" />
          </Link>
        </footer>
      }
    >
      <div className="mx-auto max-w-5xl px-4 py-8 pb-16">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-xl font-semibold text-white/90 sm:text-2xl">Multilingue LIRI</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/45">
            Traduction live (sessions) et projets vidéo multilingues. Les créations passent par les fonctions Edge ;
            les listes sont lues directement en base (RLS).
          </p>
        </motion.div>

        {authLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-white/20" />
          </div>
        ) : !user ? (
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100/90">
            Connectez-vous pour enregistrer des sessions et des projets.
          </p>
        ) : (
          <>
            {loadErr ? <p className="mb-4 text-[12px] text-red-300/90">{loadErr}</p> : null}
            {formErr ? <p className="mb-4 text-[12px] text-red-300/90">{formErr}</p> : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <motion.form
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                onSubmit={onStartLive}
                className="rounded-2xl border border-emerald-500/20 bg-[#1f1e1c]/90 p-5 shadow-[0_0_40px_rgba(207,128,89,0.06)]"
              >
                <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-emerald-300/95">
                  <Radio className="h-4 w-4" />
                  Live translate
                </div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Salle / libellé</label>
                <input className={cn(inputCls, 'mb-3')} value={liveRoom} onChange={(e) => setLiveRoom(e.target.value)} placeholder="Live formation Q2" />
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Langue source</label>
                <input className={cn(inputCls, 'mb-3')} value={liveSource} onChange={(e) => setLiveSource(e.target.value)} />
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Langues cibles (virgules)</label>
                <input className={cn(inputCls, 'mb-3')} value={liveTargets} onChange={(e) => setLiveTargets(e.target.value)} />
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Durée (min)</label>
                    <input type="number" min={1} max={480} className={inputCls} value={liveMinutes} onChange={(e) => setLiveMinutes(+e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Participants (est.)</label>
                    <input type="number" min={1} max={500} className={inputCls} value={liveParticipants} onChange={(e) => setLiveParticipants(+e.target.value)} />
                  </div>
                </div>
                <p className="mb-3 text-[11px] text-white/35">Estimation crédits (indicative) : {livePreview}</p>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Démarrer la session
                </button>
              </motion.form>

              <motion.form
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onSubmit={onCreateVideo}
                className="rounded-2xl border border-cyan-500/20 bg-[#1f1e1c]/90 p-5 shadow-[0_0_40px_rgba(227,170,107,0.06)]"
              >
                <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-cyan-300/95">
                  <Film className="h-4 w-4" />
                  Vidéo multilingue
                </div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Titre du projet</label>
                <input className={cn(inputCls, 'mb-3')} value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="Module 3 — exports" />
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Langue source</label>
                <input className={cn(inputCls, 'mb-3')} value={videoSource} onChange={(e) => setVideoSource(e.target.value)} />
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Langues cibles</label>
                <input className={cn(inputCls, 'mb-3')} value={videoTargets} onChange={(e) => setVideoTargets(e.target.value)} />
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Durée vidéo (min)</label>
                <input type="number" min={1} max={600} className={cn(inputCls, 'mb-3')} value={videoDuration} onChange={(e) => setVideoDuration(+e.target.value)} />
                <p className="mb-3 text-[11px] text-white/35">Estimation crédits (indicative) : {videoPreview}</p>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2.5 text-[13px] font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Créer le projet
                </button>
              </motion.form>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="mt-8 rounded-2xl border border-cyan-500/15 bg-[#1f1e1c]/90 p-5 shadow-[0_0_32px_rgba(227,170,107,0.05)]"
            >
              <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-cyan-300/95">
                <Film className="h-4 w-4" />
                Transcript vidéo → traductions (base)
              </div>
              <p className="mb-4 text-[11px] leading-relaxed text-white/38">
                Une ligne = un segment. Les langues cibles viennent du projet. Les résultats sont stockés dans{' '}
                <code className="rounded bg-white/[0.06] px-1 text-[10px]">liri_multilang_video_translations</code>
                {' '}(secret <code className="rounded bg-white/[0.06] px-1 text-[10px]">DEEPSEEK_API_KEY</code> requis).
              </p>
              <form onSubmit={onTranslateVideoTranscript} className="space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Projet</label>
                  <select
                    className={inputCls}
                    value={selectedVideoProjectId}
                    onChange={(e) => setSelectedVideoProjectId(e.target.value)}
                  >
                    {videoRows.length === 0 ? <option value="">Aucun projet</option> : null}
                    {videoRows.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title || r.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Transcript source</label>
                  <textarea
                    className={cn(inputCls, 'min-h-[160px] resize-y font-mono text-[12px]')}
                    value={videoTranscriptBody}
                    onChange={(e) => setVideoTranscriptBody(e.target.value)}
                    placeholder={'Ligne 1…\nLigne 2…'}
                  />
                </div>
                {videoTranslateMsg ? (
                  <p className="text-[12px] text-emerald-300/85">{videoTranslateMsg}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={busy || !videoRows.length}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 py-2.5 text-[13px] font-semibold text-white hover:bg-cyan-600 disabled:opacity-40 sm:w-auto sm:px-8"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Traduire et enregistrer
                </button>
                <div className="flex flex-col gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="min-w-[120px] flex-1">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
                      Code langue TTS export
                    </label>
                    <input
                      className={inputCls}
                      value={videoTtsExportLang}
                      onChange={(e) => setVideoTtsExportLang(e.target.value)}
                      placeholder="en"
                      maxLength={12}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy || !user}
                    onClick={() => void onDownloadTtsExportSample()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/35 bg-violet-500/15 py-2.5 text-[13px] font-semibold text-violet-200/95 hover:bg-violet-500/25 disabled:opacity-40 sm:w-auto sm:px-6"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Télécharger MP3 (1ʳᵉ ligne · Multilingual)
                  </button>
                </div>
                <p className="text-[10px] leading-relaxed text-white/30">
                  Edge <code className="rounded bg-white/[0.06] px-1">liri-tts</code> tier <code className="rounded bg-white/[0.06] px-1">export</code> : ElevenLabs Multilingual v2, puis Google Cloud TTS si échec. Secrets :{' '}
                  <code className="rounded bg-white/[0.06] px-1">ELEVENLABS_API_KEY</code>,{' '}
                  <code className="rounded bg-white/[0.06] px-1">GOOGLE_CLOUD_TTS_API_KEY</code>.
                </p>
              </form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="mt-8 rounded-2xl border border-violet-500/15 bg-[#1f1e1c]/90 p-5 shadow-[0_0_32px_rgba(217,119,87,0.05)]"
            >
              <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-violet-300/95">
                <Sparkles className="h-4 w-4" />
                Export sous-titres (SRT / VTT)
              </div>
              <p className="mb-4 text-[11px] leading-relaxed text-white/38">
                Télécharge un fichier de sous-titres par langue à partir des traductions enregistrées.
                Les horodatages sont distribués équitablement sur la durée du projet.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[160px]">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Projet</label>
                  <select
                    className={inputCls}
                    value={selectedVideoProjectId}
                    onChange={(e) => { setSelectedVideoProjectId(e.target.value); setSrtTranslations([]); setSrtErr(null); }}
                  >
                    {videoRows.length === 0 ? <option value="">Aucun projet</option> : null}
                    {videoRows.map((r) => (
                      <option key={r.id} value={r.id}>{r.title || r.id}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={srtBusy || !selectedVideoProjectId}
                  onClick={() => void onLoadSrtTranslations()}
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-500/35 bg-violet-500/15 px-4 py-2.5 text-[13px] font-semibold text-violet-200/95 hover:bg-violet-500/25 disabled:opacity-40"
                >
                  {srtBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Charger les traductions
                </button>
              </div>
              {srtErr ? <p className="mt-3 text-[12px] text-red-300/80">{srtErr}</p> : null}
              {srtTranslations.length > 0 ? (() => {
                const proj = videoRows.find((r) => String(r.id) === String(selectedVideoProjectId));
                const langCount = Math.max(1, (proj?.target_langs || []).length);
                const durationMin = proj
                  ? Math.round((proj.credits_estimate || 80) / (langCount * 8))
                  : 10;
                return (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {srtTranslations.map(({ target_lang, lines }) => (
                      <div key={target_lang} className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => downloadSubtitleFile(lines, durationMin, target_lang, 'srt')}
                          className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] font-semibold text-white/80 hover:bg-white/[0.1]"
                        >
                          {String(target_lang).toUpperCase()} · SRT
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadSubtitleFile(lines, durationMin, target_lang, 'vtt')}
                          className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] font-semibold text-white/80 hover:bg-white/[0.1]"
                        >
                          VTT
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })() : null}
            </motion.div>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-white/40">Sessions live récentes</h3>
                <ul className="space-y-2 text-[12px] text-white/65">
                  {liveRows.length === 0 ? <li className="text-white/35">Aucune session.</li> : null}
                  {liveRows.map((r) => (
                    <li key={r.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                      <span className="text-white/80">{r.room_label || 'Sans titre'}</span>
                      <span className="text-white/35"> · {r.status}</span>
                      <span className="block text-[11px] text-white/35">
                        {(r.target_langs || []).join(', ') || '—'} — {r.credits_estimate} cr.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-white/40">Projets vidéo</h3>
                <ul className="space-y-2 text-[12px] text-white/65">
                  {videoRows.length === 0 ? <li className="text-white/35">Aucun projet.</li> : null}
                  {videoRows.map((r) => (
                    <li key={r.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                      <span className="text-white/80">{r.title}</span>
                      <span className="text-white/35"> · {r.status}</span>
                      <span className="block text-[11px] text-white/35">
                        {(r.target_langs || []).join(', ') || '—'} — {r.credits_estimate} cr.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </StudioDesignerLikeShell>
  );
}
