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
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useChat,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import { Stethoscope, PhoneOff, Share2, Pencil, Users, Presentation, MonitorUp, Eraser, UserPlus, Copy, Check, ShieldCheck, X, MessageSquare, Send, Sparkles, Brain, Music2, Play, Pause } from 'lucide-react';
import { createPortal } from 'react-dom';
import '@livekit/components-styles';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { teleconsultApi, type TeleconsultInvite } from '@/lib/api';
import { getApiBaseUrl } from '@/lib/apiBase';
import { getClinicalContext, type ClinicalContext, type CockpitScene } from '@/features/medos-cockpit/cockpit-api';
import { useCockpitChannel, type AnnotStroke, type ConsultView } from '@/features/medos-cockpit/useCockpitChannel';
import { SharedSceneView, CockpitDock } from '@/features/medos-cockpit/MedTeleconsultCockpit';
import { AnnotationOverlay } from '@/features/medos-cockpit/AnnotationOverlay';
import ImmersiveBootLoader from '@/components/liri/ImmersiveBootLoader';
// ── Briques de la salle de téléconsultation (features/consultation-stage) ─────
import AmbientAudioEngine, { useAmbientAudio } from '@/features/consultation-stage/AmbientAudioEngine';
import ConsultationSettings, { ConsultationSettingsButton } from '@/features/consultation-stage/ConsultationSettings';
import ConsultationSmartBoard from '@/features/consultation-stage/ConsultationSmartBoard';
import ConsultationCopilot from '@/features/consultation-stage/ConsultationCopilot';
import ConsultationRecall from '@/features/consultation-stage/ConsultationRecall';
import WaitingRoom from '@/features/consultation-stage/WaitingRoom';
import { useVideoProcessor } from '@/lib/useVideoProcessor';

// Shell visuel ALIGNÉ SUR LE PORTAIL LIRI (cf. liveHostTheme `LH_DESIGN`) : base
// chaude #262624 + halos coral, panneaux frostés, accent AMBRE #d4a36a — fini le
// #0b0b0c plat + le gold ISNA (directive artistique : tout chaud, fonds emboîtés).
const BG = '#262624'; // --lh-page-bg
const PAGE_MESH =
  'radial-gradient(ellipse 85% 55% at 50% -15%, rgba(217,119,87,0.06), transparent 58%), radial-gradient(ellipse 55% 40% at 100% 85%, rgba(226,85,63,0.05), transparent 52%), radial-gradient(ellipse 45% 32% at 0% 75%, rgba(194,104,63,0.04), transparent 48%)';
const BAR = 'rgba(43,41,38,0.96)'; // --lh-strip-bg (barres haut/bas)
const GOLD = '#d4a36a'; // --lh-accent (ambre chaud LIRI ; n'est plus du gold)
const TILE_BG = '#1f1e1c'; // --lh-stage-bg (tuiles vidéo / scène)
const PANEL_BG = 'rgba(48,48,46,0.97)'; // --lh-panel-bg (panneaux frostés chauds)
const PANEL_BORDER = '1px solid rgba(245,244,238,0.09)'; // filet ivoire discret

// ── Carreaux du TABLEAU + fond chaud, SCOPÉS à la consultation ──────────────────
// Le SmartBoard (SCENE_STAGE_GRID) peint `bg-[var(--lh-stage-bg)]` + une grille
// BLANCHE à 0.045 (quasi invisible). En consultation, on court-circuite
// LiveHostPage → la var n'est PAS posée → centre NOIR + carreaux invisibles. Ici
// on (a) repose la var sur la racine `.consult-shell` (cf. style root) ET (b)
// repeint la scène en #1f1e1c chaud + un VRAI quadrillage AMBRE lisible (cahier
// quadrillé : carreaux 40px + repères 200px), puis on retire le voile noir du
// tableau pour que les carreaux le traversent. Préfixé `.consult-shell` → Formation
// (LiveHostPage, hors de ce scope) reste INTACTE.
const CONSULT_SHELL_CSS = `
.consult-shell [class*="lh-stage-bg"]{
  background-color:#1f1e1c !important;
  background-image:
    linear-gradient(rgba(212,163,106,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(212,163,106,0.07) 1px, transparent 1px),
    linear-gradient(rgba(212,163,106,0.13) 1px, transparent 1px),
    linear-gradient(90deg, rgba(212,163,106,0.13) 1px, transparent 1px) !important;
  background-size:40px 40px,40px 40px,200px 200px,200px 200px !important;
  background-position:center center !important;
}
.consult-shell [class*="bg-black/25"][class*="ring-inset"]{ background-color:transparent !important; }
/* Guide/aide verbeux du rail tableau (raccourcis, descriptions) : inutile en
   téléconsult, mange l'espace → masqué. Les outils fonctionnels restent. Les
   attributs data-wb-guide ne font RIEN hors de ce scope (Formation intacte). */
.consult-shell [data-wb-guide]{ display:none !important; }
`;

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
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [clinicLogo, setClinicLogo] = useState<string | null>(null);
  // Salle d'attente patient : `ctxResolved` = le contexte a répondu (ou échoué) ;
  // `joinCam/joinMic` = choix de la green room, portés ensuite dans la salle.
  const [ctxResolved, setCtxResolved] = useState(false);
  const [joinCam, setJoinCam] = useState(true);
  const [joinMic, setJoinMic] = useState(true);
  // Studio (réglés en salle d'attente, REPORTÉS dans l'appel via CallVideoFx).
  // `?fx=blur|nature|...` force le détourage (utile pour prévisualiser côté hôte).
  const [camId, setCamId] = useState('');
  const [micId, setMicId] = useState('');
  const [detourage, setDetourage] = useState<string>(() => {
    try { return new URLSearchParams(window.location.search).get('fx') || 'none'; } catch { return 'none'; }
  });
  const [beauty, setBeauty] = useState(false);

  // Nom de la clinique (image de marque sur l'écran de démarrage) — résolu ICI
  // (composant long-vécu = effet fiable) puis caché en localStorage + passé à
  // ImmersiveBootLoader. Le branding public est token-libre.
  useEffect(() => {
    const slug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant') : null;
    if (!slug) return undefined;
    let alive = true;
    fetch(`${getApiBaseUrl()}/tenants/by-slug/${encodeURIComponent(slug)}/branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const logo = j?.data?.logo_url || j?.logo_url || null;
        if (logo) {
          if (alive) setClinicLogo(String(logo));
          try { localStorage.setItem(`liri:cliniclogo:${slug}`, String(logo)); } catch { /* ignore */ }
        }
        const n = j?.data?.name || j?.name;
        if (!n) return;
        try {
          localStorage.setItem(`liri:clinic:${slug}`, String(n));
        } catch {
          /* ignore */
        }
        if (alive) setClinicName(String(n));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 1) Contexte clinique (rôle + nom + heure RDV + agenda + host_present). On le
  //    RAFRAÎCHIT tant qu'on n'est pas connecté → le patient en salle d'attente
  //    détecte l'arrivée du praticien (host_present) et bascule automatiquement.
  useEffect(() => {
    if (!sessionId || !user?.id) return undefined;
    let alive = true;
    const fetchCtx = () =>
      getClinicalContext(sessionId)
        .then((c) => { if (alive) { setCtx(c); setCtxResolved(true); } })
        .catch(() => { if (alive) setCtxResolved(true); });
    fetchCtx();
    const t = setInterval(() => { if (!conn) fetchCtx(); }, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [sessionId, user?.id, conn]);

  // 2) Connexion LiveKit. L'HÔTE se connecte tout de suite. Le PATIENT ne se
  //    connecte QUE lorsque le praticien a démarré (host_present) — sinon il reste
  //    en salle d'attente. Repli SÛR : si le contexte échoue, on ne bloque pas
  //    (ancien comportement = connexion directe).
  // On ne GATE le patient que si le backend dit EXPLICITEMENT host_present===false.
  // Si le champ est absent (backend pas à jour) ou true → on connecte (pas de
  // blocage). L'hôte se connecte toujours.
  const canConnect =
    ctxResolved &&
    (!ctx || ctx.role === 'host' || ctx.host_present !== false);
  useEffect(() => {
    if (!sessionId || conn || !canConnect) return undefined;
    let alive = true;
    (async () => {
      try {
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
    return () => { alive = false; };
  }, [sessionId, conn, canConnect]);

  const isHost = ctx?.role === 'host';
  // Canal de partage au niveau de la salle : pilote la VUE + la SCÈNE centrale +
  // l'annotation. Un seul abonnement, partagé avec le cockpit (sinon les 2 ne se
  // voient pas, broadcast self:false).
  const channel = useCockpitChannel(sessionId ?? null, isHost ? 'host' : 'patient');
  const { view, scene, strokes } = channel;

  // ── Identité praticien (image de marque + « avec qui je parle ») ──────────────
  // Le host tient son nom de son profil auth et le DIFFUSE au patient (canal
  // cockpit) ; le patient le LIT depuis ce canal. Logo + nom de clinique : chaque
  // côté les résout localement par slug (branding public, fetché plus haut).
  // Repli PROPRE : si le profil n'a pas de nom d'affichage, on montre « Praticien »
  // (pas l'email brut) — le patient/proche voit « <clinique> · Praticien ».
  const hostDisplayName = isHost
    ? ((user?.user_metadata as any)?.full_name || (user?.user_metadata as any)?.name || 'Praticien')
    : null;
  useEffect(() => {
    if (isHost && conn && hostDisplayName) channel.shareHostName(hostDisplayName);
  }, [isHost, conn, hostDisplayName, channel.shareHostName]);
  const practitionerName = isHost ? hostDisplayName : channel.hostName;
  // Badge ASYMÉTRIQUE — chacun voit l'AUTRE : le praticien voit le nom du PATIENT
  // (avec qui il parle) ; le patient/proche voit le LOGO + NOM de l'organisation +
  // le praticien.
  const consultIdentity: ConsultIdentity = isHost
    ? { logo: null, label: ctx?.sex === 'female' ? 'Patiente' : 'Patient', name: ctx?.patient_name || null }
    : { logo: clinicLogo, label: clinicName, name: practitionerName };

  const [annotate, setAnnotate] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [left, setLeft] = useState(false);
  // Panneau de droite : un seul ouvert à la fois (façon appel vidéo).
  //   null | 'chat' | 'copilot' | 'recall'
  const [rightPanel, setRightPanel] = useState<'chat' | 'copilot' | 'recall' | null>(null);
  // Réglages : popover ancré au-dessus de la barre. Le fond sonore est logé dans
  // ce panneau (contrôleur partagé avec la pastille flottante autonome).
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Contrôleur d'ambiance partagé : piloté DANS le panneau Réglages ET reflété par
  // la pastille flottante (host) — même état audio des deux côtés.
  const ambient = useAmbientAudio();
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

  // Aperçu de la salle d'attente (le praticien peut voir ce que voit le patient) :
  // /teleconsult/:id?preview=lobby — données réelles si dispo, sinon exemple.
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'lobby') {
    return (
      <WaitingRoom
        clinicName={clinicName}
        clinicLogo={clinicLogo}
        patientName={ctx?.patient_name || 'Marie Dupont'}
        practitionerName={practitionerName}
        scheduledAt={ctx?.scheduled_at || new Date(Date.now() + 8 * 60000).toISOString()}
        agendaReason={ctx?.agenda_reason || 'Suivi · bilan de santé'}
        agendaNotes={ctx?.agenda_notes || 'Revoir les résultats récents et ajuster le programme.'}
        joinCam={joinCam}
        joinMic={joinMic}
        onToggleCam={() => setJoinCam((v) => !v)}
        onToggleMic={() => setJoinMic((v) => !v)}
        camId={camId}
        micId={micId}
        detourage={detourage}
        beauty={beauty}
        onCamId={setCamId}
        onMicId={setMicId}
        onDetourage={setDetourage}
        onBeauty={setBeauty}
      />
    );
  }

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
    // Patient arrivé AVANT le praticien → salle d'attente (compte à rebours +
    // agenda + musique + green room). Bascule auto via le poll de host_present.
    if (ctxResolved && ctx?.role === 'patient' && ctx?.host_present === false) {
      return (
        <WaitingRoom
          clinicName={clinicName}
          clinicLogo={clinicLogo}
          practitionerName={channel.hostName}
          patientName={ctx?.patient_name}
          scheduledAt={ctx?.scheduled_at}
          agendaReason={ctx?.agenda_reason}
          agendaNotes={ctx?.agenda_notes}
          joinCam={joinCam}
          joinMic={joinMic}
          onToggleCam={() => setJoinCam((v) => !v)}
          onToggleMic={() => setJoinMic((v) => !v)}
          camId={camId}
          micId={micId}
          detourage={detourage}
          beauty={beauty}
          onCamId={setCamId}
          onMicId={setMicId}
          onDetourage={setDetourage}
          onBeauty={setBeauty}
        />
      );
    }
    return (
      <ImmersiveBootLoader
        clinic={clinicName}
        message={user?.id ? 'Connexion sécurisée à votre consultation' : 'Authentification sécurisée…'}
      />
    );
  }

  if (left) return <CallEndedScreen />;

  const content = (
    <div
      data-lk-theme="default"
      className="consult-shell"
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483000,
        background: BG, backgroundImage: PAGE_MESH,
        display: 'flex', flexDirection: 'column',
        // Variables shell LIRI : SANS elles, var(--lh-stage-bg) du SmartBoard
        // tombait sur du noir (centre vide). Posées ici → tout le sous-arbre hérite.
        '--lh-page-bg': BG,
        '--lh-stage-bg': TILE_BG,
        '--lh-panel-bg': PANEL_BG,
        '--lh-strip-bg': BAR,
        '--lh-accent': GOLD,
      } as CSSProperties}
    >
      <style>{CONSULT_SHELL_CSS}</style>
      <LiveKitRoom
        serverUrl={conn.url}
        token={conn.token}
        connect
        audio={joinMic}
        video={joinCam}
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        {/* Studio reporté : périphériques + détourage + maquillage sur le flux publié. */}
        <CallVideoFx camId={camId} micId={micId} detourage={detourage} beauty={beauty} />
        {/* Corps : colonne principale (chrome + scène + barre) + panneau de
            droite (discussion / copilote / récap), façon appel vidéo. */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
              sessionId={sessionId ?? null}
              rightOpen={rightPanel !== null}
              identity={consultIdentity}
            />
            {/* Wrapper positionné : ancre le popover Réglages au-dessus de la barre
                (reste DANS <LiveKitRoom> → ConsultationSettings lit le contexte salle). */}
            <div style={{ position: 'relative' }}>
              <ConsultationSettings
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                showAmbientSection
              >
                {/* Fond sonore piloté inline dans le panneau Réglages. */}
                <AmbientInlineControls ctl={ambient} />
              </ConsultationSettings>
              <ConsultationBar
                isHost={isHost}
                annotatable={annotatable}
                annotate={annotate}
                onToggleAnnotate={() => setAnnotate((v) => !v)}
                hasStrokes={strokes.length > 0}
                onClearStrokes={channel.clearStrokes}
                onInvite={() => setInviteOpen(true)}
                onLeave={handleLeave}
                rightPanel={rightPanel}
                onToggleChat={() => setRightPanel((p) => (p === 'chat' ? null : 'chat'))}
                onToggleCopilot={() => setRightPanel((p) => (p === 'copilot' ? null : 'copilot'))}
                onToggleRecall={() => setRightPanel((p) => (p === 'recall' ? null : 'recall'))}
                settingsOpen={settingsOpen}
                onToggleSettings={() => setSettingsOpen((v) => !v)}
              />
            </div>
          </div>
          {/* Panneau de droite — un seul ouvert à la fois. */}
          {rightPanel === 'chat' ? <ChatPanel onClose={() => setRightPanel(null)} /> : null}
          {rightPanel === 'copilot' && isHost ? (
            <CopilotPanel sessionId={sessionId} onClose={() => setRightPanel(null)} />
          ) : null}
          {rightPanel === 'recall' && isHost && sessionId ? (
            <ConsultationRecall sessionId={sessionId} patientName={ctx?.patient_name} onClose={() => setRightPanel(null)} />
          ) : null}
        </div>
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
      {/* Fond sonore — pastille flottante autonome (praticien), pilotée par le même
          contrôleur que le panneau Réglages. */}
      {isHost ? <AmbientAudioEngine controller={ambient} /> : null}
    </div>
  );
  // Plein écran : portal vers <body> pour échapper à tout ancêtre containing-block
  // (sinon position:fixed reste contraint sous le header tenant).
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

// Reporte les réglages STUDIO (caméra/micro + détourage + maquillage) sur le flux
// PUBLIÉ : `switchActiveDevice` + `useVideoProcessor` (segmentation → republie un
// canvas traité sur le track Camera). Rendu DANS <LiveKitRoom>. Inerte si
// détourage='none' && !beauty (le processor no-op).
function CallVideoFx({ camId, micId, detourage, beauty }: { camId: string; micId: string; detourage: string; beauty: boolean }) {
  const room = useRoomContext();
  const connState = useConnectionState();
  // useVideoProcessor.start() exige une salle CONNECTÉE et son effet ne se relance
  // pas à la connexion → on n'ACTIVE le traitement (needsCanvas) qu'une fois
  // connecté (sinon il démarre trop tôt et abandonne).
  const connected = connState === ConnectionState.Connected;
  const roomRef = useRef<any>(room);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => {
    if (!connected) return;
    const r = roomRef.current;
    if (!r) return;
    (async () => {
      try { if (camId) await r.switchActiveDevice('videoinput', camId); } catch { /* ignore */ }
      try { if (micId) await r.switchActiveDevice('audioinput', micId); } catch { /* ignore */ }
    })();
  }, [connected, camId, micId]);
  const fx = connected ? detourage : 'none';
  const videoBlur = fx === 'blur';
  const videoVbg = (fx === 'none' || fx === 'blur') ? 'none' : fx;
  useVideoProcessor(roomRef, { chromaKey: false, videoBlur, videoVbg, beauty: connected ? beauty : false });
  return null;
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: BAR, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Logo LIRI (mark officiel, même que login/boot) — image de marque du shell. */}
      <img
        src="/lirilogo.png"
        alt="LIRI"
        style={{ height: 26, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(212,163,106,0.32))', flexShrink: 0 }}
      />
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

// ── Face-à-face (appel vidéo) : grand plan + mini-cartes cliquables ───────────
// Clé STABLE d'un flux (indépendante de la position grand/mini) = identité + source.
function stableTrackKey(t: any): string {
  return `${t?.participant?.identity || 'p'}:${t?.source || 's'}`;
}

export type ConsultIdentity = {
  /** Logo de l'organisation (côté patient/proche). Absent côté praticien. */
  logo?: string | null;
  /** Petite ligne du haut : nom de l'organisation, ou « Patient ». */
  label?: string | null;
  /** Grande ligne : nom du praticien (côté patient) ou du patient (côté praticien). */
  name?: string | null;
};

// Lower-third d'identité ASYMÉTRIQUE — chacun voit l'AUTRE : le praticien voit le
// nom du patient ; le patient/proche voit le logo + nom de l'organisation + le
// praticien. Transparent, posé sur la vidéo (vue Conversation).
function ConsultIdentityBadge({ identity }: { identity?: ConsultIdentity }) {
  if (!identity) return null;
  const { logo, label, name } = identity;
  if (!logo && !label && !name) return null;
  return (
    <div style={{ position: 'absolute', left: 16, bottom: 16, zIndex: 2, display: 'flex', alignItems: 'center', gap: 11, padding: '8px 15px 8px 10px', borderRadius: 14, background: 'rgba(20,19,18,0.42)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(245,244,238,0.14)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', pointerEvents: 'none', maxWidth: '72%' }}>
      {logo ? (
        <img src={logo} alt="" style={{ height: 32, width: 'auto', maxWidth: 92, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }} />
      ) : (
        <span style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,244,238,0.1)', color: GOLD }}>
          <Users size={17} aria-hidden="true" />
        </span>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
        {label ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(245,244,238,0.72)', letterSpacing: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        ) : null}
        {name ? (
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        ) : null}
      </div>
    </div>
  );
}

function FaceToFace({ tracks, identity }: { tracks: any[]; identity?: ConsultIdentity }) {
  const cams = tracks.filter((t) => t?.source === Track.Source.Camera);
  const screen = tracks.find((t) => t?.source === Track.Source.ScreenShare && t?.publication);
  const local = cams.find((t) => t?.participant?.isLocal) || null;
  const remotes = cams.filter((t) => !t?.participant?.isLocal);
  // Quel flux est au GRAND plan (clic d'une mini-carte). null = défaut.
  const [featuredKey, setFeaturedKey] = useState<string | null>(null);

  // Ordre par défaut du grand plan : partage d'écran > interlocuteur > soi.
  const ordered = [screen, ...remotes, local].filter(Boolean) as any[];
  const hasOther = !!screen || remotes.length > 0;
  // Seul (aucun interlocuteur) : le grand plan reste un placeholder « en attente »
  // et SOI passe en mini-carte (retour de vue), comme WhatsApp.
  const defaultBig = hasOther ? ordered[0] : null;
  const featured = featuredKey ? ordered.find((t) => stableTrackKey(t) === featuredKey) : null;
  const big = featured || defaultBig;
  // SOI est TOUJOURS visible : en grand si featuré, sinon en mini-carte.
  const minis = ordered.filter((t) => t !== big);

  return (
    <div className="consult-f2f" style={{ position: 'relative', height: '100%', borderRadius: 18, overflow: 'hidden', background: TILE_BG, border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Masque l'étiquette de nom LiveKit par défaut sur les tuiles (redondante
          avec le badge d'identité ; l'indicateur micro reste visible). */}
      <style>{`.consult-f2f .lk-participant-name{display:none!important}`}</style>
      {/* Grand plan (clic → réduire au plan par défaut). */}
      {big ? (
        <div
          onClick={() => setFeaturedKey(null)}
          title="Cliquer pour revenir à l'interlocuteur"
          style={{ position: 'absolute', inset: 0, cursor: featured ? 'zoom-out' : 'default' }}
        >
          <ParticipantTile trackRef={big} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <span style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '9px 18px', borderRadius: 999, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD }} /> En attente de votre interlocuteur…
          </span>
        </div>
      )}

      {/* Mini-cartes (dont SOI = retour de vue) en bas à droite — clic pour agrandir. */}
      {minis.length > 0 ? (
        <div style={{ position: 'absolute', right: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2 }}>
          {minis.map((t) => {
            const isSelf = !!t?.participant?.isLocal;
            return (
              <div
                key={stableTrackKey(t)}
                role="button"
                tabIndex={0}
                onClick={() => setFeaturedKey(stableTrackKey(t))}
                title="Cliquer pour agrandir"
                style={{ position: 'relative', width: 208, aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', background: '#000', border: '2px solid rgba(255,255,255,0.28)', boxShadow: '0 12px 34px rgba(0,0,0,0.55)', cursor: 'pointer' }}
              >
                <ParticipantTile trackRef={t} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
                {isSelf ? (
                  <span style={{ position: 'absolute', left: 7, top: 7, fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '2px 7px', borderRadius: 999, pointerEvents: 'none' }}>Vous</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Image de marque : logo tenant + nom praticien (transparent, sur la vidéo). */}
      <ConsultIdentityBadge identity={identity} />
    </div>
  );
}

// ── Panneau de discussion écrite (chat natif LiveKit, en direct) ─────────────
function fmtChatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const { chatMessages, send, isSending } = useChat();
  const { localParticipant } = useLocalParticipant();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || isSending) return;
    send(t).catch(() => {});
    setText('');
  };

  return (
    <div style={{ width: 340, flexShrink: 0, background: PANEL_BG, borderLeft: PANEL_BORDER, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <MessageSquare size={16} color={GOLD} aria-hidden="true" />
        <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Discussion</span>
        <button onClick={onClose} aria-label="Fermer la discussion" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'inline-flex' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {chatMessages.length === 0 ? (
          <p style={{ margin: 'auto', textAlign: 'center', fontSize: 12.5, color: '#6b7280', maxWidth: 240, lineHeight: 1.5 }}>
            Aucun message. Écrivez ici pendant la consultation — visible par tous les participants.
          </p>
        ) : (
          chatMessages.map((m, i) => {
            const mine = m.from?.identity === localParticipant?.identity;
            return (
              <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%' }}>
                {!mine ? (
                  <div style={{ fontSize: 11, color: '#9ca3af', margin: '0 4px 2px' }}>{m.from?.name || m.from?.identity || 'Invité'}</div>
                ) : null}
                <div style={{ background: mine ? GOLD : 'rgba(255,255,255,0.08)', color: mine ? '#1a1a1a' : '#f3f4f6', padding: '8px 11px', borderRadius: 13, fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {m.message}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280', textAlign: mine ? 'right' : 'left', margin: '2px 4px 0' }}>{fmtChatTime(m.timestamp)}</div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire un message…"
          style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13.5, outline: 'none' }}
        />
        <button
          type="submit"
          disabled={isSending || !text.trim()}
          aria-label="Envoyer"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, borderRadius: 10, border: 'none', cursor: 'pointer', background: GOLD, color: '#1a1a1a', opacity: !text.trim() || isSending ? 0.5 : 1 }}
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}

// ── Fond sonore : contrôles inline (logés dans le panneau Réglages) ──────────
// Pilote le contrôleur `useAmbientAudio` partagé (le même que la pastille
// flottante). Grille de presets + lecture/pause + volume, en styles inline GOLD.
function AmbientInlineControls({ ctl }: { ctl: ReturnType<typeof useAmbientAudio> }) {
  const { presets, presetId, preset, volume, playing, selectPreset, setVolume, togglePlay } = ctl;
  const hasSource = !!preset.src;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {presets.map((p) => {
          const active = presetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPreset(p.id)}
              aria-pressed={active}
              title={p.label}
              style={{
                height: 46, borderRadius: 11, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                fontSize: 9.5, lineHeight: 1.1,
                border: active ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.1)',
                background: active ? 'rgba(176,141,87,0.16)' : 'rgba(255,255,255,0.03)',
                color: active ? GOLD : 'rgba(255,255,255,0.62)',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>{p.icon}</span>
              <span style={{ maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
            </button>
          );
        })}
      </div>
      {hasSource ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Mettre en pause' : 'Lire'}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer',
              background: playing ? GOLD : 'rgba(255,255,255,0.1)', color: playing ? '#1a1a1a' : '#fff',
            }}
          >
            {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          </button>
          <input
            type="range" min={0} max={100} value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume du fond sonore"
            style={{ flex: 1, minWidth: 0, height: 3, cursor: 'pointer', accentColor: GOLD }}
          />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 30, textAlign: 'right', flexShrink: 0 }}>{volume}%</span>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 11.5, color: '#6b7280', lineHeight: 1.5 }}>
          Choisissez une ambiance pour adoucir la consultation.
        </p>
      )}
    </div>
  );
}

// ── Copilote IA : enveloppe de panneau de droite (en-tête + fermeture) ────────
// ConsultationCopilot se rend inline (floating=false) ; on l'habille en colonne
// de droite façon ChatPanel, avec un bandeau et un bouton de fermeture.
function CopilotPanel({ sessionId, onClose }: { sessionId: string | undefined; onClose: () => void }) {
  return (
    <div style={{ width: 300, flexShrink: 0, background: PANEL_BG, borderLeft: PANEL_BORDER, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Sparkles size={16} color={GOLD} aria-hidden="true" />
        <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Copilote IA</span>
        <button onClick={onClose} aria-label="Fermer le copilote" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'inline-flex' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
        <ConsultationCopilot sessionId={sessionId} floating={false} style={{ width: '100%' }} />
      </div>
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
  sessionId,
  rightOpen = false,
  identity,
}: {
  view: ConsultView;
  isHost: boolean;
  scene: CockpitScene | null;
  strokes: AnnotStroke[];
  editable: boolean;
  onStrokes: (s: AnnotStroke[]) => void;
  sessionId: string | null;
  /** Un panneau de droite (Discussion/Copilote/Récap) est ouvert → on masque le
   *  rail Participants pour ne JAMAIS avoir 2 colonnes à droite (anti-surcharge). */
  rightOpen?: boolean;
  /** Image de marque : logo tenant + nom praticien (badge vue Conversation). */
  identity?: ConsultIdentity;
}) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  // CONVERSATION : face-à-face — grand flux de l'interlocuteur + soi en incrustation.
  if (view === 'conversation') {
    return (
      <div style={{ flex: 1, minHeight: 0, padding: 14 }}>
        <FaceToFace tracks={tracks} identity={identity} />
      </div>
    );
  }

  // PARTAGE / TABLEAU : vue PRÉSENTATEUR — artefact (ou tableau) en grand à gauche
  // + rail vertical des participants (membres invités) à droite.
  const hasScene = !!scene && scene.kind !== 'clear';
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', gap: 12, padding: 14 }}>
      <div style={{ flex: 1, minWidth: 0, borderRadius: 16, overflow: 'hidden', position: 'relative', background: view === 'board' ? TILE_BG : '#fff' }}>
        {view === 'board' ? (
          // Tableau intelligent (SmartBoard Konva) — outils de dessin/formes/texte +
          // NeuroInk côté praticien ; lecture seule côté patient. Remplace l'ancien
          // BoardSurface passif. (Sync patient temps-réel : itération ultérieure —
          // cf. note onBroadcast.)
          <ConsultationSmartBoard sessionId={sessionId} isHost={isHost} viewerMode={!isHost} />
        ) : hasScene ? (
          <SharedSceneView scene={scene} />
        ) : (
          <SharePlaceholder />
        )}
        {/* L'overlay d'annotation SVG reste pour le PARTAGE d'artefact ; le tableau
            Konva a ses propres outils de dessin (pas de double calque). */}
        {hasScene && view !== 'board' ? (
          <AnnotationOverlay strokes={strokes} editable={editable} onStrokes={onStrokes} />
        ) : null}
      </div>
      {!rightOpen ? <MembersRail tracks={tracks} /> : null}
    </div>
  );
}

// ── Rail des participants (membres invités) — vue présentateur (Partage/Tableau) ─
function MembersRail({ tracks }: { tracks: any[] }) {
  const cams = tracks.filter((t) => t?.source === Track.Source.Camera);
  return (
    <div style={{ width: 224, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: PANEL_BG, borderRadius: 14, border: PANEL_BORDER, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Users size={15} color={GOLD} aria-hidden="true" />
        <span style={{ fontWeight: 600, fontSize: 13, color: '#fff' }}>Participants</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af', background: 'rgba(255,255,255,0.06)', padding: '1px 8px', borderRadius: 999 }}>{cams.length}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cams.map((t, i) => (
          <div key={tileKey(t, i)} style={{ width: '100%', aspectRatio: '16 / 9', flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.08)' }}>
            <ParticipantTile trackRef={t} style={{ width: '100%', height: '100%' }} />
          </div>
        ))}
      </div>
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
  rightPanel,
  onToggleChat,
  onToggleCopilot,
  onToggleRecall,
  settingsOpen,
  onToggleSettings,
}: {
  isHost: boolean;
  annotatable: boolean;
  annotate: boolean;
  onToggleAnnotate: () => void;
  hasStrokes: boolean;
  onClearStrokes: () => void;
  onInvite: () => void;
  onLeave: () => void;
  rightPanel: 'chat' | 'copilot' | 'recall' | null;
  onToggleChat: () => void;
  onToggleCopilot: () => void;
  onToggleRecall: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 14px', background: BAR, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Média — icônes seules, légende au survol (title). */}
      <TrackToggle source={Track.Source.Microphone} showIcon title="Micro" />
      <TrackToggle source={Track.Source.Camera} showIcon title="Caméra" />
      {isHost ? <TrackToggle source={Track.Source.ScreenShare} showIcon title="Partager l'écran" /> : null}
      <BarSep />
      {/* Outils praticien. */}
      {isHost && annotatable ? (
        <button onClick={onToggleAnnotate} aria-pressed={annotate} title={annotate ? 'Annotation activée' : 'Annoter'} style={barBtn(annotate)}>
          <Pencil size={16} aria-hidden="true" />
        </button>
      ) : null}
      {isHost && annotatable && hasStrokes ? (
        <button onClick={onClearStrokes} title="Effacer les annotations" style={barBtn(false)}>
          <Eraser size={16} aria-hidden="true" />
        </button>
      ) : null}
      {isHost ? (
        <button onClick={onInvite} title="Inviter un proche" style={barBtn(false)}>
          <UserPlus size={16} aria-hidden="true" />
        </button>
      ) : null}
      <BarSep />
      {/* Panneaux droite + réglages. */}
      <button onClick={onToggleChat} aria-pressed={rightPanel === 'chat'} title="Discussion écrite" style={barBtn(rightPanel === 'chat')}>
        <MessageSquare size={16} aria-hidden="true" />
      </button>
      {isHost ? (
        <button onClick={onToggleCopilot} aria-pressed={rightPanel === 'copilot'} title="Copilote IA du tableau" style={barBtn(rightPanel === 'copilot')}>
          <Sparkles size={16} aria-hidden="true" />
        </button>
      ) : null}
      {isHost ? (
        <button onClick={onToggleRecall} aria-pressed={rightPanel === 'recall'} title="Récap de consultation" style={barBtn(rightPanel === 'recall')}>
          <Brain size={16} aria-hidden="true" />
        </button>
      ) : null}
      <ConsultationSettingsButton open={settingsOpen} onToggle={onToggleSettings} label="" />
      <BarSep />
      {/* Quitter — seul bouton libellé (sortie sans ambiguïté). */}
      <button onClick={leave} title="Quitter la consultation" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 9, border: 'none', cursor: 'pointer', background: '#b1372f', color: '#fff', fontSize: 13, fontWeight: 600 }}>
        <PhoneOff size={16} aria-hidden="true" /> Quitter
      </button>
    </div>
  );
}

// Séparateur fin entre groupes de la barre.
function BarSep() {
  return <span aria-hidden="true" style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.12)', margin: '0 3px', flexShrink: 0 }} />;
}

// Bouton-icône de la barre (carré 38px ; état actif = fond AMBRE).
function barBtn(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 38, height: 38, borderRadius: 9, border: 'none', cursor: 'pointer',
    background: active ? GOLD : 'rgba(255,255,255,0.1)',
    color: active ? '#1a1a1a' : '#fff',
  };
}

// ── Inviter un proche (host) + consentement RGPD (patient) ───────────────────
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 2147483600, background: 'rgba(0,0,0,0.55)', display: 'grid', placeItems: 'center', padding: 20 };
const modalStyle: React.CSSProperties = { width: '100%', maxWidth: 520, background: PANEL_BG, border: PANEL_BORDER, borderRadius: 16, padding: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' };
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
