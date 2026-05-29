import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';
import { getFreshAccessToken } from '@/lib/authToken';

/**
 * NEURON-Q — Gestion des questions live
 *
 * - Élève : reformulation IA + soumission
 * - Hôte  : lecture temps réel + changement de statut + mode Q&A
 */
export function useLiveQuestions({ sessionId, currentUser, enabled = false }) {
  const [questions, setQuestions] = useState([]);   // toutes les questions de la session
  const [qaMode, setQaMode] = useState(false);       // hôte a activé le mode Q&A
  const [submitting, setSubmitting] = useState(false);
  const [reformulating, setReformulating] = useState(false);

  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // ─── Fetch initial ──────────────────────────────────────────────────────────
  const fetchQuestions = useCallback(async (sid) => {
    if (!sid) return;
    try {
      const { data, error } = await supabase
        .from('live_questions')
        .select('*')
        .eq('session_id', sid)
        .order('asked_at', { ascending: true });
      if (error) throw error;
      setQuestions(data || []);
    } catch (err) {
      if (!String(err?.message || '').includes('does not exist')) {
        console.warn('[neuronq] fetchQuestions:', err?.message);
      }
    }
  }, []);

  // ─── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !sessionId) return undefined;

    void fetchQuestions(sessionId);

    const channel = supabase
      .channel(`live-questions-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_questions', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setQuestions((prev) => {
              if (prev.find((q) => q.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'UPDATE') {
            setQuestions((prev) => prev.map((q) => q.id === payload.new.id ? payload.new : q));
          } else if (payload.eventType === 'DELETE') {
            setQuestions((prev) => prev.filter((q) => q.id !== payload.old?.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [enabled, sessionId, fetchQuestions]);

  // ─── Reformulation via Supabase Edge (neuronq-reformulate) ─────────────────
  const reformulateQuestion = useCallback(async (rawText) => {
    const u = currentUserRef.current;
    if (!rawText?.trim()) return rawText;

    setReformulating(true);
    try {
      const token = await getFreshAccessToken();
      if (!token) return `${u?.name || 'Un élève'} souhaite comprendre : ${rawText}`;

      const { data, error } = await supabase.functions.invoke('neuronq-reformulate', {
        body: {
          rawText: String(rawText).trim(),
          userName: u?.name || u?.full_name || 'Un élève',
          sessionId,
        },
      });

      if (error) throw new Error(await getSupabaseFunctionErrorMessage(error));
      return data?.reformulatedText ?? data?.reformulated ?? rawText;
    } catch (err) {
      console.warn('[neuronq] reformulate error:', err?.message);
      return `${currentUserRef.current?.name || 'Un élève'} souhaite comprendre : ${rawText}`;
    } finally {
      setReformulating(false);
    }
  }, [sessionId]);

  // ─── Soumettre une question ─────────────────────────────────────────────────
  const submitQuestion = useCallback(async (rawText, reformulatedText) => {
    const u = currentUserRef.current;
    if (!u?.id || !sessionId || !rawText?.trim()) return false;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('live_questions').insert({
        session_id:        sessionId,
        user_id:           u.id,
        user_name:         u.name || u.full_name || 'Élève',
        raw_text:          rawText.trim(),
        reformulated_text: reformulatedText || rawText.trim(),
        status:            'pending',
      });
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[neuronq] submitQuestion:', err?.message);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [sessionId]);

  // ─── Changer le statut (hôte) ───────────────────────────────────────────────
  const markAnswered = useCallback(async (questionId) => {
    const { error } = await supabase
      .from('live_questions')
      .update({ status: 'answered' })
      .eq('id', questionId);
    if (error) console.warn('[neuronq] markAnswered:', error.message);
  }, []);

  const markSkipped = useCallback(async (questionId) => {
    const { error } = await supabase
      .from('live_questions')
      .update({ status: 'skipped' })
      .eq('id', questionId);
    if (error) console.warn('[neuronq] markSkipped:', error.message);
  }, []);

  const pendingCount = questions.filter((q) => q.status === 'pending').length;

  return {
    questions,
    pendingCount,
    qaMode,
    setQaMode,
    submitting,
    reformulating,
    reformulateQuestion,
    submitQuestion,
    markAnswered,
    markSkipped,
  };
}

export default useLiveQuestions;
