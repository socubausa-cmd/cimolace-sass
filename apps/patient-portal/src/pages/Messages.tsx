import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Send } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type Thread = {
  id: string;
  subject: string | null;
  status: string;
  last_message_at: string | null;
};

type Message = {
  id: string;
  thread_id: string;
  sender_role: string;
  body: string;
  created_at: string;
};

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

export function Messages() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // -- Threads ----------------------------------------------------------
  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch(API + '/med/threads', { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      const list: Thread[] = d.data || d || [];
      setThreads(list);
      if (list.length > 0 && !activeId) {
        setActiveId(list[0].id);
      }
    } catch {
      /* ignore */
    }
  }, [activeId]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // -- Messages (with polling) ------------------------------------------
  const fetchMessages = useCallback(async () => {
    if (!activeId) return;
    try {
      const res = await fetch(API + '/med/threads/' + activeId + '/messages', {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const d = await res.json();
      const list: Message[] = d.data || d || [];
      setMessages(list);
    } catch {
      /* ignore */
    }
  }, [activeId]);

  useEffect(() => {
    fetchMessages();
    if (!activeId) return;
    const interval = setInterval(fetchMessages, 6000);
    return () => clearInterval(interval);
  }, [activeId, fetchMessages]);

  // Auto-scroll to last message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !input.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(API + '/med/threads/' + activeId + '/messages', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: input.trim() }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      setInput('');
      fetchMessages();
    } catch (err: any) {
      setError(err?.message || "Echec de l'envoi");
    } finally {
      setSending(false);
    }
  }

  const activeThread = threads.find((t) => t.id === activeId);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageCircle size={22} /> Messages
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: threads.length > 1 ? '240px 1fr' : '1fr', gap: 16 }}>
        {threads.length > 1 && (
          <aside
            style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: 8,
              maxHeight: 500,
              overflowY: 'auto',
            }}
          >
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  marginBottom: 4,
                  background: activeId === t.id ? '#ecfeff' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  borderLeft: activeId === t.id ? '3px solid var(--brand-primary)' : '3px solid transparent',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                  {t.subject || 'Sans sujet'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {t.last_message_at
                    ? new Date(t.last_message_at).toLocaleString('fr', { dateStyle: 'short', timeStyle: 'short' })
                    : '—'}
                  {t.status === 'closed' && ' · fermé'}
                </div>
              </button>
            ))}
          </aside>
        )}

        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            minHeight: 480,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {activeThread && (
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                {activeThread.subject || 'Conversation avec votre praticien'}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Statut : {activeThread.status}
              </div>
            </div>
          )}

          <div ref={scrollRef} style={{ flex: 1, padding: 20, overflowY: 'auto', maxHeight: 380 }}>
            {!activeId && (
              <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 80 }}>
                Messagerie securisee avec votre praticien.
                <br />
                Aucune conversation pour le moment.
                <br />
                <span style={{ fontSize: 12 }}>
                  Votre praticien initiera la conversation depuis son espace.
                </span>
              </p>
            )}

            {activeId && messages.length === 0 && (
              <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 80 }}>
                Aucun message dans cette conversation.
                <br />
                Soyez le premier a ecrire.
              </p>
            )}

            {messages.map((m) => {
              const mine = m.sender_role === 'patient';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: mine ? 'flex-end' : 'flex-start',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      maxWidth: '72%',
                      padding: '10px 14px',
                      borderRadius: 14,
                      background: mine ? 'var(--brand-primary)' : '#f1f5f9',
                      color: mine ? '#fff' : '#0f172a',
                      fontSize: 14,
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {m.body}
                    <div
                      style={{
                        fontSize: 10,
                        opacity: 0.7,
                        marginTop: 4,
                        textAlign: mine ? 'right' : 'left',
                      }}
                    >
                      {new Date(m.created_at).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={handleSend}
            style={{ borderTop: '1px solid #e2e8f0', padding: 12, display: 'flex', gap: 8 }}
          >
            <input
              placeholder={activeId ? 'Votre message...' : 'Aucune conversation active'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!activeId || sending}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 14,
                background: activeId ? '#fff' : '#f8fafc',
              }}
            />
            <button
              type="submit"
              disabled={!activeId || sending || !input.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 20px',
                background: activeId && input.trim() ? 'var(--brand-primary)' : '#94a3b8',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: activeId && input.trim() && !sending ? 'pointer' : 'not-allowed',
                fontWeight: 500,
              }}
            >
              <Send size={16} /> {sending ? '…' : 'Envoyer'}
            </button>
          </form>

          {error && (
            <div style={{ padding: '8px 16px', background: '#fef2f2', color: '#991b1b', fontSize: 12 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
