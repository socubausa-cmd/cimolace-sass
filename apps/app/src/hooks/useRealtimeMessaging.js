import { useCallback, useEffect, useRef, useState } from 'react';
import { messagingApi } from '@/lib/api-v2';
import { supabase } from '@/lib/customSupabaseClient';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';

/**
 * Messagerie élève — temps réel par POLLING COURT sur l'API NestJS.
 *
 * Pourquoi pas Supabase Realtime ? La table `public.messages` (prod) a RLS activé mais
 * AUCUNE policy, n'est PAS dans la publication `supabase_realtime`, et reste 100 %
 * `service_role`. Le seul accès fonctionnel est l'API (`/messaging/*`). On interroge donc
 * l'API de façon adaptative (fil ouvert : 5 s ; liste : 20 s ; caché : ~60 s ; focus : immédiat).
 * Détail + alternatives → docs/MESSAGERIE_TEMPS_REEL_DECISION.md
 *
 * Le schéma RÉEL est un modèle CONVERSATION (`conversation_id` + `recipient_id`), pas un DM
 * plat. On mappe `recipient_id → receiver_id` à la frontière pour garder le contrat public
 * attendu par les écrans (`{ id, sender_id, receiver_id, content, is_read, created_at }` +
 * conversations dérivées `{ participantId, unreadCount, lastMessage, … }`).
 */

const ACTIVE_POLL_MS = 5000; // fil ouvert (1 conversation)
// Liste complète + badges non-lus : le fan-out N+1 (listConversations puis getConversation par
// conversation) coûte ~2s. Le badge reste frais via le fetch au montage + le broadcast realtime,
// donc on ralentit ce poll de fond 20s→45s (moins de fan-out lourds répétés hors messagerie).
const LIST_POLL_MS = 45000;
const HIDDEN_POLL_MS = 60000; // onglet caché : refresh complet ralenti
const FETCH_ERROR_LOG_MS = 15000; // throttle des logs d'erreur
const NETWORK_BACKOFF_MS = 120000; // pause après échecs réseau répétés

// Messages système auto-envoyés par l'invite live — non affichés dans le chat.
const INVITE_PATTERNS = [
  /^invitation studio immersive/i,
  /^📹.*invitation/i,
  /^\[live_invite\]/i,
  /^🎬.*invite/i,
];

function isSystemInviteMsg(msg) {
  return INVITE_PATTERNS.some((rx) => rx.test(String(msg?.content || '').trim()));
}

/** Normalise une ligne API (modèle conversation) vers la forme plate attendue par l'UI. */
function normalizeRow(row) {
  return {
    id: row.id,
    conversation_id: row.conversation_id ?? null,
    sender_id: row.sender_id,
    // Mapping clé : le schéma prod a `recipient_id`, l'UI attend `receiver_id`.
    receiver_id: row.recipient_id ?? row.receiver_id ?? null,
    subject: row.subject ?? null,
    content: row.content,
    is_read: row.is_read ?? false,
    created_at: row.created_at,
  };
}

const byCreatedAtAsc = (a, b) => new Date(a.created_at) - new Date(b.created_at);

export function useRealtimeMessaging(userId, profilesMap = {}) {
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  // L'API existe toujours ; conservé pour le contrat (écrans qui testent `=== false`).
  const [tableExists] = useState(true);

  const profilesRef = useRef(profilesMap);
  const messagesRef = useRef([]);
  const notifiedIdsRef = useRef(new Set());
  const audioUnlockedRef = useRef(false);
  const audioCtxRef = useRef(null);
  const lastFetchErrorLogAtRef = useRef(0);
  const consecutiveFetchFailuresRef = useRef(0);
  const pollBackoffUntilRef = useRef(0);

  // Bridge modèle participant ↔ conversation.
  const peerConvMapRef = useRef({}); // { [peerUserId]: conversationId } — dernière conv par pair
  const activePeerRef = useRef(null); // pair du fil actuellement ouvert (poll rapide)

  // Overrides optimistes (pas d'endpoint API pour read/delete/edit) — évitent que le
  // polling ne réannule l'état local pendant la session.
  const readOverridesRef = useRef(new Set());
  const deletedOverridesRef = useRef(new Set());
  const editOverridesRef = useRef(new Map());

  useEffect(() => { profilesRef.current = profilesMap; }, [profilesMap]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ── Audio + permission notifications (uniquement après un geste — Safari/Chrome) ──
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const unlock = () => {
      if (!audioCtxRef.current) {
        try {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        } catch {
          return;
        }
      }
      audioUnlockedRef.current = true;
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const playIncomingSound = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!audioUnlockedRef.current) return;
    const audioContext = audioCtxRef.current;
    if (!audioContext) return;
    try {
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, audioContext.currentTime);
      gain.gain.setValueAtTime(0.07, audioContext.currentTime);
      osc.start();
      osc.stop(audioContext.currentTime + 0.12);
    } catch {
      // ignore audio failures
    }
  }, []);

  const notifyIncomingMessage = useCallback((msg) => {
    if (typeof window === 'undefined') return;
    if (!msg || msg.receiver_id !== userId) return;
    if (notifiedIdsRef.current.has(msg.id)) return;
    notifiedIdsRef.current.add(msg.id);
    playIncomingSound();

    if (document.visibilityState === 'visible') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const sender = profilesRef.current[msg.sender_id];
    const senderName = sender?.name || sender?.email || 'Nouveau message';
    const preview = String(msg.content || '').slice(0, 90);
    try {
      const n = new Notification(`Message de ${senderName}`, {
        body: preview || 'Vous avez reçu un nouveau message',
      });
      n.onclick = () => window.focus();
    } catch {
      // ignore notification failures
    }
  }, [playIncomingSound, userId]);

  /** Notifie pour les messages entrants nouveaux (présents dans `next`, absents avant). */
  const notifyNewIncoming = useCallback((nextMsgs) => {
    const prevIds = new Set(messagesRef.current.map((m) => m.id));
    for (const m of nextMsgs) {
      if (!prevIds.has(m.id)) notifyIncomingMessage(m);
    }
  }, [notifyIncomingMessage]);

  const deriveConversations = useCallback(
    (msgs, pMap) => {
      if (!userId) return [];
      const convMap = {};

      msgs.forEach((msg) => {
        const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (!otherId) return; // message de groupe (recipient null) — pas de fil 1:1 dérivable
        if (!convMap[otherId]) {
          const profile = pMap[otherId];
          convMap[otherId] = {
            id: otherId,
            participantId: otherId,
            name: profile?.name || profile?.email || 'Inconnu',
            avatar_url: profile?.avatar_url || null,
            role: profile?.role || 'student',
            status: profile?.status || 'active',
            email: profile?.email || '',
            messages: [],
            lastMessage: null,
            unreadCount: 0,
          };
        }
        convMap[otherId].messages.push(msg);
        if (!msg.is_read && msg.receiver_id === userId) {
          convMap[otherId].unreadCount += 1;
        }
      });

      return Object.values(convMap)
        .map((conv) => {
          conv.messages.sort(byCreatedAtAsc);
          conv.lastMessage = conv.messages[conv.messages.length - 1] || null;
          return conv;
        })
        .sort((a, b) => {
          const da = a.lastMessage ? new Date(a.lastMessage.created_at) : 0;
          const db = b.lastMessage ? new Date(b.lastMessage.created_at) : 0;
          return db - da;
        });
    },
    [userId]
  );

  // ── Helpers data ────────────────────────────────────────────────────────────

  const logFetchError = useCallback((e) => {
    const now = Date.now();
    if (now - lastFetchErrorLogAtRef.current > FETCH_ERROR_LOG_MS) {
      lastFetchErrorLogAtRef.current = now;
      console.error('[messaging] fetch error:', e?.message || e);
    }
  }, []);

  const registerFailure = useCallback(() => {
    consecutiveFetchFailuresRef.current += 1;
    if (consecutiveFetchFailuresRef.current >= 3) {
      consecutiveFetchFailuresRef.current = 0;
      pollBackoffUntilRef.current = Date.now() + NETWORK_BACKOFF_MS;
    }
  }, []);

  /** Normalise + applique les overrides + filtre les messages système. */
  const prepareRows = useCallback((rows) => {
    const out = [];
    for (const raw of rows) {
      const m = normalizeRow(raw);
      if (!m.id) continue;
      if (deletedOverridesRef.current.has(m.id)) continue;
      if (isSystemInviteMsg(m)) continue;
      let mm = m;
      if (readOverridesRef.current.has(m.id) && !mm.is_read) mm = { ...mm, is_read: true };
      const edited = editOverridesRef.current.get(m.id);
      if (edited != null) mm = { ...mm, content: edited };
      out.push(mm);
    }
    return out;
  }, []);

  /** Indexe `peer → conversationId` (dernière conv par pair) à partir de messages préparés. */
  const indexPeerConvs = useCallback((msgs) => {
    const map = { ...peerConvMapRef.current };
    const latestAt = {};
    for (const m of msgs) {
      const peer = m.sender_id === userId ? m.receiver_id : m.sender_id;
      if (!peer || !m.conversation_id) continue;
      const t = new Date(m.created_at || 0).getTime();
      if (!(peer in latestAt) || t >= latestAt[peer]) {
        latestAt[peer] = t;
        map[peer] = m.conversation_id;
      }
    }
    peerConvMapRef.current = map;
  }, [userId]);

  /** Récupère TOUS les messages (liste des conversations + messages de chacune). */
  const fetchAllMessages = useCallback(async () => {
    if (!userId) return null;
    try {
      const convs = await messagingApi.listConversations();
      const list = Array.isArray(convs) ? convs : [];
      if (list.length === 0) return [];

      const perConv = await Promise.all(
        list.map((c) =>
          messagingApi
            .getConversation(c.id)
            .then((r) => (Array.isArray(r) ? r : []))
            .catch(() => null)
        )
      );
      // Toutes les sous-requêtes ont échoué → échec réseau (ne pas écraser l'état).
      if (perConv.every((r) => r === null)) return null;

      const dedup = new Map();
      for (const m of prepareRows(perConv.filter(Boolean).flat())) {
        dedup.set(m.id, m);
      }
      const merged = Array.from(dedup.values());
      indexPeerConvs(merged);
      merged.sort(byCreatedAtAsc);
      return merged;
    } catch (e) {
      logFetchError(e);
      return null;
    }
  }, [userId, prepareRows, indexPeerConvs, logFetchError]);

  /** Récupère les messages d'UNE conversation (poll rapide du fil ouvert). */
  const fetchConversation = useCallback(async (convId) => {
    if (!convId) return null;
    try {
      const r = await messagingApi.getConversation(convId);
      return prepareRows(Array.isArray(r) ? r : []);
    } catch (e) {
      logFetchError(e);
      return null;
    }
  }, [prepareRows, logFetchError]);

  // ── Application des résultats à l'état ───────────────────────────────────────

  const applyFull = useCallback((msgs) => {
    notifyNewIncoming(msgs);
    messagesRef.current = msgs;
    setMessages(msgs);
    setConversations(deriveConversations(msgs, profilesRef.current));
  }, [notifyNewIncoming, deriveConversations]);

  /** Fusionne un sous-ensemble (une conversation) sans perdre les autres fils. */
  const applyMerge = useCallback((incoming) => {
    if (!incoming || !incoming.length) return;
    const byId = new Map(messagesRef.current.map((m) => [m.id, m]));
    let changed = false;
    for (const m of incoming) {
      const ex = byId.get(m.id);
      if (!ex) {
        byId.set(m.id, m);
        changed = true;
      } else if (ex.content !== m.content || ex.is_read !== m.is_read) {
        byId.set(m.id, { ...ex, ...m });
        changed = true;
      }
    }
    if (!changed) return;
    const next = Array.from(byId.values()).sort(byCreatedAtAsc);
    notifyNewIncoming(next);
    messagesRef.current = next;
    setMessages(next);
    setConversations(deriveConversations(next, profilesRef.current));
  }, [notifyNewIncoming, deriveConversations]);

  const refresh = useCallback(async () => {
    const msgs = await fetchAllMessages();
    if (msgs === null) {
      registerFailure();
      setLoading(false);
      return;
    }
    consecutiveFetchFailuresRef.current = 0;
    applyFull(msgs);
    setLoading(false);
  }, [fetchAllMessages, applyFull, registerFailure]);

  // Recalcule conversations quand profilesMap se peuple (noms/avatars).
  useEffect(() => {
    if (Object.keys(profilesMap).length > 0) {
      setConversations(deriveConversations(messagesRef.current, profilesMap));
    }
  }, [profilesMap]);

  // ── Polling adaptatif (le « temps réel ») ────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    refresh();

    // Poll rapide : la conversation actuellement ouverte (1 requête).
    const fast = setInterval(() => {
      if (Date.now() < pollBackoffUntilRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      const peer = activePeerRef.current;
      if (!peer) return;
      const convId = peerConvMapRef.current[peer];
      if (!convId) return;
      fetchConversation(convId).then((rows) => {
        if (rows === null) { registerFailure(); return; }
        consecutiveFetchFailuresRef.current = 0;
        applyMerge(rows);
      });
    }, ACTIVE_POLL_MS);

    // Poll liste : refresh complet (fils + badges non-lus). Ralenti si onglet caché.
    let lastListAt = 0;
    const list = setInterval(async () => {
      if (Date.now() < pollBackoffUntilRef.current) return;
      const hidden = typeof document !== 'undefined' && document.hidden;
      const now = Date.now();
      if (hidden && now - lastListAt < HIDDEN_POLL_MS) return;
      lastListAt = now;
      const msgs = await fetchAllMessages();
      if (msgs === null) { registerFailure(); return; }
      consecutiveFetchFailuresRef.current = 0;
      applyFull(msgs);
    }, LIST_POLL_MS);

    const onFocus = () => refresh();
    const onVisibility = () => { if (!document.hidden) refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(fast);
      clearInterval(list);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId]);

  // ── Réception INSTANTANÉE (broadcast Supabase) ───────────────────────────────
  // Canal perso de l'inbox : un envoi pousse un signal `new_message` ici → on rafraîchit
  // SANS attendre le poll (5–20 s). Éphémère, aucune table/publication requise. Le polling
  // ci-dessus reste le filet si le WebSocket realtime est indisponible.
  useEffect(() => {
    if (!userId) return undefined;
    let channel;
    try {
      channel = supabase.channel(`dm-inbox:${userId}`, { config: { broadcast: { self: false } } });
      channel.on('broadcast', { event: 'new_message' }, () => { refresh(); }).subscribe();
    } catch {
      channel = null;
    }
    return () => { if (channel) { try { supabase.removeChannel(channel); } catch { /* noop */ } } };
  }, [userId, refresh]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (receiverId, content) => {
    if (!userId || !receiverId || !content?.trim()) return null;
    let row;
    try {
      // L'API crée/retrouve la conversation côté serveur (find_or_create_conversation).
      row = await messagingApi.send({ recipientId: receiverId, content: content.trim() });
    } catch (e) {
      console.error('[messaging] send error:', e?.message || e);
      return null;
    }
    if (!row || !row.id) return null;

    // Message neuf : normalisation directe (aucun override à appliquer, et on ne le passe
    // PAS par le filtre d'affichage des invites — sinon un envoi légitime renverrait null).
    const m = normalizeRow({ ...row, recipient_id: row.recipient_id ?? receiverId });

    activePeerRef.current = receiverId;
    if (m.conversation_id) peerConvMapRef.current[receiverId] = m.conversation_id;
    applyMerge([m]);

    // Réception INSTANTANÉE : pousse un signal vers l'inbox du destinataire (best-effort,
    // canal éphémère). S'il échoue, le polling du destinataire récupère le message au poll suivant.
    try {
      const out = supabase.channel(`dm-inbox:${receiverId}`);
      out.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        void broadcastRealtime(out, 'new_message', { from: userId });
        setTimeout(() => { try { supabase.removeChannel(out); } catch { /* noop */ } }, 1500);
      });
    } catch { /* noop */ }

    return m;
  }, [userId, prepareRows, applyMerge]);

  /**
   * Marque des messages comme lus. Optimiste LOCAL uniquement : il n'existe pas d'endpoint
   * API de lecture à ce jour (voir docs/MESSAGERIE_TEMPS_REEL_DECISION.md). Accepte des ids
   * ou des objets message.
   */
  const markAsRead = useCallback((items) => {
    const ids = (Array.isArray(items) ? items : [])
      .map((x) => (x && typeof x === 'object' ? x.id : x))
      .filter(Boolean);
    if (!ids.length) return;
    const idSet = new Set(ids);
    ids.forEach((id) => readOverridesRef.current.add(id));
    // Persistance serveur (best-effort, idempotent) : marque lues les conversations concernées.
    const convIds = new Set();
    for (const id of ids) {
      const m = messagesRef.current.find((x) => x.id === id);
      if (m?.conversation_id) convIds.add(m.conversation_id);
    }
    convIds.forEach((cid) => { messagingApi.markRead(cid).catch(() => {}); });
    setMessages((prev) => {
      let changed = false;
      const next = prev.map((m) => {
        if (idSet.has(m.id) && !m.is_read) { changed = true; return { ...m, is_read: true }; }
        return m;
      });
      if (!changed) return prev;
      messagesRef.current = next;
      setConversations(deriveConversations(next, profilesRef.current));
      return next;
    });
  }, [deriveConversations]);

  /** Suppression optimiste locale (override anti-résurrection) PUIS persistance API. */
  const deleteMessage = useCallback(async (messageId) => {
    if (!userId || !messageId) return false;
    deletedOverridesRef.current.add(messageId);
    setMessages((prev) => {
      if (!prev.some((m) => m.id === messageId)) return prev;
      const next = prev.filter((m) => m.id !== messageId);
      messagesRef.current = next;
      setConversations(deriveConversations(next, profilesRef.current));
      return next;
    });
    try { await messagingApi.deleteMessage(messageId); } catch (e) { console.error('[messaging] delete error:', e?.message || e); }
    return true;
  }, [userId, deriveConversations]);

  /** Édition optimiste locale (override anti-réannulation) PUIS persistance API. */
  const editMessage = useCallback(async (messageId, newContent) => {
    if (!userId || !messageId || !newContent?.trim()) return null;
    const content = newContent.trim();
    editOverridesRef.current.set(messageId, content);
    let result = null;
    setMessages((prev) => {
      if (!prev.some((m) => m.id === messageId)) return prev;
      const next = prev.map((m) => {
        if (m.id === messageId) { result = { ...m, content }; return result; }
        return m;
      });
      messagesRef.current = next;
      setConversations(deriveConversations(next, profilesRef.current));
      return next;
    });
    try { await messagingApi.editMessage(messageId, content); } catch (e) { console.error('[messaging] edit error:', e?.message || e); }
    return result || { id: messageId, content };
  }, [userId, deriveConversations]);

  const getConversationMessages = useCallback((participantId) => {
    if (!userId || !participantId) return [];
    return messages.filter(
      (m) =>
        (m.sender_id === userId && m.receiver_id === participantId) ||
        (m.sender_id === participantId && m.receiver_id === userId)
    );
  }, [messages, userId]);

  /**
   * Fetch ciblé d'une conversation (à l'ouverture d'un fil) + enregistre le pair actif
   * pour que le poll rapide le rafraîchisse. Si la conversation est inconnue (1ʳᵉ ouverture),
   * un refresh complet la découvre ; si aucun message n'existe encore, rien à charger.
   */
  const fetchAndMergeConversation = useCallback(async (participantId) => {
    if (!userId || !participantId) return;
    activePeerRef.current = participantId;
    let convId = peerConvMapRef.current[participantId];
    if (!convId) {
      const msgs = await fetchAllMessages();
      if (msgs !== null) { consecutiveFetchFailuresRef.current = 0; applyFull(msgs); }
      convId = peerConvMapRef.current[participantId];
      if (!convId) return; // pas encore de conversation (aucun message) — normal
      return; // applyFull a déjà fusionné les messages de ce pair
    }
    const rows = await fetchConversation(convId);
    if (rows !== null) applyMerge(rows);
  }, [userId, fetchAllMessages, applyFull, fetchConversation, applyMerge]);

  return {
    messages,
    conversations,
    loading,
    tableExists,
    sendMessage,
    markAsRead,
    deleteMessage,
    editMessage,
    getConversationMessages,
    fetchAndMergeConversation,
    refresh,
  };
}
