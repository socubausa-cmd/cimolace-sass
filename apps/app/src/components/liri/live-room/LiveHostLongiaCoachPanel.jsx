import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Clock,
  FileText,
  ImagePlus,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Plus,
  PlusCircle,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { invokeLongiaGuestLive } from '@/lib/longiaGuestClient';
import {
  adaptBrainToCoachGuestShape,
  invokeLiriBrainStream,
  resolveLiriBrainEndpoint,
} from '@/lib/liri-brain';
import { fetchLongiaChatThread, upsertLongiaChatThread } from '@/lib/longiaChatThreadPersistence';
import {
  buildLongiaHubV1,
  LONGIA_SURFACE,
  LONGIA_CAPABILITY,
  LONGIA_ENGINE_ROLE,
} from '@/lib/longiaHub';
import { cn } from '@/lib/utils';
import {
  designerShellEmbedPanel,
  designerShellMessageBubble,
  designerShellMicroLabel,
} from '@/lib/liriDesignerShellClasses';

/** Icônes discrètes pour les actions rapides (même style partout : violet doux). */
function CoachQuickActionIcon({ action }) {
  const key = String(action || '').trim();
  const Icon =
    key === 'simplify'
      ? MessageCircle
      : key === 'give_example'
        ? Sparkles
        : key === 'suggest_transition'
          ? MessagesSquare
          : key === 'add_to_notes' || key === 'notes' || key === 'append_notes'
            ? FileText
            : Sparkles;
  return <Icon className="h-4 w-4 shrink-0 text-amber-400/85" strokeWidth={2} aria-hidden />;
}

/**
 * Coach LONGIA côté **formateur** — chat privé + cartes de rendu (résumé, reformulation, exemple).
 * Appelle **LIRI Brain** (`VITE_USE_LIRI_BRAIN` / `VITE_LIRI_BRAIN_URL`) si configuré, sinon l'Edge `longia-guest-live` avec `longia_hub.surface === live_host`.
 */
export default function LiveHostLongiaCoachPanel({
  supabase,
  sessionId,
  user,
  sessionTitle,
  stepTitle,
  chatMessages = [],
  toast,
  /** Envoie résumé / reformulation / exemple sur le SmartBoard (bloc à retenir). */
  onPushRendersToBoard,
  /** Pastille « Architecte » activée dans le journal — rappel UX seulement. */
  architectModeOn = true,
  /** Participants LiveKit (hôte) — insertion « membre connecté ». */
  liveParticipants = [],
}) {
  const { user: ctxUser, loading: authLoading } = useAuth();
  /** Profil page hôte ou contexte auth (évite écran vide si la prop arrive en retard). */
  const resolvedUser = user?.id ? user : ctxUser;
  const userId = resolvedUser?.id;

  const [messages, setMessages] = useState([]);
  const [lastCard, setLastCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  /** Restauration du fil DB — ne doit pas masquer la zone de saisie. */
  const [threadHydrated, setThreadHydrated] = useState(false);
  const persistTimerRef = useRef(null);
  const scrollRef = useRef(null);
  const draftRef = useRef(null);
  const imageFileRef = useRef(null);
  const insertHubRef = useRef(null);
  const [insertHubOpen, setInsertHubOpen] = useState(false);
  /** Sous-section « membres » dans le hub. */
  const [memberSectionExpanded, setMemberSectionExpanded] = useState(false);

  useEffect(() => {
    if (!insertHubOpen) return undefined;
    const onDocDown = (e) => {
      if (insertHubRef.current && !insertHubRef.current.contains(e.target)) {
        setInsertHubOpen(false);
        setMemberSectionExpanded(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setInsertHubOpen(false);
        setMemberSectionExpanded(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [insertHubOpen]);

  const insertAtCaret = useCallback((snippet) => {
    const s = String(snippet || '');
    if (!s) return;
    const el = draftRef.current;
    if (!el) {
      setDraft((d) => `${d}${s}`);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const v = el.value;
    const next = v.slice(0, start) + s + v.slice(end);
    setDraft(next);
    queueMicrotask(() => {
      el.focus();
      const pos = start + s.length;
      el.setSelectionRange(pos, pos);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!sessionId || !supabase || !userId) {
      setThreadHydrated(true);
      return undefined;
    }
    setThreadHydrated(false);
    (async () => {
      try {
        const { row } = await fetchLongiaChatThread(supabase, 'live', sessionId);
        if (cancelled) return;
        if (row?.messages?.length) {
          const restored = row.messages.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.text || m.content || ''),
          }));
          setMessages(restored.filter((x) => String(x.content || '').trim()));
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[LiveHostLongiaCoachPanel] restauration fil', e);
        }
      } finally {
        if (!cancelled) setThreadHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, userId, supabase]);

  useEffect(() => {
    if (!threadHydrated || !sessionId || !userId || !supabase || loading) return undefined;
    if (messages.length === 0) return undefined;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const toSave = messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: String(m.content || ''),
        }));
      void upsertLongiaChatThread(
        supabase,
        'live',
        sessionId,
        toSave,
        `Live hôte — coach · ${sessionTitle || sessionId}`,
      );
    }, 900);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [messages, threadHydrated, sessionId, userId, supabase, loading, sessionTitle]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const sessionContext = useCallback(() => {
    const excerpt = (chatMessages || [])
      .slice(-24)
      .map((m) => `${m.name || '?'}: ${m.text || ''}`)
      .join('\n');
    return {
      sessionId,
      sessionTitle: sessionTitle || null,
      stepTitle: stepTitle || null,
      chatExcerpt: excerpt || null,
      transcriptSnippet: null,
      transcriptPartial: null,
    };
  }, [sessionId, sessionTitle, stepTitle, chatMessages]);

  const runTurn = useCallback(
    async (uiAction, extraUserLine) => {
      if (!sessionId || !userId) return;
      const userLine = String(extraUserLine || '').trim();
      const nextMessages =
        userLine.length > 0 ? [...messages, { role: 'user', content: userLine }] : [...messages];

      setLoading(true);
      try {
        const hub = buildLongiaHubV1({
          surface: LONGIA_SURFACE.LIVE_HOST,
          mode: 'coach',
          engines: [LONGIA_ENGINE_ROLE.COACH],
          capabilities: [LONGIA_CAPABILITY.LIVE_SIGNALS],
          features: { host_coach: true },
        });

        const brainEndpoint = resolveLiriBrainEndpoint();
        const effectiveBrainMessage =
          userLine || (uiAction ? `[Coach — action : ${uiAction}]` : '') || '';

        let data;
        if (brainEndpoint && effectiveBrainMessage) {
          try {
            const ctx = sessionContext();
            const { answer, structured } = await invokeLiriBrainStream(brainEndpoint, {
              message: effectiveBrainMessage,
              sessionId,
              liveId: sessionId,
              userId,
              mode: 'auto',
              context: {
                sessionTitle: sessionTitle || undefined,
                stepTitle: stepTitle || undefined,
                chatExcerpt: ctx.chatExcerpt || undefined,
                extra: { uiAction: uiAction || '', surface: 'live_host_coach' },
              },
              memory: {
                sessionId,
                userId,
                liveId: sessionId,
                lastMessages: nextMessages.slice(-10).map((m) => ({
                  role: m.role,
                  content: m.content,
                })),
                currentTopic: null,
                currentSlide: null,
                keyPoints: [],
                questions: [],
                summaries: [],
                actions: [],
              },
            });
            data = adaptBrainToCoachGuestShape(structured, answer);
          } catch (brainErr) {
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.warn('[LiveHostLongiaCoachPanel] LIRI Brain indisponible — fallback Edge', brainErr);
            }
            data = await invokeLongiaGuestLive(supabase, {
              messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
              studentState: { role: 'host', coach_panel: true },
              sessionContext: { ...sessionContext(), longia_hub: hub },
              uiAction: uiAction || '',
            });
          }
        } else {
          data = await invokeLongiaGuestLive(supabase, {
            messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
            studentState: { role: 'host', coach_panel: true },
            sessionContext: { ...sessionContext(), longia_hub: hub },
            uiAction: uiAction || '',
          });
        }

        const mainMsg = String(data?.message ?? '').trim();
        const dedupeBlock = (raw) => {
          const t = String(raw ?? '').trim();
          if (!t || t === mainMsg) return '';
          return t;
        };
        const summary = dedupeBlock(data?.summary);
        const explanation = dedupeBlock(data?.explanation);
        const example = dedupeBlock(data?.example);

        const assistantText = [
          mainMsg || null,
          summary && `**À retenir** : ${summary}`,
          explanation && `**Reformulation** : ${explanation}`,
          example && `**Exemple / analogie** : ${example}`,
        ]
          .filter(Boolean)
          .join('\n\n');

        const assistantMsg = assistantText || 'Réponse vide.';
        setMessages([...nextMessages, { role: 'assistant', content: assistantMsg }]);
        setLastCard({
          message: data?.message,
          summary: summary || undefined,
          explanation: explanation || undefined,
          example: example || undefined,
          actions: Array.isArray(data?.actions) ? data.actions : [],
        });
      } catch (e) {
        toast?.({
          title: 'Coach formateur',
          description: e?.message || String(e),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [sessionId, userId, supabase, sessionContext, messages, toast, sessionTitle, stepTitle],
  );

  const onChip = useCallback(
    (action) => {
      void runTurn(action, '');
    },
    [runTurn],
  );

  const onSend = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    void runTurn('ask_question', t);
  }, [draft, runTurn]);

  const onImageFileChange = useCallback(
    (e) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      setInsertHubOpen(false);
      setMemberSectionExpanded(false);
      insertAtCaret(
        `[Image : ${f.name} — décrivez ce que le coach doit en retenir (contenu visible, objectif pédagogique).]\n`,
      );
      toast?.({
        title: 'Image',
        description: 'Complétez la description après le bloc inséré pour que LONGIA comprenne sans vision directe.',
      });
    },
    [insertAtCaret, toast],
  );

  const onPasteDraft = useCallback(
    (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        if (it.kind === 'file' && String(it.type || '').startsWith('image/')) {
          e.preventDefault();
          const file = it.getAsFile();
          const name = file?.name || 'collage';
          insertAtCaret(
            `[Capture / image collée : ${name} — décrivez le contenu utile pour le coach.]\n`,
          );
          toast?.({
            title: 'Image collée',
            description: 'Ajoutez une courte description du visuel dans le message.',
          });
          return;
        }
      }
    },
    [insertAtCaret, toast],
  );

  const insertMemberLine = useCallback(
    (p) => {
      const name = String(p?.name || 'Participant').trim() || 'Participant';
      const id = p?.id != null ? String(p.id) : '';
      const host = p?.isHost ? ' (hôte)' : '';
      const local = p?.isLocal ? ' (vous)' : '';
      insertAtCaret(`[Membre connecté : ${name}${host}${local}${id ? ` — id ${id}` : ''}]\n`);
      setInsertHubOpen(false);
      setMemberSectionExpanded(false);
    },
    [insertAtCaret],
  );

  const insertStepContext = useCallback(() => {
    const t = String(stepTitle || '').trim();
    if (!t) {
      toast?.({ title: 'Étape', description: 'Aucun titre d\'étape disponible pour l\'instant.', variant: 'destructive' });
      return;
    }
    insertAtCaret(`[Contexte étape en cours : ${t}]\n`);
    setInsertHubOpen(false);
    setMemberSectionExpanded(false);
  }, [insertAtCaret, stepTitle, toast]);

  const insertTimestamp = useCallback(() => {
    insertAtCaret(`[Horodatage : ${new Date().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}]\n`);
    setInsertHubOpen(false);
    setMemberSectionExpanded(false);
  }, [insertAtCaret]);

  const insertChatExcerpt = useCallback(() => {
    const lines = (chatMessages || [])
      .slice(-14)
      .map((m) => {
        const who = String(m?.name || '?').trim();
        const txt = String(m?.text || '').trim();
        return txt ? `- ${who}: ${txt}` : null;
      })
      .filter(Boolean);
    if (!lines.length) {
      toast?.({
        title: 'Chat salle',
        description: 'Aucun message récent à insérer.',
        variant: 'destructive',
      });
      return;
    }
    insertAtCaret(`[Extrait chat de séance — derniers messages]\n${lines.join('\n')}\n\n`);
    setInsertHubOpen(false);
    setMemberSectionExpanded(false);
  }, [chatMessages, insertAtCaret, toast]);

  if (!sessionId) {
    return (
      <p className="px-2 py-4 text-center text-[11px] text-white/45">
        Séance introuvable — impossible d'ouvrir le coach sans identifiant de session.
      </p>
    );
  }

  if (authLoading && !userId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-2 py-6">
        <Loader2 className="h-8 w-8 animate-spin text-amber-200/70" aria-hidden />
        <p className="m-0 text-center text-[11px] text-white/50">Chargement du compte…</p>
        <p className="m-0 text-center text-[10px] text-white/35">La zone de message apparaît dès que la session est reconnue.</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <p className="px-2 py-4 text-center text-[11px] text-white/45">
        Connectez-vous pour utiliser le coach formateur (compte formateur requis).
      </p>
    );
  }

  return (
    <div
      className={cn(
        'live-studio-premium flex min-h-0 min-w-0 h-full w-full max-w-full flex-1 flex-col overflow-hidden',
        'rounded-2xl border border-[#2D3139] bg-[#0F1419]/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden px-3 pb-2 pt-2">
      <p className="m-0 text-[10px] font-medium leading-snug tracking-normal text-white/50 [overflow-wrap:anywhere]">
        Discussion privée — invisible côté salle. Cartes ambre / vert / violet : pistes à vous approprier à
        l'oral.
      </p>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
        <div className={designerShellMicroLabel}>Flux de conversation</div>
        <div
          ref={scrollRef}
          className={cn(
            'lh-sy relative flex min-h-[72px] min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain rounded-xl border border-[#2D3139] bg-black/25 px-2 py-2 text-[11px] leading-snug text-white/88',
            '[scrollbar-width:thin] [scrollbar-color:rgba(255,189,123,0.22)_transparent]',
          )}
        >
        {!threadHydrated ? (
          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center rounded-[inherit] bg-[#1f1e1c]/45 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#14131c]/95 px-3 py-2 text-[10px] text-white/55">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Restauration du fil…
            </div>
          </div>
        ) : null}
        <div className="flex min-h-full min-w-0 flex-col justify-end gap-1.5">
        {messages.length === 0 && !loading ? (
          <p className="flex min-h-[4rem] items-center justify-center px-2 text-center text-[11px] leading-relaxed text-white/32">
            Écris une question ou choisis une puce — LONGIA te répond avec des pistes et des mini-rendus.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={`m-${i}-${String(m.content).slice(0, 12)}`}
            className={cn(
              'mb-2 w-full max-w-[min(100%,28rem)] backdrop-blur-[4px]',
              m.role === 'user' ? 'ml-auto' : 'mr-auto',
              designerShellMessageBubble(m.role === 'user'),
            )}
          >
            <p className="m-0 whitespace-pre-wrap break-words">{m.content}</p>
          </div>
        ))}
        {loading ? (
          <div
            className={cn(
              'mb-1.5 mr-auto flex max-w-[min(100%,28rem)] items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#14131c]/80 px-2.5 py-2',
              'text-[10px] text-white/48 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
            )}
          >
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-200/60" aria-hidden />
            LONGIA réfléchit…
          </div>
        ) : null}
        </div>
        </div>
      </div>

      {lastCard
        && (lastCard.summary
          || lastCard.explanation
          || lastCard.example
          || (typeof onPushRendersToBoard === 'function' && lastCard.message)) && (
        <div className="flex max-h-[36%] flex-shrink-0 flex-col gap-1.5 overflow-y-auto [scrollbar-width:thin]">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {typeof onPushRendersToBoard === 'function' ? (
              <button
                type="button"
                disabled={loading || !threadHydrated}
                title={
                  architectModeOn
                    ? 'Envoyer ces rendus sur le SmartBoard (Architecte)'
                    : 'Activez la pastille « Architecte » dans le journal LONGIA pour le flux conseillé'
                }
                onClick={() => onPushRendersToBoard(lastCard)}
                className="rounded-full border border-amber-400/30 bg-amber-500/[0.1] px-2.5 py-1 text-[9px] font-semibold leading-tight text-amber-100/95 transition hover:border-amber-300/45 hover:bg-amber-500/[0.16] disabled:opacity-40"
              >
                Architecte · vers le tableau
              </button>
            ) : null}
          </div>
          {lastCard.summary ? (
            <div className="rounded-xl border border-amber-400/22 bg-amber-500/[0.09] px-2.5 py-2 text-[10px] text-white/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-[4px]">
              <span className="font-semibold text-amber-100/95">Rendu — à retenir</span>
              <p className="mt-0.5 mb-0 whitespace-pre-wrap leading-snug">{lastCard.summary}</p>
            </div>
          ) : null}
          {lastCard.explanation ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.08] px-2.5 py-2 text-[10px] text-white/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-[4px]">
              <span className="font-semibold text-amber-100/90">Rendu — reformulation</span>
              <p className="mt-0.5 mb-0 whitespace-pre-wrap leading-snug">{lastCard.explanation}</p>
            </div>
          ) : null}
          {lastCard.example ? (
            <div className="rounded-xl border border-amber-400/22 bg-amber-500/[0.09] px-2.5 py-2 text-[10px] text-white/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-[4px]">
              <span className="font-semibold text-amber-100/90">Rendu — exemple</span>
              <p className="mt-0.5 mb-0 whitespace-pre-wrap leading-snug">{lastCard.example}</p>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex w-full min-w-0 flex-col gap-1.5">
        <div className={designerShellMicroLabel}>Actions rapides</div>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2">
          {(lastCard?.actions?.length
            ? lastCard.actions
            : [
                { label: 'Transition orale', action: 'suggest_transition' },
                { label: 'Simplifier mon propos', action: 'simplify' },
                { label: 'Exemple pour la salle', action: 'give_example' },
              ]
          ).map((a, i) => (
            <button
              key={`${a.action}-${i}`}
              type="button"
              disabled={loading || !threadHydrated}
              onClick={() => onChip(a.action)}
              className="inline-flex w-full min-w-0 items-center justify-start gap-2 rounded-2xl border border-white/14 bg-white/[0.06] px-3 py-2.5 text-left text-[11px] font-semibold leading-snug text-white/85 transition hover:border-amber-400/40 hover:bg-amber-500/12 hover:text-amber-50 disabled:opacity-40 [overflow-wrap:anywhere]"
            >
              <CoachQuickActionIcon action={a.action} />
              <span>{a.label}</span>
            </button>
          ))}
          <button
            type="button"
            disabled={loading || !threadHydrated}
            onClick={() => void runTurn('', '[Actualiser] Reprends le fil du chat salle et la séance.')}
            className="inline-flex w-full min-w-0 items-center justify-start gap-2 rounded-2xl border border-white/12 px-3 py-2.5 text-left text-[11px] font-medium leading-snug text-white/60 hover:bg-white/[0.07] hover:text-white/78 disabled:opacity-40 [overflow-wrap:anywhere]"
          >
            <Plus className="h-4 w-4 shrink-0 text-amber-400/85" strokeWidth={2} aria-hidden />
            <span>Contexte chat</span>
          </button>
        </div>
      </div>

      <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={onImageFileChange} />

      <div className="flex min-w-0 shrink-0 flex-col gap-1">
        <div
          className={cn(
            'flex min-h-[44px] min-w-0 items-end gap-1 rounded-xl border bg-[#0a0c10] px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow]',
            'border-[#2D3139] focus-within:border-[#7B61FF]/45 focus-within:shadow-[0_0_0_1px_rgba(255,189,123,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]',
          )}
        >
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={onPasteDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={2}
            placeholder="Message au coach (privé)…"
            className="min-h-[36px] min-w-0 flex-1 resize-none bg-transparent py-1 pl-1 pr-0 text-[11px] leading-relaxed text-white/92 outline-none ring-0 placeholder:text-white/32 focus:outline-none focus:ring-0 [field-sizing:content] sm:min-h-[34px]"
            style={{ maxHeight: '8.5rem' }}
          />
          <div className="flex shrink-0 flex-col items-center justify-end gap-0.5 pb-0.5">
            <div ref={insertHubRef} className="relative flex flex-col items-center">
              <button
                type="button"
                disabled={loading || !threadHydrated}
                aria-expanded={insertHubOpen}
                aria-haspopup="dialog"
                aria-controls="coach-insert-hub"
                onClick={() => {
                  setInsertHubOpen((o) => {
                    const next = !o;
                    if (!next) setMemberSectionExpanded(false);
                    return next;
                  });
                }}
                title="Insérer — image, membre, étape, chat…"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-white/55 transition disabled:opacity-35',
                  insertHubOpen
                    ? 'bg-white/[0.12] text-amber-100'
                    : 'hover:bg-white/[0.08] hover:text-white/85',
                )}
              >
                <PlusCircle className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden />
              </button>

              {insertHubOpen ? (
                <div
                  id="coach-insert-hub"
                  role="dialog"
                  aria-label="Insérer dans le message coach"
                  className="absolute right-0 bottom-full z-[120] mb-1.5 w-[min(94vw,280px)] overflow-hidden rounded-xl border border-white/12 bg-[#0d0f14] shadow-[0_12px_40px_rgba(0,0,0,.55)]"
                >
                  <div className="border-b border-white/[0.06] px-2.5 py-1.5">
                    <p className={cn(designerShellMicroLabel, 'm-0 text-[9px] font-semibold tracking-wide text-white/55')}>
                      Insérer dans le message
                    </p>
                  </div>
                  <div className="flex flex-col p-1">
                    <button
                      type="button"
                      disabled={loading || !threadHydrated}
                      onClick={() => imageFileRef.current?.click()}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[10px] text-white/88 transition hover:bg-white/[0.07] disabled:opacity-40"
                    >
                      <ImagePlus className="h-3.5 w-3.5 shrink-0 text-amber-200/80" strokeWidth={2} aria-hidden />
                      <span>
                        <span className="font-semibold text-white/92">Image (fichier)</span>
                        <span className="mt-0.5 block text-[9px] font-normal text-white/45">Puis décrivez le visuel dans le texte</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={loading || !threadHydrated}
                      onClick={() => setMemberSectionExpanded((e) => !e)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[10px] transition hover:bg-white/[0.07] disabled:opacity-40',
                        memberSectionExpanded ? 'bg-amber-500/12 text-amber-100' : 'text-white/88',
                      )}
                    >
                      <Users className="h-3.5 w-3.5 shrink-0 text-amber-200/80" strokeWidth={2} aria-hidden />
                      <span>
                        <span className="font-semibold">Membre connecté</span>
                        <span className="mt-0.5 block text-[9px] font-normal text-white/45">Choisir dans la liste ci-dessous</span>
                      </span>
                    </button>
                    {memberSectionExpanded ? (
                      <div
                        className="mb-1 max-h-[120px] overflow-y-auto rounded-lg border border-white/[0.08] bg-black/25 px-0.5 py-0.5 [scrollbar-width:thin]"
                        role="listbox"
                        aria-label="Membres connectés"
                      >
                        {(liveParticipants || []).length === 0 ? (
                          <p className="m-0 px-2 py-2 text-[9px] text-white/40">Aucun participant listé.</p>
                        ) : (
                          (liveParticipants || []).map((p) => (
                            <button
                              key={String(p.id ?? p.name)}
                              type="button"
                              onClick={() => insertMemberLine(p)}
                              className="w-full truncate rounded-md px-2 py-1.5 text-left text-[10px] text-white/85 transition hover:bg-white/[0.07]"
                            >
                              <span className="font-semibold text-amber-100/90">{p.name || '?'}</span>
                              {p.isHost ? <span className="text-white/40"> · hôte</span> : null}
                              {p.isLocal ? <span className="text-white/40"> · vous</span> : null}
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={loading || !threadHydrated}
                      onClick={insertStepContext}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[10px] text-white/88 transition hover:bg-white/[0.07] disabled:opacity-40"
                    >
                      <Bookmark className="h-3.5 w-3.5 shrink-0 text-amber-200/75" strokeWidth={2} aria-hidden />
                      <span>
                        <span className="font-semibold">Étape en cours</span>
                        <span className="mt-0.5 block text-[9px] font-normal text-white/45">Titre de la scène / étape</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={loading || !threadHydrated}
                      onClick={insertChatExcerpt}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[10px] text-white/88 transition hover:bg-white/[0.07] disabled:opacity-40"
                    >
                      <MessagesSquare className="h-3.5 w-3.5 shrink-0 text-amber-200/80" strokeWidth={2} aria-hidden />
                      <span>
                        <span className="font-semibold">Extrait chat salle</span>
                        <span className="mt-0.5 block text-[9px] font-normal text-white/45">Derniers messages de la séance</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={loading || !threadHydrated}
                      onClick={insertTimestamp}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[10px] text-white/88 transition hover:bg-white/[0.07] disabled:opacity-40"
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0 text-white/55" strokeWidth={2} aria-hidden />
                      <span>
                        <span className="font-semibold">Horodatage</span>
                        <span className="mt-0.5 block text-[9px] font-normal text-white/45">Date et heure locales</span>
                      </span>
                    </button>
                  </div>
                  <p className={cn(designerShellMicroLabel, 'm-0 border-t border-white/[0.06] px-2.5 py-2 text-[8px] leading-snug text-white/38')}>
                    Astuce : collez une image dans le champ (Ctrl+V / ⌘V) sans ouvrir ce menu.
                  </p>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              disabled={loading || !draft.trim() || !threadHydrated}
              onClick={onSend}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-30',
                draft.trim() && threadHydrated && !loading
                  ? 'bg-amber-500/22 text-amber-50 hover:bg-amber-500/30'
                  : 'text-white/35 hover:bg-white/[0.06] hover:text-white/55',
              )}
              title="Envoyer (Entrée)"
            >
              <Send className="h-[15px] w-[15px]" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </div>
        <p className={cn(designerShellMicroLabel, 'm-0 px-0.5 text-[8px] font-medium tracking-[0.04em] text-white/28')}>
          Entrée envoie · Maj+Entrée ligne suivante
        </p>
      </div>
      </div>
    </div>
  );
}
