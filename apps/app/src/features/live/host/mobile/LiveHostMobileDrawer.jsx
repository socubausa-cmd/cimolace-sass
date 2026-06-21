import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import {
  MessageCircle,
  HelpCircle,
  FileText,
  MessageSquareDot,
  Sparkles,
  Users,
} from 'lucide-react';
// Scènes → tiroir GAUCHE uniquement. Pas d'import ici.

// ─── Snap heights (% of viewport) ────────────────────────────────────────────
const SNAP_CLOSED = 0;       // handle only
const SNAP_HALF   = 38;      // half open
const SNAP_FULL   = 82;      // fully open (laisse TopBar visible)
const HANDLE_H    = 28;      // px — hauteur du handle toujours visible
const BOTTOM_BAR  = 80;      // px — hauteur de la BottomBar

// ─── Tab definitions ──────────────────────────────────────────────────────────
function buildTabs({ chatUnread, qaCount, whisperUnread, onlineMemberCount, isGuestUi }) {
  return [
    { id: 'chat',     label: 'Chat',      Icon: MessageCircle,    badge: chatUnread,      color: '#d4a36a', show: true },
    { id: 'qa',       label: 'Q&R',       Icon: HelpCircle,       badge: qaCount,         color: '#4ade80', show: true },
    { id: 'script',   label: 'Script',    Icon: FileText,         badge: 0,               color: '#fb923c', show: !isGuestUi },
    { id: 'whisper',  label: 'Aparté',    Icon: MessageSquareDot, badge: whisperUnread,   color: '#d98a5a', show: !isGuestUi },
    { id: 'ia',       label: 'IA',        Icon: Sparkles,         badge: 0,               color: '#d4a36a', show: !isGuestUi },
    { id: 'membres',  label: 'Membres',   Icon: Users,            badge: onlineMemberCount > 0 ? onlineMemberCount : 0, color: '#38bdf8', show: true },
    // NB: Scènes → tiroir GAUCHE (☰). Contrôle, Signaux, Paramètres → tiroir GAUCHE.
  ].filter((t) => t.show);
}

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════
export function LiveHostMobileDrawer({
  // Session
  isGuestUi,
  user,

  // Chat
  chatMessages,
  sendChatMessage,
  chatUnread,
  onChatOpen,

  // NeuronQ
  neuronqQuestions,
  markNeuronqAnswered,
  markNeuronqSkipped,

  // Script
  activeEtapes,
  step,
  gotoStep,

  // Whispers
  whisperThreads,
  sendWhisper,

  // Membres
  liveParticipants,
  livekitParticipantsMap,
  muteParticipant,
  kickParticipant,
  onlineMemberCount,
}) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [snapPct, setSnapPct] = useState(SNAP_CLOSED); // 0 | 38 | 82
  const [activeTab, setActiveTab] = useState('chat');
  const [chatInput, setChatInput] = useState('');
  const [qaFilter, setQaFilter] = useState('pending');
  const [whisperPeerId, setWhisperPeerId] = useState(null);
  const [whisperInput, setWhisperInput] = useState('');

  // ── Drag refs ──────────────────────────────────────────────────────────────
  const drawerRef     = useRef(null);
  const dragStartY    = useRef(null);
  const dragStartSnap = useRef(null);
  const isDragging    = useRef(false);

  // Current drawer height in px (computed from snapPct)
  const vhToPx = useCallback((pct) => (window.innerHeight * pct) / 100, []);

  // ── Snap logic ─────────────────────────────────────────────────────────────
  const snapTo = useCallback((pct, opts = {}) => {
    setSnapPct(pct);
    if (pct > SNAP_CLOSED && !opts.keepTab) setActiveTab((t) => t || 'chat');
  }, []);

  const resolveSnap = useCallback((deltaY) => {
    // deltaY > 0 → finger moved down (close), < 0 → finger moved up (open)
    const VH = window.innerHeight;
    const currentH = vhToPx(dragStartSnap.current);
    const newH = currentH - deltaY;
    const halfH = vhToPx(SNAP_HALF);
    const fullH = vhToPx(SNAP_FULL);

    if (newH < halfH / 2)   return SNAP_CLOSED;
    if (newH < (halfH + fullH) / 2) return SNAP_HALF;
    return SNAP_FULL;
  }, [vhToPx]);

  // ── Touch handlers ─────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartSnap.current = snapPct;
    isDragging.current = true;
  }, [snapPct]);

  const onTouchMove = useCallback((e) => {
    if (!isDragging.current || dragStartY.current === null) return;
    const deltaY = e.touches[0].clientY - dragStartY.current;
    const currentH = vhToPx(dragStartSnap.current);
    const newH = Math.max(HANDLE_H, Math.min(vhToPx(SNAP_FULL) + 10, currentH - deltaY));

    if (drawerRef.current) {
      drawerRef.current.style.height = `${newH}px`;
      drawerRef.current.style.transition = 'none';
    }
  }, [vhToPx]);

  const onTouchEnd = useCallback((e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const deltaY = e.changedTouches[0].clientY - dragStartY.current;
    const target = resolveSnap(deltaY);
    dragStartY.current = null;

    if (drawerRef.current) {
      drawerRef.current.style.height = '';
      drawerRef.current.style.transition = '';
    }
    snapTo(target);
  }, [resolveSnap, snapTo]);

  // ── Computed values ────────────────────────────────────────────────────────
  const isOpen = snapPct > SNAP_CLOSED;

  const pendingNeuronq = useMemo(
    () => (neuronqQuestions ?? []).filter((q) => !q.status || q.status === 'pending'),
    [neuronqQuestions],
  );
  const qaCount = pendingNeuronq.length;

  const whisperUnread = useMemo(() => {
    return Object.values(whisperThreads ?? {}).reduce((s, t) => s + t.length, 0);
  }, [whisperThreads]);

  const tabs = useMemo(
    () => buildTabs({ chatUnread, qaCount, whisperUnread, onlineMemberCount, isGuestUi }),
    [chatUnread, qaCount, whisperUnread, onlineMemberCount, isGuestUi],
  );

  // Chat send
  const handleSendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    sendChatMessage?.({ message: chatInput.trim() });
    setChatInput('');
  }, [chatInput, sendChatMessage]);

  // Whisper send
  const handleSendWhisper = useCallback(() => {
    if (!whisperInput.trim() || !whisperPeerId) return;
    sendWhisper?.({ toId: whisperPeerId, text: whisperInput.trim() });
    setWhisperInput('');
  }, [whisperInput, whisperPeerId, sendWhisper]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const drawerH = snapPct === SNAP_CLOSED
    ? HANDLE_H
    : `${snapPct}vh`;

  return (
    <>
      {/* Backdrop blur quand ouvert */}
      {isOpen && (
        <div
          onClick={() => snapTo(SNAP_CLOSED)}
          style={{
            position: 'absolute',
            inset: 0,
            bottom: BOTTOM_BAR,
            zIndex: 34,
            background: 'rgba(0,0,0,0.18)',
            backdropFilter: snapPct === SNAP_FULL ? 'blur(4px)' : 'none',
            WebkitBackdropFilter: snapPct === SNAP_FULL ? 'blur(4px)' : 'none',
            pointerEvents: isOpen ? 'auto' : 'none',
          }}
        />
      )}

      {/* ── Drawer ──────────────────────────────────────────────────────── */}
      <div
        ref={drawerRef}
        style={{
          position: 'absolute',
          bottom: BOTTOM_BAR,
          left: 0,
          right: 0,
          height: drawerH,
          zIndex: 35,
          display: 'flex',
          flexDirection: 'column',
          background: snapPct === SNAP_CLOSED
            ? 'transparent'
            : 'linear-gradient(180deg, #1c1f2e 0%, #13151f 100%)',
          borderRadius: snapPct > 0 ? '18px 18px 0 0' : 0,
          borderTop: isOpen ? '1px solid rgba(255,255,255,0.10)' : 'none',
          boxShadow: isOpen ? '0 -12px 48px rgba(0,0,0,0.7), 0 -1px 0 rgba(255,255,255,0.08)' : 'none',
          transition: isDragging.current ? 'none' : 'height 0.32s cubic-bezier(0.32,0.72,0,1), background 0.2s ease',
          overflow: 'hidden',
          willChange: 'height',
        }}
      >
        {/* ── Handle bar ────────────────────────────────────────────────── */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={() => {
            if (snapPct === SNAP_CLOSED) snapTo(SNAP_HALF);
            else if (snapPct === SNAP_HALF) snapTo(SNAP_FULL);
            else snapTo(SNAP_CLOSED);
          }}
          style={{
            height: HANDLE_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: isOpen ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.14)',
            transition: 'background 0.2s',
          }} />
        </div>

        {/* ── Tab bar — scroll horizontal ────────────────────────────────── */}
        {isOpen && (
          <div
            style={{
              display: 'flex',
              gap: 0,
              overflowX: 'auto',
              flexShrink: 0,
              padding: '0 12px 2px',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'chat') onChatOpen?.();
                    if (snapPct === SNAP_CLOSED) snapTo(SNAP_HALF);
                  }}
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    padding: '6px 14px 8px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: active
                      ? `2px solid ${tab.color}`
                      : '2px solid transparent',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'border-color 0.15s',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <tab.Icon
                    size={18}
                    style={{ color: active ? tab.color : 'rgba(255,255,255,0.45)', transition: 'color 0.15s' }}
                  />
                  <span style={{
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    color: active ? tab.color : 'rgba(255,255,255,0.4)',
                    letterSpacing: 0.3,
                    transition: 'color 0.15s',
                    whiteSpace: 'nowrap',
                  }}>
                    {tab.label}
                  </span>
                  {/* Badge */}
                  {tab.badge > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: 2,
                      right: 6,
                      minWidth: 15,
                      height: 15,
                      borderRadius: 8,
                      background: '#e53e3e',
                      color: '#fff',
                      fontSize: 8,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 3px',
                      border: '1.5px solid rgba(27,20,14,0.9)',
                    }}>
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Séparateur */}
        {isOpen && (
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
        )}

        {/* ── Panel content — scroll vertical ───────────────────────────── */}
        {isOpen && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* ════ CHAT ════ */}
            {activeTab === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  {(!chatMessages || chatMessages.length === 0) && (
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', paddingTop: 24 }}>
                      Aucun message pour l'instant
                    </p>
                  )}
                  {chatMessages?.map?.((msg, i) => {
                    const isMe = msg.user_id === user?.id || msg.userId === user?.id;
                    return (
                      <div key={msg.id || i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                        {!isMe && (
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 2, display: 'block' }}>
                            {msg.sender_name || msg.displayName || '?'}
                          </span>
                        )}
                        <div style={{
                          background: isMe ? 'rgba(212,163,106,0.22)' : 'rgba(255,255,255,0.07)',
                          border: `1px solid ${isMe ? 'rgba(212,163,106,0.3)' : 'rgba(255,255,255,0.09)'}`,
                          borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          padding: '8px 12px',
                          color: '#fff',
                          fontSize: 13,
                          lineHeight: 1.45,
                        }}>
                          {msg.message || msg.content || msg.text || ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Input */}
                <div style={{
                  display: 'flex', gap: 8, padding: '8px 12px',
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(0,0,0,0.25)',
                }}>
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    placeholder="Écrire…"
                    style={{
                      flex: 1, background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 20, padding: '8px 14px',
                      color: '#fff', fontSize: 13, outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSendChat}
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: chatInput.trim() ? '#d4a36a' : 'rgba(255,255,255,0.07)',
                      border: 'none', cursor: 'pointer',
                      color: '#fff', fontSize: 16, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}
                  >↑</button>
                </div>
              </div>
            )}

            {/* ════ Q&R — NeuronQ ════ */}
            {activeTab === 'qa' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Filter tabs */}
                <div style={{ display: 'flex', padding: '4px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                  {[['pending', 'En attente'], ['all', 'Toutes']].map(([k, lbl]) => (
                    <button key={k} onClick={() => setQaFilter(k)} style={{
                      padding: '5px 14px', fontSize: 11,
                      fontWeight: qaFilter === k ? 700 : 400,
                      color: qaFilter === k ? '#4ade80' : 'rgba(255,255,255,0.4)',
                      background: 'transparent', border: 'none',
                      borderBottom: qaFilter === k ? '2px solid #4ade80' : '2px solid transparent',
                      cursor: 'pointer', marginBottom: -1,
                    }}>{lbl}</button>
                  ))}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(() => {
                    const shown = qaFilter === 'pending' ? pendingNeuronq : (neuronqQuestions ?? []);
                    if (!shown.length) return (
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', paddingTop: 24 }}>
                        {qaFilter === 'pending' ? 'Aucune question en attente 🎉' : 'Aucune question'}
                      </p>
                    );
                    return shown.map((q, i) => {
                      const pending = !q.status || q.status === 'pending';
                      const answered = q.status === 'answered';
                      const qText = q.reformulated_text || q.raw_text || q.question || q.text || '';
                      const author = liveParticipants?.find(p => String(p.user_id || p.userId) === String(q.user_id));
                      const authorName = author?.display_name || author?.displayName || q.author || 'Anonyme';
                      return (
                        <div key={q.id || i} style={{
                          padding: '11px 13px', borderRadius: 12,
                          background: pending ? 'rgba(212,163,106,0.07)' : answered ? 'rgba(128,101,74,0.05)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${pending ? 'rgba(212,163,106,0.2)' : answered ? 'rgba(128,101,74,0.15)' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{authorName}</span>
                            <span style={{
                              fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                              padding: '2px 7px', borderRadius: 6,
                              background: pending ? 'rgba(212,163,106,0.2)' : answered ? 'rgba(128,101,74,0.2)' : 'rgba(255,255,255,0.08)',
                              color: pending ? '#e3c79a' : answered ? '#86efac' : 'rgba(255,255,255,0.4)',
                            }}>
                              {pending ? 'En attente' : answered ? 'Répondu' : 'Passé'}
                            </span>
                          </div>
                          <p style={{ color: '#fff', fontSize: 13, margin: 0, lineHeight: 1.45 }}>{qText}</p>
                          {pending && !isGuestUi && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                              <button onClick={() => markNeuronqAnswered?.(q.id)} style={{
                                flex: 1, padding: '6px 10px', borderRadius: 8,
                                background: 'rgba(128,101,74,0.13)', border: '1px solid rgba(128,101,74,0.28)',
                                color: '#86efac', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>✓ Répondu</button>
                              <button onClick={() => markNeuronqSkipped?.(q.id)} style={{
                                padding: '6px 12px', borderRadius: 8,
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                                color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer',
                              }}>⏭</button>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* ════ SCRIPT ════ */}
            {activeTab === 'script' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(!activeEtapes || activeEtapes.length === 0) && (
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', paddingTop: 24 }}>Aucune étape définie</p>
                )}
                {activeEtapes?.map?.((et, idx) => {
                  const active = idx === step;
                  const label = et.titre || et.title || et.label || `Étape ${idx + 1}`;
                  return (
                    <button key={et.id || idx} onClick={() => { gotoStep?.(idx); snapTo(SNAP_HALF); }} style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '10px 13px', borderRadius: 11,
                      background: active ? 'rgba(251,146,60,0.14)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${active ? 'rgba(251,146,60,0.38)' : 'rgba(255,255,255,0.07)'}`,
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      WebkitTapHighlightColor: 'transparent', outline: 'none',
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        background: active ? '#fb923c' : 'rgba(255,255,255,0.09)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                      }}>{idx + 1}</div>
                      <span style={{ color: active ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: active ? 600 : 400, lineHeight: 1.3, flex: 1 }}>
                        {label}
                      </span>
                      {active && (
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: '#fb923c', flexShrink: 0,
                          animation: 'lh-pulse 1.2s ease-in-out infinite',
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ════ APARTÉ / WHISPERS ════ */}
            {activeTab === 'whisper' && (
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Colonne fils */}
                <div style={{
                  width: 72, borderRight: '1px solid rgba(255,255,255,0.07)',
                  overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 4px',
                }}>
                  {Object.keys(whisperThreads ?? {}).length === 0 && (
                    <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 9, textAlign: 'center', paddingTop: 16 }}>Aucun</p>
                  )}
                  {Object.entries(whisperThreads ?? {}).map(([peerId, msgs]) => {
                    const peer = liveParticipants?.find(p => String(p.user_id || p.userId) === String(peerId));
                    const name = peer?.display_name || peer?.displayName || '…';
                    const initials = name.slice(0, 2).toUpperCase();
                    const isActive = whisperPeerId === peerId;
                    return (
                      <button key={peerId} onClick={() => setWhisperPeerId(peerId)} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        padding: '6px 2px', borderRadius: 9,
                        background: isActive ? 'rgba(217,138,90,0.16)' : 'transparent',
                        border: isActive ? '1px solid rgba(217,138,90,0.3)' : '1px solid transparent',
                        cursor: 'pointer', position: 'relative',
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'rgba(217,138,90,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#e8cba0',
                        }}>{initials}</div>
                        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', maxWidth: 60, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {name}
                        </span>
                        {msgs.length > 0 && (
                          <div style={{
                            position: 'absolute', top: 2, right: 2,
                            width: 14, height: 14, borderRadius: 7,
                            background: '#e53e3e', color: '#fff',
                            fontSize: 7, fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {msgs.length > 9 ? '9+' : msgs.length}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {/* Sélecteur rapide membres sans fil */}
                  {(liveParticipants ?? []).filter(p => {
                    const pid = String(p.user_id || p.userId);
                    return pid !== String(user?.id) && !whisperThreads?.[pid];
                  }).map((p) => {
                    const pid = String(p.user_id || p.userId);
                    const name = p.display_name || p.displayName || '?';
                    const initials = name.slice(0, 2).toUpperCase();
                    const isActive = whisperPeerId === pid;
                    return (
                      <button key={pid} onClick={() => setWhisperPeerId(pid)} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        padding: '6px 2px', borderRadius: 9,
                        background: isActive ? 'rgba(217,138,90,0.12)' : 'transparent',
                        border: '1px solid transparent',
                        cursor: 'pointer', opacity: 0.6,
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'rgba(255,255,255,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
                        }}>{initials}</div>
                        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', maxWidth: 60, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Zone conversation */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {!whisperPeerId ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 28 }}>💬</div>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Choisissez un membre</p>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(whisperThreads?.[whisperPeerId] ?? []).map((msg, i) => {
                          const isMe = String(msg.fromId) === String(user?.id);
                          return (
                            <div key={msg.id || i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                              <div style={{
                                background: isMe ? 'rgba(212,163,106,0.2)' : 'rgba(255,255,255,0.07)',
                                border: `1px solid ${isMe ? 'rgba(212,163,106,0.28)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                                padding: '7px 11px', color: '#fff', fontSize: 12, lineHeight: 1.4,
                              }}>{msg.text}</div>
                              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.22)', display: 'block', marginTop: 1, textAlign: isMe ? 'right' : 'left' }}>
                                {msg.at ? new Date(msg.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 6, padding: '7px 10px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.22)' }}>
                        <input
                          value={whisperInput}
                          onChange={(e) => setWhisperInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendWhisper()}
                          placeholder="Message privé…"
                          style={{
                            flex: 1, background: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.11)',
                            borderRadius: 18, padding: '7px 12px',
                            color: '#fff', fontSize: 12, outline: 'none',
                          }}
                        />
                        <button onClick={handleSendWhisper} style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: whisperInput.trim() ? '#d98a5a' : 'rgba(255,255,255,0.07)',
                          border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background 0.15s',
                        }}>↑</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ════ IA ════ */}
            {activeTab === 'ia' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24 }}>
                <div style={{ fontSize: 48 }}>✨</div>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
                  L'assistant IA coach formateur<br />arrive bientôt dans le mode mobile.
                </p>
              </div>
            )}

            {/* ════ MEMBRES ════ */}
            {activeTab === 'membres' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(!liveParticipants || liveParticipants.length === 0) && (
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', paddingTop: 24 }}>Aucun participant pour l'instant</p>
                )}
                {liveParticipants?.map?.((p, i) => {
                  const pid = String(p.user_id || p.userId);
                  const isHost = p.role === 'host' || p.is_host;
                  const name = p.display_name || p.displayName || '?';
                  const initials = name.slice(0, 2).toUpperCase();
                  const lkParticipant = livekitParticipantsMap?.[pid];
                  const hasCamera = lkParticipant?.videoTrackPublications?.size > 0;
                  const hasMic = lkParticipant?.audioTrackPublications?.size > 0;
                  return (
                    <div key={pid || i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 11,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: isHost ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                        color: isHost ? '#fbbf24' : 'rgba(255,255,255,0.7)',
                        border: isHost ? '1px solid rgba(251,191,36,0.35)' : 'none',
                      }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: '#fff', fontSize: 13, margin: 0, fontWeight: isHost ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {name}
                          {isHost && <span style={{ fontSize: 9, color: '#fbbf24', marginLeft: 6, fontWeight: 700, letterSpacing: '0.06em' }}>HÔTE</span>}
                        </p>
                        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                          {hasMic && <span style={{ fontSize: 9, color: 'rgba(128,101,74,0.8)' }}>🎤</span>}
                          {hasCamera && <span style={{ fontSize: 9, color: 'rgba(212,163,106,0.8)' }}>📷</span>}
                        </div>
                      </div>
                      {!isGuestUi && !isHost && (
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                          <button onClick={() => muteParticipant?.(pid)} style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                            cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 13,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>🔇</button>
                          <button onClick={() => kickParticipant?.(pid)} style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                            cursor: 'pointer', color: 'rgba(252,165,165,0.8)', fontSize: 13,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>✕</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}
      </div>

      {/* keyframe lh-pulse pour les dots actifs */}
      <style>{`@keyframes lh-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}`}</style>
    </>
  );
}
