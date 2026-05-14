import { PHASE } from '@/features/live/host/liveHostConstants';

export function LiveStageFloatingOverlays({
  phase,
  isGuestUi,
  longiaHubOpen,
  longiaSignalSubDrawer,
  floatingReactions,
  onOpenLongiaCoach,
}) {
  const coachActive = longiaHubOpen && longiaSignalSubDrawer === 'host_coach';

  return (
    <>
      {phase === PHASE.LIVE && !isGuestUi ? (
        <button
          type="button"
          onClick={onOpenLongiaCoach}
          title="IA — coach formateur (chat, saisie, rendus). Signaux : panneau gauche « Signaux »."
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            zIndex: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderRadius: 999,
            border: `1px solid ${coachActive ? 'rgba(251,191,36,.55)' : 'rgba(255,255,255,.14)'}`,
            background: coachActive ? 'rgba(120,53,15,.35)' : 'rgba(8,8,12,.82)',
            backdropFilter: 'blur(10px)',
            padding: '8px 14px',
            cursor: 'pointer',
            pointerEvents: 'auto',
            boxShadow: '0 10px 32px rgba(0,0,0,.5)',
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(145deg, rgba(251,191,36,.95), rgba(109,40,217,.88))',
              border: '1px solid rgba(255,255,255,.2)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: coachActive ? '#fde68a' : 'rgba(255,255,255,.88)',
              whiteSpace: 'nowrap',
            }}
          >
            IA
          </span>
        </button>
      ) : null}

      {floatingReactions.map((reaction) => (
        <span key={reaction.id} className="lh-reaction" style={{ left: `${reaction.x}%` }}>
          {reaction.emoji}
        </span>
      ))}
    </>
  );
}
