/**
 * API LiveKit — Appels aux Netlify Functions
 * Tokens et création de room côté serveur uniquement
 */
import { resolveApiOrigin } from '@/lib/androidApiHost';
import { supabase } from '@/lib/customSupabaseClient';

const getOrigin = () => resolveApiOrigin();

export async function createLiveRoom(liveSessionId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Non authentifié');

  const res = await fetch(`${getOrigin()}/.netlify/functions/livekit-create-room`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ liveSessionId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Erreur création room');
  return data;
}

export async function getLiveKitToken(liveSessionId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Non authentifié');

  const res = await fetch(`${getOrigin()}/.netlify/functions/livekit-get-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ liveSessionId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Erreur obtention token');
  return data;
}

/** Token subscribe-only, courte durée : aperçu vidéo muet depuis la salle d’attente. */
export async function getLiveKitWaitingPreviewToken(liveSessionId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Non authentifié');

  const res = await fetch(`${getOrigin()}/.netlify/functions/livekit-get-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ liveSessionId, waitingRoomPreview: true }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Erreur obtention token aperçu');
  return data;
}

export async function createImmersiveLiveRoom(liveSessionId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Non authentifié');

  const res = await fetch(`${getOrigin()}/.netlify/functions/immersive-livekit-create-room`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ liveSessionId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Erreur création room immersive');

  /** Enregistrer le nom de room côté Supabase (debug / admin / cohérence) */
  if (data?.roomName && liveSessionId) {
    const { error: upErr } = await supabase
      .from('immersive_live_sessions')
      .update({ room_name: data.roomName })
      .eq('id', liveSessionId);
    if (upErr && typeof console !== 'undefined' && console.debug) {
      console.debug('[livekit] room_name non enregistré (RLS?):', upErr.message);
    }
  }

  return data;
}

/** Lien + QR : téléphone rejoint le live (hôte ou invité authentifié). */
export async function createImmersiveCompanionLink(liveSessionId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Non authentifié');

  const res = await fetch(`${getOrigin()}/.netlify/functions/immersive-livekit-create-companion-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ liveSessionId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Impossible de créer le lien téléphone');
  return data;
}

/** Sans login — page /live/phone uniquement. */
export async function exchangeImmersiveCompanionToken(companionOpaqueToken) {
  const res = await fetch(`${getOrigin()}/.netlify/functions/immersive-livekit-companion-exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: companionOpaqueToken }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Lien invalide ou expiré');
  return data;
}

/** Classroom LIRI — hôte authentifié génère un QR pour /live/mobile-camera */
export async function createLiveMobileCameraLink(liveSessionId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Non authentifié');

  const res = await fetch(`${getOrigin()}/.netlify/functions/livekit-mobile-camera-create-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ liveSessionId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Impossible de créer le lien caméra mobile');
  return data;
}

/** Sans login — page /live/mobile-camera uniquement. */
export async function exchangeLiveMobileCameraToken(opaqueToken) {
  const res = await fetch(`${getOrigin()}/.netlify/functions/livekit-mobile-camera-exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: opaqueToken }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Lien invalide ou expiré');
  return data;
}

export async function getImmersiveLiveKitToken(liveSessionId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Non authentifié');

  const res = await fetch(`${getOrigin()}/.netlify/functions/immersive-livekit-get-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ liveSessionId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Erreur token room immersive');
  return data;
}

/**
 * Enregistre la sortie du participant (left_at) — appeler à la déconnexion LiveKit.
 */
export async function reportImmersiveParticipantLeave(liveSessionId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token || !liveSessionId) return;

  const url = `${getOrigin()}/.netlify/functions/immersive-livekit-participant-leave`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ liveSessionId }),
      keepalive: true,
    });
  } catch {
    // ignore (navigate away / offline)
  }
}
