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
  useParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import { getStableLiveKitRoomOptions, stableLiveKitConnectOptions } from '@/lib/livekitStableClient';
import LiveDataSaverEffect from '@/features/live/LiveDataSaverEffect';
import { useLiveDataSaver } from '@/hooks/useLiveDataSaver';
import LiriProductBadge from '@/components/brand/LiriProductBadge';
import { Stethoscope, PhoneOff, Share2, Pencil, Users, Presentation, MonitorUp, Eraser, UserPlus, Copy, Check, ShieldCheck, X, MessageSquare, Send, Sparkles, Brain, Music2, Play, Pause, FileText, LayoutTemplate, Radio, Upload } from 'lucide-react';
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
import ConsultationScriptPanel from '@/features/consultation-stage/ConsultationScriptPanel';
import WaitingRoom from '@/features/consultation-stage/WaitingRoom';
import { BackgroundBlur, VirtualBackground, supportsBackgroundProcessors } from '@livekit/track-processors';
import { useLiveHostWaitingRoom } from '@/features/live/hooks/useLiveHostWaitingRoom';
import { supabase } from '@/lib/customSupabaseClient';

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

// Fond de scène « cahier quadrillé » (sombre chaud + grille ambre) — identique au
// tableau. Sert de fond DE BASE à la zone de partage : plus de crème/blanc, mais le
// même quadrillage que le reste de la salle (demande : garder le fond à grille).
const SHARE_STAGE_BG: React.CSSProperties = {
  backgroundColor: TILE_BG,
  backgroundImage:
    'linear-gradient(rgba(212,163,106,0.07) 1px, transparent 1px),'
    + 'linear-gradient(90deg, rgba(212,163,106,0.07) 1px, transparent 1px),'
    + 'linear-gradient(rgba(212,163,106,0.13) 1px, transparent 1px),'
    + 'linear-gradient(90deg, rgba(212,163,106,0.13) 1px, transparent 1px)',
  backgroundSize: '40px 40px, 40px 40px, 200px 200px, 200px 200px',
  backgroundPosition: 'center center',
};

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

/* ── MOBILE (≤820px) ─────────────────────────────────────────────────────────
   La salle desktop (rails fixes 340/300/224 + barre large) déborde sur téléphone.
   On replie : panneaux droite en FEUILLE par le bas (bottom-sheet), rail
   participants masqué, barre d'outils qui passe à la ligne, cockpit quasi plein
   écran. Scopé à .consult-shell → Formation (LiveHostPage) reste INTACTE. */
@media (max-width: 820px) {
  .consult-shell [data-cr="rightdock"]{
    position:fixed !important; left:0 !important; right:0 !important; bottom:0 !important; top:auto !important;
    width:100% !important; height:70vh !important; z-index:2147483200 !important;
    box-shadow:0 -18px 50px rgba(0,0,0,0.55) !important;
  }
  .consult-shell [data-cr="rightdock"] > *{
    width:100% !important; border-left:none !important;
    border-top-left-radius:16px !important; border-top-right-radius:16px !important;
  }
  .consult-shell [data-cr="members"]{ display:none !important; }
  .consult-shell [data-cr="bar"]{ flex-wrap:wrap !important; justify-content:center !important; padding:7px 8px !important; gap:6px !important; }
  .consult-shell [data-cr="cockpit"]{ left:10px !important; right:10px !important; bottom:10px !important; width:auto !important; max-width:none !important; height:84vh !important; }
  .consult-shell [data-cr="cockpit-fab"]{ bottom:76px !important; right:12px !important; }
}
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
  const [patientWaitingStatus, setPatientWaitingStatus] = useState<string | null>(null);

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

  // Le patient enregistre réellement sa demande dans la salle d'attente commune
  // LIRI. Sans cette ligne, le praticien ne peut ni la voir ni l'autoriser.
  useEffect(() => {
    if (!sessionId || !user?.id || !ctxResolved || ctx?.role !== 'patient') return undefined;
    let alive = true;
    const ensureAndReadWaiting = async () => {
      const { data: existing } = await supabase
        .from('live_waiting_room_entries')
        .select('id,status')
        .eq('live_session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle();
      let row = existing;
      if (!row) {
        const { data } = await supabase
          .from('live_waiting_room_entries')
          .insert({ live_session_id: sessionId, user_id: user.id, status: 'waiting' })
          .select('id,status')
          .single();
        row = data;
      } else if (['left', 'lobby'].includes(String(row.status))) {
        const { data } = await supabase
          .from('live_waiting_room_entries')
          .update({ status: 'waiting' })
          .eq('id', row.id)
          .select('id,status')
          .single();
        row = data;
      }
      if (alive && row?.status) setPatientWaitingStatus(String(row.status));
    };
    void ensureAndReadWaiting();
    const ch = supabase
      .channel(`medos-patient-waiting-${sessionId}-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_waiting_room_entries', filter: `live_session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.new?.user_id === user.id && payload.new?.status) {
            setPatientWaitingStatus(String(payload.new.status));
          }
        },
      )
      .subscribe();
    const pollId = window.setInterval(ensureAndReadWaiting, 3000);
    return () => {
      alive = false;
      window.clearInterval(pollId);
      supabase.removeChannel(ch);
    };
  }, [sessionId, user?.id, ctxResolved, ctx?.role]);

  // 2) Connexion LiveKit. Téléconsult 1-1 : l'hôte ET le patient entrent
  //    DIRECTEMENT dans leur propre consultation (le praticien attend son
  //    patient — une salle d'attente à admission manuelle le bloquait à tort
  //    quand l'inscription/l'admission échouait silencieusement). Le patient
  //    apparaît chez le praticien comme participant LiveKit. La sécurité reste
  //    côté backend (le token n'est délivré qu'au vrai patient de la session).
  //    `patientWaitingStatus === 'admitted'` reste géré pour compat (admission
  //    manuelle si un jour ré-activée), mais n'est plus une barrière.
  const canConnect =
    ctxResolved &&
    (!ctx ||
      ctx.role === 'host' ||
      ctx.role === 'patient' ||
      patientWaitingStatus === 'admitted');
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
  const { waitingEntries, approveWaiting, rejectWaiting } = useLiveHostWaitingRoom({
    sessionId: isHost ? sessionId : null,
  });
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
  const [rightPanel, setRightPanel] = useState<'chat' | 'copilot' | 'recall' | 'script' | null>(null);
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
  const [ending, setEnding] = useState(false);
  const handleLeave = async () => {
    if (!isHost) {
      setLeft(true);
      return;
    }
    if (ending) return;
    setEnding(true);
    try {
      await teleconsultApi.end(sessionId!, { ended_reason: 'manual' });
      await supabase
        .from('live_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', sessionId);
      setLeft(true);
      window.setTimeout(() => returnToMedos(tenantSlug), 500);
    } catch (e: any) {
      setError(e?.message || 'Impossible de terminer la consultation.');
      setEnding(false);
    }
  };

  // Le patient doit sortir même si l'événement Realtime est perdu : abonnement
  // instantané + vérification périodique de la session miroir LIRI.
  useEffect(() => {
    if (!sessionId || isHost) return undefined;
    const handleStatus = (status: unknown) => {
      if (['ended', 'cancelled'].includes(String(status || ''))) setLeft(true);
    };
    const poll = async () => {
      const { data } = await supabase
        .from('live_sessions')
        .select('status')
        .eq('id', sessionId)
        .maybeSingle();
      handleStatus(data?.status);
    };
    const ch = supabase
      .channel(`medos-consult-end-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` },
        (payload) => handleStatus(payload.new?.status),
      )
      .subscribe();
    const pollId = window.setInterval(poll, 3000);
    void poll();
    return () => {
      window.clearInterval(pollId);
      supabase.removeChannel(ch);
    };
  }, [sessionId, isHost]);

  // Studio de création de live — nouvel onglet (préserve le tenant ; ne coupe pas la
  // salle en cours). launch=true → « Lancer le live » (accès direct, saute à l'étape
  // Validation) ; launch=false → « Préparer le live » (wizard complet).
  const openLiveStudio = (launch: boolean) => {
    const q = new URLSearchParams();
    if (tenantSlug) q.set('tenant', tenantSlug);
    if (launch) q.set('launch', '1');
    q.set('context', 'medos'); // live santé → cockpit clinique embarqué (jumeau 3D éducation)
    window.open(`/studio/live?${q.toString()}`, '_blank', 'noopener,noreferrer');
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
    if (ctxResolved && ctx?.role === 'patient' && patientWaitingStatus !== 'admitted') {
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
      {isHost && waitingEntries.length > 0 ? (
        <div
          role="alert"
          style={{
            position: 'fixed', top: 76, right: 20, zIndex: 2147483640,
            width: 330, padding: 16, borderRadius: 16,
            background: 'rgba(35,33,30,0.98)', border: '1px solid rgba(212,163,106,0.5)',
            boxShadow: '0 18px 48px rgba(0,0,0,0.55)', color: '#f5f4ee',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Users size={20} color={GOLD} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Patient en salle d’attente</div>
              <div style={{ marginTop: 2, fontSize: 12, color: 'rgba(245,244,238,0.62)' }}>
                {waitingEntries[0]?.profile?.name || 'Un participant'} demande à entrer.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => rejectWaiting(waitingEntries[0].id)}
              style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#f5f4ee', cursor: 'pointer' }}
            >
              Refuser
            </button>
            <button
              type="button"
              onClick={() => approveWaiting(waitingEntries[0].id)}
              style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: 0, background: GOLD, color: '#211d18', fontWeight: 700, cursor: 'pointer' }}
            >
              Autoriser
            </button>
          </div>
        </div>
      ) : null}
      <LiveKitRoom
        serverUrl={conn.url}
        token={conn.token}
        connect
        audio={joinMic}
        video={joinCam}
        options={getStableLiveKitRoomOptions({ adaptiveStream: true, dynacast: true })}
        connectOptions={stableLiveKitConnectOptions}
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <LiveDataSaverEffect />
        <ConnectedParticipantsCard />
        {/* Studio reporté : périphériques + détourage sur le flux publié. */}
        <CallVideoFx camId={camId} micId={micId} detourage={detourage} />
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
              smartboard={channel.smartboard}
              onSmartboardBroadcast={channel.shareSmartboard}
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
                onLeave={() => void handleLeave()}
                rightPanel={rightPanel}
                onToggleChat={() => setRightPanel((p) => (p === 'chat' ? null : 'chat'))}
                onToggleCopilot={() => setRightPanel((p) => (p === 'copilot' ? null : 'copilot'))}
                onToggleRecall={() => setRightPanel((p) => (p === 'recall' ? null : 'recall'))}
                onToggleScript={() => setRightPanel((p) => (p === 'script' ? null : 'script'))}
                onOpenStudio={() => openLiveStudio(false)}
                onLaunchLive={() => openLiveStudio(true)}
                settingsOpen={settingsOpen}
                onToggleSettings={() => setSettingsOpen((v) => !v)}
              />
            </div>
          </div>
          {/* Panneau de droite — un seul ouvert à la fois. Enveloppé dans `rightdock`
              (data-cr) : desktop = colonne à largeur fixe ; mobile (≤820px) = feuille
              plein écran par le bas (cf. CONSULT_SHELL_CSS @media). */}
          {rightPanel ? (
            <div data-cr="rightdock" style={{ display: 'flex', minHeight: 0 }}>
              {rightPanel === 'chat' ? <ChatPanel onClose={() => setRightPanel(null)} /> : null}
              {rightPanel === 'copilot' && isHost ? (
                <CopilotPanel sessionId={sessionId} onClose={() => setRightPanel(null)} />
              ) : null}
              {rightPanel === 'recall' && isHost && sessionId ? (
                <ConsultationRecall sessionId={sessionId} patientName={ctx?.patient_name} onClose={() => setRightPanel(null)} />
              ) : null}
              {rightPanel === 'script' && isHost && sessionId ? (
                <ConsultationScriptPanel sessionId={sessionId} onClose={() => setRightPanel(null)} />
              ) : null}
            </div>
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
      {isHost && sessionId ? <HostAdmitGate sessionId={sessionId} /> : null}
      {/* Fond sonore — pastille flottante autonome (praticien), pilotée par le même
          contrôleur que le panneau Réglages. */}
      {isHost ? <AmbientAudioEngine controller={ambient} /> : null}
    </div>
  );
  // Plein écran : portal vers <body> pour échapper à tout ancêtre containing-block
  // (sinon position:fixed reste contraint sous le header tenant).
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

// Images de fond virtuel (détourage type « fond »). Photos libres Unsplash.
const VBG_IMAGES: Record<string, string> = {
  nature: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1280&q=80',
  office: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80',
  library: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1280&q=80',
};

// Reporte le STUDIO sur le flux PUBLIÉ : périphériques (`switchActiveDevice`) +
// DÉTOURAGE via les track-processors OFFICIELS LiveKit (`setProcessor`
// BackgroundBlur/VirtualBackground) — pipeline robuste (pas de canvas/republish
// manuel). Rendu DANS <LiveKitRoom>. (Le maquillage reste à l'aperçu : les
// track-processors ne font pas de « beauty ».)
function CallVideoFx({ camId, micId, detourage }: { camId: string; micId: string; detourage: string }) {
  const room = useRoomContext();
  const { cameraTrack } = useLocalParticipant();
  const connState = useConnectionState();
  const connected = connState === ConnectionState.Connected;

  useEffect(() => {
    if (!connected || !room) return;
    (async () => {
      try { if (camId) await (room as any).switchActiveDevice('videoinput', camId); } catch { /* ignore */ }
      try { if (micId) await (room as any).switchActiveDevice('audioinput', micId); } catch { /* ignore */ }
    })();
  }, [connected, camId, micId, room]);

  useEffect(() => {
    if (!connected) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (!supportsBackgroundProcessors()) return;
        const track: any = (cameraTrack as any)?.track;
        if (!track || typeof track.setProcessor !== 'function') return;
        if (cancelled) return;
        if (detourage === 'none') {
          if (track.getProcessor?.()) await track.stopProcessor();
        } else if (detourage === 'blur' || detourage === 'immersive') {
          await track.setProcessor(BackgroundBlur(detourage === 'immersive' ? 20 : 12));
        } else if (VBG_IMAGES[detourage]) {
          await track.setProcessor(VirtualBackground(VBG_IMAGES[detourage]));
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [connected, detourage, cameraTrack]);

  return null;
}

function ConnectedParticipantsCard() {
  const participants = useParticipants();
  const visible = participants.map((participant: any) => ({
    id: participant.identity,
    name: participant.name || participant.identity || 'Participant',
    local: participant.isLocal === true,
  }));
  return (
    <div
      data-testid="connected-participants"
      style={{
        position: 'fixed', top: 76, left: 20, zIndex: 2147483635,
        minWidth: 190, maxWidth: 290, padding: '11px 13px', borderRadius: 13,
        background: 'rgba(35,33,30,0.96)', border: '1px solid rgba(245,244,238,0.13)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.4)', color: '#f5f4ee',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700 }}>
        <Users size={15} color={GOLD} />
        {visible.length} connecté{visible.length > 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
        {visible.map((participant) => (
          <div key={participant.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgba(245,244,238,0.72)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {participant.local ? 'Vous' : participant.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
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
      <LiriProductBadge product="care" size="xs" />
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

// Rôle d'un participant pour l'étiquette de vignette (patient comme praticien).
// L'INVITÉ (proche/membre) a une identity préfixée `proche_` (cf. backend
// issueInviteToken) → on le distingue du patient et du soignant SANS toucher au
// token. Chaque vignette porte ainsi un nom + un rôle, quel que soit le nombre
// d'invités (le rapport praticien↔patient, lui, ne bouge pas).
type TileRole = { label: string; tone: 'self' | 'guest' | 'peer' };
function participantRole(p: any, isHost: boolean): TileRole {
  const identity = String(p?.identity || '');
  const name = String(p?.name || '').trim();
  if (p?.isLocal) return { label: 'Vous', tone: 'self' };
  if (identity.startsWith('proche_')) return { label: name || 'Invité', tone: 'guest' };
  return { label: name || (isHost ? 'Patient' : 'Praticien'), tone: 'peer' };
}

// Étiquette de rôle posée en haut à gauche d'une vignette : pastille + nom.
// L'invité porte une pastille ambre + icône (le distingue du patient/soignant).
function RoleTag({ role, style }: { role: TileRole; style?: React.CSSProperties }) {
  const dot = role.tone === 'guest' ? GOLD : 'rgba(245,244,238,0.9)';
  return (
    <span style={{ position: 'absolute', left: 7, top: 7, zIndex: 3, display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 'calc(100% - 14px)', fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 999, pointerEvents: 'none', ...style }}>
      {role.tone === 'guest' ? (
        <UserPlus size={10} color={GOLD} aria-hidden="true" />
      ) : (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role.label}</span>
    </span>
  );
}

function FaceToFace({ tracks, identity, isHost }: { tracks: any[]; identity?: ConsultIdentity; isHost?: boolean }) {
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
          {minis.map((t) => (
            <div
              key={stableTrackKey(t)}
              role="button"
              tabIndex={0}
              onClick={() => setFeaturedKey(stableTrackKey(t))}
              title="Cliquer pour agrandir"
              style={{ position: 'relative', width: 208, aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', background: '#000', border: '2px solid rgba(255,255,255,0.28)', boxShadow: '0 12px 34px rgba(0,0,0,0.55)', cursor: 'pointer' }}
            >
              <ParticipantTile trackRef={t} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
              <RoleTag role={participantRole(t?.participant, !!isHost)} />
            </div>
          ))}
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
  const { presets, presetId, preset, volume, playing, selectPreset, setVolume, togglePlay, addCustomTrack } = ctl;
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
      <label
        title="Charger une piste depuis votre appareil"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          height: 32, borderRadius: 10, cursor: 'pointer',
          border: `1px dashed ${GOLD}66`, background: 'rgba(176,141,87,0.08)',
          color: GOLD, fontSize: 11.5, fontWeight: 600,
        }}
      >
        <Upload size={13} aria-hidden="true" />
        Charger une piste
        <input
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) addCustomTrack(f);
            e.currentTarget.value = '';
          }}
        />
      </label>
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
  smartboard,
  onSmartboardBroadcast,
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
  /** Patient : état SmartBoard reçu du canal (rejoué sur le tableau). */
  smartboard?: Record<string, unknown>;
  /** Host : relaie un patch SmartBoard sur le canal med-cockpit. */
  onSmartboardBroadcast?: (p?: Record<string, unknown>) => void;
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
        <FaceToFace tracks={tracks} identity={identity} isHost={isHost} />
      </div>
    );
  }

  // PARTAGE / TABLEAU : vue PRÉSENTATEUR — artefact (ou tableau) en grand à gauche
  // + rail vertical des participants (membres invités) à droite.
  const hasScene = !!scene && scene.kind !== 'clear';
  // Écran partagé par le praticien (publié via LiveKit). Il ne doit JAMAIS être
  // silencieusement masqué : si aucun artefact clinique n'occupe le grand cadre,
  // on l'y affiche en plein ; sinon il reste visible dans le rail (MembersRail).
  const screen = tracks.find((t) => t?.source === Track.Source.ScreenShare && t?.publication);
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', gap: 12, padding: 14 }}>
      <div style={{ flex: 1, minWidth: 0, borderRadius: 16, overflow: 'hidden', position: 'relative', ...(view === 'board' ? { background: TILE_BG } : SHARE_STAGE_BG) }}>
        {view === 'board' ? (
          // Tableau intelligent (SmartBoard Konva) — outils de dessin/formes/texte +
          // NeuroInk côté praticien ; lecture seule côté patient. Sync patient
          // temps-réel : l'hôte relaie ses patchs via onBroadcast → canal
          // med-cockpit ; le patient les rejoue via incomingBroadcast.
          <ConsultationSmartBoard
            sessionId={sessionId}
            isHost={isHost}
            viewerMode={!isHost}
            onBroadcast={isHost ? onSmartboardBroadcast : undefined}
            incomingBroadcast={!isHost ? smartboard : undefined}
          />
        ) : hasScene ? (
          <div style={{ height: '100%', width: '100%', overflow: 'auto', padding: 18 }}>
            <SharedSceneView scene={scene} />
          </div>
        ) : screen ? (
          // Aucun artefact poussé mais le praticien partage son écran → l'écran EST
          // le contenu partagé : plein cadre (host ET patient le voient).
          <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
            <ParticipantTile trackRef={screen} style={{ width: '100%', height: '100%' }} />
          </div>
        ) : (
          <SharePlaceholder />
        )}
        {/* L'overlay d'annotation SVG reste pour le PARTAGE d'artefact ; le tableau
            Konva a ses propres outils de dessin (pas de double calque). */}
        {hasScene && view !== 'board' ? (
          <AnnotationOverlay strokes={strokes} editable={editable} onStrokes={onStrokes} />
        ) : null}
      </div>
      {!rightOpen ? <MembersRail tracks={tracks} isHost={isHost} /> : null}
    </div>
  );
}

// ── Rail des participants (membres invités) — vue présentateur (Partage/Tableau) ─
function MembersRail({ tracks, isHost }: { tracks: any[]; isHost?: boolean }) {
  const cams = tracks.filter((t) => t?.source === Track.Source.Camera);
  // Écran partagé : vignette dédiée EN TÊTE du rail (label ambre) → quand un
  // artefact/tableau occupe le grand cadre, le patient garde l'écran du praticien
  // sous les yeux (jamais masqué silencieusement).
  const screen = tracks.find((t) => t?.source === Track.Source.ScreenShare && t?.publication);
  return (
    <div data-cr="members" style={{ width: 224, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: PANEL_BG, borderRadius: 14, border: PANEL_BORDER, overflow: 'hidden' }}>
      <style>{`[data-cr="members"] .lk-participant-name{display:none!important}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Users size={15} color={GOLD} aria-hidden="true" />
        <span style={{ fontWeight: 600, fontSize: 13, color: '#fff' }}>Participants</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af', background: 'rgba(255,255,255,0.06)', padding: '1px 8px', borderRadius: 999 }}>{cams.length}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {screen ? (
          <div style={{ width: '100%', flexShrink: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MonitorUp size={12} aria-hidden="true" /> Écran partagé
            </div>
            <div style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden', background: '#000', border: '1px solid rgba(212,163,106,0.55)' }}>
              <ParticipantTile trackRef={screen} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        ) : null}
        {cams.map((t, i) => (
          <div key={tileKey(t, i)} style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.08)' }}>
            <ParticipantTile trackRef={t} style={{ width: '100%', height: '100%' }} />
            <RoleTag role={participantRole(t?.participant, !!isHost)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Vue Partage sans artefact encore choisi (host).
function SharePlaceholder() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'rgba(245,244,238,0.58)', background: 'transparent' }}>
      <div style={{ textAlign: 'center', maxWidth: 340, padding: '0 24px' }}>
        <Share2 size={30} style={{ margin: '0 auto 10px', opacity: 0.85, color: GOLD }} aria-hidden="true" />
        <p style={{ fontSize: 14.5, fontWeight: 700, color: 'rgba(245,244,238,0.92)', marginBottom: 5 }}>Aucun élément partagé</p>
        <p style={{ fontSize: 12.5, lineHeight: 1.5 }}>
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
  onToggleScript,
  onOpenStudio,
  onLaunchLive,
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
  onToggleScript: () => void;
  onOpenStudio: () => void;
  onLaunchLive: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}) {
  const room = useRoomContext();
  const { dataSaver, toggleDataSaver } = useLiveDataSaver();
  const leave = () => {
    try {
      room.disconnect();
    } catch {
      /* ignore */
    }
    onLeave();
  };
  return (
    <div data-cr="bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 14px', background: BAR, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Média — icônes seules, légende au survol (title). */}
      <TrackToggle source={Track.Source.Microphone} showIcon title="Micro" />
      <TrackToggle source={Track.Source.Camera} showIcon title="Caméra" />
      {isHost ? <TrackToggle source={Track.Source.ScreenShare} showIcon title="Partager l'écran" /> : null}
      <button
        type="button"
        onClick={toggleDataSaver}
        aria-pressed={dataSaver}
        title={dataSaver
          ? 'Éco data activé : vidéos coupées en réception (audio + partage d’écran gardés). Cliquer pour réafficher.'
          : 'Éco data : couper la réception vidéo pour tenir en connexion faible (garde l’audio + le partage d’écran).'}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 6,
          border: `1px solid ${dataSaver ? 'rgba(251,191,36,.55)' : 'rgba(255,255,255,.12)'}`,
          background: dataSaver ? 'rgba(251,191,36,.16)' : 'rgba(255,255,255,.04)',
          color: dataSaver ? '#fde68a' : 'rgba(255,255,255,.8)',
          cursor: 'pointer',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></svg>
      </button>
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
      {isHost ? (
        <button onClick={onLaunchLive} title="Lancer un live maintenant" style={barBtn(false)}>
          <Radio size={16} aria-hidden="true" />
        </button>
      ) : null}
      {isHost ? (
        <button onClick={onOpenStudio} title="Préparer un live (studio complet)" style={barBtn(false)}>
          <LayoutTemplate size={16} aria-hidden="true" />
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
      {isHost ? (
        <button onClick={onToggleScript} aria-pressed={rightPanel === 'script'} title="Conducteur (script + prompteur)" style={barBtn(rightPanel === 'script')}>
          <FileText size={16} aria-hidden="true" />
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
  const [mode, setMode] = useState<'member' | 'guest'>('guest');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [members, setMembers] = useState<{ user_id: string; email: string | null; full_name: string | null; role: string; status: string }[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
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
    teleconsultApi
      .tenantMembers()
      .then((m) => setMembers(Array.isArray(m) ? m.filter((x) => x.status === 'active') : []))
      .catch(() => {});
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

  // Partage WhatsApp : ouvre wa.me avec le message pré-rempli — le praticien
  // choisit le contact et envoie LUI-MÊME (aucun envoi automatique). Permet
  // d'inviter n'importe qui en externe sans email. Sécurité inchangée : le
  // lien est non devinable (UUID) et reste fail-closed tant que non admis.
  const waShare = (inv: TeleconsultInvite) => {
    const msg =
      `Bonjour ${inv.display_name}, vous êtes invité·e à rejoindre une téléconsultation sécurisée.` +
      `\n\nCliquez sur ce lien pour entrer dans la salle d'attente :\n${linkFor(inv.id)}` +
      `\n\nL'accès s'ouvrira dès que votre participation sera autorisée.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  const create = async () => {
    setBusy(true);
    try {
      let inv: TeleconsultInvite;
      if (mode === 'member') {
        if (!selectedMember) return;
        inv = await teleconsultApi.createInvite(sessionId, { invited_user_id: selectedMember, kind: 'member' });
        setSelectedMember('');
      } else {
        inv = await teleconsultApi.createInvite(sessionId, {
          display_name: name.trim() || undefined,
          email: email.trim() || undefined,
          relationship: relationship.trim() || undefined,
          kind: 'proche',
        });
        setName(''); setEmail(''); setRelationship('');
      }
      setInvites((prev) => [...prev, inv]);
      // Repli : si l'email n'est pas parti, on copie le lien pour l'envoyer soi-même.
      if (inv?.email_status !== 'sent') copy(inv.id);
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

  // Le praticien admet un proche sans attendre le patient (utile quand le
  // patient n'est pas encore connecté : sinon le proche reste bloqué).
  const admit = async (id: string) => {
    await teleconsultApi.admitInvite(sessionId, id).catch(() => {});
    teleconsultApi.listInvites(sessionId).then(setInvites).catch(() => {});
  };

  const memberLabel = (m: { full_name: string | null; email: string | null; user_id: string }) =>
    m.full_name || m.email || m.user_id.slice(0, 8);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', borderRadius: 8,
    border: 'none', background: active ? 'rgba(212,163,106,0.18)' : 'transparent',
    color: active ? '#e8c3a0' : 'rgba(245,244,238,0.6)',
  });

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <UserPlus size={18} color={GOLD} aria-hidden="true" />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>Inviter au live</h3>
          <button onClick={onClose} style={closeBtn} aria-label="Fermer"><X size={16} /></button>
        </div>

        {/* Type d'invité : membre du cabinet (compte) vs invité libre (nom+email). */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 10 }}>
          <button type="button" onClick={() => setMode('member')} style={tabStyle(mode === 'member')}>Membre du cabinet</button>
          <button type="button" onClick={() => setMode('guest')} style={tabStyle(mode === 'guest')}>Invité (nom + email)</button>
        </div>

        {mode === 'member' ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">Choisir un membre…</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{memberLabel(m)} · {m.role}</option>
              ))}
            </select>
            <button onClick={create} disabled={busy || !selectedMember} style={{ ...primaryBtn, opacity: busy || !selectedMember ? 0.6 : 1 }}>Inviter</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'invité" style={inputStyle} />
              <input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Lien (ex: Fille)" style={{ ...inputStyle, maxWidth: 120 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email de l'invité" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={create} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>Inviter</button>
            </div>
          </div>
        )}

        <p style={{ margin: '2px 0 12px', fontSize: 11.5, color: '#9ca3af', lineHeight: 1.5 }}>
          {mode === 'member'
            ? "Un membre du cabinet rejoint directement (soignant, secret médical) — il reçoit le lien par email."
            : <>L'invité reçoit le lien par email. <strong style={{ color: '#cbd5e1' }}>Le patient devra autoriser</strong> sa participation (données de santé).</>}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
          {invites.length === 0 ? (
            <p style={{ fontSize: 12.5, color: '#6b7280', textAlign: 'center', padding: '10px 0' }}>Aucune invitation pour l'instant.</p>
          ) : (
            invites.map((inv) => (
              <div key={inv.id} style={inviteRow}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {inv.display_name}{inv.relationship ? ` · ${inv.relationship}` : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <StatusBadge status={inv.status} />
                    <EmailStatusBadge status={inv.email_status} />
                  </div>
                </div>
                {inv.status === 'consent_requested' ? (
                  <button
                    onClick={() => admit(inv.id)}
                    title="Admettre ce proche maintenant (sans attendre le patient)"
                    aria-label="Admettre"
                    style={{ ...iconBtn, width: 'auto', padding: '0 10px', gap: 5, color: '#86efac', background: 'rgba(34,197,94,0.14)', fontSize: 11.5, fontWeight: 700 }}
                  >
                    <Check size={14} /> Admettre
                  </button>
                ) : null}
                <button
                  onClick={() => waShare(inv)}
                  title="Envoyer le lien par WhatsApp"
                  aria-label="Envoyer par WhatsApp"
                  style={{ ...iconBtn, color: '#25D366' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                  </svg>
                </button>
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

// Petit badge du résultat d'envoi email de l'invitation (best-effort côté serveur).
function EmailStatusBadge({ status }: { status?: string | null }) {
  if (!status || status === 'skipped') return null;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    sent: { label: '✉ email envoyé', color: '#86efac', bg: 'rgba(134,239,172,0.12)' },
    failed: { label: '✉ email échoué', color: '#fca5a5', bg: 'rgba(252,165,165,0.12)' },
    error: { label: '✉ email échoué', color: '#fca5a5', bg: 'rgba(252,165,165,0.12)' },
    disabled: { label: '✉ email non configuré', color: '#fcd34d', bg: 'rgba(252,211,77,0.12)' },
  };
  const s = map[status] || { label: `✉ ${status}`, color: '#cbd5e1', bg: 'rgba(255,255,255,0.06)' };
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, color: s.color, background: s.bg, padding: '1px 7px', borderRadius: 999 }}>{s.label}</span>
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

// Bandeau HOST : alerte le praticien dès qu'un proche attend d'être admis, avec
// admission en 1 CLIC — sans rouvrir le modal d'invitation. Symétrique de
// PatientConsentGate (côté patient) mais NON bloquant (le praticien reste en
// consultation, bandeau flottant en haut) et réservé à l'hôte. Sans lui, le
// bouton « Admettre » restait caché dans le modal → le praticien ne savait pas
// qu'un invité l'attendait, qui restait bloqué « en attente d'autorisation ».
function HostAdmitGate({ sessionId }: { sessionId: string }) {
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

  const act = async (admit: boolean) => {
    setBusy(true);
    try {
      if (admit) await teleconsultApi.admitInvite(sessionId, pending.id);
      else await teleconsultApi.revokeInvite(sessionId, pending.id);
      setPending(null);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14,
        background: 'rgba(24,20,16,0.96)', border: '1px solid rgba(212,163,106,0.5)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)', maxWidth: 'calc(100vw - 28px)',
      }}
    >
      <UserPlus size={18} color={GOLD} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13.5, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <strong>{pending.display_name}</strong>{pending.relationship ? ` (${pending.relationship})` : ''} souhaite rejoindre
      </span>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={() => act(false)} disabled={busy} style={{ ...secondaryBtn, padding: '7px 12px', fontSize: 12.5 }}>Refuser</button>
        <button onClick={() => act(true)} disabled={busy} style={{ ...primaryBtn, padding: '7px 16px', fontSize: 12.5 }}>Admettre</button>
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
