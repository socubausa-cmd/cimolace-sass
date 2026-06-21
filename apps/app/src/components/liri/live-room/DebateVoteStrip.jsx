/**
 * Bandeau de vote audience (débat) — round en statut `voting`.
 * Ex-live Arena, réutilisable sur Live Host.
 */
import { supabase } from '@/lib/customSupabaseClient';

export default function DebateVoteStrip({
  debate,
  userId,
  isHost,
  voteBusy,
  setVoteBusy,
  onAfterVote,
  liveVoteCounts,
  /** Vue mobile / fenêtre étroite : remonte le bandeau au-dessus de la zone home / safe area. */
  compact = false,
}) {
  if (!debate || !userId || isHost) return null;
  if (debate.myRole === 'moderator') return null;
  const r = Math.min(
    Math.max(1, Number(debate.arenaCurrentRound) || 1),
    Math.max(1, Number(debate.roundCount) || 1),
  );
  const row = debate.rounds?.find((x) => x.round_number === r);
  if (row?.status !== 'voting') return null;

  const submit = async (side) => {
    if (voteBusy) return;
    setVoteBusy(true);
    const { error } = await supabase.from('debate_votes').upsert(
      {
        debate_id: debate.debateId,
        round_number: r,
        voter_id: userId,
        selected_side: side,
      },
      { onConflict: 'debate_id,round_number,voter_id' },
    );
    setVoteBusy(false);
    if (error) {
      console.warn('[DebateVote]', error.message);
      return;
    }
    onAfterVote?.();
  };

  return (
    <div
      className={`fixed left-1/2 z-[58] w-[min(92vw,420px)] -translate-x-1/2 pointer-events-auto ${
        compact ? 'bottom-[max(5.25rem,env(safe-area-inset-bottom,0px))]' : 'bottom-32'
      }`}
    >
      <div className="rounded-2xl border border-amber-500/35 bg-[#14101c]/95 backdrop-blur-xl px-4 py-3 shadow-xl">
        <p className="text-center text-[11px] text-white/55 mb-2">
          Vote round {r} — qui a été le plus convaincant ?
        </p>
        <div className="flex justify-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={voteBusy}
            onClick={() => void submit('A')}
            className="h-10 px-5 rounded-xl bg-rose-600/75 hover:bg-rose-600 text-sm font-medium disabled:opacity-40"
          >
            Camp A
          </button>
          <button
            type="button"
            disabled={voteBusy}
            onClick={() => void submit('tie')}
            className="h-10 px-4 rounded-xl border border-white/20 text-sm text-white/80 hover:bg-white/5 disabled:opacity-40"
          >
            Égalité
          </button>
          <button
            type="button"
            disabled={voteBusy}
            onClick={() => void submit('B')}
            className="h-10 px-5 rounded-xl bg-amber-600/75 hover:bg-amber-600 text-sm font-medium disabled:opacity-40"
          >
            Camp B
          </button>
        </div>
        {liveVoteCounts && liveVoteCounts.total > 0 ? (
          <p className="text-center text-[10px] text-white/40 mt-2 tabular-nums">
            {liveVoteCounts.total} vote{liveVoteCounts.total > 1 ? 's' : ''} · A {liveVoteCounts.a} · = {liveVoteCounts.tie} · B{' '}
            {liveVoteCounts.b}
          </p>
        ) : null}
      </div>
    </div>
  );
}
