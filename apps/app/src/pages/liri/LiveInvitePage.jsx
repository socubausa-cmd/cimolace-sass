import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { getApiBaseUrl } from '@/lib/apiBase';

/**
 * Salle INVITÉ d'un live PAYANT — SANS login. L'acheteur (site tenant, ex zahirwellness)
 * arrive via un lien token-gaté `/live/:sessionId/invite/:inviteId?tenant=slug`. On échange
 * ce jeton (= id d'un access_pass `live_session`) contre un token LiveKit invité via
 * l'endpoint PUBLIC `POST /lives-public/:sessionId/guest-token`. Viewer only (canSubscribe).
 */

function Centered({ children }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#141414',
        color: '#f4efe9',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 15,
        padding: 24,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}

function GuestStage() {
  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: true },
  );
  if (!tracks.length) {
    return <Centered>En attente du démarrage du direct par l'animateur…</Centered>;
  }
  return (
    <GridLayout tracks={tracks} style={{ height: '100%' }}>
      <ParticipantTile />
    </GridLayout>
  );
}

export default function LiveInvitePage() {
  const { sessionId, inviteId } = useParams();
  const [searchParams] = useSearchParams();
  const tenant = searchParams.get('tenant') || undefined;

  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/lives-public/${sessionId}/guest-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invite_id: inviteId, tenant }),
        });
        let d = await res.json();
        while (d && typeof d === 'object' && !Array.isArray(d) && 'data' in d) d = d.data;
        if (!res.ok || !d?.token) {
          throw new Error(d?.message || "Ce lien d'accès est invalide ou expiré.");
        }
        if (alive) setToken(d.token);
      } catch (e) {
        if (alive) setError(e?.message || "Accès impossible.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId, inviteId, tenant]);

  if (loading) return <Centered>Connexion au direct…</Centered>;
  if (error) return <Centered>{error}</Centered>;
  if (!serverUrl) return <Centered>Configuration vidéo indisponible.</Centered>;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#141414' }}>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        audio={false}
        video={false}
        style={{ height: '100%' }}
      >
        <GuestStage />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
