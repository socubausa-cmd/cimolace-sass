import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, AlertCircle, MessageCircle, Bot, Download, Clock, ThumbsDown, Lock, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import type { MindMapNode } from '@/components/lesson-player/types';

type TranscriptLine = { t?: string; x?: string; text?: string; timeSeconds?: number };
type SourceRef = { time: string; timeSeconds: number; text: string };
type MsgType = 'answer' | 'offtopic' | 'other_level';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  msgType?: MsgType;
  sources?: SourceRef[];
};

type MiniPlayer = { timeSeconds: number };

function buildEmbedUrl(videoUrl: string, timeSeconds: number): { type: 'iframe' | 'video'; url: string } {
  const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return { type: 'iframe', url: `https://www.youtube.com/embed/${ytMatch[1]}?start=${Math.floor(timeSeconds)}&autoplay=1` };
  }
  const vimeoMatch = videoUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return { type: 'iframe', url: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1#t=${Math.floor(timeSeconds)}s` };
  }
  return { type: 'video', url: videoUrl };
}

type Props = {
  videoTitle?: string;
  transcript?: TranscriptLine[];
  mindmap?: MindMapNode | null;
  videoUrl?: string;
  onSwitchToManual?: (prefill?: string) => void;
  onSeek?: (seconds: number) => void;
};

function flattenMindmapText(node: MindMapNode | null | undefined, depth = 0): string {
  if (!node) return '';
  const indent = '  '.repeat(depth);
  const lines: string[] = [`${indent}- ${node.label}${node.summary ? ` : ${node.summary}` : ''}`];
  (node.children || []).forEach((c) => lines.push(flattenMindmapText(c, depth + 1)));
  return lines.join('\n');
}

function downloadConversation(messages: Message[], videoTitle: string) {
  const lines: string[] = [
    `=== Conversation — ${videoTitle || 'Cours'} ===`,
    `Exportée le ${new Date().toLocaleString('fr-FR')}`,
    '',
  ];
  for (const m of messages) {
    if (m.role === 'user') {
      lines.push(`[Élève] ${m.content}`);
    } else {
      lines.push(`[IA ProraScience] ${m.content}`);
      if (m.sources && m.sources.length > 0) {
        lines.push('  Sources :');
        m.sources.forEach((s) => lines.push(`    • [${s.time}] ${s.text}`));
      }
    }
    lines.push('');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `conversation-${(videoTitle || 'cours').replace(/\s+/g, '-').toLowerCase()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function QuestionPanel({ videoTitle, transcript, mindmap, videoUrl, onSwitchToManual, onSeek }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const buildHistory = (msgs: Message[]) =>
    msgs.map((m) => ({ role: m.role, content: m.content }));

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: q };
    const currentMsgs = [...messages, userMsg];
    setMessages(currentMsgs);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const bearerToken = sessionData?.session?.access_token || '';
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const mindmapContext = flattenMindmapText(mindmap);

      const res = await fetch(`${supabaseUrl}/functions/v1/answer-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${bearerToken || supabaseAnonKey}`,
        },
        body: JSON.stringify({
          question: q,
          videoTitle: videoTitle || '',
          transcript: (transcript || []).slice(0, 150),
          mindmapContext,
          history: buildHistory(messages),
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Erreur ${res.status}`);
      }

      const data = await res.json();
      const msgType: MsgType = data.type === 'answer' ? 'answer'
        : data.type === 'other_level' ? 'other_level'
        : 'offtopic';

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'Pas de réponse.',
        msgType,
        sources: Array.isArray(data.sources) ? data.sources : [],
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Auto-switch to manual tab for offtopic (not other_level — that's intentionally blocked)
      if (msgType === 'offtopic' && onSwitchToManual) {
        setTimeout(() => onSwitchToManual(q), 800);
      }
    } catch (e: unknown) {
      setError((e as Error)?.message || String(e));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const [miniPlayer, setMiniPlayer] = useState<MiniPlayer | null>(null);

  const handleTimestampClick = (s: { timeSeconds: number }) => {
    if (videoUrl) {
      setMiniPlayer({ timeSeconds: s.timeSeconds });
    } else if (onSeek) {
      onSeek(s.timeSeconds);
    }
  };

  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const lastAssistant = assistantMessages[assistantMessages.length - 1];
  const canDownload = messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0d1b2a] to-[#0F1419]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-semibold text-[var(--school-accent)]">ProraScience</span>
            <p className="text-[10px] text-gray-400 leading-tight">
              Conversation avec la mémoire du cours — consultez, posez vos questions, je vous réponds sur ce cours.
            </p>
          </div>
        </div>
        {canDownload && (
          <button
            type="button"
            onClick={() => downloadConversation(messages, videoTitle || 'cours')}
            title="Télécharger la conversation"
            className="flex-shrink-0 flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white border border-white/10 hover:border-white/25 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Télécharger
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
            <Bot className="w-10 h-10 text-blue-400/30" />
            <p className="text-sm text-center text-gray-400 max-w-[280px] leading-relaxed">
              Posez une question sur le contenu de cette vidéo. L&apos;IA ProraScience répond
              exclusivement d&apos;après la transcription et le plan de ce cours.
            </p>
            <div className="text-[10px] text-gray-600 text-center max-w-[240px]">
              Questions hors sujet → redirigées vers Manikongo
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mt-1">
                  <Bot className="w-3.5 h-3.5 text-blue-400" />
                </div>
              )}

              <div className="max-w-[85%] flex flex-col gap-1.5">
                {/* Bubble */}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] text-gray-100 rounded-tr-sm'
                      : msg.msgType === 'other_level'
                      ? 'bg-purple-900/30 border border-purple-500/30 text-purple-200 rounded-tl-sm'
                      : msg.msgType === 'offtopic'
                      ? 'bg-orange-500/10 border border-orange-500/25 text-orange-200 rounded-tl-sm'
                      : 'bg-blue-600/10 border border-blue-500/20 text-gray-100 rounded-tl-sm'
                  }`}
                >
                  {msg.msgType === 'other_level' && (
                    <div className="flex items-center gap-1.5 mb-2 text-purple-400 text-[11px] font-semibold">
                      <Lock className="w-3 h-3" />
                      Accès restreint — Âge ontologique
                    </div>
                  )}
                  {msg.msgType === 'offtopic' && (
                    <div className="flex items-center gap-1.5 mb-2 text-orange-400 text-[11px] font-semibold">
                      <AlertCircle className="w-3 h-3" />
                      Non traité dans ce cours
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Source timestamps */}
                {msg.role === 'assistant' && msg.msgType === 'answer' && (msg.sources?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {msg.sources!.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        title={s.text}
                        onClick={() => handleTimestampClick(s)}
                        className="flex items-center gap-1 text-[10px] bg-blue-900/30 hover:bg-blue-700/40 border border-blue-500/25 text-blue-300 rounded-lg px-2 py-0.5 transition-colors cursor-pointer"
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {s.time}
                      </button>
                    ))}
                    <span className="text-[10px] text-gray-600 self-center ml-1">Sources</span>
                  </div>
                )}

                {/* Unsatisfied button (only on last real answer) */}
                {msg.role === 'assistant' &&
                  msg.msgType === 'answer' &&
                  msg.id === lastAssistant?.id &&
                  onSwitchToManual && (
                    <button
                      type="button"
                      onClick={() => onSwitchToManual(
                        messages.find((m) => m.role === 'user' && messages.indexOf(m) < messages.indexOf(msg))?.content || ''
                      )}
                      className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-orange-300 transition-colors px-1 mt-0.5 w-fit"
                    >
                      <ThumbsDown className="w-3 h-3" />
                      Je ne suis pas satisfait(e) — Poser à Manikongo
                    </button>
                  )}

                {/* Auto-redirect notice for offtopic */}
                {msg.role === 'assistant' && msg.msgType === 'offtopic' && onSwitchToManual && (
                  <div className="text-[10px] text-orange-400/70 px-1">
                    ↳ Passage automatique à l&apos;onglet Manikongo.
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 justify-start"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mt-1">
              <Bot className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            </div>
          </motion.div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Mini inline video player */}
      {miniPlayer && videoUrl && (() => {
        const embed = buildEmbedUrl(videoUrl, miniPlayer.timeSeconds);
        return (
          <div className="flex-shrink-0 border-t border-white/10 bg-black">
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-[11px] text-blue-300 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Source — {String(Math.floor(miniPlayer.timeSeconds / 60))}:{String(Math.floor(miniPlayer.timeSeconds % 60)).padStart(2, '0')}
              </span>
              <button type="button" onClick={() => setMiniPlayer(null)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {embed.type === 'iframe' ? (
              <iframe
                key={`${embed.url}`}
                src={embed.url}
                className="w-full aspect-video"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                key={miniPlayer.timeSeconds}
                src={embed.url}
                className="w-full aspect-video bg-black"
                controls
                autoPlay
                ref={(el) => { if (el) { el.currentTime = miniPlayer.timeSeconds; } }}
              />
            )}
          </div>
        );
      })()}

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-white/10 bg-black/20">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Votre question sur cette vidéo…"
            disabled={loading}
            className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50 min-h-[38px] max-h-[120px]"
            style={{ overflowY: 'auto' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <p className="text-[10px] text-gray-600 mt-1.5 text-center">
          Entrée pour envoyer · Maj+Entrée pour saut de ligne
        </p>
      </div>
    </div>
  );
}
