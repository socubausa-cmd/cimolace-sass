import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart2,
  BookOpen,
  ChevronLeft,
  FileText,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreVertical,
  Pin,
  Send,
  SlidersHorizontal,
  Smile,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { useToast } from '@/components/ui/use-toast';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { EV_BG, EV_CARD, EV_MUTED, EV_ACCENT, EV_LINE, EV_R, EV_SH } from '@/pages/eleve-mobile/eleveMobileScreensShared';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { useLiveSessionChat } from '@/hooks/useLiveSessionChat';
import { useLiveSessionHeaderInfo } from '@/hooks/useLiveSessionHeaderInfo';
import { cn } from '@/lib/utils';

const PURPLE = '#7B61FF';
const TABS = [
  { id: 'cours', label: 'Cours', icon: BookOpen },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'fichiers', label: 'Fichiers', icon: FileText },
  { id: 'sondages', label: 'Sondages', icon: BarChart2 },
];

const DEMO = {
  kicker: 'Physique – Terminale S',
  chapter: 'Chapitre 3 : Ondes et lumière',
  viewers: 128,
  pinned: {
    t: "N'oubliez pas : la lumière se déplace dans le vide à une vitesse constante c.",
    at: '14:05',
  },
  items: [
    { kind: 'msg', who: 'Samuel T.', role: 'eleve', text: "Pour l'exo 2, c'est bien 3×10^8 ?", at: '14:02', likes: 3, liked: false },
    {
      kind: 'msg',
      who: 'Prof. Manikongo',
      role: 'prof',
      text: "Exact — en m·s⁻¹, en vide. Pensez à indiquer l'incertitude de mesure si demandée.",
      at: '14:03',
      likes: 12,
      liked: true,
    },
    { kind: 'msg', who: 'Grace L.', role: 'eleve', text: "Merci ! J'avais oublié l'incertitude.", at: '14:04', likes: 1, liked: false, heartGlow: true },
    { kind: 'system', text: 'Grace L. a rejoint le live', at: '14:04' },
  ],
};

const TAB_H = 'calc(5.5rem + env(safe-area-inset-bottom, 0px))';
const INPUT_ANCHOR = { bottom: TAB_H };

function isLiveSessionUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
}

/**
 * Messagerie pendant le live. Route : `/m/eleve/live/chat?session=uuid` (démo sans `session`).
 * Données : `live_session_chat` + Realtime (même fil que l'hôte / `LiveHostPage`).
 */
export default function EleveLiveSessionChatScreen() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { notifications: sync } = useDataSync();
  const [draft, setDraft] = useState('');
  const scrollEndRef = useRef(null);
  const sessionId = search.get('session') || '';

  const live = isLiveSessionUuid(sessionId);
  const { title, teacherId, teacherName, participantCount, error: headerError } = useLiveSessionHeaderInfo(sessionId, {
    enabled: live,
  });
  const {
    messages: liveRows,
    authorNames,
    loading: chatLoading,
    loadError: chatError,
    send,
    sending,
  } = useLiveSessionChat(sessionId, { userId: user?.id, enabled: live });

  const kicker = live ? (title || 'Live') : DEMO.kicker;
  const chapter = live ? (teacherName ? `Avec ${teacherName}` : 'Session en direct') : DEMO.chapter;
  const viewersCount = live ? (participantCount != null ? participantCount : null) : DEMO.viewers;
  const displayParticipants = live ? (viewersCount != null ? `${viewersCount} participants` : 'Participants') : `${DEMO.viewers} participants`;

  const loginRedirect = useMemo(() => {
    if (!sessionId) return `${ELEVE_MOBILE.login}?redirect=${encodeURIComponent(ELEVE_MOBILE.home)}`;
    const back = `${ELEVE_MOBILE.liveChat}?${new URLSearchParams({ session: sessionId }).toString()}`;
    return `${ELEVE_MOBILE.login}?${new URLSearchParams({ redirect: back }).toString()}`;
  }, [sessionId]);

  useLayoutEffect(() => {
    if (!live) return;
    scrollEndRef.current?.scrollIntoView({ block: 'end' });
  }, [live, liveRows.length]);

  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;

  const handleSend = async (e) => {
    e?.preventDefault();
    const t = draft.trim();
    if (!t) return;
    if (!live) {
      toast({ title: 'Session requise', description: 'Ouvre ce chat avec ?session=… pour envoyer un message.' });
      return;
    }
    if (!user?.id) {
      toast({ title: 'Connexion requise', description: 'Connecte-toi pour participer au chat.' });
      return;
    }
    const r = await send(t);
    if (r?.ok) {
      setDraft('');
    } else {
      toast({
        title: 'Envoi impossible',
        description: String(r?.error?.message || r?.error || 'Erreur'),
        variant: 'destructive',
      });
    }
  };

  const anyError = live && (headerError || chatError);
  const canPost = live && user?.id && !sending;

  return (
    <EleveMobileShell
      user={user}
      notificationCount={inboxUnread}
      hideHeader
      contentClassName="!px-0 !pb-0"
    >
      <div
        className="flex h-full min-h-0 flex-col"
        style={{ backgroundColor: EV_BG }}
        data-session={sessionId || undefined}
      >
        <div
          className="shrink-0 pt-[max(0.35rem,env(safe-area-inset-top))]"
          style={{
            backgroundImage: 'radial-gradient(50% 40% at 50% 0%, rgba(123, 97, 255, 0.1), transparent 65%)',
          }}
        >
          <LiriStatusBar />
        </div>

        <header className="shrink-0 border-b px-4 pb-3" style={{ borderColor: EV_LINE, background: EV_BG }}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(ELEVE_MOBILE.live))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
              style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5 text-white" strokeWidth={2.1} />
            </button>
            <div className="mb-0.5 inline-flex items-center gap-1.5 rounded-md border border-red-500/35 bg-red-500/10 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
              <span className="text-[9px] font-extrabold tracking-[0.2em] text-red-200">LIVE</span>
            </div>
            <div className="min-w-0 flex-1 pl-0.5">
              <h1 className="truncate text-[15px] font-extrabold leading-tight text-white">{kicker}</h1>
              <p className="truncate text-[11.5px]" style={{ color: EV_MUTED }}>
                {chapter}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 text-white/80" title="Participants">
              <Users className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="text-[12px] font-semibold tabular-nums">
                {viewersCount != null ? viewersCount : '—'}
              </span>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              aria-label="Plus"
            >
              <MoreVertical className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="shrink-0 border-b px-3 pt-1 pb-2" style={{ borderColor: EV_LINE }}>
          <div className="grid grid-cols-4 gap-1">
            {TABS.map((t) => {
              const Ic = t.icon;
              const on = t.id === 'chat';
              return (
                <div
                  key={t.id}
                  className={cn('relative flex flex-col items-center gap-1 rounded-xl py-2.5', on ? 'text-white' : 'text-white/40')}
                  style={on ? { background: 'rgba(123, 97, 255, 0.2)' } : { background: 'transparent' }}
                >
                  {on && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                      style={{ background: `linear-gradient(90deg, ${EV_ACCENT}, #a78bfa)`, boxShadow: `0 0 12px ${EV_ACCENT}` }}
                    />
                  )}
                  <Ic className="h-5 w-5" strokeWidth={on ? 2.2 : 1.8} />
                  <span className="text-[10.5px] font-semibold">{t.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 [scrollbar-width:thin]"
          style={{ paddingBottom: 'max(7.5rem, calc(5.5rem + env(safe-area-inset-bottom) + 5rem))' }}
        >
          {anyError ? (
            <p className="pt-3 text-center text-[12px] text-amber-200/90">
              {String(headerError?.message || headerError || chatError?.message || chatError || 'Chargement partiel.')}
            </p>
          ) : null}

          <div className="mb-3 flex items-center justify-between gap-2 pt-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-[15px] font-bold text-white">Chat en direct</h2>
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
              <span className="min-w-0 truncate text-[12px] font-medium" style={{ color: EV_MUTED }}>
                {displayParticipants}
              </span>
            </div>
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold opacity-50"
              style={{ borderColor: EV_LINE, background: EV_CARD, color: EV_MUTED }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Tous
            </span>
          </div>

          {!live ? (
            <>
              <div
                className="mb-3 border p-3"
                style={{ borderRadius: EV_R.md, borderColor: `${PURPLE}50`, background: 'rgba(123, 97, 255, 0.1)', boxShadow: EV_SH.sm }}
              >
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: PURPLE }}>
                  <Pin className="h-3.5 w-3.5" strokeWidth={2.2} />
                  Message épinglé par le professeur
                </div>
                <p className="text-[13px] leading-relaxed text-white/95">{DEMO.pinned.t}</p>
                <p className="mt-1.5 text-right text-[10.5px] tabular-nums" style={{ color: EV_MUTED }}>
                  {DEMO.pinned.at}
                </p>
              </div>
              <ul className="space-y-3">
                {DEMO.items.map((m, i) => (
                  <DemoMessageRow key={i} m={m} />
                ))}
              </ul>
              <div className="mt-3 flex gap-2 rounded-2xl border border-dashed border-white/15 px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="h-6 w-6 shrink-0 rounded-full bg-white/10" />
                <div>
                  <p className="text-[12px] text-white/50">•••</p>
                  <p className="text-[11.5px] italic" style={{ color: EV_MUTED }}>
                    Prof. Manikongo est en train d&apos;écrire…
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {chatLoading ? (
                <p className="py-6 text-center text-[13px]" style={{ color: EV_MUTED }}>
                  Chargement du chat…
                </p>
              ) : null}
              {!chatLoading && liveRows.length === 0 ? (
                <p className="py-8 text-center text-[13px]" style={{ color: EV_MUTED }}>
                  Aucun message pour l&apos;instant. Dis bonjour à la salle.
                </p>
              ) : null}
              <ul className="space-y-3">
                {liveRows.map((m) => {
                  const who = authorNames[m.user_id] || 'Participant';
                  const isProf = teacherId && String(m.user_id) === String(teacherId);
                  const at = m.created_at
                    ? new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                    <li key={m.id} className="flex gap-2">
                      <div
                        className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/10"
                        style={{
                          background: isProf
                            ? 'linear-gradient(135deg, #5b21b6, #7B61FF)'
                            : 'linear-gradient(135deg, #3b82f6, #6366F1)',
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-1.5">
                          <span
                            className={cn('text-[12.5px] font-bold', isProf ? 'text-violet-300' : 'text-sky-300')}
                          >
                            {who}
                            {String(m.user_id) === String(user?.id) ? ' (toi)' : ''}
                          </span>
                          {isProf ? (
                            <span
                              className="rounded px-1 py-px text-[7px] font-extrabold tracking-wide"
                              style={{ background: 'rgba(123, 97, 255, 0.35)', color: '#e9d5ff' }}
                            >
                              PROF
                            </span>
                          ) : null}
                        </div>
                        <div
                          className="inline-block max-w-[92%] rounded-2xl rounded-tl-sm border px-3 py-2"
                          style={{ borderColor: EV_LINE, background: 'rgba(22, 22, 30, 0.95)' }}
                        >
                          <p className="text-[13px] leading-relaxed text-white/95 whitespace-pre-wrap break-words">
                            {m.message}
                          </p>
                          {at ? (
                            <p className="mt-0.5 text-right text-[10px] tabular-nums" style={{ color: EV_MUTED }}>
                              {at}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <div ref={scrollEndRef} />
        </div>

        <div
          className="fixed left-0 right-0 z-[45] border-t px-3 pt-2"
          style={{ ...INPUT_ANCHOR, borderColor: EV_LINE, background: EV_BG, boxShadow: '0 -8px 32px rgba(0,0,0,0.4)' }}
        >
          {live && !user?.id ? (
            <div className="mx-auto max-w-lg pb-2 text-center text-[12px] text-amber-100/90">
              <Link to={loginRedirect} className="font-semibold text-violet-300 underline-offset-2 hover:underline">
                Se connecter
              </Link>{' '}
              pour écrire dans le chat de session
            </div>
          ) : null}
          <form className="mx-auto flex max-w-lg items-end gap-2 pb-2" onSubmit={handleSend}>
            <div
              className="flex min-h-[48px] flex-1 items-center gap-1 rounded-[22px] border px-2 py-1.5"
              style={{ borderColor: EV_LINE, background: EV_CARD, opacity: canPost || !live ? 1 : 0.75 }}
            >
              <button type="button" className="p-1.5 text-white/50" aria-label="Emoji" tabIndex={-1}>
                <Smile className="h-5 w-5" strokeWidth={1.8} />
              </button>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={!live ? 'Ajoute ?session=… à l\'URL pour t\'y connecter' : 'Écris ton message…'}
                className="min-w-0 flex-1 bg-transparent text-[14px] text-white placeholder:text-white/35 focus:outline-none"
                autoComplete="off"
                disabled={!live}
              />
              <span className="p-1.5 text-white/30" aria-hidden>
                <ImageIcon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span className="pr-0.5 text-[11px] font-bold text-white/25">GIF</span>
            </div>
            <button
              type="submit"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
              style={{
                background: `linear-gradient(135deg, ${EV_ACCENT} 0%, #5B21B6 100%)`,
                boxShadow: EV_SH.cta,
              }}
              disabled={!canPost || !draft.trim()}
              aria-label="Envoyer"
            >
              <Send className="h-5 w-5" strokeWidth={2.1} />
            </button>
          </form>
        </div>
      </div>
    </EleveMobileShell>
  );
}

function DemoMessageRow({ m }) {
  if (m.kind === 'system') {
    return (
      <li className="py-1 text-center">
        <p className="text-[12.5px] text-white/75">
          <span className="mr-1">👏</span>
          {m.text}
        </p>
        <span className="text-[10px] tabular-nums" style={{ color: EV_MUTED }}>
          {m.at}
        </span>
      </li>
    );
  }
  const isProf = m.role === 'prof';
  return (
    <li className="flex gap-2">
      <div
        className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/10"
        style={{ background: isProf ? 'linear-gradient(135deg, #5b21b6, #7B61FF)' : 'linear-gradient(135deg, #3b82f6, #6366F1)' }}
      />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className={cn('text-[12.5px] font-bold', isProf ? 'text-violet-300' : 'text-sky-300')}>{m.who}</span>
          {isProf ? (
            <span
              className="rounded px-1 py-px text-[7px] font-extrabold tracking-wide"
              style={{ background: 'rgba(123, 97, 255, 0.35)', color: '#e9d5ff' }}
            >
              PROF
            </span>
          ) : null}
        </div>
        <div className="flex items-end gap-2">
          <div
            className="inline-block max-w-[88%] rounded-2xl rounded-tl-sm border px-3 py-2"
            style={{ borderColor: EV_LINE, background: 'rgba(22, 22, 30, 0.95)' }}
          >
            <p className="text-[13px] leading-relaxed text-white/95">{m.text}</p>
            <p className="mt-0.5 text-right text-[10px] tabular-nums" style={{ color: EV_MUTED }}>
              {m.at}
            </p>
          </div>
          <div
            className={cn('mb-0.5 flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-1 py-0.5', m.heartGlow && 'text-violet-300')}
          >
            <Heart
              className={cn('h-4 w-4', m.liked && 'fill-red-500 text-red-500', !m.liked && 'text-white/35')}
              strokeWidth={m.liked ? 0 : 1.6}
            />
            <span className="text-[9px] font-bold tabular-nums" style={{ color: EV_MUTED }}>
              {m.likes}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
