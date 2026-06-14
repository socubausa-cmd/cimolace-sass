import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Plus, ArrowUpRight, ArrowUp, Search, MessageSquareText, Trash2,
  PanelLeft, ShieldCheck, ShieldAlert, Check, ChevronDown, Zap, Paperclip,
  BookOpen, BarChart3, Calendar,
} from 'lucide-react';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';
import '../DashboardLiri.css';

// ── Types ────────────────────────────────────────────────────────────────────

type LiriModel =
  | 'deepseek-chat'
  | 'deepseek-reasoner'
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-8'
  | 'claude-haiku-4-5-20251001'
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
  { key: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic',  description: 'Équilibré · rapide',                color: '#c084fc', icon: '⚡' },
  { key: 'claude-opus-4-8',   name: 'Claude Opus 4.8',   provider: 'anthropic',  description: 'Le plus puissant',                  color: '#f472b6', icon: '👑' },
  { key: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', description: 'Léger · économique',           color: '#a78bfa', icon: '🍃' },
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
  const [model, setModel]                   = useState<LiriModel>('claude-sonnet-4-6');
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
  // Refs miroir : lus dans les callbacks SSE / persistance sans dépendre du timing de setState.
  const messagesRef     = useRef<Message[]>([]);
  const activeConvIdRef = useRef<string | null>(null);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

  const base  = getApiBaseUrl();
  const token = authStore.getToken();
  const slug  = authStore.getTenantSlug();

  // Rafraîchit la liste (défait l'enveloppe { data } du ResponseInterceptor — sinon liste toujours vide).
  const refreshConversations = useCallback(() => {
    if (!token) return;
    fetch(`${base}/liri/brain/conversations`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
    })
      .then((r) => r.json())
      .then((data) => {
        const arr = data?.data ?? data;
        setConversations(Array.isArray(arr) ? arr : []);
      })
      .catch(() => {});
  }, [base, token, slug]);

  useEffect(() => { refreshConversations(); }, [refreshConversations]);

  // Persiste le transcript courant (création si pas d'activeConvId, sinon mise à jour) et rafraîchit la liste.
  const persistConversation = useCallback(async (msgs: Message[]) => {
    const clean = msgs
      .filter((m) => m.content && !m.pending)
      .map((m) => ({ role: m.role, content: m.content }));
    if (clean.length < 2) return; // au moins un échange complet
    try {
      const r = await fetch(`${base}/liri/brain/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
        body: JSON.stringify({ conversationId: activeConvIdRef.current ?? undefined, model, messages: clean }),
      });
      const data = await r.json().catch(() => null);
      const conv = data?.data ?? data;
      if (conv?.id) {
        if (!activeConvIdRef.current) { activeConvIdRef.current = conv.id; setActiveConvId(conv.id); }
        refreshConversations();
      }
    } catch { /* persistance best-effort */ }
  }, [base, token, slug, model, refreshConversations]);

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

  const deleteConversation = useCallback(async (id: string) => {
    if (!window.confirm('Supprimer cette conversation ?')) return;
    try {
      await fetch(`${base}/liri/brain/conversations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
      });
    } catch { /* best-effort */ }
    if (activeConvIdRef.current === id) {
      setMessages([]); setActiveConvId(null);
      activeConvIdRef.current = null; messagesRef.current = [];
    }
    refreshConversations();
  }, [base, token, slug, refreshConversations]);

  const currentModel = MODEL_MAP[model];

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const prior = messagesRef.current;   // tours précédents (déjà settlés)
    let assistantText = '';

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
        assistantText += chunk;
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
        // Persiste le tour (création/maj) — uniquement s'il y a une vraie réponse texte
        // (la voie tool_confirm n'a pas encore de réponse → sauvegardée après confirmation).
        if (assistantText.trim()) {
          void persistConversation([
            ...prior,
            { role: 'user', content: text },
            { role: 'assistant', content: assistantText },
          ]);
        }
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
    let resultMsg: Message;
    try {
      const r = await fetch(`${base}/liri/brain/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
        body: JSON.stringify({ name: tool, args }),
      });
      const data = await r.json().catch(() => ({}));
      resultMsg = {
        role: 'assistant',
        content: r.ok ? `✓ Action « ${tool} » exécutée.` : `⚠️ Échec (${r.status}) : ${data?.error?.message ?? data?.message ?? ''}`,
        pending: false,
      };
    } catch (e) {
      resultMsg = { role: 'assistant', content: `⚠️ ${String(e)}`, pending: false };
    }
    setMessages((prev) => [...prev, resultMsg]);
    setStreaming(false);
    void persistConversation([...messagesRef.current, resultMsg]);
  };

  const cancelTool = () => {
    setPendingConfirm(null);
    const msg: Message = { role: 'assistant', content: 'Action annulée.', pending: false };
    setMessages((prev) => [...prev, msg]);
    void persistConversation([...messagesRef.current, msg]);
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
    activeConvIdRef.current = null;   // évite d'appendre au thread précédent si on renvoie aussitôt
    messagesRef.current = [];
  };

  const loadConversation = async (id: string) => {
    setActiveConvId(id);
    activeConvIdRef.current = id;
    const r = await fetch(`${base}/liri/brain/conversations/${id}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
    });
    const json = await r.json();
    const conv = json?.data ?? json;          // défait l'enveloppe { data } du ResponseInterceptor
    if (conv?.messages) {
      setMessages(conv.messages as Message[]);
      if (conv.model) setModel(conv.model as LiriModel);
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
      <span style={{ background: p.bg, color: '#f1eee9', fontSize: 9.5, padding: '2px 7px', borderRadius: 999, fontWeight: 600 }}>
        {p.label}
      </span>
    );
  };

  const activeTitle = conversations.find((c) => c.id === activeConvId)?.title ?? 'Nouvelle conversation';
  const tenantLabel = (slug || 'École').replace(/-/g, ' ');

  const SUGGESTIONS = [
    { icon: Calendar,   text: 'Quels sont les prochains lives ?' },
    { icon: BarChart3,  text: "Donne les statistiques de l'école" },
    { icon: BookOpen,   text: 'Liste les cours disponibles' },
    { icon: Search,     text: 'Cherche dans la base de connaissances' },
  ];

  return (
    <div className="lq-root relative h-[100dvh] w-full overflow-hidden bg-stone-50 text-stone-900">
      {/* fond vivant */}
      <div className="lq-aurora">
        <div className="lq-blob" style={{ width: '46vw', height: '46vw', left: '-8vw', top: '-6vw', background: 'radial-gradient(circle at 30% 30%, #FFD8A8, #FF8A4C 60%, transparent 72%)' }} />
        <div className="lq-blob" style={{ width: '40vw', height: '40vw', right: '-6vw', top: '8vh', background: 'radial-gradient(circle at 50% 50%, #FFC9C9, #F2622E 55%, transparent 70%)', animationDelay: '-8s' }} />
        <div className="lq-blob" style={{ width: '38vw', height: '38vw', left: '30vw', bottom: '-14vw', background: 'radial-gradient(circle at 50% 50%, #E5D4FF, #7C5CFF 55%, transparent 72%)', opacity: .5, animationDelay: '-15s' }} />
      </div>

      <div className="relative z-10 h-full p-3 flex gap-3">

        {/* ───────── SIDEBAR ───────── */}
        {sidebarOpen && (
          <aside className="w-[284px] shrink-0 rounded-[26px] lq-glass lq-hair lq-shadow-glass flex flex-col overflow-hidden">
            <div className="px-5 pt-5 pb-4 flex items-center gap-3">
              <div className="lq-pulse relative grid place-items-center h-11 w-11 rounded-2xl lq-ember lq-iris text-white"><Sparkles size={20} /></div>
              <div>
                <div className="lq-display text-[23px] leading-none font-semibold tracking-tight">LIRI <span className="lq-ember-text">Brain</span></div>
                <div className="text-[11.5px] text-stone-500 mt-1 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> assistant de l'école</div>
              </div>
            </div>

            <div className="px-3.5">
              <button onClick={newConversation} className="lq-lift-hov group w-full flex items-center justify-between rounded-2xl px-4 py-3 text-white lq-ember lq-shadow-lift cursor-pointer">
                <span className="flex items-center gap-2.5 font-medium text-[14px]"><Plus size={17} /> Nouvelle conversation</span>
                <ArrowUpRight size={16} className="opacity-80" />
              </button>
            </div>

            <div className="px-3.5 mt-5 mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Récentes</span>
              <Search size={14} className="text-stone-400" />
            </div>
            <nav className="lq-scroll flex-1 overflow-y-auto px-2.5 space-y-1">
              {conversations.length === 0 ? (
                <p className="text-[12px] text-stone-400 px-3 py-2">Aucune conversation pour l'instant</p>
              ) : conversations.map((conv) => {
                const active = activeConvId === conv.id;
                return (
                  <div key={conv.id} className={`group flex items-center gap-1 rounded-2xl transition ${active ? 'bg-white/70 lq-hair lq-shadow-glass' : 'hover:bg-white/60'}`}>
                    <button onClick={() => void loadConversation(conv.id)} className="flex-1 min-w-0 text-left px-3.5 py-2.5 flex items-center gap-2.5 cursor-pointer">
                      <span className={`grid place-items-center h-7 w-7 rounded-xl shrink-0 ${active ? 'lq-ember text-white' : 'bg-stone-100 text-stone-500'}`}><MessageSquareText size={13} /></span>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium truncate text-stone-800">{conv.title}</div>
                        <div className="text-[11px] text-stone-400 truncate">{MODEL_MAP[conv.model]?.name ?? conv.model}</div>
                      </div>
                    </button>
                    <button onClick={() => void deleteConversation(conv.id)} title="Supprimer la conversation" aria-label="Supprimer" className="opacity-0 group-hover:opacity-100 transition grid place-items-center h-7 w-7 mr-2 rounded-lg text-stone-400 hover:text-red-500 hover:bg-white/70 cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </nav>

            <div className="m-2.5 rounded-2xl lq-glass-soft lq-hair p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid place-items-center h-8 w-8 rounded-xl text-white text-[12px] font-bold shrink-0" style={{ background: 'linear-gradient(135deg,#5b7a52,#6d8f60)' }}>{tenantLabel.slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold truncate capitalize">{tenantLabel}</div><div className="text-[10.5px] text-stone-400">espace assistant LIRI</div></div>
              </div>
              <Link to="/dashboard" className="mt-3 flex items-center gap-1.5 text-[12px] text-stone-500 hover:text-stone-800 transition"><ArrowUpRight size={13} className="rotate-180" /> Retour au dashboard</Link>
            </div>
          </aside>
        )}

        {/* ───────── MAIN ───────── */}
        <main className="flex-1 min-w-0 rounded-[26px] lq-glass lq-hair lq-shadow-glass flex flex-col overflow-hidden relative">

          {/* header */}
          <header className="shrink-0 px-4 sm:px-5 h-[68px] flex items-center justify-between border-b lq-hair">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => setSidebarOpen((v) => !v)} aria-label="Basculer le panneau" className="grid place-items-center h-9 w-9 rounded-xl text-stone-400 hover:text-stone-800 hover:bg-white/60 transition cursor-pointer"><PanelLeft size={18} /></button>
              <div className="min-w-0">
                <h1 className="lq-display text-[18px] font-semibold leading-none truncate">{activeTitle}</h1>
                <div className="text-[11px] text-stone-400 mt-1 flex items-center gap-1.5"><ShieldCheck size={13} className="text-emerald-500" /> tenant isolé · données réelles de l'école</div>
              </div>
            </div>

            <div className="relative shrink-0">
              <button onClick={() => setModelPickerOpen((v) => !v)} className="lq-hov group flex items-center gap-2.5 rounded-2xl lq-glass-soft lq-hair pl-2 pr-3 py-2 cursor-pointer">
                <span className="grid place-items-center h-7 w-7 rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${currentModel.color}, #7C5CFF)` }}><Zap size={14} /></span>
                <span className="text-left leading-tight hidden sm:block"><span className="block text-[13px] font-semibold">{currentModel.name}</span><span className="block text-[10px] text-stone-400">{currentModel.description}</span></span>
                <ChevronDown size={15} className="text-stone-400" />
              </button>
              {modelPickerOpen && (
                <div className="absolute right-0 top-[112%] z-50 w-[300px] rounded-2xl lq-glass lq-hair lq-shadow-lift p-2">
                  {MODELS.map((m) => (
                    <button key={m.key} onClick={() => { setModel(m.key); setModelPickerOpen(false); }} className={`w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition cursor-pointer ${model === m.key ? 'bg-stone-900/[0.05]' : 'hover:bg-white/70'}`}>
                      <span className="grid place-items-center h-7 w-7 rounded-lg text-white shrink-0" style={{ background: `linear-gradient(135deg, ${m.color}, #7C5CFF)` }}><Zap size={13} /></span>
                      <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold truncate">{m.name}</div><div className="text-[11px] text-stone-400 truncate">{m.description}</div></div>
                      {providerBadge(m.provider)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </header>

          {/* thread */}
          <div className="lq-scroll flex-1 overflow-y-auto px-4 sm:px-5 py-7" onClick={() => setModelPickerOpen(false)}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <div className="lq-pulse relative grid place-items-center h-[72px] w-[72px] rounded-[22px] lq-ember lq-iris text-white"><Sparkles size={32} /></div>
                <h2 className="lq-display text-[30px] font-semibold tracking-tight">Bonjour, je suis <span className="lq-ember-text">LIRI</span></h2>
                <p className="text-stone-500 text-[14.5px] leading-relaxed max-w-[440px]">Ton copilote pour l'école : pose une question, explore tes cours, lives, rendez-vous, le forum ou la base de connaissances. Je peux aussi agir — toujours avec ta confirmation.</p>
                <div className="flex flex-wrap gap-2 justify-center mt-2 max-w-[540px]">
                  {SUGGESTIONS.map(({ icon: Icon, text }) => (
                    <button key={text} onClick={() => { setInput(text); textareaRef.current?.focus(); }} className="lq-hov flex items-center gap-2 rounded-full lq-glass-soft lq-hair px-3.5 py-2 text-[12.5px] text-stone-600 cursor-pointer">
                      <Icon size={14} style={{ color: '#F2622E' }} /> {text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-[760px] space-y-6">
                {messages.map((msg, i) => (
                  msg.role === 'user' ? (
                    <div key={i} className="lq-rise flex justify-end">
                      <div className="max-w-[80%] rounded-[22px] rounded-tr-lg bg-stone-900 text-stone-50 px-5 py-3.5 lq-shadow-lift">
                        <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="lq-rise flex gap-3.5">
                      <div className="shrink-0 grid place-items-center h-10 w-10 rounded-2xl lq-ember lq-iris text-white"><Sparkles size={18} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="rounded-[22px] rounded-tl-lg bg-white/80 lq-hair lq-shadow-glass px-5 py-4">
                          {msg.content && <p className="text-[14.5px] leading-[1.75] text-stone-700 whitespace-pre-wrap break-words">{msg.content}</p>}
                          {msg.pending && (
                            <div className="inline-flex items-center gap-2 text-[13px] text-stone-500">
                              <span className="lq-dot" /><span className="lq-dot" /><span className="lq-dot" /><span className="ml-1">LIRI réfléchit…</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* carte de confirmation (tool_confirm) */}
          {pendingConfirm && (
            <div className="px-4 sm:px-5 pb-3">
              <div className="mx-auto max-w-[760px] rounded-2xl p-4" style={{ border: '1px solid rgba(242,98,46,.3)', background: 'linear-gradient(180deg, rgba(242,98,46,.08), transparent)' }}>
                <div className="flex items-center gap-2 text-[12px] font-semibold mb-2.5" style={{ color: '#C2410C' }}><ShieldAlert size={15} /> Action à confirmer · {pendingConfirm.tool}</div>
                <pre className="lq-scroll rounded-xl bg-white/80 lq-hair p-3 text-[12px] text-stone-600 overflow-x-auto mb-3.5 whitespace-pre-wrap break-words" style={{ fontFamily: 'ui-monospace, monospace' }}>{JSON.stringify(pendingConfirm.args, null, 2)}</pre>
                <div className="flex items-center gap-2.5">
                  <button onClick={() => void confirmTool()} disabled={streaming} className="lq-lift-hov flex items-center gap-2 rounded-xl lq-ember text-white px-4 py-2 text-[13px] font-medium lq-shadow-lift disabled:opacity-60 cursor-pointer"><Check size={15} /> Confirmer &amp; exécuter</button>
                  <button onClick={cancelTool} className="rounded-xl px-4 py-2 text-[13px] text-stone-500 hover:text-stone-900 transition cursor-pointer">Annuler</button>
                </div>
              </div>
            </div>
          )}

          {/* composer */}
          <div className="shrink-0 px-4 sm:px-5 pb-5 pt-1">
            <div className="mx-auto max-w-[760px]">
              {messages.length > 0 && (
                <div className="lq-scroll flex items-center gap-2 mb-2.5 overflow-x-auto pb-0.5">
                  {SUGGESTIONS.slice(0, 3).map(({ icon: Icon, text }) => (
                    <button key={text} onClick={() => { setInput(text); textareaRef.current?.focus(); }} className="lq-hov shrink-0 flex items-center gap-1.5 rounded-full lq-glass-soft lq-hair px-3 py-1.5 text-[12.5px] text-stone-600 cursor-pointer"><Icon size={13} style={{ color: '#F2622E' }} /> {text}</button>
                  ))}
                </div>
              )}
              <div className="lq-input rounded-[24px] lq-glass lq-hair lq-shadow-glass p-2 pl-3.5 flex items-end gap-2">
                <button aria-label="Joindre un fichier" className="grid place-items-center h-10 w-10 rounded-2xl text-stone-400 hover:bg-white/70 transition cursor-pointer" style={{ }}><Paperclip size={19} /></button>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pose ta question à LIRI…  (Entrée pour envoyer · Maj+Entrée = nouvelle ligne)"
                  disabled={streaming}
                  rows={1}
                  className="flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-relaxed text-stone-900 placeholder:text-stone-400 focus:outline-none max-h-[200px] overflow-auto"
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || streaming}
                  aria-label="Envoyer"
                  className={`grid place-items-center h-11 w-11 rounded-2xl text-white transition shrink-0 ${input.trim() && !streaming ? 'lq-ember lq-shadow-lift lq-lift-hov cursor-pointer' : 'bg-stone-300 cursor-default'}`}
                >
                  {streaming ? <span className="lq-dot" style={{ background: '#fff' }} /> : <ArrowUp size={20} />}
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-stone-400">
                Modèle : <strong className="text-stone-600">{currentModel.name}</strong> · LIRI consulte cours, forum, lives, RDV et la base de connaissances · les écritures demandent confirmation
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
