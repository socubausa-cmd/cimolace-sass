// ─────────────────────────────────────────────────────────────────────────────
// SALLE DU PROCHE — un membre de la famille rejoint la téléconsultation via un
// lien d'invitation (sans compte tenant). Route PUBLIQUE /teleconsult/:id/proche/
// :inviteId. Garde fail-closed : aucune vidéo tant que le PATIENT n'a pas
// consenti (le token invité n'est délivré que si status='consented').
//
// Réutilise ConsultationStage (visages + artefact partagé + annotation lue) et
// useCockpitChannel('patient') → le proche SUIT la vue pilotée par le praticien.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useMatchMediaAtMost } from '@/hooks/useLiriMobileBreakpoint';
import { useParams } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  TrackToggle,
  useRoomContext,
} from '@livekit/components-react';
import { Track, DisconnectReason } from 'livekit-client';
import { PhoneOff, ShieldCheck, MessageSquare, Mic, MicOff, Video, VideoOff, Maximize, Minimize } from 'lucide-react';

// Plein ecran mobile (masque les barres du navigateur). Doit etre appele sur un
// GESTE utilisateur ; fail-soft (iOS Safari ne le supporte pas sur la page).
function requestAppFullscreen() {
  try {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (document.fullscreenElement) return;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
  } catch { /* non supporte */ }
}
function toggleAppFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else requestAppFullscreen();
  } catch { /* non supporte */ }
}
import { createPortal } from 'react-dom';
import '@livekit/components-styles';
import { getProcheStatus, getProcheToken, type ProcheStatus } from '@/features/medos-cockpit/procheApi';
import { useBroadcastJoinRequest } from '@/features/medos-cockpit/useJoinRequest';
import { explainSharedScene } from '@/features/medos-cockpit/cockpit-api';
import { useCockpitChannel } from '@/features/medos-cockpit/useCockpitChannel';
import { getApiBaseUrl } from '@/lib/apiBase';
import { ConsultationStage, CallEndedScreen, ChatPanel, AudioUnlockGate, RaiseHandButton, CONSULT_SHELL_CSS } from './ConsultationRoom';
import { ParticipantCaptions } from '@/features/consultation-stage/LiveCaptions';

// Shell chaud LIRI (aligné sur ConsultationRoom / liveHostTheme).
const BG = '#262624';
const PAGE_MESH =
  'radial-gradient(ellipse 85% 55% at 50% -15%, rgba(217,119,87,0.06), transparent 58%), radial-gradient(ellipse 55% 40% at 100% 85%, rgba(226,85,63,0.05), transparent 52%), radial-gradient(ellipse 45% 32% at 0% 75%, rgba(194,104,63,0.04), transparent 48%)';
const BAR = 'rgba(43,41,38,0.96)';
const GOLD = '#d4a36a';
const TILE_BG = '#1f1e1c'; // --lh-stage-bg : SANS elle, le Tableau (SmartBoard) de l'invité tombe sur du noir.
const STAGE_BG = '#1f1e1c';
const PANEL_BG = 'rgba(48,48,46,0.97)';
const PANEL_BORDER = '1px solid rgba(245,244,238,0.1)';

export default function ProcheRoom() {
  const { id: sessionId, inviteId } = useParams<{ id: string; inviteId: string }>();
  const [status, setStatus] = useState<ProcheStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [conn, setConn] = useState<{ url: string; token: string } | null>(null);
  const [joining, setJoining] = useState(false);
  // Green room : l'invité choisit caméra/micro AVANT de rejoindre.
  const [joinWithCam, setJoinWithCam] = useState(true);
  const [joinWithMic, setJoinWithMic] = useState(true);
  const [previewOn, setPreviewOn] = useState(false);
  const [clinicLogo, setClinicLogo] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const slug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant') : null;

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

  // Signal « présent sur le lien » : tant que l'invité patiente sur l'écran
  // d'autorisation (consent_requested), il DIFFUSE sa demande → le host/patient
  // n'affichent le bandeau/la modale d'admission QUE maintenant (plus jamais à la
  // simple création du lien). S'arrête dès qu'il est autorisé / refusé / rejoint.
  useBroadcastJoinRequest(sessionId, inviteId, !conn && status?.status === 'consent_requested');

  // Logo de la clinique (branding public par slug) pour l'écran d'accueil.
  useEffect(() => {
    if (!slug) return undefined;
    let alive = true;
    fetch(`${getApiBaseUrl()}/tenants/by-slug/${encodeURIComponent(slug)}/branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { const logo = j?.data?.logo_url || j?.logo_url || null; if (alive && logo) setClinicLogo(String(logo)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  const ready = status && (status.status === 'consented' || status.status === 'admitted');

  // Aperçu caméra (green room) : uniquement à l'écran d'accueil, quand autorisé +
  // caméra voulue. On libère la piste dès qu'on coupe la caméra ou qu'on rejoint.
  useEffect(() => {
    if (!ready || conn || !joinWithCam) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setPreviewOn(false);
      return undefined;
    }
    let alive = true;
    navigator.mediaDevices?.getUserMedia?.({ video: true, audio: false })
      .then((stream) => {
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPreviewOn(true);
      })
      .catch(() => { if (alive) setPreviewOn(false); });
    return () => { alive = false; };
  }, [ready, conn, joinWithCam]);

  // Libère la caméra d'aperçu au démontage.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // (Re)attache le flux au <video> dès qu'il est prêt (évite l'écran noir si la
  // piste arrive avant le montage de l'élément).
  useEffect(() => {
    if (videoRef.current && streamRef.current && previewOn) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play?.().catch(() => {});
    }
  }, [previewOn]);

  const join = async () => {
    if (!inviteId) return;
    requestAppFullscreen();
    // Libère la caméra d'aperçu pour que LiveKit la reprenne proprement.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
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
    return <ProcheLiveRoom url={conn.url} token={conn.token} sessionId={sessionId} inviteId={inviteId} clinic={status?.clinic_name} initialCam={joinWithCam} initialMic={joinWithMic} />;
  }

  const clinicName = status?.clinic_name || null;
  const guestName = status?.display_name || null;

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: BG, backgroundImage: PAGE_MESH, display: 'grid', placeItems: 'center', padding: 24, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* En-tête de marque : logo LIRI + pastille clinique (logo + nom). */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <img src="/lirilogo.png" alt="LIRI" style={{ height: 38, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 10px rgba(212,163,106,0.4))' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '6px 13px 6px 8px', borderRadius: 999, background: PANEL_BG, border: PANEL_BORDER }}>
            {clinicLogo ? <img src={clinicLogo} alt="" style={{ height: 22, width: 'auto', maxWidth: 70, objectFit: 'contain', borderRadius: 5 }} /> : null}
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f4ee' }}>{clinicName || 'Consultation'}</span>
          </div>
        </div>

        {/* Carte centrale frostée. */}
        <div style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: 20, padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,0.5)', textAlign: 'center' }}>
          {err ? (
            <Gate tone="error" title="Accès indisponible" text={err} />
          ) : !status ? (
            <Gate spinner title="Chargement…" text="Vérification de votre invitation." />
          ) : status.session_status === 'ended' || status.session_status === 'cancelled' ? (
            <Gate title="Consultation terminée" text="Cette téléconsultation est terminée. Vous pouvez fermer cette fenêtre." />
          ) : status.status === 'consent_requested' ? (
            <Gate spinner title="En attente d'autorisation" text={`${guestName ? `${guestName}, votre` : 'Votre'} participation doit être autorisée par le patient. Cette page se met à jour automatiquement.`} />
          ) : status.status === 'denied' ? (
            <Gate tone="error" title="Accès refusé" text="Le patient n'a pas autorisé votre participation à la consultation." />
          ) : status.status === 'revoked' ? (
            <Gate tone="error" title="Invitation révoquée" text="Cette invitation n'est plus valable." />
          ) : ready ? (
            <div>
              <p style={{ margin: '0 0 3px', fontSize: 13, color: GOLD, fontWeight: 600 }}>
                {guestName ? `Bonjour ${guestName}` : 'Bienvenue'}
              </p>
              <h2 style={{ margin: '0 0 16px', fontSize: 19, color: '#fff', fontWeight: 700 }}>Prêt·e à rejoindre ?</h2>

              {/* Green room : aperçu caméra + réglages micro/caméra. */}
              <div style={{ aspectRatio: '4 / 3', borderRadius: 16, overflow: 'hidden', background: STAGE_BG, border: PANEL_BORDER, position: 'relative', marginBottom: 14 }}>
                {joinWithCam ? (
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                ) : null}
                {(!joinWithCam || !previewOn) ? (
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#9a978f' }}>
                    <div style={{ textAlign: 'center' }}>
                      <VideoOff size={26} aria-hidden="true" style={{ opacity: 0.7 }} />
                      <p style={{ margin: '6px 0 0', fontSize: 12 }}>{joinWithCam ? 'Activation de la caméra…' : 'Caméra désactivée'}</p>
                    </div>
                  </div>
                ) : null}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 10, display: 'flex', justifyContent: 'center', gap: 10 }}>
                  <button type="button" onClick={() => setJoinWithMic((v) => !v)} title={joinWithMic ? 'Couper le micro' : 'Activer le micro'} style={greenRoomToggle(joinWithMic)}>
                    {joinWithMic ? <Mic size={17} aria-hidden="true" /> : <MicOff size={17} aria-hidden="true" />}
                  </button>
                  <button type="button" onClick={() => setJoinWithCam((v) => !v)} title={joinWithCam ? 'Couper la caméra' : 'Activer la caméra'} style={greenRoomToggle(joinWithCam)}>
                    {joinWithCam ? <Video size={17} aria-hidden="true" /> : <VideoOff size={17} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.5, display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <ShieldCheck size={14} color={GOLD} aria-hidden="true" /> Participation autorisée par le patient · Liaison sécurisée
              </p>

              <button type="button" onClick={join} disabled={joining}
                style={{ width: '100%', padding: '13px 22px', borderRadius: 12, border: 'none', cursor: joining ? 'default' : 'pointer', background: GOLD, color: '#1a1a1a', fontSize: 15, fontWeight: 700, opacity: joining ? 0.6 : 1 }}>
                {joining ? 'Connexion…' : 'Rejoindre la consultation'}
              </button>
            </div>
          ) : (
            <Gate spinner title="Patientez…" text="Préparation de la consultation." />
          )}
        </div>

        {/* Footer de confiance. */}
        <p style={{ margin: '16px 0 0', textAlign: 'center', fontSize: 11.5, color: 'rgba(245,244,238,0.45)' }}>
          🔒 Liaison sécurisée · propulsé par LIRI
        </p>
      </div>
      <style>{'@keyframes lk-spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

// Bouton rond de la green room (caméra/micro). Actif = clair ; coupé = rouge.
function greenRoomToggle(active: boolean): CSSProperties {
  return {
    width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'rgba(255,255,255,0.18)' : '#b1372f',
    color: '#fff', WebkitBackdropFilter: 'blur(6px)', backdropFilter: 'blur(6px)',
  };
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
function ProcheLiveRoom({ url, token, sessionId, inviteId, clinic, initialCam = true, initialMic = true }: { url: string; token: string; sessionId: string; inviteId?: string; clinic?: string; initialCam?: boolean; initialMic?: boolean }) {
  // Le proche SUIT la vue/scène/annotation pilotées par le praticien (read-only).
  const channel = useCockpitChannel(sessionId, 'patient');
  const [left, setLeft] = useState(false);
  // Expulsé par l'hôte (modération) → LiveKit déconnecte avec ce motif ; on montre
  // un écran clair au lieu de laisser la salle figée.
  const [kicked, setKicked] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // Fin de session pilotée par le PRATICIEN : l'invité doit sortir tout seul
  // quand l'hôte coupe le live (sinon il reste connecté « dans le vide »). Le
  // patient (ConsultationRoom) s'abonne à live_sessions ; l'invité (anon, pas
  // d'accès RLS) POLL le statut public de son invitation (session_status).
  useEffect(() => {
    if (!inviteId) return undefined;
    let alive = true;
    const check = () =>
      getProcheStatus(inviteId)
        .then((s) => {
          if (alive && (s.session_status === 'ended' || s.session_status === 'cancelled')) setLeft(true);
        })
        .catch(() => {});
    const t = setInterval(check, 3000);
    void check();
    return () => { alive = false; clearInterval(t); };
  }, [inviteId]);
  // Mode focus (partage immersif) : remonté de ConsultationStage → masque la barre.
  const [immersive, setImmersive] = useState(false);
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
  if (kicked) return <CallEndedScreen title="Vous avez été retiré" text="L'hôte vous a retiré·e de la consultation. Vous pouvez fermer cette fenêtre." />;
  if (left) return <CallEndedScreen />;
  const content = (
    <div
      data-lk-theme="default"
      className="consult-shell"
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483000, background: BG, display: 'flex', flexDirection: 'column',
        // Vars shell LIRI : SANS elles, var(--lh-stage-bg) du Tableau (SmartBoard)
        // partagé tombait sur du noir chez l'invité (carreaux invisibles).
        '--lh-page-bg': BG,
        '--lh-stage-bg': TILE_BG,
        '--lh-panel-bg': PANEL_BG,
        '--lh-strip-bg': BAR,
        '--lh-accent': GOLD,
      } as CSSProperties}
    >
      <style>{CONSULT_SHELL_CSS}</style>
      <LiveKitRoom serverUrl={url} token={token} connect audio={initialMic} video={initialCam}
        onDisconnected={(reason) => { if (reason === DisconnectReason.PARTICIPANT_REMOVED) setKicked(true); }}
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <ProcheChrome />
            <ConsultationStage
              view={channel.view}
              isHost={false}
              scene={channel.scene}
              strokes={channel.strokes}
              editable={false}
              onStrokes={() => {}}
              smartboard={channel.smartboard}
              sessionId={sessionId}
              identity={{ logo: clinicLogo, label: clinic ?? null, name: channel.hostName }}
              onImmersiveChange={setImmersive}
              explain={channel.explain}
              onExplain={async () => {
                // Invité : explication LOCALE (self-service) de ce qui est affiché.
                const sc = channel.scene as any;
                const r = await explainSharedScene({ scene: sc, kind: sc?.kind || '', focus: sc?.focus || undefined });
                return { title: r.title, text: r.explanation };
              }}
            />
            {/* Mode focus → barre masquée (montée pour ne pas couper micro/caméra). */}
            <div style={{ display: immersive ? 'none' : 'contents' }}>
              <ProcheBar onLeave={() => setLeft(true)} chatOpen={chatOpen} onToggleChat={() => setChatOpen((v) => !v)} />
            </div>
          </div>
          {/* Toujours monté (masqué via `open`) : préserve l'historique useChat
              et capte les messages reçus panneau fermé. */}
          <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
        </div>
        <RoomAudioRenderer />
        <AudioUnlockGate />
      </LiveKitRoom>
      {/* Sous-titres traduits (invité) : sélecteur de langue + overlay. */}
      <ParticipantCaptions channel={channel} />
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

function ProcheChrome() {
  // ≤820px : en-tête compacte — titre = nom de la clinique SEUL (plus de « Consultation »),
  // calibres réduits, « Proche invité » → icône seule, « En direct » → pastille seule.
  const compact = useMatchMediaAtMost(820);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 7 : 10, padding: compact ? '7px 11px' : '10px 16px', background: BAR, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Logo LIRI (mark officiel, même que login/boot) — image de marque. */}
      <img
        src="/lirilogo.png"
        alt="LIRI"
        style={{ height: compact ? 20 : 24, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(212,163,106,0.32))', flexShrink: 0 }}
      />
      {/* Titre = « LIRI » (le nom de la clinique est déjà en badge sur la vidéo
          du praticien → inutile de le répéter ici). */}
      <span style={{ fontWeight: 600, fontSize: compact ? 12.5 : 14, whiteSpace: 'nowrap', flexShrink: 0 }}>LIRI</span>
      <span
        title="Proche invité"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: compact ? 11 : 12, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', padding: compact ? '3px 6px' : '3px 9px', borderRadius: 999, flexShrink: 0 }}
      >
        <ShieldCheck size={compact ? 12 : 13} aria-hidden="true" /> {compact ? null : 'Proche invité'}
      </span>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#f87171', fontSize: 12.5, flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} /> {compact ? null : 'En direct'}
      </span>
    </div>
  );
}

function ProcheBar({ onLeave, chatOpen, onToggleChat }: { onLeave: () => void; chatOpen: boolean; onToggleChat: () => void }) {
  const room = useRoomContext();
  // Mobile : boutons du pied de page en ICÔNES SEULES (les libellés prenaient
  // trop de place). Libellés conservés sur ordinateur.
  const compact = useMatchMediaAtMost(820);
  const [fs, setFs] = useState(typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
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
      <button
        onClick={toggleAppFullscreen}
        aria-pressed={fs}
        aria-label={fs ? 'Quitter le plein ecran' : 'Plein ecran'}
        title={fs ? 'Quitter le plein ecran' : 'Plein ecran'}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, borderRadius: 9, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#fff' }}
      >
        {fs ? <Minimize size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
      </button>
      <TrackToggle source={Track.Source.Microphone} showIcon title="Micro">
        {compact ? null : 'Micro'}
      </TrackToggle>
      <TrackToggle source={Track.Source.Camera} showIcon title="Caméra">
        {compact ? null : 'Caméra'}
      </TrackToggle>
      {/* Lever la main → le praticien voit un badge ✋ sur votre vignette. */}
      <RaiseHandButton compact={compact} />
      <button
        onClick={onToggleChat}
        aria-pressed={chatOpen}
        title="Discussion"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: compact ? 0 : 6, width: compact ? 40 : undefined, height: 38, padding: compact ? 0 : '8px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', background: chatOpen ? GOLD : 'rgba(255,255,255,0.1)', color: chatOpen ? '#1a1a1a' : '#fff', fontSize: 13, fontWeight: 600 }}
      >
        <MessageSquare size={15} aria-hidden="true" /> {compact ? null : 'Discussion'}
      </button>
      <button
        onClick={leave}
        title="Quitter"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: compact ? 0 : 6, width: compact ? 40 : undefined, height: 38, padding: compact ? 0 : '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', background: '#b1372f', color: '#fff', fontSize: 13, fontWeight: 600 }}
      >
        <PhoneOff size={16} aria-hidden="true" /> {compact ? null : 'Quitter'}
      </button>
    </div>
  );
}
