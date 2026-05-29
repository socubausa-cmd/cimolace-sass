import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * File NeuronQ hôte (`live_neuronq_questions`) : fetch initial, realtime INSERT/UPDATE,
 * reset si NeuronQ désactivé côté débat. Le callback `onQuestionInsert` permet au parent
 * (journal LONGIA, chime) sans coupler le hook à `setPanels`.
 */
export function useLiveHostNeuronqQuestions({
  sessionId,
  phase,
  debateNeuronqEnabled,
  onQuestionInsert,
}) {
  const [neuronqQuestions, setNeuronqQuestions] = useState([]);

  useEffect(() => {
    if (!debateNeuronqEnabled) {
      setNeuronqQuestions([]);
    }
  }, [debateNeuronqEnabled]);

  useEffect(() => {
    if (!debateNeuronqEnabled || !sessionId || phase !== PHASE.LIVE) return;

    supabase
      .from('live_neuronq_questions')
      .select('id, raw_text, reformulated_text, status, user_id, created_at')
      .eq('live_session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) return;
        if (data?.length) setNeuronqQuestions(data);
        else setNeuronqQuestions([]);
      });

    const ch = supabase
      .channel(`neuronq-host-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_neuronq_questions',
          filter: `live_session_id=eq.${sessionId}`,
        },
        (payload) => {
          setNeuronqQuestions((prev) => [...prev, payload.new]);
          onQuestionInsert?.(payload.new);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_neuronq_questions',
          filter: `live_session_id=eq.${sessionId}`,
        },
        (payload) => {
          setNeuronqQuestions((prev) =>
            prev.map((q) => (q.id === payload.new.id ? { ...q, ...payload.new } : q)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, phase, debateNeuronqEnabled, onQuestionInsert]);

  const markNeuronqAnswered = useCallback(async (id) => {
    await supabase.from('live_neuronq_questions').update({ status: 'answered' }).eq('id', id);
  }, []);

  const markNeuronqSkipped = useCallback(async (id) => {
    await supabase.from('live_neuronq_questions').update({ status: 'skipped' }).eq('id', id);
  }, []);

  return { neuronqQuestions, markNeuronqAnswered, markNeuronqSkipped };
}
