/**
 * ImmersiveMessage — single chat bubble with edit, delete, TTS actions.
 * Includes renderMessageContent helper (image / audio / links).
 * Extracted from MessagingPage.jsx (REQ-FE-004).
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMessageTime } from '@/lib/messagingUtils';
import { UserAvatar } from './atoms';

// ─── renderMessageContent ─────────────────────────────────────────────────────

function renderMessageContent(content) {
  const value = String(content || '');
  const trimmed = value.trim();

  if (trimmed.includes('[image]')) {
    const src = trimmed.split('[image]')[1]?.trim() || '';
    if (!src) return <span>{value}</span>;
    return (
      <img
        src={src}
        alt="Image partagée"
        className="max-h-[380px] w-auto mx-auto rounded-2xl border border-white/10 shadow-xl"
      />
    );
  }
  if (trimmed.includes('[audio]')) {
    const src = trimmed.split('[audio]')[1]?.trim() || '';
    if (!src) return <span>{value}</span>;
    return (
      <audio controls className="mx-auto w-full max-w-md">
        <source src={src} />
        Votre navigateur ne supporte pas l'audio.
      </audio>
    );
  }

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = value.split(urlRegex);
  return (
    <>
      {parts.map((part, idx) => {
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={`${part}-${idx}`}
              href={part}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] text-[var(--school-accent)]"
            >
              {part}
            </a>
          );
        }
        return <span key={`${part}-${idx}`}>{part}</span>;
      })}
    </>
  );
}

// ─── ImmersiveMessage ─────────────────────────────────────────────────────────

export function ImmersiveMessage({
  message,
  isOwn,
  senderProfile,
  isLatest,
  justSent,
  isActive = false,
  groupPosition = 'single',
  showIdentity = true,
  isDarkTheme = true,
  onDelete,
  onEdit,
  onRequestDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(message.content);
    setEditing(false);
  }, [message.id, message.content]);

  const handleSaveEdit = async () => {
    const t = draft.trim();
    if (!t || t === message.content) {
      setEditing(false);
      setDraft(message.content);
      return;
    }
    setSaving(true);
    const ok = await onEdit?.(message.id, t);
    setSaving(false);
    if (ok) setEditing(false);
  };

  const speakMessage = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const content = String(message.content || '');
    if (content.startsWith('[audio]') || content.startsWith('[image]')) return;
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex w-full gap-3 px-4 md:px-8',
        isOwn ? 'justify-end' : 'justify-start',
        groupPosition === 'start' || groupPosition === 'single' ? 'pt-2.5 pb-0.5' : 'py-0.5',
        groupPosition === 'end' || groupPosition === 'single' ? 'pb-2.5' : ''
      )}
    >
      {!isOwn && showIdentity ? (
        <UserAvatar user={senderProfile} size="sm" />
      ) : !isOwn ? (
        <span className="w-8" />
      ) : null}

      <div className={cn('max-w-[82%] md:max-w-[70%] group', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn && showIdentity && (
          <p className="text-[10px] text-gray-500 mb-1 ml-1">
            {senderProfile?.name || 'Interlocuteur'}
          </p>
        )}

        <div
          className={cn(
            'px-3.5 py-2.5 text-sm leading-relaxed border shadow-sm',
            isOwn
              ? 'bg-[color-mix(in_srgb,var(--school-accent)_16%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-[#f4ead0]'
              : 'bg-white/[0.04] border-white/12 text-gray-100',
            groupPosition === 'single' && 'rounded-2xl',
            groupPosition === 'start' && (isOwn ? 'rounded-t-2xl rounded-bl-2xl rounded-br-md' : 'rounded-t-2xl rounded-br-2xl rounded-bl-md'),
            groupPosition === 'middle' && (isOwn ? 'rounded-l-2xl rounded-r-md' : 'rounded-r-2xl rounded-l-md'),
            groupPosition === 'end' && (isOwn ? 'rounded-b-2xl rounded-tl-2xl rounded-tr-md' : 'rounded-b-2xl rounded-tr-2xl rounded-tl-md'),
            isActive && 'ring-1 ring-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]'
          )}
        >
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full rounded-lg border text-sm p-2.5 outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] resize-y min-h-[90px] bg-black/20 border-white/15 text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setEditing(false); setDraft(message.content); }}
                  className="px-3 py-1.5 rounded-md text-xs text-gray-400 hover:bg-white/5"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={saving || !draft.trim()}
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 rounded-md text-xs bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] disabled:opacity-40"
                >
                  {saving ? '…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          ) : (
            <div className={cn('break-words', justSent && 'animate-pulse')}>
              {renderMessageContent(message.content)}
            </div>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2 px-1">
          <span className={cn('text-[10px]', isDarkTheme ? 'text-gray-500' : 'text-gray-500')}>
            {formatMessageTime(message.created_at)}
          </span>
          {isLatest && (
            <span className="text-[10px] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">{isOwn ? 'Envoyé' : 'Lu'}</span>
          )}
          {!editing && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <button
                type="button"
                onClick={speakMessage}
                className="inline-flex items-center gap-1 h-6 px-1.5 rounded text-[10px] text-gray-400 hover:text-white hover:bg-white/5"
                aria-label="Lire en audio"
              >
                <Volume2 className="w-3 h-3" />
              </button>
              {isOwn && onEdit && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 h-6 px-1.5 rounded text-[10px] text-gray-400 hover:text-[var(--school-accent)] hover:bg-white/5"
                  aria-label="Modifier le message"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {isOwn && onDelete && (
                <button
                  type="button"
                  onClick={() => onRequestDelete?.(message)}
                  className="inline-flex items-center gap-1 h-6 px-1.5 rounded text-[10px] text-red-400/90 hover:bg-red-500/10"
                  aria-label="Supprimer le message"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isOwn && showIdentity ? (
        <UserAvatar user={senderProfile} size="sm" />
      ) : isOwn ? (
        <span className="w-8" />
      ) : null}
    </motion.div>
  );
}
