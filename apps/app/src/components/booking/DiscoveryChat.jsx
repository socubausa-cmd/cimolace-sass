/**
 * DiscoveryChat — Widget chatbot flottant
 *
 * Rôle (cahier des charges §1) :
 *   - Premier filtre léger pour les petites questions
 *   - Répond aux FAQ de l'école via l'IA (endpoint immersive-ai-guide)
 *   - Détecte les intentions "entretien" et propose la prise de RDV
 *   - NE remplace PAS le secrétariat, NE traite PAS les cas complexes
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Send, Loader2, Sparkles, CalendarClock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookingCalendarModal } from './BookingCalendarModal';
import { cn } from '@/lib/utils';

/* ─── helpers ───────────────────────────────────────────────── */
const BOOKING_INTENTS = ['booking', 'interview', 'appointment', 'entretien'];

function isBookingIntent(intent = '', text = '') {
  if (BOOKING_INTENTS.some(k => String(intent).toLowerCase().includes(k))) return true;
  const src = String(text).toLowerCase();
  return /(rendez|rdv|entretien|réserver|secrétariat|parler à quelqu|conseiller|appel|voir quelqu)/.test(src);
}

function BubbleUser({ text }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] px-4 py-2.5 text-sm text-white">
        {text}
      </div>
    </div>
  );
}

function BubbleAI({ text, routes, onBook }) {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-[var(--school-accent)]" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-gray-200 leading-relaxed">
          {text}
        </div>
        {routes?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {routes.slice(0, 3).map(r => (
              <a
                key={r.path}
                href={r.path}
                className="inline-flex items-center gap-1 text-[11px] rounded-full border border-white/15 bg-white/5 px-3 py-1 text-gray-300 hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] hover:text-[var(--school-accent)] transition-colors"
              >
                {r.ctaLabel || r.label}
              </a>
            ))}
          </div>
        )}
        {onBook && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBook}
            className="flex items-center gap-2 text-[12px] rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] px-4 py-2 text-[var(--school-accent)] font-semibold hover:bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] transition-all"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Prendre rendez-vous avec le secrétariat
          </motion.button>
        )}
      </div>
    </div>
  );
}

function TypingDot() {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-[var(--school-accent)]" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-1">
        {[0, 0.2, 0.4].map((delay, i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_60%,transparent)]"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Suggestions initiales ─────────────────────────────────── */
const SUGGESTIONS = [
  "C'est quoi Prorascience ?",
  "Quelles formations proposez-vous ?",
  "Quels sont les tarifs ?",
  "Je veux parler à un conseiller",
];

/* ─── Main component ─────────────────────────────────────────── */
export function DiscoveryChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]); // { role: 'user'|'ai', text, routes, showBook }
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const historyRef = useRef([]); // [{role, content}] pour l'API

  /* scroll to bottom */
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, open]);

  /* focus input on open */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setUnread(0);
    /* Message de bienvenue au premier ouverture */
    if (messages.length === 0) {
      setMessages([{
        role: 'ai',
        text: 'Bonjour ! Je suis l\'assistant de Prorascience. Posez-moi une question sur l\'école, les formations ou les tarifs. Pour un entretien personnalisé, je vous oriente vers le secrétariat.',
        routes: [],
        showBook: false,
      }]);
    }
  };

  const sendMessage = useCallback(async (text) => {
    const msg = String(text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);

    const newHistory = [...historyRef.current, { role: 'user', content: msg }];
    historyRef.current = newHistory;

    try {
      const res = await fetch('/api/immersive/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          context: { history: newHistory.slice(-8), source: 'discovery_chat' },
        }),
      });
      const data = await res.json();
      const answer = String(data?.guidance || data?.answer || data?.fallback?.message || 'Je n\'ai pas pu trouver une réponse. Souhaitez-vous parler directement au secrétariat ?');
      const routes = Array.isArray(data?.routes) ? data.routes : [];
      const intent = String(data?.intent || '');
      const showBook = isBookingIntent(intent, msg) || isBookingIntent('', answer);

      historyRef.current = [...newHistory, { role: 'assistant', content: answer }];

      setMessages(prev => [...prev, { role: 'ai', text: answer, routes, showBook }]);

      if (!open) setUnread(u => u + 1);
    } catch {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: 'Une erreur s\'est produite. Souhaitez-vous prendre rendez-vous directement avec le secrétariat ?',
        routes: [],
        showBook: true,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, open]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Floating bubble ── */}
      <div
        className={cn(
          'fixed right-4 sm:right-6 flex flex-col items-end gap-3',
          'bottom-6 z-50',
        )}
      >
        <AnimatePresence>
          {open && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="w-[340px] sm:w-[380px] rounded-2xl border border-white/10 bg-[#090D14]/95 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden flex flex-col"
              style={{ maxHeight: 'min(560px, 80vh)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-gradient-to-r from-[#172437]/80 to-[#090D14]/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[var(--school-accent)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Assistant Prorascience</p>
                    <p className="text-[10px] text-gray-500">Réponses instantanées · FAQ · Orientation</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                {messages.map((m, i) => (
                  m.role === 'user'
                    ? <BubbleUser key={i} text={m.text} />
                    : <BubbleAI key={i} text={m.text} routes={m.routes} onBook={m.showBook ? () => { setOpen(false); setBookingOpen(true); } : null} />
                ))}
                {loading && <TypingDot />}

                {/* Suggestions initiales */}
                {messages.length === 1 && !loading && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="text-[11px] rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-gray-300 hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] hover:text-[var(--school-accent)] transition-colors text-left"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-3 border-t border-white/8 bg-[#0a0e14]/60 shrink-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Posez votre question…"
                    rows={1}
                    className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] transition-colors max-h-[80px] overflow-y-auto"
                    style={{ lineHeight: '1.5' }}
                    disabled={loading}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 rounded-xl bg-[var(--school-accent)] text-black flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 transition-all shrink-0"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5 text-center">
                  Pour un entretien — <button onClick={() => { setOpen(false); setBookingOpen(true); }} className="text-[var(--school-accent)] hover:underline">prendre rendez-vous</button>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trigger button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => open ? setOpen(false) : handleOpen()}
          className="relative w-14 h-14 rounded-full bg-[var(--school-accent)] text-black shadow-[0_8px_32px_rgba(212,175,55,0.4)] flex items-center justify-center"
        >
          <AnimatePresence mode="wait">
            {open
              ? <motion.div key="x" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0 }}><X className="w-6 h-6" /></motion.div>
              : <motion.div key="chat" initial={{ opacity: 0, rotate: 90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0 }}><MessageSquare className="w-6 h-6" /></motion.div>
            }
          </AnimatePresence>
          {unread > 0 && !open && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
            >
              {unread}
            </motion.div>
          )}
        </motion.button>
      </div>

      {/* Booking modal déclenché depuis le chat */}
      <BookingCalendarModal open={bookingOpen} onOpenChange={setBookingOpen} />
    </>
  );
}

export default DiscoveryChat;
