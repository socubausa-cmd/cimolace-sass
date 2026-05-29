import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';
import { syncDebateRoundsWithArenaPartial } from '@/features/live/host/liveHostPersistence';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Pilotage DebateCore en live : état arène, patchs débat, votes temps réel,
 * poids juge IA (debounce), ouverture / clôture vote, juge IA manuel.
 */
export function useLiveHostDebateArena({ phase, sessionId, toast }) {
  const [debateArena, setDebateArena] = useState(null);
  const [debateModBusy, setDebateModBusy] = useState(false);
  const debateNeuronqEnabled = useMemo(
    () => !debateArena || debateArena.neuronqEnabled !== false,
    [debateArena],
  );
  const [debateLiveVoteCounts, setDebateLiveVoteCounts] = useState({ a: 0, b: 0, tie: 0, total: 0 });
  const [debateAiWeightLocalPct, setDebateAiWeightLocalPct] = useState(null);
  const [debateAiJudgeBusy, setDebateAiJudgeBusy] = useState(false);
  const [debateAiReportPreview, setDebateAiReportPreview] = useState(null);

  const debateArenaRef = useRef(null);
  const debateAiWeightPatchDebounceRef = useRef(null);
  const debateAiJudgeBusyRef = useRef(false);

  useEffect(() => {
    debateArenaRef.current = debateArena;
  }, [debateArena]);

  useEffect(() => {
    if (phase !== PHASE.LIVE || !debateArena?.debateId) return;
    void supabase
      .from('debates')
      .update({ status: 'live' })
      .eq('id', debateArena.debateId)
      .in('status', ['draft', 'awaiting_debaters', 'preparing', 'ready_to_start']);
  }, [phase, debateArena?.debateId]);

  const refreshDebateRounds = useCallback(async (debateId) => {
    if (!debateId) return;
    const { data: rws } = await supabase
      .from('debate_rounds')
      .select(
        'id,round_number,status,score_a,score_b,ai_score_a,ai_score_b,active_side,round_label,brief_public',
      )
      .eq('debate_id', debateId)
      .order('round_number', { ascending: true });
    if (!rws?.length) return;
    setDebateArena((prev) => {
      if (!prev || prev.debateId !== debateId) return prev;
      return {
        ...prev,
        rounds: rws,
        scoreA: rws.reduce((s, x) => s + (Number(x.score_a) || 0), 0),
        scoreB: rws.reduce((s, x) => s + (Number(x.score_b) || 0), 0),
      };
    });
  }, []);

  const debatePatch = useCallback(
    async (partial) => {
      const id = debateArenaRef.current?.debateId;
      if (!id) return;
      const prev = debateArenaRef.current ? { ...debateArenaRef.current } : null;
      setDebateModBusy(true);
      const { data, error } = await supabase
        .from('debates')
        .update(partial)
        .eq('id', id)
        .select(
          'arena_current_round,arena_active_side,arena_turn_deadline,status,neuronq_enabled,ai_judge_enabled,ai_weight,title,round_count',
        )
        .single();
      if (error) {
        setDebateModBusy(false);
        console.warn('[LiveHost] debate patch:', error.message);
        toast({
          title: 'Pilotage débat',
          description: error.message || 'Mise à jour impossible.',
          variant: 'destructive',
        });
        return;
      }
      if (data) {
        setDebateArena((p) =>
          p
            ? {
                ...p,
                arenaCurrentRound: data.arena_current_round ?? p.arenaCurrentRound,
                arenaActiveSide: Object.prototype.hasOwnProperty.call(data, 'arena_active_side')
                  ? data.arena_active_side
                  : p.arenaActiveSide,
                arenaTurnDeadline: Object.prototype.hasOwnProperty.call(data, 'arena_turn_deadline')
                  ? data.arena_turn_deadline
                  : p.arenaTurnDeadline,
                status: data.status ?? p.status,
                neuronqEnabled: Object.prototype.hasOwnProperty.call(data, 'neuronq_enabled')
                  ? data.neuronq_enabled !== false
                  : p.neuronqEnabled,
                aiJudgeEnabled: Object.prototype.hasOwnProperty.call(data, 'ai_judge_enabled')
                  ? Boolean(data.ai_judge_enabled)
                  : p.aiJudgeEnabled,
                aiWeight:
                  data.ai_weight != null && data.ai_weight !== '' ? Number(data.ai_weight) : p.aiWeight,
                title: data.title != null && String(data.title).trim() ? String(data.title) : p.title,
                roundCount: data.round_count != null ? data.round_count : p.roundCount,
              }
            : null,
        );
      }
      const shouldSync =
        prev &&
        (Object.prototype.hasOwnProperty.call(partial, 'arena_current_round') ||
          Object.prototype.hasOwnProperty.call(partial, 'arena_active_side'));
      if (shouldSync) {
        await syncDebateRoundsWithArenaPartial(supabase, prev, partial);
        await refreshDebateRounds(id);
      }
      setDebateModBusy(false);
    },
    [refreshDebateRounds, toast],
  );

  const debateAiWeightPctDisplay = useMemo(() => {
    if (debateAiWeightLocalPct != null) return debateAiWeightLocalPct;
    const w = Number(debateArena?.aiWeight);
    return Math.min(
      100,
      Math.max(0, Math.round((Number.isFinite(w) && !Number.isNaN(w) ? w : 0.3) * 100)),
    );
  }, [debateAiWeightLocalPct, debateArena?.aiWeight]);

  const scheduleDebateAiWeightPatch = useCallback(
    (pct) => {
      if (debateAiWeightPatchDebounceRef.current) clearTimeout(debateAiWeightPatchDebounceRef.current);
      debateAiWeightPatchDebounceRef.current = setTimeout(() => {
        debateAiWeightPatchDebounceRef.current = null;
        const v = Math.min(1, Math.max(0, pct / 100));
        void debatePatch({ ai_weight: v });
      }, 400);
    },
    [debatePatch],
  );

  const onDebateAiWeightRangeChange = useCallback(
    (e) => {
      const pct = Math.min(100, Math.max(0, Number(e.target.value)));
      if (!Number.isFinite(pct)) return;
      setDebateAiWeightLocalPct(pct);
      scheduleDebateAiWeightPatch(pct);
    },
    [scheduleDebateAiWeightPatch],
  );

  useEffect(() => {
    setDebateAiWeightLocalPct(null);
  }, [debateArena?.debateId]);

  useEffect(() => {
    setDebateAiWeightLocalPct(null);
  }, [debateArena?.aiWeight]);

  useEffect(() => {
    if (!debateArena?.aiJudgeEnabled) setDebateAiWeightLocalPct(null);
  }, [debateArena?.aiJudgeEnabled]);

  useEffect(
    () => () => {
      if (debateAiWeightPatchDebounceRef.current) {
        clearTimeout(debateAiWeightPatchDebounceRef.current);
        debateAiWeightPatchDebounceRef.current = null;
      }
    },
    [],
  );

  const debateOpenVoting = useCallback(async () => {
    const ctx = debateArenaRef.current;
    if (!ctx?.debateId) return;
    const r = Math.min(
      Math.max(1, Number(ctx.arenaCurrentRound) || 1),
      Math.max(1, Number(ctx.roundCount) || 1),
    );
    setDebateModBusy(true);
    await supabase
      .from('debate_rounds')
      .update({ status: 'voting' })
      .eq('debate_id', ctx.debateId)
      .eq('round_number', r);
    setDebateModBusy(false);
    await refreshDebateRounds(ctx.debateId);
  }, [refreshDebateRounds]);

  const debateCloseVoting = useCallback(async () => {
    const ctx = debateArenaRef.current;
    if (!ctx?.debateId) return;
    const r = Math.min(
      Math.max(1, Number(ctx.arenaCurrentRound) || 1),
      Math.max(1, Number(ctx.roundCount) || 1),
    );
    setDebateModBusy(true);
    const { data: votes } = await supabase
      .from('debate_votes')
      .select('selected_side')
      .eq('debate_id', ctx.debateId)
      .eq('round_number', r);
    const list = votes || [];
    const a = list.filter((v) => v.selected_side === 'A').length;
    const b = list.filter((v) => v.selected_side === 'B').length;
    await supabase
      .from('debate_rounds')
      .update({
        score_a: a,
        score_b: b,
        winner_side: a > b ? 'A' : b > a ? 'B' : 'tie',
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('debate_id', ctx.debateId)
      .eq('round_number', r);
    setDebateModBusy(false);
    await refreshDebateRounds(ctx.debateId);
    if (ctx.aiJudgeEnabled && sessionId) {
      const debateId = ctx.debateId;
      void (async () => {
        try {
          const { data: payload, error: invErr } = await supabase.functions.invoke('debate-ai-judge-round', {
            body: { debateId, roundNumber: r, liveSessionId: sessionId },
          });
          if (invErr) {
            console.warn('[LiveHost] debate-ai-judge:', await getSupabaseFunctionErrorMessage(invErr));
            return;
          }
          if (payload?.error) {
            console.warn('[LiveHost] debate-ai-judge:', String(payload.error));
            return;
          }
          await refreshDebateRounds(debateId);
        } catch (e) {
          console.warn('[LiveHost] debate-ai-judge:', e?.message || e);
        }
      })();
    }
  }, [refreshDebateRounds, sessionId]);

  const debateCurrentRoundStatus = useMemo(() => {
    if (!debateArena?.rounds?.length) return null;
    const r = Math.min(
      Math.max(1, Number(debateArena.arenaCurrentRound) || 1),
      Math.max(1, Number(debateArena.roundCount) || 1),
    );
    return debateArena.rounds.find((x) => x.round_number === r)?.status ?? null;
  }, [debateArena]);

  useEffect(() => {
    const id = debateArena?.debateId;
    if (!id || phase !== PHASE.LIVE) return;
    const r = Math.min(
      Math.max(1, Number(debateArena.arenaCurrentRound) || 1),
      Math.max(1, Number(debateArena.roundCount) || 1),
    );
    const voting = debateCurrentRoundStatus === 'voting';

    const reloadVotes = async () => {
      const { data: list } = await supabase
        .from('debate_votes')
        .select('selected_side')
        .eq('debate_id', id)
        .eq('round_number', r);
      if (!list) return;
      const a = list.filter((v) => v.selected_side === 'A').length;
      const b = list.filter((v) => v.selected_side === 'B').length;
      const tie = list.filter((v) => v.selected_side === 'tie').length;
      setDebateLiveVoteCounts({ a, b, tie, total: list.length });
    };

    if (!voting) {
      setDebateLiveVoteCounts({ a: 0, b: 0, tie: 0, total: 0 });
    } else {
      reloadVotes();
    }

    const ch = supabase.channel(`debate-host-${id}`);
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'debates', filter: `id=eq.${id}` },
      (payload) => {
        const n = payload.new;
        if (!n) return;
        setDebateArena((prev) => {
          if (!prev || prev.debateId !== id) return prev;
          const next = { ...prev };
          if (n.arena_current_round != null) next.arenaCurrentRound = n.arena_current_round;
          if (Object.prototype.hasOwnProperty.call(n, 'arena_active_side')) {
            next.arenaActiveSide = n.arena_active_side;
          }
          if (Object.prototype.hasOwnProperty.call(n, 'arena_turn_deadline')) {
            next.arenaTurnDeadline = n.arena_turn_deadline;
          }
          if (n.status) next.status = n.status;
          if (Object.prototype.hasOwnProperty.call(n, 'neuronq_enabled')) {
            next.neuronqEnabled = n.neuronq_enabled !== false;
          }
          if (Object.prototype.hasOwnProperty.call(n, 'ai_judge_enabled')) {
            next.aiJudgeEnabled = Boolean(n.ai_judge_enabled);
          }
          if (
            Object.prototype.hasOwnProperty.call(n, 'ai_weight') &&
            n.ai_weight != null &&
            n.ai_weight !== ''
          ) {
            const w = Number(n.ai_weight);
            if (!Number.isNaN(w)) next.aiWeight = w;
          }
          if (n.title != null && String(n.title).trim()) next.title = String(n.title);
          if (n.round_count != null) next.roundCount = n.round_count;
          return next;
        });
      },
    );
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'debate_rounds', filter: `debate_id=eq.${id}` },
      () => {
        void refreshDebateRounds(id);
      },
    );
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'debate_rounds', filter: `debate_id=eq.${id}` },
      (payload) => {
        const rw = payload.new;
        setDebateArena((prev) => {
          if (!prev || prev.debateId !== id) return prev;
          const hasRow = prev.rounds?.some((x) => x.round_number === rw.round_number);
          const rounds = hasRow
            ? prev.rounds.map((x) => (x.round_number === rw.round_number ? { ...x, ...rw } : x))
            : [...(prev.rounds || []), rw].sort((a, b) => (a.round_number || 0) - (b.round_number || 0));
          return {
            ...prev,
            rounds,
            scoreA: rounds.reduce((s, x) => s + (Number(x.score_a) || 0), 0),
            scoreB: rounds.reduce((s, x) => s + (Number(x.score_b) || 0), 0),
          };
        });
      },
    );
    if (voting) {
      ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debate_votes', filter: `debate_id=eq.${id}` },
        (payload) => {
          const nr = payload.new?.round_number ?? payload.old?.round_number;
          if (nr === r) reloadVotes();
        },
      );
    }
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'debate_ai_reports', filter: `debate_id=eq.${id}` },
      () => {
        void refreshDebateRounds(id);
      },
    );
    ch.subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [
    phase,
    debateArena?.debateId,
    debateArena?.arenaCurrentRound,
    debateArena?.roundCount,
    debateCurrentRoundStatus,
    refreshDebateRounds,
  ]);

  const debateRunAiJudge = useCallback(async () => {
    const ctx = debateArenaRef.current;
    if (!ctx?.debateId || !sessionId || debateAiJudgeBusyRef.current) return;
    debateAiJudgeBusyRef.current = true;
    setDebateAiJudgeBusy(true);
    try {
      const r = Math.min(
        Math.max(1, Number(ctx.arenaCurrentRound) || 1),
        Math.max(1, Number(ctx.roundCount) || 1),
      );
      const { data: payload, error: invErr } = await supabase.functions.invoke('debate-ai-judge-round', {
        body: { debateId: ctx.debateId, roundNumber: r, liveSessionId: sessionId },
      });
      if (invErr) throw new Error(await getSupabaseFunctionErrorMessage(invErr));
      if (payload?.error) throw new Error(String(payload.error));
      if (payload?.report) {
        setDebateAiReportPreview({
          summary: payload.report.summary,
          score_a: payload.report.score_a,
          score_b: payload.report.score_b,
          created_at: payload.report.created_at,
        });
      }
      await refreshDebateRounds(ctx.debateId);
    } catch (e) {
      console.warn('[DebateAI]', e?.message || e);
    } finally {
      debateAiJudgeBusyRef.current = false;
      setDebateAiJudgeBusy(false);
    }
  }, [sessionId, refreshDebateRounds]);

  return {
    debateArena,
    setDebateArena,
    debateModBusy,
    debateNeuronqEnabled,
    debateLiveVoteCounts,
    debateAiJudgeBusy,
    debateAiReportPreview,
    refreshDebateRounds,
    debatePatch,
    debateAiWeightPctDisplay,
    onDebateAiWeightRangeChange,
    debateOpenVoting,
    debateCloseVoting,
    debateCurrentRoundStatus,
    debateRunAiJudge,
  };
}
