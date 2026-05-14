/**
 * useLiveInvite
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestion des invitations live (live_chat_invites).
 *
 * Architecture envoyeur / receveur :
 *  ENVOYEUR  — envoie l'invite, voit "En attente de X…", quand X accepte :
 *              prevOutgoingStatusRef passe de 'pending' → 'accepted' → onAccepted()
 *  RECEVEUR  — voit "X vous invite", clique Accepter → acceptInvite() → onSelfAccepted()
 *
 * Garanties anti-boucle :
 *  1. onAccepted() ne se déclenche QUE si la transition est pending→accepted
 *     (pas depuis un chargement initial avec invite stale).
 *  2. Les invites 'accepted' trop anciennes (>5 min sans appel actif) sont
 *     nettoyées en DB au montage pour ne jamais polluer l'état futur.
 *  3. prevOutgoingStatusRef est resetté quand recipientId change (pas de
 *     carry-over entre conversations).
 *  4. stopLiveRoom doit TOUJOURS marquer l'invite 'ended' (côté appelant),
 *     même si c'est l'autre qui a raccroché en premier.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

// ── Constantes ────────────────────────────────────────────────────────────────

const IMMEDIATE_TIMEOUT_MS = 30_000;   // 30s pour les invites immédiates
const SCHEDULED_GRACE_MS  = 15 * 60_000; // 15min après l'heure prévue
const STALE_ACCEPTED_MS   = 2 * 60_000;  // invite 'accepted' ≥ 2min sans appel = stale

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAutoStartEligible(invite) {
  if (!invite) return false;
  return invite.status === 'accepted';
}

function isExpired(invite) {
  if (!invite || invite.status !== 'pending') return false;
  const createdAt = invite.created_at ? new Date(invite.created_at).getTime() : 0;
  if (!invite.scheduled_for) {
    return Date.now() - createdAt > IMMEDIATE_TIMEOUT_MS;
  }
  const scheduledAt = new Date(invite.scheduled_for).getTime();
  return Date.now() > scheduledAt + SCHEDULED_GRACE_MS;
}

function isStaleAccepted(invite) {
  if (!invite || invite.status !== 'accepted') return false;
  const acceptedAt = invite.accepted_at
    ? new Date(invite.accepted_at).getTime()
    : invite.created_at
      ? new Date(invite.created_at).getTime()
      : 0;
  return acceptedAt > 0 && Date.now() - acceptedAt > STALE_ACCEPTED_MS;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveInvite({
  currentUser,
  recipientId,
  profiles = {},
  onAccepted,      // () => void — appelé quand l'autre côté a accepté (→ startLiveRoom)
  onSelfAccepted,  // () => void — appelé quand soi-même on accepte une invite entrante (→ startLiveRoom)
  notifyBrowser,   // (title, body) => void
  playAlarmTone,   // () => void
}) {
  const currentUserId = currentUser?.id || null;

  const [allInvites, setAllInvites]         = useState([]);
  const [isSending, setIsSending]           = useState(false);
  const [inviteCountdown, setInviteCountdown] = useState(null);

  const notifiedIdsRef      = useRef(new Set());
  const initialCleanDoneRef = useRef(false); // nettoyage stale au 1er fetch

  // ── Fetch central ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!currentUserId) return;
    const { data, error } = await supabase
      .from('live_chat_invites')
      .select('*')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return;
    setAllInvites(data || []);
  }, [currentUserId]);

  // ── Canal realtime stable ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return undefined;
    void fetchAll();
    const channel = supabase
      .channel(`live-invites-user-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_chat_invites' },
        () => { void fetchAll(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, fetchAll]);

  // ── Nettoyage des invites 'accepted' stalées (une seule fois au 1er fetch) ──
  // Évite qu'une invite laissée 'accepted' après un crash de navigateur
  // ne déclenche un auto-lancement au prochain montage.
  useEffect(() => {
    if (!currentUserId || allInvites.length === 0 || initialCleanDoneRef.current) return;
    initialCleanDoneRef.current = true;
    // Nettoyer toutes les invites 'accepted' stalées (>2min) dont on est l'envoyeur.
    // Les invites sans accepted_at sont aussi considérées stales (vieilles sans timestamp).
    const staleIds = allInvites
      .filter((inv) => {
        if (inv.sender_id !== currentUserId) return false;
        if (inv.status !== 'accepted') return false;
        if (!inv.accepted_at) return true; // pas de timestamp = vieille invite
        return isStaleAccepted(inv);
      })
      .map((inv) => inv.id);
    if (staleIds.length === 0) return;
    void supabase
      .from('live_chat_invites')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .in('id', staleIds);
  }, [allInvites, currentUserId]);

  // ── Dérivations en mémoire ────────────────────────────────────────────────
  const incomingInvite = recipientId
    ? allInvites.find(
        (inv) =>
          inv.receiver_id === currentUserId &&
          inv.sender_id   === recipientId   &&
          ['pending', 'missed'].includes(inv.status)
      ) || null
    : null;

  const outgoingInvite = recipientId
    ? allInvites.find((inv) => {
        if (inv.sender_id !== currentUserId || inv.receiver_id !== recipientId) return false;
        if (inv.status === 'pending') return true;
        if (inv.status !== 'accepted') return false;
        // N'afficher 'accepted' que si l'acceptation est très récente (≤90s).
        // Évite la barre verte persistante après un crash/refresh sans appel réel.
        const acceptedAt = inv.accepted_at ? new Date(inv.accepted_at).getTime() : 0;
        return acceptedAt > 0 && (Date.now() - acceptedAt) <= 90_000;
      }) || null
    : null;

  const pendingCount = allInvites.filter(
    (inv) => inv.receiver_id === currentUserId && inv.status === 'pending'
  ).length;

  // ── Auto-start côté ENVOYEUR (l'autre a accepté) ───────────────────────────
  // Règle : onAccepted() ne se déclenche que si la transition est 'pending' → 'accepted'.
  // Jamais depuis un chargement initial (prevRef = null) ni depuis un changement de recipientId.
  const prevOutgoingStatusRef = useRef(null);

  // Reset quand on change de correspondant pour ne pas carry-over un état stale.
  const prevRecipientIdRef = useRef(recipientId);
  useEffect(() => {
    if (prevRecipientIdRef.current !== recipientId) {
      prevRecipientIdRef.current = recipientId;
      prevOutgoingStatusRef.current = null;
    }
  }, [recipientId]);

  useEffect(() => {
    const status = outgoingInvite?.status;
    if (
      status === 'accepted' &&
      prevOutgoingStatusRef.current === 'pending' && // transition explicite pending→accepted
      typeof onAccepted === 'function'
    ) {
      onAccepted();
    }
    prevOutgoingStatusRef.current = status || null;
  }, [outgoingInvite?.status, onAccepted]);

  // ── Expiration auto → missed ───────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    const expiredIds = allInvites
      .filter((inv) =>
        (inv.sender_id === currentUserId || inv.receiver_id === currentUserId) &&
        isExpired(inv)
      )
      .map((inv) => inv.id);
    if (expiredIds.length === 0) return;
    void supabase.from('live_chat_invites').update({ status: 'missed' }).in('id', expiredIds);
  }, [allInvites, currentUserId]);

  // ── Notifications browser (une seule fois par invite) ─────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    allInvites
      .filter((inv) => inv.receiver_id === currentUserId && inv.status === 'pending')
      .forEach((inv) => {
        if (notifiedIdsRef.current.has(inv.id)) return;
        notifiedIdsRef.current.add(inv.id);
        const sender = profiles[inv.sender_id];
        notifyBrowser?.('Invitation live reçue', `${sender?.name || 'Un membre'} vous invite en studio immersif.`);
        playAlarmTone?.();
      });
  }, [allInvites, currentUserId, profiles, notifyBrowser, playAlarmTone]);

  // ── Compte à rebours invitation sortante (30s) ────────────────────────────
  useEffect(() => {
    if (!outgoingInvite || outgoingInvite.status !== 'pending' || outgoingInvite.scheduled_for) {
      setInviteCountdown(null);
      return undefined;
    }
    const createdAt = outgoingInvite.created_at
      ? new Date(outgoingInvite.created_at).getTime()
      : Date.now();
    const deadline = createdAt + IMMEDIATE_TIMEOUT_MS;

    const tick = () => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setInviteCountdown(remaining);
      if (remaining === 0) {
        void supabase
          .from('live_chat_invites')
          .update({ status: 'missed' })
          .eq('id', outgoingInvite.id);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [outgoingInvite]);

  // ── Alarme pour invites programmées ──────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return undefined;
    const timers = allInvites
      .filter(
        (inv) =>
          inv.receiver_id === currentUserId &&
          inv.status === 'pending' &&
          inv.scheduled_for
      )
      .map((inv) => {
        const delay = Math.max(0, new Date(inv.scheduled_for).getTime() - Date.now());
        return setTimeout(() => {
          playAlarmTone?.();
          notifyBrowser?.('Alerte live', 'Vous avez un live programmé en cours.');
        }, delay);
      });
    return () => timers.forEach(clearTimeout);
  }, [allInvites, currentUserId, notifyBrowser, playAlarmTone]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const sendInvite = useCallback(
    async (scheduledFor = null) => {
      if (!currentUserId || !recipientId) return null;
      setIsSending(true);
      const { data, error } = await supabase
        .from('live_chat_invites')
        .insert({
          sender_id:     currentUserId,
          receiver_id:   recipientId,
          scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
          status:        'pending',
        })
        .select('*')
        .single();
      setIsSending(false);
      if (error) return null;
      return data;
    },
    [currentUserId, recipientId]
  );

  const acceptInvite = useCallback(
    async (invite) => {
      const target = invite || incomingInvite;
      if (!target) return false;
      const { error } = await supabase
        .from('live_chat_invites')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', target.id);
      if (error) return false;
      // Déclenche startLiveRoom côté RECEVEUR immédiatement
      onSelfAccepted?.();
      return true;
    },
    [incomingInvite, onSelfAccepted]
  );

  const declineInvite = useCallback(
    async (invite) => {
      const target = invite || incomingInvite;
      if (!target) return false;
      const { error } = await supabase
        .from('live_chat_invites')
        .update({ status: 'declined' })
        .eq('id', target.id);
      return !error;
    },
    [incomingInvite]
  );

  const cancelOutgoingInvite = useCallback(
    async () => {
      if (!outgoingInvite) return false;
      const { error } = await supabase
        .from('live_chat_invites')
        .update({ status: 'cancelled' })
        .eq('id', outgoingInvite.id);
      return !error;
    },
    [outgoingInvite]
  );

  return {
    allInvites,
    incomingInvite,
    outgoingInvite,
    pendingCount,
    inviteCountdown,
    isSending,
    sendInvite,
    acceptInvite,
    declineInvite,
    cancelOutgoingInvite,
    refresh: fetchAll,
    isAutoStartEligible,
  };
}
