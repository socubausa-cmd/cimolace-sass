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
 */
const COL = {
  coral: '#d97757',
  cream: '#f5f1e9',
  t3: 'rgba(245,241,233,0.5)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

export default function ReplayRoomPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backBase = location.pathname.split('/replay/')[0] || '';

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [proc, setProc] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    setLoading(true);
    supabase.rpc('get_replay_room', { p_session_id: sessionId }).then(({ data }) => {
      if (!alive) return;
      setRoom(data || null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [sessionId]);

  const session = room?.session;
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

  // Envoie le replay en post-production : transcription (Whisper) → mindmap →
  // écriture live_neuro_recall_state. Réutilise les edges déployées. Réservé
  // encadrant (garde côté RPC). ⚠️ gated : GROQ_API_KEY + audio ≤ 25 Mo.
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

  const processing = proc === 'Envoi en post-production…';

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '4px 0 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, paddingTop: 4 }}>
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
        <button
          onClick={runPostProd}
          disabled={processing}
          title="Générer transcription + carte mentale depuis le replay (réservé encadrant)"
          style={{
            flexShrink: 0, padding: '8px 14px', borderRadius: 9, cursor: processing ? 'wait' : 'pointer',
            background: 'rgba(217,119,87,0.14)', border: '1px solid rgba(217,119,87,0.34)',
            color: COL.coral, fontSize: 12.5, fontWeight: 600,
          }}
        >
          ⚙️ Envoyer en post-production
        </button>
      </div>
      {proc ? (
        <div style={{ marginBottom: 14, fontSize: 12.5, fontFamily: COL.mono, color: proc.startsWith('Échec') ? '#f0a58a' : COL.coral }}>
          {proc}
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
