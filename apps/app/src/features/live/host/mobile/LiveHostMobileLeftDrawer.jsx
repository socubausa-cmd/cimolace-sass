import React, { useState, useCallback, useMemo, useRef } from 'react';
import { buildSmartboardNavigatorScenes } from '@/lib/smartboardNavigatorScenes';

// ─── Dimensions ───────────────────────────────────────────────────────────────
const DRAWER_W = 280;   // largeur du panneau
const HANDLE_W = 20;    // languette toujours visible

// ─── Icônes scènes ────────────────────────────────────────────────────────────
const SCENE_META = {
  smartboard:       { emoji: '🧠', color: '#a78bfa' },
  diapo:            { emoji: '📽️', color: '#60a5fa' },
  screen:           { emoji: '🖥️', color: '#34d399' },
  browser:          { emoji: '🌐', color: '#38bdf8' },
  embed:            { emoji: '🔗', color: '#fb923c' },
  quiz:             { emoji: '❓', color: '#f472b6' },
  secure_app_share: { emoji: '🔒', color: '#fbbf24' },
  board:            { emoji: '✏️', color: '#c084fc' },
  image:            { emoji: '🖼️', color: '#4ade80' },
  camera2:          { emoji: '📷', color: '#f87171' },
  shop:             { emoji: '🛍️', color: '#fb7185' },
};

/**
 * Tiroir latéral GAUCHE — handle vertical permanent, style symétrique au tiroir bas.
 *
 * • Le composant gère son propre état open/close (plus de prop open/onClose).
 * • Une languette (handle) de 20 px est TOUJOURS visible sur le bord gauche.
 * • Tap sur la languette → toggle open/close.
 * • Drag horizontal → ouvre si deltaX > 40, ferme si deltaX < -40.
 * • Backdrop click → ferme.
 */
export function LiveHostMobileLeftDrawer({
  isGuestUi,

  // Scènes
  smartboardSceneFlags,
  sbActiveScene,
  setSbActiveScene,

  // Paramètres audio/vidéo
  micOn,
  toggleMic,
  cameraOn,
  toggleCamera,
  ambientMasterVolume,
  setAmbientMasterVolume,

  // Spotlight / Focus
  spotlightOn,
  toggleSpotlight,

  // NeuronQ toggle
  neuronQActive,
  toggleNeuronQ,

  // Salle d'attente
  waitingEntries,
  approveWaiting,
  rejectWaiting,

  // Levées de main
  zone3RaisedHands,
  resolveHandRaise,
  hostAccessRequestCount,

  // Stats
  onlineMemberCount,
  liveParticipants,
}) {
  // ── État interne ────────────────────────────────────────────────────────────
  const [open, setOpen]               = useState(false);
  const [activeSection, setActiveSection] = useState('scenes');

  // ── Drag horizontal ─────────────────────────────────────────────────────────
  const dragStartX  = useRef(null);
  const isDragging  = useRef(false);

  const onTouchStart = useCallback((e) => {
    dragStartX.current = e.touches[0].clientX;
    isDragging.current = true;
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const deltaX = e.changedTouches[0].clientX - (dragStartX.current ?? 0);
    dragStartX.current = null;
    if (deltaX >  40) setOpen(true);
    if (deltaX < -40) setOpen(false);
  }, []);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  // ── Données dérivées ────────────────────────────────────────────────────────
  const sceneList = useMemo(
    () => buildSmartboardNavigatorScenes({ flags: smartboardSceneFlags }),
    [smartboardSceneFlags],
  );

  const signalBadge =
    (hostAccessRequestCount || 0) + (waitingEntries?.length || 0);

  const sections = [
    { id: 'scenes',   emoji: '🎭', label: 'Scènes',    show: !isGuestUi },
    { id: 'controle', emoji: '🎛️', label: 'Contrôle',  show: !isGuestUi },
    {
      id: 'signaux', emoji: '🔔', label: 'Signaux', show: !isGuestUi,
      badge: signalBadge,
    },
    { id: 'params',   emoji: '⚙️', label: 'Paramètres', show: true },
  ].filter((s) => s.show);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 44,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
          }}
        />
      )}

      {/*
       * ── Container glissant ──────────────────────────────────────────────
       * Largeur = DRAWER_W + HANDLE_W
       * Fermé  → translateX(-DRAWER_W) : le panel est hors écran, le handle affleure à gauche
       * Ouvert → translateX(0)         : panel visible, handle à droite du panel
       */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: DRAWER_W + HANDLE_W,
          zIndex: 45,
          transform: open ? 'translateX(0)' : `translateX(-${DRAWER_W}px)`,
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
          pointerEvents: 'none', // les enfants re-activent les leurs
        }}
      >
        {/* ── Panneau principal ─────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: DRAWER_W,
            background: 'linear-gradient(160deg, #1a1d2e 0%, #12141f 100%)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            boxShadow: open ? '4px 0 40px rgba(0,0,0,0.7)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            pointerEvents: open ? 'auto' : 'none',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '52px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            flexShrink: 0,
          }}>
            <div>
              <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>
                Panneau hôte
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '2px 0 0' }}>
                {onlineMemberCount ?? 0} membre{(onlineMemberCount ?? 0) !== 1 ? 's' : ''} en ligne
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.07)', border: 'none',
                cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'auto',
              }}
            >✕</button>
          </div>

          {/* Onglets de section */}
          <div style={{
            display: 'flex',
            gap: 4,
            padding: '10px 12px 6px',
            flexShrink: 0,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 11px',
                  borderRadius: 20,
                  background: activeSection === s.id
                    ? 'rgba(167,139,250,0.2)'
                    : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${
                    activeSection === s.id
                      ? 'rgba(167,139,250,0.4)'
                      : 'rgba(255,255,255,0.07)'
                  }`,
                  color: activeSection === s.id ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                  fontSize: 11,
                  fontWeight: activeSection === s.id ? 700 : 400,
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {s.emoji} {s.label}
                {s.badge > 0 && (
                  <span style={{
                    marginLeft: 3,
                    minWidth: 15, height: 15, borderRadius: 8,
                    background: '#e53e3e', color: '#fff',
                    fontSize: 8, fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px',
                  }}>
                    {s.badge > 99 ? '99+' : s.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Séparateur */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

          {/* Contenu */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>

            {/* ══ SCÈNES ══ */}
            {activeSection === 'scenes' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                {sceneList.map((scene) => {
                  const meta = SCENE_META[scene.id] || { emoji: '📦', color: '#9ca3af' };
                  const active = sbActiveScene === scene.id;
                  return (
                    <button
                      key={scene.id}
                      onClick={() => setSbActiveScene?.(scene.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                        padding: '14px 8px', borderRadius: 12,
                        background: active ? `${meta.color}22` : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${active ? meta.color + '55' : 'rgba(255,255,255,0.07)'}`,
                        cursor: 'pointer', outline: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        boxShadow: active ? `0 0 14px ${meta.color}22` : 'none',
                        transition: 'all 0.18s',
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{meta.emoji}</span>
                      <p style={{
                        color: active ? meta.color : 'rgba(255,255,255,0.7)',
                        fontSize: 11, fontWeight: active ? 700 : 400,
                        margin: 0, textAlign: 'center',
                      }}>
                        {scene.label}
                      </p>
                      {active && (
                        <div style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: meta.color,
                          animation: 'lhPulse 1.2s ease-in-out infinite',
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ══ CONTRÔLE ══ */}
            {activeSection === 'controle' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ControlRow
                  emoji="💡" label="Mode spotlight"
                  hint="Met en valeur un participant"
                  active={spotlightOn} onToggle={toggleSpotlight}
                  color="#fbbf24"
                />
                <ControlRow
                  emoji="❓" label="Q&R NeuronQ"
                  hint="Activer les questions des participants"
                  active={neuronQActive} onToggle={toggleNeuronQ}
                  color="#a78bfa"
                />
                {/* Volume ambiant */}
                <div style={{
                  padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>🎵</span>
                    <div>
                      <p style={{ color: '#fff', fontSize: 12, fontWeight: 600, margin: 0 }}>Volume ambiant</p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0 }}>
                        {Math.round((ambientMasterVolume ?? 0.22) * 100)} %
                      </p>
                    </div>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={ambientMasterVolume ?? 0.22}
                    onChange={(e) => setAmbientMasterVolume?.(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#60a5fa' }}
                  />
                </div>
              </div>
            )}

            {/* ══ SIGNAUX ══ */}
            {activeSection === 'signaux' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                <SectionTitle emoji="✋" label="Levées de main" count={zone3RaisedHands?.length || 0} />
                {(!zone3RaisedHands || zone3RaisedHands.length === 0) && (
                  <EmptyHint text="Aucune main levée" />
                )}
                {zone3RaisedHands?.map?.((entry, i) => (
                  <SignalRow
                    key={entry.user_id || i}
                    name={entry.display_name || entry.displayName || entry.name || '?'}
                    emoji="✋" color="#fbbf24"
                    onAccept={() => resolveHandRaise?.({ userId: entry.user_id, accept: true })}
                    onReject={() => resolveHandRaise?.({ userId: entry.user_id, accept: false })}
                  />
                ))}

                <SectionTitle emoji="⏳" label="Salle d'attente" count={waitingEntries?.length || 0} />
                {(!waitingEntries || waitingEntries.length === 0) && (
                  <EmptyHint text="Personne en attente" />
                )}
                {waitingEntries?.map?.((entry, i) => (
                  <SignalRow
                    key={entry.id || i}
                    name={entry.display_name || entry.displayName || entry.name || '?'}
                    emoji="🚪" color="#38bdf8"
                    onAccept={() => approveWaiting?.(entry)}
                    onReject={() => rejectWaiting?.(entry)}
                  />
                ))}

                {waitingEntries?.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => waitingEntries.forEach((e) => approveWaiting?.(e))}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 9,
                        background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)',
                        color: '#86efac', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >✓ Tous accepter</button>
                    <button
                      onClick={() => waitingEntries.forEach((e) => rejectWaiting?.(e))}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 9,
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                        color: '#fca5a5', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >✕ Tous refuser</button>
                  </div>
                )}
              </div>
            )}

            {/* ══ PARAMÈTRES ══ */}
            {activeSection === 'params' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ControlRow
                  emoji="🎤" label="Microphone"
                  hint={micOn ? 'Micro actif' : 'Micro coupé'}
                  active={micOn} onToggle={toggleMic}
                  color="#4ade80"
                />
                <ControlRow
                  emoji="📷" label="Caméra"
                  hint={cameraOn ? 'Caméra active' : 'Caméra éteinte'}
                  active={cameraOn} onToggle={toggleCamera}
                  color="#60a5fa"
                />
              </div>
            )}

          </div>
        </div>

        {/*
         * ── Handle vertical ────────────────────────────────────────────────
         * Positionné au bord droit du container (left: DRAWER_W)
         * → visible à left:0 quand fermé, à left:280 quand ouvert
         */}
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={toggle}
          style={{
            position: 'absolute',
            left: DRAWER_W,
            top: '50%',
            transform: 'translateY(-50%)',
            width: HANDLE_W,
            height: 68,
            borderRadius: '0 12px 12px 0',
            background: 'rgba(0,0,0,0.48)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderLeft: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            touchAction: 'none',
            pointerEvents: 'auto',
            boxShadow: '3px 0 16px rgba(0,0,0,0.5)',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {/* Pill vertical — miroir du handle bas */}
          <div style={{
            width: 4,
            height: 30,
            borderRadius: 2,
            background: open ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)',
            transition: 'background 0.2s',
          }} />

          {/* Badge signaux urgents */}
          {signalBadge > 0 && (
            <div style={{
              position: 'absolute',
              top: 7,
              right: 3,
              width: 14,
              height: 14,
              borderRadius: 7,
              background: '#e53e3e',
              color: '#fff',
              fontSize: 7,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid rgba(0,0,0,0.5)',
            }}>
              {signalBadge > 9 ? '9+' : signalBadge}
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes lhPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function ControlRow({ emoji, label, hint, active, onToggle, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 12,
      background: active ? `${color}11` : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? color + '33' : 'rgba(255,255,255,0.07)'}`,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0 }}>{label}</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: '2px 0 0' }}>{hint}</p>
      </div>
      <button
        onClick={onToggle}
        style={{
          width: 42, height: 24, borderRadius: 12, flexShrink: 0,
          background: active ? color : 'rgba(255,255,255,0.15)',
          border: 'none', cursor: 'pointer',
          position: 'relative', transition: 'background 0.2s',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 3, left: active ? 21 : 3,
          width: 18, height: 18, borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  );
}

function SectionTitle({ emoji, label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
      <span style={{ fontSize: 14 }}>{emoji}</span>
      <span style={{
        color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      {count > 0 && (
        <span style={{
          minWidth: 16, height: 16, borderRadius: 8,
          background: '#e53e3e', color: '#fff',
          fontSize: 8, fontWeight: 800,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 3px',
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyHint({ text }) {
  return (
    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
      {text}
    </p>
  );
}

function SignalRow({ name, emoji, color, onAccept, onReject }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '9px 12px', borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <span style={{
        flex: 1, color: '#fff', fontSize: 12, fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {name}
      </span>
      <button onClick={onAccept} style={{
        width: 28, height: 28, borderRadius: 8,
        background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)',
        color: '#86efac', fontSize: 14, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✓</button>
      <button onClick={onReject} style={{
        width: 28, height: 28, borderRadius: 8,
        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
        color: '#fca5a5', fontSize: 14, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✕</button>
    </div>
  );
}
