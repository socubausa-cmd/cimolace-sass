import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultGuestStudentState,
  invokeLongiaGuestLive,
  loadGuestNotes,
  saveGuestNotes,
} from '@/lib/longiaGuestClient';
import { fetchLongiaChatThread, upsertLongiaChatThread } from '@/lib/longiaChatThreadPersistence';
import {
  buildLongiaHubV1,
  LONGIA_SURFACE,
  LONGIA_CAPABILITY,
  LONGIA_ENGINE_ROLE,
} from '@/lib/longiaHub';
import { BUS_EVENTS } from '@/lib/longiaRealtimeBus';

/** Sélecteur de méthode audio LIRI — radio exclusif (navigateur / ElevenLabs / LiveKit / aucun). */
function LiriAudioMethodSelector({ multilangAudio }) {
  const {
    browserTtsOffered, browserTtsOn, onBrowserTtsChange,
    edgeTtsOffered, edgeTtsOn, onEdgeTtsChange,
    livekitOffered, livekitParticipantCount,
    interpreterVolume, onInterpreterVolumeChange,
  } = multilangAudio;

  const activeMethod =
    browserTtsOn ? 'browser' :
    edgeTtsOn    ? 'edge' :
    /* livekit has no explicit on/off — treat it as "selected" when neither tts is on and livekit is offered */
    'none';

  function selectMethod(method) {
    onBrowserTtsChange?.(method === 'browser');
    onEdgeTtsChange?.(method === 'edge');
  }

  const options = [
    { id: 'none',    label: 'Muet',                  offered: true },
    { id: 'browser', label: 'Voix navigateur',        offered: browserTtsOffered },
    { id: 'edge',    label: 'ElevenLabs (serveur)',   offered: edgeTtsOffered },
    { id: 'livekit', label: `Interprète salle${livekitParticipantCount > 0 ? ` · ${livekitParticipantCount}` : ''}`, offered: livekitOffered },
  ].filter((o) => o.offered);

  return (
    <div
      style={{
        marginTop: '8px',
        paddingTop: '8px',
        borderTop: '1px solid rgba(250,208,167, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)' }}>
        AUDIO TRADUCTION
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {options.map((o) => {
          const checked = o.id === 'livekit'
            ? activeMethod === 'none' && livekitOffered
            : activeMethod === o.id;
          return (
            <label
              key={o.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '9px',
                padding: '3px 8px',
                borderRadius: '999px',
                border: `1px solid ${checked ? 'rgba(250,208,167, 0.55)' : 'rgba(255,255,255,0.12)'}`,
                background: checked ? 'rgba(237,180,124, 0.2)' : 'rgba(0,0,0,0.2)',
                color: checked ? '#f3e8d2' : 'rgba(255,255,255,0.55)',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <input
                type="radio"
                name="liri-audio-method"
                value={o.id}
                checked={checked}
                onChange={() => selectMethod(o.id)}
                style={{ accentColor: '#d4a36a', width: 10, height: 10 }}
              />
              {o.label}
            </label>
          );
        })}
      </div>
      {livekitOffered && activeMethod === 'none' ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', color: 'rgba(253,200,147, 0.7)' }}>
          <span style={{ flexShrink: 0 }}>Volume</span>
          <input
            type="range"
            min={0} max={1} step={0.05}
            value={interpreterVolume}
            onChange={(e) => onInterpreterVolumeChange?.(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#e3c79a' }}
          />
          <span style={{ flexShrink: 0, minWidth: 28, textAlign: 'right' }}>
            {Math.round(interpreterVolume * 100)}%
          </span>
        </label>
      ) : null}
    </div>
  );
}

const LEVELS = [
  { id: 'beginner', label: 'Débutant' },
  { id: 'intermediate', label: 'Intermédiaire' },
  { id: 'advanced', label: 'Avancé' },
];

const MODES = [
  { id: 'discreet', label: 'Discret' },
  { id: 'assisted', label: 'Assisté' },
  { id: 'coach', label: 'Coach' },
];

/**
 * Assistant LONGIA personnel — invité live (résumé, explications, notes, signaux prof).
 */
export default function LiveGuestLongiaPanel({
  supabase,
  sessionId,
  user,
  sessionTitle,
  stepTitle,
  chatMessages = [],
  teacherTranscriptSnippet = '',
  teacherTranscriptPartial = '',
  publishLongiaBusEvent,
  /** @type {Array<{ id: string; headline: string; detail?: string; urgent?: boolean; panelMsg?: string; at?: number }>} */
  sessionDigests = [],
  chatEnabled = true,
  toast,
  /**
   * Sous-titres multilingues (null = désactivé côté salle).
   * @type {null | { sourceLang: string; targetLangs: string[]; viewLang: string; onViewLangChange: (v: string) => void; rollingByLang: Record<string, { final?: string; partial?: string }> }}
   */
  multilangGuest = null,
  /**
   * Audio multilingue : TTS navigateur + contrôle volume piste LiveKit agent.
   * @type {null | {
   *   browserTtsOffered: boolean;
   *   browserTtsOn: boolean;
   *   onBrowserTtsChange: (v: boolean) => void;
   *   edgeTtsOffered: boolean;
   *   edgeTtsOn: boolean;
   *   onEdgeTtsChange: (v: boolean) => void;
   *   livekitOffered: boolean;
   *   livekitParticipantCount: number;
   *   interpreterVolume: number;
   *   onInterpreterVolumeChange: (n: number) => void;
   * }}
   */
  multilangAudio = null,
  /** Phase 6 : avant signal `longia_guest` vers le formateur (RPC + contexte). */
  assertCriticalGuestAction = null,
}) {
  const [expanded, setExpanded] = useState(false);
  const [studentState, setStudentState] = useState(() =>
    defaultGuestStudentState(user?.id),
  );
  const [notes, setNotes] = useState('');
  const [messages, setMessages] = useState([]);
  const [lastCard, setLastCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [threadReady, setThreadReady] = useState(false);
  const persistTimerRef = useRef(null);
  const lastTeacherSignalAtRef = useRef(0);

  useEffect(() => {
    setStudentState((prev) => ({ ...prev, student_id: user?.id ? String(user.id) : 'guest' }));
  }, [user?.id]);

  useEffect(() => {
    if (!sessionId) return;
    setNotes(loadGuestNotes(sessionId));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !user?.id || !supabase) {
      setThreadReady(true);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { row } = await fetchLongiaChatThread(supabase, 'live_student', sessionId);
      if (cancelled) return;
      if (row?.messages?.length) {
        const restored = row.messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.text || m.content || ''),
        }));
        setMessages(restored.filter((x) => String(x.content || '').trim()));
      }
      setThreadReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, user?.id, supabase]);

  useEffect(() => {
    if (!threadReady || !sessionId || !user?.id || !supabase || loading) return undefined;
    if (messages.length === 0) return undefined;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const toSave = messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: String(m.content || ''),
        }));
      void upsertLongiaChatThread(supabase, 'live_student', sessionId, toSave, `Live — ${sessionTitle || sessionId}`);
    }, 900);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [messages, threadReady, sessionId, user?.id, supabase, loading, sessionTitle]);

  const transcriptForContext = useMemo(() => {
    if (!multilangGuest || multilangGuest.viewLang === 'source') {
      return {
        finals: String(teacherTranscriptSnippet || '').trim(),
        partial: String(teacherTranscriptPartial || '').trim(),
      };
    }
    const r = multilangGuest.rollingByLang?.[multilangGuest.viewLang];
    return {
      finals: String(r?.final || '').trim(),
      partial: String(r?.partial || '').trim(),
    };
  }, [multilangGuest, teacherTranscriptSnippet, teacherTranscriptPartial]);

  const captionDisplay = useMemo(() => {
    if (!multilangGuest) {
      return {
        showLangSelect: false,
        finals: String(teacherTranscriptSnippet || '').trim(),
        partial: String(teacherTranscriptPartial || '').trim(),
      };
    }
    if (multilangGuest.viewLang === 'source') {
      return {
        showLangSelect: true,
        finals: String(teacherTranscriptSnippet || '').trim(),
        partial: String(teacherTranscriptPartial || '').trim(),
      };
    }
    const r = multilangGuest.rollingByLang?.[multilangGuest.viewLang];
    return {
      showLangSelect: true,
      finals: String(r?.final || '').trim(),
      partial: String(r?.partial || '').trim(),
    };
  }, [multilangGuest, teacherTranscriptSnippet, teacherTranscriptPartial]);

  const sessionContext = useCallback(() => {
    const excerpt = (chatMessages || [])
      .map((m) => `${m.name || '?'}: ${m.text || ''}`)
      .join('\n');
    const finals = transcriptForContext.finals;
    const partial = transcriptForContext.partial;
    return {
      sessionId,
      sessionTitle: sessionTitle || null,
      stepTitle: stepTitle || null,
      chatExcerpt: excerpt || null,
      transcriptSnippet: finals || null,
      transcriptPartial: partial || null,
    };
  }, [sessionId, sessionTitle, stepTitle, chatMessages, transcriptForContext]);

  const runTurn = useCallback(
    async (uiAction, extraUserLine, stateOverride) => {
      if (!sessionId || !user?.id) return;
      const st = stateOverride || studentState;
      const userLine = String(extraUserLine || '').trim();
      const nextMessages =
        userLine.length > 0
          ? [...messages, { role: 'user', content: userLine }]
          : [...messages];

      setLoading(true);
      try {
        const baseCtx = sessionContext();
        const hub = buildLongiaHubV1({
          surface: LONGIA_SURFACE.LIVE_STUDENT_COACH,
          mode: 'coach',
          engines: [LONGIA_ENGINE_ROLE.COACH],
          capabilities: [LONGIA_CAPABILITY.LIVE_SIGNALS],
          features: { student_level: st?.level, student_mode: st?.mode },
        });
        const data = await invokeLongiaGuestLive(supabase, {
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          studentState: st,
          sessionContext: { ...baseCtx, longia_hub: hub },
          uiAction: uiAction || '',
        });

        const assistantText = [
          data?.message && String(data.message),
          data?.summary && `**À retenir** : ${data.summary}`,
          data?.explanation && `**Explication** : ${data.explanation}`,
          data?.example && `**Exemple** : ${data.example}`,
        ]
          .filter(Boolean)
          .join('\n\n');

        const assistantMsg = assistantText || 'Réponse vide.';
        const updatedThread = [...nextMessages, { role: 'assistant', content: assistantMsg }];
        setMessages(updatedThread);

        setLastCard({
          message: data?.message,
          summary: data?.summary,
          explanation: data?.explanation,
          example: data?.example,
          actions: Array.isArray(data?.actions) ? data.actions : [],
        });

        const nu = data?.notes_update;
        if (nu && nu.enabled && typeof nu.content === 'string' && nu.content.trim()) {
          setNotes((prev) => {
            const block = nu.content.trim();
            const next = prev ? `${prev}\n\n—\n${block}` : block;
            saveGuestNotes(sessionId, next);
            return next;
          });
        }

        const ts = data?.teacher_signal;
        if (ts && ts.send === true && user?.id) {
          const now = Date.now();
          if (now - lastTeacherSignalAtRef.current < 90_000) {
            toast?.({
              title: 'Signal prof',
              description: 'Tu viens d\'en envoyer un — attends un peu avant le prochain.',
            });
            } else {
              if (typeof assertCriticalGuestAction === 'function') {
                const ok = await assertCriticalGuestAction('canUseSignals');
                if (!ok) {
                  toast?.({
                    title: 'Signal prof',
                    description: 'Permission « signaux » non confirmée côté serveur.',
                    variant: 'destructive',
                  });
                  return;
                }
              }
              lastTeacherSignalAtRef.current = now;
              const payload = {
                type: String(ts.type || 'guest_signal'),
                payload: ts.payload && typeof ts.payload === 'object' ? ts.payload : {},
              };
              const { error } = await supabase.from('live_session_signals').insert({
                live_session_id: sessionId,
                user_id: user.id,
                type: 'longia_guest',
                payload: JSON.stringify(payload),
              });
              if (error) {
                toast?.({
                  title: 'Envoi signal',
                  description: error.message,
                  variant: 'destructive',
                });
              } else {
                publishLongiaBusEvent?.(BUS_EVENTS.STUDENT_ACTION, {
                  action: 'teacher_escalation',
                  student_id: String(user.id),
                  topic: typeof st.current_topic === 'string' ? st.current_topic : null,
                });
                toast?.({
                  title: 'Merci',
                  description: 'Ton signal a été transmis au formateur (vue agrégée).',
                });
              }
            }
        }
      } catch (e) {
        toast?.({
          title: 'LONGIA',
          description: e?.message || String(e),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [sessionId, user?.id, supabase, studentState, sessionContext, messages, toast, publishLongiaBusEvent, assertCriticalGuestAction],
  );

  const bumpConfusionAndSignal = useCallback(() => {
    publishLongiaBusEvent?.(BUS_EVENTS.STUDENT_ACTION, {
      action: 'confused',
      student_id: user?.id ? String(user.id) : 'guest',
      topic: typeof studentState.current_topic === 'string' ? studentState.current_topic : null,
    });
    const nextSt = {
      ...studentState,
      confusion_score: (Number(studentState.confusion_score) || 0) + 1,
      last_help_request_at: Date.now(),
    };
    setStudentState(nextSt);
    void runTurn('mark_confusing', 'Je suis perdu sur ce passage.', nextSt);
  }, [studentState, runTurn, publishLongiaBusEvent, user?.id]);

  const onChip = useCallback(
    (action) => {
      void runTurn(action, '');
    },
    [runTurn],
  );

  const onSendDraft = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    void runTurn('ask_question', t);
  }, [draft, runTurn]);

  if (!sessionId || !user?.id || !threadReady) return null;

  return (
    <div
      style={{
        borderRadius: '6px',
        border: '1px solid rgba(250,208,167, 0.28)',
        background: 'linear-gradient(155deg, rgba(48,39,30, 0.92), rgba(22,17,12, 0.96))',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          border: 'none',
          background: expanded ? 'rgba(237,180,124, 0.12)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#f3e8d2' }}>
          LONGIA — assistant perso
        </span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{expanded ? '▼' : '▶'}</span>
      </button>

      {multilangGuest || captionDisplay.finals || captionDisplay.partial ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '8px 10px',
            borderTop: '1px solid rgba(250,208,167, 0.15)',
            borderBottom: '1px solid rgba(250,208,167, 0.08)',
          }}
        >
          <div
            style={{
              fontSize: '8px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'rgba(208,187,167, 0.75)',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <span>Voix formateur</span>
            {captionDisplay.showLangSelect && multilangGuest ? (
              <select
                value={multilangGuest.viewLang}
                onChange={(e) => multilangGuest.onViewLangChange?.(e.target.value)}
                style={{
                  maxWidth: '140px',
                  fontSize: '9px',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(0,0,0,0.35)',
                  color: '#fff',
                }}
              >
                <option value="source">
                  Original ({(multilangGuest.sourceLang || '?').toUpperCase()})
                </option>
                {(multilangGuest.targetLangs || []).map((l) => (
                  <option key={l} value={l}>
                    {String(l).toUpperCase()}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '10px',
              lineHeight: 1.45,
              color: 'rgba(255,255,255,0.88)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {captionDisplay.finals || (captionDisplay.partial ? '' : '…')}
            {captionDisplay.partial ? (
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                {captionDisplay.finals ? ' ' : ''}
                {captionDisplay.partial}
              </span>
            ) : null}
          </p>
          {multilangAudio &&
          multilangGuest &&
          multilangGuest.viewLang !== 'source' &&
          (multilangAudio.browserTtsOffered ||
            multilangAudio.edgeTtsOffered ||
            multilangAudio.livekitOffered) ? (
            <LiriAudioMethodSelector multilangAudio={multilangAudio} />
          ) : null}
        </div>
      ) : null}

      {Array.isArray(sessionDigests) && sessionDigests.length > 0 ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '6px 10px 8px',
            borderTop: '1px solid rgba(250,208,167, 0.15)',
            maxHeight: expanded ? 160 : 72,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '8px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'rgba(253,230,138, 0.75)',
              marginBottom: '6px',
            }}
          >
            Fil formateur (lecture seule)
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(expanded ? sessionDigests.slice(-12) : sessionDigests.slice(-2))
              .slice()
              .reverse()
              .map((d) => (
                <li
                  key={d.id}
                  style={{
                    fontSize: '9px',
                    lineHeight: 1.4,
                    color: 'rgba(255,255,255,0.82)',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: `1px solid ${d.urgent ? 'rgba(248,113,113, 0.35)' : 'rgba(255,255,255,0.1)'}`,
                    background: d.urgent ? 'rgba(248,113,113, 0.08)' : 'rgba(0,0,0,0.25)',
                  }}
                >
                  <span style={{ fontWeight: 700, color: d.urgent ? '#fecaca' : '#f3e8d2' }}>{d.headline}</span>
                  {d.detail ? (
                    <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.65)' }}>
                      {d.detail.length > 280 && !expanded ? `${d.detail.slice(0, 280)}…` : d.detail}
                    </p>
                  ) : null}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {expanded ? (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <select
              value={studentState.level}
              onChange={(e) =>
                setStudentState((s) => ({ ...s, level: e.target.value }))
              }
              style={{
                flex: 1,
                minWidth: '100px',
                fontSize: '9px',
                padding: '4px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(0,0,0,0.35)',
                color: '#fff',
              }}
            >
              {LEVELS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={studentState.mode}
              onChange={(e) =>
                setStudentState((s) => ({ ...s, mode: e.target.value }))
              }
              style={{
                flex: 1,
                minWidth: '100px',
                fontSize: '9px',
                padding: '4px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(0,0,0,0.35)',
                color: '#fff',
              }}
            >
              {MODES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {lastCard?.summary ? (
            <div
              style={{
                fontSize: '10px',
                lineHeight: 1.45,
                color: 'rgba(255,255,255,0.88)',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid rgba(251,191,36, 0.22)',
                background: 'rgba(251,191,36, 0.06)',
              }}
            >
              <span style={{ fontWeight: 700, color: '#fde68a' }}>Ce qu'il faut comprendre</span>
              <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{lastCard.summary}</p>
            </div>
          ) : null}

          {lastCard?.explanation ? (
            <div
              style={{
                fontSize: '10px',
                lineHeight: 1.45,
                color: 'rgba(255,255,255,0.85)',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid rgba(153,102,52, 0.2)',
                background: 'rgba(129,72,16, 0.06)',
              }}
            >
              <span style={{ fontWeight: 700, color: '#6ee7b7' }}>Version simple</span>
              <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{lastCard.explanation}</p>
            </div>
          ) : null}

          {lastCard?.example ? (
            <div
              style={{
                fontSize: '10px',
                lineHeight: 1.45,
                color: 'rgba(255,255,255,0.85)',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid rgba(248,188,129, 0.25)',
                background: 'rgba(241,170,99, 0.08)',
              }}
            >
              <span style={{ fontWeight: 700, color: '#e3c79a' }}>Exemple / analogie</span>
              <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{lastCard.example}</p>
            </div>
          ) : null}

          {lastCard?.message && !lastCard?.summary ? (
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.82)', margin: 0, lineHeight: 1.5 }}>
              {lastCard.message}
            </p>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {(lastCard?.actions?.length
              ? lastCard.actions
              : [
                  { label: 'Résumé du passage', action: 'what_to_remember' },
                  { label: 'Expliquer plus simple', action: 'simplify' },
                  { label: 'Exemple concret', action: 'give_example' },
                ]
            ).map((a, i) => (
              <button
                key={`${a.action}-${i}`}
                type="button"
                disabled={loading}
                onClick={() => onChip(a.action)}
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '999px',
                  border: '1px solid rgba(250,208,167, 0.35)',
                  background: 'rgba(237,180,124, 0.15)',
                  color: '#f3e8d2',
                  cursor: loading ? 'default' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {a.label}
              </button>
            ))}
            <button
              type="button"
              disabled={loading}
              onClick={bumpConfusionAndSignal}
              style={{
                fontSize: '9px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '999px',
                border: '1px solid rgba(248,113,113, 0.35)',
                background: 'rgba(239,68,68, 0.1)',
                color: '#fecaca',
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              Je bloque
            </button>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSendDraft()}
              placeholder="Ta question (privée pour LONGIA)…"
              style={{
                flex: 1,
                fontSize: '10px',
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.35)',
                color: '#fff',
              }}
            />
            <button
              type="button"
              disabled={loading || !draft.trim()}
              onClick={onSendDraft}
              style={{
                fontSize: '9px',
                fontWeight: 700,
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid rgba(250,208,167, 0.4)',
                background: 'rgba(237,180,124, 0.25)',
                color: '#fff',
                cursor: loading || !draft.trim() ? 'default' : 'pointer',
                opacity: loading || !draft.trim() ? 0.45 : 1,
              }}
            >
              Envoyer
            </button>
          </div>

          {chatEnabled ? (
            <button
              type="button"
              disabled={loading || !draft.trim()}
              onClick={async () => {
                const t = draft.trim();
                if (!t) return;
                setDraft('');
                const { error } = await supabase.from('live_session_chat').insert({
                  live_session_id: sessionId,
                  user_id: user.id,
                  message: t,
                });
                if (error) {
                  toast?.({ title: 'Chat', description: error.message, variant: 'destructive' });
                } else {
                  toast?.({ title: 'Chat', description: 'Question envoyée au groupe.' });
                }
              }}
              style={{
                fontSize: '9px',
                alignSelf: 'flex-start',
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(248,152,56, 0.35)',
                background: 'rgba(233,123,14, 0.12)',
                color: '#7dd3fc',
                cursor: 'pointer',
              }}
            >
              Publier ma question dans le chat du live
            </button>
          ) : null}

          <div>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>
              Brouillon LONGIA (ce navigateur)
            </span>
            <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.32)', margin: '4px 0 0', lineHeight: 1.4 }}>
              Pour le cahier de cours sauvegardé (export, envoi au prof, captures tableau), utilisez le panneau de droite « Cahier de séance ».
            </p>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                saveGuestNotes(sessionId, e.target.value);
              }}
              rows={3}
              style={{
                width: '100%',
                marginTop: '4px',
                fontSize: '10px',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(0,0,0,0.4)',
                color: '#e5e5e5',
                resize: 'vertical',
              }}
            />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void runTurn('', '[Rafraîchir] Mets à jour ton aide à partir du fil de chat récent.')}
            style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '6px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.65)',
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading ? '…' : 'Actualiser avec le chat du live'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
