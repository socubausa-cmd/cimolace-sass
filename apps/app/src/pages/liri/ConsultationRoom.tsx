// ─────────────────────────────────────────────────────────────────────────────
// SALLE DE CONSULTATION LIRI — mode « Consultation / Conversation » dédié.
//
// Distinct du mode Formation (deck-centré, 1→N). Ici : conversation FACE-À-FACE
// praticien ↔ patient (+ proche), avec le cockpit clinique MEDOS comme composer.
// Role-aware via /med/teleconsult/:id/clinical-context :
//   - role='host'    → praticien : scène + cockpit composer + note privée.
//   - role='patient' → patient/proche : scène + reçoit ce qui est partagé.
//
// Layout custom (primitives LiveKit) au lieu du <VideoConference> tout-en-un :
// les visages au CENTRE (pas un tableau plein écran). +proche → la grille
// s'adapte (3-up). Token via le chemin MÉDICAL (contrôle d'accès patient).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Stethoscope, PhoneOff } from 'lucide-react';
import '@livekit/components-styles';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { teleconsultApi } from '@/lib/api';
import { getClinicalContext, type ClinicalContext } from '@/features/medos-cockpit/cockpit-api';
import MedTeleconsultCockpit from '@/features/medos-cockpit/MedTeleconsultCockpit';

const BG = '#0b0b0c';
const BAR = 'rgba(22,22,24,0.94)';
const GOLD = '#b08d57';

export default function ConsultationRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const [conn, setConn] = useState<{ url: string; token: string } | null>(null);
  const [ctx, setCtx] = useState<ClinicalContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // On attend l'auth (handoff SSO) avant l'endpoint médical gardé.
    if (!sessionId || !user?.id) return undefined;
    let alive = true;
    (async () => {
      try {
        // Contexte (rôle + nom patient) — best-effort, ne bloque pas la vidéo.
        getClinicalContext(sessionId)
          .then((c) => alive && setCtx(c))
          .catch(() => {});
        const res: any = await teleconsultApi.issueToken(sessionId);
        if (!alive) return;
        if (!res?.url || !res?.token) {
          setError('Réponse de session invalide.');
          return;
        }
        setConn({ url: res.url, token: res.token });
        teleconsultApi.join(sessionId).catch(() => {});
      } catch (e: any) {
        if (alive) setError(e?.message || 'Connexion à la consultation impossible.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId, user?.id]);

  const isHost = ctx?.role === 'host';

  if (error) {
    return (
      <Screen>
        <div style={{ textAlign: 'center', color: '#fca5a5', maxWidth: 360 }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{error}</p>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>
            Vérifiez l'heure du rendez-vous, ou réessayez depuis votre espace.
          </p>
        </div>
      </Screen>
    );
  }

  if (!conn) {
    return (
      <Screen>
        <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
          <div style={{ width: 40, height: 40, margin: '0 auto 14px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: GOLD, borderRadius: '50%', animation: 'lk-spin 0.9s linear infinite' }} />
          <p style={{ fontSize: 14 }}>{user?.id ? 'Connexion à la consultation…' : 'Authentification…'}</p>
          <style>{'@keyframes lk-spin{to{transform:rotate(360deg)}}'}</style>
        </div>
      </Screen>
    );
  }

  return (
    <div data-lk-theme="default" style={{ position: 'fixed', inset: 0, background: BG, display: 'flex', flexDirection: 'column' }}>
      <LiveKitRoom
        serverUrl={conn.url}
        token={conn.token}
        connect
        audio
        video
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <ConsultationChrome patientName={ctx?.patient_name} />
        <ConsultationStage />
        <ConsultationBar isHost={isHost} />
        <RoomAudioRenderer />
      </LiveKitRoom>
      {/* Cockpit clinique MEDOS (composer côté praticien / récepteur côté patient). */}
      <MedTeleconsultCockpit sessionId={sessionId} mode={isHost ? 'host' : 'patient'} />
    </div>
  );
}

// ── Bandeau haut ─────────────────────────────────────────────────────────────
function ConsultationChrome({ patientName }: { patientName?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: BAR, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <Stethoscope size={18} color={GOLD} aria-hidden="true" />
      <span style={{ fontWeight: 600, fontSize: 14 }}>Consultation</span>
      {patientName ? (
        <span style={{ color: '#cbd5e1', fontSize: 13 }}>· {patientName}</span>
      ) : null}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#f87171', fontSize: 12.5 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} /> En direct
      </span>
    </div>
  );
}

// ── Scène face-à-face (visages au centre) ────────────────────────────────────
function ConsultationStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <div style={{ flex: 1, minHeight: 0, padding: 14 }}>
      <GridLayout tracks={tracks} style={{ height: '100%' }}>
        <ParticipantTile style={{ borderRadius: 14, overflow: 'hidden' }} />
      </GridLayout>
    </div>
  );
}

// ── Barre de contrôle (micro / caméra / partage écran / quitter) ─────────────
function ConsultationBar({ isHost }: { isHost: boolean }) {
  const navigate = useNavigate();
  const room = useRoomContext();
  const leave = () => {
    try {
      room.disconnect();
    } catch {
      /* ignore */
    }
    navigate(isHost ? '/dashboard' : '/');
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px 14px', background: BAR, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <TrackToggle source={Track.Source.Microphone} showIcon>
        Micro
      </TrackToggle>
      <TrackToggle source={Track.Source.Camera} showIcon>
        Caméra
      </TrackToggle>
      {isHost ? (
        <TrackToggle source={Track.Source.ScreenShare} showIcon>
          Partager l'écran
        </TrackToggle>
      ) : null}
      <button
        onClick={leave}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', background: '#b1372f', color: '#fff', fontSize: 13, fontWeight: 600 }}
      >
        <PhoneOff size={16} aria-hidden="true" /> Quitter
      </button>
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: BG, padding: 24 }}>
      {children}
    </div>
  );
}
