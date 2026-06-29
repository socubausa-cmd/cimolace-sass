// ─────────────────────────────────────────────────────────────────────────────
// SALLE DE CONSULTATION LIRI — mode « Consultation / Conversation » dédié.
//
// Distinct du mode Formation (deck-centré, 1→N). Ici : conversation FACE-À-FACE
// praticien ↔ patient (+ proche), avec le cockpit clinique MEDOS comme composer.
// Role-aware via /med/teleconsult/:id/clinical-context :
//   - role='host'    → praticien : pilote la VUE + cockpit composer + annotation.
//   - role='patient' → patient/proche : suit la vue pilotée par le praticien.
//
// NAVIGATION DE VUE (synchronisée, host pilote ; cf. useCockpitChannel) :
//   • Conversation → les visages au centre (face-à-face ; +proche → grille).
//   • Partage      → un artefact clinique (jumeau/bilan/ordonnance…) au centre,
//                    la vidéo passe en bande de vignettes.
//   • Tableau      → un tableau blanc annotable (expliquer en dessinant).
//
// Layout custom (primitives LiveKit) au lieu du <VideoConference> tout-en-un :
// chaque flux est encadré en 16:9 (object-fit cover SANS écrasement). Token via
// le chemin MÉDICAL (contrôle d'accès patient).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Stethoscope, PhoneOff, Share2, Pencil, Users, Presentation, MonitorUp, Eraser, UserPlus, Copy, Check, ShieldCheck, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import '@livekit/components-styles';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { teleconsultApi, type TeleconsultInvite } from '@/lib/api';
import { getClinicalContext, type ClinicalContext, type CockpitScene } from '@/features/medos-cockpit/cockpit-api';
import { useCockpitChannel, type AnnotStroke, type ConsultView } from '@/features/medos-cockpit/useCockpitChannel';
import { SharedSceneView, CockpitDock } from '@/features/medos-cockpit/MedTeleconsultCockpit';
import { AnnotationOverlay } from '@/features/medos-cockpit/AnnotationOverlay';

const BG = '#0b0b0c';
const BAR = 'rgba(22,22,24,0.94)';
const GOLD = '#b08d57';
const TILE_BG = '#18181b';

// La téléconsult est un moteur MEDOS : à la sortie, le praticien revient à MEDOS
// (med.cimolace.space, d'où il vient) — JAMAIS au portail LIRI école (/dashboard
// = nav Formations/Vie Étudiante, hors-sujet pour une clinique wellness).
function returnToMedos(slug?: string | null) {
  if (typeof window === 'undefined') return;
  const ref = document.referrer;
  if (ref && ref.includes('med.cimolace.space')) {
    window.location.href = ref;
    return;
  }
  window.location.href = `https://med.cimolace.space/${slug ? `?tenant=${encodeURIComponent(slug)}` : ''}`;
}

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
  // Canal de partage au niveau de la salle : pilote la VUE + la SCÈNE centrale +
  // l'annotation. Un seul abonnement, partagé avec le cockpit (sinon les 2 ne se
  // voient pas, broadcast self:false).
  const channel = useCockpitChannel(sessionId ?? null, isHost ? 'host' : 'patient');
  const { view, scene, strokes } = channel;
  const [annotate, setAnnotate] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [left, setLeft] = useState(false);
  const hasScene = !!scene && scene.kind !== 'clear';
  // Annotable seulement quand il y a une surface à annoter : le tableau, ou un
  // partage avec un artefact réellement affiché (pas sur un partage vide).
  const annotatable = view === 'board' || (view === 'share' && hasScene);
  const tenantSlug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant') : null;
  // Sortie : le praticien revient à MEDOS ; le patient voit un écran de fin
  // neutre (pas de compte → pas de portail).
  const handleLeave = () => {
    if (isHost) returnToMedos(tenantSlug);
    else setLeft(true);
  };

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

  if (left) return <CallEndedScreen />;

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
        <ConsultationChrome
          patientName={ctx?.patient_name}
          isHost={isHost}
          view={view}
          onView={channel.pushView}
        />
        <ConsultationStage
          view={view}
          isHost={isHost}
          scene={scene}
          strokes={strokes}
          editable={annotate && isHost && annotatable}
          onStrokes={channel.shareStrokes}
        />
        <ConsultationBar
          isHost={isHost}
          annotatable={annotatable}
          annotate={annotate}
          onToggleAnnotate={() => setAnnotate((v) => !v)}
          hasStrokes={strokes.length > 0}
          onClearStrokes={channel.clearStrokes}
          onInvite={() => setInviteOpen(true)}
          onLeave={handleLeave}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
      {/* Composer clinique MEDOS (praticien seul) ; le patient voit le partage
          directement sur la SCÈNE centrale. */}
      {isHost && sessionId ? <CockpitDock sessionId={sessionId} mode="host" channel={channel} /> : null}
      {/* Inviter un proche (praticien) + consentement RGPD (patient). */}
      {isHost && sessionId ? (
        <InviteProcheModal sessionId={sessionId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      ) : null}
      {!isHost && sessionId ? <PatientConsentGate sessionId={sessionId} /> : null}
    </div>
  );
  // Plein écran : portal vers <body> pour échapper à tout ancêtre containing-block
  // (sinon position:fixed reste contraint sous le header tenant).
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

// ── Bandeau haut : identité + SWITCHER de vue (host) ─────────────────────────
const VIEW_OPTIONS: { id: ConsultView; label: string; icon: React.ReactNode }[] = [
  { id: 'conversation', label: 'Conversation', icon: <Users size={15} aria-hidden="true" /> },
  { id: 'share', label: 'Partage', icon: <Share2 size={15} aria-hidden="true" /> },
  { id: 'board', label: 'Tableau', icon: <Presentation size={15} aria-hidden="true" /> },
];

function ConsultationChrome({
  patientName,
  isHost,
  view,
  onView,
}: {
  patientName?: string;
  isHost: boolean;
  view: ConsultView;
  onView: (v: ConsultView) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: BAR, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <Stethoscope size={18} color={GOLD} aria-hidden="true" />
      <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>Consultation</span>
      {patientName ? (
        <span style={{ color: '#cbd5e1', fontSize: 13, whiteSpace: 'nowrap' }}>· {patientName}</span>
      ) : null}

      {/* Switcher de vue : centré. Host = boutons ; patient = libellé seul. */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {isHost ? (
          <div role="tablist" aria-label="Vue de consultation" style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.07)', borderRadius: 11, padding: 3, gap: 2 }}>
            {VIEW_OPTIONS.map((o) => {
              const active = view === o.id;
              return (
                <button
                  key={o.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => onView(o.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: active ? GOLD : 'transparent',
                    color: active ? '#1a1a1a' : '#cbd5e1',
                    fontSize: 13, fontWeight: 600, transition: 'background 0.15s',
                  }}
                >
                  {o.icon}
                  <span>{o.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', padding: '6px 13px', borderRadius: 9 }}>
            {VIEW_OPTIONS.find((o) => o.id === view)?.icon}
            {VIEW_OPTIONS.find((o) => o.id === view)?.label}
          </span>
        )}
      </div>

      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#f87171', fontSize: 12.5, whiteSpace: 'nowrap' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} /> En direct
      </span>
    </div>
  );
}

// ── Tuiles vidéo encadrées 16:9 (pas d'écrasement) ───────────────────────────
function tileKey(t: any, i: number): string {
  return `${t?.participant?.identity || 'p'}-${t?.source || 's'}-${t?.publication?.trackSid || i}`;
}

function VideoTiles({ tracks, variant }: { tracks: any[]; variant: 'stage' | 'strip' }) {
  const list = tracks.length ? tracks : [];
  const n = Math.max(list.length, 1);

  if (variant === 'strip') {
    // Bande de vignettes : tuiles fixes 16:9, centrées (jamais étirées).
    return (
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        {list.map((t, i) => (
          <div key={tileKey(t, i)} style={{ width: 148, aspectRatio: '16 / 9', flexShrink: 0, borderRadius: 11, overflow: 'hidden', background: TILE_BG, border: '1px solid rgba(255,255,255,0.08)' }}>
            <ParticipantTile trackRef={t} style={{ width: '100%', height: '100%' }} />
          </div>
        ))}
      </div>
    );
  }

  // Scène conversation : tuiles centrées, dimensionnées par la HAUTEUR (donc
  // jamais de débordement vertical) puis ratio 16:9 → largeur dérivée.
  const h = n <= 2 ? 'min(80%, 64vh)' : n <= 4 ? 'min(46%, 40vh)' : 'min(30%, 28vh)';
  return (
    <div style={{ height: '100%', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', alignContent: 'center' }}>
      {list.map((t, i) => (
        <div key={tileKey(t, i)} style={{ height: h, aspectRatio: '16 / 9', maxWidth: '94%', borderRadius: 16, overflow: 'hidden', background: TILE_BG, boxShadow: '0 10px 34px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <ParticipantTile trackRef={t} style={{ width: '100%', height: '100%' }} />
        </div>
      ))}
    </div>
  );
}

// ── Scène : rend la vue pilotée par le praticien ─────────────────────────────
export function ConsultationStage({
  view,
  isHost,
  scene,
  strokes,
  editable,
  onStrokes,
}: {
  view: ConsultView;
  isHost: boolean;
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

  // CONVERSATION : visages au centre.
  if (view === 'conversation') {
    return (
      <div style={{ flex: 1, minHeight: 0, padding: 16 }}>
        <VideoTiles tracks={tracks} variant="stage" />
      </div>
    );
  }

  // PARTAGE / TABLEAU : artefact (ou tableau blanc) au centre + bande vidéo.
  const hasScene = !!scene && scene.kind !== 'clear';
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
      <div style={{ flex: 1, minHeight: 0, borderRadius: 16, overflow: 'hidden', position: 'relative', background: '#fff' }}>
        {view === 'board' ? (
          <BoardSurface hasStrokes={strokes.length > 0} editable={editable} isHost={isHost} />
        ) : hasScene ? (
          <SharedSceneView scene={scene} />
        ) : (
          <SharePlaceholder />
        )}
        {(view === 'board' || hasScene) ? (
          <AnnotationOverlay strokes={strokes} editable={editable} onStrokes={onStrokes} />
        ) : null}
      </div>
      <div style={{ height: 92, flexShrink: 0 }}>
        <VideoTiles tracks={tracks} variant="strip" />
      </div>
    </div>
  );
}

// Tableau blanc (mode Tableau) : grille de points discrète + invite si vide.
function BoardSurface({ hasStrokes, editable, isHost }: { hasStrokes: boolean; editable: boolean; isHost: boolean }) {
  const hint = editable
    ? 'Dessinez pour expliquer.'
    : isHost
      ? 'Activez « Annoter » pour dessiner.'
      : 'Le praticien va dessiner ici.';
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        backgroundColor: '#fcfcfd',
        backgroundImage: 'radial-gradient(rgba(17,24,39,0.07) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
        display: 'grid', placeItems: 'center',
      }}
    >
      {!hasStrokes ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', pointerEvents: 'none' }}>
          <Presentation size={30} style={{ margin: '0 auto 10px', opacity: 0.6 }} aria-hidden="true" />
          <p style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>Tableau</p>
          <p style={{ fontSize: 12.5 }}>{hint}</p>
        </div>
      ) : null}
    </div>
  );
}

// Vue Partage sans artefact encore choisi (host).
function SharePlaceholder() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#6b7280', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <Share2 size={30} style={{ margin: '0 auto 10px', opacity: 0.6 }} aria-hidden="true" />
        <p style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>Aucun élément partagé</p>
        <p style={{ fontSize: 12.5 }}>
          Ouvrez le cockpit clinique <span aria-hidden="true">🩺</span> (en bas à droite), puis « Partager » un jumeau, un bilan, une ordonnance…
        </p>
      </div>
    </div>
  );
}

// ── Barre de contrôle (micro / caméra / partage écran / annotation / quitter) ─
function ConsultationBar({
  isHost,
  annotatable,
  annotate,
  onToggleAnnotate,
  hasStrokes,
  onClearStrokes,
  onInvite,
  onLeave,
}: {
  isHost: boolean;
  annotatable: boolean;
  annotate: boolean;
  onToggleAnnotate: () => void;
  hasStrokes: boolean;
  onClearStrokes: () => void;
  onInvite: () => void;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const leave = () => {
    try {
      room.disconnect();
    } catch {
      /* ignore */
    }
    onLeave();
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MonitorUp size={15} aria-hidden="true" /> Écran
          </span>
        </TrackToggle>
      ) : null}
      {isHost && annotatable ? (
        <button
          onClick={onToggleAnnotate}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', background: annotate ? GOLD : 'rgba(255,255,255,0.1)', color: annotate ? '#1a1a1a' : '#fff', fontSize: 13, fontWeight: 600 }}
        >
          <Pencil size={15} aria-hidden="true" /> {annotate ? 'Annotation ON' : 'Annoter'}
        </button>
      ) : null}
      {isHost && annotatable && hasStrokes ? (
        <button
          onClick={onClearStrokes}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', background: 'transparent', color: '#cbd5e1', fontSize: 13 }}
        >
          <Eraser size={15} aria-hidden="true" /> Effacer
        </button>
      ) : null}
      {isHost ? (
        <button
          onClick={onInvite}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, fontWeight: 600 }}
        >
          <UserPlus size={15} aria-hidden="true" /> Inviter un proche
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

// ── Inviter un proche (host) + consentement RGPD (patient) ───────────────────
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 2147483600, background: 'rgba(0,0,0,0.55)', display: 'grid', placeItems: 'center', padding: 20 };
const modalStyle: React.CSSProperties = { width: '100%', maxWidth: 520, background: '#161618', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' };
const inputStyle: React.CSSProperties = { flex: 1, minWidth: 0, padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13 };
const primaryBtn: React.CSSProperties = { padding: '9px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', background: GOLD, color: '#1a1a1a', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' };
const secondaryBtn: React.CSSProperties = { padding: '10px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', background: 'transparent', color: '#cbd5e1', fontSize: 13, fontWeight: 600 };
const closeBtn: React.CSSProperties = { marginLeft: 'auto', background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'inline-flex' };
const iconBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#cbd5e1', cursor: 'pointer', padding: 7, display: 'inline-flex' };
const inviteRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };

function StatusBadge({ status }: { status: TeleconsultInvite['status'] }) {
  const map: Record<TeleconsultInvite['status'], { label: string; color: string; bg: string }> = {
    consent_requested: { label: 'En attente du consentement', color: '#fcd34d', bg: 'rgba(251,191,36,0.14)' },
    consented: { label: 'Autorisé', color: '#86efac', bg: 'rgba(34,197,94,0.14)' },
    admitted: { label: 'A rejoint', color: '#86efac', bg: 'rgba(34,197,94,0.14)' },
    denied: { label: 'Refusé', color: '#fca5a5', bg: 'rgba(239,68,68,0.14)' },
    revoked: { label: 'Révoqué', color: '#9ca3af', bg: 'rgba(255,255,255,0.06)' },
  };
  const s = map[status];
  return <span style={{ display: 'inline-block', marginTop: 3, fontSize: 11, color: s.color, background: s.bg, padding: '2px 8px', borderRadius: 999 }}>{s.label}</span>;
}

function InviteProcheModal({ sessionId, open, onClose }: { sessionId: string; open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [invites, setInvites] = useState<TeleconsultInvite[]>([]);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const slug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant') : null;
  const linkFor = (id: string) =>
    `${window.location.origin}/teleconsult/${sessionId}/proche/${id}${slug ? `?tenant=${encodeURIComponent(slug)}` : ''}`;

  useEffect(() => {
    if (!open) return undefined;
    const refresh = () => teleconsultApi.listInvites(sessionId).then(setInvites).catch(() => {});
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [open, sessionId]);

  if (!open) return null;

  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(id));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* clipboard refusé */
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const inv = await teleconsultApi.createInvite(sessionId, {
        display_name: name.trim() || undefined,
        relationship: relationship.trim() || undefined,
      });
      setName('');
      setRelationship('');
      setInvites((prev) => [...prev, inv]);
      copy(inv.id);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    await teleconsultApi.revokeInvite(sessionId, id).catch(() => {});
    teleconsultApi.listInvites(sessionId).then(setInvites).catch(() => {});
  };

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <UserPlus size={18} color={GOLD} aria-hidden="true" />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>Inviter un proche</h3>
          <button onClick={onClose} style={closeBtn} aria-label="Fermer"><X size={16} /></button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#9ca3af', lineHeight: 1.5 }}>
          Le proche rejoint via un lien. <strong style={{ color: '#cbd5e1' }}>Le patient devra autoriser</strong> sa participation (partage des données de santé).
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du proche" style={inputStyle} />
          <input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Lien (ex: Fille)" style={{ ...inputStyle, maxWidth: 130 }} />
          <button onClick={create} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>Créer le lien</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
          {invites.length === 0 ? (
            <p style={{ fontSize: 12.5, color: '#6b7280', textAlign: 'center', padding: '10px 0' }}>Aucune invitation pour l'instant.</p>
          ) : (
            invites.map((inv) => (
              <div key={inv.id} style={inviteRow}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {inv.display_name}{inv.relationship ? ` · ${inv.relationship}` : ''}
                  </div>
                  <StatusBadge status={inv.status} />
                </div>
                <button onClick={() => copy(inv.id)} title="Copier le lien" style={iconBtn} aria-label="Copier le lien">
                  {copiedId === inv.id ? <Check size={15} color="#86efac" /> : <Copy size={15} />}
                </button>
                <button onClick={() => revoke(inv.id)} title="Révoquer" style={iconBtn} aria-label="Révoquer"><X size={15} /></button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PatientConsentGate({ sessionId }: { sessionId: string }) {
  const [pending, setPending] = useState<TeleconsultInvite | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = () =>
      teleconsultApi
        .listInvites(sessionId)
        .then((list) => {
          if (alive) setPending(list.find((i) => i.status === 'consent_requested') || null);
        })
        .catch(() => {});
    poll();
    const t = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [sessionId]);

  if (!pending) return null;

  const decide = async (granted: boolean) => {
    setBusy(true);
    try {
      await teleconsultApi.consentInvite(sessionId, pending.id, granted);
      setPending(null);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 420, textAlign: 'center' }}>
        <ShieldCheck size={30} color={GOLD} style={{ margin: '0 auto 8px' }} aria-hidden="true" />
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#fff' }}>Autoriser un proche ?</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.55 }}>
          <strong style={{ color: '#fff' }}>{pending.display_name}{pending.relationship ? ` (${pending.relationship})` : ''}</strong> souhaite participer à votre consultation. Autorisez-vous le partage de vos données de santé avec cette personne pendant l'appel ?
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => decide(false)} disabled={busy} style={secondaryBtn}>Refuser</button>
          <button onClick={() => decide(true)} disabled={busy} style={{ ...primaryBtn, padding: '10px 20px' }}>Autoriser</button>
        </div>
      </div>
    </div>
  );
}

// Écran de fin neutre (patient / proche) : pas de redirection vers un portail.
export function CallEndedScreen() {
  return (
    <Screen>
      <div style={{ textAlign: 'center', color: '#cbd5e1', maxWidth: 360 }}>
        <Stethoscope size={28} color={GOLD} style={{ marginBottom: 10 }} aria-hidden="true" />
        <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#fff' }}>Consultation terminée</h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.55 }}>Vous avez quitté la consultation. Vous pouvez fermer cette fenêtre.</p>
      </div>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: BG, padding: 24 }}>
      {children}
    </div>
  );
}
