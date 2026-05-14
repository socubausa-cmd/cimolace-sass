export async function registerLiveSessionParticipant(supabase, sessionId, userId, teacherId, isHostPath = false) {
  if (!sessionId || !userId) return;

  const now = new Date().toISOString();
  const role = isHostPath || (teacherId != null && String(userId) === String(teacherId)) ? 'host' : 'student';
  const { error } = await supabase
    .from('live_session_participants')
    .upsert(
      {
        live_session_id: sessionId,
        user_id: userId,
        role,
        joined_at: now,
        left_at: null,
      },
      { onConflict: 'live_session_id,user_id' },
    );

  if (error) {
    try {
      console.warn('[LiveHost] registerLiveSessionParticipant', error.message);
    } catch {
      /* ignore */
    }
  }
}

export async function syncDebateRoundsWithArenaPartial(supabase, prev, partial) {
  if (!prev?.debateId) return;

  const id = prev.debateId;
  const oldR = Math.min(50, Math.max(1, Number(prev.arenaCurrentRound) || 1));
  const newR = Object.prototype.hasOwnProperty.call(partial, 'arena_current_round')
    ? Math.min(50, Math.max(1, Number(partial.arena_current_round) || 1))
    : oldR;
  const newS = Object.prototype.hasOwnProperty.call(partial, 'arena_active_side')
    ? partial.arena_active_side
    : prev.arenaActiveSide;
  const iso = new Date().toISOString();

  if (Object.prototype.hasOwnProperty.call(partial, 'arena_current_round') && newR !== oldR) {
    if (newR > oldR) {
      await supabase
        .from('debate_rounds')
        .update({ status: 'completed', ended_at: iso })
        .eq('debate_id', id)
        .eq('round_number', oldR);
    }
    await supabase
      .from('debate_rounds')
      .update({ active_side: newS, status: newS ? 'active' : 'pending', started_at: iso })
      .eq('debate_id', id)
      .eq('round_number', newR);
  } else if (Object.prototype.hasOwnProperty.call(partial, 'arena_active_side')) {
    await supabase
      .from('debate_rounds')
      .update({ active_side: newS, status: newS ? 'active' : 'pending' })
      .eq('debate_id', id)
      .eq('round_number', newR);
  }
}
