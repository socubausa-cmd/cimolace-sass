/**
 * useGuestNotes
 * -------------
 * Cahier de notes personnel d'un élève dans une session live LIRI.
 *
 * Caractéristiques :
 *   - Persistance Supabase (table live_session_guest_notes)
 *   - Une seule ligne par (session_id, user_id) — upsert automatique
 *   - Autosave debounced (1500ms après dernière frappe)
 *   - Entrées structurées timestampées + références scène Smartboard
 *   - Pièces jointes (captures Smartboard) stockées en références d'URL
 *   - Partage explicite avec le prof (shared_with_teacher)
 *
 * Shape d'une entrée :
 *   {
 *     id:            string,          // uuid v4
 *     text_md:       string,          // markdown léger
 *     created_at:    string,          // ISO timestamp
 *     scene_ref?:    { scene_id, scene_label, page? },
 *     attachments?:  [{ kind:'smartboard_capture', url, thumb_url? }]
 *   }
 *
 * Usage :
 *   const {
 *     notes, entries, loading, saving, error,
 *     addEntry, updateEntry, deleteEntry,
 *     updateRaw, shareWithTeacher, exportMarkdown,
 *   } = useGuestNotes(sessionId, { enabled: isGuestUi, currentSceneRef });
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const AUTOSAVE_MS = 1500;

/** Petit uuid v4 local (suffit pour identifier les entrées côté client). */
function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback RFC4122 v4 simplifié
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function sanitizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = typeof entry.id === 'string' && entry.id ? entry.id : uuid();
  const text_md = typeof entry.text_md === 'string' ? entry.text_md : '';
  const created_at = typeof entry.created_at === 'string' ? entry.created_at : new Date().toISOString();
  const scene_ref = entry.scene_ref && typeof entry.scene_ref === 'object' ? {
    scene_id: String(entry.scene_ref.scene_id ?? ''),
    scene_label: String(entry.scene_ref.scene_label ?? ''),
    page: Number.isFinite(entry.scene_ref.page) ? entry.scene_ref.page : undefined,
  } : undefined;
  const attachments = Array.isArray(entry.attachments) ? entry.attachments
    .filter((a) => a && typeof a === 'object' && typeof a.url === 'string')
    .slice(0, 20)
    .map((a) => ({
      kind: a.kind === 'smartboard_capture' ? 'smartboard_capture' : 'generic',
      url: String(a.url),
      thumb_url: typeof a.thumb_url === 'string' ? a.thumb_url : undefined,
    })) : undefined;
  return { id, text_md, created_at, scene_ref, attachments };
}

function entriesToMarkdown(entries, sessionTitle) {
  const header = `# Cahier de notes — ${sessionTitle || 'Cours LIRI'}\n\n`;
  const body = (entries || []).map((e) => {
    const t = new Date(e.created_at);
    const stamp = Number.isFinite(t.getTime())
      ? t.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
    const sceneLine = e.scene_ref?.scene_label
      ? `\n> 📍 Scène : ${e.scene_ref.scene_label}${e.scene_ref.page ? ` · page ${e.scene_ref.page}` : ''}`
      : '';
    const attachLine = Array.isArray(e.attachments) && e.attachments.length
      ? `\n> 📎 ${e.attachments.length} capture${e.attachments.length > 1 ? 's' : ''} Smartboard`
      : '';
    return `### ${stamp}${sceneLine}${attachLine}\n\n${e.text_md || ''}\n`;
  }).join('\n---\n\n');
  return `${header}${body}`;
}

/**
 * @param {string|null|undefined} sessionId
 * @param {object} [opts]
 * @param {boolean} [opts.enabled=true]
 * @param {object} [opts.currentSceneRef] — injecté par LiveHostPage, utilisé
 *                                          pour marquer chaque nouvelle entrée
 * @param {string} [opts.sessionTitle]    — pour l'export markdown
 */
export function useGuestNotes(sessionId, opts = {}) {
  const { enabled = true, currentSceneRef = null, sessionTitle = '' } = opts;
  const { user } = useAuth() || {};
  const userId = user?.id || null;

  const [notes, setNotes] = useState(null); // ligne entière DB
  const [entries, setEntries] = useState([]); // array d'entrées
  const [loading, setLoading] = useState(Boolean(enabled && sessionId && userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef(null);
  const currentSceneRefBox = useRef(currentSceneRef);
  useEffect(() => { currentSceneRefBox.current = currentSceneRef; }, [currentSceneRef]);
  useEffect(() => () => { mountedRef.current = false; if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  /** Fetch ou création de la ligne. */
  const fetchOnce = useCallback(async () => {
    if (!enabled || !sessionId || !userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('live_session_guest_notes')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      if (err) throw err;

      if (data) {
        if (!mountedRef.current) return;
        setNotes(data);
        const rawEntries = Array.isArray(data.entries) ? data.entries : [];
        setEntries(rawEntries.map(sanitizeEntry).filter(Boolean));
        setError(null);
      } else {
        // Création idempotente
        const { data: created, error: insErr } = await supabase
          .from('live_session_guest_notes')
          .insert({ session_id: sessionId, user_id: userId, content_md: '', entries: [] })
          .select('*')
          .maybeSingle();
        if (insErr) throw insErr;
        if (!mountedRef.current) return;
        setNotes(created);
        setEntries([]);
      }
    } catch (e) {
      if (mountedRef.current) setError(e);
      console.warn('[useGuestNotes] fetch/create failed', e?.message || e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, sessionId, userId]);

  useEffect(() => { void fetchOnce(); }, [fetchOnce]);

  /** Autosave debounced — déclenché à chaque modification d'entries. */
  const scheduleSave = useCallback((nextEntries, extraPatch = {}) => {
    if (!enabled || !sessionId || !userId) return;
    dirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      try {
        setSaving(true);
        const last = currentSceneRefBox.current;
        const patch = {
          entries: nextEntries,
          ...(last ? { last_scene_ref: last } : {}),
          ...extraPatch,
        };
        const { error: err } = await supabase
          .from('live_session_guest_notes')
          .update(patch)
          .eq('session_id', sessionId)
          .eq('user_id', userId);
        if (err) throw err;
        dirtyRef.current = false;
      } catch (e) {
        if (mountedRef.current) setError(e);
        console.warn('[useGuestNotes] autosave failed', e?.message || e);
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    }, AUTOSAVE_MS);
  }, [enabled, sessionId, userId]);

  /** Ajouter une entrée (avec texte markdown + optionnel attachments). */
  const addEntry = useCallback((payload = {}) => {
    const entry = sanitizeEntry({
      id: uuid(),
      text_md: typeof payload.text_md === 'string' ? payload.text_md : '',
      created_at: new Date().toISOString(),
      scene_ref: payload.scene_ref ?? currentSceneRefBox.current,
      attachments: payload.attachments,
    });
    setEntries((prev) => {
      const next = [...prev, entry];
      scheduleSave(next);
      return next;
    });
    return entry;
  }, [scheduleSave]);

  /** Éditer une entrée (partial update sur un id). */
  const updateEntry = useCallback((id, patch) => {
    setEntries((prev) => {
      const next = prev.map((e) => (e.id === id ? sanitizeEntry({ ...e, ...patch }) : e));
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  /** Supprimer une entrée. */
  const deleteEntry = useCallback((id) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  /** Update markdown global (zone texte continue optionnelle). */
  const updateRaw = useCallback(async (content_md) => {
    if (!enabled || !sessionId || !userId) return;
    try {
      setSaving(true);
      const { error: err } = await supabase
        .from('live_session_guest_notes')
        .update({ content_md })
        .eq('session_id', sessionId)
        .eq('user_id', userId);
      if (err) throw err;
      setNotes((n) => (n ? { ...n, content_md } : n));
    } catch (e) {
      if (mountedRef.current) setError(e);
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [enabled, sessionId, userId]);

  /** Envoyer au prof (flag shared_with_teacher = 'once' + timestamp). */
  const shareWithTeacher = useCallback(async () => {
    if (!enabled || !sessionId || !userId) return { ok: false, reason: 'disabled' };
    try {
      setSaving(true);
      const { error: err } = await supabase
        .from('live_session_guest_notes')
        .update({ shared_with_teacher: 'once', shared_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('user_id', userId);
      if (err) throw err;
      setNotes((n) => (n ? { ...n, shared_with_teacher: 'once', shared_at: new Date().toISOString() } : n));
      return { ok: true };
    } catch (e) {
      if (mountedRef.current) setError(e);
      return { ok: false, reason: e?.message || 'error' };
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [enabled, sessionId, userId]);

  /** Export markdown texte (prêt pour téléchargement ou conversion PDF). */
  const exportMarkdown = useCallback(() => {
    return entriesToMarkdown(entries, sessionTitle);
  }, [entries, sessionTitle]);

  const isShared = useMemo(() => notes?.shared_with_teacher && notes.shared_with_teacher !== 'never', [notes]);

  return {
    notes,
    entries,
    loading,
    saving,
    error,
    isShared,
    addEntry,
    updateEntry,
    deleteEntry,
    updateRaw,
    shareWithTeacher,
    exportMarkdown,
    refetch: fetchOnce,
  };
}

export default useGuestNotes;
