import React from 'react';
import { PHASE } from '@/features/live/host/liveHostConstants';

export const LiveDebateVoteOverlay = ({ phase, debateArena, debateLiveVoteCounts }) => {
  if (phase !== PHASE.LIVE || !debateArena) return null;
  const r = Math.min(
    Math.max(1, Number(debateArena.arenaCurrentRound) || 1),
    Math.max(1, Number(debateArena.roundCount) || 1),
  );
  const row = debateArena.rounds?.find((x) => x.round_number === r);
  if (row?.status !== 'voting') return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '7rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 58,
        pointerEvents: 'auto',
        width: 'min(92vw,420px)',
      }}
    >
      <div
        style={{
          borderRadius: '16px',
          border: '1px solid rgba(212,163,106,.35)',
          background: 'rgba(28,24,20,.95)',
          backdropFilter: 'blur(20px)',
          padding: '12px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,.55)',
        }}
      >
        <p style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,.55)', margin: '0 0 8px' }}>
          Vote round {r} — résultats en temps réel
        </p>
        <p
          style={{
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 700,
            color: 'rgba(255,255,255,.85)',
            fontVariantNumeric: 'tabular-nums',
            margin: 0,
          }}
        >
          A&nbsp;<span style={{ color: '#f87171' }}>{debateLiveVoteCounts.a}</span>
          &nbsp;·&nbsp;=&nbsp;<span style={{ color: 'rgba(255,255,255,.5)' }}>{debateLiveVoteCounts.tie}</span>
          &nbsp;·&nbsp;B&nbsp;<span style={{ color: '#d4a36a' }}>{debateLiveVoteCounts.b}</span>
          {debateLiveVoteCounts.total > 0 && (
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,.3)', marginLeft: '6px' }}>
              {debateLiveVoteCounts.total} voix
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

export default LiveDebateVoteOverlay;
