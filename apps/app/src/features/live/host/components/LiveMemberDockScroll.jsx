import React from 'react';
import LiveHostMemberPanelCard from '@/components/live-room/LiveHostMemberPanelCard';
import { LIVE_STRIP_DOCK_MIN_MEMBER_SLOTS } from '@/lib/liveCommLayers';

/**
 * Bandeau dock — liste horizontale des cartes membres + emplacements vides + bouton « + »
 * pour ouvrir la fiche du premier membre. Mutualisé entre la version hôte et invité.
 */
export const LiveMemberDockScroll = React.forwardRef(function LiveMemberDockScroll(
  {
    liveStripDockMembers,
    livekitParticipantsMap,
    liveKitMediaEpoch,
    promotedId,
    isGuestUi,
    onMemberClick,
    onPlusClick,
    emptySlotKeyPrefix = 'strip-empty',
    trailingSpacerKey = 'strip-dock-trail-spacer',
  },
  ref,
) {
  const minSlots = LIVE_STRIP_DOCK_MIN_MEMBER_SLOTS;
  const fillCount = Math.max(0, minSlots - liveStripDockMembers.length);
  const hasOverflow = liveStripDockMembers.length >= minSlots;
  return (
    <>
      <div
        ref={ref}
        data-lh-member-dock=""
        style={{
          display: 'flex',
          gap: '7px',
          height: '100%',
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          isolation: 'isolate',
          perspective: '1100px',
          transformStyle: 'preserve-3d',
          scrollbarWidth: 'thin',
        }}
      >
        {liveStripDockMembers.map((m) => {
          const lkParticipant =
            livekitParticipantsMap[m.id] ||
            livekitParticipantsMap[String(m.id)] ||
            livekitParticipantsMap[m.name] ||
            (m.isLocal ? livekitParticipantsMap.local : null);
          const isPromotedCard = String(m.id) === String(promotedId);
          const isHostCard =
            m.isHost === true || (isGuestUi ? m.isLocal === true : false) || (!isGuestUi && m.isLocal === true);
          return (
            <LiveHostMemberPanelCard
              key={m.id}
              data-testid={`live-dock-member-${String(m.id)}`}
              data-dock-item="1"
              member={m}
              liveKitParticipant={lkParticipant}
              mediaEpoch={liveKitMediaEpoch}
              isPromoted={isPromotedCard}
              onClick={() => onMemberClick?.(m)}
              className={
                isHostCard
                  ? 'h-full min-h-0 min-w-[112px] shrink-0'
                  : 'h-full min-h-0 min-w-[78px] shrink-0'
              }
            />
          );
        })}
        {Array.from({ length: fillCount }).map((_, i) => (
          <div
            key={`${emptySlotKeyPrefix}-${i}`}
            data-testid="live-dock-slot-empty"
            data-dock-item="1"
            style={{
              position: 'relative',
              flex: '0 0 76px',
              width: '76px',
              maxWidth: '88px',
              minWidth: '64px',
              height: '100%',
              borderRadius: '4px',
              border: '1px dashed rgba(255,255,255,.12)',
              background: 'rgba(255,255,255,.02)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
            }}
          >
            <span
              style={{
                fontSize: '8px',
                color: 'rgba(255,255,255,.28)',
                textAlign: 'center',
                lineHeight: 1.35,
              }}
            >
              Panel disponible
            </span>
          </div>
        ))}
        {hasOverflow ? (
          <div
            key={trailingSpacerKey}
            aria-hidden
            style={{ flex: 1, minWidth: 0, minHeight: 0, alignSelf: 'stretch' }}
          />
        ) : null}
      </div>
      <button
        onClick={() => liveStripDockMembers[0] && onPlusClick?.(liveStripDockMembers[0])}
        title={liveStripDockMembers[0] ? 'Fiche membre' : 'Aucun membre connecté'}
        style={{
          minWidth: '46px',
          height: '80%',
          borderRadius: '4px',
          border: '1px solid rgba(200,150,12,.35)',
          background: 'rgba(200,150,12,.12)',
          color: '#C8960C',
          fontSize: '20px',
          fontWeight: 700,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: liveStripDockMembers[0] ? 'pointer' : 'default',
          opacity: liveStripDockMembers[0] ? 1 : 0.45,
        }}
      >
        +
      </button>
    </>
  );
});

export default LiveMemberDockScroll;
