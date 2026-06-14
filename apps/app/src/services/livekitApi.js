/**
 * API LiveKit — Appels aux Netlify Functions
 * Tokens et création de room côté serveur uniquement
 */
import { resolveApiOrigin } from '@/lib/androidApiHost';
import { supabase } from '@/lib/customSupabaseClient';
import { apiV2 } from '@/lib/api-v2';

const getOrigin = () => resolveApiOrigin();
// V2 : le token LiveKit vient de l'API NestJS (POST /lives/:id/token via apiV2,
// qui ajoute Authorization + X-Tenant-Slug). L'URL publique vient du .env client.
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || '';

/** Mappe la réponse API { token, room } → forme attendue par le host { token, livekitUrl, roomName }. */
async function fetchLiveKitTokenV2(liveSessionId, role) {
  const res = await apiV2.post(`/lives/${liveSessionId}/token`, { role });
  // Dépile les enveloppes `data` jusqu'au payload : le contrôleur renvoie `{data:…}`
  // ET l'intercepteur global ré-emballe → réponse `{data:{data:{token,room}}}`. On
  // tolère 1 ou 2 niveaux (selon l'endpoint) en s'arrêtant dès qu'on voit `token`.
  let d = res?.data ?? {};
  while (d && typeof d === 'object' && !('token' in d) && 'data' in d) d = d.data;
  if (!d.token) throw new Error('Token LiveKit indisponible (API)');
  if (!LIVEKIT_URL) throw new Error('VITE_LIVEKIT_URL manquant côté client');
  return { token: d.token, livekitUrl: LIVEKIT_URL, roomName: d.room, room: d.room };
}

export async function createLiveRoom(liveSessionId) {
  // V2 : l'endpoint token de l'API (POST /lives/:id/token → ensureRoom) crée la
  // room à la volée. Plus d'appel séparé — no-op compatible avec les appelants.
  return { ensured: true, liveSessionId };
}

export async function getLiveKitToken(liveSessionId) {
  return fetchLiveKitTokenV2(liveSessionId, 'host');
}

/** Token subscribe-only (aperçu salle d'attente) — rôle student côté API V2. */
export async function getLiveKitWaitingPreviewToken(liveSessionId) {
  return fetchLiveKitTokenV2(liveSessionId, 'student');
}

export async function createImmersiveLiveRoom(liveSessionId) {
  const res = await apiV2.post('/immersive-live/livekit/create-room', { liveSessionId });
  return res?.data?.data ?? res?.data ?? {};
}

/** Lien + QR : téléphone rejoint le live immersif (hôte/invité authentifié). */
export async function createImmersiveCompanionLink(liveSessionId) {
  const res = await apiV2.post('/immersive-live/livekit/create-companion-link', { liveSessionId });
  return res?.data?.data ?? res?.data ?? {};
}

/** Sans login — page /live/phone uniquement (le token opaque sert d'auth). */
export async function exchangeImmersiveCompanionToken(companionOpaqueToken) {
  const res = await apiV2.post('/immersive-live/livekit/companion-exchange', { token: companionOpaqueToken });
  return res?.data?.data ?? res?.data ?? {};
}

/** Classroom LIRI — formateur génère un QR "téléphone = caméra" pour /live/mobile-camera. */
export async function createLiveMobileCameraLink(liveSessionId) {
  const res = await apiV2.post('/immersive-live/livekit/mobile-camera-link', { liveSessionId });
  return res?.data?.data ?? res?.data ?? {};
}

/** Sans login — page /live/mobile-camera uniquement (le token opaque sert d'auth). */
export async function exchangeLiveMobileCameraToken(opaqueToken) {
  const res = await apiV2.post('/immersive-live/livekit/mobile-camera-exchange', { token: opaqueToken });
  return res?.data?.data ?? res?.data ?? {};
}

export async function getImmersiveLiveKitToken(liveSessionId) {
  const res = await apiV2.post('/immersive-live/livekit/get-token', { liveSessionId });
  return res?.data?.data ?? res?.data ?? {};
}

/** Enregistre la sortie du participant (left_at) — appelé à la déconnexion LiveKit. */
export async function reportImmersiveParticipantLeave(liveSessionId) {
  if (!liveSessionId) return;
  try {
    await apiV2.post('/immersive-live/livekit/participant-leave', { liveSessionId });
  } catch {
    // ignore (navigate away / offline)
  }
}
