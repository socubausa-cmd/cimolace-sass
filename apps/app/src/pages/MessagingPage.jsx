import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  MessageSquare,
  Search,
  Send,
  X,
  Users,
  Sparkles,
  Paperclip,
  Pencil,
  Trash2,
  Link2,
  Image as ImageIcon,
  Mic,
  Volume2,
  Video,
  MonitorUp,
  PhoneOff,
  Maximize2,
  Minimize2,
  PenTool,
  Circle,
  Square,
  Download,
  CalendarClock,
  BellRing,
  BellOff,
  Check,
  CheckCheck,
  PanelRightOpen,
  PanelRightClose,
  Layers3,
  Settings,
  Clapperboard,
  ArrowRight,
  Smartphone,
  HelpCircle,
  Radio,
  Hash,
  Lock,
  Globe,
  Plus,
  Unlock,
} from 'lucide-react';
import { useMessaging } from '@/contexts/MessagingContext';
import { useMessagingTopics } from '@/hooks/useMessagingTopics';
import { useTypingBroadcast } from '@/hooks/useTypingBroadcast';
import { RoomEvent, Track } from 'livekit-client';
import { useImmersiveLiveKit } from '@/hooks/useImmersiveLiveKit';
import { useLiriCompactLiveUiState } from '@/hooks/useLiriCompactLiveUiState';
import { useMobileLiriStore } from '@/stores/mobileLiriStore';
import { buildMaquettePlanRibbon, buildMaquetteSceneLineCaption } from '@/lib/liriMobilePlanRibbon';
import { GestureOverlayController } from '@/components/liri/liri-mobile/GestureOverlayController';
import { LiriMobileOverlaysRoot } from '@/components/liri/liri-mobile/LiriMobileOverlaysRoot';
import { LiriHeartBurst } from '@/components/liri/liri-mobile/LiriHeartBurst';
import { getAuxVideoTrackForSmartboard } from '@/lib/livekitCameraUtils';
import { normalizeLiveSceneToSlide } from '@/lib/liveSceneNormalize';
import {
  DEFAULT_SMARTBOARD_SCENE_FLAGS,
  mergeSmartboardSceneFlags,
  navigatorSceneIds,
  buildSmartboardNavigatorScenes,
} from '@/lib/smartboardNavigatorScenes';
import { SmartboardNavigatorSceneIcon } from '@/components/liri/live-room/SmartboardNavigatorSceneIcon';
import { useLiveInvite } from '@/hooks/useLiveInvite';
import { useLiveRoomPresence } from '@/hooks/useLiveRoomPresence';
import { useLiveQuestions } from '@/hooks/useLiveQuestions';
import { useLiveScript } from '@/hooks/useLiveScript';
import { usePostLiveSummary } from '@/hooks/usePostLiveSummary';
import LiveInviteNotification from '@/components/liri/live-room/LiveInviteNotification';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { runStorageWithAuthRetry } from '@/lib/supabaseResilience';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';
import { sanitizeAnnotationStrokesForBroadcast, ANNOTATION_BROADCAST_MAX_STROKES } from '@/lib/annotationStrokes';
import {
  whiteboardBroadcastPatch,
  mergeWhiteboardFromPayload,
  normalizeWhiteboardPages,
  WHITEBOARD_MAX_PAGES,
} from '@/lib/whiteboardPagesSync';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useLiveSessionWhispers } from '@/hooks/useLiveSessionWhispers';
import { createImmersiveCompanionLink } from '@/services/livekitApi';
import { QRCodeSVG } from 'qrcode.react';
import ImmersiveLiveStageBackdrop from '@/components/liri/live-room/ImmersiveLiveStageBackdrop';
import LiveRoomShell from '@/components/liri/live-room/LiveRoomShell';
import LiveSettingsPanel from '@/components/liri/live-room/LiveSettingsPanel';
import QuickAppointmentModal from '@/components/messaging/QuickAppointmentModal';
import PostCallReportModal from '@/components/messaging/PostCallReportModal';
import ScheduleCallModal from '@/components/messaging/ScheduleCallModal';
import { apiV2 } from '@/lib/api-v2';
import { authStore } from '@/lib/auth-store';
import PostLiveSummaryModal from '@/components/liri/live-room/PostLiveSummaryModal';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLiveDashboardNotifications } from '@/hooks/useLiveDashboardNotifications';

const statusColors = {
  online: 'bg-green-500',
  away: 'bg-amber-400',
  dnd: 'bg-red-400',
  offline: 'bg-gray-500',
};

const roleLabels = {
  owner: 'Directeur',
  teacher: 'Enseignant',
  student: 'Étudiant',
  admin: 'Admin',
  secretariat: 'Secrétariat',
  creator: 'Créateur',
};

const COMMON_CORRECTIONS = [
  [/\bsa va\b/gi, 'ça va'],
  [/\bca va\b/gi, 'ça va'],
  [/\bjai\b/gi, "j'ai"],
  [/\btes\b(?=\s+(pas|fautes?|raison|bien))/gi, "t'es"],
  [/\bsava\b/gi, 'ça va'],
];

function applyAutoCorrection(input) {
  let out = String(input || '');
  COMMON_CORRECTIONS.forEach(([pattern, replacement]) => {
    out = out.replace(pattern, replacement);
  });
  return out.replace(/\s{2,}/g, ' ').trim();
}

// Lecteur du replay : le message du Sujet porte l'URL STABLE de l'endpoint
// (/lives/:id/replay/file). On la fetche avec le Bearer de l'élève → l'API vérifie
// l'accès (fail-closed) et renvoie une URL R2 présignée FRAÎCHE (TTL court) qu'on
// joue. Le JWT n'est JAMAIS mis dans la balise <video>. Rétro-compat : si l'URL
// n'est pas l'endpoint (ancienne URL R2 présignée directe), on la joue telle quelle.
function ReplayPlayer({ apiUrl, label }) {
  const isEndpoint = /\/lives\/[^/]+\/replay\/file/.test(apiUrl);
  const [src, setSrc] = useState(isEndpoint ? null : apiUrl);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!isEndpoint) return undefined;
    let alive = true;
    (async () => {
      try {
        const token = (await supabase.auth.getSession())?.data?.session
          ?.access_token;
        const res = await fetch(apiUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        const url = body?.data?.url || body?.url || '';
        if (alive) url ? setSrc(url) : setFailed(true);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [apiUrl, isEndpoint]);
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-[var(--school-accent)]">{label}</p>
      {src ? (
        <video
          controls
          preload="metadata"
          className="w-full max-w-2xl mx-auto rounded-2xl border border-white/10 shadow-xl bg-black"
        >
          <source src={src} />
          Votre navigateur ne supporte pas la lecture vidéo.
        </video>
      ) : failed ? (
        <p className="text-xs text-gray-400">Replay indisponible.</p>
      ) : (
        <p className="text-xs text-gray-400">Chargement du replay…</p>
      )}
    </div>
  );
}

function renderMessageContent(content) {
  const value = String(content || '');
  const trimmed = value.trim();

  if (trimmed.includes('[image]')) {
    const src = trimmed.split('[image]')[1]?.trim() || '';
    if (!src) return <span>{value}</span>;
    return (
      <img
        src={src}
        alt="Image partagée"
        className="max-h-[380px] w-auto mx-auto rounded-2xl border border-white/10 shadow-xl"
      />
    );
  }
  if (trimmed.includes('[audio]')) {
    const src = trimmed.split('[audio]')[1]?.trim() || '';
    if (!src) return <span>{value}</span>;
    return (
      <audio controls className="mx-auto w-full max-w-md">
        <source src={src} />
        Votre navigateur ne supporte pas l'audio.
      </audio>
    );
  }
  // Forum connecté : le replay du live (posté par publishReplay dans le Sujet) se rend
  // comme un lecteur vidéo intégré, au fil du Sujet (à côté du chat + récap du neurone).
  if (trimmed.startsWith('📹 Replay du live')) {
    const url = (trimmed.match(/(https?:\/\/[^\s]+)/) || [])[1] || '';
    const label = trimmed.split('\n')[0];
    if (!url) {
      return (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[var(--school-accent)]">{label}</p>
          <p className="text-xs text-gray-400">Replay en cours de préparation…</p>
        </div>
      );
    }
    return <ReplayPlayer apiUrl={url} label={label} />;
  }

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = value.split(urlRegex);
  return (
    <>
      {parts.map((part, idx) => {
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={`${part}-${idx}`}
              href={part}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] text-[var(--school-accent)]"
            >
              {part}
            </a>
          );
        }
        return <span key={`${part}-${idx}`}>{part}</span>;
      })}
    </>
  );
}

function formatMessageTime(ts) {
  const d = new Date(ts);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Hier ${format(d, 'HH:mm')}`;
  return format(d, 'd MMM HH:mm', { locale: fr });
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatInviteDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return format(d, 'd MMM HH:mm', { locale: fr });
}

function formatDaySeparatorLabel(ts) {
  const d = new Date(ts);
  if (isToday(d)) return "Aujourd'hui";
  if (isYesterday(d)) return 'Hier';
  return format(d, 'EEEE d MMMM', { locale: fr });
}

/**
 * Construit la timeline (séparateurs de jour + groupage par expéditeur) d'une liste de
 * messages plats. Partagé par le fil DM 1:1 ET par le fil d'un Sujet (forum connecté),
 * pour que les Sujets bénéficient du même rendu immersif sans dupliquer la logique.
 */
function buildMessageTimeline(msgs) {
  const timeline = [];
  for (let i = 0; i < msgs.length; i += 1) {
    const msg = msgs[i];
    const prev = i > 0 ? msgs[i - 1] : null;
    const next = i < msgs.length - 1 ? msgs[i + 1] : null;

    const currentDay = format(new Date(msg.created_at), 'yyyy-MM-dd');
    const prevDay = prev ? format(new Date(prev.created_at), 'yyyy-MM-dd') : null;
    if (currentDay !== prevDay) {
      timeline.push({
        kind: 'separator',
        id: `sep-${currentDay}`,
        label: formatDaySeparatorLabel(msg.created_at),
      });
    }

    const prevSameSender =
      prev &&
      prev.sender_id === msg.sender_id &&
      (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60 * 1000 &&
      format(new Date(prev.created_at), 'yyyy-MM-dd') === currentDay;
    const nextSameSender =
      next &&
      next.sender_id === msg.sender_id &&
      (new Date(next.created_at).getTime() - new Date(msg.created_at).getTime()) < 5 * 60 * 1000 &&
      format(new Date(next.created_at), 'yyyy-MM-dd') === currentDay;

    let groupPosition = 'single';
    if (!prevSameSender && nextSameSender) groupPosition = 'start';
    else if (prevSameSender && nextSameSender) groupPosition = 'middle';
    else if (prevSameSender && !nextSameSender) groupPosition = 'end';

    timeline.push({
      kind: 'message',
      id: msg.id,
      index: i,
      message: msg,
      showIdentity: !prevSameSender,
      groupPosition,
    });
  }
  return timeline;
}

function isInviteAutoStartEligible(invite) {
  if (!invite) return false;
  if (invite.status !== 'accepted') return false;
  if (invite.started_at || invite.ended_at) return false;
  const acceptedAtMs = invite.accepted_at ? new Date(invite.accepted_at).getTime() : 0;
  if (!acceptedAtMs) return false;
  // Evite de relancer automatiquement un ancien live après refresh/reconnexion.
  return Date.now() - acceptedAtMs <= 45 * 1000;
}


function buildLiveAiSummary({ durationSec, participantName, modeLabel, usedScreenShare, notes, hasRecording }) {
  const noteLines = String(notes || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
  const corePoints = [
    `Session de ${formatDuration(durationSec)} avec ${participantName || 'un participant'}.`,
    `Mode dominant: ${modeLabel}.`,
    usedScreenShare ? "Un partage d'écran a été utilisé pendant la session." : "Aucun partage d'écran détecté.",
    hasRecording ? 'Un enregistrement est disponible (local/cloud).' : 'Aucun enregistrement finalisé.',
  ];
  if (noteLines.length > 0) {
    corePoints.push(`Notes clés: ${noteLines.join(' | ')}`);
  }
  return {
    title: 'Résumé IA de session',
    highlights: corePoints,
    nextActions: [
      'Envoyer le résumé aux participants.',
      'Transformer les notes en plan de suivi.',
      "Extraire 3 points d'action pour la prochaine session.",
    ],
  };
}

/** Défaut messagerie : Cam 2 comme Step 6 ; le reste suit DEFAULT + DB (smartboard_scenes_json). */
const IMMERSIVE_SMARTBOARD_SCENE_OVERLAY = { camera2: true };

function normalizeImmersiveSmartboardScenesJson(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  Object.keys(DEFAULT_SMARTBOARD_SCENE_FLAGS).forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(raw, k)) out[k] = Boolean(raw[k]);
  });
  return out;
}

function normalizeMessagingSharedGallery(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => {
      if (typeof item === 'string' && item.trim()) {
        return { url: item.trim(), label: `Visuel ${i + 1}` };
      }
      if (item && typeof item.url === 'string' && item.url.trim()) {
        return {
          url: item.url.trim(),
          label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : `Visuel ${i + 1}`,
        };
      }
      return null;
    })
    .filter(Boolean);
}

const DEFAULT_IMMERSIVE_SLIDES = [
  {
    id: 'slide_hero_impact',
    title: 'Hero impact',
    ia_data: {
      title: 'STUDIO LIVE IMMERSIF',
      core_idea: 'Présentez votre contenu avec une présence forte, claire et mémorable.',
    },
    styleVariant: 'academy',
    layoutType: 'hero-right',
    backgroundMode: 'immersive-dark',
    elements: [
      { id: 's1_t', type: 'title', content: 'STUDIO LIVE IMMERSIF', x: 54, y: 72, width: 960, height: 180, zIndex: 2, animation: 'fade-up' },
      { id: 's1_p', type: 'paragraph', content: 'Présentez votre contenu avec une présence forte, claire et mémorable.', x: 58, y: 270, width: 850, height: 120, zIndex: 3, animation: 'fade' },
      { id: 's1_b', type: 'badge', content: 'Mode Premium', x: 60, y: 402, width: 180, height: 36, zIndex: 4, animation: 'spotlight' },
    ],
  },
  {
    id: 'slide_visual_statement',
    title: 'Visual statement',
    ia_data: {
      title: 'UN MESSAGE FORT',
      core_idea: 'Transformez chaque live en expérience visuelle premium.',
    },
    styleVariant: 'premium-dark',
    layoutType: 'split',
    backgroundMode: 'immersive-dark',
    elements: [
      { id: 's2_t', type: 'title', content: 'UN MESSAGE FORT', x: 56, y: 74, width: 780, height: 150, zIndex: 2, animation: 'fade-up' },
      { id: 's2_p', type: 'paragraph', content: 'Transformez chaque live en expérience visuelle premium.', x: 58, y: 246, width: 760, height: 110, zIndex: 3, animation: 'fade' },
      { id: 's2_i', type: 'image', src: 'https://placehold.co/420x230/png?text=Vision', x: 580, y: 330, width: 420, height: 230, zIndex: 4, animation: 'spotlight' },
    ],
  },
  {
    id: 'slide_text_only',
    title: 'Texte',
    styleVariant: 'creator',
    layoutType: 'centered',
    backgroundMode: 'immersive-dark',
    elements: [
      { id: 's3_t', type: 'title', content: 'OBJECTIF DU LIVE', x: 56, y: 84, width: 900, height: 160, zIndex: 2, animation: 'fade-up' },
      { id: 's3_p', type: 'paragraph', content: 'Captiver. Expliquer. Faire agir.\n\nUne narration simple avec une lisibilité maximale et un rythme immersif.', x: 60, y: 270, width: 860, height: 230, zIndex: 3, animation: 'fade' },
    ],
  },
];

const SAMPLE_LIVE_PARTICIPANTS = [
  { id: 'sample-emma', name: 'Emma', avatar_url: 'https://i.pravatar.cc/200?img=32' },
  { id: 'sample-pierre', name: 'Pierre', avatar_url: 'https://i.pravatar.cc/200?img=12' },
  { id: 'sample-nicolas', name: 'Nicolas', avatar_url: 'https://i.pravatar.cc/200?img=15' },
  { id: 'sample-lara', name: 'Lara', avatar_url: 'https://i.pravatar.cc/200?img=47' },
  { id: 'sample-julien', name: 'Julien', avatar_url: 'https://i.pravatar.cc/200?img=14' },
  { id: 'sample-selma', name: 'Selma', avatar_url: 'https://i.pravatar.cc/200?img=44' },
];

function UserAvatar({ user, size = 'md' }) {
  const s = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm';
  if (user?.avatar_url || user?.avatar) {
    return (
      <img
        src={user.avatar_url || user.avatar}
        alt={user.name}
        className={cn(s, 'rounded-full object-cover ring-1 ring-white/10')}
      />
    );
  }
  const initials = (user?.name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={cn(
        s,
        'rounded-full bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] to-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center font-semibold text-white ring-1 ring-white/10'
      )}
    >
      {initials}
    </div>
  );
}

function OnlineDot({ status, className }) {
  return (
    <span
      className={cn(
        'block w-2.5 h-2.5 rounded-full ring-2 ring-[#0c1118]',
        statusColors[status] || statusColors.offline,
        className
      )}
    />
  );
}

function ImmersiveMessage({
  message,
  isOwn,
  senderProfile,
  isLatest,
  justSent,
  isActive = false,
  groupPosition = 'single',
  showIdentity = true,
  isDarkTheme = true,
  onDelete,
  onEdit,
  onRequestDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(message.content);
    setEditing(false);
  }, [message.id, message.content]);

  const handleSaveEdit = async () => {
    const t = draft.trim();
    if (!t || t === message.content) {
      setEditing(false);
      setDraft(message.content);
      return;
    }
    setSaving(true);
    const ok = await onEdit?.(message.id, t);
    setSaving(false);
    if (ok) setEditing(false);
  };

  const speakMessage = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const content = String(message.content || '');
    if (content.startsWith('[audio]') || content.startsWith('[image]')) return;
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex w-full gap-3 px-4 md:px-8',
        isOwn ? 'justify-end' : 'justify-start',
        groupPosition === 'start' || groupPosition === 'single' ? 'pt-2.5 pb-0.5' : 'py-0.5',
        groupPosition === 'end' || groupPosition === 'single' ? 'pb-2.5' : ''
      )}
    >
      {!isOwn && showIdentity ? <UserAvatar user={senderProfile} size="sm" /> : !isOwn ? <span className="w-8" /> : null}
      <div className={cn('max-w-[82%] md:max-w-[70%] group', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn && showIdentity && (
          <p className="text-[10px] text-gray-500 mb-1 ml-1">
            {senderProfile?.name || 'Interlocuteur'}
          </p>
        )}
        <div
            className={cn(
            'px-3.5 py-2.5 text-sm leading-relaxed border shadow-sm',
            isOwn
              ? 'bg-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_34%,transparent)] text-[#f7eede]'
              : 'bg-white/[0.07] border-white/[0.10] text-gray-100',
            groupPosition === 'single' && 'rounded-2xl',
            groupPosition === 'start' && (isOwn ? 'rounded-t-2xl rounded-bl-2xl rounded-br-md' : 'rounded-t-2xl rounded-br-2xl rounded-bl-md'),
            groupPosition === 'middle' && (isOwn ? 'rounded-l-2xl rounded-r-md' : 'rounded-r-2xl rounded-l-md'),
            groupPosition === 'end' && (isOwn ? 'rounded-b-2xl rounded-tl-2xl rounded-tr-md' : 'rounded-b-2xl rounded-tr-2xl rounded-tl-md'),
            isActive && 'ring-1 ring-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]'
          )}
        >
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full rounded-lg border text-sm p-2.5 outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] resize-y min-h-[90px] bg-black/20 border-white/15 text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setEditing(false); setDraft(message.content); }}
                  className="px-3 py-1.5 rounded-md text-xs text-gray-400 hover:bg-white/5"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={saving || !draft.trim()}
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 rounded-md text-xs bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] disabled:opacity-40"
                >
                  {saving ? '…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'break-words',
                justSent && 'animate-pulse'
              )}
            >
              {renderMessageContent(message.content)}
            </div>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 px-1">
          <span className={cn('text-[10px]', isDarkTheme ? 'text-gray-500' : 'text-gray-500')}>
            {formatMessageTime(message.created_at)}
          </span>
          {isOwn && (
            <CheckCheck
              className="h-3.5 w-3.5 text-[color-mix(in_srgb,var(--school-accent)_75%,transparent)]"
              aria-label={isLatest ? 'Lu' : 'Envoyé'}
            />
          )}
          {!editing && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <button
                type="button"
                onClick={speakMessage}
                className="inline-flex items-center gap-1 h-6 px-1.5 rounded text-[10px] text-gray-400 hover:text-white hover:bg-white/5"
                aria-label="Lire en audio"
              >
                <Volume2 className="w-3 h-3" />
              </button>
              {isOwn && onEdit && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 h-6 px-1.5 rounded text-[10px] text-gray-400 hover:text-[var(--school-accent)] hover:bg-white/5"
                  aria-label="Modifier le message"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {isOwn && onDelete && (
                <button
                  type="button"
                  onClick={() => onRequestDelete?.(message)}
                  className="inline-flex items-center gap-1 h-6 px-1.5 rounded text-[10px] text-red-400/90 hover:bg-red-500/10"
                  aria-label="Supprimer le message"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {isOwn && showIdentity ? <UserAvatar user={senderProfile} size="sm" /> : isOwn ? <span className="w-8" /> : null}
    </motion.div>
  );
}

function TypingOverlay({ remoteText, isTyping, senderProfile }) {
  if (!isTyping) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 md:px-16 text-center pointer-events-none"
    >
      <div className="mb-3 opacity-50">
        <UserAvatar user={senderProfile} size="lg" />
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500/60 mb-3">
        {senderProfile?.name || 'Quelqu\'un'} écrit…
      </p>
      <p className="text-2xl md:text-3xl lg:text-4xl font-serif text-white/30 max-w-3xl leading-relaxed">
        {remoteText || (
          <span className="inline-flex gap-1">
            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>
              .
            </motion.span>
            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}>
              .
            </motion.span>
            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}>
              .
            </motion.span>
          </span>
        )}
      </p>
    </motion.div>
  );
}

function EmptyState({ onOpenPicker, conversations, onSelectConversation }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center text-center px-6 py-12 h-full"
    >
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] to-[color-mix(in_srgb,var(--school-accent)_9%,transparent)] border border-white/10 flex items-center justify-center mb-6">
        <MessageSquare className="w-9 h-9 text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Messagerie immersive</h2>
      <p className="text-sm text-gray-400 max-w-sm mb-6">
        Sélectionnez un membre pour commencer ou reprendre une conversation en temps réel.
      </p>

      {conversations.length > 0 && (
        <div className="w-full max-w-sm mb-6 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Conversations récentes</p>
          {conversations.slice(0, 4).map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] hover:bg-white/[0.07] transition-all text-left group"
            >
              <UserAvatar user={conv} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate group-hover:text-[var(--school-accent)] transition-colors">{conv.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{conv.lastMessage?.content || '—'}</p>
              </div>
              {conv.unreadCount > 0 && (
                <span className="flex-shrink-0 h-5 min-w-5 rounded-full bg-[var(--school-accent)] text-[10px] font-bold text-black flex items-center justify-center px-1">
                  {conv.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onOpenPicker}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-[var(--school-accent)] text-sm font-medium hover:bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] transition-all"
      >
        <Users className="w-4 h-4" />
        Choisir un destinataire
      </button>
    </motion.div>
  );
}

function NoMessagesState({ recipientName }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-full text-center px-6"
    >
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <Sparkles className="w-7 h-7 text-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]" />
      </div>
      <p className="text-gray-400 text-sm">
        Aucun message avec <span className="text-white font-medium">{recipientName}</span>
      </p>
      <p className="text-gray-600 text-xs mt-1">Écrivez le premier message ci-dessous.</p>
    </motion.div>
  );
}

function ImmersiveComposer({
  onSend,
  onOpenPicker,
  selectedRecipient,
  onClearRecipient,
  onTyping,
  onToggleVideo,
  onScheduleCall,
  liveActive,
  liveEnabled,
  liveActionsOpen,
  onToggleLiveActions,
  liveSettingsOpen,
  onToggleLiveSettings,
  /** false = masque la rangée « Partager live / produit / … » (live immersif type arène) */
  showQuickShareLinks = true,
  /** Placeholder du champ (ex. live face-à-face) */
  messagePlaceholder,
  /** Envoi vers le forum live (barre du bas) — désactive le champ pendant l'envoi */
  forumSending = false,
  /** Séparateur lumineux type maquette au-dessus de la barre */
  immersiveLiveComposerChrome = false,
  /** SUJET : autorise l'envoi sans destinataire 1:1 (le fil cible est le sujet ouvert) */
  allowSendWithoutRecipient = false,
}) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [pendingAudioSrc, setPendingAudioSrc] = useState('');
  const [pendingImageSrc, setPendingImageSrc] = useState('');
  // Rangée « Partager un lien » repliée par défaut (déclutter) : une seule pastille, on
  // déploie les 5 liens à la demande au lieu de les afficher en permanence.
  const [shareOpen, setShareOpen] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const insertText = (snippet) => {
    const next = text ? `${text}\n${snippet}` : snippet;
    setText(next);
    onTyping?.(next);
  };

  const makeAbsolute = (path) => {
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path}`;
  };

  const quickLinks = [
    { id: 'live', label: 'Partager un live', value: makeAbsolute('/classroom/live') },
    { id: 'module', label: 'Partager un module', value: makeAbsolute('/modules') },
    { id: 'payment', label: 'Partager paiement', value: makeAbsolute('/paiements/tarifs') },
    { id: 'product', label: 'Partager produit', value: makeAbsolute('/boutique') },
    { id: 'page', label: 'Partager cette page', value: typeof window !== 'undefined' ? window.location.href : '' },
  ];

  const handleImagePick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      setPendingImageSrc(src);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const toggleAudioRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      setRecordingSec(0);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const src = String(reader.result || '');
          setPendingAudioSrc(src);
          setPendingImageSrc('');
        };
        reader.readAsDataURL(blob);
        streamRef.current?.getTracks?.().forEach((t) => t.stop());
        streamRef.current = null;
      };
      rec.start();
      mediaRecorderRef.current = rec;
      streamRef.current = stream;
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  useEffect(() => {
    if (!recording) return undefined;
    const id = setInterval(() => setRecordingSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop?.();
      } catch {
        // ignore
      }
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    };
  }, []);

  const handleSend = async () => {
    const trimmed = text.trim();
    const payload =
      pendingAudioSrc
        ? `[audio]${pendingAudioSrc}`
        : pendingImageSrc
          ? `[image]${pendingImageSrc}`
          : trimmed;
    if (!payload) return;
    if (!selectedRecipient && !allowSendWithoutRecipient) {
      onOpenPicker?.();
      return;
    }
    const corrected =
      pendingAudioSrc || pendingImageSrc ? payload : applyAutoCorrection(payload);
    const sent = await onSend(corrected);
    if (!sent) return;
    setText('');
    setPendingAudioSrc('');
    setPendingImageSrc('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const canSend = Boolean(text.trim() || pendingAudioSrc || pendingImageSrc) && !forumSending;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    onTyping?.(val);
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  };

  return (
    <div
      className={cn(
        'relative z-30 px-4 pb-1 pt-1.5 md:px-8',
        immersiveLiveComposerChrome && 'border-t border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-gradient-to-t from-black/50 via-[#070a10]/80 to-transparent pt-3 shadow-[0_-12px_40px_-28px_rgba(212,175,55,0.35)]',
      )}
    >
      {/* Recipient chip */}
      <AnimatePresence>
        {selectedRecipient && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
            className="mb-1.5 flex items-center gap-2"
          >
            <div className="inline-flex items-center gap-2 h-7 pl-1.5 pr-3 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
              <UserAvatar user={selectedRecipient} size="sm" />
              <span className="text-xs font-medium text-[var(--school-accent)]">{selectedRecipient.name}</span>
              <button onClick={onClearRecipient} className="ml-1 text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] hover:text-[var(--school-accent)]">
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showQuickShareLinks ? (
        <div className="mb-1.5">
          {shareOpen ? (
            <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                aria-label="Replier le partage"
                className="flex-shrink-0 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-gray-400 hover:text-[var(--school-accent)] hover:bg-white/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              {quickLinks.map((item) => (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={() => { insertText(item.value); setShareOpen(false); }}
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex-shrink-0 h-7 px-3 rounded-full text-[11px] border backdrop-blur-md transition-all whitespace-nowrap',
                    item.id === 'payment'
                      ? 'text-[var(--school-accent)] border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] shadow-[0_8px_20px_-14px_rgba(212,175,55,0.8)]'
                      : 'text-gray-400 border-white/10 bg-white/[0.03] hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] hover:text-[var(--school-accent)] hover:bg-white/5'
                  )}
                >
                  <Link2 className="w-3 h-3 inline mr-1 opacity-60" />
                  {item.label}
                </motion.button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] text-gray-400 border border-white/10 bg-white/[0.03] hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] hover:text-[var(--school-accent)] hover:bg-white/5 transition-all"
            >
              <Link2 className="w-3 h-3 opacity-60" /> Partager un lien
            </button>
          )}
        </div>
      ) : null}

      {/* Pending media chip */}
      <AnimatePresence>
        {(pendingAudioSrc || pendingImageSrc) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="mb-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-1 flex items-center justify-between gap-2"
          >
            <p className="text-[11px] text-gray-300 truncate">
              {pendingAudioSrc ? 'Audio prêt' : 'Image prête'} à envoyer
            </p>
            <button
              type="button"
              onClick={() => { setPendingAudioSrc(''); setPendingImageSrc(''); }}
              className="h-6 px-2 rounded-lg text-[10px] text-gray-400 border border-white/10 hover:bg-white/5 flex-shrink-0"
            >
              Retirer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording animation */}
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="mb-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[11px] text-red-200 font-medium">REC {recordingSec}s</span>
            </div>
            <div className="flex items-end gap-1 h-3.5">
              {[0, 1, 2, 3, 4].map((b) => (
                <motion.span
                  key={b}
                  className="w-1 rounded bg-red-300/80"
                  animate={{ height: [3, 10, 5, 12, 4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: b * 0.08 }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main toolbar */}
      <div className="relative flex items-center gap-1.5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.09] via-white/[0.04] to-white/[0.03] backdrop-blur-xl px-2.5 py-2 focus-within:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] shadow-[0_16px_40px_-24px_rgba(0,0,0,0.95)] transition-colors">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_70%_0%,rgba(212,175,55,0.12),transparent_38%)]" />
        <button
          type="button"
          onClick={onOpenPicker}
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-[var(--school-accent)] hover:bg-white/5 transition-all"
          aria-label="Membres"
          title="Sélectionner un membre"
        >
          <Users className="w-4 h-4" />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          spellCheck
          autoCorrect="on"
          autoCapitalize="sentences"
          placeholder={
            messagePlaceholder
              || (selectedRecipient
                ? `Message à ${selectedRecipient.name}…`
                : 'Commencer une conversation…')
          }
          disabled={forumSending}
          className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 resize-none outline-none max-h-36 py-1 leading-relaxed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
          aria-label="Partager une image"
          title="Envoyer une image"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={toggleAudioRecording}
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all',
            recording ? 'bg-red-500/15 text-red-300' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          )}
          aria-label="Message audio"
          title="Enregistrer un message audio"
        >
          <Mic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => { if (!liveEnabled) return; onToggleVideo?.(); }}
          disabled={!liveEnabled}
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all',
            !liveEnabled
              ? 'bg-white/[0.03] text-gray-700 cursor-not-allowed'
              : liveActive
              ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] ring-1 ring-[color-mix(in_srgb,var(--school-accent)_35%,transparent)]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          )}
          aria-label="Live vidéo"
          title={liveEnabled ? 'Basculer en live vidéo' : 'Sélectionnez une conversation pour lancer le live'}
        >
          <Video className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onScheduleCall?.()}
          disabled={!selectedRecipient}
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all',
            !selectedRecipient
              ? 'bg-white/[0.03] text-gray-700 cursor-not-allowed'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          )}
          aria-label="Programmer un appel"
          title={selectedRecipient ? 'Programmer un appel' : 'Sélectionnez une conversation'}
        >
          <CalendarClock className="w-4 h-4" />
        </button>
        {liveActive ? (
          <button
            type="button"
            onClick={onToggleLiveSettings}
            className={cn(
              'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all',
              liveSettingsOpen
                ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] ring-1 ring-[color-mix(in_srgb,var(--school-accent)_35%,transparent)]'
                : 'text-gray-400 hover:text-[var(--school-accent)] hover:bg-white/5'
            )}
            aria-label="Paramètres live"
            title="Paramètres vidéo, audio, SmartBoard"
          >
            <Settings className="w-4 h-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center transition-all',
            immersiveLiveComposerChrome ? 'h-9 w-9 rounded-full' : 'rounded-xl',
            canSend
              ? immersiveLiveComposerChrome
                ? 'bg-[var(--school-accent)] text-black shadow-[0_0_22px_-6px_rgba(212,175,55,0.85)] hover:bg-[#e5c04a]'
                : 'bg-[var(--school-accent)] text-black hover:bg-[#e5c04a]'
              : 'bg-white/5 text-gray-600',
          )}
          aria-label="Envoyer"
          title="Envoyer le message"
        >
          <Send className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImagePick}
        />
      </div>
    </div>
  );
}

// ── Mac Dock for Live Actions ─────────────────────────────────────────────────
function DockItem({
  mouseX,
  containerRef,
  icon,
  label,
  /** Infobulle ; par défaut = label */
  hintTitle,
  active,
  danger,
  onClick,
  disabled = false,
}) {
  const tip = hintTitle ?? label;
  const ref = useRef(null);
  const distance = useMotionValue(Infinity);

  useEffect(() => {
    const update = (x) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      distance.set(Math.abs(x - center));
    };
    const el = containerRef?.current;
    if (!el) return;
    const handler = (e) => update(e.clientX);
    const reset = () => distance.set(Infinity);
    el.addEventListener('mousemove', handler);
    el.addEventListener('mouseleave', reset);
    return () => { el.removeEventListener('mousemove', handler); el.removeEventListener('mouseleave', reset); };
  }, [containerRef, distance]);

  const scale = useTransform(distance, [0, 50, 100], [1.65, 1.3, 1], { clamp: true });
  const scaleSpring = useSpring(scale, { stiffness: 300, damping: 22 });

  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{ scale: disabled ? 1 : scaleSpring, originY: 1 }}
      whileHover={disabled ? {} : { y: -4 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      className={cn(
        'flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border text-[9px] font-medium shadow-[0_10px_18px_-16px_rgba(0,0,0,0.9)] transition-colors origin-bottom',
        disabled && 'cursor-not-allowed opacity-40',
        !disabled && danger
          ? 'bg-red-500/20 border-red-400/30 text-red-200 hover:bg-red-500/30'
          : !disabled && active
            ? 'bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)] shadow-[0_10px_24px_-12px_rgba(212,175,55,0.8)]'
            : !disabled
              ? 'bg-white/[0.05] border-white/12 text-white/75 hover:bg-white/10'
              : 'border-white/10 bg-white/[0.04] text-white/40'
      )}
      title={tip}
    >
      {icon}
      <span className="max-w-[3.25rem] truncate leading-none">{label}</span>
    </motion.button>
  );
}

function LiveActionDock({
  liveMuted,
  liveCameraOff,
  sharingScreen,
  liveSpotlightOn,
  liveMessageUnread,
  liveMessageDrawerOpen,
  liveSettingsOpen,
  onToggleMute,
  onToggleCamera,
  onToggleShare,
  onToggleSpotlight,
  onToggleChat,
  onToggleSettings,
  onStop,
  showPhoneCompanion,
  onPhoneCompanion,
  /** Messagerie 1:1 : le fil est au centre, pas de panneau chat latéral */
  hideChatDockButton = false,
  /** Invité : NeuronQ à côté du bouton Forum */
  showNeuronQGuest = false,
  liveNeuronqModalOpen = false,
  onToggleNeuronQ,
  /** Boutons scène type joker (SmartBoard) */
  navigatorScenes = [],
  activeScene = 'diapo',
  onSelectScene,
  /** Invité : scènes pilotées par l'hôte */
  scenesLocked = false,
  /** Face-à-face : pas de SmartBoard visible — masquer les raccourcis scène */
  hideSceneNavigator = false,
}) {
  const containerRef = useRef(null);
  const chatButton = {
    icon: (
      <span className="relative inline-flex">
        <MessageSquare className="w-4 h-4" />
        {liveMessageUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-3.5 min-w-3.5 rounded-full bg-[var(--school-accent)] text-[8px] font-bold text-black flex items-center justify-center px-0.5">
            {liveMessageUnread > 9 ? '9+' : liveMessageUnread}
          </span>
        )}
      </span>
    ),
    label: 'Forum',
    hintTitle: liveMessageDrawerOpen
      ? 'Fermer le forum (messages publics)'
      : 'Forum live — messages publics pour toute la salle',
    active: liveMessageDrawerOpen,
    onClick: onToggleChat,
  };
  const neuronQDockButton = {
    icon: <HelpCircle className="h-4 w-4 text-amber-200/90" strokeWidth={2} />,
    label: 'NeuronQ',
    hintTitle: liveNeuronqModalOpen
      ? 'Fermer la question pour le formateur'
      : 'Poser une question — reformulation IA pour le formateur',
    active: liveNeuronqModalOpen,
    onClick: onToggleNeuronQ,
  };
  const buttons = [
    { icon: <Mic className="w-4 h-4" />, label: liveMuted ? 'Micro OFF' : 'Micro', active: liveMuted, onClick: onToggleMute },
    { icon: <Video className="w-4 h-4" />, label: liveCameraOff ? 'Cam OFF' : 'Cam', active: liveCameraOff, onClick: onToggleCamera },
    { icon: <MonitorUp className="w-4 h-4" />, label: sharingScreen ? 'Stop Écran' : 'Partager', active: sharingScreen, onClick: onToggleShare },
    ...(showPhoneCompanion
      ? [{ icon: <Smartphone className="w-4 h-4" />, label: 'QR tel.', active: false, onClick: onPhoneCompanion }]
      : []),
    { icon: <Sparkles className="w-4 h-4" />, label: 'Spotlight', active: liveSpotlightOn, onClick: onToggleSpotlight },
    ...(hideChatDockButton ? [] : [chatButton]),
    ...(showNeuronQGuest && typeof onToggleNeuronQ === 'function' ? [neuronQDockButton] : []),
    { icon: <Settings className="w-4 h-4" />, label: 'Param', active: liveSettingsOpen, onClick: onToggleSettings },
    { icon: <PhoneOff className="w-4 h-4" />, label: 'Stop', danger: true, onClick: onStop },
  ];

  return (
    <div
      ref={containerRef}
      className="relative mb-1.5 flex flex-wrap items-end justify-center gap-x-2 gap-y-1.5 rounded-[20px] border border-white/10 bg-[#0c1425]/75 px-3 py-2 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.14),transparent_42%)]" />
      {buttons.map((btn, i) => (
        <DockItem
          key={i}
          mouseX={null}
          containerRef={containerRef}
          icon={btn.icon}
          label={btn.label}
          hintTitle={btn.hintTitle}
          active={btn.active}
          danger={btn.danger}
          onClick={btn.onClick}
        />
      ))}
      {!hideSceneNavigator && navigatorScenes.length > 0 ? (
        <>
          <div className="mx-0.5 hidden h-9 w-px flex-shrink-0 self-center bg-white/15 sm:block" aria-hidden />
          <div className="flex max-w-[min(92vw,560px)] flex-shrink-0 items-end justify-center gap-1.5 overflow-x-auto overflow-y-visible py-0.5 [scrollbar-width:thin]">
            <span className="sr-only">Scènes SmartBoard</span>
            {navigatorScenes.map((scene) => (
              <DockItem
                key={scene.id}
                mouseX={null}
                containerRef={containerRef}
                icon={<SmartboardNavigatorSceneIcon sceneId={scene.id} className="h-4 w-4" />}
                label={scene.label}
                hintTitle={scene.hint ? `${scene.label} — ${scene.hint}` : scene.label}
                active={activeScene === scene.id}
                disabled={scenesLocked}
                onClick={() => onSelectScene?.(scene.id)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MemberPickerPanel({ open, onClose, users, currentUserId, conversations, onSelectUser, onSelectConversation, onReload, loading }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('members');

  const otherUsers = useMemo(() => users.filter((u) => u.id !== currentUserId), [users, currentUserId]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return otherUsers;
    return otherUsers.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (roleLabels[u.role] || u.role || '').toLowerCase().includes(q)
    );
  }, [otherUsers, search]);

  const roleOrder = ['owner', 'admin', 'teacher', 'secretariat', 'creator', 'proche', 'student'];
  const grouped = useMemo(() => {
    const groups = {};
    filteredUsers.forEach((u) => {
      const r = u.role || 'student';
      if (!groups[r]) groups[r] = [];
      groups[r].push(u);
    });
    return roleOrder.filter((r) => groups[r]?.length > 0).map((r) => ({ role: r, members: groups[r] }));
  }, [filteredUsers]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-4 md:right-8 z-50 w-[340px] max-h-[520px] rounded-2xl border border-white/10 bg-[#0c1118]/90 backdrop-blur-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
          >
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Dialogue</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-gray-400">
                  {otherUsers.length} membre{otherUsers.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un membre…"
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-500 outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] transition-colors"
                />
              </div>
            </div>
            <div className="px-4 pb-2 flex gap-1">
              {[
                { id: 'members', label: 'Membres' },
                { id: 'recent', label: 'Récents' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'h-7 px-3 rounded-lg text-xs font-medium transition-all',
                    tab === t.id
                      ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-thin scrollbar-thumb-white/10">
              {tab === 'members' && (
                <>
                  {grouped.map(({ role, members }) => (
                    <div key={role}>
                      <div className="px-2 pt-2.5 pb-1">
                        <p className="text-[10px] uppercase tracking-wider text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)] font-medium">
                          {roleLabels[role] || role}
                          <span className="ml-1 text-gray-600">({members.length})</span>
                        </p>
                      </div>
                      {members.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => { onSelectUser(user); onClose(); }}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-all text-left group"
                        >
                          <div className="relative">
                            <UserAvatar user={user} size="sm" />
                            <OnlineDot status={user.status} className="absolute -bottom-0.5 -right-0.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white truncate group-hover:text-[var(--school-accent)] transition-colors">{user.name}</p>
                            <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                  {filteredUsers.length === 0 && !loading && (
                    <div className="text-center py-8 px-4">
                      {otherUsers.length === 0 ? (
                        <>
                          <p className="text-sm text-gray-400 mb-1">Aucun membre chargé</p>
                          <p className="text-xs text-gray-600 mb-2">La requête Supabase n'a retourné aucun profil.</p>
                          <p className="text-[11px] text-gray-600 mb-4">
                            Vérifiez la policy `profiles` pour autoriser la lecture des autres comptes.
                          </p>
                          <button
                            onClick={onReload}
                            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-[var(--school-accent)] text-xs font-medium hover:bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] transition-all"
                          >
                            Réessayer
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">Aucun résultat pour "{search}"</p>
                      )}
                    </div>
                  )}
                  {loading && (
                    <div className="flex justify-center py-8">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--school-accent)] border-t-transparent" />
                    </div>
                  )}
                </>
              )}
              {tab === 'recent' && (
                <>
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => { onSelectConversation(conv); onClose(); }}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-all text-left"
                    >
                      <UserAvatar user={conv} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">{conv.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {conv.lastMessage?.content || 'Pas de message'}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--school-accent)] text-[10px] font-bold text-black flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                  {conversations.length === 0 && (
                    <p className="text-center text-sm text-gray-500 py-6">Aucune conversation</p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SearchPanel({ open, onClose, conversations, onSelect }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return conversations.slice(0, 8);
    return conversations.filter((c) => c.name?.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, x: 12, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-24 right-4 md:right-8 z-50 w-[300px] max-h-[360px] rounded-2xl border border-white/10 bg-[#0c1118]/90 backdrop-blur-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
          >
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recherche</p>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Chercher une conversation…"
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-gray-500 outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] transition-colors"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin scrollbar-thumb-white/10">
              {filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => { onSelect(conv); onClose(); }}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all text-left"
                >
                  <UserAvatar user={conv} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white truncate">{conv.name}</p>
                    <p className="text-[10px] text-gray-600 truncate">{conv.lastMessage?.content || ''}</p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-xs text-gray-500 py-4">Aucun résultat</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DeleteMessagePrompt({ open, message, onCancel, onConfirm, loading }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, x: 20, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, y: 10, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-6 right-4 md:right-8 z-[61] w-[320px] rounded-2xl border border-white/10 bg-[#0c1118]/95 backdrop-blur-2xl shadow-2xl shadow-black/50 p-4"
          >
            <p className="text-sm font-semibold text-white">Supprimer ce message ?</p>
            <p className="text-xs text-gray-400 mt-2 line-clamp-2">
              {message?.content || 'Ce message sera supprimé pour les participants.'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-8 px-3 rounded-lg text-xs text-gray-300 border border-white/10 hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onConfirm}
                className="h-8 px-3 rounded-lg text-xs text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50"
              >
                {loading ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PublicProfilePanel({ open, profile, onClose }) {
  return (
    <AnimatePresence>
      {open && profile && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[58]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 10, x: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, x: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed top-24 right-4 md:right-8 z-[59] w-[320px] rounded-2xl border border-white/10 bg-[#0c1118]/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/40"
          >
            <div className="flex items-start gap-3">
              <UserAvatar user={profile} size="lg" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{profile.name}</p>
                <p className="text-xs text-gray-500 truncate">{profile.email}</p>
                <p className="text-[11px] text-[var(--school-accent)] mt-1">
                  {roleLabels[profile.role] || profile.role || 'Membre'}
                </p>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              Statut public : <span className="text-white">{profile.status || 'active'}</span>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3 rounded-lg text-xs border border-white/10 text-gray-300 hover:bg-white/5"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function LiveSummaryPanel({ open, data, onClose }) {
  if (!open || !data) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[4px]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,760px)] rounded-3xl border border-white/10 bg-[#0c1118]/92 backdrop-blur-2xl p-5 md:p-7 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--school-accent)]">Post Live</p>
              <h3 className="text-xl md:text-2xl font-semibold text-white mt-1">{data.ai?.title || 'Résumé de session'}</h3>
              <p className="text-xs text-gray-400 mt-1">
                {data.participantName} • {formatDuration(data.durationSec)} • {data.modeLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
            >
              <X className="w-4 h-4 mx-auto" />
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Analyse IA</p>
            <div className="space-y-2">
              {(data.ai?.highlights || []).map((line) => (
                <p key={line} className="text-sm text-gray-200">
                  • {line}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Actions proposées</p>
              <div className="space-y-1.5">
                {(data.ai?.nextActions || []).map((line) => (
                  <p key={line} className="text-sm text-gray-200">
                    - {line}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Enregistrements</p>
              <div className="space-y-2">
                {data.localRecordUrl ? (
                  <a
                    href={data.localRecordUrl}
                    download={`live-local-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`}
                    className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200"
                  >
                    <Download className="w-4 h-4" />
                    Télécharger local
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">Pas de fichier local.</p>
                )}
                {data.cloudRecordUrl ? (
                  <a
                    href={data.cloudRecordUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[var(--school-accent)] hover:text-[#e5c04a]"
                  >
                    <Download className="w-4 h-4" />
                    Ouvrir version cloud
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">Pas de lien cloud.</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function LiveInvitePrompt({
  invite,
  senderProfile,
  onAccept,
  onDecline,
  onClose,
  onScheduleMissed,
}) {
  if (!invite) return null;
  const isMissed = invite.status === 'missed';
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        className="fixed bottom-24 right-4 md:right-8 z-[85] w-[min(92vw,420px)] rounded-2xl border border-white/10 bg-[#0c1118]/93 backdrop-blur-2xl p-4 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-9 h-9 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)] flex items-center justify-center">
            {isMissed ? <BellRing className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-gray-500">
              {isMissed ? 'Live manqué' : 'Demande Classroom immersive'}
            </p>
            <p className="text-sm text-white mt-1">
              {senderProfile?.name || 'Un membre'} vous invite à passer en mode immersive Classroom.
            </p>
            {invite.scheduled_for ? (
              <p className="text-[11px] text-[var(--school-accent)] mt-1">Programmé: {formatInviteDate(invite.scheduled_for)}</p>
            ) : null}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {!isMissed ? (
            <>
              <button
                type="button"
                onClick={onAccept}
                className="h-9 px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-medium"
              >
                <Check className="w-3.5 h-3.5 inline mr-1" />
                Accepter
              </button>
              <button
                type="button"
                onClick={onDecline}
                className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-medium"
              >
                Décliner
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onScheduleMissed}
              className="h-9 px-3 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)] text-xs font-medium"
            >
              Programmer un rendez-vous
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function LiveAgendaPanel({ open, invites, currentUserId, profiles, onJoin, onScheduleMissed, onClose }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="fixed top-24 right-4 md:right-8 z-[86] w-[min(94vw,420px)] max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1118]/93 backdrop-blur-2xl p-3"
      >
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Agenda Live Chat</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {invites.map((inv) => {
            const peerId = inv.sender_id === currentUserId ? inv.receiver_id : inv.sender_id;
            const peer = profiles[peerId] || null;
            const statusTone =
              inv.status === 'pending'
                ? 'text-amber-200 border-amber-400/30 bg-amber-500/10'
                : inv.status === 'accepted'
                  ? 'text-emerald-200 border-emerald-400/30 bg-emerald-500/10'
                  : inv.status === 'missed'
                    ? 'text-red-200 border-red-500/30 bg-red-500/10'
                    : 'text-gray-300 border-white/10 bg-white/[0.03]';
            return (
              <div key={inv.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{peer?.name || 'Interlocuteur'}</p>
                    <p className="text-[11px] text-gray-500">
                      {inv.scheduled_for ? `Programmé: ${formatInviteDate(inv.scheduled_for)}` : 'Invitation immédiate'}
                    </p>
                  </div>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', statusTone)}>
                    {inv.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {(inv.status === 'accepted' || inv.status === 'pending') ? (
                    <button
                      type="button"
                      onClick={() => onJoin(inv)}
                      className="h-8 px-2.5 rounded-lg text-[11px] bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)]"
                    >
                      Ouvrir conversation
                    </button>
                  ) : null}
                  {inv.status === 'missed' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onScheduleMissed(inv)}
                        className="h-8 px-2.5 rounded-lg text-[11px] bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)]"
                      >
                        Reprogrammer
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
          {invites.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">Aucun live programmé pour le moment.</p>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function liveDashboardNotifTypeLabel(type) {
  if (type === 'live_now') return 'En direct';
  if (type === 'invited') return 'Invitation';
  if (type === 'waiting_entry') return 'Salle d\'attente';
  if (type === 'access_granted') return 'Accès';
  return type ? String(type) : 'Live';
}

// ── SUJETS (forum connecté) — composants additifs ─────────────────────────────

/**
 * Bandeau affiché EN HAUT du fil quand un Sujet est ouvert (au-dessus du chat existant).
 * Titre du sujet + badge état (Ouvert/Clôturé) + bouton Clôturer/Rouvrir.
 */
function TopicBanner({ topic, onToggleStatus, onClose, busy = false }) {
  if (!topic) return null;
  const closed = topic.status === 'closed';
  const isPublic = topic.visibility === 'public';
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-20 mx-4 md:mx-8 mt-3 mb-1 flex items-center justify-between gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)] px-3.5 py-2.5 backdrop-blur-xl"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)]">
          <Hash className="h-4 w-4 text-[var(--school-accent)]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-serif text-sm font-semibold text-[var(--school-accent)]">{topic.subject}</h2>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                closed
                  ? 'border-white/12 bg-white/[0.04] text-gray-400'
                  : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', closed ? 'bg-gray-500' : 'bg-emerald-400')} />
              {closed ? 'Clôturé' : 'Ouvert'}
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
            {isPublic ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
            {isPublic ? 'Sujet public — tous les membres' : 'Sujet privé'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleStatus(closed ? 'open' : 'closed')}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors disabled:opacity-50',
            closed
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
              : 'border-white/12 bg-white/[0.04] text-gray-300 hover:bg-white/10 hover:text-white',
          )}
          title={closed ? 'Rouvrir le sujet' : 'Clôturer le sujet'}
        >
          {closed ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {closed ? 'Rouvrir' : 'Clôturer'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[11px] text-gray-300 hover:bg-white/5 hover:text-white"
          title="Fermer le sujet"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

/** Modal « Créer un sujet » : titre + visibilité (public / privé). */
function CreateTopicModal({ open, onClose, onCreate }) {
  const [subject, setSubject] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setSubject(''); setVisibility('private'); setError(''); setSaving(false); }
  }, [open]);

  const submit = async () => {
    const s = subject.trim();
    if (!s) { setError('Donnez un titre au sujet.'); return; }
    setSaving(true);
    setError('');
    const created = await onCreate({ subject: s, visibility });
    setSaving(false);
    if (created) {
      onClose();
    } else {
      setError("Échec de la création du sujet. Réessayez.");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 z-[121] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0c1118]/97 p-5 backdrop-blur-2xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)]">
                  <Hash className="h-5 w-5 text-[var(--school-accent)]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Créer un sujet</h3>
                  <p className="text-[11px] text-gray-500">Un fil de discussion partagé, ouvert ou clôturable.</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-gray-500">Titre du sujet</label>
            <input
              autoFocus
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
              placeholder="Ex. Préparation du live de jeudi"
              maxLength={140}
              className="mb-4 w-full rounded-xl border border-white/12 bg-black/25 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)]"
            />

            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-gray-500">Visibilité</label>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {[
                { value: 'private', label: 'Privé', desc: 'Sur invitation', Icon: Lock },
                { value: 'public', label: 'Public', desc: 'Tous les membres', Icon: Globe },
              ].map((opt) => {
                const active = visibility === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVisibility(opt.value)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)]'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                    )}
                  >
                    <opt.Icon className={cn('h-4 w-4', active ? 'text-[var(--school-accent)]' : 'text-gray-400')} />
                    <div className="min-w-0">
                      <p className={cn('text-sm font-medium', active ? 'text-[var(--school-accent)]' : 'text-gray-200')}>{opt.label}</p>
                      <p className="text-[10px] text-gray-500">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {error ? <p className="mb-3 text-[11px] text-red-300">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 text-xs text-gray-300 hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={saving || !subject.trim()}
                onClick={() => void submit()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--school-accent)] px-4 text-xs font-semibold text-black transition-colors hover:bg-[#e5c04a] disabled:opacity-50"
              >
                {saving ? 'Création…' : (<><Plus className="h-3.5 w-3.5" /> Créer le sujet</>)}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const MessagingPage = ({ embedded = false }) => {
  const { users, currentUser, conversations, sendMessage, markAsRead, deleteMessage, editMessage, getConversationMessages, fetchAndMergeConversation, profiles, loading, reloadProfiles } =
    useMessaging();
  const { toast } = useToast();
  const {
    items: liveDashboardNotifs,
    unreadCount: liveDashboardUnread,
    markRead: markLiveDashboardNotifRead,
  } = useLiveDashboardNotifications(currentUser?.id);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [activeMessageIndex, setActiveMessageIndex] = useState(-1);
  const [justSentId, setJustSentId] = useState(null);
  const [sendError, setSendError] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [showConversationList, setShowConversationList] = useState(false);
  const [listMode, setListMode] = useState('compact');
  // ── SUJETS (forum connecté) — chemin de données PARALLÈLE, additif au DM ──────
  const {
    topics,
    activeTopic,
    topicMessages,
    topicMessagesLoading,
    openTopic,
    closeActiveTopicView,
    createTopic: createTopicApi,
    sendTopicMessage,
    setActiveTopicStatus,
  } = useMessagingTopics(currentUser?.id || null);
  const [createTopicOpen, setCreateTopicOpen] = useState(false);
  // Filtre de la liste des conversations : 'all' (DM) ou 'topics' (sujets).
  const [convFilter, setConvFilter] = useState('all');
  const [topicStatusBusy, setTopicStatusBusy] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [liveExpanded, setLiveExpanded] = useState(false);
  const [liveStage, setLiveStage] = useState('idle');
  const navigate = useNavigate();
  const { compact: liriUseCompactLiveUi, forceCompact: liriForceCompactLayout, setForceCompact: setLiriForceCompactLayout } =
    useLiriCompactLiveUiState();
  const smartboardFullMobile = useMobileLiriStore((s) => s.smartboardFull);
  const liriMobileLive = Boolean(liriUseCompactLiveUi && liveActive);
  const [liveMode, setLiveMode] = useState('conversation');

  // ── Studio Live : rendez-vous actif avec ce correspondant ─────────────────
  const [activeAppointment, setActiveAppointment] = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [liveMuted, setLiveMuted] = useState(false);
  const [liveCameraOff, setLiveCameraOff] = useState(false);
  const [liveShowParticipants, setLiveShowParticipants] = useState(false);
  const [liveShowChat, setLiveShowChat] = useState(true);
  const [liveMessageDrawerOpen, setLiveMessageDrawerOpen] = useState(false);
  const [liveNeuronqModalOpen, setLiveNeuronqModalOpen] = useState(false);
  const [liveMessageUnread, setLiveMessageUnread] = useState(0);
  const [liveForumMessages, setLiveForumMessages] = useState([]);
  const [liveForumSending, setLiveForumSending] = useState(false);
  const [liriHeartBursts, setLiriHeartBursts] = useState([]);
  const [promotedParticipantId, setPromotedParticipantId] = useState(null);
  const [liveSlideIndex, setLiveSlideIndex] = useState(0);
  const [nativeSlideIndex, setNativeSlideIndex] = useState(0);
  const [importSlideIndex, setImportSlideIndex] = useState(0);
  const [liveSlides, setLiveSlides] = useState(DEFAULT_IMMERSIVE_SLIDES);
  const [liveSpotlightOn, setLiveSpotlightOn] = useState(false);
  const [liveShareOpen, setLiveShareOpen] = useState(false);
  const [liveSmartBoardOpen, setLiveSmartBoardOpen] = useState(false);
  const [smartBoardText, setSmartBoardText] = useState('');
  const [sharingScreen, setSharingScreen] = useState(false);
  const [liveFullscreen, setLiveFullscreen] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [liveActionsOpen, setLiveActionsOpen] = useState(false);
  const [liveSettingsOpen, setLiveSettingsOpen] = useState(false);
  // Video effects (lifted from LiveSettingsPanel)
  const [videoBlur, setVideoBlur] = useState(false);
  const [videoBeauty, setVideoBeauty] = useState(false);
  /** Par défaut Verre IA : silhouette sur le même fond que l'UI live (studio premium). */
  const [videoVbg, setVideoVbg] = useState('immersive');
  const [videoChromaKey, setVideoChromaKey] = useState(false);
  const [videoChromaColor, setVideoChromaColor] = useState('#00B140');
  const [videoChromaSens, setVideoChromaSens] = useState(100);
  // SmartBoard active scene
  const [activeScene, setActiveScene] = useState('diapo');
  // Camera 2
  const camera2VideoRef = useRef(null);
  const [camera2Active, setCamera2Active] = useState(false);
  const camera2StreamRef = useRef(null);
  const [sharedImageGallery, setSharedImageGallery] = useState([]);
  const [sharedImageIdx, setSharedImageIdx] = useState(0);
  const [sharedImageLoop, setSharedImageLoop] = useState(false);
  /** Overrides partiels persistés (immersive_live_sessions.smartboard_scenes_json). */
  const [immersiveSmartboardScenesRaw, setImmersiveSmartboardScenesRaw] = useState({});
  /** Synchro SmartBoard immersif (broadcast) — même logique que LiveArena Cam 2. */
  const [liveSmartboardCam2Source, setLiveSmartboardCam2Source] = useState(null);
  const liveSmartboardCam2SourceRef = useRef(null);
  useEffect(() => { liveSmartboardCam2SourceRef.current = liveSmartboardCam2Source; }, [liveSmartboardCam2Source]);
  const immersiveSmartboardChannelRef = useRef(null);
  /** Mode tactique SmartBoard immersif — ref hôte + état invité (broadcast) */
  const immersiveSbTacticalSyncRef = useRef(null);
  const [immersiveSbTacticalSyncRemote, setImmersiveSbTacticalSyncRemote] = useState(null);
  const immersiveSmartboardScenesRef = useRef({});
  const liveSlideIndexRef = useRef(0);
  const nativeSlideIndexRef = useRef(0);
  const importSlideIndexRef = useRef(0);
  const activeSceneRef = useRef('diapo');
  const sharedImageGalleryRef = useRef([]);
  const sharedImageIdxRef = useRef(0);
  const sharedImageLoopRef = useRef(false);
  useEffect(() => { liveSlideIndexRef.current = liveSlideIndex; }, [liveSlideIndex]);
  useEffect(() => { nativeSlideIndexRef.current = nativeSlideIndex; }, [nativeSlideIndex]);
  useEffect(() => { importSlideIndexRef.current = importSlideIndex; }, [importSlideIndex]);
  useEffect(() => { activeSceneRef.current = activeScene; }, [activeScene]);
  useEffect(() => { sharedImageGalleryRef.current = sharedImageGallery; }, [sharedImageGallery]);
  useEffect(() => { sharedImageIdxRef.current = sharedImageIdx; }, [sharedImageIdx]);
  useEffect(() => { sharedImageLoopRef.current = sharedImageLoop; }, [sharedImageLoop]);
  const [annotationStrokes, setAnnotationStrokes] = useState([]);
  const annotationStrokesRef = useRef([]);
  useEffect(() => { annotationStrokesRef.current = annotationStrokes; }, [annotationStrokes]);
  const [whiteboardPages, setWhiteboardPages] = useState(() => [[]]);
  const [whiteboardPageIndex, setWhiteboardPageIndex] = useState(0);
  const whiteboardPagesRef = useRef([[]]);
  const whiteboardPageIndexRef = useRef(0);
  const whiteboardStrokesRef = useRef([]);
  useEffect(() => { whiteboardPagesRef.current = whiteboardPages; }, [whiteboardPages]);
  useEffect(() => { whiteboardPageIndexRef.current = whiteboardPageIndex; }, [whiteboardPageIndex]);
  const whiteboardStrokes = whiteboardPages[whiteboardPageIndex] ?? [];
  useEffect(() => {
    whiteboardStrokesRef.current = whiteboardPages[whiteboardPageIndex] ?? [];
  }, [whiteboardPages, whiteboardPageIndex]);
  useEffect(() => { immersiveSmartboardScenesRef.current = immersiveSmartboardScenesRaw; }, [immersiveSmartboardScenesRaw]);

  const messagingSceneFlags = useMemo(
    () => mergeSmartboardSceneFlags({ ...IMMERSIVE_SMARTBOARD_SCENE_OVERLAY, ...immersiveSmartboardScenesRaw }),
    [immersiveSmartboardScenesRaw],
  );

  const messagingNavigatorScenes = useMemo(
    () => buildSmartboardNavigatorScenes({ flags: messagingSceneFlags }),
    [messagingSceneFlags],
  );

  const sharedImageSrc = useMemo(() => {
    const g = sharedImageGallery;
    if (!g?.length) return '';
    const i = Math.min(sharedImageIdx, Math.max(0, g.length - 1));
    return g[i]?.url || '';
  }, [sharedImageGallery, sharedImageIdx]);

  useEffect(() => {
    setSharedImageIdx((i) => Math.min(i, Math.max(0, sharedImageGallery.length - 1)));
  }, [sharedImageGallery.length]);
  const [liveStartedAt, setLiveStartedAt] = useState(null);
  const [liveElapsedSec, setLiveElapsedSec] = useState(0);
  const [isRecordingLive, setIsRecordingLive] = useState(false);
  const [liveRecordElapsedSec, setLiveRecordElapsedSec] = useState(0);
  const [liveRecordUrl, setLiveRecordUrl] = useState('');
  const [liveCloudUrl, setLiveCloudUrl] = useState('');
  const [uploadingLiveRecord, setUploadingLiveRecord] = useState(false);
  const [liveSummaryOpen, setLiveSummaryOpen] = useState(false);
  const [liveSummaryData, setLiveSummaryData] = useState(null);
  const [liveSessionId, setLiveSessionId] = useState(null);
  /** Hôte réel du live immersif (immersive_live_sessions.host_user_id) — pas toujours l'utilisateur courant */
  const [immersiveHostUserId, setImmersiveHostUserId] = useState(null);
  const [liveAmbientTracks, setLiveAmbientTracks] = useState([]);
  const [isLiveReconnecting, setIsLiveReconnecting] = useState(false);
  const [liveConnectionQuality, setLiveConnectionQuality] = useState(null);
  const [companionQrOpen, setCompanionQrOpen] = useState(false);
  const [companionJoinUrl, setCompanionJoinUrl] = useState('');
  const [companionLinkLoading, setCompanionLinkLoading] = useState(false);
  const [companionLinkError, setCompanionLinkError] = useState('');
  const [companionExpiresAt, setCompanionExpiresAt] = useState('');

  // ─── Nettoyage sessions fantômes au montage (Phase 7 guard) ──────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    const staleThreshold = new Date(Date.now() - 3 * 3_600_000).toISOString();
    // Clore silencieusement toutes les sessions actives de cet hôte
    // qui n'ont pas reçu de webhook room_finished (fantômes réseau/crash)
    supabase
      .from('immersive_live_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('host_user_id', currentUser.id)
      .eq('status', 'active')
      .lt('updated_at', staleThreshold)
      .then(({ error }) => {
        if (error && !String(error.message).includes('No rows')) {
          console.debug('[live-guard] cleanup error:', error.message);
        }
      });
  }, [currentUser?.id]);

  // ─── Zone 3 — présence temps réel, mains levées, sièges privilégiés ─────────
  const {
    members:          zone3Members,
    raisedHands:      zone3RaisedHands,
    privilegedSeats:  zone3PrivilegedSeats,
    myHandRaised:     zone3MyHandRaised,
    raiseHand:        zone3RaiseHand,
    lowerHand:        zone3LowerHand,
    grantSeat:        zone3GrantSeat,
    revokeSeat:       zone3RevokeSeat,
  } = useLiveRoomPresence({
    sessionId:   liveSessionId,
    currentUser: currentUser
      ? { id: currentUser.id, full_name: currentUser.name, role: currentUser.role, avatar_url: currentUser.avatar_url || currentUser.avatar }
      : null,
    enabled: liveActive && Boolean(liveSessionId),
  });

  // ─── NEURON-Q — système de questions live ────────────────────────────────────
  const {
    questions:          neuronqQuestions,
    pendingCount:       neuronqPendingCount,
    qaMode:             neuronqQaMode,
    setQaMode:          setNeuronqQaMode,
    submitting:         neuronqSubmitting,
    reformulating:      neuronqReformulating,
    reformulateQuestion: neuronqReformulate,
    submitQuestion:     neuronqSubmit,
    markAnswered:       neuronqMarkAnswered,
    markSkipped:        neuronqMarkSkipped,
  } = useLiveQuestions({
    sessionId:   liveSessionId,
    currentUser: currentUser
      ? { id: currentUser.id, name: currentUser.name, full_name: currentUser.name }
      : null,
    enabled: liveActive && Boolean(liveSessionId),
  });

  // ─── Master Script (Phase 4) ───────────────────────────────────────────────
  const {
    sections:       scriptSections,
    currentSection: scriptCurrentSection,
    loading:        scriptLoading,
    improving:      scriptImproving,
    addSection:     scriptAdd,
    updateSection:  scriptUpdate,
    deleteSection:  scriptDelete,
    moveSection:    scriptMove,
    improveSection: scriptImprove,
  } = useLiveScript({
    sessionId:        liveSessionId,
    currentUser:      currentUser ? { id: currentUser.id } : null,
    enabled:          liveActive && Boolean(liveSessionId),
    currentSlideIndex: liveSlideIndex ?? 0,
  });

  // ─── Post-live Summary (Phase 5) ──────────────────────────────────────────
  const {
    summary:         liveSummary,
    generating:      liveSummaryGenerating,
    error:           liveSummaryError,
    generate:        generateLiveSummary,
    reset:           resetLiveSummary,
    startTracking:   startSlideTracking,
    trackSlideChange,
  } = usePostLiveSummary();
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  // PiP SmartBoard — stream capturé depuis le canvas segmenté (arrière-plan supprimé)
  const [localPipStream, setLocalPipStream] = useState(null);
  const [localCameraStreamState, setLocalCameraStreamState] = useState(null);
  const [localScreenStreamState, setLocalScreenStreamState] = useState(null);
  const [remoteCameraStream, setRemoteCameraStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [remoteSharingScreen, setRemoteSharingScreen] = useState(false);
  const [localStreamVersion, setLocalStreamVersion] = useState(0);
  const [liveAgendaOpen, setLiveAgendaOpen] = useState(false);
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [inviteScheduleAt, setInviteScheduleAt] = useState('');
  // incomingInvite / outgoingInvite / pendingInviteCount / inviteCountdown / sendingInvite
  // → fournis par useLiveInvite (branché après startLiveRoom pour éviter tout TDZ).
  // Modal RDV rapide (après refus/timeout)
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  // Modal rapport post-appel
  const [postCallModal, setPostCallModal] = useState({ open: false, durationSeconds: 0 });
  const [scheduleCallModal, setScheduleCallModal] = useState({ open: false });
  const callStartTimeRef = useRef(null);
  const [sonnerieOn, setSonnerieOn] = useState(() => {
    try { return localStorage.getItem('sonnerie-enabled') !== 'false'; } catch { return true; }
  });
  const [miniOffset, setMiniOffset] = useState({ x: 0, y: 0 });
  const sonnerieRef = useRef(sonnerieOn);

  const toggleSonnerie = useCallback(() => {
    setSonnerieOn((prev) => {
      const next = !prev;
      sonnerieRef.current = next;
      try { localStorage.setItem('sonnerie-enabled', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const messageScrollRef = useRef(null);
  const messageItemRefs = useRef({});
  // Thème fixe sombre — aligné avec le design global de l'app (#090D14 / #0F1419 / or #D4AF37).
  const isDarkTheme = true;
  const liveSurfaceRef = useRef(null);
  /** Fond virtuel avant activation chroma — restauré à la désactivation. */
  const vbgBeforeChromaRef = useRef('immersive');
  const [messagingLiveParallax, setMessagingLiveParallax] = useState({ x: 0, y: 0 });
  const liveMainVideoRef = useRef(null);
  const liveMiniVideoRef = useRef(null);
  const remoteMainVideoRef = useRef(null);
  const screenShareVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteCameraWasConnectedRef = useRef(false);
  const localLiveStreamRef = useRef(null);
  const displayLiveStreamRef = useRef(null);
  const liveRecorderRef = useRef(null);
  const liveRecordChunksRef = useRef([]);
  const liveModeHistoryRef = useRef([]);
  const remoteStopRef = useRef(false);
  const liveInviteRef = useRef(null);
  // Ref vers la dernière version de startLiveRoom — évite les fermetures périmées
  // dans onAccepted/onSelfAccepted (dont les deps ne listent pas startLiveRoom).
  const startLiveRoomRef = useRef(null);
  const alarmAudioCtxRef = useRef(null);
  const alarmAudioArmedRef = useRef(false);
  const liveForumSeenCountRef = useRef(0);
  const autoSelectedRef = useRef(false);
  // Tri-state schema mode for appointments query: unknown | full | legacy
  // Persisté en sessionStorage pour éviter de retenter la requête cassée à chaque remontage.
  const appointmentsSchemaModeRef = useRef(
    (() => { try { return sessionStorage.getItem('appt_schema_mode') || 'unknown'; } catch { return 'unknown'; } })()
  );

  // Ref centrale pour les données volatiles de l'appel — stopLiveRoom y lit
  // au moment de l'appel sans en dépendre dans son array de deps.
  const liveDataRef = useRef({
    elapsedSec: 0,
    mode: 'conversation',
    recordUrl: '',
    cloudUrl: '',
    shareOpen: false,
    sharingScreen: false,
    smartBoardText: '',
    conversationKey: null,
    startedAt: null,
    isRecording: false,
    recipientName: null,
    sessionId: null,
  });


  // Auto-sélectionner la conversation avec des non-lus la plus récente
  useEffect(() => {
    if (autoSelectedRef.current || selectedRecipient || activeTopic || conversations.length === 0 || loading) return;
    const withUnread = conversations.find((c) => c.unreadCount > 0);
    const first = withUnread || conversations[0];
    if (!first) return;
    autoSelectedRef.current = true;
    const profile = profiles[first.participantId] || first;
    setSelectedRecipient({
      id: first.participantId,
      name: first.name,
      avatar_url: first.avatar_url,
      role: first.role,
      status: first.status,
      ...profile,
    });
  }, [conversations, profiles, selectedRecipient, activeTopic, loading]);

  const recipientId = selectedRecipient?.id || null;
  const recipientProfile = recipientId ? profiles[recipientId] || selectedRecipient : null;

  /** Clé stable DM — doit être déclarée avant tout effet qui l'utilise (évite TDZ / ReferenceError en prod). */
  const liveConversationKey = useMemo(() => {
    if (!currentUser?.id || !recipientId) return '';
    const sorted = [currentUser.id, recipientId].sort();
    return `dm:${sorted[0]}:${sorted[1]}`;
  }, [currentUser?.id, recipientId]);

  // Charger le rendez-vous actif entre currentUser et recipient
  useEffect(() => {
    if (!currentUser?.id || !recipientId) { setActiveAppointment(null); return; }
    let alive = true;
    const ACTIVE = ['confirmed','scheduled','preparing','ready','in_progress','chat_started','live_started'];
    const loadActiveAppointment = async () => {
      try {
        const mode = appointmentsSchemaModeRef.current;
        if (mode !== 'legacy') {
          // Schéma "complet" (avec secretary_id/subject) si dispo.
          const primary = await supabase
            .from('appointments')
            .select('id, subject, scheduled_at, status, student_id, booking_reference')
            .or(`and(student_id.eq.${currentUser.id},secretary_id.eq.${recipientId}),and(student_id.eq.${recipientId},secretary_id.eq.${currentUser.id})`)
            .in('status', ACTIVE)
            .order('scheduled_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (!primary.error) {
            appointmentsSchemaModeRef.current = 'full';
            try { sessionStorage.setItem('appt_schema_mode', 'full'); } catch { /* ignore */ }
            if (alive) setActiveAppointment(primary.data || null);
            return;
          }
          // 400 répétés observés en prod quand certaines colonnes n'existent pas.
          if (primary.status === 400 || primary.error?.code === '42703' || String(primary.error?.message || '').includes('secretary_id')) {
            appointmentsSchemaModeRef.current = 'legacy';
            try { sessionStorage.setItem('appt_schema_mode', 'legacy'); } catch { /* ignore */ }
          }
        }
        // Fallback prod ancien schéma: requête simple indexée sur student_id uniquement.
        // Pas d'OR multi-colonnes pour éviter les scans complets de table.
        const fallback = await supabase
          .from('appointments')
          .select('id, scheduled_at, status, student_id, booking_reference')
          .eq('student_id', currentUser.id)
          .in('status', ACTIVE)
          .order('scheduled_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (alive) setActiveAppointment(fallback.data ? { ...fallback.data, subject: null } : null);
      } catch {
        if (alive) setActiveAppointment(null);
      }
    };
    void loadActiveAppointment();
    return () => { alive = false; };
  }, [currentUser?.id, recipientId]);
  // Sync des données volatiles vers liveDataRef — stopLiveRoom y lit directement.
  useEffect(() => {
    liveDataRef.current = {
      elapsedSec:      liveElapsedSec,
      mode:            liveMode,
      recordUrl:       liveRecordUrl,
      cloudUrl:        liveCloudUrl,
      shareOpen:       liveShareOpen,
      sharingScreen,
      smartBoardText,
      conversationKey: liveConversationKey ?? '',
      startedAt:       liveStartedAt,
      isRecording:     isRecordingLive,
      recipientName:   recipientProfile?.name || null,
      sessionId:       liveSessionId,
      // Phase 5 — pour résumé post-session
      questions:       neuronqQuestions,
      scriptSections:  scriptSections,
      slides:          liveSlides,
    };
  });

  // Nombre total non lus (pour badge)
  const totalUnread = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [conversations]
  );

  const convMessages = useMemo(() => {
    if (!recipientId) return [];
    return getConversationMessages(recipientId);
  }, [recipientId, getConversationMessages]);

  const messageTimeline = useMemo(() => buildMessageTimeline(convMessages), [convMessages]);

  // SUJETS : la timeline du fil de sujet (forum connecté), même rendu que le DM.
  const topicTimeline = useMemo(() => buildMessageTimeline(topicMessages), [topicMessages]);

  const liveParticipants = useMemo(() => {
    const hostId = immersiveHostUserId || currentUser?.id || null;
    const list = [];
    if (currentUser?.id) {
      list.push({
        id: currentUser.id,
        name: currentUser.name || 'Vous',
        avatar_url: currentUser.avatar_url || currentUser.avatar,
        isHost: Boolean(hostId && currentUser.id === hostId),
        isLocal: true,
        lastActiveLabel: 'Vous · dans le live',
        locationLabel: null,
      });
    }
    if (recipientProfile?.id && recipientProfile.id !== currentUser?.id) {
      const loc = [recipientProfile.city, recipientProfile.region, recipientProfile.country]
        .filter(Boolean)
        .join(', ');
      list.push({
        id: recipientProfile.id,
        name: recipientProfile.name || 'Interlocuteur',
        avatar_url: recipientProfile.avatar_url || recipientProfile.avatar,
        isHost: Boolean(hostId && recipientProfile.id === hostId),
        isLocal: false,
        lastActiveLabel: liveActive ? 'En ligne dans le live' : 'Hors session',
        locationLabel: loc || null,
      });
    }
    return list;
  }, [currentUser, recipientProfile, immersiveHostUserId, liveActive]);

  const liriMobileMembers = useMemo(() => {
    const byId = new Map();
    for (const p of liveParticipants) {
      byId.set(String(p.id), {
        id: p.id,
        name: p.name,
        avatar_url: p.avatar_url,
        isHost: p.isHost,
        lastActiveLabel: p.lastActiveLabel,
        locationLabel: p.locationLabel,
      });
    }
    for (const z of zone3Members || []) {
      const id = z.userId;
      if (!id || byId.has(String(id))) continue;
      byId.set(String(id), {
        id,
        name: z.name,
        avatar_url: z.avatar_url,
        isHost: false,
        role: z.role,
        lastActiveLabel: 'Récemment actif',
        locationLabel: null,
      });
    }
    return [...byId.values()];
  }, [liveParticipants, zone3Members]);

  const liriMobileMembersRef = useRef([]);
  useEffect(() => {
    liriMobileMembersRef.current = liriMobileMembers;
  }, [liriMobileMembers]);

  const messagingMobileWhisperIncomingRef = useRef(null);
  useEffect(() => {
    messagingMobileWhisperIncomingRef.current = ({ fromId, text }) => {
      const raw = String(text || '');
      const snippet = raw.length > 80 ? `${raw.slice(0, 77)}…` : raw;
      const members = liriMobileMembersRef.current || [];
      const row = members.find((x) => String(x.id) === String(fromId));
      const name = row?.name || 'Un membre';
      toast({
        title: `Message privé — ${name}`,
        description: snippet,
        duration: 8000,
        action: (
          <ToastAction
            altText="Ouvrir la conversation privée"
            onClick={() => {
              useMobileLiriStore.getState().openWhisperChat({
                id: String(fromId),
                name,
                avatar: row?.avatar_url,
                isHost: Boolean(row?.isHost),
                lastActiveLabel: row?.lastActiveLabel,
                locationLabel: row?.locationLabel,
              });
            }}
          >
            Ouvrir
          </ToastAction>
        ),
      });
    };
  }, [toast]);

  const { threads: messagingMobileWhisperThreads, sendWhisper: messagingMobileSendWhisper } = useLiveSessionWhispers(
    liriMobileLive && liveActive && liveSessionId && currentUser?.id ? liveSessionId : null,
    currentUser?.id,
    messagingMobileWhisperIncomingRef,
  );

  const isMessagingLiveHost = useMemo(
    () => Boolean(currentUser?.id && immersiveHostUserId && immersiveHostUserId === currentUser.id),
    [currentUser?.id, immersiveHostUserId],
  );

  const handleDockSelectScene = useCallback(
    (sceneId) => {
      if (!isMessagingLiveHost || typeof sceneId !== 'string') return;
      setActiveScene(sceneId);
    },
    [isMessagingLiveHost],
  );

  const sendImmersiveSmartboardPayload = useCallback((overrides = {}) => {
    if (!immersiveSmartboardChannelRef.current) return;
    if (!currentUser?.id || !immersiveHostUserId || immersiveHostUserId !== currentUser.id) return;
    const payload = {
      slideIndex: liveSlideIndexRef.current,
      nativeSlideIndex: nativeSlideIndexRef.current,
      importSlideIndex: importSlideIndexRef.current,
      activeScene: activeSceneRef.current,
      sharedImageIdx: sharedImageIdxRef.current,
      sharedImageLoop: sharedImageLoopRef.current,
      sharedImageGallery: sharedImageGalleryRef.current,
      smartboardScenes: immersiveSmartboardScenesRef.current,
      annotationStrokes: annotationStrokesRef.current,
      whiteboardPages: whiteboardPagesRef.current,
      whiteboardPageIndex: whiteboardPageIndexRef.current,
      whiteboardStrokes: whiteboardStrokesRef.current,
      sbTacticalSync: immersiveSbTacticalSyncRef.current,
      ...overrides,
    };
    if (!Object.prototype.hasOwnProperty.call(payload, 'camera2Source')) {
      payload.camera2Source = liveSmartboardCam2SourceRef.current;
    }
    void broadcastRealtime(immersiveSmartboardChannelRef.current, 'smartboard', payload);
  }, [currentUser?.id, immersiveHostUserId]);

  const handleImmersiveSbTacticalSync = useCallback((payload) => {
    immersiveSbTacticalSyncRef.current = payload;
    sendImmersiveSmartboardPayload({ sbTacticalSync: payload });
  }, [sendImmersiveSmartboardPayload]);

  useEffect(() => {
    if (!liveActive || !liveSessionId) return undefined;
    const ch = supabase.channel(`immersive-smartboard-${liveSessionId}`, {
      config: { broadcast: { self: false } },
    });
    if (isMessagingLiveHost) {
      immersiveSmartboardChannelRef.current = ch;
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') sendImmersiveSmartboardPayload();
      });
    } else {
      ch.on('broadcast', { event: 'smartboard' }, ({ payload }) => {
        if (typeof payload.slideIndex === 'number') setLiveSlideIndex(payload.slideIndex);
        if (typeof payload.nativeSlideIndex === 'number') setNativeSlideIndex(payload.nativeSlideIndex);
        if (typeof payload.importSlideIndex === 'number') setImportSlideIndex(payload.importSlideIndex);
        if (typeof payload.activeScene === 'string') setActiveScene(payload.activeScene);
        if (Array.isArray(payload.sharedImageGallery)) {
          setSharedImageGallery(normalizeMessagingSharedGallery(payload.sharedImageGallery));
        }
        if (typeof payload.sharedImageIdx === 'number') setSharedImageIdx(payload.sharedImageIdx);
        if (typeof payload.sharedImageLoop === 'boolean') setSharedImageLoop(payload.sharedImageLoop);
        if (
          typeof payload.sharedImageSrc === 'string'
          && payload.sharedImageSrc
          && !Array.isArray(payload.sharedImageGallery)
        ) {
          setSharedImageGallery([{ url: payload.sharedImageSrc, label: 'Partagé' }]);
          setSharedImageIdx(0);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'camera2Source')) {
          setLiveSmartboardCam2Source(payload.camera2Source);
        }
        if (payload.smartboardScenes != null && typeof payload.smartboardScenes === 'object' && !Array.isArray(payload.smartboardScenes)) {
          setImmersiveSmartboardScenesRaw((prev) => ({
            ...prev,
            ...normalizeImmersiveSmartboardScenesJson(payload.smartboardScenes),
          }));
        }
        if (Array.isArray(payload.annotationStrokes)) {
          setAnnotationStrokes(payload.annotationStrokes);
        }
        if (
          (Array.isArray(payload.whiteboardPages) && payload.whiteboardPages.every(Array.isArray))
          || Array.isArray(payload.whiteboardStrokes)
        ) {
          const { pages, pageIndex } = mergeWhiteboardFromPayload(
            payload,
            whiteboardPagesRef.current,
            whiteboardPageIndexRef.current,
          );
          whiteboardPagesRef.current = pages;
          whiteboardPageIndexRef.current = pageIndex;
          setWhiteboardPages(pages);
          setWhiteboardPageIndex(pageIndex);
          whiteboardStrokesRef.current = pages[pageIndex] ?? [];
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'sbTacticalSync')) {
          setImmersiveSbTacticalSyncRemote(payload.sbTacticalSync ?? null);
        }
      }).subscribe();
    }
    return () => {
      supabase.removeChannel(ch);
      immersiveSmartboardChannelRef.current = null;
    };
  }, [liveActive, liveSessionId, isMessagingLiveHost, sendImmersiveSmartboardPayload]);

  useEffect(() => {
    if (!liveActive || !isMessagingLiveHost || !immersiveSmartboardChannelRef.current) return;
    sendImmersiveSmartboardPayload({ smartboardScenes: immersiveSmartboardScenesRef.current });
  }, [immersiveSmartboardScenesRaw, liveActive, isMessagingLiveHost, sendImmersiveSmartboardPayload]);

  useEffect(() => {
    if (!liveActive || !isMessagingLiveHost || !immersiveSmartboardChannelRef.current) return;
    sendImmersiveSmartboardPayload({
      slideIndex: liveSlideIndexRef.current,
      nativeSlideIndex: nativeSlideIndexRef.current,
      importSlideIndex: importSlideIndexRef.current,
    });
  }, [nativeSlideIndex, importSlideIndex, liveSlideIndex, liveActive, isMessagingLiveHost, sendImmersiveSmartboardPayload]);

  useEffect(() => {
    if (!liveActive || !isMessagingLiveHost || !immersiveSmartboardChannelRef.current) return;
    sendImmersiveSmartboardPayload({ activeScene });
  }, [activeScene, liveActive, isMessagingLiveHost, sendImmersiveSmartboardPayload]);

  const persistImmersiveSharedImagesJson = useCallback(async (gallery) => {
    if (!liveSessionId || !isMessagingLiveHost) return;
    try {
      await supabase
        .from('immersive_live_sessions')
        .update({ smartboard_shared_images_json: gallery })
        .eq('id', liveSessionId);
    } catch {
      /* ignore */
    }
  }, [liveSessionId, isMessagingLiveHost]);

  const persistImmersiveSmartboardScenesJson = useCallback(async (scenes) => {
    if (!liveSessionId || !isMessagingLiveHost) return;
    try {
      await supabase
        .from('immersive_live_sessions')
        .update({ smartboard_scenes_json: scenes })
        .eq('id', liveSessionId);
    } catch {
      /* ignore */
    }
  }, [liveSessionId, isMessagingLiveHost]);

  const handleImmersiveSmartboardSceneToggle = useCallback((sceneId, enabled) => {
    if (!isMessagingLiveHost || typeof sceneId !== 'string') return;
    setImmersiveSmartboardScenesRaw((prev) => {
      const nextRaw = { ...prev, [sceneId]: Boolean(enabled) };
      immersiveSmartboardScenesRef.current = nextRaw;
      void persistImmersiveSmartboardScenesJson(nextRaw);
      return nextRaw;
    });
  }, [isMessagingLiveHost, persistImmersiveSmartboardScenesJson]);

  const handleLiveShareImageFromSettings = useCallback((src) => {
    if (!src || !String(src).trim()) return;
    setLiveSettingsOpen(false);
    const next = [...sharedImageGalleryRef.current, { url: String(src).trim(), label: 'Visuel partagé' }];
    sharedImageGalleryRef.current = next;
    setSharedImageGallery(next);
    const idx = next.length - 1;
    setSharedImageIdx(idx);
    setActiveScene('image');
    activeSceneRef.current = 'image';
    if (isMessagingLiveHost) {
      void persistImmersiveSharedImagesJson(next);
      sendImmersiveSmartboardPayload({
        sharedImageGallery: next,
        sharedImageIdx: idx,
        activeScene: 'image',
      });
    }
  }, [isMessagingLiveHost, sendImmersiveSmartboardPayload, persistImmersiveSharedImagesJson]);

  const messagingDisplaySlides = useMemo(
    () => (liveSlides || []).map((s) => normalizeLiveSceneToSlide(s)).filter(Boolean),
    [liveSlides],
  );
  const messagingNativeSlides = useMemo(
    () => (messagingDisplaySlides || []).filter((s) => s?.ia_data),
    [messagingDisplaySlides],
  );
  const messagingImportSlides = useMemo(
    () => (messagingDisplaySlides || []).filter((s) => s && !s.ia_data),
    [messagingDisplaySlides],
  );

  useEffect(() => {
    setNativeSlideIndex((i) => Math.min(i, Math.max(0, messagingNativeSlides.length - 1)));
  }, [messagingNativeSlides.length]);
  useEffect(() => {
    setImportSlideIndex((i) => Math.min(i, Math.max(0, messagingImportSlides.length - 1)));
  }, [messagingImportSlides.length]);

  const messagingSafeNativeIdx = Math.min(nativeSlideIndex, Math.max(0, messagingNativeSlides.length - 1));
  const messagingSafeImportIdx = Math.min(importSlideIndex, Math.max(0, messagingImportSlides.length - 1));

  const messagingParallaxSlide = useMemo(() => {
    if (activeScene === 'smartboard') return messagingNativeSlides[messagingSafeNativeIdx] || null;
    if (activeScene === 'diapo') return messagingImportSlides[messagingSafeImportIdx] || null;
    const combinedIdx = Math.min(liveSlideIndex, Math.max(0, messagingDisplaySlides.length - 1));
    return messagingDisplaySlides[combinedIdx] || null;
  }, [
    activeScene,
    messagingNativeSlides,
    messagingImportSlides,
    messagingSafeNativeIdx,
    messagingSafeImportIdx,
    messagingDisplaySlides,
    liveSlideIndex,
  ]);

  const messagingSlideParallaxKey = `${nativeSlideIndex}-${importSlideIndex}-${liveSlideIndex}`;

  useEffect(() => {
    if (!isMessagingLiveHost || !liveActive) return;
    immersiveSbTacticalSyncRef.current = null;
    sendImmersiveSmartboardPayload({ sbTacticalSync: null });
  }, [messagingSlideParallaxKey, activeScene, isMessagingLiveHost, liveActive, sendImmersiveSmartboardPayload]);

  useEffect(() => {
    if (liveActive) return;
    setImmersiveSbTacticalSyncRemote(null);
  }, [liveActive]);

  const messagingSlideAnnotationKey =
    activeScene === 'smartboard' || activeScene === 'diapo'
      ? `${activeScene}-${messagingSlideParallaxKey}`
      : null;
  const messagingSlideAnnotationContextRef = useRef(null);
  useEffect(() => {
    if (!isMessagingLiveHost) return;
    if (messagingSlideAnnotationKey === null) return;
    if (messagingSlideAnnotationContextRef.current === null) {
      messagingSlideAnnotationContextRef.current = messagingSlideAnnotationKey;
      return;
    }
    if (messagingSlideAnnotationContextRef.current === messagingSlideAnnotationKey) return;
    messagingSlideAnnotationContextRef.current = messagingSlideAnnotationKey;
    setAnnotationStrokes([]);
    annotationStrokesRef.current = [];
    sendImmersiveSmartboardPayload({ annotationStrokes: [] });
  }, [messagingSlideAnnotationKey, isMessagingLiveHost, sendImmersiveSmartboardPayload]);

  const messagingSlideRailCount =
    activeScene === 'smartboard'
      ? Math.max(1, messagingNativeSlides.length)
      : activeScene === 'diapo'
        ? Math.max(1, messagingImportSlides.length)
        : Math.max(1, messagingDisplaySlides.length);

  const messagingShellSlideIndex =
    activeScene === 'smartboard'
      ? nativeSlideIndex
      : activeScene === 'diapo'
        ? importSlideIndex
        : liveSlideIndex;

  useEffect(() => {
    if (activeScene === 'smartboard') setLiveSlideIndex(nativeSlideIndex);
    else if (activeScene === 'diapo') setLiveSlideIndex(importSlideIndex);
  }, [activeScene, nativeSlideIndex, importSlideIndex]);

  useEffect(() => {
    const ids = navigatorSceneIds(messagingSceneFlags);
    if (ids.length > 0 && !ids.includes(activeScene)) {
      setActiveScene(ids[0]);
    }
  }, [activeScene, messagingSceneFlags, messagingNativeSlides.length, messagingImportSlides.length]);

  const changeMessagingSlide = useCallback(
    (newIndex) => {
      if (!isMessagingLiveHost) return;
      if (activeScene === 'smartboard') {
        const n = Math.max(0, Math.min(messagingNativeSlides.length - 1, newIndex));
        if (n !== nativeSlideIndex) trackSlideChange(n);
        setNativeSlideIndex(n);
        setLiveSlideIndex(n);
        sendImmersiveSmartboardPayload({ slideIndex: n, nativeSlideIndex: n });
        return;
      }
      if (activeScene === 'diapo') {
        const n = Math.max(0, Math.min(messagingImportSlides.length - 1, newIndex));
        if (n !== importSlideIndex) trackSlideChange(n);
        setImportSlideIndex(n);
        setLiveSlideIndex(n);
        sendImmersiveSmartboardPayload({ slideIndex: n, importSlideIndex: n });
        return;
      }
      const n = Math.max(0, Math.min(messagingDisplaySlides.length - 1, newIndex));
      if (n !== liveSlideIndex) trackSlideChange(n);
      setLiveSlideIndex(n);
      sendImmersiveSmartboardPayload({ slideIndex: n });
    },
    [
      isMessagingLiveHost,
      activeScene,
      messagingNativeSlides.length,
      messagingImportSlides.length,
      messagingDisplaySlides.length,
      nativeSlideIndex,
      importSlideIndex,
      liveSlideIndex,
      trackSlideChange,
      sendImmersiveSmartboardPayload,
    ],
  );

  const messagingCoursePlanSplit = useMemo(
    () => ({
      native: { slides: messagingNativeSlides, index: nativeSlideIndex },
      import: { slides: messagingImportSlides, index: importSlideIndex },
    }),
    [messagingNativeSlides, messagingImportSlides, nativeSlideIndex, importSlideIndex],
  );

  const liriMobileSmartboardOverlayPlan = useMemo(
    () => ({
      plan: buildMaquettePlanRibbon({
        activeScene,
        coursePlanSplit: messagingCoursePlanSplit,
        slideIndex: messagingShellSlideIndex,
        totalSlides: Math.max(
          1,
          messagingSlideRailCount != null ? messagingSlideRailCount : messagingDisplaySlides.length,
        ),
      }),
      sceneCaption: buildMaquetteSceneLineCaption({
        activeScene,
        compositorSlide: messagingParallaxSlide,
        scriptCurrentSection,
      }),
    }),
    [
      activeScene,
      messagingCoursePlanSplit,
      messagingShellSlideIndex,
      messagingSlideRailCount,
      messagingDisplaySlides.length,
      messagingParallaxSlide,
      scriptCurrentSection,
    ],
  );

  const onMessagingAnnotationStrokesChange = useCallback(
    (update) => {
      if (!isMessagingLiveHost) return;
      setAnnotationStrokes((prev) => {
        const p = Array.isArray(prev) ? prev : [];
        const next = typeof update === 'function' ? update(p) : update;
        const raw = Array.isArray(next) ? next : [];
        const { strokes, truncated, removed } = sanitizeAnnotationStrokesForBroadcast(raw);
        if (truncated && removed > 0) {
          queueMicrotask(() => {
            toast({
              title: 'Annotations limitées',
              description:
                removed <= 1
                  ? `Le trait le plus ancien a été retiré (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}). Vous pouvez effacer le calque ou changer de slide.`
                  : `Les ${removed} traits les plus anciens ont été retirés (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}). Effacez le calque ou changez de slide si besoin.`,
              duration: 8000,
            });
          });
        }
        annotationStrokesRef.current = strokes;
        queueMicrotask(() => sendImmersiveSmartboardPayload({ annotationStrokes: strokes }));
        return strokes;
      });
    },
    [isMessagingLiveHost, sendImmersiveSmartboardPayload, toast],
  );

  const onMessagingWhiteboardStrokesChange = useCallback(
    (update) => {
      if (!isMessagingLiveHost) return;
      setWhiteboardPages((pagesPrev) => {
        const idx = whiteboardPageIndexRef.current;
        const pages = normalizeWhiteboardPages(pagesPrev);
        const cur = [...(pages[idx] || [])];
        const nextCur = typeof update === 'function' ? update(cur) : update;
        const raw = Array.isArray(nextCur) ? nextCur : [];
        const { strokes, truncated, removed } = sanitizeAnnotationStrokesForBroadcast(raw);
        if (truncated && removed > 0) {
          queueMicrotask(() => {
            toast({
              title: 'Tableau blanc limité',
              description:
                removed <= 1
                  ? `L'élément le plus ancien a été retiré (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}).`
                  : `Les ${removed} éléments les plus anciens ont été retirés (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}).`,
              duration: 8000,
            });
          });
        }
        const nextPages = [...pages];
        nextPages[idx] = strokes;
        whiteboardPagesRef.current = nextPages;
        const patch = whiteboardBroadcastPatch(nextPages, idx);
        whiteboardStrokesRef.current = patch.whiteboardStrokes;
        queueMicrotask(() => sendImmersiveSmartboardPayload(patch));
        return nextPages;
      });
    },
    [isMessagingLiveHost, sendImmersiveSmartboardPayload, toast],
  );

  const goMessagingWhiteboardPrevPage = useCallback(() => {
    if (!isMessagingLiveHost) return;
    const pages = whiteboardPagesRef.current;
    const i = whiteboardPageIndexRef.current;
    if (i <= 0) return;
    const next = i - 1;
    whiteboardPageIndexRef.current = next;
    setWhiteboardPageIndex(next);
    const patch = whiteboardBroadcastPatch(pages, next);
    whiteboardStrokesRef.current = patch.whiteboardStrokes;
    queueMicrotask(() => sendImmersiveSmartboardPayload(patch));
  }, [isMessagingLiveHost, sendImmersiveSmartboardPayload]);

  const goMessagingWhiteboardNextPage = useCallback(() => {
    if (!isMessagingLiveHost) return;
    const pages = whiteboardPagesRef.current;
    const i = whiteboardPageIndexRef.current;
    if (i >= pages.length - 1) return;
    const next = i + 1;
    whiteboardPageIndexRef.current = next;
    setWhiteboardPageIndex(next);
    const patch = whiteboardBroadcastPatch(pages, next);
    whiteboardStrokesRef.current = patch.whiteboardStrokes;
    queueMicrotask(() => sendImmersiveSmartboardPayload(patch));
  }, [isMessagingLiveHost, sendImmersiveSmartboardPayload]);

  const addMessagingWhiteboardPage = useCallback(() => {
    if (!isMessagingLiveHost) return;
    const prev = whiteboardPagesRef.current;
    if (prev.length >= WHITEBOARD_MAX_PAGES) return;
    const next = [...prev, []];
    const newIdx = next.length - 1;
    whiteboardPagesRef.current = next;
    whiteboardPageIndexRef.current = newIdx;
    setWhiteboardPages(next);
    setWhiteboardPageIndex(newIdx);
    const patch = whiteboardBroadcastPatch(next, newIdx);
    whiteboardStrokesRef.current = patch.whiteboardStrokes;
    queueMicrotask(() => sendImmersiveSmartboardPayload(patch));
  }, [isMessagingLiveHost, sendImmersiveSmartboardPayload]);

  const removeMessagingWhiteboardPage = useCallback(() => {
    if (!isMessagingLiveHost) return;
    const prev = whiteboardPagesRef.current;
    if (prev.length <= 1) return;
    const idx = whiteboardPageIndexRef.current;
    const next = prev.filter((_, j) => j !== idx);
    const newIdx = Math.min(idx, next.length - 1);
    whiteboardPagesRef.current = next;
    whiteboardPageIndexRef.current = newIdx;
    setWhiteboardPages(next);
    setWhiteboardPageIndex(newIdx);
    const patch = whiteboardBroadcastPatch(next, newIdx);
    whiteboardStrokesRef.current = patch.whiteboardStrokes;
    queueMicrotask(() => sendImmersiveSmartboardPayload(patch));
  }, [isMessagingLiveHost, sendImmersiveSmartboardPayload]);

  const pickMessagingCoursePlanSlide = useCallback(
    (kind, idx) => {
      if (!isMessagingLiveHost) return;
      if (kind === 'native') {
        setActiveScene('smartboard');
        const n = Math.max(0, Math.min(Math.max(messagingNativeSlides.length, 1) - 1, idx));
        if (n !== nativeSlideIndex) trackSlideChange(n);
        setNativeSlideIndex(n);
        setLiveSlideIndex(n);
        sendImmersiveSmartboardPayload({
          slideIndex: n,
          nativeSlideIndex: n,
          activeScene: 'smartboard',
        });
        return;
      }
      setActiveScene('diapo');
      const n = Math.max(0, Math.min(Math.max(messagingImportSlides.length, 1) - 1, idx));
      if (n !== importSlideIndex) trackSlideChange(n);
      setImportSlideIndex(n);
      setLiveSlideIndex(n);
      sendImmersiveSmartboardPayload({
        slideIndex: n,
        importSlideIndex: n,
        activeScene: 'diapo',
      });
    },
    [
      isMessagingLiveHost,
      messagingNativeSlides.length,
      messagingImportSlides.length,
      nativeSlideIndex,
      importSlideIndex,
      trackSlideChange,
      sendImmersiveSmartboardPayload,
    ],
  );

  const goPrevMessagingSlide = useCallback(() => {
    if (activeScene === 'smartboard') {
      changeMessagingSlide(Math.max(0, nativeSlideIndex - 1));
    } else if (activeScene === 'diapo') {
      changeMessagingSlide(Math.max(0, importSlideIndex - 1));
    } else {
      changeMessagingSlide(Math.max(0, liveSlideIndex - 1));
    }
  }, [activeScene, nativeSlideIndex, importSlideIndex, liveSlideIndex, changeMessagingSlide]);

  const goNextMessagingSlide = useCallback(() => {
    if (activeScene === 'smartboard') {
      changeMessagingSlide(Math.min(Math.max(messagingNativeSlides.length, 1) - 1, nativeSlideIndex + 1));
    } else if (activeScene === 'diapo') {
      changeMessagingSlide(Math.min(Math.max(messagingImportSlides.length, 1) - 1, importSlideIndex + 1));
    } else {
      changeMessagingSlide(Math.min(Math.max(messagingDisplaySlides.length, 1) - 1, liveSlideIndex + 1));
    }
  }, [
    activeScene,
    nativeSlideIndex,
    importSlideIndex,
    liveSlideIndex,
    messagingNativeSlides.length,
    messagingImportSlides.length,
    messagingDisplaySlides.length,
    changeMessagingSlide,
  ]);

  const messagingSharedImagePrev = useCallback(() => {
    if (!isMessagingLiveHost) return;
    const g = sharedImageGalleryRef.current;
    if (!g.length) return;
    const next = Math.max(0, sharedImageIdxRef.current - 1);
    setSharedImageIdx(next);
    sendImmersiveSmartboardPayload({ sharedImageIdx: next });
  }, [isMessagingLiveHost, sendImmersiveSmartboardPayload]);

  const messagingSharedImageNext = useCallback(() => {
    if (!isMessagingLiveHost) return;
    const g = sharedImageGalleryRef.current;
    if (!g.length) return;
    const next = Math.min(g.length - 1, sharedImageIdxRef.current + 1);
    setSharedImageIdx(next);
    sendImmersiveSmartboardPayload({ sharedImageIdx: next });
  }, [isMessagingLiveHost, sendImmersiveSmartboardPayload]);

  const messagingToggleSharedImageLoop = useCallback((v) => {
    if (!isMessagingLiveHost) return;
    setSharedImageLoop(v);
    sendImmersiveSmartboardPayload({ sharedImageLoop: v });
  }, [isMessagingLiveHost, sendImmersiveSmartboardPayload]);

  useEffect(() => {
    if (!isMessagingLiveHost || activeScene !== 'image' || !sharedImageLoop || sharedImageGallery.length < 2) {
      return undefined;
    }
    const t = window.setInterval(() => {
      setSharedImageIdx((i) => {
        const len = sharedImageGalleryRef.current.length;
        if (len < 2) return i;
        const next = (i + 1) % len;
        queueMicrotask(() => sendImmersiveSmartboardPayload({ sharedImageIdx: next }));
        return next;
      });
    }, 7000);
    return () => window.clearInterval(t);
  }, [isMessagingLiveHost, activeScene, sharedImageLoop, sharedImageGallery.length, sendImmersiveSmartboardPayload]);

  useEffect(() => {
    if (!liveSessionId || !liveActive) return undefined;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('immersive_live_sessions')
        .select('smartboard_shared_images_json, smartboard_scenes_json')
        .eq('id', liveSessionId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        if (import.meta.env.DEV) {
          console.warn('[MessagingPage] immersive_live_sessions smartboard fetch:', error.message, error);
        }
        return;
      }
      const g = normalizeMessagingSharedGallery(data?.smartboard_shared_images_json);
      if (g.length > 0) setSharedImageGallery(g);
      const scenes = normalizeImmersiveSmartboardScenesJson(data?.smartboard_scenes_json);
      if (Object.keys(scenes).length > 0) {
        setImmersiveSmartboardScenesRaw(scenes);
        immersiveSmartboardScenesRef.current = scenes;
      }
    })();
    return () => { cancelled = true; };
  }, [liveSessionId, liveActive]);

  // Sauter au dernier message quand les messages ou le destinataire changent
  useEffect(() => {
    if (convMessages.length > 0) {
      setActiveMessageIndex(convMessages.length - 1);
    } else {
      setActiveMessageIndex(-1);
    }
  }, [convMessages.length, recipientId]);

  useEffect(() => {
    if (!recipientId || !currentUser?.id) return;
    const unread = convMessages
      .filter((m) => m.receiver_id === currentUser.id && !m.is_read)
      .map((m) => m.id);
    if (unread.length > 0) markAsRead(unread);
  }, [convMessages, recipientId, currentUser?.id, markAsRead]);

  useEffect(() => {
    if (!liveActive) {
      setLiveMessageUnread(0);
      return;
    }
    if (liveMessageDrawerOpen) {
      setLiveMessageUnread(0);
      liveForumSeenCountRef.current = liveForumMessages.length;
      return;
    }
    const n = liveForumMessages.length;
    const prev = liveForumSeenCountRef.current;
    if (n <= prev) return;
    const inc = liveForumMessages
      .slice(prev)
      .filter((m) => String(m.sender_id) !== String(currentUser?.id)).length;
    if (inc > 0) setLiveMessageUnread((v) => v + inc);
    liveForumSeenCountRef.current = n;
  }, [liveForumMessages, liveActive, liveMessageDrawerOpen, currentUser?.id]);

  const { remoteText, isRemoteTyping, broadcastTyping, broadcastSent } = useTypingBroadcast(
    currentUser?.id,
    recipientId
  );

  const handleSelectUser = useCallback((user) => {
    setSelectedRecipient(user);
    setActiveMessageIndex(-1);
    // Fetch ciblé suffisant (le realtime + polling complètent).
    fetchAndMergeConversation(user.id);
  }, [fetchAndMergeConversation]);

  // Deep-link « Discuter avec l'auteur » depuis le forum : /messages?to=<userId>&name=<nom>
  // → ouvre/crée la conversation 1-à-1 avec cette personne (find_or_create côté API).
  // C'est le pont forum → conversation face-à-face (chat/audio/vidéo).
  const [deepLinkParams] = useSearchParams();
  const deepLinkedPeerRef = useRef(false);
  useEffect(() => {
    if (deepLinkedPeerRef.current) return;
    const to = deepLinkParams.get('to');
    if (!to) return;
    deepLinkedPeerRef.current = true;
    const known = profiles[to] || {};
    handleSelectUser({
      id: to,
      name: deepLinkParams.get('name') || known.name || 'Membre',
      avatar_url: known.avatar_url || null,
      role: known.role || 'student',
      status: known.status || 'offline',
      ...known,
    });
  }, [deepLinkParams, profiles, handleSelectUser]);

  const handleSelectConversation = useCallback(
    (conv) => {
      // Ouvrir un DM ferme la vue Sujet (mutuellement exclusifs).
      closeActiveTopicView();
      const profile = profiles[conv.participantId] || conv;
      setSelectedRecipient({
        id: conv.participantId,
        name: conv.name,
        avatar_url: conv.avatar_url,
        role: conv.role,
        status: conv.status,
        ...profile,
      });
      setActiveMessageIndex(-1);
      // Fetch ciblé suffisant (évite un rechargement complet lourd).
      fetchAndMergeConversation(conv.participantId);
    },
    [profiles, fetchAndMergeConversation, closeActiveTopicView]
  );

  // ── SUJETS : handlers additifs ────────────────────────────────────────────────
  // ⚠️ stopLiveRoom est défini BIEN plus bas (ses deps stopLocalRecording/resetMiniOffset
  // sont déclarées après ce point → impossible de le remonter). On l'appelle via un ref
  // pour NE PAS le citer dans les deps de handleOpenTopic : sinon l'évaluation immédiate du
  // tableau de deps accède à un `const` pas encore initialisé → TDZ « Cannot access
  // 'stopLiveRoom' before initialization » qui plantait TOUTE la messagerie au chargement.
  const stopLiveRoomRef = useRef(null);
  const handleOpenTopic = useCallback(
    (topic) => {
      // Un Sujet est un fil de groupe (chat seul) : on stoppe tout live 1:1 en cours et
      // on libère le destinataire DM pour basculer le centre sur le sujet.
      if (liveActive) void stopLiveRoomRef.current?.();
      setSelectedRecipient(null);
      setActiveMessageIndex(-1);
      setShowConversationList(false);
      void openTopic(topic);
    },
    [liveActive, openTopic]
  );

  const handleCreateTopic = useCallback(
    async (payload) => {
      const created = await createTopicApi(payload);
      if (created) {
        setConvFilter('topics');
        handleOpenTopic(created);
      }
      return created;
    },
    [createTopicApi, handleOpenTopic]
  );

  const handleToggleTopicStatus = useCallback(
    async (next) => {
      setTopicStatusBusy(true);
      await setActiveTopicStatus(next);
      setTopicStatusBusy(false);
    },
    [setActiveTopicStatus]
  );

  const handleSend = useCallback(
    async (content) => {
      if (!recipientId) return false;
      broadcastSent();
      const msg = await sendMessage(recipientId, content);
      if (msg) {
        setSendError('');
        setJustSentId(msg.id);
        setTimeout(() => setJustSentId(null), 2000);
        return true;
      }
      setSendError("Échec d'envoi. Vérifiez la session Supabase et les policies messages.");
      return false;
    },
    [recipientId, sendMessage, broadcastSent]
  );

  const handleTyping = useCallback(
    (text) => {
      broadcastTyping(text);
    },
    [broadcastTyping]
  );

  const handleDeleteMessage = useCallback(
    async (messageId) => {
      setDeleting(true);
      await deleteMessage(messageId);
      setDeleting(false);
      setDeleteCandidate(null);
    },
    [deleteMessage]
  );

  const handleRequestDelete = useCallback((message) => {
    setDeleteCandidate(message);
  }, []);

  const handleEditMessage = useCallback(
    async (messageId, newContent) => {
      const data = await editMessage(messageId, newContent);
      return !!data;
    },
    [editMessage]
  );

  const notifyBrowser = useCallback((title, body) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const send = () => {
      try {
        new Notification(title, { body });
      } catch {
        // ignore
      }
    };
    if (Notification.permission === 'granted') {
      send();
      return;
    }
    if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') send();
      });
    }
  }, []);

  const playAlarmTone = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!sonnerieRef.current) return;
    if (!alarmAudioArmedRef.current) return;
    const ctx = alarmAudioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume?.().catch(() => {});
      return;
    }
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    [0, 1, 2].forEach((idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = idx % 2 === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.22 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.22 + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + idx * 0.22);
      osc.stop(now + idx * 0.22 + 0.22);
    });
  }, []);

  // fetchLatestInvites / sendLiveInvite / acceptIncomingInvite / declineIncomingInvite
  // → remplacés par useLiveInvite (branché après startLiveRoom, voir plus bas).

  const scheduleMissedInvite = useCallback((invite) => {
    if (!invite || !currentUser?.id) return;
    const targetId = invite.sender_id === currentUser.id ? invite.receiver_id : invite.sender_id;
    const profile = profiles[targetId];
    if (!profile) return;
    setSelectedRecipient({
      id: profile.id,
      name: profile.name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      status: profile.status,
      ...profile,
    });
    setLiveAgendaOpen(false);
    const suggested = new Date(Date.now() + 30 * 60 * 1000);
    const local = new Date(suggested.getTime() - suggested.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setInviteScheduleAt(local);
    setInvitePanelOpen(true);
    setLiveError('Programmez un nouveau live via le calendrier.');
    fetchAndMergeConversation(targetId);
  }, [currentUser?.id, fetchAndMergeConversation, profiles]);

  const openInviteConversation = useCallback((invite, options = {}) => {
    if (!invite || !currentUser?.id) return;
    const targetId = invite.sender_id === currentUser.id ? invite.receiver_id : invite.sender_id;
    const profile = profiles[targetId];
    if (!profile) return;
    setSelectedRecipient({
      id: profile.id,
      name: profile.name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      status: profile.status,
      ...profile,
    });
    setLiveAgendaOpen(false);
    if (options?.reprogram) {
      const suggested = new Date(Date.now() + 30 * 60 * 1000);
      const local = new Date(suggested.getTime() - suggested.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setInviteScheduleAt(local);
      setInvitePanelOpen(true);
      setLiveError('Reprogrammez la date puis validez "Programmer".');
    }
    fetchAndMergeConversation(targetId);
  }, [currentUser?.id, fetchAndMergeConversation, profiles]);

  const bindMainLiveStream = useCallback((stream) => {
    if (liveMainVideoRef.current) liveMainVideoRef.current.srcObject = stream;
  }, []);

  const bindMiniLiveStream = useCallback((stream) => {
    if (liveMiniVideoRef.current) liveMiniVideoRef.current.srcObject = stream;
  }, []);

  const bindLocalLiveStream = useCallback((stream) => {
    bindMainLiveStream(stream);
    bindMiniLiveStream(stream);
  }, [bindMainLiveStream, bindMiniLiveStream]);

  const reviveLiveMediaElements = useCallback(() => {
    const localStream = localLiveStreamRef.current;
    if (localStream) {
      if (liveMainVideoRef.current) {
        if (liveMainVideoRef.current.srcObject !== localStream) {
          liveMainVideoRef.current.srcObject = localStream;
        }
        liveMainVideoRef.current.play?.().catch(() => {});
      }
      if (liveMiniVideoRef.current) {
        if (liveMiniVideoRef.current.srcObject !== localStream) {
          liveMiniVideoRef.current.srcObject = localStream;
        }
        liveMiniVideoRef.current.play?.().catch(() => {});
      }
    }

    const displayStream = displayLiveStreamRef.current;
    if (displayStream && screenShareVideoRef.current) {
      if (screenShareVideoRef.current.srcObject !== displayStream) {
        screenShareVideoRef.current.srcObject = displayStream;
      }
      screenShareVideoRef.current.play?.().catch(() => {});
    }
  }, []);

  const commitLocalLiveStream = useCallback((stream) => {
    if (!stream) return;
    const prev = localLiveStreamRef.current;
    if (prev && prev !== stream) {
      prev.getTracks?.().forEach((track) => track.stop());
    }
    localLiveStreamRef.current = stream;
    setLocalCameraStreamState(stream);
    stream.getAudioTracks?.().forEach((track) => {
      track.enabled = !liveMuted;
    });
    stream.getVideoTracks?.().forEach((track) => {
      track.enabled = !liveCameraOff;
    });
    bindLocalLiveStream(stream);
    setLocalStreamVersion((v) => v + 1);
    requestAnimationFrame(() => reviveLiveMediaElements());
  }, [bindLocalLiveStream, liveCameraOff, liveMuted, reviveLiveMediaElements]);

  // ── PiP canvas capture — quand la segmentation est active, capturer le canvas ──
  const handlePipCanvasRef = useCallback((canvas) => {
    if (canvas) {
      try {
        const stream = canvas.captureStream(25);
        setLocalPipStream(stream);
      } catch {
        setLocalPipStream(null);
      }
    } else {
      // Segmentation désactivée — utiliser le flux brut comme fallback PiP
      setLocalPipStream(localLiveStreamRef.current || null);
    }
  }, []);

  const handleMessagingVbgChange = useCallback((v) => {
    setVideoVbg(v);
    if (v !== 'none') setVideoChromaKey(false);
  }, []);

  const handleMessagingChromaKeyChange = useCallback((on) => {
    if (on) {
      setVideoVbg((v) => {
        vbgBeforeChromaRef.current = v;
        return 'none';
      });
      setVideoChromaKey(true);
    } else {
      setVideoChromaKey(false);
      setVideoVbg(vbgBeforeChromaRef.current ?? 'immersive');
    }
  }, []);

  useEffect(() => {
    if (!liveActive) return undefined;
    const handleMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 16;
      const y = (e.clientY / window.innerHeight - 0.5) * 14;
      setMessagingLiveParallax({ x, y });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [liveActive]);

  // ── Device switching (camera / microphone) ────────────────────────────────
  const handleSelectCamera = useCallback(async (deviceId) => {
    if (!liveActive) return;
    try {
      const currentAudioTrack = localLiveStreamRef.current?.getAudioTracks?.()?.[0];
      const audioConstraint = currentAudioTrack
        ? { deviceId: { exact: currentAudioTrack.getSettings().deviceId } }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: audioConstraint,
      });
      commitLocalLiveStream(stream);
    } catch { /* user denied or device unavailable */ }
  }, [liveActive, commitLocalLiveStream]);

  const handleSelectMic = useCallback(async (deviceId) => {
    if (!liveActive) return;
    try {
      const currentVideoTrack = localLiveStreamRef.current?.getVideoTracks?.()?.[0];
      const videoConstraint = currentVideoTrack
        ? { deviceId: { exact: currentVideoTrack.getSettings().deviceId } }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: { deviceId: { exact: deviceId } },
      });
      commitLocalLiveStream(stream);
    } catch { /* user denied or device unavailable */ }
  }, [liveActive, commitLocalLiveStream]);

  const stopScreenShare = useCallback(() => {
    displayLiveStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    displayLiveStreamRef.current = null;
    setLocalScreenStreamState(null);
    if (screenShareVideoRef.current) {
      screenShareVideoRef.current.pause();
      screenShareVideoRef.current.srcObject = null;
    }
    setSharingScreen(false);
    setLiveShareOpen(false);
    setActiveScene('diapo'); // retour scène par défaut
  }, []);

  const stopLocalRecording = useCallback(() => {
    return new Promise((resolve) => {
      const rec = liveRecorderRef.current;
      if (!rec) {
        resolve({ localUrl: liveRecordUrl, cloudUrl: liveCloudUrl });
        return;
      }
      if (rec.state === 'inactive') {
        resolve({ localUrl: liveRecordUrl, cloudUrl: liveCloudUrl });
        return;
      }
      rec.__resolveStop = resolve;
      const fallbackId = window.setTimeout(() => {
        if (rec.__resolveStop) {
          rec.__resolveStop({ localUrl: liveRecordUrl, cloudUrl: liveCloudUrl });
          rec.__resolveStop = null;
        }
      }, 1500);
      rec.__stopFallbackId = fallbackId;
      try {
        /* flush le dernier chunk pour éviter un blob vide (ERR_REQUEST_RANGE_NOT_SATISFIABLE) */
        try { rec.requestData(); } catch { /* ignore */ }
        rec.stop();
      } catch {
        resolve({ localUrl: liveRecordUrl, cloudUrl: liveCloudUrl });
      }
    });
  }, [liveCloudUrl, liveRecordUrl]);

  const uploadLiveRecording = useCallback(
    async (blob) => {
      if (!blob) return '';
      const bucket = import.meta.env.VITE_SUPABASE_LIVE_RECORDINGS_BUCKET || 'live-recordings';
      const filePath = `${currentUser?.id || 'anonymous'}/${new Date().toISOString().replace(/[:.]/g, '-')}-${recipientId || 'direct'}.webm`;
      setUploadingLiveRecord(true);
      try {
        const { error: uploadError } = await runStorageWithAuthRetry(supabase, () =>
          supabase.storage.from(bucket).upload(filePath, blob, {
            contentType: 'video/webm',
            upsert: false,
          })
        );
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        const maybePublicUrl = publicData?.publicUrl || '';
        if (maybePublicUrl) {
          setLiveCloudUrl(maybePublicUrl);
          return maybePublicUrl;
        }
        const { data: signedData, error: signedError } = await runStorageWithAuthRetry(supabase, () =>
          supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 60 * 24 * 7)
        );
        if (signedError) throw signedError;
        setLiveCloudUrl(signedData?.signedUrl || '');
        return signedData?.signedUrl || '';
      } catch (e) {
        console.error('[Live] upload record error', e);
        setLiveError("Upload cloud indisponible. L'enregistrement local reste disponible.");
        return '';
      } finally {
        setUploadingLiveRecord(false);
      }
    },
    [currentUser?.id, recipientId]
  );

  const startLocalRecording = useCallback(() => {
    const stream = displayLiveStreamRef.current || localLiveStreamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      setLiveError("Impossible de démarrer l'enregistrement local.");
      return;
    }
    try {
      setLiveError('');
      if (liveRecordUrl && typeof URL !== 'undefined') {
        URL.revokeObjectURL(liveRecordUrl);
        setLiveRecordUrl('');
      }
      liveRecordChunksRef.current = [];
      let rec;
      try {
        rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      } catch {
        rec = new MediaRecorder(stream);
      }
      rec.ondataavailable = (e) => {
        if (e.data?.size > 0) liveRecordChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        if (rec.__stopFallbackId) {
          window.clearTimeout(rec.__stopFallbackId);
          rec.__stopFallbackId = null;
        }
        const blob = new Blob(liveRecordChunksRef.current, { type: 'video/webm' });
        /* blob vide → Range request impossible (ERR_REQUEST_RANGE_NOT_SATISFIABLE) */
        if (blob.size === 0) {
          setIsRecordingLive(false);
          setLiveRecordElapsedSec(0);
          if (rec.__resolveStop) { rec.__resolveStop({ localUrl: '', cloudUrl: '' }); rec.__resolveStop = null; }
          return;
        }
        const url = URL.createObjectURL(blob);
        setLiveRecordUrl(url);
        setIsRecordingLive(false);
        setLiveRecordElapsedSec(0);
        if (rec.__resolveStop) {
          rec.__resolveStop({ localUrl: url, cloudUrl: '' });
          rec.__resolveStop = null;
        }
        void uploadLiveRecording(blob);
      };
      rec.start(1000);
      liveRecorderRef.current = rec;
      setIsRecordingLive(true);
    } catch {
      setLiveError('Votre navigateur ne supporte pas cet enregistrement.');
      setIsRecordingLive(false);
    }
  }, [liveRecordUrl, uploadLiveRecording]);

  const startScreenShare = useCallback(async () => {
    if (sharingScreen) {
      stopScreenShare();
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) return;
    try {
      let displayStream;
      try {
        // Prefer browser tab/window capture without forcing focus to the app tab.
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 30, max: 30 },
            // Chrome-specific optional hints (ignored where unsupported).
            displaySurface: 'browser',
            selfBrowserSurface: 'exclude',
            surfaceSwitching: 'include',
            monitorTypeSurfaces: 'exclude',
          },
          audio: true,
          preferCurrentTab: false,
        });
      } catch {
        // Fallback for browsers that reject advanced constraints.
        displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      }
      displayLiveStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      displayLiveStreamRef.current = displayStream;
      setLocalScreenStreamState(displayStream);
      setSharingScreen(true);
      setLiveShareOpen(true);
      setLiveMode('presentation');
      // Le flux s'affiche par-dessus SmartBoard / Diaporama (SmartBoardCompositor) sans changer de scène.

      // Assign srcObject and call play() explicitly.
      // The video element is always in the DOM (opacity:0 when inactive) so ref is always valid.
      const applyStream = (el) => {
        if (!el) return;
        el.srcObject = displayStream;
        el.play().catch(() => {});
      };

      if (screenShareVideoRef.current) {
        applyStream(screenShareVideoRef.current);
      } else {
        // Safety net: wait one frame for React to commit the ref
        requestAnimationFrame(() => applyStream(screenShareVideoRef.current));
      }

      // Some browsers may drop local cam track during display-capture switch.
      // Re-acquire camera immediately if the user expects camera to stay ON.
      const camTracks = localLiveStreamRef.current?.getVideoTracks?.() || [];
      const camAlive = camTracks.some((t) => t.readyState === 'live');
      if (!camAlive && !liveCameraOff) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          commitLocalLiveStream(stream);
        } catch {
          setLiveError('La caméra a été interrompue pendant le partage écran.');
        }
      }
      const track = displayStream.getVideoTracks?.()[0];
      if (track) {
        track.onended = () => stopScreenShare();
      }
    } catch {
      // User annulé ou navigateur refusé.
    }
  }, [sharingScreen, stopScreenShare, liveCameraOff, liveMuted, bindLocalLiveStream]);

  useEffect(() => {
    const target = screenShareVideoRef.current;
    const stream = displayLiveStreamRef.current || remoteScreenStream || null;
    if (!target) return;
    if (target.srcObject !== stream) {
      target.srcObject = null;
      target.load?.();
      target.srcObject = stream;
    }
    if (stream) target.play?.().catch(() => {});
  }, [localScreenStreamState, remoteScreenStream]);

  useEffect(() => {
    const target = remoteMainVideoRef.current;
    if (!target) return;
    if (target.srcObject !== remoteCameraStream) {
      target.srcObject = null;
      target.load?.();
      target.srcObject = remoteCameraStream;
    }
    if (remoteCameraStream) {
      target.play?.().catch(() => {});
      const resume = () => target.play?.().catch(() => {});
      window.addEventListener('pointerdown', resume, { once: true });
      return () => window.removeEventListener('pointerdown', resume);
    }
  }, [remoteCameraStream]);

  // Rétablir l'interlocuteur sur le PanelActif au premier flux distant, sans écraser
  // un choix « à l'antenne » déjà fixé sur un autre membre (multi / companion).
  useEffect(() => {
    if (!liveActive || !recipientId) {
      remoteCameraWasConnectedRef.current = false;
      return;
    }
    const hasRemoteCamera = Boolean(remoteCameraStream);
    const wasConnected = remoteCameraWasConnectedRef.current;
    if (hasRemoteCamera && !wasConnected) {
      setPromotedParticipantId((prev) => {
        if (prev && String(prev) !== String(currentUser?.id)) {
          return prev;
        }
        return recipientId;
      });
      remoteCameraWasConnectedRef.current = true;
      return;
    }
    if (!hasRemoteCamera) {
      remoteCameraWasConnectedRef.current = false;
    }
  }, [liveActive, recipientId, remoteCameraStream, currentUser?.id]);

  useEffect(() => {
    const target = remoteAudioRef.current;
    if (!target) return;
    // Safari fix: create an audio-only stream — sharing the same MediaStream across
    // two elements (video + audio) causes Safari to silently fail on one of them.
    const audioTracks = remoteCameraStream?.getAudioTracks?.() ?? [];
    const audioStream = audioTracks.length > 0 ? new MediaStream(audioTracks) : null;
    // Reset srcObject before assigning (Safari requirement)
    target.srcObject = null;
    target.load?.();
    target.srcObject = audioStream;
    target.muted = false;
    target.volume = 1;
    if (audioStream) {
      target.play?.().catch(() => {});
      const resume = () => target.play?.().catch(() => {});
      window.addEventListener('pointerdown', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
      return () => {
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
      };
    }
  }, [remoteCameraStream]);

  const resetMiniOffset = useCallback(() => {
    setMiniOffset({ x: 0, y: 0 });
  }, []);

  const handleRemoteScreenStateChange = useCallback((active) => {
    setRemoteSharingScreen(active);
  }, []);

  const handleSwapPanelFocus = useCallback(() => {
    if (!currentUser?.id || !recipientId) return;
    setPromotedParticipantId((prev) => (prev === currentUser.id ? recipientId : currentUser.id));
  }, [currentUser?.id, recipientId]);

  // stopLiveRoom doit être défini AVANT handleRemoteParticipantDisconnected
  // pour éviter un TDZ au rendu (useCallback évalue le tableau de deps immédiatement).
  // Toutes les données volatiles sont lues depuis liveDataRef.current — deps réduits à 2.
  const stopLiveRoom = useCallback(async () => {
    const d = liveDataRef.current;
    const activeInvite = liveInviteRef.current;
    const maybeRecorded = d.isRecording ? await stopLocalRecording() : null;
    const finalLocalUrl = maybeRecorded?.localUrl || d.recordUrl;
    const finalCloud = maybeRecorded?.cloudUrl || d.cloudUrl;
    const dominantMode = liveModeHistoryRef.current[liveModeHistoryRef.current.length - 1]?.mode || d.mode;
    const modeLabel =
      dominantMode === 'classroom'
        ? 'Classroom'
        : dominantMode === 'presentation'
          ? 'Présentation'
          : dominantMode === 'focus'
            ? 'Focus écrit'
            : 'Conversation + live';
    const aiSummary = buildLiveAiSummary({
      durationSec: d.elapsedSec,
      participantName: d.recipientName,
      modeLabel,
      usedScreenShare: d.sharingScreen || d.shareOpen,
      notes: d.smartBoardText,
      hasRecording: Boolean(finalLocalUrl || finalCloud),
    });
    setLiveSummaryData({
      durationSec: d.elapsedSec,
      participantName: d.recipientName || 'Participant',
      modeLabel,
      startedAt: d.startedAt,
      endedAt: Date.now(),
      localRecordUrl: finalLocalUrl,
      cloudRecordUrl: finalCloud,
      notes: d.smartBoardText,
      ai: aiSummary,
    });
    setLiveSummaryOpen(true);
    // Nettoyage immédiat — invite gérée par useLiveInvite (statut DB → realtime).
    liveInviteRef.current = null;
    // Toujours marquer l'invite comme 'ended', qu'on soit à l'origine de
    // la déconnexion ou non. Évite les invites 'accepted' stalées en DB
    // (qui provoquent les auto-lancements au prochain montage).
    if (activeInvite?.id && ['accepted', 'pending'].includes(activeInvite?.status)) {
      void supabase
        .from('live_chat_invites')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', activeInvite.id);
    }
    // Safety net: termine toute invite pending/accepted pour la même conversation.
    if (d.conversationKey) {
      void supabase
        .from('live_chat_invites')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('conversation_key', d.conversationKey)
        .in('status', ['accepted', 'pending']);
    }
    if (!remoteStopRef.current && d.sessionId) {
      void supabase
        .from('immersive_live_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', d.sessionId);
    }
    localLiveStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    displayLiveStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    localLiveStreamRef.current = null;
    displayLiveStreamRef.current = null;
    setLocalCameraStreamState(null);
    setLocalScreenStreamState(null);
    setRemoteCameraStream(null);
    setRemoteScreenStream(null);
    setRemoteSharingScreen(false);
    liveRecorderRef.current = null;
    liveRecordChunksRef.current = [];
    if (liveMainVideoRef.current) liveMainVideoRef.current.srcObject = null;
    if (liveMiniVideoRef.current) liveMiniVideoRef.current.srcObject = null;
    if (remoteMainVideoRef.current) remoteMainVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    camera2StreamRef.current?.getTracks?.().forEach((track) => track.stop());
    camera2StreamRef.current = null;
    if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
    setCamera2Active(false);
    setLiveSmartboardCam2Source(null);
    liveSmartboardCam2SourceRef.current = null;
    setSharedImageGallery([]);
    setSharedImageIdx(0);
    setSharedImageLoop(false);
    setImmersiveSmartboardScenesRaw({});
    immersiveSmartboardScenesRef.current = {};
    setLiveMuted(false);
    setLiveCameraOff(false);
    setLiveShowParticipants(false);
    setLiveShareOpen(false);
    setLiveSmartBoardOpen(false);
    setSharingScreen(false);
    setIsRecordingLive(false);
    setLiveRecordElapsedSec(0);
    setLiveMessageDrawerOpen(false);
    setLiveNeuronqModalOpen(false);
    setLiveMessageUnread(0);
    setLiveSpotlightOn(false);
    setActiveScene('diapo');
    setPromotedParticipantId(null);
    setLiveSlideIndex(0);
    setNativeSlideIndex(0);
    setImportSlideIndex(0);
    setAnnotationStrokes([]);
    annotationStrokesRef.current = [];
    const wb = [[]];
    setWhiteboardPages(wb);
    setWhiteboardPageIndex(0);
    whiteboardPagesRef.current = wb;
    whiteboardPageIndexRef.current = 0;
    whiteboardStrokesRef.current = [];
    messagingSlideAnnotationContextRef.current = null;
    setLiveStage('idle');
    setLiveExpanded(false);
    setLiveMode('conversation');
    setLiveStartedAt(null);
    setLiveElapsedSec(0);
    resetMiniOffset();
    setLiveActive(false);
    setLiveSessionId(null);
    setImmersiveHostUserId(null);
    setCompanionQrOpen(false);
    setCompanionJoinUrl('');
    setCompanionLinkError('');
    remoteStopRef.current = false;
    setIsLiveReconnecting(false);
    setLiveConnectionQuality(null);

    // Proposer le rapport post-appel (seulement si l'appel a duré plus de 30s)
    const durationMs = callStartTimeRef.current ? Date.now() - callStartTimeRef.current : 0;
    const durationSec = Math.round(durationMs / 1000);
    if (durationSec >= 30) {
      setTimeout(() => {
        setPostCallModal({ open: true, durationSeconds: durationSec });
      }, 800);
    }

    // Résumé LIRI post-session
    const capturedSessionId    = d.sessionId;
    const capturedRecipientName = d.recipientName;
    if (durationSec >= 30 && capturedSessionId) {
      setTimeout(() => {
        setSummaryModalOpen(true);
      }, 1200);
    }

    callStartTimeRef.current = null;

    // Lance la génération en arrière-plan (ne bloque pas la fermeture du live)
    if (durationSec >= 30 && capturedSessionId) {
      void generateLiveSummary({
        sessionId:       capturedSessionId,
        participantName: capturedRecipientName,
        durationSeconds: durationSec,
        slides:          d.slides || [],
        questions:       d.questions || [],
        scriptSections:  d.scriptSections || [],
      });
    }
  }, [stopLocalRecording, resetMiniOffset, generateLiveSummary]);
  // Tient stopLiveRoomRef à jour pour handleOpenTopic (défini plus haut, voir la note là-bas).
  // Assignation pendant le render : sûre, le ref est prêt avant toute interaction utilisateur.
  stopLiveRoomRef.current = stopLiveRoom;

  const handleClearRecipient = () => {
    if (liveActive) {
      void stopLiveRoom();
    }
    setSelectedRecipient(null);
    setActiveMessageIndex(-1);
    setLiveSessionId(null);
    setImmersiveHostUserId(null);
  };

  const handleLiriMobileConfirmExit = useCallback(() => {
    void stopLiveRoom();
    navigate(-1);
  }, [navigate, stopLiveRoom]);

  // ── 2-person call: quand l'autre se déconnecte, on termine l'appel pour les deux ──
  const handleRemoteParticipantDisconnected = useCallback(async () => {
    if (!liveActive) return;
    // Marquer la session comme terminée dans Supabase (le realtime listener de l'autre côté réagira)
    if (liveSessionId) {
      await supabase
        .from('immersive_live_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', liveSessionId);
    }
    remoteStopRef.current = true;
    setLiveError('Votre interlocuteur a quitté l\'appel.');
    void stopLiveRoom();
  }, [liveActive, liveSessionId, stopLiveRoom]);

  const primaryRemoteIdentityForKit = recipientProfile?.id ? String(recipientProfile.id) : null;

  const { roomRef: immersiveLiveKitRoomRef, auxiliaryParticipants } = useImmersiveLiveKit({
    enabled: liveActive && !!liveSessionId && !!currentUser?.id && !!recipientId,
    liveSessionId,
    currentUserId: currentUser?.id,
    primaryRemoteIdentity: primaryRemoteIdentityForKit,
    localCameraStream: localCameraStreamState,
    localScreenStream: localScreenStreamState,
    onRemoteCameraStream: setRemoteCameraStream,
    onRemoteScreenStream: setRemoteScreenStream,
    onRemoteScreenStateChange: handleRemoteScreenStateChange,
    onParticipantDisconnected: handleRemoteParticipantDisconnected,
    onReconnecting: useCallback(() => {
      setIsLiveReconnecting(true);
      setLiveError('');
    }, []),
    onReconnected: useCallback(() => {
      setIsLiveReconnecting(false);
      setLiveError('');
    }, []),
    onConnectionQuality: useCallback((q) => {
      setLiveConnectionQuality(q);
      if (q === 'lost') setLiveError('Signal réseau perdu — vérifiez votre connexion.');
      else if (q === 'poor') setLiveError('Connexion faible — la qualité vidéo peut être réduite.');
      else setLiveError('');
    }, []),
    onError: useCallback((error) => {
      setIsLiveReconnecting(false);
      setLiveError(error?.message || 'Connexion LiveKit impossible pour ce live.');
    }, []),
  });

  const immersiveLiveKitCamera2Participants = useMemo(() => {
    const out = [];
    if (currentUser?.id) {
      out.push({
        id: String(currentUser.id),
        name: currentUser.name || 'Vous',
        isLocal: true,
        isHost: Boolean(immersiveHostUserId && currentUser.id === immersiveHostUserId),
      });
    }
    if (recipientProfile?.id && recipientProfile.id !== currentUser?.id) {
      out.push({
        id: String(recipientProfile.id),
        name: recipientProfile.name || 'Interlocuteur',
        isLocal: false,
        isHost: Boolean(immersiveHostUserId && recipientProfile.id === immersiveHostUserId),
      });
    }
    return [...out, ...auxiliaryParticipants];
  }, [currentUser, recipientProfile, immersiveHostUserId, auxiliaryParticipants]);

  useEffect(() => {
    if (!companionQrOpen || !liveSessionId || !isMessagingLiveHost) return undefined;
    let cancelled = false;
    setCompanionLinkLoading(true);
    setCompanionLinkError('');
    setCompanionJoinUrl('');
    (async () => {
      try {
        const data = await createImmersiveCompanionLink(liveSessionId);
        if (cancelled) return;
        setCompanionJoinUrl(data.joinUrl || '');
        setCompanionExpiresAt(data.expiresAt || '');
      } catch (e) {
        if (!cancelled) setCompanionLinkError(e?.message || 'Erreur');
      } finally {
        if (!cancelled) setCompanionLinkLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companionQrOpen, liveSessionId]);

  const clearMessagingCamera2Stream = useCallback(() => {
    if (camera2StreamRef.current) {
      camera2StreamRef.current.getTracks().forEach((t) => t.stop());
      camera2StreamRef.current = null;
    }
  }, []);

  const applyMessagingCamera2FromSpec = useCallback(async (spec) => {
    if (!spec || typeof spec !== 'object' || !isMessagingLiveHost) return;
    const room = immersiveLiveKitRoomRef.current;

    if (spec.type === 'remote_camera' && spec.identity) {
      clearMessagingCamera2Stream();
      if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
      setLiveSmartboardCam2Source(spec);
      liveSmartboardCam2SourceRef.current = spec;
      const t = getAuxVideoTrackForSmartboard(room, spec.identity);
      if (t && camera2VideoRef.current) {
        camera2VideoRef.current.srcObject = new MediaStream([t.mediaStreamTrack]);
        camera2VideoRef.current.play?.().catch(() => {});
        setCamera2Active(true);
      } else {
        setCamera2Active(false);
      }
      setActiveScene('camera2');
      sendImmersiveSmartboardPayload({ camera2Source: spec });
      return;
    }

    if (spec.type === 'local_display') {
      clearMessagingCamera2Stream();
      if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) return;
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        camera2StreamRef.current = stream;
        if (camera2VideoRef.current) {
          camera2VideoRef.current.srcObject = stream;
          camera2VideoRef.current.play?.().catch(() => {});
        }
        const source = { type: 'local_display' };
        setLiveSmartboardCam2Source(source);
        liveSmartboardCam2SourceRef.current = source;
        setCamera2Active(true);
        setActiveScene('camera2');
        sendImmersiveSmartboardPayload({ camera2Source: source });
        const vt = stream.getVideoTracks?.()[0];
        if (vt) {
          vt.onended = () => {
            clearMessagingCamera2Stream();
            if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
            setCamera2Active(false);
            setLiveSmartboardCam2Source(null);
            liveSmartboardCam2SourceRef.current = null;
            sendImmersiveSmartboardPayload({ camera2Source: null });
          };
        }
      } catch { /* ignore */ }
      return;
    }

    if (spec.type === 'local_aux') {
      clearMessagingCamera2Stream();
      if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
      try {
        let videoConstraints;
        if (spec.deviceId) {
          videoConstraints = { deviceId: { exact: spec.deviceId } };
        } else if (spec.facingMode === 'user' || spec.facingMode === 'environment') {
          videoConstraints = { facingMode: spec.facingMode };
        } else {
          videoConstraints = { facingMode: 'environment' };
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
        camera2StreamRef.current = stream;
        if (camera2VideoRef.current) {
          camera2VideoRef.current.srcObject = stream;
          camera2VideoRef.current.play?.().catch(() => {});
        }
        const source = { type: 'local_aux' };
        if (spec.deviceId) source.deviceId = spec.deviceId;
        else source.facingMode = spec.facingMode === 'user' ? 'user' : 'environment';
        setLiveSmartboardCam2Source(source);
        liveSmartboardCam2SourceRef.current = source;
        setCamera2Active(true);
        setActiveScene('camera2');
        sendImmersiveSmartboardPayload({ camera2Source: source });
      } catch { /* ignore */ }
    }
  }, [
    clearMessagingCamera2Stream,
    isMessagingLiveHost,
    sendImmersiveSmartboardPayload,
  ]);

  const handleMessagingCamera2Start = useCallback((arg) => {
    if (!isMessagingLiveHost) return;
    if (typeof arg === 'string') {
      void applyMessagingCamera2FromSpec({ type: 'local_aux', deviceId: arg });
      return;
    }
    if (arg && typeof arg === 'object') void applyMessagingCamera2FromSpec(arg);
  }, [applyMessagingCamera2FromSpec, isMessagingLiveHost]);

  useEffect(() => {
    if (!liveActive || !immersiveLiveKitRoomRef.current) return undefined;
    if (activeScene !== 'camera2') return undefined;
    const src = liveSmartboardCam2Source;
    if (!src || src.type !== 'remote_camera') return undefined;

    const room = immersiveLiveKitRoomRef.current;
    const attach = () => {
      const t = getAuxVideoTrackForSmartboard(room, src.identity);
      if (t && camera2VideoRef.current) {
        camera2VideoRef.current.srcObject = new MediaStream([t.mediaStreamTrack]);
        camera2VideoRef.current.play?.().catch(() => {});
        setCamera2Active(true);
      } else if (camera2VideoRef.current) {
        camera2VideoRef.current.srcObject = null;
        setCamera2Active(false);
      }
    };
    attach();
    const onSub = (_track, publication, participant) => {
      if (String(participant.identity) !== String(src.identity)) return;
      const vid =
        (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.Camera)
        && publication.kind === Track.Kind.Video;
      if (vid) attach();
    };
    room.on(RoomEvent.TrackSubscribed, onSub);
    return () => { room.off(RoomEvent.TrackSubscribed, onSub); };
  }, [liveActive, activeScene, liveSmartboardCam2Source]);

  useEffect(() => {
    if (activeScene !== 'camera2') return;
    const t = liveSmartboardCam2Source?.type;
    if (t !== 'local_aux' && t !== 'local_display') return;
    const stream = camera2StreamRef.current;
    if (!stream || !camera2VideoRef.current) return;
    if (!camera2VideoRef.current.srcObject) {
      camera2VideoRef.current.srcObject = stream;
      camera2VideoRef.current.play?.().catch(() => {});
      setCamera2Active(true);
    }
  }, [activeScene, liveSmartboardCam2Source]);

  useEffect(() => {
    const room = immersiveLiveKitRoomRef.current;
    if (!liveActive || !room || !isMessagingLiveHost) return undefined;
    const onLeft = (participant) => {
      const cs = liveSmartboardCam2SourceRef.current;
      if (cs?.type === 'remote_camera' && String(cs.identity) === String(participant.identity)) {
        clearMessagingCamera2Stream();
        if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
        setCamera2Active(false);
        setLiveSmartboardCam2Source(null);
        liveSmartboardCam2SourceRef.current = null;
        sendImmersiveSmartboardPayload({ camera2Source: null });
      }
    };
    room.on(RoomEvent.ParticipantDisconnected, onLeft);
    return () => { room.off(RoomEvent.ParticipantDisconnected, onLeft); };
  }, [liveActive, isMessagingLiveHost, clearMessagingCamera2Stream, sendImmersiveSmartboardPayload]);

  // Synchronized end: if one participant ends the live, the other side
  // receives the update and exits immediately as well.
  useEffect(() => {
    if (!currentUser?.id || !liveActive || !liveSessionId) return undefined;
    const channel = supabase
      .channel(`immersive-live-session-sync-${liveSessionId}-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'immersive_live_sessions',
          filter: `id=eq.${liveSessionId}`,
        },
        (payload) => {
          const status = payload?.new?.status;
          if (status === 'ended' && liveActive) {
            remoteStopRef.current = true;
            setLiveError('Le live a ete termine par l autre participant.');
            void stopLiveRoom();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, liveActive, liveSessionId, stopLiveRoom]);

  useEffect(() => {
    if (!liveActive || !liveSessionId) {
      setLiveForumMessages([]);
      liveForumSeenCountRef.current = 0;
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('immersive_live_chat_messages')
        .select('id, sender_id, content, created_at')
        .eq('live_session_id', liveSessionId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (cancelled) return;
      if (error) {
        setLiveForumMessages([]);
        return;
      }
      if (!data?.length) {
        setLiveForumMessages([]);
        liveForumSeenCountRef.current = 0;
        return;
      }
      const ids = [...new Set(data.map((m) => m.sender_id).filter(Boolean))];
      const { data: profs } = ids.length
        ? await supabase.from('profiles').select('id, name, avatar_url').in('id', ids)
        : { data: [] };
      const map = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      const mapped = data.map((m) => ({
        id: m.id,
        sender_id: m.sender_id,
        content: m.content,
        sender_name: map[m.sender_id]?.name || 'Participant',
        created_at: m.created_at,
      }));
      setLiveForumMessages(mapped);
      liveForumSeenCountRef.current = mapped.length;
    })();

    const channel = supabase
      .channel(`immersive-live-forum-${liveSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'immersive_live_chat_messages',
          filter: `live_session_id=eq.${liveSessionId}`,
        },
        async (payload) => {
          const row = payload.new;
          const { data: p } = await supabase.from('profiles').select('name').eq('id', row.sender_id).maybeSingle();
          setLiveForumMessages((prev) => [
            ...prev,
            {
              id: row.id,
              sender_id: row.sender_id,
              content: row.content,
              sender_name: p?.name || 'Participant',
              created_at: row.created_at,
            },
          ]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [liveActive, liveSessionId]);

  const sendLiveForumMessage = useCallback(async (text) => {
    const t = String(text || '').trim();
    if (!t || !liveSessionId || !currentUser?.id) return false;
    setLiveForumSending(true);
    try {
      const { error } = await supabase.from('immersive_live_chat_messages').insert({
        live_session_id: liveSessionId,
        sender_id: currentUser.id,
        content: t,
      });
      if (error) throw error;
      return true;
    } catch (err) {
      setSendError(err?.message || "Échec d'envoi du message live.");
      return false;
    } finally {
      setLiveForumSending(false);
    }
  }, [liveSessionId, currentUser?.id]);

  /** Live 1:1 : la barre du bas alimente le fil central (forum session), pas seulement la DM. */
  const composerSend = useCallback(
    async (content) => {
      // SUJET ouvert : on écrit dans le fil de sujet (interdit si clôturé).
      if (activeTopic) {
        if (activeTopic.status === 'closed') return false;
        return sendTopicMessage(content);
      }
      if (liveActive && recipientId) {
        return sendLiveForumMessage(content);
      }
      return handleSend(content);
    },
    [activeTopic, sendTopicMessage, liveActive, recipientId, sendLiveForumMessage, handleSend],
  );

  useEffect(() => {
    if (!liveActive) {
      useMobileLiriStore.getState().closeOverlay();
      setLiriHeartBursts([]);
    }
  }, [liveActive]);

  useEffect(() => {
    if (!liriMobileLive) return undefined;
    let root = null;
    let raf = 0;
    let lastTap = 0;
    const onEnd = (e) => {
      const el = e.target;
      if (el.closest?.('[data-liri-no-doubletap]')) return;
      if (el.closest?.('button, a, input, textarea, select, [role="slider"]')) return;
      const now = Date.now();
      if (now - lastTap < 340) {
        lastTap = 0;
        const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
        setLiriHeartBursts((prev) => [...prev, id]);
        void sendLiveForumMessage('❤️');
        e.preventDefault();
      } else {
        lastTap = now;
      }
    };
    const attach = () => {
      root = liveSurfaceRef.current;
      if (!root) {
        raf = requestAnimationFrame(attach);
        return;
      }
      root.addEventListener('touchend', onEnd, { passive: false });
    };
    attach();
    return () => {
      cancelAnimationFrame(raf);
      if (root) root.removeEventListener('touchend', onEnd);
    };
  }, [liriMobileLive, sendLiveForumMessage]);

  // Hard fallback for synchronized stop: poll the current conversation live
  // session status in case realtime delivery is delayed/missed.
  useEffect(() => {
    if (!currentUser?.id || !liveActive || !liveConversationKey) return undefined;
    const id = window.setInterval(async () => {
      const { data } = await supabase
        .from('immersive_live_sessions')
        .select('id,status,ended_at')
        .eq('conversation_key', liveConversationKey)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      // Ne stopper que si on a un liveSessionId explicite ET qu'il correspond.
      // Évite de stopper l'appel sur une session terminée ancienne si liveSessionId
      // n'est pas encore assigné au démarrage.
      const sameSession = liveSessionId && data.id === liveSessionId;
      if (sameSession && data.status === 'ended' && liveActive) {
        remoteStopRef.current = true;
        setLiveError('Le live a ete termine par l autre participant.');
        void stopLiveRoom();
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [currentUser?.id, liveActive, liveConversationKey, liveSessionId, stopLiveRoom]);

  // ── Ouvrir le Studio Live depuis un rendez-vous ────────────────────────────
  const handleOpenStudio = useCallback(async () => {
    if (!activeAppointment) return;
    setStudioLoading(true);
    try {
      // Chercher une live_session déjà liée à ce rendez-vous
      const { data: existing } = await supabase
        .from('live_sessions')
        .select('id')
        .eq('appointment_id', activeAppointment.id)
        .maybeSingle();

      if (existing?.id) {
        navigate(`/studio/live-arena/${existing.id}`);
        return;
      }

      // Sinon créer une nouvelle session liée au rendez-vous
      const { data: created, error } = await supabase
        .from('live_sessions')
        .insert({
          title: activeAppointment.subject || 'Séance live',
          teacher_id: currentUser.id,
          status: 'draft',
          appointment_id: activeAppointment.id,
          room_mode: 'secret_classroom',
          access_mode: 'invite_only',
        })
        .select('id')
        .single();

      if (error || !created) throw new Error(error?.message || 'Création impossible');
      navigate(`/studio/live-arena/${created.id}`);
    } catch (err) {
      console.warn('[Messaging] Ouverture Studio Live:', err.message);
    } finally {
      setStudioLoading(false);
    }
  }, [activeAppointment, currentUser?.id, navigate]);

  const ensureImmersiveLiveSession = useCallback(async () => {
    if (!currentUser?.id || !recipientId || !liveConversationKey) return null;
    const nowIso = new Date().toISOString();
    const STALE_HOURS = 3; // session active >3h sans webhook = fantôme

    const { data: existing } = await supabase
      .from('immersive_live_sessions')
      .select('*')
      .eq('conversation_key', liveConversationKey)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      // ── Guard session fantôme ────────────────────────────────────────────
      const refTs = existing.started_at || existing.created_at;
      const ageHours = refTs
        ? (Date.now() - new Date(refTs).getTime()) / 3_600_000
        : STALE_HOURS + 1;

      if (ageHours > STALE_HOURS) {
        // Clore la session fantôme silencieusement
        await supabase
          .from('immersive_live_sessions')
          .update({ status: 'ended', ended_at: nowIso })
          .eq('id', existing.id);
        // Continuer vers la création d'une nouvelle session
      } else {
        setLiveSessionId(existing.id);
        setImmersiveHostUserId(existing.host_user_id || null);
        await supabase
          .from('immersive_live_sessions')
          .update({ status: 'active', started_at: existing.started_at || nowIso })
          .eq('id', existing.id);
        return existing.id;
      }
    }

    const { data: created, error } = await supabase
      .from('immersive_live_sessions')
      .insert({
        conversation_key: liveConversationKey,
        title: `Live-Room Immersif · ${currentUser.name || 'Host'}`,
        host_user_id: currentUser.id,
        guest_user_id: recipientId,
        status: 'active',
        started_at: nowIso,
      })
      .select('*')
      .single();
    if (error || !created?.id) return null;
    setLiveSessionId(created.id);
    setImmersiveHostUserId(created.host_user_id || currentUser.id);
    return created.id;
  }, [currentUser?.id, currentUser?.name, liveConversationKey, recipientId]);

  const startLiveRoom = useCallback(async () => {
    if (liveActive) {
      setLiveExpanded((prev) => !prev);
      if (!liveExpanded) setLiveStage('stable');
      return;
    }
    setLiveActive(true);
    setLiveExpanded(true);
    setLiveStage('activation');
    setLiveSummaryOpen(false);
    setLiveSummaryData(null);
    setLiveCloudUrl('');
    setLiveError('');
    setLiveRecordElapsedSec(0);
    setIsRecordingLive(false);
    setLiveMessageDrawerOpen(false);
    setLiveNeuronqModalOpen(false);
    setLiveShowChat(false);
    setLiveMessageUnread(0);
    setLiveSpotlightOn(false);
    setRemoteCameraStream(null);
    setRemoteScreenStream(null);
    setRemoteSharingScreen(false);
    setActiveScene('diapo');
    setLiveSlideIndex(0);
    startSlideTracking(0);
    resetLiveSummary();
    setSummaryModalOpen(false);
    setPromotedParticipantId(recipientId || currentUser?.id || null);
    liveForumSeenCountRef.current = 0;
    if (liveRecordUrl && typeof URL !== 'undefined') {
      URL.revokeObjectURL(liveRecordUrl);
    }
    setLiveRecordUrl('');
    liveModeHistoryRef.current = [{ mode: 'conversation', at: Date.now() }];
    window.setTimeout(() => setLiveStage('emergence'), 180);
    window.setTimeout(() => setLiveStage('stable'), 520);
    const immersiveSid = await ensureImmersiveLiveSession();
    if (!immersiveSid) {
      setLiveError('Impossible d\'ouvrir la session live immersive.');
      setLiveActive(false);
      setLiveExpanded(false);
      setLiveStage('idle');
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        commitLocalLiveStream(stream);
        if (liveInviteRef.current?.id) {
          void supabase
            .from('live_chat_invites')
            .update({ status: 'accepted', started_at: new Date().toISOString() })
            .eq('id', liveInviteRef.current.id);
        }
        setLiveStartedAt(Date.now());
        setLiveElapsedSec(0);
        setLiveError('');
      }
    } catch {
      setLiveError('Accès caméra/micro refusé. Autorisez-les pour lancer le live.');
      setLiveActive(false);
      setLiveExpanded(false);
      setLiveStage('idle');
    }
  }, [bindLocalLiveStream, convMessages.length, currentUser?.id, ensureImmersiveLiveSession, liveActive, liveExpanded, liveRecordUrl, recipientId]);

  // Toujours pointer vers la version la plus récente (évite stale-closure dans onAccepted/onSelfAccepted).
  startLiveRoomRef.current = startLiveRoom;

  // ── useLiveInvite — branché ICI (après startLiveRoom) pour éviter tout TDZ ──
  const {
    allInvites: allLiveInvites,
    incomingInvite,
    outgoingInvite,
    pendingCount: pendingInviteCount,
    inviteCountdown,
    isSending: sendingInvite,
    sendInvite: sendLiveInviteRaw,
    acceptInvite: acceptIncomingInvite,
    declineInvite: declineIncomingInviteRaw,
    cancelOutgoingInvite,
  } = useLiveInvite({
    currentUser,
    recipientId,
    profiles,
    onAccepted: useCallback(() => {
      // Côté ENVOYEUR : le receveur vient d'accepter → démarrer le live.
      // On passe par startLiveRoomRef pour toujours avoir la version fraîche de la fonction
      // (évite la stale-closure : onAccepted n'a que [liveActive] dans ses deps).
      if (!liveActive) {
        setLiveError('');
        callStartTimeRef.current = Date.now();
        void startLiveRoomRef.current?.();
      }
    }, [liveActive]),
    onSelfAccepted: useCallback(() => {
      // Côté receveur : on vient d'accepter → démarrer le live
      callStartTimeRef.current = Date.now();
      void startLiveRoomRef.current?.();
    }, []),
    notifyBrowser,
    playAlarmTone,
  });

  // Wrapper local pour sendLiveInvite : ferme le panneau + gère l'UI
  const sendLiveInvite = useCallback(
    async (scheduledFor = null) => {
      setLiveError('');
      const result = await sendLiveInviteRaw(scheduledFor);
      if (!result) {
        setLiveError("Impossible d'envoyer l'invitation live.");
        return;
      }
      setInvitePanelOpen(false);
    },
    [sendLiveInviteRaw]
  );

  // Wrapper local pour declineIncomingInvite : ouvre le modal RDV après refus
  const declineIncomingInvite = useCallback(
    async (invite) => {
      await declineIncomingInviteRaw(invite);
      setAppointmentModalOpen(true);
    },
    [declineIncomingInviteRaw]
  );

  // Déplacé ICI (après useLiveInvite) pour éviter TDZ sur allLiveInvites
  const liveAgendaItems = useMemo(() => {
    if (!currentUser?.id) return [];
    return [...allLiveInvites]
      .filter((inv) => inv.sender_id === currentUser.id || inv.receiver_id === currentUser.id)
      .sort((a, b) => {
        const ad = new Date(a.scheduled_for || a.created_at).getTime();
        const bd = new Date(b.scheduled_for || b.created_at).getTime();
        return bd - ad;
      })
      .slice(0, 20);
  }, [allLiveInvites, currentUser?.id]);

  const toggleLiveExpanded = useCallback(() => {
    if (!liveActive) {
      const canStart =
        isInviteAutoStartEligible(incomingInvite) ||
        isInviteAutoStartEligible(outgoingInvite) ||
        isInviteAutoStartEligible(liveInviteRef.current);
      if (!canStart) {
        if (!recipientId) {
          setLiveError('Sélectionnez un interlocuteur avant de lancer un live.');
          return;
        }
        setInvitePanelOpen(true);
        setLiveError('Le live démarre après acceptation de votre interlocuteur.');
        return;
      }
      void startLiveRoom();
      return;
    }
    setLiveExpanded((prev) => !prev);
    if (liveExpanded) setLiveMode('focus');
  }, [incomingInvite, liveActive, liveExpanded, outgoingInvite, recipientId, startLiveRoom]);

  const toggleLiveMute = useCallback(() => {
    setLiveMuted((prev) => {
      const next = !prev;
      localLiveStreamRef.current?.getAudioTracks?.().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, []);

  const applyLiveMuted = useCallback((next) => {
    setLiveMuted(next);
    localLiveStreamRef.current?.getAudioTracks?.().forEach((track) => {
      track.enabled = !next;
    });
  }, []);

  const recoverLocalLiveStream = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      commitLocalLiveStream(stream);
      setLiveError('');
      return true;
    } catch {
      setLiveError('Impossible de réactiver la caméra. Vérifiez les permissions navigateur.');
      return false;
    }
  }, [commitLocalLiveStream]);

  useEffect(() => {
    if (!liveActive || liveCameraOff) return undefined;
    const id = window.setInterval(() => {
      const tracks = localLiveStreamRef.current?.getVideoTracks?.() || [];
      const hasLiveTrack = tracks.some((t) => t.readyState === 'live' && t.enabled !== false);
      if (!hasLiveTrack) {
        void recoverLocalLiveStream();
        return;
      }
      reviveLiveMediaElements();
    }, 900);
    return () => window.clearInterval(id);
  }, [liveActive, liveCameraOff, recoverLocalLiveStream, reviveLiveMediaElements]);

  useEffect(() => {
    if (!liveActive) return undefined;
    const handleResume = () => {
      reviveLiveMediaElements();
      const tracks = localLiveStreamRef.current?.getVideoTracks?.() || [];
      const hasLiveTrack = tracks.some((t) => t.readyState === 'live');
      if (!hasLiveTrack && !liveCameraOff) {
        void recoverLocalLiveStream();
      }
    };
    window.addEventListener('focus', handleResume);
    window.addEventListener('pageshow', handleResume);
    document.addEventListener('visibilitychange', handleResume);
    return () => {
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('pageshow', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [liveActive, liveCameraOff, recoverLocalLiveStream, reviveLiveMediaElements]);

  useEffect(() => {
    if (!liveActive || liveCameraOff || !localStreamVersion) return undefined;
    const stream = localLiveStreamRef.current;
    if (!stream) return undefined;
    const tracks = stream.getVideoTracks?.() || [];
    const cleanups = [];
    const handleProblem = () => {
      void recoverLocalLiveStream();
    };
    tracks.forEach((track) => {
      const onEnded = () => handleProblem();
      const onMute = () => {
        window.setTimeout(() => {
          if (track.readyState !== 'live' || track.muted) handleProblem();
        }, 300);
      };
      track.addEventListener?.('ended', onEnded);
      track.addEventListener?.('mute', onMute);
      cleanups.push(() => {
        track.removeEventListener?.('ended', onEnded);
        track.removeEventListener?.('mute', onMute);
      });
    });
    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [liveActive, liveCameraOff, localStreamVersion, recoverLocalLiveStream]);

  const toggleLiveCamera = useCallback(() => {
    const turningOn = liveCameraOff;
    if (turningOn) {
      setLiveCameraOff(false);
      const tracks = localLiveStreamRef.current?.getVideoTracks?.() || [];
      const hasLiveTrack = tracks.some((t) => t.readyState === 'live');
      if (!hasLiveTrack) {
        void recoverLocalLiveStream();
        return;
      }
      tracks.forEach((track) => { track.enabled = true; });
      return;
    }
    setLiveCameraOff(true);
    localLiveStreamRef.current?.getVideoTracks?.().forEach((track) => {
      track.enabled = false;
    });
  }, [liveCameraOff, recoverLocalLiveStream]);

  const setLiveRoomMode = useCallback((mode) => {
    setLiveMode(mode);
    if (mode === 'focus') {
      setLiveExpanded(false);
      setLiveShowChat(true);
      return;
    }
    setLiveExpanded(true);
    if (mode === 'presentation') setLiveShowChat(false);
    if (mode === 'conversation') setLiveShowChat(true);
  }, []);

  const handlePromoteParticipant = useCallback((participantId) => {
    setPromotedParticipantId(participantId);
    setLiveMode('classroom');
  }, []);

  const snapMiniToMagnet = useCallback((nextX, nextY) => {
    const xStops = [0, -340];
    const yStops = [0, 220];
    const nearestX = xStops.reduce(
      (best, x) => (Math.abs(x - nextX) < Math.abs(best - nextX) ? x : best),
      xStops[0]
    );
    const nearestY = yStops.reduce(
      (best, y) => (Math.abs(y - nextY) < Math.abs(best - nextY) ? y : best),
      yStops[0]
    );
    return { x: nearestX, y: nearestY };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement) {
        await liveSurfaceRef.current?.requestFullscreen?.();
        setLiveFullscreen(true);
      } else {
        await document.exitFullscreen();
        setLiveFullscreen(false);
      }
    } catch {
      setLiveFullscreen(Boolean(document.fullscreenElement));
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setLiveFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!liveActive || !liveStartedAt) return undefined;
    const id = window.setInterval(() => {
      setLiveElapsedSec(Math.floor((Date.now() - liveStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [liveActive, liveStartedAt]);

  useEffect(() => {
    if (!liveActive) return;
    const history = liveModeHistoryRef.current;
    if (history.length === 0 || history[history.length - 1]?.mode !== liveMode) {
      history.push({ mode: liveMode, at: Date.now() });
    }
  }, [liveMode, liveActive]);

  useEffect(() => {
    if (!isRecordingLive) return undefined;
    const id = window.setInterval(() => {
      setLiveRecordElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRecordingLive]);

  useEffect(() => {
    if (!liveActive) return undefined;
    return () => {
      try {
        if (liveRecorderRef.current?.state !== 'inactive') {
          try { liveRecorderRef.current.requestData(); } catch { /* ignore */ }
          liveRecorderRef.current.stop();
        }
      } catch {
        // noop
      }
      localLiveStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      displayLiveStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      localLiveStreamRef.current = null;
      displayLiveStreamRef.current = null;
    };
  }, [liveActive]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (liveActive) {
      document.body.classList.add('live-room-active');
    } else {
      document.body.classList.remove('live-room-active');
    }
    return () => {
      document.body.classList.remove('live-room-active');
    };
  }, [liveActive]);

  useEffect(() => {
    return () => {
      if (liveRecordUrl && typeof URL !== 'undefined') URL.revokeObjectURL(liveRecordUrl);
    };
  }, [liveRecordUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const arm = () => {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!alarmAudioCtxRef.current) {
        try {
          alarmAudioCtxRef.current = new Ctx();
        } catch {
          return;
        }
      }
      alarmAudioArmedRef.current = true;
      alarmAudioCtxRef.current?.resume?.().catch(() => {});
    };
    window.addEventListener('pointerdown', arm, { passive: true });
    window.addEventListener('keydown', arm, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, []);

  useEffect(() => {
    return () => {
      alarmAudioArmedRef.current = false;
      if (alarmAudioCtxRef.current) {
        alarmAudioCtxRef.current.close().catch(() => {});
        alarmAudioCtxRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    liveInviteRef.current = incomingInvite || outgoingInvite || null;
  }, [incomingInvite, outgoingInvite]);

  // Fallback sync: if invite status is ended on either side, terminate live locally.
  useEffect(() => {
    if (!liveActive) return;
    const status = incomingInvite?.status || outgoingInvite?.status || liveInviteRef.current?.status;
    if (status === 'ended') {
      remoteStopRef.current = true;
      setLiveError('Le live a ete termine par l autre participant.');
      void stopLiveRoom();
    }
  }, [incomingInvite?.status, outgoingInvite?.status, liveActive, stopLiveRoom]);

  useEffect(() => {
    if (!currentUser?.id || !liveConversationKey) {
      setLiveSlides(DEFAULT_IMMERSIVE_SLIDES);
      return;
    }
    let cancelled = false;
    const loadSlides = async () => {
      const { data, error } = await supabase
        .from('immersive_live_slides')
        .select('data_json, order_index')
        .eq('conversation_key', liveConversationKey)
        .order('order_index', { ascending: true });
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setLiveSlides(DEFAULT_IMMERSIVE_SLIDES);
        return;
      }
      const parsed = data.map((row) => row.data_json).filter(Boolean);
      setLiveSlides(parsed.length > 0 ? parsed : DEFAULT_IMMERSIVE_SLIDES);
    };
    void loadSlides();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, liveConversationKey]);

  /** Fonds sonores MP3 (ambiance) — colonne immersive_live_sessions.ambient_tracks_json */
  useEffect(() => {
    if (!liveSessionId) {
      setLiveAmbientTracks([]);
      return undefined;
    }
    const loadAmbient = async () => {
      const { data } = await supabase
        .from('immersive_live_sessions')
        .select('ambient_tracks_json')
        .eq('id', liveSessionId)
        .maybeSingle();
      setLiveAmbientTracks(Array.isArray(data?.ambient_tracks_json) ? data.ambient_tracks_json : []);
    };
    void loadAmbient();
    const channel = supabase
      .channel(`immersive-ambient-${liveSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'immersive_live_sessions',
          filter: `id=eq.${liveSessionId}`,
        },
        () => {
          void loadAmbient();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveSessionId]);

  useEffect(() => {
    setLiveShowChat(liveMessageDrawerOpen);
  }, [liveMessageDrawerOpen]);

  useEffect(() => {
    if (activeMessageIndex < 0 || convMessages.length === 0) return;
    const activeId = convMessages[activeMessageIndex]?.id;
    if (!activeId) return;
    const node = messageItemRefs.current[activeId];
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [activeMessageIndex, convMessages]);

  const activeMessageId = convMessages[activeMessageIndex]?.id || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-5rem)] bg-[#090D14]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--school-accent)] border-t-transparent" />
      </div>
    );
  }

  const liveModeLabel =
    liveMode === 'classroom'
      ? 'Classroom'
      : liveMode === 'presentation'
        ? 'Présentation'
        : liveMode === 'focus'
          ? 'Focus écrit'
          : 'Conversation + live';

  const chatTransform =
    liveActive && liriMobileLive
      ? { scale: 0.82, opacity: liveShowChat ? 0.38 : 0.12, y: 36 }
      : liveActive && liveExpanded
        ? liveMode === 'presentation'
          ? { scale: 0.84, opacity: liveShowChat ? 0.42 : 0.14, y: 26 }
          : liveMode === 'classroom'
            ? { scale: 0.9, opacity: liveShowChat ? 0.58 : 0.18, y: 20 }
            : { scale: 0.94, opacity: liveShowChat ? 0.72 : 0.18, y: 16 }
        : { scale: 1, opacity: 1, y: 0 };

  const liveSurfaceTransform = liriMobileLive
    ? smartboardFullMobile
      ? { opacity: 1, scale: 1.05, y: 0, x: 0 }
      : { opacity: 1, scale: 1, y: 0, x: 0 }
    : liveExpanded
      ? liveMode === 'presentation'
        ? { opacity: 1, scale: 1.02, y: -6, x: 0 }
        : liveMode === 'classroom'
          ? { opacity: 1, scale: 1.01, y: -2, x: 0 }
          : { opacity: 1, scale: 1, y: 0, x: 0 }
      : { opacity: 0.98, scale: 0.58, y: 180, x: 260 };

  const liveUxState = !liveActive
    ? 'conversation'
    : liveStage !== 'stable'
      ? 'entering-live'
      : liveMessageDrawerOpen
        ? 'message-drawer-open'
        : promotedParticipantId && promotedParticipantId !== currentUser?.id
          ? 'participant-promoted'
          : liveMode === 'presentation'
            ? 'focus-presentation'
            : liveMode === 'focus'
              ? 'focus-chat'
              : 'focus-video';

  const activePanelParticipantId = promotedParticipantId || recipientId || currentUser?.id || null;
  const panelShowsRemote = Boolean(
    activePanelParticipantId &&
    currentUser?.id &&
    activePanelParticipantId !== currentUser.id
  );
  /** LIRI messagerie 1:1 : toujours priorité au flux entrant (IncomingPriorityVideoFrame), jamais la self-cam en grand. */
  const immersiveIncomingPriority = Boolean(
    liveActive && recipientId && recipientProfile?.id && currentUser?.id
  );
  const primaryLiveVideoRef = immersiveIncomingPriority
    ? remoteMainVideoRef
    : (panelShowsRemote ? remoteMainVideoRef : liveMainVideoRef);
  const secondaryLiveVideoRef = immersiveIncomingPriority
    ? liveMiniVideoRef
    : (panelShowsRemote ? liveMiniVideoRef : remoteMainVideoRef);
  const mainDisplayParticipant = immersiveIncomingPriority || panelShowsRemote
    ? {
        id: recipientProfile?.id || recipientId || 'remote',
        name: recipientProfile?.name || 'Interlocuteur',
        panelLabel: 'Flux entrant',
        panelSubtitle: remoteCameraStream
          ? 'Vidéo entrante (interlocuteur) — cadre principal'
          : 'En attente du flux interlocuteur',
      }
    : {
        id: currentUser?.id || 'self',
        name: currentUser?.name || 'Vous',
        panelLabel: 'Flux sortant',
        panelSubtitle: 'Votre vidéo (sortante) en grand panel',
      };
  const messagingImmersiveFaceToFace = Boolean(liveActive && recipientId);
  /** Caméra locale en miniature : éviter que le panneau « interlocuteur » réinitialise le canvas PiP / segmentation. */
  const pipRegisterOnMiniPreview = Boolean(
    liveActive &&
    currentUser?.id &&
    (immersiveIncomingPriority || panelShowsRemote),
  );
  const miniDisplayParticipant = recipientId
    ? (
      immersiveIncomingPriority || panelShowsRemote
        ? {
            id: currentUser?.id || 'self-mini',
            name: currentUser?.name || 'Vous',
            panelLabel: 'Prévisualisation locale',
            panelSubtitle: messagingImmersiveFaceToFace
              ? 'Votre caméra — même format que l\'interlocuteur'
              : 'LocalPreviewMini — votre retour caméra',
          }
        : {
            id: recipientProfile?.id || 'remote-mini',
            name: recipientProfile?.name || 'Interlocuteur',
            panelLabel: 'Flux entrant',
            panelSubtitle: remoteCameraStream ? 'Interlocuteur en miniature' : 'En attente interlocuteur',
          }
    )
    : null;
  const smartboardHasScreen = sharingScreen || remoteSharingScreen || Boolean(remoteScreenStream);
  // L'interlocuteur n'a pas encore de flux vidéo (en attente de connexion)
  const remoteVideoWaiting = liveActive && !!recipientId && !remoteCameraStream;

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden text-white',
        // EMBEDDED (dans le shell du portail LIRI) : remplit le <main>. STANDALONE : viewport.
        embedded ? 'h-full' : 'h-[calc(100dvh-5rem)] bg-[#090D14]',
      )}
      // EMBEDDED : fond chaud OPAQUE (même base + mesh coral discret que le forum du portail)
      // → aucun halo ne transparaît, cohérent avec le shell LIRI.
      style={embedded ? {
        background: 'radial-gradient(ellipse 90% 55% at 50% -12%, rgba(217,119,87,0.05), transparent 56%), #262624',
      } : undefined}
    >
      <div className="absolute inset-0 z-0 pointer-events-none">
        {liveActive ? (
          <ImmersiveLiveStageBackdrop parallax={messagingLiveParallax} />
        ) : embedded ? null : (
          <>
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-[var(--school-accent)]/[0.08] rounded-full blur-[150px]" />
            <div className="absolute top-1/3 -right-24 w-80 h-80 bg-[rgba(227,170,107,0.05)] rounded-full blur-[150px]" />
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-[rgba(217,119,87,0.05)] rounded-full blur-[140px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(217,119,87,0.08),transparent_34%),radial-gradient(circle_at_80%_90%,rgba(200,110,70,0.07),transparent_34%)]" />
          </>
        )}
      </div>

      <div
        className={cn(
          'relative z-10 flex items-center justify-between px-4 md:px-6 h-14 flex-shrink-0 transition-colors duration-300',
          liveActive
            ? 'mx-3 md:mx-6 mt-3 rounded-2xl border border-white/[0.1] bg-[#090D14]/35 backdrop-blur-2xl shadow-[0_12px_40px_-24px_rgba(0,0,0,0.65)]'
            : embedded
              // Dans le shell du portail : barre PLATE (le <main> est déjà une carte arrondie
              // → éviter la carte-dans-carte, surcharge visuelle pointée à l'audit).
              ? 'border-b border-white/[0.06]'
              : 'mx-3 md:mx-6 mt-3 rounded-2xl border border-white/[0.08] bg-[#0d1420]/65 backdrop-blur-xl',
          liriMobileLive && 'mx-1.5 mt-1.5 h-11 px-2 md:mx-3 md:px-4',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {selectedRecipient ? (
            <>
              <button
                type="button"
                onClick={() => setProfilePanelOpen(true)}
                className="flex items-center gap-3 min-w-0 group"
              >
                <div className="relative">
                  <UserAvatar user={recipientProfile} size="sm" />
                  <OnlineDot status={recipientProfile?.status || 'offline'} className="absolute -bottom-0.5 -right-0.5" />
                </div>
                <div className="min-w-0 text-left">
                  <h1
                    className={cn(
                      'truncate text-sm font-semibold transition-colors group-hover:text-[var(--school-accent)]',
                      liveActive && recipientId ? 'font-serif text-[var(--school-accent)]' : 'text-white',
                    )}
                  >
                    {recipientProfile?.name}
                  </h1>
                  {isRemoteTyping ? (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-[var(--school-accent)]">
                      écrit…
                    </motion.p>
                  ) : (
                    <p className="text-[10px] text-gray-500">{roleLabels[recipientProfile?.role] || recipientProfile?.role || ''}</p>
                  )}
                </div>
              </button>
            </>
          ) : activeTopic ? (
            <div className="flex min-w-0 items-center gap-2">
              <Hash className="h-4 w-4 shrink-0 text-[var(--school-accent)]" />
              <h1 className="truncate font-serif text-sm font-semibold text-[var(--school-accent)]">{activeTopic.subject}</h1>
              <span className="hidden text-[10px] text-gray-500 sm:inline">Sujet</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <img src="/lirilogo.png" alt="LIRI" className="h-6 w-6 object-contain" />
              <h1 className="text-sm font-semibold text-white">{liveActive ? 'Live-Room Immersif' : 'Messagerie'}</h1>
              {totalUnread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--school-accent)] text-[10px] font-bold text-black px-1">
                  {totalUnread}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedRecipient ? (
            <button
              type="button"
              onClick={handleClearRecipient}
              className="h-8 px-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-gray-300 hover:text-white hover:bg-white/5 text-[11px]"
            >
              Quitter conversation
            </button>
          ) : null}
          {liveActive && (
            <div className="inline-flex items-center gap-2 h-7 px-2.5 rounded-full border border-emerald-400/25 bg-emerald-500/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-200 font-medium">LIVE {formatDuration(liveElapsedSec)}</span>
              {isRecordingLive ? <span className="text-[10px] text-red-300">REC {formatDuration(liveRecordElapsedSec)}</span> : null}
            </div>
          )}
          {liveActive && recipientId ? (
            <Link
              to="/studio"
              className="hidden h-8 items-center rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-2.5 text-[11px] font-medium text-[var(--school-accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] sm:inline-flex"
            >
              Studio créateur
            </Link>
          ) : null}
          {pendingInviteCount > 0 ? (
            <div className="inline-flex items-center gap-1.5 h-7 px-2 rounded-full border border-red-500/30 bg-red-500/12 text-red-200">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[10px] font-medium">Live en attente</span>
            </div>
          ) : null}
          {convMessages.length > 0 && (
            <span className="text-[10px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] text-gray-400">
              {convMessages.length} message{convMessages.length > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => setShowConversationList((v) => !v)}
            className={cn(
              'h-8 px-2.5 rounded-lg border transition-all inline-flex items-center gap-1.5',
              showConversationList
                ? 'border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)]'
                : 'border-white/10 bg-white/[0.03] text-gray-300 hover:text-white hover:bg-white/5'
            )}
            aria-label="Liste des conversations"
          >
            {showConversationList ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            <span className="hidden md:inline text-[11px]">Conversations</span>
            {liveDashboardUnread > 0 ? (
              <span
                className="hidden h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] md:inline-block"
                title="Alertes live (LIRI)"
              />
            ) : null}
          </button>
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={cn(
              'h-8 px-2.5 rounded-lg border transition-all inline-flex items-center gap-1.5',
              searchOpen
                ? 'border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)]'
                : 'border-white/10 bg-white/[0.03] text-gray-300 hover:text-white hover:bg-white/5'
            )}
            aria-label="Recherche"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Recherche</span>
          </button>
          <button
            onClick={toggleSonnerie}
            className={cn(
              'h-8 px-2.5 rounded-lg border transition-all inline-flex items-center gap-1.5',
              sonnerieOn
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/[0.03] text-gray-500 hover:text-white hover:bg-white/5'
            )}
            aria-label={sonnerieOn ? 'Désactiver la sonnerie' : 'Activer la sonnerie'}
            title={sonnerieOn ? 'Sonnerie activée – cliquez pour couper' : 'Sonnerie désactivée – cliquez pour activer'}
          >
            {sonnerieOn ? <BellRing className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            <span className="hidden md:inline text-[11px]">{sonnerieOn ? 'Son ON' : 'Son OFF'}</span>
          </button>
          <button
            onClick={() => setLiveAgendaOpen((v) => !v)}
            className={cn(
              'relative h-8 px-2.5 rounded-lg border transition-all inline-flex items-center gap-1.5',
              liveAgendaOpen
                ? 'border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)]'
                : 'border-white/10 bg-white/[0.03] text-gray-300 hover:text-white hover:bg-white/5'
            )}
            aria-label="Agenda live"
            title="Ouvrir l'agenda des invitations live"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Agenda live</span>
            {pendingInviteCount > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
                {pendingInviteCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        <div className="flex-1 relative overflow-hidden">
          <motion.div
            animate={chatTransform}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
          <AnimatePresence>
            {showConversationList && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.22 }}
                className="absolute top-4 right-4 z-30 w-[320px] max-h-[55vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1118]/92 backdrop-blur-xl p-2"
              >
                <div className="flex items-center justify-between px-2 py-1.5">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500">Conversations</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setListMode('compact')}
                      className={cn(
                        'h-6 px-2 rounded text-[10px]',
                        listMode === 'compact' ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)]' : 'text-gray-500 hover:text-white'
                      )}
                    >
                      Compact
                    </button>
                    <button
                      type="button"
                      onClick={() => setListMode('detail')}
                      className={cn(
                        'h-6 px-2 rounded text-[10px]',
                        listMode === 'detail' ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)]' : 'text-gray-500 hover:text-white'
                      )}
                    >
                      Détail
                    </button>
                  </div>
                </div>

                {/* ── SUJETS : filtre Tous / Sujets + création (additif) ── */}
                <div className="mb-2 flex items-center gap-1.5 px-1">
                  <button
                    type="button"
                    onClick={() => setConvFilter('all')}
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors',
                      convFilter === 'all'
                        ? 'border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] text-[var(--school-accent)]'
                        : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white',
                    )}
                  >
                    <MessageSquare className="h-3 w-3" /> Messages
                  </button>
                  <button
                    type="button"
                    onClick={() => setConvFilter('topics')}
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors',
                      convFilter === 'topics'
                        ? 'border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] text-[var(--school-accent)]'
                        : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white',
                    )}
                  >
                    <Hash className="h-3 w-3" /> Sujets
                    {topics.length > 0 ? (
                      <span className="rounded-full bg-white/10 px-1 text-[9px] text-gray-300">{topics.length}</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateTopicOpen(true)}
                    className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-2 text-[11px] font-medium text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)]"
                    title="Créer un sujet"
                  >
                    <Plus className="h-3 w-3" /> Sujet
                  </button>
                </div>

                {liveDashboardNotifs.length > 0 ? (
                  <div className="mb-3 rounded-xl border border-emerald-500/25 bg-emerald-950/25 px-2 py-2">
                    <div className="mb-1.5 flex items-center justify-between px-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/85">
                        Lives & sessions LIRI
                      </p>
                      {liveDashboardUnread > 0 ? (
                        <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-200">
                          {liveDashboardUnread > 9 ? '9+' : liveDashboardUnread}
                        </span>
                      ) : null}
                    </div>
                    <ul className="max-h-[min(30vh,220px)] space-y-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
                      {liveDashboardNotifs.map((n) => {
                        const target =
                          n.action_url || (n.live_session_id ? `/live/waiting/${n.live_session_id}` : null);
                        const when = n.sent_at || n.created_at;
                        return (
                          <li key={n.id}>
                            <button
                              type="button"
                              onClick={() => {
                                void markLiveDashboardNotifRead(n.id);
                                if (!target) return;
                                if (String(target).startsWith('http')) {
                                  window.open(target, '_blank', 'noopener,noreferrer');
                                } else {
                                  navigate(String(target));
                                }
                                setShowConversationList(false);
                              }}
                              className={cn(
                                'flex w-full items-start gap-2 rounded-lg border px-2 py-2 text-left transition-colors',
                                n.read_at
                                  ? 'border-white/8 bg-white/[0.02] text-gray-400'
                                  : 'border-emerald-500/30 bg-emerald-500/10 text-white',
                              )}
                            >
                              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
                                <Radio className="h-3.5 w-3.5 text-emerald-300" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-200/90">
                                    {liveDashboardNotifTypeLabel(n.type)}
                                  </span>
                                  {!n.read_at ? (
                                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--school-accent)]" />
                                  ) : null}
                                </div>
                                <p className="truncate text-xs font-medium text-white/95">{n.title || 'Session live'}</p>
                                {n.body ? (
                                  <p className="line-clamp-2 text-[10px] text-white/50">{n.body}</p>
                                ) : null}
                                {n.type === 'live_now' ? (
                                  <p className="mt-1 text-[10px] font-semibold text-emerald-300/95">
                                    Rejoindre maintenant
                                  </p>
                                ) : null}
                                {when ? (
                                  <p className="mt-0.5 text-[9px] text-white/35">
                                    {formatDistanceToNow(new Date(when), { addSuffix: true, locale: fr })}
                                  </p>
                                ) : null}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {convFilter === 'topics' ? (
                  <div className="space-y-1">
                    {topics.map((topic) => {
                      const closed = topic.status === 'closed';
                      const isOpenHere = activeTopic?.id === topic.id;
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => handleOpenTopic(topic)}
                          className={cn(
                            'w-full flex items-center gap-2 p-2 rounded-xl text-left transition-colors',
                            isOpenHere ? 'bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)]' : 'hover:bg-white/5',
                          )}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]">
                            <Hash className="h-3.5 w-3.5 text-[var(--school-accent)]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-white">{topic.subject}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                              {topic.visibility === 'public' ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                              {closed ? 'Clôturé' : 'Ouvert'}
                            </p>
                          </div>
                          {topic.unread_count > 0 ? (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--school-accent)] px-1 text-[9px] font-bold text-black">
                              {topic.unread_count}
                            </span>
                          ) : (
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', closed ? 'bg-gray-600' : 'bg-emerald-400')} />
                          )}
                        </button>
                      );
                    })}
                    {topics.length === 0 ? (
                      <div className="py-4 text-center">
                        <p className="text-xs text-gray-500">Aucun sujet pour l'instant</p>
                        <button
                          type="button"
                          onClick={() => setCreateTopicOpen(true)}
                          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--school-accent)]"
                        >
                          <Plus className="h-3 w-3" /> Créer un sujet
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => handleSelectConversation(conv)}
                        className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 text-left"
                      >
                        <UserAvatar user={conv} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-white truncate">{conv.name}</p>
                          {listMode === 'detail' ? (
                            <p className="text-[10px] text-gray-500 truncate">{conv.lastMessage?.content || '—'}</p>
                          ) : null}
                        </div>
                        {conv.unreadCount > 0 ? (
                          <span className="h-4 min-w-4 rounded-full bg-[var(--school-accent)] text-[9px] font-bold text-black flex items-center justify-center px-1">
                            {conv.unreadCount}
                          </span>
                        ) : null}
                      </button>
                    ))}
                    {conversations.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-3">Aucune conversation</p>
                    ) : null}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {activeTopic ? (
            // ── SUJET (forum connecté) : bandeau + chat existant (timeline réutilisée) ──
            <div className="absolute inset-0 flex flex-col">
              <TopicBanner
                topic={activeTopic}
                busy={topicStatusBusy}
                onToggleStatus={handleToggleTopicStatus}
                onClose={closeActiveTopicView}
              />
              <div className="flex-1 overflow-y-auto px-0 py-2 space-y-0.5">
                {topicMessagesLoading && topicMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-[var(--school-accent)]" />
                  </div>
                ) : topicMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                      <Hash className="h-7 w-7 text-[color-mix(in_srgb,var(--school-accent)_55%,transparent)]" />
                    </div>
                    <p className="text-sm text-gray-400">Aucun message dans ce sujet</p>
                    <p className="mt-1 text-xs text-gray-600">
                      {activeTopic.status === 'closed' ? 'Ce sujet est clôturé.' : 'Lancez la discussion ci-dessous.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col pb-4">
                    {topicTimeline.map((item) => {
                      if (item.kind === 'separator') {
                        return (
                          <div key={item.id} className="flex justify-center py-2">
                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-gray-500">
                              {item.label}
                            </span>
                          </div>
                        );
                      }
                      const msg = item.message;
                      return (
                        <ImmersiveMessage
                          key={msg.id}
                          message={msg}
                          isOwn={msg.sender_id === currentUser?.id}
                          senderProfile={profiles[msg.sender_id] || (msg.sender_id === currentUser?.id ? currentUser : null)}
                          isLatest={item.index === topicMessages.length - 1}
                          justSent={msg.id === justSentId}
                          groupPosition={item.groupPosition}
                          showIdentity={item.showIdentity}
                          isDarkTheme={isDarkTheme}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : !selectedRecipient ? (
            <EmptyState
              onOpenPicker={() => setPickerOpen(true)}
              conversations={conversations}
              onSelectConversation={handleSelectConversation}
            />
          ) : (
            <div
              ref={messageScrollRef}
              className="absolute inset-0 overflow-y-auto py-4 space-y-0.5"
              style={{
                // Texture de fond discrète (esprit WhatsApp : un fil jamais « plat »),
                // calée sur le ton ivoire du shell pour rester cohérente et très subtile.
                backgroundImage: 'radial-gradient(rgba(245,244,238,0.022) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
              }}
            >
              {convMessages.length === 0 ? (
                !isRemoteTyping ? <NoMessagesState recipientName={recipientProfile?.name || 'ce membre'} /> : null
              ) : (
                <div className="flex flex-col pb-4">
                  {messageTimeline.map((item) => {
                    if (item.kind === 'separator') {
                      return (
                        <div key={item.id} className="flex justify-center py-2">
                          <motion.span
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.22 }}
                            className="text-[10px] px-2.5 py-1 rounded-full border bg-white/[0.03] border-white/10 text-gray-500"
                          >
                            {item.label}
                          </motion.span>
                        </div>
                      );
                    }

                    const msg = item.message;
                    return (
                      <div
                        key={msg.id}
                        ref={(node) => {
                          if (node) messageItemRefs.current[msg.id] = node;
                          else delete messageItemRefs.current[msg.id];
                        }}
                      >
                        <ImmersiveMessage
                          message={msg}
                          isOwn={msg.sender_id === currentUser?.id}
                          senderProfile={profiles[msg.sender_id] || currentUser}
                          isLatest={item.index === convMessages.length - 1}
                          justSent={msg.id === justSentId}
                          isActive={msg.id === activeMessageId}
                          groupPosition={item.groupPosition}
                          showIdentity={item.showIdentity}
                          isDarkTheme={isDarkTheme}
                          onDelete={handleDeleteMessage}
                          onEdit={handleEditMessage}
                          onRequestDelete={handleRequestDelete}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              <AnimatePresence>
                {isRemoteTyping && selectedRecipient && (
                  <div className="px-4 md:px-8 pt-1">
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 border-white/10 bg-white/[0.03]"
                    >
                      <span className="text-[11px] text-gray-400">
                        {recipientProfile?.name || 'Interlocuteur'} écrit…
                      </span>
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" />
                      </span>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
          </motion.div>

          <AnimatePresence>
            {liveActive && (
              <motion.div
                key="messaging-live-surface"
                ref={liveSurfaceRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, ...liveSurfaceTransform }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'absolute inset-0 z-30',
                  liriMobileLive && smartboardFullMobile && 'fixed inset-0 z-[42] rounded-none',
                )}
              >
              <LiveRoomShell
                active={liveActive}
                mainVideoRef={primaryLiveVideoRef}
                miniVideoRef={secondaryLiveVideoRef}
                mainDisplayParticipant={mainDisplayParticipant}
                miniDisplayParticipant={miniDisplayParticipant}
                screenShareVideoRef={screenShareVideoRef}
                camera2VideoRef={camera2VideoRef}
                camera2Active={camera2Active}
                onStartCamera2={handleMessagingCamera2Start}
                camera2FluxParticipants={immersiveLiveKitCamera2Participants}
                camera2Placeholder={
                  !isMessagingLiveHost && activeScene === 'camera2'
                  && (liveSmartboardCam2Source?.type === 'local_aux'
                    || liveSmartboardCam2Source?.type === 'local_display')
                    ? "L'hôte montre une 2ᵉ caméra ou l'écran de son appareil (SmartBoard). Ce flux reste local — pour le voir, qu'il bascule sur « Moi (caméra principale) » ou un 2ᵉ appareil dans la liste."
                    : null
                }
                camera2WaitingRemote={
                  !isMessagingLiveHost && activeScene === 'camera2' && liveSmartboardCam2Source?.type === 'remote_camera' && !camera2Active
                }
                activeScene={activeScene}
                onChangeScene={setActiveScene}
                sharedImageSrc={sharedImageSrc}
                sharedGalleryLength={sharedImageGallery.length}
                sharedImageIndex={sharedImageIdx}
                onSharedImagePrev={messagingSharedImagePrev}
                onSharedImageNext={messagingSharedImageNext}
                sharedImageLoop={sharedImageLoop}
                onToggleSharedImageLoop={messagingToggleSharedImageLoop}
                videoBlur={videoBlur}
                videoBeauty={videoBeauty}
                videoVbg={videoVbg}
                videoChromaKey={videoChromaKey}
                videoChromaColor={videoChromaColor}
                videoChromaSens={videoChromaSens}
                participants={liveParticipants}
                hostParticipant={
                  liveParticipants.find((p) => p.id === immersiveHostUserId)
                  || liveParticipants.find((p) => p.isHost)
                  || liveParticipants[0]
                }
                promotedParticipantId={promotedParticipantId}
                onPromoteParticipant={handlePromoteParticipant}
                onSwapVideoLayout={immersiveIncomingPriority ? undefined : (recipientId ? handleSwapPanelFocus : undefined)}
                sceneFlags={messagingSceneFlags}
                slides={messagingDisplaySlides}
                coursePlanSplit={messagingCoursePlanSplit}
                onPickCoursePlanSlide={pickMessagingCoursePlanSlide}
                slideRailCount={messagingSlideRailCount}
                slideIndex={messagingShellSlideIndex}
                parallaxSlide={messagingParallaxSlide}
                slideParallaxKey={messagingSlideParallaxKey}
                onSetSlideIndex={isMessagingLiveHost ? changeMessagingSlide : undefined}
                onPrevSlide={goPrevMessagingSlide}
                onNextSlide={goNextMessagingSlide}
                spotlight={liveSpotlightOn}
                onToggleSpotlight={() => setLiveSpotlightOn((v) => !v)}
                tacticalSyncRole={liveActive ? (isMessagingLiveHost ? 'host' : 'viewer') : undefined}
                remoteTacticalSync={isMessagingLiveHost ? null : immersiveSbTacticalSyncRemote}
                onTacticalSyncChange={isMessagingLiveHost && liveActive ? handleImmersiveSbTacticalSync : undefined}
                drawerOpen={liveMessageDrawerOpen}
                unreadCount={liveMessageUnread}
                onToggleDrawer={() => { setLiveMessageDrawerOpen((v) => !v); setLiveActionsOpen(false); }}
                drawerMessages={liveForumMessages}
                onSendForumMessage={sendLiveForumMessage}
                forumSending={liveForumSending}
                currentUserId={currentUser?.id}
                muted={liveMuted}
                cameraOff={liveCameraOff}
                sharingScreen={smartboardHasScreen}
                uxState={liveUxState}
                onToggleMuted={toggleLiveMute}
                onToggleCamera={toggleLiveCamera}
                onToggleShare={() => void startScreenShare()}
                onStopLive={() => void stopLiveRoom()}
                actionsOpen={liveActionsOpen}
                onToggleActions={() => setLiveActionsOpen((v) => !v)}
                ambientTracks={liveAmbientTracks}
                pipStream={localPipStream || localCameraStreamState}
                onPipCanvasRef={handlePipCanvasRef}
                pipRegisterOnMiniPreview={pipRegisterOnMiniPreview}
                isReconnecting={isLiveReconnecting}
                connectionQuality={liveConnectionQuality}
                remoteWaiting={remoteVideoWaiting}
                isHost={isMessagingLiveHost}
                annotationStrokes={annotationStrokes}
                onAnnotationStrokesChange={isMessagingLiveHost ? onMessagingAnnotationStrokesChange : undefined}
                whiteboardStrokes={whiteboardStrokes}
                onWhiteboardStrokesChange={isMessagingLiveHost ? onMessagingWhiteboardStrokesChange : undefined}
                whiteboardPageIndex={whiteboardPageIndex}
                whiteboardPageCount={whiteboardPages.length}
                onWhiteboardPrevPage={isMessagingLiveHost ? goMessagingWhiteboardPrevPage : undefined}
                onWhiteboardNextPage={isMessagingLiveHost ? goMessagingWhiteboardNextPage : undefined}
                onWhiteboardAddPage={isMessagingLiveHost ? addMessagingWhiteboardPage : undefined}
                onWhiteboardRemovePage={isMessagingLiveHost ? removeMessagingWhiteboardPage : undefined}
                liveKitRoomRef={immersiveLiveKitRoomRef}
                zone3Members={zone3Members}
                zone3RaisedHands={zone3RaisedHands}
                zone3PrivilegedSeats={zone3PrivilegedSeats}
                zone3MyHandRaised={zone3MyHandRaised}
                onZone3RaiseHand={zone3RaiseHand}
                onZone3LowerHand={zone3LowerHand}
                onZone3GrantSeat={zone3GrantSeat}
                onZone3RevokeSeat={zone3RevokeSeat}
                neuronqQuestions={neuronqQuestions}
                neuronqPendingCount={neuronqPendingCount}
                neuronqQaMode={neuronqQaMode}
                onNeuronqToggleQa={() => setNeuronqQaMode((v) => !v)}
                onNeuronqMarkAnswered={neuronqMarkAnswered}
                onNeuronqMarkSkipped={neuronqMarkSkipped}
                onNeuronqReformulate={neuronqReformulate}
                onNeuronqSubmit={neuronqSubmit}
                neuronqReformulating={neuronqReformulating}
                neuronqSubmitting={neuronqSubmitting}
                {...(!isMessagingLiveHost && !liriMobileLive && !messagingImmersiveFaceToFace
                  ? {
                      neuronqStudentModalOpen: liveNeuronqModalOpen,
                      onNeuronqStudentModalOpenChange: setLiveNeuronqModalOpen,
                    }
                  : {})}
                scriptSections={scriptSections}
                scriptCurrentSection={scriptCurrentSection}
                scriptLoading={scriptLoading}
                scriptImproving={scriptImproving}
                onScriptAdd={scriptAdd}
                onScriptUpdate={scriptUpdate}
                onScriptDelete={scriptDelete}
                onScriptMove={scriptMove}
                onScriptImprove={scriptImprove}
                liveWhisperSessionKey={liveActive && liveSessionId ? liveSessionId : null}
                liveSessionWhisperBridge={
                  liriMobileLive && liveActive && liveSessionId && currentUser?.id
                    ? { threads: messagingMobileWhisperThreads, sendWhisper: messagingMobileSendWhisper }
                    : null
                }
                messagingImmersiveFaceToFace={messagingImmersiveFaceToFace}
                liriMobileMaquette={liriMobileLive}
                liriMobileSmartboardFull={smartboardFullMobile}
                smartboardSceneDockPlacement={
                  liveActive && recipientId && !liriMobileLive ? 'footer' : 'right'
                }
              />
              {liriMobileLive ? (
                <div className="pointer-events-none absolute inset-0 z-[36] overflow-hidden" aria-hidden>
                  <AnimatePresence>
                    {liriHeartBursts.map((hid) => (
                      <LiriHeartBurst
                        key={hid}
                        id={hid}
                        onDone={() => setLiriHeartBursts((prev) => prev.filter((x) => x !== hid))}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : null}
              </motion.div>
            )}
          </AnimatePresence>
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

          <AnimatePresence>
            {invitePanelOpen && !liveActive && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                className="absolute right-4 bottom-4 z-40 w-[min(92vw,380px)] rounded-2xl border border-white/10 bg-[#0c1118]/95 backdrop-blur-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-500">Live chat</p>
                    <p className="text-sm text-white mt-1">
                      Passer en mode immersive avec {recipientProfile?.name || 'ce membre'}.
                    </p>
                  </div>
                  <button onClick={() => setInvitePanelOpen(false)} className="text-gray-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={sendingInvite}
                    onClick={() => void sendLiveInvite(null)}
                    className="h-9 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)] text-xs font-medium"
                  >
                    {sendingInvite ? 'Envoi...' : 'Inviter maintenant'}
                  </button>
                  <button
                    type="button"
                    disabled={sendingInvite || !inviteScheduleAt}
                    onClick={() => void sendLiveInvite(inviteScheduleAt)}
                    className="h-9 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-medium disabled:opacity-50"
                  >
                    Programmer
                  </button>
                </div>
                <div className="mt-2">
                  <input
                    type="datetime-local"
                    value={inviteScheduleAt}
                    onChange={(e) => setInviteScheduleAt(e.target.value)}
                    className="w-full h-9 rounded-xl bg-white/5 border border-white/10 px-3 text-xs text-white"
                  />
                </div>
                {outgoingInvite?.status === 'pending' ? (
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-[11px] text-amber-300/90 flex-1">
                      En attente de {recipientProfile?.name || 'votre interlocuteur'}…
                    </p>
                    {inviteCountdown !== null && (
                      <div className={`flex items-center gap-1 text-[11px] font-mono tabular-nums rounded-full px-2 py-0.5 ${
                        inviteCountdown <= 10
                          ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                          : 'text-white/40 bg-white/5'
                      }`}>
                        <span>{inviteCountdown}s</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Bannière Studio Live (rendez-vous actif) ── */}
        {/* ── Notification d'invitation live (perspective-aware) ── */}
        {/* ── Notification d'invitation live — HORS du fil de messages ── */}
        {!liveActive && (incomingInvite || outgoingInvite) && (
          <div className="mx-4 md:mx-8 mb-2">
            <LiveInviteNotification
              currentUserId={currentUser?.id}
              incomingInvite={incomingInvite}
              outgoingInvite={outgoingInvite}
              senderProfile={incomingInvite ? profiles[incomingInvite.sender_id] : null}
              receiverProfile={recipientProfile}
              inviteCountdown={inviteCountdown}
              onAccept={() => void acceptIncomingInvite()}
              onDecline={() => void declineIncomingInvite()}
              onCancel={() => void cancelOutgoingInvite()}
              onSchedule={() => setAppointmentModalOpen(true)}
              onDismiss={incomingInvite?.status === 'missed' ? () => {
                void supabase.from('live_chat_invites').update({ status: 'ended' }).eq('id', incomingInvite.id);
              } : undefined}
              liveActive={liveActive}
              isDarkTheme={isDarkTheme}
            />
          </div>
        )}

        <AnimatePresence>
          {activeAppointment && !liveActive && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mx-4 md:mx-8 mb-2 flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)] px-3 py-2"
            >
              <Clapperboard className="w-4 h-4 text-[var(--school-accent)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--school-accent)] truncate">
                  {activeAppointment.subject || 'Rendez-vous actif'}
                </p>
                <p className="text-[10px] text-white/40">
                  Statut : {activeAppointment.status}
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenStudio}
                disabled={studioLoading}
                className="flex items-center gap-1.5 h-7 px-3 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[var(--school-accent)] text-[11px] font-medium hover:bg-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-colors disabled:opacity-50 shrink-0"
              >
                {studioLoading
                  ? <span className="w-3 h-3 border border-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] border-t-[var(--school-accent)] rounded-full animate-spin" />
                  : <><Clapperboard className="w-3 h-3" /> Studio Live <ArrowRight className="w-3 h-3" /></>
                }
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <ImmersiveComposer
          onSend={composerSend}
          onOpenPicker={() => setPickerOpen(!pickerOpen)}
          selectedRecipient={selectedRecipient}
          onClearRecipient={handleClearRecipient}
          onTyping={handleTyping}
          onToggleVideo={toggleLiveExpanded}
          onScheduleCall={() => setScheduleCallModal({ open: true })}
          liveActive={liveActive}
          liveEnabled={Boolean(selectedRecipient) && !activeTopic}
          liveActionsOpen={liveActionsOpen}
          onToggleLiveActions={() => setLiveActionsOpen((v) => !v)}
          liveSettingsOpen={liveSettingsOpen}
          onToggleLiveSettings={() => setLiveSettingsOpen((v) => !v)}
          showQuickShareLinks={!liveActive && !activeTopic}
          messagePlaceholder={
            activeTopic
              ? (activeTopic.status === 'closed' ? 'Sujet clôturé — rouvrez-le pour écrire' : `Message dans « ${activeTopic.subject} »…`)
              : (liveActive && recipientId ? 'Écris un message…' : undefined)
          }
          forumSending={activeTopic ? activeTopic.status === 'closed' : (liveActive && recipientId ? liveForumSending : false)}
          immersiveLiveComposerChrome={Boolean(liveActive && recipientId)}
          allowSendWithoutRecipient={Boolean(activeTopic)}
        />
        {/* ── LIVE BOTTOM BAR: Mac Dock (desktop) + Settings panel (toujours pour overlay mobile) ── */}
        {liveActive ? (
          <div className="relative px-4 md:px-8 pb-1">
            <LiveSettingsPanel
              open={liveSettingsOpen}
              onClose={() => setLiveSettingsOpen(false)}
              liriForceCompactLayout={liriForceCompactLayout}
              onLiriForceCompactLayoutChange={setLiriForceCompactLayout}
              blur={videoBlur}
              onBlurChange={setVideoBlur}
              beauty={videoBeauty}
              onBeautyChange={setVideoBeauty}
              vbg={videoVbg}
              onVbgChange={handleMessagingVbgChange}
              chromaKey={videoChromaKey}
              onChromaKeyChange={handleMessagingChromaKeyChange}
              chromaColor={videoChromaColor}
              onChromaColorChange={setVideoChromaColor}
              chromaSensitivity={videoChromaSens}
              onChromaSensitivityChange={setVideoChromaSens}
              onSelectCamera={handleSelectCamera}
              onSelectMic={handleSelectMic}
              onLoadSlides={(slides) => setLiveSlides(slides)}
              onShareScreen={() => void startScreenShare()}
              onShareImage={handleLiveShareImageFromSettings}
              sharingScreen={sharingScreen}
              smartboardSceneFlags={messagingSceneFlags}
              onSmartboardSceneToggle={isMessagingLiveHost ? handleImmersiveSmartboardSceneToggle : undefined}
            />

            {!liriMobileLive ? (
            <>
            {/* Mac Dock actions — always visible, magnification on hover */}
            <LiveActionDock
              liveMuted={liveMuted}
              liveCameraOff={liveCameraOff}
              sharingScreen={sharingScreen}
              liveSpotlightOn={liveSpotlightOn}
              liveMessageUnread={liveMessageUnread}
              liveMessageDrawerOpen={liveMessageDrawerOpen}
              liveSettingsOpen={liveSettingsOpen}
              onToggleMute={toggleLiveMute}
              onToggleCamera={toggleLiveCamera}
              onToggleShare={() => void startScreenShare()}
              onToggleSpotlight={() => setLiveSpotlightOn((v) => !v)}
              hideChatDockButton={messagingImmersiveFaceToFace}
              onToggleChat={() => {
                setLiveNeuronqModalOpen(false);
                setLiveMessageDrawerOpen((v) => !v);
                setLiveSettingsOpen(false);
              }}
              showNeuronQGuest={!isMessagingLiveHost && !messagingImmersiveFaceToFace}
              liveNeuronqModalOpen={liveNeuronqModalOpen}
              onToggleNeuronQ={() => {
                setLiveMessageDrawerOpen(false);
                setLiveSettingsOpen(false);
                setLiveActionsOpen(false);
                setLiveNeuronqModalOpen((v) => !v);
              }}
              onToggleSettings={() => { setLiveSettingsOpen((v) => !v); setLiveMessageDrawerOpen(false); setLiveNeuronqModalOpen(false); }}
              onStop={() => void stopLiveRoom()}
              showPhoneCompanion={Boolean(liveSessionId)}
              onPhoneCompanion={() => {
                setLiveSettingsOpen(false);
                setCompanionQrOpen(true);
              }}
              navigatorScenes={messagingNavigatorScenes}
              activeScene={activeScene}
              onSelectScene={handleDockSelectScene}
              scenesLocked={!isMessagingLiveHost}
              hideSceneNavigator={false}
            />

            <AnimatePresence>
              {companionQrOpen ? (
                <>
                  <motion.div
                    key="companion-qr-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
                    onClick={() => setCompanionQrOpen(false)}
                  />
                  <motion.div
                    key="companion-qr-panel"
                    initial={{ opacity: 0, y: 20, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.96 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="fixed left-1/2 top-1/2 z-[201] w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#0c1425]/95 p-5 shadow-2xl"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Téléphone (QR)</p>
                        <p className="text-[10px] text-white/45 mt-0.5 leading-snug">
                          Scannez avec l'appareil photo. Sur le téléphone : caméra ou écran en direct. Sur ce poste : scène <span className="text-[var(--school-accent)]">Cam 2</span> → flux <span className="text-[var(--school-accent)]">Téléphone (QR)</span>.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCompanionQrOpen(false)}
                        className="h-8 w-8 rounded-lg hover:bg-white/10 text-white/50 flex items-center justify-center shrink-0"
                        aria-label="Fermer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {companionLinkLoading ? (
                      <div className="flex flex-col items-center gap-3 py-10">
                        <span className="w-8 h-8 border-2 border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] border-t-[var(--school-accent)] rounded-full animate-spin" />
                        <p className="text-xs text-white/50">Génération du lien…</p>
                      </div>
                    ) : null}
                    {companionLinkError ? (
                      <p className="text-xs text-red-300/90 py-4">{companionLinkError}</p>
                    ) : null}
                    {!companionLinkLoading && companionJoinUrl ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="rounded-xl bg-white p-3">
                          <QRCodeSVG value={companionJoinUrl} size={200} level="M" />
                        </div>
                        {companionExpiresAt ? (
                          <p className="text-[10px] text-white/40 text-center">
                            Expire le {new Date(companionExpiresAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText?.(companionJoinUrl);
                          }}
                          className="w-full h-9 rounded-xl bg-white/10 border border-white/15 text-xs text-white/85 hover:bg-white/15"
                        >
                          Copier le lien
                        </button>
                      </div>
                    ) : null}
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>

            {/* Minimal live status line */}
            <div className="flex items-center gap-2 flex-wrap">
              {liveError ? <span className="text-[10px] text-red-400/90">{liveError}</span> : null}
              {sendError ? <span className="text-[10px] text-red-400/90">{sendError}</span> : null}
              {uploadingLiveRecord ? <span className="text-[10px] text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]">Upload cloud…</span> : null}
              {!uploadingLiveRecord && liveCloudUrl ? <span className="text-[10px] text-emerald-300/70">● Enregistrement cloud disponible</span> : null}
            </div>
            </>
            ) : (
              <p className="py-1 text-center text-[9px] leading-snug text-white/35">
                Bords · ↑ membres · ↓ plein écran · puce / poignée / bandeau plan · Cours repliable (mémorisé) · → réglages · ← quitter · double cœur
              </p>
            )}
          </div>
        ) : (
          <>
            {liveError ? <div className="px-4 md:px-8 pb-1"><span className="text-[10px] text-red-400/90">{liveError}</span></div> : null}
            {sendError ? <div className="px-4 md:px-8 pb-1"><span className="text-[10px] text-red-400/90">{sendError}</span></div> : null}
          </>
        )}
      </div>

      {liriMobileLive ? (
        <>
          <GestureOverlayController
            enabled={liriMobileLive}
            liveActive={liveActive}
            onRequestExit={() => navigate('/')}
          />
          <LiriMobileOverlaysRoot
            members={liriMobileMembers}
            currentUserId={currentUser?.id}
            onOpenLiveSettings={() => setLiveSettingsOpen(true)}
            onSendForumLine={(t) => void sendLiveForumMessage(t)}
            forumSending={liveForumSending}
            onConfirmExitLive={handleLiriMobileConfirmExit}
            smartboardFullPlan={liriMobileSmartboardOverlayPlan}
            liveSettingsPanel={{
              muted: liveMuted,
              onMutedChange: applyLiveMuted,
            }}
            whisperSessionKey={liriMobileLive && liveActive && liveSessionId ? liveSessionId : null}
            whisperThreads={messagingMobileWhisperThreads}
            sendWhisper={messagingMobileSendWhisper}
          />
        </>
      ) : null}

      <MemberPickerPanel
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        users={users}
        currentUserId={currentUser?.id}
        conversations={conversations}
        onSelectUser={handleSelectUser}
        onSelectConversation={handleSelectConversation}
        onReload={reloadProfiles}
        loading={loading}
      />

      {/* ── SUJETS : modal de création (titre + visibilité) ── */}
      <CreateTopicModal
        open={createTopicOpen}
        onClose={() => setCreateTopicOpen(false)}
        onCreate={handleCreateTopic}
      />

      <SearchPanel
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        conversations={conversations}
        onSelect={handleSelectConversation}
      />

      <PublicProfilePanel
        open={profilePanelOpen}
        profile={recipientProfile}
        onClose={() => setProfilePanelOpen(false)}
      />

      <LiveInvitePrompt
        invite={incomingInvite}
        senderProfile={incomingInvite ? profiles[incomingInvite.sender_id] : null}
        onAccept={() => void acceptIncomingInvite()}
        onDecline={() => void declineIncomingInvite()}
        onScheduleMissed={() => scheduleMissedInvite(incomingInvite)}
        onClose={() => void declineIncomingInvite(incomingInvite)}
      />

      <LiveAgendaPanel
        open={liveAgendaOpen}
        invites={liveAgendaItems}
        currentUserId={currentUser?.id}
        profiles={profiles}
        onJoin={openInviteConversation}
        onScheduleMissed={scheduleMissedInvite}
        onClose={() => setLiveAgendaOpen(false)}
      />

      <LiveSummaryPanel
        open={liveSummaryOpen}
        data={liveSummaryData}
        onClose={() => setLiveSummaryOpen(false)}
      />

      <DeleteMessagePrompt
        open={Boolean(deleteCandidate)}
        message={deleteCandidate}
        loading={deleting}
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={() => deleteCandidate && handleDeleteMessage(deleteCandidate.id)}
      />

      {/* ── Modal RDV rapide (après déclin/timeout d'invitation) ── */}
      <ScheduleCallModal
        open={scheduleCallModal.open}
        onClose={() => setScheduleCallModal({ open: false })}
        recipientName={recipientProfile?.name}
        onSchedule={async ({ title, description, startISO, endISO, callType, requireApproval }) => {
          if (!currentUser?.id || !recipientId) return;
          let liveId = null;
          try {
            const res = await apiV2.post('/lives', {
              title,
              description: description || '',
              host_user_id: currentUser.id,
              scheduled_at: startISO,
              price_cents: 0,
              currency: 'EUR',
            });
            let d = res?.data;
            while (d && typeof d === 'object' && !('id' in d) && 'data' in d) d = d.data;
            liveId = d?.id || null;
          } catch (e) { console.error('[schedule-call] create live:', e?.message || e); }
          const slug = authStore.getTenantSlug?.() || '';
          const when = new Date(startISO).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
          const endTxt = endISO ? ` → ${new Date(endISO).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '';
          const typeLabel = callType === 'audio' ? '📞 Appel audio' : '📹 Appel vidéo';
          const link = liveId
            ? `${typeof window !== 'undefined' ? window.location.origin : ''}/live/host/${liveId}${slug ? `?tenant=${encodeURIComponent(slug)}` : ''}`
            : '';
          const lines = [`📅 ${typeLabel} programmé — « ${title} »`, `🗓️ ${when}${endTxt}`];
          if (description) lines.push(description);
          if (requireApproval) lines.push('🔒 Approbation requise pour rejoindre.');
          if (link) lines.push(`Rejoindre : ${link}`);
          else lines.push('(Le salon sera disponible au moment de l’appel.)');
          await sendMessage(recipientId, lines.join('\n'));
        }}
      />
      <QuickAppointmentModal
        open={appointmentModalOpen}
        onClose={() => setAppointmentModalOpen(false)}
        recipientName={recipientProfile?.name}
        onProposeSlots={async (slots, subject) => {
          if (!currentUser?.id || !recipientId) return;
          // Créer une demande de RDV avec créneaux proposés
          let appt = null;
          try {
            const { data } = await supabase
              .from('appointments')
              .insert({
                student_id: recipientId,
                secretary_id: currentUser.id,
                subject,
                status: 'pending_schedule',
                proposed_slots: JSON.stringify(slots),
                scheduled_at: slots[0],
              })
              .select('id')
              .single();
            appt = data;
          } catch { /* ignore */ }
          const slotsText = slots
            .map((s) => new Date(s).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))
            .join(' · ');
          await sendMessage(
            recipientId,
            `📅 Rendez-vous demandé — "${subject}"\nCréneaux proposés : ${slotsText}\nConfirmez le créneau qui vous convient.`,
          );
        }}
        onRequestAvailability={async (subject) => {
          if (!currentUser?.id || !recipientId) return;
          try {
            await supabase
              .from('appointments')
              .insert({
                student_id: recipientId,
                secretary_id: currentUser.id,
                subject,
                status: 'pending_availability',
              })
              .select('id')
              .single();
          } catch { /* ignore */ }
          await sendMessage(
            recipientId,
            `📅 Demande de disponibilité — "${subject}"\nMerci de me proposer vos créneaux disponibles pour qu'on puisse planifier un rendez-vous.`,
          );
        }}
      />

      {/* ── Modal rapport post-appel ── */}
      <PostCallReportModal
        open={postCallModal.open}
        onClose={() => setPostCallModal((p) => ({ ...p, open: false }))}
        callDurationSeconds={postCallModal.durationSeconds}
        participantName={recipientProfile?.name}
        onGenerateReport={async (sendEmail, sendInbox) => {
          if (!liveSessionId && !postCallModal.lastSessionId) return;
          const sessionId = liveSessionId || postCallModal.lastSessionId;
          const authToken = (await supabase.auth.getSession())?.data?.session?.access_token;
          if (!authToken) return;
          await supabase.functions.invoke('post-call-report', {
            body: {
              liveSessionId: sessionId,
              durationSeconds: postCallModal.durationSeconds,
              sendInbox,
              sendEmail,
            },
          }).then(() => {}, () => {});
        }}
      />

      {/* ── Modal résumé LIRI post-session (Phase 5) ── */}
      <PostLiveSummaryModal
        open={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        summary={liveSummary}
        generating={liveSummaryGenerating}
        error={liveSummaryError}
        onGenerateReport={postCallModal.open ? undefined : async () => {
          const sessionId = liveSessionId || postCallModal.lastSessionId;
          if (!sessionId) return;
          const authToken = (await supabase.auth.getSession())?.data?.session?.access_token;
          if (!authToken) return;
          await supabase.functions.invoke('post-call-report', {
            body: {
              liveSessionId: sessionId,
              durationSeconds: liveSummary?.durationSeconds || 0,
              sendInbox: true,
              sendEmail: false,
            },
          }).then(() => {}, () => {});
        }}
      />
    </div>
  );
};

export default MessagingPage;
