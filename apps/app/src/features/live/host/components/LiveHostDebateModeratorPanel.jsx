import React from 'react';
import { LH_SIDEBAR_CARD } from '@/features/live/host/liveHostTheme';
import { DEBATE_STATUS_LABELS } from '@/features/live/host/liveDebateUi';

const PHASES = [
  { v: 'live', l: 'Match' },
  { v: 'interactive_exchange', l: 'Échange' },
  { v: 'audience_questions', l: 'Q&R' },
  { v: 'round_break', l: 'Pause' },
  { v: 'finished', l: 'Terminé' },
];

const SIDES = [
  ['A', '#d4a36a', 'rgba(200,148,62,.5)', 'rgba(200,148,62,.15)'],
  ['B', '#d4a36a', 'rgba(200,148,62,.5)', 'rgba(200,148,62,.15)'],
  [null, 'rgba(255,255,255,.5)', 'rgba(255,255,255,.2)', 'rgba(255,255,255,.06)'],
];

/**
 * Panneau « ⚔ PILOTAGE DÉBAT » — modération côté hôte uniquement (status, NeuronQ,
 * Juge IA, parole A/B, round, vote, rapport IA). Visible quand `debateArena` est
 * présent et que l'utilisateur n'est pas en mode invité.
 */
export const LiveHostDebateModeratorPanel = ({
  debateArena,
  isGuestUi,
  debateModBusy,
  debatePatch,
  debateAiWeightPctDisplay,
  onDebateAiWeightRangeChange,
  debateCurrentRoundStatus,
  debateOpenVoting,
  debateCloseVoting,
  debateLiveVoteCounts,
  debateAiJudgeBusy,
  debateRunAiJudge,
  debateAiReportPreview,
}) => {
  if (!debateArena || isGuestUi) return null;
  const currentRound = Math.min(
    Number(debateArena.arenaCurrentRound) || 1,
    Number(debateArena.roundCount) || 1,
  );
  return (
    <div
      className="lh-premium-card"
      style={{
        ...LH_SIDEBAR_CARD,
        border: '1px solid rgba(244,63,94,.3)',
        background:
          'radial-gradient(120% 95% at 12% -10%, rgba(244,63,94,.11), transparent 54%), linear-gradient(160deg, rgba(40,16,26,.72), rgba(18,13,21,.9))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#fda4af', letterSpacing: '.1em' }}>
          ⚔ PILOTAGE DÉBAT
        </span>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,.35)' }}>
          {DEBATE_STATUS_LABELS[debateArena.status] || debateArena.status || '—'}
        </span>
      </div>

      {/* Phase */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '7px' }}>
        {PHASES.map((ph) => {
          const active = debateArena.status === ph.v;
          return (
            <button
              key={ph.v}
              disabled={debateModBusy || active}
              onClick={() => debatePatch({ status: ph.v })}
              style={{
                borderRadius: '3px',
                border: `1px solid ${active ? 'rgba(244,63,94,.5)' : 'rgba(255,255,255,.1)'}`,
                background: active ? 'rgba(244,63,94,.2)' : 'rgba(255,255,255,.04)',
                padding: '3px 7px',
                fontSize: '9px',
                color: active ? '#fda4af' : 'rgba(255,255,255,.45)',
                cursor: 'pointer',
                fontWeight: active ? 700 : 400,
              }}
            >
              {ph.l}
            </button>
          );
        })}
      </div>

      {/* NeuronQ */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '7px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,.4)', flexShrink: 0 }}>NeuronQ:</span>
        <button
          type="button"
          disabled={debateModBusy || debateArena.neuronqEnabled !== false}
          onClick={() => debatePatch({ neuronq_enabled: true })}
          style={{
            borderRadius: '3px',
            border: `1px solid ${debateArena.neuronqEnabled !== false ? 'rgba(200,148,62,.45)' : 'rgba(255,255,255,.1)'}`,
            background: debateArena.neuronqEnabled !== false ? 'rgba(200,148,62,.18)' : 'rgba(255,255,255,.04)',
            padding: '3px 8px',
            fontSize: '9px',
            fontWeight: debateArena.neuronqEnabled !== false ? 700 : 400,
            color: debateArena.neuronqEnabled !== false ? '#d4a36a' : 'rgba(255,255,255,.45)',
            cursor: debateModBusy || debateArena.neuronqEnabled !== false ? 'default' : 'pointer',
            opacity: debateModBusy ? 0.55 : 1,
          }}
        >
          Activé
        </button>
        <button
          type="button"
          disabled={debateModBusy || debateArena.neuronqEnabled === false}
          onClick={() => debatePatch({ neuronq_enabled: false })}
          style={{
            borderRadius: '3px',
            border: `1px solid ${debateArena.neuronqEnabled === false ? 'rgba(248,113,113,.4)' : 'rgba(255,255,255,.1)'}`,
            background: debateArena.neuronqEnabled === false ? 'rgba(248,113,113,.12)' : 'rgba(255,255,255,.04)',
            padding: '3px 8px',
            fontSize: '9px',
            fontWeight: debateArena.neuronqEnabled === false ? 700 : 400,
            color: debateArena.neuronqEnabled === false ? '#fca5a5' : 'rgba(255,255,255,.45)',
            cursor: debateModBusy || debateArena.neuronqEnabled === false ? 'default' : 'pointer',
            opacity: debateModBusy ? 0.55 : 1,
          }}
        >
          Désactivé
        </button>
      </div>

      {/* Juge IA — toggle */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '7px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,.4)', flexShrink: 0 }}>Juge IA:</span>
        <button
          type="button"
          disabled={debateModBusy || debateArena.aiJudgeEnabled === true}
          onClick={() => debatePatch({ ai_judge_enabled: true })}
          style={{
            borderRadius: '3px',
            border: `1px solid ${debateArena.aiJudgeEnabled ? 'rgba(245,158,11,.5)' : 'rgba(255,255,255,.1)'}`,
            background: debateArena.aiJudgeEnabled ? 'rgba(245,158,11,.16)' : 'rgba(255,255,255,.04)',
            padding: '3px 8px',
            fontSize: '9px',
            fontWeight: debateArena.aiJudgeEnabled ? 700 : 400,
            color: debateArena.aiJudgeEnabled ? '#fcd34d' : 'rgba(255,255,255,.45)',
            cursor: debateModBusy || debateArena.aiJudgeEnabled === true ? 'default' : 'pointer',
            opacity: debateModBusy ? 0.55 : 1,
          }}
        >
          Activé
        </button>
        <button
          type="button"
          disabled={debateModBusy || debateArena.aiJudgeEnabled === false}
          onClick={() => debatePatch({ ai_judge_enabled: false })}
          style={{
            borderRadius: '3px',
            border: `1px solid ${!debateArena.aiJudgeEnabled ? 'rgba(248,113,113,.4)' : 'rgba(255,255,255,.1)'}`,
            background: !debateArena.aiJudgeEnabled ? 'rgba(248,113,113,.12)' : 'rgba(255,255,255,.04)',
            padding: '3px 8px',
            fontSize: '9px',
            fontWeight: !debateArena.aiJudgeEnabled ? 700 : 400,
            color: !debateArena.aiJudgeEnabled ? '#fca5a5' : 'rgba(255,255,255,.45)',
            cursor: debateModBusy || debateArena.aiJudgeEnabled === false ? 'default' : 'pointer',
            opacity: debateModBusy ? 0.55 : 1,
          }}
        >
          Désactivé
        </button>
      </div>

      {debateArena.aiJudgeEnabled ? (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,.4)', flexShrink: 0 }}>Poids IA (composite)</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#fcd34d', fontVariantNumeric: 'tabular-nums' }}>
              {debateAiWeightPctDisplay}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            disabled={debateModBusy}
            value={debateAiWeightPctDisplay}
            onChange={onDebateAiWeightRangeChange}
            aria-label="Pondération du score IA dans le composite"
            style={{
              width: '100%',
              accentColor: '#f59e0b',
              opacity: debateModBusy ? 0.45 : 1,
              cursor: debateModBusy ? 'default' : 'pointer',
            }}
          />
          <p style={{ fontSize: '8px', color: 'rgba(255,255,255,.28)', margin: '5px 0 0', lineHeight: 1.4 }}>
            Part du score IA vs voix cumulées sur les rounds terminés (bandeau composite).
          </p>
        </div>
      ) : null}

      {/* Parole A / — / B */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '7px', alignItems: 'center' }}>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,.4)', flexShrink: 0 }}>Parole:</span>
        {SIDES.map(([side, col, borderAct, bgAct]) => {
          const active = debateArena.arenaActiveSide === side;
          return (
            <button
              key={String(side)}
              disabled={debateModBusy}
              onClick={() => debatePatch({ arena_active_side: side })}
              style={{
                flex: 1,
                borderRadius: '3px',
                border: `1px solid ${active ? borderAct : 'rgba(255,255,255,.07)'}`,
                background: active ? bgAct : 'rgba(255,255,255,.03)',
                padding: '4px 0',
                fontSize: '10px',
                fontWeight: 700,
                color: active ? col : 'rgba(255,255,255,.3)',
                cursor: 'pointer',
              }}
            >
              {side ?? '—'}
            </button>
          );
        })}
      </div>

      {/* Round navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '7px' }}>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,.4)', flexShrink: 0 }}>Round:</span>
        <button
          disabled={debateModBusy || (Number(debateArena.arenaCurrentRound) || 1) <= 1}
          onClick={() =>
            debatePatch({
              arena_current_round: Math.max(1, (Number(debateArena.arenaCurrentRound) || 1) - 1),
            })
          }
          style={{
            borderRadius: '3px',
            border: '1px solid rgba(255,255,255,.1)',
            background: 'rgba(255,255,255,.04)',
            padding: '2px 8px',
            color: 'rgba(255,255,255,.5)',
            fontSize: '13px',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ‹
        </button>
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: '12px',
            fontWeight: 700,
            color: '#fff',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {currentRound} / {debateArena.roundCount}
        </span>
        <button
          disabled={
            debateModBusy ||
            (Number(debateArena.arenaCurrentRound) || 1) >= (Number(debateArena.roundCount) || 1)
          }
          onClick={() =>
            debatePatch({
              arena_current_round: Math.min(
                Number(debateArena.roundCount) || 1,
                (Number(debateArena.arenaCurrentRound) || 1) + 1,
              ),
            })
          }
          style={{
            borderRadius: '3px',
            border: '1px solid rgba(255,255,255,.1)',
            background: 'rgba(255,255,255,.04)',
            padding: '2px 8px',
            color: 'rgba(255,255,255,.5)',
            fontSize: '13px',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ›
        </button>
      </div>

      {/* Vote controls */}
      {debateCurrentRoundStatus !== 'voting' ? (
        <button
          disabled={debateModBusy}
          onClick={debateOpenVoting}
          style={{
            width: '100%',
            borderRadius: '3px',
            border: '1px solid rgba(212,163,106,.3)',
            background: 'rgba(168,118,58,.1)',
            padding: '5px 0',
            fontSize: '10px',
            fontWeight: 700,
            color: '#e3c79a',
            cursor: 'pointer',
          }}
        >
          Ouvrir le vote
        </button>
      ) : (
        <button
          disabled={debateModBusy}
          onClick={debateCloseVoting}
          style={{
            width: '100%',
            borderRadius: '3px',
            border: '1px solid rgba(200,148,62,.3)',
            background: 'rgba(200,148,62,.1)',
            padding: '5px 0',
            fontSize: '10px',
            fontWeight: 700,
            color: '#d4a36a',
            cursor: 'pointer',
          }}
        >
          Clôturer le vote · A {debateLiveVoteCounts.a} · B {debateLiveVoteCounts.b}
        </button>
      )}

      {/* Juge IA — run */}
      {debateArena?.aiJudgeEnabled ? (
        <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: '7px', marginTop: '4px' }}>
          <button
            disabled={debateModBusy || debateAiJudgeBusy}
            onClick={debateRunAiJudge}
            style={{
              width: '100%',
              borderRadius: '3px',
              border: '1px solid rgba(245,158,11,.35)',
              background: 'rgba(245,158,11,.1)',
              padding: '5px 0',
              fontSize: '10px',
              fontWeight: 700,
              color: '#fbbf24',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              opacity: debateModBusy || debateAiJudgeBusy ? 0.4 : 1,
            }}
          >
            ✦ {debateAiJudgeBusy ? 'Analyse IA…' : `Juge IA — round ${currentRound}`}
          </button>
          {debateAiReportPreview?.summary ? (
            <div
              style={{
                marginTop: '6px',
                padding: '7px 8px',
                background: 'rgba(255,255,255,.04)',
                borderRadius: '3px',
                border: '1px solid rgba(255,255,255,.1)',
              }}
            >
              <p style={{ fontSize: '9px', color: '#fbbf24', margin: '0 0 3px', fontWeight: 700 }}>
                IA · A {Number(debateAiReportPreview.score_a).toFixed(1)} / B {Number(debateAiReportPreview.score_b).toFixed(1)}
              </p>
              <p
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,.55)',
                  margin: 0,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {debateAiReportPreview.summary}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default LiveHostDebateModeratorPanel;
