/**
 * Pure utilities for MessagingPage (REQ-FE-004 extraction).
 * No React dependencies — importable from any context/test.
 */
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  DEFAULT_SMARTBOARD_SCENE_FLAGS,
} from '@/lib/smartboardNavigatorScenes';

// ─── Role / status display ────────────────────────────────────────────────────

export const statusColors = {
  online: 'bg-green-500',
  away:   'bg-amber-400',
  dnd:    'bg-red-400',
  offline:'bg-gray-500',
};

export const roleLabels = {
  owner:       'Directeur',
  teacher:     'Enseignant',
  student:     'Étudiant',
  admin:       'Admin',
  secretariat: 'Secrétariat',
  creator:     'Créateur',
};

// ─── Auto-correction ──────────────────────────────────────────────────────────

const COMMON_CORRECTIONS = [
  [/\bsa va\b/gi,  'ça va'],
  [/\bca va\b/gi,  'ça va'],
  [/\bjai\b/gi,    "j'ai"],
  [/\btes\b(?=\s+(pas|fautes?|raison|bien))/gi, "t'es"],
  [/\bsava\b/gi,   'ça va'],
];

export function applyAutoCorrection(input) {
  let out = String(input || '');
  COMMON_CORRECTIONS.forEach(([pattern, replacement]) => {
    out = out.replace(pattern, replacement);
  });
  return out.replace(/\s{2,}/g, ' ').trim();
}

// ─── Date / time formatting ───────────────────────────────────────────────────

export function formatMessageTime(ts) {
  const d = new Date(ts);
  if (isToday(d))     return format(d, 'HH:mm');
  if (isYesterday(d)) return `Hier ${format(d, 'HH:mm')}`;
  return format(d, 'd MMM HH:mm', { locale: fr });
}

export function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function formatInviteDate(ts) {
  if (!ts) return '';
  return format(new Date(ts), 'd MMM HH:mm', { locale: fr });
}

export function formatDaySeparatorLabel(ts) {
  const d = new Date(ts);
  if (isToday(d))     return "Aujourd'hui";
  if (isYesterday(d)) return 'Hier';
  return format(d, 'EEEE d MMMM', { locale: fr });
}

// ─── Live invite helpers ──────────────────────────────────────────────────────

/** True only if invite was accepted within the last 45s (auto-start window). */
export function isInviteAutoStartEligible(invite) {
  if (!invite) return false;
  if (invite.status !== 'accepted') return false;
  if (invite.started_at || invite.ended_at) return false;
  const acceptedAtMs = invite.accepted_at ? new Date(invite.accepted_at).getTime() : 0;
  if (!acceptedAtMs) return false;
  return Date.now() - acceptedAtMs <= 45_000;
}

// ─── AI summary builder ───────────────────────────────────────────────────────

export function buildLiveAiSummary({
  durationSec, participantName, modeLabel, usedScreenShare, notes, hasRecording,
}) {
  const noteLines = String(notes || '')
    .split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4);
  const corePoints = [
    `Session de ${formatDuration(durationSec)} avec ${participantName || 'un participant'}.`,
    `Mode dominant: ${modeLabel}.`,
    usedScreenShare
      ? "Un partage d'écran a été utilisé pendant la session."
      : "Aucun partage d'écran détecté.",
    hasRecording
      ? 'Un enregistrement est disponible (local/cloud).'
      : 'Aucun enregistrement finalisé.',
  ];
  if (noteLines.length > 0) corePoints.push(`Notes clés: ${noteLines.join(' | ')}`);
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

// ─── Smartboard scene helpers ─────────────────────────────────────────────────

/** Cam2 is ON by default in messaging (override on top of DEFAULT flags). */
export const IMMERSIVE_SMARTBOARD_SCENE_OVERLAY = { camera2: true };

export function normalizeImmersiveSmartboardScenesJson(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  Object.keys(DEFAULT_SMARTBOARD_SCENE_FLAGS).forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(raw, k)) out[k] = Boolean(raw[k]);
  });
  return out;
}

// ─── Gallery normalization ────────────────────────────────────────────────────

export function normalizeMessagingSharedGallery(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => {
      if (typeof item === 'string' && item.trim())
        return { url: item.trim(), label: `Visuel ${i + 1}` };
      if (item && typeof item.url === 'string' && item.url.trim())
        return {
          url: item.url.trim(),
          label:
            typeof item.label === 'string' && item.label.trim()
              ? item.label.trim()
              : `Visuel ${i + 1}`,
        };
      return null;
    })
    .filter(Boolean);
}

// ─── Default slides ───────────────────────────────────────────────────────────

export const DEFAULT_IMMERSIVE_SLIDES = [
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
      { id: 's1_t', type: 'title',     content: 'STUDIO LIVE IMMERSIF', x: 54, y: 72, width: 960, height: 180, zIndex: 2, animation: 'fade-up' },
      { id: 's1_p', type: 'paragraph', content: 'Présentez votre contenu avec une présence forte, claire et mémorable.', x: 58, y: 270, width: 850, height: 120, zIndex: 3, animation: 'fade' },
      { id: 's1_b', type: 'badge',     content: 'Mode Premium', x: 60, y: 402, width: 180, height: 36, zIndex: 4, animation: 'spotlight' },
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
      { id: 's2_t', type: 'title',     content: 'UN MESSAGE FORT', x: 56, y: 74, width: 780, height: 150, zIndex: 2, animation: 'fade-up' },
      { id: 's2_p', type: 'paragraph', content: 'Transformez chaque live en expérience visuelle premium.', x: 58, y: 246, width: 760, height: 110, zIndex: 3, animation: 'fade' },
      { id: 's2_i', type: 'image',     src: 'https://placehold.co/420x230/png?text=Vision', x: 580, y: 330, width: 420, height: 230, zIndex: 4, animation: 'spotlight' },
    ],
  },
  {
    id: 'slide_text_only',
    title: 'Texte',
    styleVariant: 'creator',
    layoutType: 'centered',
    backgroundMode: 'immersive-dark',
    elements: [
      { id: 's3_t', type: 'title',     content: 'OBJECTIF DU LIVE', x: 56, y: 84, width: 900, height: 160, zIndex: 2, animation: 'fade-up' },
      { id: 's3_p', type: 'paragraph', content: 'Captiver. Expliquer. Faire agir.\n\nUne narration simple avec une lisibilité maximale et un rythme immersif.', x: 60, y: 270, width: 860, height: 230, zIndex: 3, animation: 'fade' },
    ],
  },
];

// ─── Sample data ──────────────────────────────────────────────────────────────

export const SAMPLE_LIVE_PARTICIPANTS = [
  { id: 'sample-emma',    name: 'Emma',    avatar_url: 'https://i.pravatar.cc/200?img=32' },
  { id: 'sample-pierre',  name: 'Pierre',  avatar_url: 'https://i.pravatar.cc/200?img=12' },
  { id: 'sample-nicolas', name: 'Nicolas', avatar_url: 'https://i.pravatar.cc/200?img=15' },
  { id: 'sample-lara',    name: 'Lara',    avatar_url: 'https://i.pravatar.cc/200?img=47' },
  { id: 'sample-julien',  name: 'Julien',  avatar_url: 'https://i.pravatar.cc/200?img=14' },
  { id: 'sample-selma',   name: 'Selma',   avatar_url: 'https://i.pravatar.cc/200?img=44' },
];
