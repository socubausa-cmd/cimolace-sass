import React from 'react';
import LiveWhiteboardToolsSidebar from '@/components/live-room/LiveWhiteboardToolsSidebar';
import { LH_SIDEBAR_CARD } from '@/features/live/host/liveHostTheme';
import { LiveMindmapCard } from '@/features/live/host/components/LiveMindmapCard';

/**
 * Emplacement partagé du rail droit : outils tableau blanc (scène Crayon
 * côté hôte) ou carte mindmap des étapes selon le contexte.
 */
export const LiveHostMindmapOrWhiteboardSlot = ({
  isGuestUi,
  hostBoardRightRailTools,
  hostWbToolsRailStrokes,
  hostWhiteboardPagingForRail,
  mmCardVisible,
  setMmCardVisible,
  mmView,
  setMmView,
  step,
  stepCount,
  activeEtapes,
  gotoStep,
}) => {
  return (
    <div
      style={{
        flex: !isGuestUi && hostBoardRightRailTools ? 1 : undefined,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {hostBoardRightRailTools ? (
        <div
          className="lh-sp-keep lh-premium-card"
          style={{
            ...LH_SIDEBAR_CARD,
            border: '1px solid rgba(255,255,255,.08)',
            background: '#12111a',
            overflow: 'hidden',
            flex: !isGuestUi ? 1 : undefined,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2"
            style={{ scrollbarWidth: 'thin' }}
          >
            <LiveWhiteboardToolsSidebar
              hideNeuroInk
              whiteboardStrokes={hostWbToolsRailStrokes}
              whiteboardPaging={hostWhiteboardPagingForRail}
            />
          </div>
        </div>
      ) : (
        <LiveMindmapCard
          mmCardVisible={mmCardVisible}
          setMmCardVisible={setMmCardVisible}
          mmView={mmView}
          setMmView={setMmView}
          step={step}
          stepCount={stepCount}
          activeEtapes={activeEtapes}
          isGuestUi={isGuestUi}
          gotoStep={gotoStep}
        />
      )}
    </div>
  );
};

export default LiveHostMindmapOrWhiteboardSlot;
