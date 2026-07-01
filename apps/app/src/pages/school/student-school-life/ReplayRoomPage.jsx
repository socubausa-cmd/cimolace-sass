import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import UnifiedVideoPlayer from '@/components/lesson-player/unified/UnifiedVideoPlayer';
import { fromReplay } from '@/components/lesson-player/unified/fromReplay';

/**
 * Salle de replay « mode révision » : lit une session + son état recall via la RPC
 * get_replay_room, puis monte le UnifiedVideoPlayer (fromReplay) → mêmes
 * fonctionnalités que le player de cours (vidéo + chapitres + transcript + mindmap
 * + notes + questions), avec vignette (poster). Directive artistique LIRI (chaud).
 *
 * Barre encadrant (can_manage) : « Envoyer en post-production » (transcription +
 * chapitres via worker) et « Publier au forum » Public/Privé (Lot 3).
 */
const COL = {
  coral: '#d97757',
  cream: '#f5f1e9',
  t3: 'rgba(245,241,233,0.5)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

const WORKFLOW_LABEL = {
  processing: '⏳ Traitement en cours…',
  published: '✓ Enrichi (transcription + chapitres)',
  error: '⚠️ Échec du traitement',
};

export default function ReplayRoomPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backBase = location.pathname.split('/replay/')[0] || '';

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [proc, setProc] = useState('');
  const [vis, setVis] = useState('context');     // visibilité forum courante
  const [visBusy, setVisBusy] = useState(false);
  const [visMsg, setVisMsg] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    setLoading(true);
    supabase.rpc('get_replay_room', { p_session_id: sessionId }).then(({ data }) => {
      if (!alive) return;
      setRoom(data || null);
      setVis(data?.forum?.visibility || 'context');
      setLoading(false);
    });
    return () => { alive = false; };
  }, [sessionId]);

  const session = room?.session;
  const canManage = Boolean(room?.can_manage);
  const workflowStatus = room?.state?.workflow_status || null;
  const data = session
    ? fromReplay({
        session,
        state: room?.state || null,
        posterUrl: room?.state?.replay_poster_url || session?.cover_image_url,
        mindmapRoot: null,
      })
    : null;

  const handleAsk = async ({ question, clipStart, clipEnd, isPublic }) => {
    await supabase.rpc('post_topic_question', {
      p_context_type: 'live',
      p_context_id: sessionId,
      p_question: question,
      p_clip_start: clipStart,
      p_clip_end: clipEnd,
      p_is_public: isPublic,
    });
  };

  // Envoie le replay en post-production : marque l'état 'processing' → le worker
  // (pollReplayPostprod) extrait l'audio, transcrit (Whisper) et génère les
  // chapitres, puis écrit chapitres + transcript (status 'published'). Réservé
  // encadrant. Async : le traitement tourne côté worker (gros fichiers OK).
  const runPostProd = async () => {
    setProc('Envoi en post-production…');
    try {
      const { error } = await supabase.rpc('request_replay_postprod', { p_session_id: sessionId });
      if (error) throw error;
      setProc('✓ Post-production lancée — transcription + chapitres se génèrent en arrière-plan (worker). Recharge la page dans quelques minutes pour voir le résultat.');
    } catch (e) {
      setProc('Échec : ' + (e?.message || e));
    }
  };

  // Lot 3 — publie le Sujet forum du live en public (communautaire) ou privé
  // (participants). Réservé encadrant (garde côté RPC).
  const publish = async (target) => {
    if (visBusy || target === vis) return;
    setVisBusy(true);
    setVisMsg('');
    try {
      const { error } = await supabase.rpc('set_replay_forum_visibility', { p_session_id: sessionId, p_visibility: target });
      if (error) throw error;
      setVis(target);
      setVisMsg(target === 'public' ? '✓ Publié au forum communautaire' : '✓ Restreint aux participants');
    } catch (e) {
      setVisMsg('Échec : ' + (e?.message || e));
    } finally {
      setVisBusy(false);
    }
  };

  const processing = proc === 'Envoi en post-production…';
  const isPublic = vis === 'public' || vis === 'context';

  const segBtn = (active) => ({
    padding: '6px 14px', borderRadius: 8, cursor: visBusy ? 'wait' : 'pointer',
    fontSize: 12.5, fontWeight: 600, transition: 'background 160ms, color 160ms, border-color 160ms',
    background: active ? COL.coral : 'transparent',
    color: active ? '#1c1a17' : COL.cream,
    border: `1px solid ${active ? COL.coral : 'rgba(245,241,233,0.22)'}`,
  });

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '4px 0 40px' }}>
      {/* En-tête : retour + titre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingTop: 4 }}>
        <button
          onClick={() => navigate(backBase || '..')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '7px 13px', borderRadius: 9, cursor: 'pointer',
            background: 'rgba(217,119,87,0.10)', border: '1px solid rgba(217,119,87,0.28)',
            color: COL.coral, fontSize: 12.5, fontWeight: 600,
          }}
        >← Retour</button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: COL.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: COL.coral, textTransform: 'uppercase', marginBottom: 3 }}>
            Replay · Salle de révision
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: COL.cream, margin: 0, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session?.title || 'Replay'}
          </h1>
        </div>
      </div>

      {/* Barre encadrant : post-production + publication forum (réservé encadrant) */}
      {canManage ? (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
          marginBottom: 14, padding: '10px 12px', borderRadius: 12,
          background: 'rgba(217,119,87,0.06)', border: '1px solid rgba(217,119,87,0.18)',
        }}>
          <button
            onClick={runPostProd}
            disabled={processing}
            title="Générer transcription + chapitres depuis le replay (worker)"
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 9, cursor: processing ? 'wait' : 'pointer',
              background: 'rgba(217,119,87,0.14)', border: '1px solid rgba(217,119,87,0.34)',
              color: COL.coral, fontSize: 12.5, fontWeight: 600,
            }}
          >
            ⚙️ Envoyer en post-production
          </button>
          {workflowStatus && WORKFLOW_LABEL[workflowStatus] ? (
            <span style={{ fontSize: 11.5, fontFamily: COL.mono, color: workflowStatus === 'error' ? '#f0a58a' : COL.t3 }}>
              {WORKFLOW_LABEL[workflowStatus]}
            </span>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span style={{ fontSize: 10.5, fontFamily: COL.mono, color: COL.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Publier au forum
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => publish('public')} disabled={visBusy} style={segBtn(isPublic)} title="Visible par tous les membres (forum communautaire)">Public</button>
              <button onClick={() => publish('private')} disabled={visBusy} style={segBtn(!isPublic)} title="Réservé aux participants">Privé</button>
            </div>
          </div>
        </div>
      ) : null}

      {proc ? (
        <div style={{ marginBottom: 12, fontSize: 12.5, fontFamily: COL.mono, color: proc.startsWith('Échec') ? '#f0a58a' : COL.coral }}>
          {proc}
        </div>
      ) : null}
      {visMsg ? (
        <div style={{ marginBottom: 12, fontSize: 12.5, fontFamily: COL.mono, color: visMsg.startsWith('Échec') ? '#f0a58a' : COL.coral }}>
          {visMsg}
        </div>
      ) : null}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: COL.mono, fontSize: 10, letterSpacing: '0.12em', color: COL.t3 }}>CHARGEMENT…</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: '44px 20px', color: COL.t3 }}>Replay introuvable ou non accessible.</div>
      ) : (
        <UnifiedVideoPlayer data={data} layout="embed" onAskQuestion={handleAsk} />
      )}
    </div>
  );
}
