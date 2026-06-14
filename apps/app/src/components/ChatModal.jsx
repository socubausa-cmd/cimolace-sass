import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User, CalendarPlus, MessageSquare, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { sendSmartResponseMessage } from '@/services/replyEngine';
import { detectSmartIntent } from '@/services/intentEngine';

const ChatModal = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'agent',
      text: "Bonjour ! Je suis le Smart Response Engine. Je peux vous orienter rapidement selon votre besoin.",
      meta: null,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [threadId, setThreadId] = useState('');
  const [sending, setSending] = useState(false);

  const canSend = useMemo(() => Boolean(inputValue.trim()) && !sending, [inputValue, sending]);
  const quickActions = [
    { label: 'Comprendre les bases', value: 'Je veux comprendre les bases.' },
    { label: 'Apprendre une pratique', value: 'Je veux apprendre une pratique.' },
    { label: 'Devenir praticien', value: 'Je veux devenir praticien.' },
    { label: 'Poser une question', value: "J'ai une question sur les offres." },
  ];

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || sending) return;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Libreville';
    const lang = String(navigator.language || '');
    const country = (lang.split('-')[1] || '').toUpperCase();
    const userMsg = { id: Date.now(), type: 'user', text: inputValue };
    const messageToSend = inputValue;
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setSending(true);

    try {
      const payload = await sendSmartResponseMessage({
        threadId: threadId || undefined,
        message: messageToSend,
        visitorCountry: country,
        visitorTimezone: timezone,
      });
      if (payload?.threadId) setThreadId(payload.threadId);
      const intent = payload?.qualification?.intent || detectSmartIntent(messageToSend);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'agent',
          text: payload?.reply?.text || 'Je vous reponds dans un instant.',
          meta: {
            intent,
            temperature: payload?.qualification?.temperature || 'cold',
            escalated: Boolean(payload?.escalation?.escalated),
            ctaPrimaryLabel: payload?.reply?.ctaPrimaryLabel,
            ctaPrimaryUrl: payload?.reply?.ctaPrimaryUrl,
            ctaSecondaryLabel: payload?.reply?.ctaSecondaryLabel,
            ctaSecondaryUrl: payload?.reply?.ctaSecondaryUrl,
          },
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'agent',
          text: "Je rencontre un souci technique. Vous pouvez parler a un humain ou prendre rendez-vous directement.",
          meta: {
            intent: 'support',
            temperature: 'warm',
            escalated: true,
            ctaPrimaryLabel: 'Prendre rendez-vous',
            ctaPrimaryUrl: '/appointment/request',
            ctaSecondaryLabel: 'Chat immersif',
            ctaSecondaryUrl: '/messages',
          },
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-4 right-4 md:bottom-10 md:right-10 w-[90vw] md:w-96 h-[500px] bg-[#0F1419] border border-white/20 rounded-2xl shadow-2xl z-[70] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-yellow-600/20 p-4 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/50">
                    <User className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0F1419]"></div>
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Secrétariat</h3>
                  <p className="text-xs text-green-400">En ligne</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      msg.type === 'user'
                        ? 'bg-yellow-600 text-white rounded-br-none'
                        : 'bg-white/10 text-gray-200 rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                    {msg.type === 'agent' && msg.meta ? (
                      <div className="mt-3 space-y-2">
                        <div className="text-[10px] text-gray-300 flex flex-wrap gap-2">
                          <span className="px-2 py-0.5 rounded bg-white/10">intent: {msg.meta.intent}</span>
                          <span className="px-2 py-0.5 rounded bg-white/10">lead: {msg.meta.temperature}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={msg.meta.ctaPrimaryUrl || '/appointment/request'}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-[var(--school-accent)] text-black font-medium hover:bg-amber-400"
                            onClick={onClose}
                          >
                            <CalendarPlus className="w-3 h-3" />
                            {msg.meta.ctaPrimaryLabel || 'Prendre rendez-vous'}
                          </Link>
                          <Link
                            to={msg.meta.ctaSecondaryUrl || '/messages'}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-white/20 hover:bg-white/10"
                            onClick={onClose}
                          >
                            <MessageSquare className="w-3 h-3" />
                            {msg.meta.ctaSecondaryLabel || 'Parler a un humain'}
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="text-[11px] px-2 py-1 rounded-full border border-white/15 text-gray-300 hover:bg-white/10"
                    disabled={sending}
                    onClick={() => setInputValue(action.value)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-black/20">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Écrivez votre message..."
                  className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-yellow-600 text-white rounded-full hover:bg-yellow-500 disabled:opacity-50 disabled:hover:bg-yellow-600 transition-colors"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ChatModal;