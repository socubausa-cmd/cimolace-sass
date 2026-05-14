export const DEBATE_STATUS_LABELS = {
  draft: 'Brouillon',
  awaiting_debaters: 'Attente débatteurs',
  preparing: 'Préparation',
  ready_to_start: 'Prêt',
  live: 'Match',
  interactive_exchange: 'Échange libre',
  audience_questions: 'Q&R public',
  round_break: 'Pause',
  finished: 'Terminé',
  archived: 'Archivé',
};

export function formatCountdownSeconds(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Points composites sur rounds terminés : voix normalisées 0-10 + pondération IA si scores IA présents. */
export function computeDebateBlendedTotals(rounds, aiWeight) {
  const w = Math.min(1, Math.max(0, Number(aiWeight) || 0));
  if (!rounds?.length) return null;

  let sumA = 0;
  let sumB = 0;
  let count = 0;

  for (const row of rounds) {
    if (row.status !== 'completed') continue;

    const ha = Number(row.score_a) || 0;
    const hb = Number(row.score_b) || 0;
    const tot = ha + hb;
    const normA = tot > 0 ? (10 * ha) / tot : 5;
    const normB = tot > 0 ? (10 * hb) / tot : 5;
    const ia = row.ai_score_a != null && row.ai_score_a !== '' ? Number(row.ai_score_a) : null;
    const ib = row.ai_score_b != null && row.ai_score_b !== '' ? Number(row.ai_score_b) : null;

    if (ia != null && !Number.isNaN(ia) && ib != null && !Number.isNaN(ib)) {
      sumA += (1 - w) * normA + w * ia;
      sumB += (1 - w) * normB + w * ib;
    } else {
      sumA += normA;
      sumB += normB;
    }
    count += 1;
  }

  if (!count) return null;
  return { sumA, sumB, count, w };
}
