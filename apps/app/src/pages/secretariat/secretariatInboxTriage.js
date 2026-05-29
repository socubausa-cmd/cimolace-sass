import { format, isToday, isWithinInterval, addHours, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

/** Priorité numérique (plus haut = plus urgent pour le centre de tri). */
export const PRIORITY = {
  RDV_IMMINENT: 100,
  MAIL_UNREAD: 88,
  CONTACT_NEW: 82,
  CHAT_UNREAD: 78,
  DEMANDE_RDV: 72,
  APPEL_ATTENTE: 66,
  RDV_FUTUR: 52,
  APPEL_TRAITE: 28,
};

/**
 * Construit la liste unifiée « Tous » (centre de tri).
 * @param {object} p
 */
export function buildTriageItems({
  contactRequests = [],
  chatUnreadMessages = [],
  mailUnreadRows = [],
  mailThreadsById = {},
  appointmentRequests = [],
  appointments = [],
  appels = [],
}) {
  const items = [];
  const now = new Date();

  for (const m of chatUnreadMessages) {
    items.push({
      key: `chat:${m.id}`,
      kind: 'chat_unread',
      priority: PRIORITY.CHAT_UNREAD,
      title: m._sender_name || 'Conversation',
      subtitle: (m.content || '').slice(0, 120) || 'Nouveau message',
      date: m.created_at,
      badge: 'Chat',
      accent: 'chat',
      raw: m,
    });
  }

  for (const row of mailUnreadRows) {
    const th = row.thread_id ? mailThreadsById[row.thread_id] : null;
    items.push({
      key: `mail:${row.id}`,
      kind: 'mail_unread',
      priority: PRIORITY.MAIL_UNREAD,
      title: row.from_name || row.from_email || 'Expéditeur',
      subtitle: row.subject || th?.subject || row.snippet || 'Sans sujet',
      date: row.received_at,
      badge: 'Courrier',
      accent: 'mail',
      raw: { ...row, _thread: th },
    });
  }

  for (const c of contactRequests) {
    const isNew = String(c.status || '').toLowerCase() === 'new';
    items.push({
      key: `contact:${c.id}`,
      kind: 'contact_form',
      priority: isNew ? PRIORITY.CONTACT_NEW : 40,
      title: c.name || c.email || 'Formulaire',
      subtitle: c.subject || (c.message || '').slice(0, 100) || 'Demande site',
      date: c.created_at,
      badge: 'Site',
      accent: 'contact',
      raw: c,
    });
  }

  for (const d of appointmentRequests) {
    items.push({
      key: `req:${d.id}`,
      kind: 'demande_rdv',
      priority: PRIORITY.DEMANDE_RDV,
      title: d._student_name || d.visitor_name || 'Demande RDV',
      subtitle: d.subject || d.reason || d.description || '—',
      date: d.created_at,
      badge: 'À confirmer',
      accent: 'demande',
      raw: d,
    });
  }

  for (const a of appels) {
    const urgent = String(a.status || '') === 'en_attente';
    items.push({
      key: `call:${a.id}`,
      kind: 'appel',
      priority: urgent ? PRIORITY.APPEL_ATTENTE : PRIORITY.APPEL_TRAITE,
      title: a.from,
      subtitle: a.phone,
      date: a.time,
      badge: 'Appel',
      accent: 'appel',
      raw: a,
    });
  }

  for (const ap of appointments) {
    const t = ap.scheduled_at ? new Date(ap.scheduled_at) : null;
    const imminent =
      t && isWithinInterval(t, { start: now, end: addHours(now, 48) }) && ap.status !== 'cancelled';
    const p = imminent ? PRIORITY.RDV_IMMINENT : PRIORITY.RDV_FUTUR;
    items.push({
      key: `appt:${ap.id}`,
      kind: 'rdv_prevu',
      priority: p,
      title: ap.title || 'Rendez-vous',
      subtitle: ap.scheduled_at
        ? format(new Date(ap.scheduled_at), "EEEE d MMM yyyy 'à' HH:mm", { locale: fr })
        : '—',
      date: ap.scheduled_at,
      badge: imminent ? 'Imminent' : 'Agenda',
      accent: 'rdv',
      raw: ap,
    });
  }

  items.sort((a, b) => {
    const pd = (b.priority || 0) - (a.priority || 0);
    if (pd !== 0) return pd;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return items;
}

/**
 * @param {string} filterId - 'all' | 'unread' | 'urgent' | 'today' | 'mine'
 */
export function filterTriageItems(items, filterId, { userId, mySecretaryId } = {}) {
  if (filterId === 'all') return items;

  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  return items.filter((it) => {
    if (filterId === 'unread') {
      if (it.kind === 'chat_unread' || it.kind === 'mail_unread') return true;
      if (it.kind === 'contact_form') return String(it.raw?.status || '').toLowerCase() === 'new';
      return false;
    }
    if (filterId === 'urgent') {
      return (it.priority || 0) >= 70 || it.badge === 'Imminent';
    }
    if (filterId === 'today') {
      const d = it.date ? new Date(it.date) : null;
      if (!d) return false;
      return isToday(d) || (d >= dayStart && d <= dayEnd);
    }
    if (filterId === 'mine') {
      if (!userId) return false;
      if (it.kind === 'mail_unread') {
        const au = it.raw?._thread?.assigned_user_id;
        return au === userId;
      }
      if (it.kind === 'demande_rdv') {
        const sec = it.raw?.secretary_id;
        return mySecretaryId && sec === mySecretaryId;
      }
      return false;
    }
    return true;
  });
}
