import { useCallback, useEffect, useRef, useState } from 'react';
import { messagingApi } from '@/lib/api-v2';

/**
 * Sujets (topics) — chemin de données PARALLÈLE au DM (useRealtimeMessaging).
 *
 * POURQUOI un hook séparé : la messagerie 1-à-1 DÉRIVE ses conversations en regroupant
 * les `messages` par PAIR (sender/receiver) — modèle DM strict à 2. Un Sujet est un
 * GROUPE (`kind='topic'`, sans pair fixe) : il ne rentre pas dans ce regroupement et
 * exige donc une liste + des messages propres, chargés via l'API NestJS (la table
 * `messages` est `service_role` en prod, aucun accès Supabase direct côté client).
 *
 * Ce hook reste volontairement minimal et ADDITIF : il ne touche ni `useRealtimeMessaging`
 * ni le `MessagingContext`. Il expose la liste des sujets, l'ouverture d'un sujet (avec
 * ses messages), l'envoi, et la clôture/réouverture.
 */

const TOPIC_POLL_MS = 6000; // fil de sujet ouvert (un peu plus lent que le DM 1:1)
const LIST_POLL_MS = 30000; // liste des sujets

/** Normalise une ligne message API (modèle conversation) vers la forme plate de l'UI. */
function normalizeRow(row) {
  return {
    id: row.id,
    conversation_id: row.conversation_id ?? row.topic_id ?? null,
    sender_id: row.sender_id,
    // Le schéma prod expose `recipient_id` ; l'UI (ImmersiveMessage) lit `receiver_id`.
    receiver_id: row.recipient_id ?? row.receiver_id ?? null,
    subject: row.subject ?? null,
    content: row.content,
    is_read: row.is_read ?? false,
    created_at: row.created_at,
  };
}

/** Normalise un sujet renvoyé par l'API en une forme stable pour l'UI. */
function normalizeTopic(t) {
  if (!t || !t.id) return null;
  return {
    id: t.id,
    subject: t.subject || t.name || t.title || 'Sujet',
    status: t.status === 'closed' ? 'closed' : 'open',
    visibility: t.visibility || 'private',
    context_type: t.context_type ?? null,
    context_id: t.context_id ?? null,
    created_by: t.created_by ?? null,
    created_at: t.created_at ?? null,
    updated_at: t.updated_at ?? null,
    last_message: t.last_message ?? t.lastMessage ?? null,
    unread_count: Number(t.unread_count ?? t.unreadCount ?? 0) || 0,
  };
}

const byCreatedAtAsc = (a, b) => new Date(a.created_at) - new Date(b.created_at);

function unwrapList(res) {
  let d = res;
  while (d && !Array.isArray(d) && typeof d === 'object' && 'data' in d) d = d.data;
  return Array.isArray(d) ? d : [];
}

export function useMessagingTopics(userId) {
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState(null);
  const [topicMessages, setTopicMessages] = useState([]);
  const [topicMessagesLoading, setTopicMessagesLoading] = useState(false);

  const activeTopicIdRef = useRef(null);
  const enabledRef = useRef(Boolean(userId));
  useEffect(() => { enabledRef.current = Boolean(userId); }, [userId]);

  // ── Liste des sujets ─────────────────────────────────────────────────────────
  const loadTopics = useCallback(async () => {
    if (!userId) { setTopics([]); return; }
    setTopicsLoading(true);
    try {
      const list = unwrapList(await messagingApi.listTopics());
      const mapped = list.map(normalizeTopic).filter(Boolean);
      setTopics(mapped);
    } catch (e) {
      // Le socle backend peut ne pas être déployé partout — on dégrade en silence
      // (liste vide) sans casser la messagerie 1-à-1.
      if (import.meta?.env?.DEV) console.debug('[topics] list error:', e?.message || e);
      setTopics([]);
    } finally {
      setTopicsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) { setTopics([]); return undefined; }
    loadTopics();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadTopics();
    }, LIST_POLL_MS);
    const onFocus = () => loadTopics();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [userId, loadTopics]);

  // ── Messages d'un sujet ──────────────────────────────────────────────────────
  const fetchTopicMessages = useCallback(async (topicId) => {
    if (!topicId) return null;
    try {
      const rows = unwrapList(await messagingApi.getTopicMessages(topicId));
      return rows.map(normalizeRow).filter((m) => m.id).sort(byCreatedAtAsc);
    } catch (e) {
      if (import.meta?.env?.DEV) console.debug('[topics] messages error:', e?.message || e);
      return null;
    }
  }, []);

  /** Ouvre un sujet : enregistre l'actif + charge ses messages (poll rapide ensuite). */
  const openTopic = useCallback(async (topic) => {
    const t = normalizeTopic(topic) || topic;
    if (!t?.id) return;
    activeTopicIdRef.current = t.id;
    setActiveTopic(t);
    setTopicMessages([]);
    setTopicMessagesLoading(true);
    // Rafraîchit la fiche sujet (statut à jour) sans bloquer l'affichage des messages.
    messagingApi.getTopic(t.id).then((fresh) => {
      const nf = normalizeTopic(fresh);
      if (nf && activeTopicIdRef.current === nf.id) setActiveTopic((prev) => ({ ...prev, ...nf }));
    }).catch(() => {});
    const rows = await fetchTopicMessages(t.id);
    if (activeTopicIdRef.current !== t.id) return; // l'utilisateur a changé de fil entre-temps
    if (rows !== null) setTopicMessages(rows);
    setTopicMessagesLoading(false);
  }, [fetchTopicMessages]);

  const closeActiveTopicView = useCallback(() => {
    activeTopicIdRef.current = null;
    setActiveTopic(null);
    setTopicMessages([]);
  }, []);

  // Poll rapide du sujet ouvert (le « temps réel » du fil de sujet).
  useEffect(() => {
    const topicId = activeTopic?.id;
    if (!topicId) return undefined;
    const id = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (activeTopicIdRef.current !== topicId) return;
      const rows = await fetchTopicMessages(topicId);
      if (rows !== null && activeTopicIdRef.current === topicId) setTopicMessages(rows);
    }, TOPIC_POLL_MS);
    return () => clearInterval(id);
  }, [activeTopic?.id, fetchTopicMessages]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const createTopic = useCallback(async ({ subject, visibility = 'private', contextType = null, contextId = null }) => {
    const s = String(subject || '').trim();
    if (!userId || !s) return null;
    const body = { subject: s, visibility };
    if (contextType) { body.context_type = contextType; body.context_id = contextId; }
    let created;
    try {
      created = normalizeTopic(await messagingApi.createTopic(body));
    } catch (e) {
      console.error('[topics] create error:', e?.message || e);
      return null;
    }
    if (!created?.id) return null;
    setTopics((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
    return created;
  }, [userId]);

  /**
   * Phase C — get-or-create IDEMPOTENT du Sujet d'un contexte (vidéo de cours), puis
   * ouverture immédiate de son fil. ADDITIF : renvoie le Sujet normalisé (ou null si
   * l'API échoue / refuse — 403 si non inscrit), SANS jamais lever : l'appelant (le
   * lecteur) dégrade en silence et ne casse pas la lecture vidéo.
   *
   * body attendu côté API (camelCase, cf. GetOrCreateContextTopicDto) :
   *   { contextType:'video', contextId:<video_id>, courseId:<course_id>, subject?:'…' }
   */
  const getOrCreateContextTopic = useCallback(async ({ contextType, contextId, courseId, subject } = {}) => {
    if (!userId || !contextType || !contextId) return null;
    const body = { contextType, contextId };
    if (courseId) body.courseId = courseId;
    const s = String(subject || '').trim();
    if (s) body.subject = s;
    let topic;
    try {
      topic = normalizeTopic(await messagingApi.getOrCreateTopicForContext(body));
    } catch (e) {
      if (import.meta?.env?.DEV) console.debug('[topics] for-context error:', e?.message || e);
      return null;
    }
    if (!topic?.id) return null;
    setTopics((prev) => (prev.some((t) => t.id === topic.id) ? prev : [topic, ...prev]));
    await openTopic(topic);
    return topic;
  }, [userId, openTopic]);

  const sendTopicMessage = useCallback(async (content) => {
    const topicId = activeTopic?.id;
    const c = String(content || '').trim();
    if (!topicId || !c) return false;
    let row;
    try {
      row = await messagingApi.sendTopicMessage(topicId, c);
    } catch (e) {
      console.error('[topics] send error:', e?.message || e);
      return false;
    }
    // Affichage optimiste : ajoute le message rendu (l'API renvoie la ligne créée).
    if (row?.id && activeTopicIdRef.current === topicId) {
      const m = normalizeRow(row);
      setTopicMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort(byCreatedAtAsc)));
    } else {
      const rows = await fetchTopicMessages(topicId);
      if (rows !== null && activeTopicIdRef.current === topicId) setTopicMessages(rows);
    }
    return true;
  }, [activeTopic?.id, fetchTopicMessages]);

  /** Clôt ou rouvre le sujet ouvert. `next` = 'closed' | 'open'. */
  const setActiveTopicStatus = useCallback(async (next) => {
    const topicId = activeTopic?.id;
    if (!topicId) return false;
    const wantClosed = next === 'closed';
    // Optimiste local (sujet ouvert + liste).
    setActiveTopic((prev) => (prev && prev.id === topicId ? { ...prev, status: wantClosed ? 'closed' : 'open' } : prev));
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, status: wantClosed ? 'closed' : 'open' } : t)));
    try {
      const fresh = wantClosed ? await messagingApi.closeTopic(topicId) : await messagingApi.reopenTopic(topicId);
      const nf = normalizeTopic(fresh);
      if (nf && activeTopicIdRef.current === nf.id) setActiveTopic((prev) => ({ ...prev, ...nf }));
      if (nf) setTopics((prev) => prev.map((t) => (t.id === nf.id ? { ...t, ...nf } : t)));
      return true;
    } catch (e) {
      console.error('[topics] status error:', e?.message || e);
      // Revert optimiste en cas d'échec.
      setActiveTopic((prev) => (prev && prev.id === topicId ? { ...prev, status: wantClosed ? 'open' : 'closed' } : prev));
      setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, status: wantClosed ? 'open' : 'closed' } : t)));
      return false;
    }
  }, [activeTopic?.id]);

  return {
    topics,
    topicsLoading,
    activeTopic,
    topicMessages,
    topicMessagesLoading,
    loadTopics,
    openTopic,
    closeActiveTopicView,
    createTopic,
    getOrCreateContextTopic,
    sendTopicMessage,
    setActiveTopicStatus,
  };
}
