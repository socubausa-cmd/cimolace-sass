import { useEffect, useMemo, useState } from 'react';

import { computeDebateBlendedTotals, DEBATE_STATUS_LABELS, formatCountdownSeconds } from '@/features/live/host/liveDebateUi';

export function DebateModeBanner({ debate, liveVoteCounts }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!debate?.arenaTurnDeadline) return;

    const id = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(id);
  }, [debate?.arenaTurnDeadline]);

  const remainSec = useMemo(() => {
    if (!debate?.arenaTurnDeadline) return null;
    const end = new Date(debate.arenaTurnDeadline).getTime();
    if (Number.isNaN(end)) return null;
    return Math.max(0, Math.ceil((end - now) / 1000));
  }, [debate?.arenaTurnDeadline, now]);

  const blended = useMemo(
    () =>
      debate?.aiJudgeEnabled
        ? computeDebateBlendedTotals(debate?.rounds, debate?.aiWeight)
        : null,
    [debate?.aiJudgeEnabled, debate?.aiWeight, debate?.rounds],
  );

  const phaseHint = useMemo(() => {
    const st = debate?.status;
    if (!st || st === 'live') return null;
    const nq = debate?.neuronqEnabled !== false;
    if (st === 'audience_questions') {
      return nq
        ? 'File de questions : utilisez le formulaire NeuronQ ci-dessous — le formateur voit la file dans son interface.'
        : 'Phase Q&R public — chat live disponible ; NeuronQ est désactivé pour ce débat.';
    }
    if (st === 'interactive_exchange') {
      return 'Échange libre — parole et chrono pilotés par le modérateur (panneau débat hôte).';
    }
    if (st === 'round_break') {
      return 'Pause — reprendre avec Pilotage débat → Phase → Match.';
    }
    if (st === 'finished') {
      return 'Débat clôturé — vous pouvez quitter la salle.';
    }
    return null;
  }, [debate?.status, debate?.neuronqEnabled]);

  if (!debate) return null;

  const roleLabel =
    debate.myRole === 'moderator'
      ? 'Modérateur'
      : debate.myRole === 'debater'
        ? `Débatteur · camp ${debate.mySide || '?'}`
        : debate.myRole === 'viewer'
          ? 'Spectateur'
          : null;

  const roundIdx = Math.min(
    Math.max(1, Number(debate.arenaCurrentRound) || 1),
    Math.max(1, Number(debate.roundCount) || 1),
  );
  const floorLabel =
    debate.arenaActiveSide === 'A'
      ? 'Parole · camp A'
      : debate.arenaActiveSide === 'B'
        ? 'Parole · camp B'
        : 'Parole · —';

  const roundRow = debate.rounds?.find((x) => x.round_number === roundIdx);
  const votingOpen = roundRow?.status === 'voting';
  const roundTitle = roundRow?.round_label?.trim();
  const roundBrief = roundRow?.brief_public?.trim();
  const curIa =
    roundRow?.ai_score_a != null &&
    roundRow?.ai_score_b != null &&
    !Number.isNaN(Number(roundRow.ai_score_a)) &&
    !Number.isNaN(Number(roundRow.ai_score_b))
      ? { a: Number(roundRow.ai_score_a), b: Number(roundRow.ai_score_b) }
      : null;

  return (
    <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', zIndex: 52, pointerEvents: 'none', maxWidth: 'min(94%,780px)', width: '100%' }}>
      <div style={{ borderRadius: '12px', border: '1px solid rgba(244,63,94,.35)', background: 'rgba(26,15,20,.92)', backdropFilter: 'blur(16px)', padding: '8px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '6px 12px', textAlign: 'center' }}>
        <span style={{ fontSize: '10px', letterSpacing: '.2em', color: '#fda4af', fontWeight: 700 }}>⚔ DEBATECORE</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,.9)' }}>{debate.title}</span>
        {debate.status && debate.status !== 'live' && (
          <span style={{ fontSize: '9px', color: '#e3c79a', border: '1px solid rgba(200,148,62,.3)', borderRadius: '12px', padding: '1px 8px' }}>{DEBATE_STATUS_LABELS[debate.status] || debate.status}</span>
        )}
        <span style={{ fontSize: '11px', color: '#bae6fd', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          Round {roundIdx}/{debate.roundCount}
          {roundTitle ? ` · ${roundTitle}` : ''} · {floorLabel}
        </span>
        {remainSec != null && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: remainSec <= 10 ? '#fbbf24' : 'rgba(255,255,255,.8)', fontVariantNumeric: 'tabular-nums' }}>{formatCountdownSeconds(remainSec)}</span>
        )}
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.45)', fontVariantNumeric: 'tabular-nums' }}>
          Voix cumulées A {debate.scoreA} · B {debate.scoreB}
        </span>
        {curIa ? (
          <span style={{ fontSize: '11px', color: 'rgba(253,230,138,.85)', fontVariantNumeric: 'tabular-nums' }}>
            IA round {roundIdx} · A {curIa.a.toFixed(1)} · B {curIa.b.toFixed(1)} (0–10)
          </span>
        ) : null}
        {blended ? (
          <span style={{ fontSize: '11px', color: 'rgba(208,187,167,.85)', fontVariantNumeric: 'tabular-nums', width: '100%' }}>
            Composite ({Math.round(blended.w * 100)}% IA, rounds terminés {blended.count}) · A {blended.sumA.toFixed(1)} · B {blended.sumB.toFixed(1)}
          </span>
        ) : null}
        {votingOpen && liveVoteCounts ? (
          <span style={{ fontSize: '11px', color: 'rgba(253,224,196,.9)', fontVariantNumeric: 'tabular-nums' }}>
            Votes · A {liveVoteCounts.a} · = {liveVoteCounts.tie} · B {liveVoteCounts.b}
            {liveVoteCounts.total > 0 ? ` (${liveVoteCounts.total})` : ''}
          </span>
        ) : null}
        {roleLabel ? (
          <span style={{ fontSize: '10px', color: 'rgba(253,230,138,.85)', border: '1px solid rgba(245,158,11,.25)', borderRadius: '999px', padding: '1px 8px' }}>{roleLabel}</span>
        ) : null}
        {debate.myRole === 'viewer' ? (
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)', width: '100%' }}>Caméra désactivée pour le public</span>
        ) : null}
        {roundBrief ? (
          <p style={{ width: '100%', margin: 0, fontSize: '10px', color: 'rgba(255,255,255,.5)', lineHeight: 1.45, padding: '0 4px' }}>{roundBrief}</p>
        ) : null}
        {phaseHint ? (
          <p style={{ width: '100%', margin: 0, marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,.1)', fontSize: '10px', color: 'rgba(252,188,125,.75)', lineHeight: 1.45 }}>
            {phaseHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
