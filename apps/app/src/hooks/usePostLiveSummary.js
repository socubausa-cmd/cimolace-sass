import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';

/**
 * Post-live Summary — Phase 5 LIRI.
 *
 * Gère :
 * - Le tracking des temps par slide pendant le live (via slideTrackingRef)
 * - La génération du résumé post-session via la fonction Netlify
 * - La récupération d'un résumé déjà généré
 */
export function usePostLiveSummary() {
  const [summary, setSummary]     = useState(null);   // { aiSummary, keyPoints, ...stats }
  const [generating, setGenerating] = useState(false);
  const [error, setError]           = useState(null);

  // ─── Tracking temps par slide ─────────────────────────────────────────────
  // Format: { slideIndex: number, enteredAt: timestamp }[]
  const slideEventsRef = useRef([]);
  const slideTrackingActiveRef = useRef(false);

  /**
   * Appeler quand le live démarre.
   * Remet à zéro le tracking et enregistre le premier slide.
   */
  const startTracking = useCallback((initialSlideIndex = 0) => {
    slideEventsRef.current = [{ slideIndex: initialSlideIndex, enteredAt: Date.now() }];
    slideTrackingActiveRef.current = true;
  }, []);

  /**
   * Appeler à chaque changement de slide pendant le live.
   */
  const trackSlideChange = useCallback((newSlideIndex) => {
    if (!slideTrackingActiveRef.current) return;
    slideEventsRef.current = [
      ...slideEventsRef.current,
      { slideIndex: newSlideIndex, enteredAt: Date.now() },
    ];
  }, []);

  /**
   * Appeler quand le live s'arrête.
   * Calcule les durées par slide et retourne le tableau slidesCovered.
   */
  const stopTrackingAndCompute = useCallback((slides = []) => {
    slideTrackingActiveRef.current = false;
    const events = slideEventsRef.current;
    if (events.length === 0) return [];

    const now = Date.now();
    // Ajouter un event "fin" pour clore la dernière section
    const allEvents = [...events, { slideIndex: -1, enteredAt: now }];

    // Calculer la durée passée sur chaque slide
    const durationMap = {}; // slideIndex → totalMs
    for (let i = 0; i < allEvents.length - 1; i++) {
      const { slideIndex, enteredAt } = allEvents[i];
      const nextEnteredAt = allEvents[i + 1].enteredAt;
      if (slideIndex < 0) continue;
      durationMap[slideIndex] = (durationMap[slideIndex] || 0) + (nextEnteredAt - enteredAt);
    }

    return Object.entries(durationMap).map(([idx, ms]) => ({
      index:      Number(idx),
      title:      slides[Number(idx)]?.title || slides[Number(idx)]?.name || null,
      duration_s: Math.round(ms / 1000),
    })).sort((a, b) => a.index - b.index);
  }, []);

  // ─── Générer le résumé ────────────────────────────────────────────────────
  const generate = useCallback(async ({
    sessionId,
    participantName,
    durationSeconds,
    slides = [],
    questions = [],
    scriptSections = [],
  }) => {
    if (!sessionId) return;
    setGenerating(true);
    setError(null);
    setSummary(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Non authentifié');

      const slidesCovered = stopTrackingAndCompute(slides);
      const questionsTotal    = questions.length;
      const questionsAnswered = questions.filter((q) => q.status === 'answered').length;
      const questionsSkipped  = questions.filter((q) => q.status === 'skipped').length;

      const { data: out, error: invErr } = await supabase.functions.invoke('liri-summary-generate', {
        body: {
          sessionId,
          participantName,
          durationSeconds,
          slidesCovered,
          questionsTotal,
          questionsAnswered,
          questionsSkipped,
          scriptSectionsTotal: scriptSections.length,
          questions: questions.slice(0, 10).map((q) => ({
            reformulated_text: q.reformulated_text,
            raw_text:          q.raw_text,
            status:            q.status,
          })),
        },
      });
      if (invErr) throw new Error(await getSupabaseFunctionErrorMessage(invErr));
      if (out?.error) throw new Error(String(out.error));
      const { aiSummary, keyPoints } = out || {};

      setSummary({
        aiSummary,
        keyPoints,
        slidesCovered,
        questionsTotal,
        questionsAnswered,
        questionsSkipped,
        scriptSectionsTotal: scriptSections.length,
        durationSeconds,
        participantName,
      });
    } catch (err) {
      console.warn('[summary] generate:', err?.message);
      setError(err?.message || 'Erreur de génération');
    } finally {
      setGenerating(false);
    }
  }, [stopTrackingAndCompute]);

  // ─── Récupérer un résumé existant ─────────────────────────────────────────
  const fetchExisting = useCallback(async (sessionId) => {
    if (!sessionId) return null;
    const { data } = await supabase
      .from('live_session_summaries')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (data) {
      setSummary({
        aiSummary:           data.ai_summary,
        keyPoints:           data.key_points || [],
        slidesCovered:       data.slides_covered || [],
        questionsTotal:      data.questions_total,
        questionsAnswered:   data.questions_answered,
        questionsSkipped:    data.questions_skipped,
        scriptSectionsTotal: data.script_sections_total,
        durationSeconds:     data.duration_seconds,
        participantName:     data.participant_name,
      });
    }
    return data;
  }, []);

  const reset = useCallback(() => {
    setSummary(null);
    setError(null);
    slideEventsRef.current = [];
  }, []);

  return {
    summary,
    generating,
    error,
    generate,
    fetchExisting,
    reset,
    startTracking,
    trackSlideChange,
    stopTrackingAndCompute,
  };
}

export default usePostLiveSummary;
