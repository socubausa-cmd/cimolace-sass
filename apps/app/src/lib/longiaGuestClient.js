import { invokeSupabaseFunction } from '@/lib/supabaseEdgeInvoke';

export function defaultGuestStudentState(userId) {
  return {
    student_id: userId ? String(userId) : 'guest',
    level: 'intermediate',
    mode: 'assisted',
    confusion_score: 0,
    engagement_score: 0,
    preferred_explanation_style: 'simple',
    current_topic: null,
    last_help_request_at: null,
  };
}

export function guestNotesStorageKey(sessionId) {
  return `liri-longia-guest-notes-${sessionId}`;
}

export function loadGuestNotes(sessionId) {
  if (!sessionId || typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem(guestNotesStorageKey(sessionId)) || '');
  } catch {
    return '';
  }
}

export function saveGuestNotes(sessionId, text) {
  if (!sessionId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(guestNotesStorageKey(sessionId), text);
  } catch {
    /* ignore */
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} body
 */
export async function invokeLongiaGuestLive(supabase, body) {
  const timeoutMs = Number(body?.timeoutMs) > 0 ? Number(body.timeoutMs) : 70000;
  const payload = body && typeof body === 'object' ? { ...body } : {};
  delete payload.timeoutMs;
  const timeoutPromise = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error('Timeout LONGIA: la génération prend trop de temps.'));
    }, timeoutMs);
  });
  return Promise.race([
    invokeSupabaseFunction(supabase, 'longia-guest-live', { body: payload }),
    timeoutPromise,
  ]);
}
