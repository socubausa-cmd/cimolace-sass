/**
 * Maquette statique de la salle d'attente — design aligné sur LiveWaitingRoomPage (grille, encart, messagerie, ambiance).
 * URL : /live/waiting/maquette
 * Sans Supabase : chat / apartés simulés en local.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Lock, Radio, Eye, EyeOff,
  CheckCircle2, Loader2, AlertTriangle,
  Volume2, ArrowRight, LogIn, KeyRound, Palette, Sparkles,
  Clock, Calendar, BookOpen, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ProrasciencePublicPageShell,
  ProrasciencePublicCard,
} from '@/components/prorascience/ProrasciencePublicPageShell';
import LiveHostMessagingPanel from '@/components/liri/live-room/LiveHostMessagingPanel';
import LiveHostFooterMessaging from '@/components/liri/live-room/LiveHostFooterMessaging';
import AmbientAudioLayer from '@/components/liri/live-room/AmbientAudioLayer';
import {
  Countdown,
  StatusBadge,
  WaitingStatus,
  displayNameInitials,
  planFromConfig,
} from '@/pages/studio-creator/studio/LiveWaitingRoomPage';

const SCENARIOS = [
  { id: 'host', label: 'Vue hôte — « Lancer la session »' },
  { id: 'free_live', label: 'Invité — accès libre, live démarré (lobby)' },
  { id: 'free_scheduled', label: 'Invité — accès libre, pas encore démarré' },
  { id: 'waiting', label: 'Invité — en attente de validation' },
  { id: 'password', label: 'Invité — mot de passe (lobby)' },
  { id: 'manual', label: 'Invité — demande manuelle (lobby)' },
  { id: 'accepted', label: 'Invité — accès accordé' },
  { id: 'rejected', label: 'Invité — refusé' },
  { id: 'audio_welcome', label: 'Invité — aperçu audio + message d\'accueil' },
];

const MOCK_SCHEDULED = new Date(Date.now() + 3_600_000 * 2 + 45_000).toISOString();

/** Image de démo (couverture type live) */
const MOCK_COVER_URL =
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&w=960&q=75';

const MOCK_FORMATION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const MOCK_HOST_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const MOCK_PARTICIPANT_ID = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

const MOCK_PLAN_CONFIG = {
  live_plan: ['Accueil & consignes (8 min)', 'Cours principal (40 min)', 'Questions / échanges (12 min)'],
};

/** Piste démo lisible en HTTPS (si CORS bloque, le bouton lecture peut rester muet). */
const DEMO_AMBIENT_TRACKS = [
  { label: 'Ambiance démo', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', volume: 0.12 },
];

function FakeAudioPreviewStrip() {
  return (
    <ProrasciencePublicCard className="border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[#101729]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
          <Volume2 className="h-4 w-4 text-[var(--school-accent)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#ebca5e]">Aperçu audio actif</p>
          <p className="mt-0.5 text-xs text-white/50">
            Maquette : pas de flux réel — bloc pour caler le design.
          </p>
        </div>
        <span className="flex-shrink-0 rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] px-2 py-1 text-[10px] text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]">
          Factice
        </span>
      </div>
    </ProrasciencePublicCard>
  );
}

export default function LiveWaitingRoomMaquettePage() {
  const [scenario, setScenario] = useState('waiting');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showMessagingPanel, setShowMessagingPanel] = useState(false);
  const [forumTarget, setForumTarget] = useState(null);
  const [forumInput, setForumInput] = useState('');
  const [chatCollectiveEnabled, setChatCollectiveEnabled] = useState(true);
  const [showLivePlan, setShowLivePlan] = useState(true);
  const [showLiveDetails, setShowLiveDetails] = useState(true);
  const [ambientDemo, setAmbientDemo] = useState(false);

  const [mockChatMessages, setMockChatMessages] = useState(() => [
    {
      id: 'm1',
      userId: 'ext-1',
      name: 'Camille',
      text: 'Je suis connectée depuis la salle d\'attente.',
      time: new Date(Date.now() - 120_000).toISOString(),
    },
  ]);

  const [mockWhisperThreads, setMockWhisperThreads] = useState({});

  const mockUser = useMemo(
    () => ({ id: MOCK_PARTICIPANT_ID, email: 'participant@maquette.dev' }),
    [],
  );

  const liveSession = useMemo(() => {
    const base = {
      title: 'Salle d\'attente — session live (maquette)',
      description:
        'Mise en page alignée sur la prod : encart couverture / détails / programme, liens forum & messagerie, icône cyan comme sur le live.',
      profiles: { name: 'Prof. Maquette', avatar_url: null },
      cover_image_url: MOCK_COVER_URL,
      duration_minutes: 90,
      formation_id: MOCK_FORMATION_ID,
      teacher_id: MOCK_HOST_ID,
      config: showLivePlan ? MOCK_PLAN_CONFIG : {},
    };
    switch (scenario) {
      case 'free_scheduled':
        return { ...base, status: 'scheduled', scheduled_at: MOCK_SCHEDULED };
      case 'free_live':
      case 'waiting':
      case 'password':
      case 'manual':
      case 'accepted':
      case 'rejected':
      case 'audio_welcome':
      case 'host':
        return { ...base, status: 'live', scheduled_at: null };
      default:
        return { ...base, status: 'live', scheduled_at: null };
    }
  }, [scenario, showLivePlan]);

  const sessionConfig = useMemo(() => {
    if (!liveSession.config) return {};
    if (typeof liveSession.config === 'object') return liveSession.config;
    return {};
  }, [liveSession.config]);

  const planBlock = useMemo(() => planFromConfig(sessionConfig), [sessionConfig]);

  const sessionLive = liveSession.status === 'live';

  const mockEntry = useMemo(() => {
    if (scenario === 'host') return null;
    if (scenario === 'waiting') return { status: 'waiting' };
    if (scenario === 'accepted') return { status: 'accepted' };
    if (scenario === 'rejected') return { status: 'rejected' };
    return { status: 'lobby' };
  }, [scenario]);

  const showAudioWelcome = scenario === 'audio_welcome';
  const mockWelcome = showAudioWelcome
    ? 'Bienvenue : message d\'accueil personnalisé (comme sur une vraie session).'
    : null;

  const waitingRoomAudioEnabled = showAudioWelcome;

  const hostMemberForPanel = useMemo(() => {
    const name = liveSession.profiles?.name || 'Formateur';
    const init = displayNameInitials(name);
    return [
      {
        id: MOCK_HOST_ID,
        name,
        init,
        color: '#a78bfa',
        status: 'online',
        grade: 'Formateur',
        bio: '',
        avg: '—',
        att: '—',
        note: '',
      },
    ];
  }, [liveSession.profiles?.name]);

  const ambientTracks = ambientDemo ? DEMO_AMBIENT_TRACKS : [];

  const sendMockCollective = useCallback(
    (text) => {
      const t = String(text || '').trim();
      if (!t) return;
      if (!chatCollectiveEnabled) return;
      setMockChatMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          userId: mockUser.id,
          name: 'Vous',
          text: t,
          time: new Date().toISOString(),
        },
      ]);
    },
    [chatCollectiveEnabled, mockUser.id],
  );

  const sendMockPrivate = useCallback(
    (peerId, text) => {
      const t = String(text || '').trim();
      if (!t || !peerId) return;
      const at = Date.now();
      const msg = {
        id: `w-${at}`,
        fromId: mockUser.id,
        toId: String(peerId),
        text: t,
        at,
      };
      setMockWhisperThreads((prev) => {
        const peer = String(peerId);
        const cur = prev[peer] || [];
        return { ...prev, [peer]: [...cur, msg] };
      });
    },
    [mockUser.id],
  );

  const isHost = scenario === 'host';

  return (
    <ProrasciencePublicPageShell simpleNav navTitle="Salle d'attente">
      <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col text-white">
        {liveSession.cover_image_url ? (
          <div
            className="pointer-events-none fixed inset-0 z-[1] bg-cover bg-center opacity-[0.12]"
            style={{ backgroundImage: `url(${liveSession.cover_image_url})` }}
          />
        ) : null}
        <div className="pointer-events-none fixed inset-0 z-[1] bg-gradient-to-b from-[#070b12]/50 via-[#070b12]/82 to-[#070b12]" />

        <div className="pointer-events-none fixed inset-0 z-[36]">
          <AmbientAudioLayer
            tracks={ambientTracks}
            enabled={ambientTracks.length > 0 && !['ended', 'cancelled'].includes(String(liveSession.status || ''))}
            masterVolume={0.22}
          />
        </div>

        <div className="relative z-[2] mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10">
          <ProrasciencePublicCard className="mb-8 border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
            <div className="mb-3 flex items-center gap-2 text-[#ebca5e]">
              <Palette className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Maquette design</span>
            </div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-white/45">
              Scénario affiché
            </label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--school-accent)_25%,transparent)]"
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="mt-3 text-[10px] leading-relaxed text-white/40">
              URL :{' '}
              <code className="rounded bg-black/50 px-1 py-0.5 text-[#ebca5e]/95">/live/waiting/maquette</code>{' '}
              — sans connexion. Prod :{' '}
              <code className="text-white/55">/live/waiting/&lt;uuid&gt;</code>. Les scénarios « invité » hors file
              simulent le statut <code className="text-white/55">lobby</code> (messagerie sans apparaitre comme « en
              attente » pour l'hôte).
            </p>
            <div className="mt-4 flex flex-wrap gap-4 border-t border-white/10 pt-4 text-[10px] text-white/55">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={showLiveDetails}
                  onChange={(e) => setShowLiveDetails(e.target.checked)}
                  className="rounded border-white/20 bg-black/40"
                />
                Détails encart (show_live_details)
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={showLivePlan}
                  onChange={(e) => setShowLivePlan(e.target.checked)}
                  className="rounded border-white/20 bg-black/40"
                />
                Programme (show_live_plan)
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={chatCollectiveEnabled}
                  onChange={(e) => setChatCollectiveEnabled(e.target.checked)}
                  className="rounded border-white/20 bg-black/40"
                />
                Forum session dans le panneau
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={ambientDemo}
                  onChange={(e) => setAmbientDemo(e.target.checked)}
                  className="rounded border-white/20 bg-black/40"
                />
                Fond sonore démo (piste externe)
              </label>
            </div>
          </ProrasciencePublicCard>

          <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:items-start">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="order-2 min-w-0 space-y-6 lg:order-1"
            >
              <div className="space-y-4 text-center lg:text-left">
                <div className="inline-flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--school-accent)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Salle d&apos;attente
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-black/35 px-3 py-1">
                    <Radio className="h-3 w-3 text-[#ebca5e]" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ebca5e]/95">
                      Live LIRI
                    </span>
                  </div>
                </div>

                <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{liveSession.title}</h1>

                <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <StatusBadge status={liveSession.status} />
                  {liveSession.scheduled_at && !sessionLive ? (
                    <Countdown scheduledAt={liveSession.scheduled_at} />
                  ) : null}
                </div>

                <div className="flex items-center justify-center gap-2.5 pt-1 lg:justify-start">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] to-[#6f4cff]/10 text-xs font-bold text-[#ebca5e]">
                    {displayNameInitials(liveSession.profiles.name)}
                  </div>
                  <span className="text-xs text-white/50">
                    Animé par <strong className="text-white/85">{liveSession.profiles.name}</strong>
                  </span>
                </div>

                <ProrasciencePublicCard className="border-cyan-500/20 bg-cyan-950/10 text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200/85">Messagerie</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">
                    Icône cyan en bas à droite : même panneau que sur le live (forum simulé ici, aparté vers le
                    formateur). Les envois restent locaux à la maquette.
                  </p>
                </ProrasciencePublicCard>
              </div>

              {waitingRoomAudioEnabled && mockEntry?.status !== 'rejected' ? <FakeAudioPreviewStrip /> : null}

              <AnimatePresence mode="wait">
                {isHost ? (
                  <motion.div key="host" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Button
                      type="button"
                      disabled
                      className="prs-cta-primary h-12 w-full rounded-2xl bg-[var(--school-accent)] text-sm font-bold text-black hover:bg-[#ebca5e]"
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Lancer la session
                    </Button>
                  </motion.div>
                ) : null}

                {!isHost && mockEntry && mockEntry.status !== 'accepted' && mockEntry.status !== 'lobby' ? (
                  <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <WaitingStatus entry={mockEntry} onCancel={() => {}} />
                  </motion.div>
                ) : null}

                {!isHost && mockEntry?.status === 'accepted' ? (
                  <motion.div
                    key="accepted"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <ProrasciencePublicCard className="border-emerald-500/35 bg-emerald-950/20">
                      <div className="flex items-center gap-4">
                        <CheckCircle2 className="h-7 w-7 flex-shrink-0 text-emerald-400" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">Accès accordé !</p>
                          <p className="text-xs text-white/50">Maquette — pas de redirection.</p>
                        </div>
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      </div>
                    </ProrasciencePublicCard>
                  </motion.div>
                ) : null}

                {!isHost && (!mockEntry || mockEntry.status === 'lobby') && scenario === 'free_live' ? (
                  <motion.div key="free" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Button
                      type="button"
                      disabled
                      className="prs-cta-primary h-12 w-full rounded-2xl bg-[var(--school-accent)] text-sm font-bold text-black hover:bg-[#ebca5e]"
                    >
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Rejoindre maintenant
                    </Button>
                  </motion.div>
                ) : null}

                {!isHost && (!mockEntry || mockEntry.status === 'lobby') && scenario === 'free_scheduled' ? (
                  <motion.div key="notstarted" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <ProrasciencePublicCard className="text-center">
                      <p className="text-sm text-white/50">
                        La session n&apos;a pas encore démarré. Revenez bientôt.
                      </p>
                    </ProrasciencePublicCard>
                  </motion.div>
                ) : null}

                {!isHost && (!mockEntry || mockEntry.status === 'lobby') && scenario === 'password' ? (
                  <motion.div key="password" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <ProrasciencePublicCard className="border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
                      <div className="mb-4 flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-[var(--school-accent)]" />
                        <p className="text-sm font-semibold text-white">Mot de passe requis</p>
                      </div>
                      <div className="relative mb-3">
                        <input
                          type={showPwd ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Mot de passe du live"
                          className="h-10 w-full rounded-xl border border-white/12 bg-black/45 px-4 pr-10 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65"
                        >
                          {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        type="button"
                        disabled
                        className="prs-cta-primary h-10 w-full rounded-xl bg-[var(--school-accent)] text-sm font-bold text-black hover:bg-[#ebca5e]"
                      >
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Valider
                      </Button>
                    </ProrasciencePublicCard>
                  </motion.div>
                ) : null}

                {!isHost && (!mockEntry || mockEntry.status === 'lobby') && (scenario === 'manual' || scenario === 'audio_welcome') ? (
                  <motion.div
                    key={scenario === 'audio_welcome' ? 'audio_manual' : 'manual'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                  >
                    <ProrasciencePublicCard className="border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)]">
                          <Lock className="h-4 w-4 text-[var(--school-accent)]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Validation par l&apos;hôte</p>
                          <p className="text-xs text-white/45">Ta demande est transmise au formateur.</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        disabled
                        className="prs-cta-primary h-10 w-full rounded-xl bg-[var(--school-accent)] text-sm font-bold text-black hover:bg-[#ebca5e]"
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Demander l&apos;accès
                      </Button>
                    </ProrasciencePublicCard>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {mockWelcome ? (
                <ProrasciencePublicCard className="border-white/10 bg-white/[0.04]">
                  <p className="text-xs italic leading-relaxed text-white/55">&quot;{mockWelcome}&quot;</p>
                </ProrasciencePublicCard>
              ) : null}

              <ProrasciencePublicCard className="border-amber-500/20 bg-amber-950/10">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/90" />
                  <p className="text-[10px] leading-relaxed text-white/45">
                    « Session introuvable » en prod : UUID invalide, ligne absente dans{' '}
                    <code className="text-white/60">live_sessions</code>, ou RLS. Ici tout est factice.
                  </p>
                </div>
              </ProrasciencePublicCard>
            </motion.div>

            <aside className="order-1 space-y-4 lg:sticky lg:top-24 lg:order-2 lg:self-start">
              <ProrasciencePublicCard className="overflow-hidden border-white/12 bg-black/40 p-0">
                {liveSession.cover_image_url ? (
                  <div className="aspect-video w-full bg-black/50">
                    <img
                      src={liveSession.cover_image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-[#1a1528] to-[#0d0f18] text-white/25">
                    <Radio className="h-10 w-10" />
                  </div>
                )}
                <div className="space-y-4 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]">Live</p>
                  {showLiveDetails && liveSession.description ? (
                    <p className="text-sm leading-relaxed text-white/60">{liveSession.description}</p>
                  ) : null}
                  {showLiveDetails ? (
                    <dl className="space-y-2 text-xs text-white/45">
                      {liveSession.scheduled_at ? (
                        <div className="flex gap-2">
                          <dt className="flex shrink-0 items-center gap-1 font-medium text-white/55">
                            <Calendar className="h-3.5 w-3.5 text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]" />
                            Début prévu
                          </dt>
                          <dd className="text-white/70">
                            {new Date(liveSession.scheduled_at).toLocaleString('fr-FR', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </dd>
                        </div>
                      ) : null}
                      {liveSession.duration_minutes ? (
                        <div className="flex gap-2">
                          <dt className="flex shrink-0 items-center gap-1 font-medium text-white/55">
                            <Clock className="h-3.5 w-3.5 text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]" />
                            Durée
                          </dt>
                          <dd className="text-white/70">{liveSession.duration_minutes} min</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                  {showLivePlan && planBlock ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200/85">
                        <BookOpen className="h-3.5 w-3.5" />
                        Programme
                      </p>
                      {planBlock.kind === 'text' ? (
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-white/55">{planBlock.value}</p>
                      ) : (
                        <ul className="list-inside list-disc space-y-1 text-xs text-white/55">
                          {planBlock.value.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
                    {liveSession.formation_id ? (
                      <Link
                        to={`/formation/${liveSession.formation_id}/forum`}
                        className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200/95 transition-colors hover:border-violet-400/45 hover:bg-violet-500/15"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        Forum de la formation
                      </Link>
                    ) : null}
                    <Link
                      to="/messages"
                      className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                    >
                      Messagerie (profil)
                    </Link>
                  </div>
                </div>
              </ProrasciencePublicCard>
            </aside>
          </div>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[50] flex justify-end p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto">
            <LiveHostFooterMessaging
              onOpenPanel={() => setShowMessagingPanel(true)}
              disabled={!chatCollectiveEnabled && hostMemberForPanel.length === 0}
              title="Messagerie — maquette (forum + aparté simulés)"
            />
          </div>
        </div>

        <LiveHostMessagingPanel
          open={showMessagingPanel}
          onClose={() => setShowMessagingPanel(false)}
          forumTarget={forumTarget}
          setForumTarget={setForumTarget}
          forumInput={forumInput}
          setForumInput={setForumInput}
          activeMembers={hostMemberForPanel}
          chatMessages={mockChatMessages}
          whisperThreads={mockWhisperThreads}
          user={mockUser}
          isGuestUi
          chatCollectiveEnabled={chatCollectiveEnabled}
          onSendCollective={(text) => void sendMockCollective(text)}
          onSendPrivate={(peerId, text) => void sendMockPrivate(peerId, text)}
          liveKitMediaEpoch={0}
          getLiveKitParticipant={() => null}
          hostMemberSearch={null}
        />
      </div>
    </ProrasciencePublicPageShell>
  );
}
