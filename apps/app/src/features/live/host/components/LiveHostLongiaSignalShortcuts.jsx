import React from 'react';
import { ScrollText, MessageCircle } from 'lucide-react';

const buildHubSigRow = (innerRadius) => (active, accentRgb) => ({
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: innerRadius,
  border: active ? `1px solid ${accentRgb}` : '1px solid rgba(255,255,255,.08)',
  background: active ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.04)',
  padding: '10px 12px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  cursor: 'pointer',
  textAlign: 'left',
  boxShadow: '0 1px 0 rgba(255,255,255,.04) inset',
});

export const LiveHostLongiaSignalShortcuts = ({
  innerRadius,
  longiaSignalSubDrawer,
  setLongiaSignalSubDrawer,
  handsEventsCount,
  lastHandEv,
  hostAccessRequestCount,
  permReqPreviewLine,
  waitingEntries,
  meshRequestsCount,
  meshPreviewLine,
  zone3RaisedHandsCount,
  zone3PrivilegedSeatsCount,
  debateNeuronqEnabled,
  nqPendingN,
  nqFirstQ,
  journalVisiblePreviewCount,
  lastJournalPreviewEv,
}) => {
  const hubSigRow = buildHubSigRow(innerRadius);
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        width: '100%',
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'thin',
        }}
      >
        <p
          style={{
            margin: '0 0 8px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '.07em',
            color: 'rgba(255,255,255,.4)',
          }}
        >
          APERÇUS RAPIDES
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setLongiaSignalSubDrawer((p) => (p === 'host_coach' ? null : 'host_coach'))}
            style={hubSigRow(longiaSignalSubDrawer === 'host_coach', 'rgba(245,158,11,.5)')}
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-amber-200/90" strokeWidth={2} aria-hidden />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '.03em' }}>Coach formateur</span>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    color: '#fcd34d',
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,.12)',
                    background: 'rgba(0,0,0,.25)',
                    letterSpacing: '.04em',
                  }}
                >
                  Chat
                </span>
              </div>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', margin: '4px 0 0', lineHeight: 1.45 }}>
                Discuter avec LONGIA · cartes de rendu (résumé, reformulation, exemple)
              </p>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(212,163,106,.5)', flexShrink: 0 }}>›</span>
          </button>

          <button
            type="button"
            onClick={() => setLongiaSignalSubDrawer((p) => (p === 'hands' ? null : 'hands'))}
            style={hubSigRow(longiaSignalSubDrawer === 'hands', 'rgba(251,191,36,.45)')}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#fbbf24',
                flexShrink: 0,
                marginTop: 4,
                boxShadow: '0 0 6px rgba(251,191,36,.5)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '.03em' }}>Mains levées</span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#fbbf24',
                    minWidth: 20,
                    textAlign: 'center',
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,.12)',
                    background: 'rgba(0,0,0,.25)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {handsEventsCount}
                </span>
              </div>
              <p
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,.4)',
                  margin: '4px 0 0',
                  lineHeight: 1.45,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {lastHandEv ? String(lastHandEv.msg || '').slice(0, 64) : '0 main — rien à traiter'}
              </p>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(212,163,106,.5)', flexShrink: 0 }}>›</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setLongiaSignalSubDrawer((p) => (p === 'permission_requests' ? null : 'permission_requests'))
            }
            style={hubSigRow(longiaSignalSubDrawer === 'permission_requests', 'rgba(192,132,252,.45)')}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#d4a36a',
                flexShrink: 0,
                marginTop: 4,
                boxShadow: '0 0 6px rgba(192,132,252,.5)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '.03em' }}>
                  Demandes d&apos;accès
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#e3c79a',
                    minWidth: 20,
                    textAlign: 'center',
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,.12)',
                    background: 'rgba(0,0,0,.25)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {hostAccessRequestCount}
                </span>
              </div>
              <p
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,.4)',
                  margin: '4px 0 0',
                  lineHeight: 1.45,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {permReqPreviewLine}
              </p>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(212,163,106,.5)', flexShrink: 0 }}>›</span>
          </button>

          <button
            type="button"
            onClick={() => setLongiaSignalSubDrawer((p) => (p === 'waiting' ? null : 'waiting'))}
            style={hubSigRow(longiaSignalSubDrawer === 'waiting', 'rgba(56,189,248,.4)')}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#38bdf8',
                flexShrink: 0,
                marginTop: 4,
                boxShadow: '0 0 6px rgba(56,189,248,.55)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '.03em' }}>
                  Salle d&apos;attente
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#38bdf8',
                    minWidth: 20,
                    textAlign: 'center',
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,.12)',
                    background: 'rgba(0,0,0,.25)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {waitingEntries.length}
                </span>
              </div>
              <p
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,.4)',
                  margin: '4px 0 0',
                  lineHeight: 1.45,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {waitingEntries.length > 0
                  ? `${waitingEntries[0].profile?.name || 'Participant'}…`
                  : '0 en file'}
              </p>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(212,163,106,.5)', flexShrink: 0 }}>›</span>
          </button>

          <button
            type="button"
            onClick={() => setLongiaSignalSubDrawer((p) => (p === 'mesh' ? null : 'mesh'))}
            style={hubSigRow(longiaSignalSubDrawer === 'mesh', 'rgba(200,150,12,.45)')}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#C8960C',
                flexShrink: 0,
                marginTop: 4,
                boxShadow: '0 0 6px rgba(200,150,12,.45)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '.03em' }}>Control Mesh</span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#C8960C',
                    minWidth: 20,
                    textAlign: 'center',
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,.12)',
                    background: 'rgba(0,0,0,.25)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {meshRequestsCount}
                </span>
              </div>
              <p
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,.4)',
                  margin: '4px 0 0',
                  lineHeight: 1.45,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {meshPreviewLine}
              </p>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(212,163,106,.5)', flexShrink: 0 }}>›</span>
          </button>

          <button
            type="button"
            onClick={() => setLongiaSignalSubDrawer((p) => (p === 'zone3' ? null : 'zone3'))}
            style={hubSigRow(longiaSignalSubDrawer === 'zone3', 'rgba(212,163,106,.45)')}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#d4a36a',
                flexShrink: 0,
                marginTop: 4,
                boxShadow: '0 0 6px rgba(212,163,106,.4)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '.03em' }}>Zone 3</span>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,.55)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ✋{zone3RaisedHandsCount} · 👑{zone3PrivilegedSeatsCount}
                </span>
              </div>
              <p
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,.4)',
                  margin: '4px 0 0',
                  lineHeight: 1.45,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Salle privilégiée — ouvrir pour gérer
              </p>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(212,163,106,.5)', flexShrink: 0 }}>›</span>
          </button>

          {debateNeuronqEnabled ? (
            <button
              type="button"
              onClick={() => setLongiaSignalSubDrawer((p) => (p === 'neuronq' ? null : 'neuronq'))}
              style={hubSigRow(longiaSignalSubDrawer === 'neuronq', 'rgba(200,148,62,.45)')}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#c8943e',
                  flexShrink: 0,
                  marginTop: 4,
                  boxShadow: '0 0 6px rgba(200,148,62,.55)',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '.03em' }}>NeuronQ</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: '#d4a36a',
                      minWidth: 20,
                      textAlign: 'center',
                      padding: '1px 6px',
                      borderRadius: 4,
                      border: '1px solid rgba(255,255,255,.12)',
                      background: 'rgba(0,0,0,.25)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {nqPendingN}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,.4)',
                    margin: '4px 0 0',
                    lineHeight: 1.45,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {nqFirstQ
                    ? String(nqFirstQ.reformulated_text || nqFirstQ.raw_text || '').slice(0, 64)
                    : '0 question en attente'}
                </p>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(212,163,106,.5)', flexShrink: 0 }}>›</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setLongiaSignalSubDrawer((p) => (p === 'journal' ? null : 'journal'))}
            style={hubSigRow(longiaSignalSubDrawer === 'journal', 'rgba(253,230,138,.4)')}
          >
            <ScrollText className="h-3.5 w-3.5 shrink-0 text-amber-200/85" strokeWidth={2} aria-hidden />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '.03em' }}>
                  Journal LONGIA
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#fde68a',
                    minWidth: 20,
                    textAlign: 'center',
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,.12)',
                    background: 'rgba(0,0,0,.25)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {journalVisiblePreviewCount}
                </span>
              </div>
              <p
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,.4)',
                  margin: '4px 0 0',
                  lineHeight: 1.45,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {lastJournalPreviewEv
                  ? String(lastJournalPreviewEv.msg || '').slice(0, 72)
                  : 'Historique, filtres et modes IA'}
              </p>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(212,163,106,.5)', flexShrink: 0 }}>›</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveHostLongiaSignalShortcuts;
