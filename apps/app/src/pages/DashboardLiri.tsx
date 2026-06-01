import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { authStore } from '../lib/auth-store';
import { getApiBaseUrl } from '../lib/apiBase';

// ── Types ────────────────────────────────────────────────────────────────────

type LiriModel =
  | 'deepseek-chat'
  | 'deepseek-reasoner'
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-20250514'
  | 'gpt-4o'
  | 'gpt-4o-mini';

interface ModelInfo {
  key: LiriModel;
  name: string;
  provider: 'deepseek' | 'anthropic' | 'openai';
  description: string;
  color: string;
  icon: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  model: LiriModel;
  updated_at: string;
}

// ── Model catalog ─────────────────────────────────────────────────────────────

const MODELS: ModelInfo[] = [
  { key: 'deepseek-chat',         name: 'DeepSeek V4',        provider: 'deepseek',   description: 'Généraliste · 1M tokens',         color: '#4f8ef7', icon: '🔷' },
  { key: 'deepseek-reasoner',     name: 'DeepSeek Reasoner',  provider: 'deepseek',   description: 'Raisonnement profond',              color: '#2dd4bf', icon: '🧠' },
  { key: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic',  description: 'Équilibré · rapide',                color: '#c084fc', icon: '⚡' },
  { key: 'claude-opus-4-20250514',   name: 'Claude Opus 4',   provider: 'anthropic',  description: 'Le plus puissant',                  color: '#f472b6', icon: '👑' },
  { key: 'gpt-4o',                name: 'GPT-4o',             provider: 'openai',     description: 'Multimodal · polyvalent',           color: '#34d399', icon: '🌐' },
  { key: 'gpt-4o-mini',           name: 'GPT-4o Mini',        provider: 'openai',     description: 'Léger · économique',                color: '#86efac', icon: '⚡' },
];

const MODEL_MAP = Object.fromEntries(MODELS.map((m) => [m.key, m])) as Record<LiriModel, ModelInfo>;

// ── SSE streaming helper ──────────────────────────────────────────────────────

async function streamLiriBrain(
  message: string,
  model: LiriModel,
  conversationId: string | null,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
  onToolConfirm: (c: { tool: string; args: Record<string, unknown> }) => void,
): Promise<void> {
  const base = getApiBaseUrl();
  const token = authStore.getToken();
  const slug = authStore.getTenantSlug();

  const params = new URLSearchParams({ message, model });
  params.set('tools', '1'); // active la boucle function-calling (outils École/LIRI)
  if (conversationId) params.set('conversationId', conversationId);

  const url = `${base}/liri/brain/chat?${params.toString()}`;

  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': slug,
        Accept: 'text/event-stream',
      },
    });

    if (!resp.ok) {
      onError(`Erreur API : ${resp.status} ${resp.statusText}`);
      return;
    }

    const reader = resp.body?.getReader();
    if (!reader) { onError('Pas de réponse streaming.'); return; }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const parsed: { content: string; done: boolean } = JSON.parse(trimmed.slice(6));
          if (parsed.content) {
            let tc: { type?: string; tool?: string; args?: Record<string, unknown> } | null = null;
            try { const o = JSON.parse(parsed.content); if (o && o.type === 'tool_confirm') tc = o; } catch { /* texte normal */ }
            if (tc?.tool) onToolConfirm({ tool: tc.tool, args: tc.args ?? {} });
            else onChunk(parsed.content);
          }
          if (parsed.done) { onDone(); return; }
        } catch { /* skip */ }
      }
    }
    onDone();
  } catch (err) {
    onError(String(err));
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardLiri() {
  const [model, setModel]                   = useState<LiriModel>('claude-sonnet-4-20250514');
  const [messages, setMessages]             = useState<Message[]>([]);
  const [input, setInput]                   = useState('');
  const [streaming, setStreaming]           = useState(false);
  const [conversations, setConversations]   = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId]     = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen]       = useState(true);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm]   = useState<{ tool: string; args: Record<string, unknown> } | null>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const base  = getApiBaseUrl();
  const token = authStore.getToken();
  const slug  = authStore.getTenantSlug();

  // Load conversations
  useEffect(() => {
    if (!token) return;
    fetch(`${base}/liri/brain/conversations`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
    })
      .then((r) => r.json())
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [base, token, slug]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const currentModel = MODEL_MAP[model];

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setStreaming(true);

    // Add empty assistant message that will fill in
    setMessages((prev) => [...prev, { role: 'assistant', content: '', pending: true }]);

    await streamLiriBrain(
      text,
      model,
      activeConvId,
      (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + chunk, pending: false };
          }
          return updated;
        });
      },
      () => {
        setStreaming(false);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, pending: false };
          }
          return updated;
        });
      },
      (err) => {
        setStreaming(false);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: `⚠️ ${err}`, pending: false };
          return updated;
        });
      },
      (confirm) => {
        // Action d'écriture proposée par l'IA → on attend la confirmation utilisateur.
        setStreaming(false);
        setPendingConfirm(confirm);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: last.content || 'Action prête — confirmation requise ci-dessous.',
              pending: false,
            };
          }
          return updated;
        });
      },
    );
  };

  const confirmTool = async () => {
    if (!pendingConfirm) return;
    const { tool, args } = pendingConfirm;
    setPendingConfirm(null);
    setStreaming(true);
    try {
      const r = await fetch(`${base}/liri/brain/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
        body: JSON.stringify({ name: tool, args }),
      });
      const data = await r.json().catch(() => ({}));
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: r.ok ? `✓ Action « ${tool} » exécutée.` : `⚠️ Échec (${r.status}) : ${data?.message ?? ''}`,
        pending: false,
      }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${String(e)}`, pending: false }]);
    } finally {
      setStreaming(false);
    }
  };

  const cancelTool = () => {
    setPendingConfirm(null);
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Action annulée.', pending: false }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const newConversation = () => {
    setMessages([]);
    setActiveConvId(null);
  };

  const loadConversation = async (id: string) => {
    setActiveConvId(id);
    const r = await fetch(`${base}/liri/brain/conversations/${id}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
    });
    const data = await r.json();
    if (data?.messages) {
      setMessages(data.messages as Message[]);
      if (data.model) setModel(data.model as LiriModel);
    }
  };

  const providerBadge = (provider: string) => {
    const map: Record<string, { label: string; bg: string }> = {
      deepseek:  { label: 'DeepSeek',  bg: '#1e3a5f' },
      anthropic: { label: 'Anthropic', bg: '#3b1f4f' },
      openai:    { label: 'OpenAI',    bg: '#1a3d2f' },
    };
    const p = map[provider] ?? { label: provider, bg: '#1f2937' };
    return (
      <span style={{ background: p.bg, color: '#d1d5db', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
        {p.label}
      </span>
    );
  };

  return (
    <div style={{
      display: 'flex', height: '100dvh', background: '#030711', color: '#e5e7eb',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <aside style={{
          width: 240, minWidth: 240, background: '#050a16', borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Logo */}
          <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                boxShadow: '0 0 20px -6px rgba(124,58,237,0.8)',
              }}>✦</div>
              <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em' }}>LIRI</span>
            </div>
            <p style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>Assistant IA multi-modèles</p>
          </div>

          {/* New chat button */}
          <div style={{ padding: '12px 12px 8px' }}>
            <button
              onClick={newConversation}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
                color: '#a78bfa', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 16 }}>+</span> Nouvelle conversation
            </button>
          </div>

          {/* Conversation history */}
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}>
            {conversations.length === 0 ? (
              <p style={{ fontSize: 11, color: '#4b5563', padding: '8px 8px' }}>Aucune conversation sauvegardée</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => void loadConversation(conv.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8,
                    background: activeConvId === conv.id ? 'rgba(124,58,237,0.15)' : 'transparent',
                    border: activeConvId === conv.id ? '1px solid rgba(124,58,237,0.25)' : '1px solid transparent',
                    color: '#d1d5db', fontSize: 12, cursor: 'pointer', marginBottom: 2,
                    display: 'block',
                  }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {conv.title}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 10, marginTop: 2 }}>
                    {MODEL_MAP[conv.model]?.name ?? conv.model}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Back link */}
          <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <Link to="/dashboard" style={{ color: '#6b7280', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              ← Retour au dashboard
            </Link>
          </div>
        </aside>
      )}

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(5,10,22,0.6)', backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18, padding: 4 }}
            >☰</button>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>LIRI Brain</h1>
          </div>

          {/* Model selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setModelPickerOpen((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                borderRadius: 8, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)', color: '#e5e7eb',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <span style={{ color: currentModel.color }}>{currentModel.icon}</span>
              {currentModel.name}
              {providerBadge(currentModel.provider)}
              <span style={{ color: '#6b7280', fontSize: 10 }}>▼</span>
            </button>

            {modelPickerOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '110%', zIndex: 50,
                background: '#0d1526', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: 8, width: 280,
                boxShadow: '0 20px 60px -10px rgba(0,0,0,0.8)',
              }}>
                {MODELS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => { setModel(m.key); setModelPickerOpen(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 12px',
                      borderRadius: 8,
                      background: model === m.key ? 'rgba(124,58,237,0.15)' : 'transparent',
                      border: model === m.key ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
                      color: '#e5e7eb', cursor: 'pointer', marginBottom: 2,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: m.color, fontSize: 16 }}>{m.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                        <div style={{ color: '#6b7280', fontSize: 11 }}>{m.description}</div>
                      </div>
                      {providerBadge(m.provider)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 20px' }} onClick={() => setModelPickerOpen(false)}>
          {messages.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: 16,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
                boxShadow: '0 0 40px -10px rgba(124,58,237,0.6)',
              }}>✦</div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
                Bonjour, je suis LIRI
              </h2>
              <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', maxWidth: 400, margin: 0 }}>
                Votre assistant IA multi-modèles. Posez-moi une question, demandez une analyse,
                créez du contenu pédagogique, ou explorez vos données.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                {[
                  '📚 Crée un plan de cours',
                  '🔬 Analyse ce texte',
                  '✍️ Rédige une introduction',
                  '🧠 Explique ce concept',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion.slice(3)); textareaRef.current?.focus(); }}
                    style={{
                      padding: '8px 14px', borderRadius: 20,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#d1d5db', fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    gap: 12, alignItems: 'flex-start',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                      : 'linear-gradient(135deg, #7c3aed, #c084fc)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700,
                  }}>
                    {msg.role === 'user' ? 'U' : '✦'}
                  </div>

                  {/* Bubble */}
                  <div style={{
                    maxWidth: '75%',
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                      : 'rgba(255,255,255,0.05)',
                    border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    fontSize: 14, lineHeight: 1.6,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {msg.content}
                    {msg.pending && (
                      <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4 }}>
                        {[0, 1, 2].map((j) => (
                          <span key={j} style={{
                            width: 4, height: 4, borderRadius: '50%', background: '#9ca3af',
                            animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite`,
                          }}/>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Confirmation d'action (tool_confirm de la boucle function-calling) */}
        {pendingConfirm && (
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', borderRadius: 14, border: '1px solid rgba(217,119,87,0.4)', background: 'rgba(217,119,87,0.10)', padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#e0795f' }}>Action à confirmer</div>
              <div style={{ marginTop: 6, fontSize: 13.5, color: '#e5e7eb' }}>
                Outil <code style={{ color: '#e0795f' }}>{pendingConfirm.tool}</code>
                <span style={{ color: '#9ca3af' }}> · {JSON.stringify(pendingConfirm.args)}</span>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button onClick={() => void confirmTool()} disabled={streaming} style={{ padding: '6px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg,#d97757,#c2683f)' }}>Confirmer &amp; exécuter</button>
                <button onClick={cancelTool} style={{ padding: '6px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#9ca3af', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Annuler</button>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{
          padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(5,10,22,0.8)', backdropFilter: 'blur(12px)',
        }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-end',
              background: 'rgba(255,255,255,0.05)', borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px',
            }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Écris ton message... (Entrée pour envoyer, Shift+Entrée pour retour à la ligne)"
                disabled={streaming}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: '#e5e7eb', fontSize: 14, lineHeight: 1.6, resize: 'none',
                  minHeight: 24, maxHeight: 200, overflow: 'auto',
                  fontFamily: 'inherit',
                }}
                rows={1}
              />
              <button
                onClick={() => void sendMessage()}
                disabled={!input.trim() || streaming}
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: input.trim() && !streaming
                    ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                    : 'rgba(255,255,255,0.08)',
                  border: 'none', cursor: input.trim() && !streaming ? 'pointer' : 'default',
                  color: 'white', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                {streaming ? '⏳' : '↑'}
              </button>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#4b5563', textAlign: 'center' }}>
              Modèle actif : <strong style={{ color: currentModel.color }}>{currentModel.name}</strong> · {currentModel.description}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>
    </div>
  );
}
