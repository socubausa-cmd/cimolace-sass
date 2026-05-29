/**
 * LiveWaitingRoomPage — Salle d'attente intelligente (LIRI / Smart Entry)
 * Route: /live/waiting/:sessionId
 *
 * Modes d'accès : free | password | manual | double
 * Fonctionnalités : audio preview, countdown, demande d'entrée, état temps réel
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Users, Lock, Radio, Mic, Eye, EyeOff,
  CheckCircle2, XCircle, Loader2, AlertTriangle,
  Volume2, VolumeX, ArrowRight, LogIn, KeyRound, Sparkles,
  MessageSquare, Calendar, BookOpen,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  ProrasciencePublicPageShell,
  ProrasciencePublicCard,
} from '@/components/prorascience/ProrasciencePublicPageShell';
import LiveHostMessagingPanel from '@/components/live-room/LiveHostMessagingPanel';
import LiveHostFooterMessaging from '@/components/live-room/LiveHostFooterMessaging';
import AmbientAudioLayer from '@/components/live-room/AmbientAudioLayer';
import WaitingRoomLivePreview from '@/components/live-room/WaitingRoomLivePreview';
import { CourseMindmapPanel } from '@/components/live-room/liri-host/CourseMindmapPanel';
import { buildLiveScenesFromUploadedSlides, normalizeLiveSceneToSlide } from '@/lib/liveSceneNormalize';
import { useLiveSessionWhispers } from '@/hooks/useLiveSessionWhispers';

function parseSessionConfig(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

function normalizeAmbientTracks(sess) {
  if (!sess) return [];
  if (Array.isArray(sess.ambient_tracks_json) && sess.ambient_tracks_json.length) return sess.ambient_tracks_json;
  const cfg = parseSessionConfig(sess.config);
  if (Array.isArray(cfg?.ambient_tracks) && cfg.ambient_tracks.length) return cfg.ambient_tracks;
  if (typeof cfg?.ambient_tracks_json === 'string' && cfg.ambient_tracks_json) {
    try {
      const p = JSON.parse(cfg.ambient_tracks_json);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Extrait un texte ou des lignes de « plan » depuis config studio */
export function planFromConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return null;
  const keys = ['live_plan', 'session_plan', 'programme', 'outline', 'agenda'];
  for (const k of keys) {
    const v = cfg[k];
    if (typeof v === 'string' && v.trim()) return { kind: 'text', value: v.trim() };
    if (Array.isArray(v) && v.length) {
      const lines = v.map((x) => (typeof x === 'string' ? x : x?.title || x?.label || '')).filter(Boolean);
      if (lines.length) return { kind: 'list', value: lines };
    }
  }
  return null;
}

/** Titres du déroulé SmartBoard (config studio) — pour mindmap salle d'attente, sans contenu détaillé. */
export function buildWaitingRoomMindmapSlides(cfg) {
  if (!cfg || typeof cfg !== 'object') return [];
  let initial = [];
  if (Array.isArray(cfg.smartboard_element_scenes) && cfg.smartboard_element_scenes.length > 0) {
    initial = [...cfg.smartboard_element_scenes].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
    );
  }
  const uploaded = buildLiveScenesFromUploadedSlides(cfg.smartboard_slides);
  if (uploaded.length) {
    initial = [...initial, ...uploaded].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
    );
  }
  return initial.map((scene, i) => {
    const norm = normalizeLiveSceneToSlide(scene);
    const title =
      (norm && norm.title)
      || scene?.name
      || scene?.label
      || `Étape ${i + 1}`;
    return { title };
  });
}

function WaitingRoomProgramRibbon({
  sessionLive,
  scheduledAt,
  startedAt,
  durationMinutes,
  currentStepIndex,
  slideCount,
}) {
  const [elapsedLabel, setElapsedLabel] = useState('');

  useEffect(() => {
    if (!sessionLive || !startedAt) {
      setElapsedLabel('');
      return undefined;
    }
    const tick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      const pad = (n) => String(n).padStart(2, '0');
      setElapsedLabel(h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionLive, startedAt]);

  const stepLine =
    slideCount > 0
      ? `Étape ${Math.min(slideCount, Math.max(1, currentStepIndex + 1))} / ${slideCount}`
      : null;

  return (
    <ProrasciencePublicCard className="border-white/10 bg-white/[0.03] text-left">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37]/90">Déroulé</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {sessionLive && startedAt && elapsedLabel ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200/95">
            <Radio className="h-3 w-3 shrink-0" />
            En direct depuis {elapsedLabel}
          </span>
        ) : null}
        {sessionLive && durationMinutes ? (
          <span className="text-[11px] text-white/45">Durée prévue · {durationMinutes} min</span>
        ) : null}
      </div>
      {stepLine ? (
        <p className="mt-2 text-xs text-white/70">
          <span className="text-white/45">Position dans le programme : </span>
          {stepLine}
        </p>
      ) : null}
    </ProrasciencePublicCard>
  );
}

export function displayNameInitials(name) {
  const init = String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return init || '?';
}

// ─── Countdown ─────────────────────────────────────────────────────────────────
export function Countdown({ scheduledAt }) {
  const [diff, setDiff] = useState(null);

  useEffect(() => {
    if (!scheduledAt) return;
    const tick = () => {
      const ms = new Date(scheduledAt) - Date.now();
      if (ms <= 0) { setDiff(null); return; }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setDiff({ h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  if (!diff) return null;

  const pad = (n) => String(n).padStart(2, '0');
  return (
    <div className="flex items-center gap-1 text-[#D4AF37]">
      <Clock className="w-4 h-4" />
      <span className="font-mono text-lg font-bold">
        {diff.h > 0 && `${pad(diff.h)}:`}{pad(diff.m)}:{pad(diff.s)}
      </span>
    </div>
  );
}

// ─── Statut badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    scheduled: { label: 'Planifié', color: 'text-blue-300 bg-blue-500/15 border-blue-500/30' },
    live:      { label: 'En cours', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30', pulse: true },
    ended:     { label: 'Terminé',  color: 'text-white/30 bg-white/5 border-white/10' },
    waiting:   { label: 'En attente', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30', pulse: true },
  };
  const s = map[status] || map.scheduled;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 h-6 px-3 rounded-full border text-[11px] font-medium',
      s.color
    )}>
      {s.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {s.label}
    </span>
  );
}

// ─── Audio preview player ──────────────────────────────────────────────────────
function AudioPreview({ sessionId, enabled }) {
  const [playing, setPlaying] = useState(false);
  const [error,   setError]   = useState(null);
  const audioRef = useRef(null);

  const toggle = useCallback(async () => {
    if (!enabled) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    try {
      // Obtenir un token audio-only (subscribe only) via la fonction netlify
      const res = await fetch('/.netlify/functions/livekit-get-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({ liveSessionId: sessionId, audioOnly: true }),
      });
      if (!res.ok) throw new Error('Token audio indisponible');
      // On utilise l'URL LiveKit WHIP/WHEP si disponible, sinon on informe
      setError('Audio preview disponible une fois dans la salle d\'attente active.');
    } catch (e) {
      setError(e.message);
    }
  }, [enabled, playing, sessionId]);

  if (!enabled) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#101729]/95 p-4 shadow-[0_16px_45px_rgba(0,0,0,0.3)] flex items-start gap-3 backdrop-blur-sm">
      <div className="w-9 h-9 rounded-full bg-[#D4AF37]/20 flex items-center justify-center flex-shrink-0 ring-1 ring-[#D4AF37]/25">
        <Volume2 className="w-4 h-4 text-[#ebca5e]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#ebca5e]">Aperçu audio actif</p>
        <p className="text-xs text-white/50 mt-0.5">
          Vous pouvez écouter le live en attendant votre admission.
        </p>
        {error && <p className="text-[11px] text-amber-400/70 mt-1">{error}</p>}
      </div>
      <button
        type="button"
        onClick={toggle}
        className="flex-shrink-0 h-8 px-3 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#ebca5e] text-xs hover:bg-[#D4AF37]/25 transition-colors"
      >
        {playing ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Panneau état attente ──────────────────────────────────────────────────────
export function WaitingStatus({ entry, onCancel }) {
  const statusMap = {
    waiting: {
      icon: Loader2,
      iconClass: 'animate-spin text-amber-400',
      title: 'En attente de validation',
      desc: 'Votre demande d\'entrée est transmise à l\'hôte. Veuillez patienter…',
      color: 'border-amber-500/20 bg-amber-500/5',
    },
    host_pending: {
      icon: Clock,
      iconClass: 'text-amber-400',
      title: 'L\'hôte examine votre demande',
      desc: 'L\'hôte va vous accepter ou vous contacter sous peu.',
      color: 'border-amber-500/20 bg-amber-500/5',
    },
    audio_only: {
      icon: Mic,
      iconClass: 'text-[#D4AF37]',
      title: 'Accès audio accordé',
      desc: 'Vous pouvez écouter la séance. L\'hôte peut vous donner accès complet à tout moment.',
      color: 'border-[#D4AF37]/20 bg-[#D4AF37]/5',
    },
    rejected: {
      icon: XCircle,
      iconClass: 'text-red-400',
      title: 'Accès refusé',
      desc: 'L\'hôte a refusé votre demande d\'entrée.',
      color: 'border-red-500/20 bg-red-500/5',
    },
  };

  const s = statusMap[entry?.status] || statusMap.waiting;
  const Icon = s.icon;

  return (
    <div className={cn('rounded-2xl border p-5 flex items-start gap-4', s.color)}>
      <Icon className={cn('w-6 h-6 flex-shrink-0 mt-0.5', s.iconClass)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{s.title}</p>
        <p className="text-xs text-white/50 mt-1 leading-relaxed">{s.desc}</p>
        {entry?.host_note && (
          <p className="text-xs text-white/70 mt-2 italic">"{entry.host_note}"</p>
        )}
      </div>
      {['waiting', 'host_pending'].includes(entry?.status) && (
        <button
          type="button"
          onClick={onCancel}
          className="flex-shrink-0 h-7 px-3 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs hover:text-white hover:border-white/20 transition-colors"
        >
          Annuler
        </button>
      )}
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function LiveWaitingRoomPage() {
  const { sessionId } = useParams();
  const navigate      = useNavigate();
  const { user, session: authSession } = useAuth();
  const { toast } = useToast();

  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState(null);
  const [liveSession, setSession]    = useState(null);
  const [rules,       setRules]      = useState(null);
  const [entry,       setEntry]      = useState(null); // waiting room entry
  const [invitation,  setInvitation] = useState(null);

  const [ambientTracks, setAmbientTracks] = useState([]);
  const [ambientMasterVolume] = useState(0.22);
  const [showMessagingPanel, setShowMessagingPanel] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [forumTarget, setForumTarget] = useState(null);
  const [forumInput, setForumInput] = useState('');

  const { threads: whisperThreads, sendWhisper } = useLiveSessionWhispers(sessionId, user?.id);

  // Formulaires
  const [password,    setPassword]   = useState('');
  const [showPwd,     setShowPwd]    = useState(false);
  const [pwdError,    setPwdError]   = useState(null);
  const [submitting,  setSubmitting] = useState(false);

  // ── Chargement initial ─────────────────────────────────────────────────────
  useEffect(() => {
    const uuidOk =
      typeof sessionId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);

    if (!sessionId) {
      setLoading(false);
      setError('Session introuvable.');
      return;
    }
    if (!uuidOk) {
      setLoading(false);
      setError(
        'Lien invalide : l\'identifiant dans l\'URL n\'est pas un UUID de session. Utilisez le lien d\'invitation ou la maquette locale /live/waiting/maquette pour le design.',
      );
      return;
    }
    if (!user) {
      setLoading(false);
      setError('Connectez-vous pour accéder à cette salle d\'attente.');
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        // Session
        const { data: sess, error: sErr } = await supabase
          .from('live_sessions')
          .select(
            'id, title, description, teacher_id, status, scheduled_at, started_at, access_mode, waiting_room_enabled, waiting_room_audio_enabled, cover_image_url, formation_id, duration_minutes, ambient_tracks_json, config, profiles:teacher_id(name, avatar_url)',
          )
          .eq('id', sessionId)
          .maybeSingle();
        if (sErr || !sess) {
          throw new Error(
            'Session introuvable ou inaccessible (vérifiez que la séance existe et que votre compte peut la lire — politiques RLS).',
          );
        }
        if (cancelled) return;
        setSession(sess);
        setAmbientTracks(normalizeAmbientTracks(sess));

        // Règles de visibilité
        const { data: r } = await supabase
          .from('live_visibility_rules')
          .select('*')
          .eq('live_session_id', sessionId)
          .maybeSingle();
        if (!cancelled) setRules(r);

        // Invitation personnelle
        const { data: inv } = await supabase
          .from('live_invitations')
          .select('*')
          .eq('live_session_id', sessionId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled) setInvitation(inv);

        // Entrée en salle d'attente existante
        const { data: e } = await supabase
          .from('live_waiting_room_entries')
          .select('*')
          .eq('live_session_id', sessionId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled) setEntry(e);

        // Marquer l'invitation comme vue
        if (inv && inv.status === 'sent') {
          supabase
            .from('live_invitations')
            .update({ status: 'seen', seen_at: new Date().toISOString() })
            .eq('id', inv.id)
            .then(() => {});
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId, user]);

  // ── Realtime : config / statut session (étape courante, horaires) ────────
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`waiting_live_session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: row.status != null ? row.status : prev.status,
              config: row.config !== undefined ? row.config : prev.config,
              started_at: row.started_at != null ? row.started_at : prev.started_at,
              scheduled_at: row.scheduled_at != null ? row.scheduled_at : prev.scheduled_at,
              duration_minutes: row.duration_minutes != null ? row.duration_minutes : prev.duration_minutes,
            };
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // ── Realtime : surveiller l'entrée en salle d'attente ─────────────────────
  useEffect(() => {
    if (!sessionId || !user) return;

    const channel = supabase
      .channel(`waiting_room_${sessionId}_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_waiting_room_entries',
          filter: `live_session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.new?.user_id === user.id) {
            setEntry(payload.new);
            // Rediriger si accepté
            if (payload.new.status === 'accepted') {
              setTimeout(() => navigate(`/live/${sessionId}`), 800);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, user, navigate]);

  // ── Rejoindre directement (accès libre ou hôte) ───────────────────────────
  const joinDirect = useCallback(() => {
    navigate(`/live/${sessionId}`);
  }, [navigate, sessionId]);

  // ── Soumettre mot de passe ─────────────────────────────────────────────────
  const submitPassword = useCallback(async () => {
    if (!password.trim()) return;
    setSubmitting(true);
    setPwdError(null);
    try {
      const res = await fetch('/.netlify/functions/livekit-check-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.access_token}`,
        },
        body: JSON.stringify({ liveSessionId: sessionId, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setPwdError('Mot de passe incorrect. Vérifiez et réessayez.');
        return;
      }
      // Mot de passe correct → rejoindre
      navigate(`/live/${sessionId}`);
    } catch {
      setPwdError('Erreur de connexion. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  }, [password, sessionId, authSession, navigate]);

  // ── Demander l'entrée (validation manuelle) ────────────────────────────────
  const requestEntry = useCallback(async () => {
    setSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from('live_waiting_room_entries')
        .select('id, status, invitation_type, joined_waiting_at')
        .eq('live_session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle();

      let effective = existing;

      if (existing?.status === 'lobby') {
        const { data: up, error: upErr } = await supabase
          .from('live_waiting_room_entries')
          .update({
            status: 'waiting',
            joined_waiting_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (!upErr && up) {
          effective = up;
          setEntry(up);
        }
      } else if (!existing) {
        const { data: newEntry, error: insErr } = await supabase
          .from('live_waiting_room_entries')
          .insert({
            live_session_id: sessionId,
            user_id: user.id,
            status: 'waiting',
            invitation_type: invitation?.invitation_type || 'individual',
            joined_waiting_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (insErr) throw insErr;
        effective = newEntry;
        setEntry(newEntry);
      } else {
        setEntry(existing);
        return;
      }

      if (liveSession?.teacher_id && effective?.status === 'waiting') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .maybeSingle();

        await supabase.from('live_notifications').insert({
          live_session_id: sessionId,
          user_id: liveSession.teacher_id,
          channel: 'dashboard',
          type: 'waiting_entry',
          title: 'Nouvelle demande d\'entrée',
          body: `${profile?.name || 'Un participant'} attend en salle d'attente.`,
          action_url: `/studio/live-arena/${sessionId}`,
          payload_json: {
            requester_id: user.id,
            requester_name: profile?.name || user.email,
            invitation_type: invitation?.invitation_type || 'individual',
          },
        });
      }
    } catch (err) {
      console.warn('[WaitingRoom] requestEntry:', err.message);
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, user, invitation, liveSession]);

  // ── Annuler la demande ─────────────────────────────────────────────────────
  const cancelRequest = useCallback(async () => {
    if (!entry) return;
    await supabase
      .from('live_waiting_room_entries')
      .update({ status: 'rejected' })
      .eq('id', entry.id);
    setEntry((e) => e ? { ...e, status: 'rejected' } : e);
  }, [entry]);

  // ── Déterminer le mode d'affichage ─────────────────────────────────────────
  const accessMode = liveSession?.access_mode || 'free';
  const isHost     = user?.id === liveSession?.teacher_id;
  const sessionLive = liveSession?.status === 'live';

  const sessionConfig = useMemo(() => parseSessionConfig(liveSession?.config), [liveSession?.config]);
  const chatCollectiveEnabled = sessionConfig.chat_enabled !== false;
  const mindmapSlides = useMemo(
    () => buildWaitingRoomMindmapSlides(sessionConfig),
    [sessionConfig],
  );
  const currentStepIndex = useMemo(() => {
    const n = Number(sessionConfig.current_step_index);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }, [sessionConfig.current_step_index]);
  const waitingPreviewSeconds = useMemo(() => {
    const n = Number(sessionConfig.waiting_room_preview_seconds);
    if (Number.isFinite(n) && n > 0) return n;
    return 12;
  }, [sessionConfig.waiting_room_preview_seconds]);
  const mindmapSlideIndex = useMemo(() => {
    if (!mindmapSlides.length) return 0;
    return Math.min(currentStepIndex, mindmapSlides.length - 1);
  }, [mindmapSlides.length, currentStepIndex]);
  const showProgramRibbon =
    sessionLive || mindmapSlides.length > 0 || Boolean(liveSession?.duration_minutes);
  const hostMemberForPanel = useMemo(() => {
    if (!liveSession?.teacher_id) return [];
    const name = liveSession.profiles?.name || 'Formateur';
    const init = String(name)
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'F';
    return [
      {
        id: liveSession.teacher_id,
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
  }, [liveSession]);

  const planBlock = useMemo(() => planFromConfig(sessionConfig), [sessionConfig]);
  const showLiveDetails = rules?.show_live_details !== false;
  const showLivePlan = rules?.show_live_plan === true;

  useEffect(() => {
    if (!sessionId || !user?.id || !liveSession || isHost) return;
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from('live_waiting_room_entries')
        .select('id, status')
        .eq('live_session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled || row) return;
      const { data: ins, error } = await supabase
        .from('live_waiting_room_entries')
        .insert({
          live_session_id: sessionId,
          user_id: user.id,
          status: 'lobby',
          invitation_type: invitation?.invitation_type || 'individual',
          joined_waiting_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (cancelled || error) return;
      if (ins) setEntry(ins);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, user?.id, liveSession, isHost, invitation?.invitation_type]);

  useEffect(() => {
    if (!sessionId || !user?.id || !liveSession) return;
    setChatMessages([]);
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('live_session_chat')
        .select('id, user_id, message, created_at')
        .eq('live_session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(500);
      if (cancelled || error) return;
      const ids = [...new Set((data || []).map((m) => m.user_id).filter(Boolean))];
      const { data: profs } = ids.length
        ? await supabase.from('profiles').select('id, name').in('id', ids)
        : { data: [] };
      const pmap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      setChatMessages(
        (data || []).map((m) => ({
          id: m.id,
          userId: m.user_id,
          text: m.message,
          name: pmap[m.user_id]?.name || 'Participant',
          time: m.created_at,
        })),
      );
    })();

    const ch = supabase
      .channel(`waiting-live-chat-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_session_chat',
          filter: `live_session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const m = payload.new;
          let name = 'Participant';
          const { data: prof } = await supabase.from('profiles').select('name').eq('id', m.user_id).maybeSingle();
          if (prof?.name) name = prof.name;
          setChatMessages((prev) => [...prev, { id: m.id, userId: m.user_id, text: m.message, name, time: m.created_at }]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [sessionId, user?.id, liveSession]);

  const sendChatMessage = useCallback(
    async (text) => {
      const t = String(text || '').trim();
      if (!t || !sessionId || !user?.id) return;
      if (!chatCollectiveEnabled) {
        toast({
          title: 'Forum de session désactivé',
          description: 'Le formateur a désactivé le chat collectif. Utilisez un message privé au formateur depuis le panneau messagerie.',
          variant: 'destructive',
        });
        return;
      }
      const { error } = await supabase.from('live_session_chat').insert({
        live_session_id: sessionId,
        user_id: user.id,
        message: t,
      });
      if (error) {
        toast({ title: 'Message non envoyé', description: String(error.message || error), variant: 'destructive' });
      }
    },
    [sessionId, user?.id, chatCollectiveEnabled, toast],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ProrasciencePublicPageShell simpleNav navTitle="Salle d&apos;attente">
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
        </div>
      </ProrasciencePublicPageShell>
    );
  }

  if (error) {
    return (
      <ProrasciencePublicPageShell simpleNav navTitle="Salle d&apos;attente">
        <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 px-4">
          <AlertTriangle className="h-10 w-10 text-red-400" />
          <p className="max-w-md text-center text-sm text-white/65">{error}</p>
        </div>
      </ProrasciencePublicPageShell>
    );
  }

  return (
    <ProrasciencePublicPageShell simpleNav navTitle="Salle d&apos;attente">
      <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col text-white">

      {/* ── Fond ambiant (au-dessus du shell) ── */}
      {liveSession?.cover_image_url && (
        <div
          className="pointer-events-none fixed inset-0 z-[1] bg-cover bg-center opacity-[0.12]"
          style={{ backgroundImage: `url(${liveSession.cover_image_url})` }}
        />
      )}
      <div className="pointer-events-none fixed inset-0 z-[1] bg-gradient-to-b from-[#070b12]/50 via-[#070b12]/82 to-[#070b12]" />

      <div className="pointer-events-none fixed inset-0 z-[36]">
        <AmbientAudioLayer
          tracks={ambientTracks}
          enabled={
            ambientTracks.length > 0 &&
            liveSession &&
            !['ended', 'cancelled'].includes(String(liveSession.status || '').toLowerCase())
          }
          masterVolume={ambientMasterVolume}
        />
      </div>

      {/* ── Contenu : colonne actions + encart couverture / détails / plan ── */}
      <div className="relative z-[2] mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="order-2 min-w-0 space-y-6 lg:order-1"
          >
          {/* En-tête session — aligné hero Prorascience */}
          <div className="space-y-4 text-center lg:text-left">
            <div className="inline-flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#D4AF37]">
                <Sparkles className="h-3.5 w-3.5" />
                Salle d&apos;attente
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-black/35 px-3 py-1">
                <Radio className="h-3 w-3 text-[#ebca5e]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ebca5e]/95">
                  Live LIRI
                </span>
              </div>
            </div>

            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
              {liveSession?.title || 'Session sans titre'}
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <StatusBadge status={liveSession?.status} />
              {liveSession?.scheduled_at && !sessionLive ? (
                <Countdown scheduledAt={liveSession.scheduled_at} />
              ) : null}
            </div>

            {liveSession?.profiles ? (
              <div className="flex items-center justify-center gap-2.5 pt-1 lg:justify-start">
                {liveSession.profiles.avatar_url ? (
                  <img src={liveSession.profiles.avatar_url} alt="" className="h-8 w-8 rounded-full border border-white/12 object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-gradient-to-br from-[#D4AF37]/25 to-[#6f4cff]/10 text-xs font-bold text-[#ebca5e]">
                    {displayNameInitials(liveSession.profiles.name)}
                  </div>
                )}
                <span className="text-xs text-white/50">
                  Animé par <strong className="text-white/85">{liveSession.profiles.name}</strong>
                </span>
              </div>
            ) : null}

            <ProrasciencePublicCard className="border-cyan-500/20 bg-cyan-950/10 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200/85">Messagerie</p>
              <p className="mt-1 text-xs leading-relaxed text-white/50">
                Icône cyan en bas à droite : même accès que sur le live hôte — fil de session (forum) et messages privés au formateur (connexion, audio, apartés).
              </p>
            </ProrasciencePublicCard>

            {showProgramRibbon ? (
              <WaitingRoomProgramRibbon
                sessionLive={sessionLive}
                scheduledAt={liveSession?.scheduled_at}
                startedAt={liveSession?.started_at}
                durationMinutes={liveSession?.duration_minutes}
                currentStepIndex={currentStepIndex}
                slideCount={mindmapSlides.length}
              />
            ) : null}

            {sessionLive && rules?.waiting_room_video_enabled && !isHost && entry?.status !== 'rejected' ? (
              <WaitingRoomLivePreview
                sessionId={sessionId}
                hostUserId={liveSession?.teacher_id}
                previewSeconds={waitingPreviewSeconds}
                enabled
              />
            ) : null}

            {mindmapSlides.length > 0 ? (
              <CourseMindmapPanel
                slides={mindmapSlides}
                slideIndex={mindmapSlideIndex}
                activeScene="smartboard"
                readOnly
              />
            ) : null}
          </div>

          {/* Audio preview */}
          {rules?.waiting_room_audio_enabled && entry?.status !== 'rejected' && (
            <AudioPreview sessionId={sessionId} enabled />
          )}

          {/* ── Panneau d'action selon le mode ── */}
          <AnimatePresence mode="wait">

            {/* Hôte → accès direct */}
            {isHost && (
              <motion.div key="host" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button
                  type="button"
                  onClick={joinDirect}
                  className="prs-cta-primary h-12 w-full rounded-2xl bg-[#D4AF37] text-sm font-bold text-black hover:bg-[#ebca5e]"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Lancer la session
                </Button>
              </motion.div>
            )}

            {/* File d'attente d'admission (pas le statut lobby = présence page uniquement) */}
            {!isHost && entry && entry.status !== 'accepted' && entry.status !== 'lobby' && (
              <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <WaitingStatus entry={entry} onCancel={cancelRequest} />
              </motion.div>
            )}

            {/* Accepté → redirection imminente */}
            {!isHost && entry?.status === 'accepted' && (
              <motion.div
                key="accepted"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <ProrasciencePublicCard className="border-emerald-500/35 bg-emerald-950/25">
                  <div className="flex items-center gap-4">
                    <CheckCircle2 className="h-7 w-7 flex-shrink-0 text-emerald-400" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">Accès accordé !</p>
                      <p className="text-xs text-white/50">Redirection en cours…</p>
                    </div>
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  </div>
                </ProrasciencePublicCard>
              </motion.div>
            )}

            {/* Accès libre */}
            {!isHost && (!entry || entry.status === 'lobby') && accessMode === 'free' && (
              <motion.div key="free" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {sessionLive ? (
                  <Button
                    type="button"
                    onClick={joinDirect}
                    className="prs-cta-primary h-12 w-full rounded-2xl bg-[#D4AF37] text-sm font-bold text-black hover:bg-[#ebca5e]"
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Rejoindre maintenant
                  </Button>
                ) : (
                  <ProrasciencePublicCard className="text-center">
                    <p className="text-sm text-white/50">
                      La session n&apos;a pas encore démarré. Revenez bientôt.
                    </p>
                  </ProrasciencePublicCard>
                )}
              </motion.div>
            )}

            {/* Mot de passe */}
            {!isHost && (!entry || entry.status === 'lobby') && (accessMode === 'password' || accessMode === 'double') && (
              <motion.div key="password" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <ProrasciencePublicCard className="border-[#D4AF37]/20">
                  <div className="mb-4 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-[#D4AF37]" />
                    <p className="text-sm font-semibold text-white">Mot de passe requis</p>
                  </div>
                  <div className="relative mb-3">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
                      placeholder="Mot de passe du live"
                      className="h-10 w-full rounded-xl border border-white/12 bg-black/45 px-4 pr-10 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-[#D4AF37]/45"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65"
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {pwdError ? <p className="mb-3 text-xs text-red-400">{pwdError}</p> : null}
                  <Button
                    type="button"
                    onClick={submitPassword}
                    disabled={submitting || !password.trim()}
                    className="prs-cta-primary h-10 w-full rounded-xl bg-[#D4AF37] text-sm font-bold text-black hover:bg-[#ebca5e] disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Valider
                  </Button>
                </ProrasciencePublicCard>
              </motion.div>
            )}

            {/* Validation manuelle */}
            {!isHost && (!entry || entry.status === 'lobby') && (accessMode === 'manual' || (accessMode === 'double' && !password)) && accessMode !== 'password' && (
              <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {sessionLive ? (
                  <ProrasciencePublicCard className="border-[#D4AF37]/20">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/15">
                        <Lock className="h-4 w-4 text-[#D4AF37]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Validation par l&apos;hôte</p>
                        <p className="text-xs text-white/45">Votre demande sera transmise au formateur.</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={requestEntry}
                      disabled={submitting}
                      className="prs-cta-primary h-10 w-full rounded-xl bg-[#D4AF37] text-sm font-bold text-black hover:bg-[#ebca5e] disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Users className="mr-2 h-4 w-4" />
                      )}
                      Demander l&apos;accès
                    </Button>
                  </ProrasciencePublicCard>
                ) : (
                  <ProrasciencePublicCard className="text-center">
                    <p className="text-sm text-white/50">La session n&apos;a pas encore démarré.</p>
                  </ProrasciencePublicCard>
                )}
              </motion.div>
            )}

          </AnimatePresence>

          {/* Message d'accueil personnalisé */}
          {rules?.welcome_message && (
            <ProrasciencePublicCard className="border-white/10 bg-white/[0.04]">
              <p className="text-xs italic leading-relaxed text-white/55">
                &quot;{rules.welcome_message}&quot;
              </p>
            </ProrasciencePublicCard>
          )}

          </motion.div>

          <aside className="order-1 space-y-4 lg:sticky lg:top-24 lg:order-2 lg:self-start">
            <ProrasciencePublicCard className="overflow-hidden border-white/12 bg-black/40 p-0">
              {liveSession?.cover_image_url ? (
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
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37]/90">Live</p>
                {showLiveDetails && liveSession?.description ? (
                  <p className="text-sm leading-relaxed text-white/60">{liveSession.description}</p>
                ) : null}
                {showLiveDetails ? (
                  <dl className="space-y-2 text-xs text-white/45">
                    {liveSession?.scheduled_at ? (
                      <div className="flex gap-2">
                        <dt className="flex shrink-0 items-center gap-1 font-medium text-white/55">
                          <Calendar className="h-3.5 w-3.5 text-[#D4AF37]/80" />
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
                    {liveSession?.duration_minutes ? (
                      <div className="flex gap-2">
                        <dt className="flex shrink-0 items-center gap-1 font-medium text-white/55">
                          <Clock className="h-3.5 w-3.5 text-[#D4AF37]/80" />
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
                  {liveSession?.formation_id ? (
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
            disabled={!user?.id || (!chatCollectiveEnabled && hostMemberForPanel.length === 0)}
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
        chatMessages={chatMessages}
        whisperThreads={whisperThreads}
        user={user}
        isGuestUi
        chatCollectiveEnabled={chatCollectiveEnabled}
        onSendCollective={(text) => void sendChatMessage(text)}
        onSendPrivate={(peerId, text) => {
          void (async () => {
            const r = await sendWhisper(peerId, text);
            if (r && !r.ok && r.error) {
              toast({
                title: 'Message privé',
                description: String(r.error.message || r.error),
                variant: 'destructive',
              });
            }
          })();
        }}
        liveKitMediaEpoch={0}
        getLiveKitParticipant={() => null}
        hostMemberSearch={null}
      />
    </div>
    </ProrasciencePublicPageShell>
  );
}
