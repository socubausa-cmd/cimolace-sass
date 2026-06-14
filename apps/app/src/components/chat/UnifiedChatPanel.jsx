import React, { useEffect, useRef, useState } from 'react';

/**
 * UnifiedChatPanel — panneau de messagerie RÉUTILISABLE (moteur chat-engine).
 * Même composant pour : le chat du live (fallback quand caméra/micro/partage
 * indisponibles), les DM privés, et les groupes. Branché sur une room chat-engine.
 *
 * Props : { roomId, title?, onClose? }
 */
export default function UnifiedChatPanel({ roomId, title = 'Conversation', onClose }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);

  const load = async () => {
    if (!roomId) return;
    try {
      const { chatApi } = await import('@/lib/api');
      const msgs = await chatApi.messages(roomId);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch {
      /* silencieux : on réessaie au prochain tick */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!roomId) return undefined;
    setLoading(true);
    load();
    const t = setInterval(load, 4000); // polling simple (realtime à brancher ensuite)
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending || !roomId) return;
    setSending(true);
    try {
      const { chatApi } = await import('@/lib/api');
      await chatApi.send(roomId, content);
      setDraft('');
      await load();
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
      background: '#12111a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#F5F5F7' }}>{title}</span>
        {onClose && (
          <button onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', color: 'rgba(245,245,247,0.55)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <p style={{ color: 'rgba(245,245,247,0.4)', fontSize: 13 }}>Chargement…</p>}
        {!loading && messages.length === 0 && (
          <p style={{ color: 'rgba(245,245,247,0.4)', fontSize: 13 }}>Aucun message. Démarrez la conversation.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{
            alignSelf: 'flex-start', maxWidth: '85%',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '7px 11px',
          }}>
            <div style={{ fontSize: 13.5, color: '#F5F5F7', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
            {m.created_at && (
              <div style={{ fontSize: 9, color: 'rgba(245,245,247,0.35)', marginTop: 3 }}>
                {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Écrivez un message…"
          style={{
            flex: 1, background: '#0b0b0f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
            padding: '9px 12px', color: '#F5F5F7', fontSize: 13.5, outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          style={{
            background: 'var(--school-accent)', color: '#000', border: 'none', borderRadius: 10,
            padding: '0 16px', fontWeight: 700, fontSize: 13, cursor: sending ? 'wait' : 'pointer', opacity: draft.trim() ? 1 : 0.5,
          }}
        >Envoyer</button>
      </div>
    </div>
  );
}
