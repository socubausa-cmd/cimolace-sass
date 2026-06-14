import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  streamLongiaHub,
  buildLongiaHubV1,
  LONGIA_SURFACE,
  LONGIA_CAPABILITY,
  LONGIA_ENGINE_ROLE,
} from '@/lib/longiaHub';
import { parseLongiaDesignerCanvasActions } from '../lib/parseLongiaDesignerCanvasActions';
import { parseCopilotReplyToSuggestions, buildGuideIaSummaryBlock } from '../lib/parseCopilotReplyToSuggestions';
import { useDesignerCopilotPresenceStore } from '../store/useDesignerCopilotPresenceStore';
import { fetchLongiaChatThread, upsertLongiaChatThread } from '@/lib/longiaChatThreadPersistence';

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `ldcc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function welcomeMessage(lang) {
  return {
    id: 'welcome',
    role: 'assistant',
    text:
      lang === 'en'
        ? 'Ask me about layout, pedagogy, or your slide. I see your scene context. I can suggest text or shapes on the canvas when you ask explicitly. Enable RAG to ground answers in your knowledge base.'
        : 'Parle-moi de ta mise en page, de ta pédagogie ou de ton slide : j\'ai le contexte de ta scène. Active la base documentaire (RAG) pour t\'appuyer sur tes contenus indexés. Pour écrire ou placer des formes sur le canvas, demande-le explicitement.',
    streaming: false,
    pendingActions: null,
  };
}

const SUPPORTED_CANVAS_ACTION_TYPES = new Set([
  'add_text',
  'add_rect',
  'add_circle',
  'add_image',
  'delete_selected',
  'go_slide',
  'group_selected',
  'unite_selected',
]);

function filterSupportedCanvasActions(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((a) => a && SUPPORTED_CANVAS_ACTION_TYPES.has(String(a.type || '').trim()));
}

function inferFallbackCanvasActionsFromPrompt(prompt) {
  const q = String(prompt || '').toLowerCase().trim();
  if (!q) return [];
  const asksCanvasAction =
    /(g[ée]n[èe]re|ajoute|dessine|cr[ée]e|mets|fabrique|place)/i.test(q);
  if (!asksCanvasAction) return [];

  if (/(ballon|balloon)/i.test(q)) {
    return [
      { type: 'add_circle', x: 420, y: 220, radius: 120, fill: '#e74c3c', stroke: '#b9382a', strokeWidth: 3 },
      { type: 'add_circle', x: 390, y: 190, radius: 44, fill: 'rgba(255,255,255,0.18)', stroke: 'rgba(255,255,255,0)', strokeWidth: 0 },
      { type: 'add_circle', x: 360, y: 165, radius: 16, fill: 'rgba(255,255,255,0.45)', stroke: 'rgba(255,255,255,0)', strokeWidth: 0 },
      { type: 'add_rect', x: 410, y: 340, width: 20, height: 16, fill: '#c0392b', stroke: '#a93226', strokeWidth: 1, cornerRadius: 3 },
      { type: 'add_rect', x: 418, y: 356, width: 4, height: 140, fill: '#c9d1d9', stroke: '#9aa4ad', strokeWidth: 1, cornerRadius: 2 },
      { type: 'add_rect', x: 352, y: 330, width: 150, height: 26, fill: 'rgba(0,0,0,0.14)', stroke: 'rgba(0,0,0,0)', strokeWidth: 0, cornerRadius: 999 },
    ];
  }
  if (/(cercle|circle|rond)/i.test(q)) {
    return [{ type: 'add_circle', x: 360, y: 220, radius: 100, fill: '#60a5fa', stroke: '#3b82f6', strokeWidth: 3 }];
  }
  if (/(rectangle|rect|carr[ée])/i.test(q)) {
    return [{ type: 'add_rect', x: 260, y: 160, width: 220, height: 150, fill: 'rgba(212,175,55,0.2)', stroke: '#D4AF37', strokeWidth: 3, cornerRadius: 12 }];
  }
  if (/(titre|texte|text)/i.test(q)) {
    return [{ type: 'add_text', text: 'Titre', fontSize: 38, x: 120, y: 100, fontWeight: 700, fill: '#F7F2E8' }];
  }
  if (/(fusion|fusionne|regroup|regroupe|groupe|grouper)/i.test(q)) {
    return [{ type: 'group_selected' }];
  }
  if (/(image|photo|illustration|png|jpeg|jpg)/i.test(q)) {
    return [
      {
        type: 'add_image',
        url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=640&q=70',
        x: 140,
        y: 100,
        width: 360,
        height: 220,
      },
    ];
  }
  return [];
}

/**
 * Chat COACH SLIDE (streaming) — pipeline unifié `studio-longia-chat-stream` + couche designer (`designer_konva_assist`).
 */
export default function LongiaDesignerChatSection({
  supabase,
  getContext,
  onApplyCanvasActions,
  className,
  /** Surcharge la zone scroll des messages (ex. flex-1 + max-h-none dans un panneau latéral). */
  messagesScrollClassName,
  lang = 'fr',
  scopeType = 'designer',
  scopeId = 'local-konva',
}) {
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const streamWatchdogRef = useRef(null);
  const lastSubmittedPromptRef = useRef('');
  const streamingBufRef = useRef('');
  const persistTimerRef = useRef(null);

  const takePendingCoachArchitectHandoff = useDesignerCopilotPresenceStore((s) => s.takePendingCoachArchitectHandoff);
  const setCopilotEngaged = useDesignerCopilotPresenceStore((s) => s.setCopilotEngaged);
  const setPresenceMode = useDesignerCopilotPresenceStore((s) => s.setPresenceMode);
  const setArchitectCopilotItems = useDesignerCopilotPresenceStore((s) => s.setArchitectCopilotItems);
  const setGuideIaCopilotSummary = useDesignerCopilotPresenceStore((s) => s.setGuideIaCopilotSummary);
  const centralIdea = useDesignerCopilotPresenceStore((s) => s.centralIdea);

  const [messages, setMessages] = useState(() => [welcomeMessage(lang)]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingPreview, setStreamingPreview] = useState('');
  const [err, setErr] = useState('');
  const [useRag, setUseRag] = useState(false);
  const [threadLoaded, setThreadLoaded] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, streamingPreview]);

  useEffect(() => {
    setMessages([welcomeMessage(lang)]);
    setThreadLoaded(false);
    if (!supabase || !scopeId) {
      setThreadLoaded(true);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { row } = await fetchLongiaChatThread(supabase, scopeType, scopeId);
      if (cancelled) return;
      if (row?.messages?.length) {
        const restored = row.messages.map((m) => ({
          id: m.id || newId(),
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: String(m.text || ''),
          streaming: false,
          pendingActions: null,
        }));
        setMessages(restored);
      }
      setThreadLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, scopeType, scopeId, lang]);

  const persistMessages = useCallback(
    (list) => {
      if (!supabase || !scopeId || !threadLoaded) return;
      const toSave = list
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.streaming && m.id !== 'welcome')
        .map((m) => ({ id: m.id, role: m.role, text: m.text }));
      void upsertLongiaChatThread(supabase, scopeType, scopeId, toSave);
    },
    [supabase, scopeType, scopeId, threadLoaded],
  );

  useEffect(() => {
    if (!threadLoaded || streaming) return undefined;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistMessages(messages);
    }, 600);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [messages, streaming, threadLoaded, persistMessages]);

  const send = useCallback(async (forcedText = null) => {
    const text = String(forcedText ?? input).trim();
    if (!text || streaming || !supabase) return;
    if (forcedText == null) setInput('');
    setErr('');
    lastSubmittedPromptRef.current = text;
    const userMsg = { id: newId(), role: 'user', text, streaming: false, pendingActions: null };
    setMessages((prev) => [...prev, userMsg]);

    const handoff = takePendingCoachArchitectHandoff();
    const baseCtx = typeof getContext === 'function' ? getContext() : {};
    const context = {
      ...baseCtx,
      designer_konva_assist: true,
      lang,
      ...(handoff && typeof handoff === 'object' ? { coach_architect_handoff: handoff } : {}),
    };

    const apiMessages = [...messages, userMsg]
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.text }));

    if (apiMessages.length === 0 || apiMessages[apiMessages.length - 1]?.role !== 'user') {
      setErr(lang === 'en' ? 'Invalid thread.' : 'Fil de discussion invalide.');
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    if (streamWatchdogRef.current) {
      clearTimeout(streamWatchdogRef.current);
      streamWatchdogRef.current = null;
    }
    streamingBufRef.current = '';
    setStreaming(true);
    setStreamingPreview('');
    setCopilotEngaged(true);
    setPresenceMode('streaming');

    const placeholderId = newId();
    setMessages((prev) => [
      ...prev,
      { id: placeholderId, role: 'assistant', text: '', streaming: true, pendingActions: null },
    ]);

    const armWatchdog = (ms = 20000) => {
      if (streamWatchdogRef.current) clearTimeout(streamWatchdogRef.current);
      streamWatchdogRef.current = setTimeout(() => {
        try {
          abortRef.current?.abort();
        } catch {
          // ignore abort issues
        }
        setErr(lang === 'en' ? 'No response from LONGIA (timeout).' : 'Aucune reponse de LONGIA (timeout).');
        setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
        setStreamingPreview('');
        setStreaming(false);
        setCopilotEngaged(false);
        setPresenceMode('idle');
      }, ms);
    };
    armWatchdog(20000);

    await streamLongiaHub({
      supabase,
      mode: 'coach',
      messages: apiMessages,
      context,
      longiaHub: buildLongiaHubV1({
        surface: LONGIA_SURFACE.STUDIO_KONVA,
        mode: 'coach',
        engines: [LONGIA_ENGINE_ROLE.COACH],
        capabilities: [
          LONGIA_CAPABILITY.STREAMING_SSE,
          LONGIA_CAPABILITY.CANVAS_ACTIONS_KONVA,
          ...(useRag ? [LONGIA_CAPABILITY.RAG] : []),
        ],
      }),
      useRag,
      signal: abortRef.current.signal,
      onChunk: (chunk) => {
        armWatchdog(20000);
        streamingBufRef.current += chunk;
        setStreamingPreview(streamingBufRef.current);
      },
      onDone: () => {
        if (streamWatchdogRef.current) {
          clearTimeout(streamWatchdogRef.current);
          streamWatchdogRef.current = null;
        }
        const full = streamingBufRef.current;
        const { displayText, actions } = parseLongiaDesignerCanvasActions(full);
        const fallbackActions = actions.length === 0 ? inferFallbackCanvasActionsFromPrompt(text) : [];
        const merged = actions.length > 0 ? actions : fallbackActions;
        const finalActions = filterSupportedCanvasActions(merged);
        const baseText = displayText || (lang === 'en' ? '(empty reply)' : '(réponse vide)');
        const unsupported =
          Array.isArray(merged) && merged.length > 0 && finalActions.length === 0;
        const textWithHint = unsupported
          ? `${baseText}${lang === 'en' ? '\n\n(No supported canvas actions in this reply — only text/rect/circle/image.)' : '\n\n(Aucune action canvas reconnue dans cette réponse — types supportés : texte, rectangle, cercle, image.)'}`
          : finalActions.length > 0
            ? `${baseText}${lang === 'en' ? '\n\n— Use the gold button below to add this to your canvas.' : '\n\n— Utilisez le bouton doré ci-dessous pour ajouter cela au canvas.'}`
            : baseText;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  text: textWithHint,
                  streaming: false,
                  pendingActions: finalActions.length > 0 ? finalActions : null,
                  appliedCount: undefined,
                }
              : m,
          ),
        );
        setStreamingPreview('');
        setStreaming(false);
        setCopilotEngaged(false);
        setPresenceMode('idle');
        setArchitectCopilotItems(parseCopilotReplyToSuggestions(displayText));
        setGuideIaCopilotSummary(buildGuideIaSummaryBlock(displayText, centralIdea));
      },
      onError: (e) => {
        if (streamWatchdogRef.current) {
          clearTimeout(streamWatchdogRef.current);
          streamWatchdogRef.current = null;
        }
        setErr(e?.message || String(e));
        setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
        setStreamingPreview('');
        setStreaming(false);
        setCopilotEngaged(false);
        setPresenceMode('idle');
      },
    });
  }, [
    input,
    streaming,
    supabase,
    messages,
    getContext,
    useRag,
    takePendingCoachArchitectHandoff,
    lang,
    setCopilotEngaged,
    setPresenceMode,
    setArchitectCopilotItems,
    setGuideIaCopilotSummary,
    centralIdea,
  ]);

  const retryLast = useCallback(() => {
    const last = String(lastSubmittedPromptRef.current || '').trim();
    if (!last || streaming) return;
    void send(last);
  }, [send, streaming]);

  useEffect(() => {
    return () => {
      if (streamWatchdogRef.current) clearTimeout(streamWatchdogRef.current);
    };
  }, []);

  const applyPending = useCallback(
    (msgId, actions) => {
      if (!actions?.length || typeof onApplyCanvasActions !== 'function') return;
      const n = onApplyCanvasActions(actions);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, pendingActions: null, appliedCount: n } : m)),
      );
    },
    [onApplyCanvasActions],
  );

  return (
    <div className={cn('flex min-h-0 flex-col rounded-xl border border-cyan-500/20 bg-[#0a0f16]/90 p-2.5', className)}>
      <div className="mb-2 flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-cyan-300/80" />
        <p className="text-[11px] font-semibold text-cyan-100/90">LONGIA — Dialogue (COACH SLIDE)</p>
      </div>
      <label className="mb-2 flex cursor-pointer items-center gap-2 text-[10px] text-white/55">
        <input
          type="checkbox"
          checked={useRag}
          onChange={(e) => setUseRag(e.target.checked)}
          className="rounded border-white/20 bg-black/40"
        />
        {lang === 'en' ? 'Knowledge base (RAG)' : 'Base documentaire (RAG)'}
      </label>
      <p className="mb-2 text-[9px] leading-snug text-white/40">
        {lang === 'en'
          ? 'Streaming · studio-longia-chat-stream · optional RAG · thread saved when logged in.'
          : 'Streaming · studio-longia-chat-stream · RAG optionnel · fil sauvegardé si connecté.'}
      </p>

      <div
        ref={scrollRef}
        className={cn(
          'mb-2 max-h-[200px] min-h-[100px] space-y-2 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/35 p-2 [scrollbar-width:thin]',
          messagesScrollClassName,
        )}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'rounded-lg px-2 py-1.5 text-[11px] leading-snug',
              m.role === 'user' ? 'ml-4 bg-violet-950/40 text-violet-100/90' : 'mr-4 bg-white/[0.04] text-white/80',
            )}
          >
            {m.streaming ? (
              <span className="text-white/50">
                {streamingPreview || (lang === 'en' ? '…' : '…')}
                <Loader2 className="ml-1 inline h-3 w-3 animate-spin text-cyan-400/70" />
              </span>
            ) : (
              <p className="whitespace-pre-wrap">{m.text}</p>
            )}
            {!m.streaming && m.pendingActions?.length ? (
              <>
                <p className="mt-2 text-[10px] font-medium text-[color-mix(in_srgb,var(--school-accent)_95%,transparent)]">
                  {lang === 'en' ? 'Action on canvas' : 'Action sur le canvas'}
                </p>
                <button
                  type="button"
                  onClick={() => applyPending(m.id, m.pendingActions)}
                  className="mt-1 w-full cursor-pointer rounded-md border border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] bg-gradient-to-r from-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] to-amber-600/15 py-2 text-[11px] font-semibold text-[#f5dd8a] shadow-[0_0_0_1px_rgba(212,175,55,0.15)] hover:from-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] hover:to-amber-600/25"
                >
                  {lang === 'en'
                    ? `Tap here — add ${m.pendingActions.length} shape(s) to the slide`
                    : `Cliquer ici — ajouter ${m.pendingActions.length} forme(s) au slide`}
                </button>
              </>
            ) : null}
            {typeof m.appliedCount === 'number' ? (
              <p className="mt-1 text-[9px] text-emerald-400/80">
                {lang === 'en' ? `${m.appliedCount} applied.` : `${m.appliedCount} action(s) appliquée(s).`}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {err ? (
        <div className="mb-2 flex shrink-0 items-center gap-2">
          <p className="min-w-0 flex-1 text-[9px] text-rose-400/90">{err}</p>
          <button
            type="button"
            onClick={retryLast}
            disabled={streaming || !lastSubmittedPromptRef.current}
            className="rounded border border-rose-300/35 bg-rose-900/20 px-2 py-1 text-[9px] font-medium text-rose-200 hover:bg-rose-900/35 disabled:opacity-40"
          >
            {lang === 'en' ? 'Retry' : 'Réessayer'}
          </button>
        </div>
      ) : null}

      <div className="flex shrink-0 gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          disabled={streaming}
          placeholder={lang === 'en' ? 'Message to LONGIA…' : 'Message à LONGIA…'}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:border-cyan-500/35 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          disabled={streaming || !input.trim()}
          onClick={() => void send()}
          className="flex shrink-0 items-center justify-center rounded-lg border border-cyan-500/35 bg-cyan-950/40 px-2.5 py-1.5 text-cyan-100 hover:bg-cyan-900/50 disabled:opacity-40"
          title={lang === 'en' ? 'Send' : 'Envoyer'}
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
