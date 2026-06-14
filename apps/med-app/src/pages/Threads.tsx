import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Send, Plus, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type Thread = {
  id: string;
  patient_id: string;
  subject: string | null;
  status: string;
  priority: string;
  last_message_at: string | null;
  last_message_by_role: string | null;
};

type Message = {
  id: string;
  thread_id: string;
  sender_role: string;
  body: string;
  created_at: string;
};

type Patient = {
  id: string;
  first_name?: string;
  last_name?: string;
};

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

function patientName(p: Patient | undefined): string {
  if (!p) return '(patient inconnu)';
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  return name || '(sans nom)';
}

export function Threads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [patients, setPatients] = useState<Record<string, Patient>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [newPatientId, setNewPatientId] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newFirstMessage, setNewFirstMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // -- Patients (for display name in threads list) ---------------------
  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch(API + '/med/patients', { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      const list: Patient[] = d.data || d || [];
      const map: Record<string, Patient> = {};
      for (const p of list) map[p.id] = p;
      setPatients(map);
    } catch {
      /* ignore */
    }
  }, []);

  // -- Threads ----------------------------------------------------------
  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch(API + '/med/threads', { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      const list: Thread[] = d.data || d || [];
      setThreads(list);
      if (list.length > 0 && !activeId) setActiveId(list[0].id);
    } catch {
      /* ignore */
    }
  }, [activeId]);

  useEffect(() => {
    fetchPatients();
    fetchThreads();
  }, [fetchPatients, fetchThreads]);

  // -- Messages (polling) ----------------------------------------------
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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, activeId]);

  // -- Send -------------------------------------------------------------
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

  // -- Create thread ----------------------------------------------------
  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    if (!newPatientId) {
      setError('Sélectionnez un patient');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(API + '/med/threads', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: newPatientId,
          subject: newSubject.trim() || undefined,
          initial_message: newFirstMessage.trim() || undefined,
          priority: 'normal',
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      const created = await res.json();
      const newThreadId = created?.thread?.id || created?.id;
      setNewOpen(false);
      setNewPatientId('');
      setNewSubject('');
      setNewFirstMessage('');
      await fetchThreads();
      if (newThreadId) setActiveId(newThreadId);
    } catch (err: any) {
      setError(err?.message || 'Échec de la création');
    } finally {
      setCreating(false);
    }
  }

  const activeThread = threads.find((t) => t.id === activeId);
  const activePatient = activeThread ? patients[activeThread.patient_id] : undefined;

  const priorityColor: Record<string, string> = {
    urgent: '#dc2626',
    high: '#ea580c',
    normal: '#0d9488',
    low: 'var(--zw-text-muted)',
  };
  const priorityLabel: Record<string, string> = {
    urgent: 'Urgente', high: 'Haute', normal: 'Normale', low: 'Basse',
  };
  const statusLabel: Record<string, string> = {
    open: 'Ouvert', awaiting_staff: 'À répondre', awaiting_patient: 'En attente patient',
    closed: 'Fermé', resolved: 'Résolu',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageCircle size={22} /> Messages
        </h2>
        <button
          onClick={() => setNewOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 20px',
            background: 'var(--brand-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Nouvelle conversation
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
        {/* Threads list */}
        <aside
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid var(--zw-border)',
            padding: 8,
            maxHeight: 600,
            overflowY: 'auto',
          }}
        >
          {threads.length === 0 && (
            <p style={{ color: 'var(--zw-text-faint)', padding: 20, textAlign: 'center', fontSize: 13 }}>
              Aucune conversation.
              <br />
              Cliquez sur "Nouvelle conversation".
            </p>
          )}
          {threads.map((t) => {
            const p = patients[t.patient_id];
            const isActive = activeId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  marginBottom: 4,
                  background: isActive ? 'var(--brand-primary-soft)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  borderLeft: isActive ? '3px solid var(--brand-primary)' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--zw-text)' }}>
                    {patientName(p)}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      padding: '1px 6px',
                      borderRadius: 8,
                      background: priorityColor[t.priority] || 'var(--zw-text-muted)',
                      color: '#fff',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    {priorityLabel[t.priority] || t.priority}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--zw-text-muted)', marginBottom: 2 }}>
                  {t.subject || 'Sans sujet'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--zw-text-faint)' }}>
                  {t.last_message_at
                    ? new Date(t.last_message_at).toLocaleString('fr', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : '—'}
                  {t.status === 'awaiting_staff' && (
                    <span style={{ marginLeft: 6, color: '#dc2626', fontWeight: 600 }}>
                      • À répondre
                    </span>
                  )}
                  {t.status === 'closed' && <span style={{ marginLeft: 6 }}> · fermé</span>}
                </div>
              </button>
            );
          })}
        </aside>

        {/* Active thread */}
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid var(--zw-border)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 600,
          }}
        >
          {activeThread ? (
            <>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--zw-bg-subtle)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--zw-text)' }}>
                  {patientName(activePatient)} — {activeThread.subject || 'Conversation'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--zw-text-faint)', marginTop: 2 }}>
                  Statut : {statusLabel[activeThread.status] || activeThread.status} · Priorité : {priorityLabel[activeThread.priority] || activeThread.priority}
                </div>
              </div>
              <div ref={scrollRef} style={{ flex: 1, padding: 20, overflowY: 'auto', maxHeight: 460 }}>
                {messages.length === 0 && (
                  <p style={{ color: 'var(--zw-text-faint)', textAlign: 'center', marginTop: 80 }}>
                    Aucun message. Envoyez le premier.
                  </p>
                )}
                {messages.map((m) => {
                  const mine = m.sender_role !== 'patient';
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
                          background: mine ? 'var(--brand-primary)' : 'var(--zw-bg-subtle)',
                          color: mine ? '#fff' : 'var(--zw-text)',
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
                            opacity: 0.75,
                            marginTop: 4,
                            textAlign: mine ? 'right' : 'left',
                          }}
                        >
                          {m.sender_role} ·{' '}
                          {new Date(m.created_at).toLocaleTimeString('fr', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form
                onSubmit={handleSend}
                style={{ borderTop: '1px solid var(--zw-border)', padding: 12, display: 'flex', gap: 8 }}
              >
                <input
                  placeholder="Votre message au patient..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={sending}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: '1px solid var(--zw-border)',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 20px',
                    background: input.trim() ? 'var(--brand-primary)' : 'var(--zw-text-faint)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
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
            </>
          ) : (
            <p style={{ color: 'var(--zw-text-faint)', textAlign: 'center', marginTop: 200 }}>
              Sélectionnez une conversation ou démarrez-en une nouvelle.
            </p>
          )}
        </div>
      </div>

      {/* New thread modal */}
      {newOpen && (
        <div
          onClick={() => !creating && setNewOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateThread}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 'min(520px, 92vw)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Nouvelle conversation</h3>
              <button
                type="button"
                onClick={() => !creating && setNewOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--zw-text-soft)', marginBottom: 4, fontWeight: 500 }}>
                Patient *
              </span>
              <select
                required
                value={newPatientId}
                onChange={(e) => setNewPatientId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid var(--zw-border)',
                  borderRadius: 6,
                  fontSize: 14,
                  background: '#fff',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">— Sélectionnez —</option>
                {Object.values(patients).map((p) => (
                  <option key={p.id} value={p.id}>
                    {patientName(p)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--zw-text-soft)', marginBottom: 4, fontWeight: 500 }}>
                Sujet (optionnel)
              </span>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Suivi post-consultation, question sur l'ordonnance…"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid var(--zw-border)',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--zw-text-soft)', marginBottom: 4, fontWeight: 500 }}>
                Premier message (optionnel)
              </span>
              <textarea
                rows={3}
                value={newFirstMessage}
                onChange={(e) => setNewFirstMessage(e.target.value)}
                placeholder="Ecrivez votre premier message..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid var(--zw-border)',
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </label>

            {error && (
              <div style={{ marginTop: 8, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => !creating && setNewOpen(false)}
                disabled={creating}
                style={{
                  padding: '10px 16px',
                  background: '#fff',
                  color: 'var(--zw-text-soft)',
                  border: '1px solid var(--zw-border)',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: creating ? 'not-allowed' : 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={creating}
                style={{
                  padding: '10px 18px',
                  background: 'var(--brand-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? 'Creation…' : 'Demarrer la conversation'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
