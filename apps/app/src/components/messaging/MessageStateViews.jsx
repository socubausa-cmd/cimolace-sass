/**
 * MessageStateViews — three display-only state views for the message thread:
 *   - TypingOverlay   (remote user is typing)
 *   - EmptyState      (no conversation selected yet)
 *   - NoMessagesState (conversation selected but no messages)
 *
 * Extracted from MessagingPage.jsx (REQ-FE-004).
 */
import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Users, Sparkles } from 'lucide-react';
import { UserAvatar } from './atoms';

// ─── TypingOverlay ────────────────────────────────────────────────────────────

export function TypingOverlay({ remoteText, isTyping, senderProfile }) {
  if (!isTyping) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 md:px-16 text-center pointer-events-none"
    >
      <div className="mb-3 opacity-50">
        <UserAvatar user={senderProfile} size="lg" />
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500/60 mb-3">
        {senderProfile?.name || "Quelqu'un"} écrit…
      </p>
      <p className="text-2xl md:text-3xl lg:text-4xl font-serif text-white/30 max-w-3xl leading-relaxed">
        {remoteText || (
          <span className="inline-flex gap-1">
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
            >
              .
            </motion.span>
          </span>
        )}
      </p>
    </motion.div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({ onOpenPicker, conversations, onSelectConversation }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center text-center px-6 py-12 h-full"
    >
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] to-violet-500/10 border border-white/10 flex items-center justify-center mb-6">
        <MessageSquare className="w-9 h-9 text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Messagerie immersive</h2>
      <p className="text-sm text-gray-400 max-w-sm mb-6">
        Sélectionnez un membre pour commencer ou reprendre une conversation en temps réel.
      </p>

      {conversations.length > 0 && (
        <div className="w-full max-w-sm mb-6 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Conversations récentes</p>
          {conversations.slice(0, 4).map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] hover:bg-white/[0.07] transition-all text-left group"
            >
              <UserAvatar user={conv} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate group-hover:text-[var(--school-accent)] transition-colors">
                  {conv.name}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  {conv.lastMessage?.content || '—'}
                </p>
              </div>
              {conv.unreadCount > 0 && (
                <span className="flex-shrink-0 h-5 min-w-5 rounded-full bg-[var(--school-accent)] text-[10px] font-bold text-black flex items-center justify-center px-1">
                  {conv.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onOpenPicker}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-[var(--school-accent)] text-sm font-medium hover:bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] transition-all"
      >
        <Users className="w-4 h-4" />
        Choisir un destinataire
      </button>
    </motion.div>
  );
}

// ─── NoMessagesState ──────────────────────────────────────────────────────────

export function NoMessagesState({ recipientName }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-full text-center px-6"
    >
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <Sparkles className="w-7 h-7 text-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]" />
      </div>
      <p className="text-gray-400 text-sm">
        Aucun message avec <span className="text-white font-medium">{recipientName}</span>
      </p>
      <p className="text-gray-600 text-xs mt-1">Écrivez le premier message ci-dessous.</p>
    </motion.div>
  );
}
