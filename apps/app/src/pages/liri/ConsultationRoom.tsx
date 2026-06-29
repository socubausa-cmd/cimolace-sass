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
import { Stethoscope, PhoneOff, Share2, Pencil } from 'lucide-react';
import { createPortal } from 'react-dom';
import '@livekit/components-styles';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { teleconsultApi } from '@/lib/api';
import { getClinicalContext, type ClinicalContext, type CockpitScene } from '@/features/medos-cockpit/cockpit-api';
import { useCockpitChannel, type AnnotStroke } from '@/features/medos-cockpit/useCockpitChannel';
import { SharedSceneView, CockpitDock } from '@/features/medos-cockpit/MedTeleconsultCockpit';
import { AnnotationOverlay } from '@/features/medos-cockpit/AnnotationOverlay';

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
  // Canal de partage au niveau de la salle : pilote la SCÈNE centrale — quand le
  // praticien partage un artefact (jumeau / bilan / SOAP), il passe au centre
  // pour tous et la vidéo devient une bande de vignettes.
  const channel = useCockpitChannel(sessionId ?? null, isHost ? 'host' : 'patient');
  const scene = channel.scene;
  const [annotate, setAnnotate] = useState(false);

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

  const sharing = !!scene && scene.kind !== 'clear';
  const content = (
    <div data-lk-theme="default" style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: BG, display: 'flex', flexDirection: 'column' }}>
      <LiveKitRoom
        serverUrl={conn.url}
        token={conn.token}
        connect
        audio
        video
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <ConsultationChrome patientName={ctx?.patient_name} sharing={sharing} />
        <ConsultationStage
          scene={scene}
          strokes={channel.strokes}
          editable={annotate && isHost}
          onStrokes={channel.shareStrokes}
        />
        <ConsultationBar
          isHost={isHost}
          sharing={sharing}
          annotate={annotate}
          onToggleAnnotate={() => setAnnotate((v) => !v)}
          hasStrokes={channel.strokes.length > 0}
          onClearStrokes={channel.clearStrokes}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
      {/* Composer clinique MEDOS (praticien seul) ; le patient voit le partage
          directement sur la SCÈNE centrale. */}
      {isHost && sessionId ? <CockpitDock sessionId={sessionId} mode="host" channel={channel} /> : null}
    </div>
  );
  // Plein écran : portal vers <body> pour échapper à tout ancêtre containing-block
  // (sinon position:fixed reste contraint sous le header tenant).
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

// ── Bandeau haut ─────────────────────────────────────────────────────────────
function ConsultationChrome({ patientName, sharing }: { patientName?: string; sharing?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: BAR, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <Stethoscope size={18} color={GOLD} aria-hidden="true" />
      <span style={{ fontWeight: 600, fontSize: 14 }}>Consultation</span>
      {patientName ? (
        <span style={{ color: '#cbd5e1', fontSize: 13 }}>· {patientName}</span>
      ) : null}
      {sharing ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#86efac', background: 'rgba(34,197,94,0.14)', padding: '3px 9px', borderRadius: 999 }}>
          <Share2 size={13} aria-hidden="true" /> Partage en cours
        </span>
      ) : null}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#f87171', fontSize: 12.5 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} /> En direct
      </span>
    </div>
  );
}

// ── Scène face-à-face (visages au centre) ────────────────────────────────────
function ConsultationStage({
  scene,
  strokes,
  editable,
  onStrokes,
}: {
  scene: CockpitScene | null;
  strokes: AnnotStroke[];
  editable: boolean;
  onStrokes: (s: AnnotStroke[]) => void;
}) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const sharing = !!scene && scene.kind !== 'clear';

  // État PARTAGE : l'artefact clinique prend la scène centrale ; la vidéo passe
  // en bande de vignettes en bas ; calque d'annotation par-dessus l'artefact.
  if (sharing) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
        <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
          <SharedSceneView scene={scene} />
          <AnnotationOverlay strokes={strokes} editable={editable} onStrokes={onStrokes} />
        </div>
        <div style={{ height: 104, flexShrink: 0 }}>
          <GridLayout tracks={tracks} style={{ height: '100%' }}>
            <ParticipantTile style={{ borderRadius: 10, overflow: 'hidden' }} />
          </GridLayout>
        </div>
      </div>
    );
  }

  // État CONVERSATION : les visages au centre (face-à-face ; +proche → grille).
  return (
    <div style={{ flex: 1, minHeight: 0, padding: 14 }}>
      <GridLayout tracks={tracks} style={{ height: '100%' }}>
        <ParticipantTile style={{ borderRadius: 14, overflow: 'hidden' }} />
      </GridLayout>
    </div>
  );
}

// ── Barre de contrôle (micro / caméra / partage écran / quitter) ─────────────
function ConsultationBar({
  isHost,
  sharing,
  annotate,
  onToggleAnnotate,
  hasStrokes,
  onClearStrokes,
}: {
  isHost: boolean;
  sharing: boolean;
  annotate: boolean;
  onToggleAnnotate: () => void;
  hasStrokes: boolean;
  onClearStrokes: () => void;
}) {
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
      {isHost && sharing ? (
        <button
          onClick={onToggleAnnotate}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', background: annotate ? GOLD : 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, fontWeight: 600 }}
        >
          <Pencil size={15} aria-hidden="true" /> {annotate ? 'Annotation ON' : 'Annoter'}
        </button>
      ) : null}
      {isHost && sharing && hasStrokes ? (
        <button
          onClick={onClearStrokes}
          style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', background: 'transparent', color: '#cbd5e1', fontSize: 13 }}
        >
          Effacer
        </button>
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
