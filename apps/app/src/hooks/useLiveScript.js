import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';
import { normalizeLiveScriptSection } from '@/lib/liveScriptSectionNormalize';

/**
 * Master Script — gestion des sections de script pendant le live.
 *
 * - Chargement + Realtime (Postgres Changes)
 * - CRUD : add / update / delete / reorder
 * - Amélioration IA (Edge `liri-script-ai-improve`)
 * - currentSection : section correspondant à l'index de slide courant
 */
export function useLiveScript({ sessionId, currentUser, enabled = false, currentSlideIndex = 0 }) {
  const [sections, setSections]       = useState([]);
  const [improving, setImproving]     = useState(null); // id de la section en cours d'amélioration
  const [loading, setLoading]         = useState(false);

  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // ─── Fetch initial ──────────────────────────────────────────────────────────
  const fetchSections = useCallback(async (sid) => {
    if (!sid) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_script_sections')
        .select('*')
        .eq('session_id', sid)
        .order('order_index', { ascending: true });
      if (error) throw error;
      setSections((data || []).map(normalizeLiveScriptSection));
    } catch (err) {
      if (!String(err?.message || '').includes('does not exist')) {
        console.warn('[script] fetchSections:', err?.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !sessionId) return undefined;

    void fetchSections(sessionId);

    const channel = supabase
      .channel(`live-script-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_script_sections', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSections((prev) => {
              if (prev.find((s) => s.id === payload.new.id)) return prev;
              const row = normalizeLiveScriptSection(payload.new);
              return [...prev, row].sort((a, b) => a.order_index - b.order_index);
            });
          } else if (payload.eventType === 'UPDATE') {
            setSections((prev) => prev.map((s) => (s.id === payload.new.id ? normalizeLiveScriptSection(payload.new) : s)));
          } else if (payload.eventType === 'DELETE') {
            setSections((prev) => prev.filter((s) => s.id !== payload.old?.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel).catch(() => {}); };
  }, [enabled, sessionId, fetchSections]);

  // ─── CRUD ────────────────────────────────────────────────────────────────────
  /** @param {string} content @param {number|null} slideIndex @param {{ title?: string, master_agent?: object } | null} extra */
  const addSection = useCallback(async (content = '', slideIndex = null, extra = null) => {
    const u = currentUserRef.current;
    if (!u?.id || !sessionId) return null;

    const maxOrder = sections.reduce((m, s) => Math.max(m, s.order_index), -1);
    const insert = {
      session_id:  sessionId,
      created_by:  u.id,
      slide_index: slideIndex,
      content:     content.trim() || '(vide)',
      order_index: maxOrder + 1,
    };
    if (extra?.title != null && String(extra.title).trim()) insert.title = String(extra.title).trim().slice(0, 500);
    if (extra?.master_agent != null && typeof extra.master_agent === 'object') insert.master_agent = extra.master_agent;

    const { data, error } = await supabase
      .from('live_script_sections')
      .insert(insert)
      .select()
      .single();
    if (error) { console.warn('[script] addSection:', error.message); return null; }
    return normalizeLiveScriptSection(data);
  }, [sessionId, sections]);

  const updateSection = useCallback(async (id, patch) => {
    const { error } = await supabase
      .from('live_script_sections')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) console.warn('[script] updateSection:', error.message);
  }, []);

  const deleteSection = useCallback(async (id) => {
    const { error } = await supabase
      .from('live_script_sections')
      .delete()
      .eq('id', id);
    if (error) console.warn('[script] deleteSection:', error.message);
  }, []);

  const moveSection = useCallback(async (id, direction) => {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return;

    const a = sections[idx];
    const b = sections[swapIdx];
    await Promise.all([
      supabase.from('live_script_sections').update({ order_index: b.order_index }).eq('id', a.id),
      supabase.from('live_script_sections').update({ order_index: a.order_index }).eq('id', b.id),
    ]);
  }, [sections]);

  // ─── Amélioration IA ────────────────────────────────────────────────────────
  const improveSection = useCallback(async (id, mode = 'improve') => {
    const section = sections.find((s) => s.id === id);
    if (!section) return;

    setImproving(id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) return;

      const { data, error } = await supabase.functions.invoke('liri-script-ai-improve', {
        body: {
          content: section.content,
          slideIndex: section.slide_index,
          mode,
        },
      });
      if (error) throw new Error(await getSupabaseFunctionErrorMessage(error));
      const improvedContent = data?.improvedContent;

      if (improvedContent) {
        await supabase
          .from('live_script_sections')
          .update({ ai_content: improvedContent, updated_at: new Date().toISOString() })
          .eq('id', id);
      }
    } catch (err) {
      console.warn('[script] improveSection:', err?.message);
    } finally {
      setImproving(null);
    }
  }, [sections]);

  // ─── Section courante (slide actuel) ────────────────────────────────────────
  const currentSection = sections.find((s) => s.slide_index === currentSlideIndex)
    || sections.find((s) => s.slide_index == null && sections.indexOf(s) === 0)
    || sections[0]
    || null;

  return {
    sections,
    currentSection,
    loading,
    improving,
    addSection,
    updateSection,
    deleteSection,
    moveSection,
    improveSection,
  };
}

export default useLiveScript;
