import React from 'react';
import { LH_SIDEBAR_CARD } from '@/features/live/host/liveHostTheme';

/**
 * Carte « MASTERSCRIPT » du rail droit (hôte uniquement, hors mode tableau blanc).
 * Bascule entre vue Guide (tag, intention/NeuronQ, body, transition) et vue
 * Mot-à-mot (texte tapé prêt à lire).
 */
export const LiveHostMasterScriptDock = ({
  isGuestUi,
  hostBoardRightRailTools,
  msMode,
  setMsMode,
  curEtape,
  nqAnalysis,
  msBody,
  msTyped,
}) => {
  if (isGuestUi || hostBoardRightRailTools) return null;
  return (
    <div
      className="lh-sp-keep lh-premium-card lh-masterscript-dock"
      style={{
        ...LH_SIDEBAR_CARD,
        flex: 1,
        minHeight: 140,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,.08)',
        background: 'rgba(255,255,255,.02)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: 'rgba(168,118,58,.14)',
              border: '1px solid rgba(212,163,106,.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#e3c79a" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', letterSpacing: '.07em' }}>
            MASTERSCRIPT
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '3px',
            background: 'rgba(0,0,0,.3)',
            borderRadius: '4px',
            padding: '2px',
          }}
        >
          <button
            className={`lh-tbtn lh-premium-btn${msMode === 'guide' ? ' on' : ''}`}
            style={{ padding: '3px 8px', fontSize: '9px', borderRadius: '8px' }}
            onClick={() => setMsMode('guide')}
          >
            Guide
          </button>
          <button
            className={`lh-tbtn lh-premium-btn${msMode === 'script' ? ' on' : ''}`}
            style={{ padding: '3px 8px', fontSize: '9px', borderRadius: '8px' }}
            onClick={() => setMsMode('script')}
          >
            Mot a mot
          </button>
        </div>
      </div>
      {msMode === 'guide' ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 0 }}>
          <span
            style={{
              fontSize: '9px',
              background: 'rgba(255,255,255,.04)',
              color: 'rgba(200,150,12,.9)',
              border: '1px solid rgba(255,255,255,.08)',
              padding: '1px 7px',
              borderRadius: '3px',
              display: 'inline-block',
              marginBottom: '7px',
              flexShrink: 0,
            }}
          >
            {curEtape.tag}
          </span>
          <div
            style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,.6)',
              fontStyle: 'italic',
              marginBottom: '7px',
              padding: '6px 8px',
              background: 'rgba(255,255,255,.02)',
              border: '1px solid rgba(255,255,255,.06)',
              borderRadius: '6px',
              lineHeight: '1.6',
              flexShrink: 0,
            }}
          >
            {nqAnalysis ? (
              <>
                <span style={{ color: '#c8943e', fontWeight: 700 }}>NeuronQ: </span>
                {nqAnalysis}
              </>
            ) : (
              curEtape.intent
            )}
          </div>
          <div
            className="lh-sy min-h-0 flex-1 overflow-y-auto"
            style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,.78)',
              lineHeight: '1.75',
              scrollbarWidth: 'thin',
            }}
          >
            {msBody}
          </div>
          <div
            style={{
              marginTop: '7px',
              fontSize: '10px',
              color: 'rgba(200,150,12,.7)',
              fontStyle: 'italic',
              paddingTop: '6px',
              borderTop: '1px solid rgba(255,255,255,.06)',
              flexShrink: 0,
            }}
          >
            → {curEtape.trans}
          </div>
        </div>
      ) : (
        <div
          className="lh-sy min-h-0 flex-1 overflow-y-auto"
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,.92)',
            lineHeight: 2,
            fontStyle: 'italic',
            padding: '10px',
            background: 'rgba(0,0,0,.25)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: '4px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,.2) transparent',
          }}
        >
          {msTyped}
        </div>
      )}
    </div>
  );
};

export default LiveHostMasterScriptDock;
