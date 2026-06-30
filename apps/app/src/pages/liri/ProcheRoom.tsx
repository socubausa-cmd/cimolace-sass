// ─────────────────────────────────────────────────────────────────────────────
// SALLE DU PROCHE — un membre de la famille rejoint la téléconsultation via un
// lien d'invitation (sans compte tenant). Route PUBLIQUE /teleconsult/:id/proche/
// :inviteId. Garde fail-closed : aucune vidéo tant que le PATIENT n'a pas
// consenti (le token invité n'est délivré que si status='consented').
//
// Réutilise ConsultationStage (visages + artefact partagé + annotation lue) et
// useCockpitChannel('patient') → le proche SUIT la vue pilotée par le praticien.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  TrackToggle,
  useRoomContext,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Stethoscope, PhoneOff, ShieldCheck, MessageSquare } from 'lucide-react';
import { createPortal } from 'react-dom';
import '@livekit/components-styles';
import { getProcheStatus, getProcheToken, type ProcheStatus } from '@/features/medos-cockpit/procheApi';
import { useCockpitChannel } from '@/features/medos-cockpit/useCockpitChannel';
import { getApiBaseUrl } from '@/lib/apiBase';
import { ConsultationStage, CallEndedScreen, ChatPanel } from './ConsultationRoom';

const BG = '#0b0b0c';
const BAR = 'rgba(22,22,24,0.94)';
const GOLD = '#b08d57';

export default function ProcheRoom() {
  const { id: sessionId, inviteId } = useParams<{ id: string; inviteId: string }>();
  const [status, setStatus] = useState<ProcheStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [conn, setConn] = useState<{ url: string; token: string } | null>(null);
  const [joining, setJoining] = useState(false);

  // Poll du consentement tant qu'on n'a pas rejoint (transition auto).
  useEffect(() => {
    if (!inviteId || conn) return undefined;
    let alive = true;
    const poll = () =>
      getProcheStatus(inviteId)
        .then((s) => alive && setStatus(s))
        .catch((e) => alive && setErr(e?.message || 'Invitation introuvable'));
    poll();
    const t = setInterval(poll, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [inviteId, conn]);

  const join = async () => {
    if (!inviteId) return;
    setJoining(true);
    try {
      const r = await getProcheToken(inviteId);
      setConn({ url: r.url, token: r.token });
    } catch (e: any) {
      setErr(e?.message || 'Impossible de rejoindre');
    } finally {
      setJoining(false);
    }
  };

  if (conn && sessionId) {
    return <ProcheLiveRoom url={conn.url} token={conn.token} sessionId={sessionId} clinic={status?.clinic_name} />;
  }

  const ready = status && (status.status === 'consented' || status.status === 'admitted');

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: BG, display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20, color: '#fff' }}>
          <Stethoscope size={18} color={GOLD} aria-hidden="true" />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Consultation{status?.display_name ? ` · ${status.display_name}` : ''}</span>
        </div>

        {err ? (
          <Gate tone="error" title="Accès indisponible" text={err} />
        ) : !status ? (
          <Gate spinner title="Chargement…" text="Vérification de l'invitation." />
        ) : status.status === 'consent_requested' ? (
          <Gate spinner title="En attente d'autorisation" text="Le patient doit autoriser votre participation. Cette page se met à jour automatiquement." />
        ) : status.status === 'denied' ? (
          <Gate tone="error" title="Accès refusé" text="Le patient n'a pas autorisé votre participation à la consultation." />
        ) : status.status === 'revoked' ? (
          <Gate tone="error" title="Invitation révoquée" text="Cette invitation n'est plus valable." />
        ) : ready ? (
          <div>
            <ShieldCheck size={34} color={GOLD} style={{ marginBottom: 10 }} aria-hidden="true" />
            <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#fff' }}>Vous êtes autorisé(e)</h2>
            <p style={{ margin: '0 0 18px', fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.55 }}>
              Le patient a autorisé votre participation{status.clinic_name ? ` · ${status.clinic_name}` : ''}. Votre caméra et votre micro seront activés.
            </p>
            <button
              onClick={join}
              disabled={joining}
              style={{ padding: '11px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', background: GOLD, color: '#1a1a1a', fontSize: 14, fontWeight: 700, opacity: joining ? 0.6 : 1 }}
            >
              {joining ? 'Connexion…' : 'Rejoindre la consultation'}
            </button>
          </div>
        ) : (
          <Gate spinner title="Patientez…" text="Préparation de la consultation." />
        )}
      </div>
      <style>{'@keyframes lk-spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

function Gate({ title, text, tone, spinner }: { title: string; text: string; tone?: 'error'; spinner?: boolean }) {
  return (
    <div>
      {spinner ? (
        <div style={{ width: 36, height: 36, margin: '0 auto 14px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: GOLD, borderRadius: '50%', animation: 'lk-spin 0.9s linear infinite' }} />
      ) : null}
      <h2 style={{ margin: '0 0 6px', fontSize: 17, color: tone === 'error' ? '#fca5a5' : '#fff' }}>{title}</h2>
      <p style={{ margin: '0 auto', fontSize: 13.5, color: '#9ca3af', maxWidth: 340, lineHeight: 1.55 }}>{text}</p>
    </div>
  );
}

// ── La salle vidéo du proche (après consentement) ────────────────────────────
function ProcheLiveRoom({ url, token, sessionId, clinic }: { url: string; token: string; sessionId: string; clinic?: string }) {
  // Le proche SUIT la vue/scène/annotation pilotées par le praticien (read-only).
  const channel = useCockpitChannel(sessionId, 'patient');
  const [left, setLeft] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // Image de marque : logo du tenant (résolu par slug) + nom praticien (diffusé
  // par le host sur le canal) → le proche aussi sait avec qui il parle.
  const [clinicLogo, setClinicLogo] = useState<string | null>(null);
  useEffect(() => {
    const slug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant') : null;
    if (!slug) return undefined;
    let alive = true;
    fetch(`${getApiBaseUrl()}/tenants/by-slug/${encodeURIComponent(slug)}/branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { const logo = j?.data?.logo_url || j?.logo_url || null; if (alive && logo) setClinicLogo(String(logo)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (left) return <CallEndedScreen />;
  const content = (
    <div data-lk-theme="default" style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: BG, display: 'flex', flexDirection: 'column' }}>
      <LiveKitRoom serverUrl={url} token={token} connect audio video style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <ProcheChrome clinic={clinic} />
            <ConsultationStage
              view={channel.view}
              isHost={false}
              scene={channel.scene}
              strokes={channel.strokes}
              editable={false}
              onStrokes={() => {}}
              identity={{ logo: clinicLogo, label: clinic ?? null, name: channel.hostName }}
            />
            <ProcheBar onLeave={() => setLeft(true)} chatOpen={chatOpen} onToggleChat={() => setChatOpen((v) => !v)} />
          </div>
          {chatOpen ? <ChatPanel onClose={() => setChatOpen(false)} /> : null}
        </div>
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

function ProcheChrome({ clinic }: { clinic?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: BAR, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Logo LIRI (mark officiel, même que login/boot) — image de marque. */}
      <img
        src="/lirilogo.png"
        alt="LIRI"
        style={{ height: 24, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(212,163,106,0.32))', flexShrink: 0 }}
      />
      <span style={{ fontWeight: 600, fontSize: 14 }}>Consultation{clinic ? ` · ${clinic}` : ''}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', padding: '3px 9px', borderRadius: 999 }}>
        <ShieldCheck size={13} aria-hidden="true" /> Proche invité
      </span>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#f87171', fontSize: 12.5 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} /> En direct
      </span>
    </div>
  );
}

function ProcheBar({ onLeave, chatOpen, onToggleChat }: { onLeave: () => void; chatOpen: boolean; onToggleChat: () => void }) {
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
      <button
        onClick={onToggleChat}
        aria-pressed={chatOpen}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', background: chatOpen ? GOLD : 'rgba(255,255,255,0.1)', color: chatOpen ? '#1a1a1a' : '#fff', fontSize: 13, fontWeight: 600 }}
      >
        <MessageSquare size={15} aria-hidden="true" /> Discussion
      </button>
      <button
        onClick={leave}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', background: '#b1372f', color: '#fff', fontSize: 13, fontWeight: 600 }}
      >
        <PhoneOff size={16} aria-hidden="true" /> Quitter
      </button>
    </div>
  );
}
