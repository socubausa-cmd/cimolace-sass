import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Send } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useMessaging } from '@/contexts/MessagingContext';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { cn } from '@/lib/utils';
import { EV_BG, EV_MUTED, EV_LINE, EV_R } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(217, 119, 87, 0.14), transparent 70%)';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function EleveMessageThreadScreen() {
  const { participantId } = useParams();
  const { user } = useAuth();
  const uid = user?.id;
  const {
    messages,
    profiles,
    getConversationMessages,
    sendMessage,
    markAsRead,
    fetchAndMergeConversation,
    loading,
  } = useMessaging();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const valid = participantId && UUID_RE.test(String(participantId));

  const peer = profiles?.[participantId];
  const title = peer?.name || peer?.email?.split('@')[0] || 'Conversation';

  const threadMessages = useMemo(() => {
    if (!valid || !uid) return [];
    return getConversationMessages(participantId);
  }, [valid, uid, participantId, getConversationMessages, messages]);

  useEffect(() => {
    if (!valid) return;
    fetchAndMergeConversation(participantId);
  }, [valid, participantId, fetchAndMergeConversation]);

  useEffect(() => {
    if (!uid || !valid || !threadMessages.length) return;
    const unread = threadMessages
      .filter((m) => m.receiver_id === uid && !m.is_read)
      .map((m) => m.id);
    if (unread.length) markAsRead(unread);
  }, [uid, valid, threadMessages, markAsRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length, sending]);

  const onSend = async () => {
    if (!draft.trim() || !valid || !uid) return;
    setSending(true);
    try {
      await sendMessage(participantId, draft);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  if (!valid) {
    return (
      <EleveMobileShell user={user} hideHeader contentClassName="!px-0">
        <div className="flex min-h-[50dvh] flex-col items-center justify-center px-6 text-center">
          <p className="text-[15px] font-semibold text-white">Conversation introuvable</p>
          <p className="mt-2 text-[13px]" style={{ color: EV_MUTED }}>
            Lien incorrect. Reviens à la liste des messages.
          </p>
          <Link
            to={ELEVE_MOBILE.messages}
            className="mt-5 rounded-full border px-5 py-2.5 text-[14px] font-semibold"
            style={{ borderColor: EV_LINE }}
          >
            Retour
          </Link>
        </div>
      </EleveMobileShell>
    );
  }

  return (
    <EleveMobileShell user={user} hideHeader contentClassName="!px-0 !pb-0" hideTabBar>
      <div
        className="flex w-full min-h-0 flex-1 flex-col"
        style={{ minHeight: '100dvh', backgroundColor: EV_BG, backgroundImage: PAGE_AMBIENT }}
      >
        <div className="shrink-0 px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>
        <div
          className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <Link
            to={ELEVE_MOBILE.messages}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/95 active:bg-white/10"
            aria-label="Retour"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold text-white">{title}</p>
            <p className="truncate text-[11px] text-white/45">Messages privés</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          {loading && threadMessages.length === 0 ? (
            <p className="py-6 text-center text-[13px]" style={{ color: EV_MUTED }}>
              Chargement…
            </p>
          ) : null}
          {threadMessages.map((m) => {
            const mine = m.sender_id === uid;
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[min(100%,20rem)] rounded-2xl px-3 py-2.5',
                    mine ? 'rounded-br-sm bg-orange-600/90 text-white' : 'rounded-bl-sm border bg-white/[0.06] text-white/95',
                  )}
                  style={mine ? {} : { borderColor: EV_LINE }}
                >
                  <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">{m.content}</p>
                  <p className="mt-1 text-[9px] opacity-60">
                    {m.created_at
                      ? format(new Date(m.created_at), "d MMM, HH:mm", { locale: fr })
                      : ''}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} className="h-1 shrink-0" />
        </div>

        <div
          className="shrink-0 border-t px-3 py-2"
          style={{
            borderColor: 'rgba(255,255,255,0.1)',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire un message…"
              rows={1}
              className="max-h-28 min-h-[44px] flex-1 resize-y rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-[15px] text-white placeholder:text-white/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <button
              type="button"
              disabled={!draft.trim() || sending}
              onClick={onSend}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white disabled:opacity-40"
              aria-label="Envoyer"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </EleveMobileShell>
  );
}
