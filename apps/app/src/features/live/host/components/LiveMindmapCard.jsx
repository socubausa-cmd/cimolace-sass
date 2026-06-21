import React from 'react';
import { TC } from '@/features/live/host/liveSmartboardLegacySlides';
import { LH_SIDEBAR_CARD } from '@/features/live/host/liveHostTheme';
import { LiveRadialMindmap } from '@/features/live/host/components/LiveRadialMindmap';

export const LiveMindmapCard = ({
  mmCardVisible,
  setMmCardVisible,
  mmView,
  setMmView,
  step,
  stepCount,
  activeEtapes,
  isGuestUi,
  gotoStep,
}) => {
  return (
    <>
      {!mmCardVisible && (
        <button
          className="lh-premium-btn"
          onClick={() => setMmCardVisible(true)}
          style={{
            borderRadius: '10px',
            border: '1px solid rgba(212,163,106,.28)',
            background: 'linear-gradient(160deg, rgba(168,118,58,.12), rgba(168,118,58,.04))',
            padding: '8px 12px',
            fontSize: '10px',
            color: 'rgba(253,224,196,.9)',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: 700,
            letterSpacing: '.03em',
            boxShadow: '0 8px 24px rgba(0,0,0,.2)',
          }}
        >
          ⊞ Afficher la mindmap
        </button>
      )}
      {mmCardVisible && (
        <div
          className="lh-sp-keep lh-premium-card"
          style={{
            ...LH_SIDEBAR_CARD,
            border: '1px solid rgba(255,255,255,.08)',
            background: '#1a1815',
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(168,118,58,.14)', border: '1px solid rgba(212,163,106,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#e3c79a" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', letterSpacing: '.07em' }}>MINDMAP</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '9px', color: 'rgba(200,150,12,.8)' }}>
                ETAPE {step + 1}/{stepCount}
              </span>
              <button
                className="lh-premium-btn"
                onClick={() => setMmView((v) => (v === 'list' ? 'radial' : 'list'))}
                style={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', padding: '3px 8px', fontSize: '9px', color: 'rgba(255,255,255,.5)', cursor: 'pointer' }}
              >
                {mmView === 'list' ? '⊢' : '≡'}
              </button>
              <button
                className="lh-premium-btn"
                onClick={() => setMmCardVisible((v) => !v)}
                title="Masquer la mindmap"
                style={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', padding: '3px 8px', fontSize: '9px', color: 'rgba(255,255,255,.35)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          </div>
          {mmView === 'list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0, maxHeight: 'min(42vh, 360px)', overflowY: 'auto', scrollbarWidth: 'thin' }}>
              {activeEtapes.map((e, i) => {
                const active = i === step;
                const c = TC[e.type] || '#888';
                return (
                  <div
                    key={i}
                    onClick={isGuestUi ? undefined : () => gotoStep(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 7px',
                      borderRadius: '4px',
                      cursor: isGuestUi ? 'default' : 'pointer',
                      border: `1px solid ${active ? c : 'rgba(255,255,255,.06)'}`,
                      background: active ? `${c}18` : 'transparent',
                      transition: 'all .12s',
                    }}
                  >
                    <span
                      style={{
                        width: '17px',
                        height: '17px',
                        borderRadius: '50%',
                        background: active ? `${c}33` : 'rgba(255,255,255,.05)',
                        border: `1px solid ${active ? c : 'rgba(255,255,255,.1)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px',
                        fontWeight: 700,
                        color: active ? c : 'rgba(255,255,255,.35)',
                      }}
                    >
                      {e.n}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: active ? 700 : 400,
                        color: active ? '#fff' : 'rgba(255,255,255,.45)',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {e.court}
                    </span>
                    <span style={{ fontSize: '8px', color: active ? c : 'rgba(255,255,255,.2)' }}>
                      {(e.tag || '').split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <LiveRadialMindmap
              activeEtapes={activeEtapes}
              step={step}
              stepCount={stepCount}
              isGuestUi={isGuestUi}
              gotoStep={gotoStep}
            />
          )}
        </div>
      )}
    </>
  );
};

export default LiveMindmapCard;
