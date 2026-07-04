import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { nt } from '@/features/live/host/liveHostUtils';
import { playLiriHostEventChime } from '@/lib/liriHostEventChime';
import {
  LIVE_PERMISSION_REQUEST_SIGNAL_TYPE,
  parsePermissionRequestPayload,
} from '@/lib/liriLive/permissionRequestSignals';
import {
  LIVE_JOYKIT_REQUEST_SIGNAL_TYPE,
  parseJoyKitRequestPayload,
} from '@/lib/liriLive/joykitRequestSignals';

/**
 * Chargement initial + canal Realtime `live_session_signals` :
 * mains levées, réactions flottantes, signaux LONGIA invité, demandes permission / JoyKit.
 */
export function useLiveHostLiveSessionSignalsRealtime({
  sessionId,
  phase,
  isGuestUi,
  userId,
  setPanels,
  setMyHandRaised,
  setZone3RaisedHands,
  setHostPermissionRequests,
  setHostJoyKitRequests,
  arenaHostAlertSoundRef,
  hostSfxCtxRef,
}) {
  const [floatingReactions, setFloatingReactions] = useState([]);

  useEffect(() => {
    if (!sessionId || phase !== PHASE.LIVE) return;

    (async () => {
      const { data } = await supabase
        .from('live_session_signals')
        .select('id, user_id, type, created_at')
        .eq('live_session_id', sessionId)
        .eq('type', 'hand_raise')
        .eq('resolved', false);
      if (isGuestUi && userId) {
        setMyHandRaised(Boolean(data?.length && data.some((s) => s.user_id === userId)));
      }
      if (data?.length) {
        const ids = [...new Set(data.map((s) => s.user_id).filter(Boolean))];
        const { data: profs } = ids.length
          ? await supabase.from('profiles').select('id, name, avatar_url').in('id', ids)
          : { data: [] };
        const pmap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
        const events = data.map((s) => ({
          avatar: pmap[s.user_id]?.name || 'Participant',
          userId: s.user_id,
          signalId: s.id,
          msg: `${pmap[s.user_id]?.name || 'Participant'} a la main levée`,
          type: 'hand_up',
          time: new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        }));
        setPanels((prev) => prev.map((p, i) => (i === 0 ? { ...p, events } : p)));
        setZone3RaisedHands(
          data.map((s) => ({
            userId: s.user_id,
            signalId: s.id,
            name: pmap[s.user_id]?.name || 'Participant',
            avatar_url: pmap[s.user_id]?.avatar_url || null,
            at: new Date(s.created_at).getTime(),
          })),
        );
      }
    })();

    (async () => {
      if (!sessionId || isGuestUi) return;
      const { data: permRows } = await supabase
        .from('live_session_signals')
        .select('id, user_id, payload, created_at')
        .eq('live_session_id', sessionId)
        .eq('type', LIVE_PERMISSION_REQUEST_SIGNAL_TYPE)
        .eq('resolved', false);
      const pending = (permRows || []).filter((r) => {
        const p = parsePermissionRequestPayload(r.payload);
        return !p.status || p.status === 'pending';
      });
      if (!pending.length) {
        setHostPermissionRequests([]);
        return;
      }
      const uids = [...new Set(pending.map((r) => r.user_id).filter(Boolean))];
      const { data: profs } = uids.length
        ? await supabase.from('profiles').select('id, name').in('id', uids)
        : { data: [] };
      const pmap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      setHostPermissionRequests(
        pending.map((r) => {
          const p = parsePermissionRequestPayload(r.payload);
          return {
            id: r.id,
            userId: r.user_id,
            name: pmap[r.user_id]?.name || 'Participant',
            action: p.action || '',
            createdAt: r.created_at,
            status: 'pending',
          };
        }),
      );
    })();

    (async () => {
      if (!sessionId || isGuestUi) return;
      const { data: jRows } = await supabase
        .from('live_session_signals')
        .select('id, user_id, payload, created_at')
        .eq('live_session_id', sessionId)
        .eq('type', LIVE_JOYKIT_REQUEST_SIGNAL_TYPE)
        .eq('resolved', false);
      const jpending = (jRows || []).filter((r) => {
        const p = parseJoyKitRequestPayload(r.payload);
        return !p.status || p.status === 'pending';
      });
      if (!jpending.length) {
        setHostJoyKitRequests([]);
        return;
      }
      const juids = [...new Set(jpending.map((r) => r.user_id).filter(Boolean))];
      const { data: jprofs } = juids.length
        ? await supabase.from('profiles').select('id, name').in('id', juids)
        : { data: [] };
      const jpmap = Object.fromEntries((jprofs || []).map((p) => [p.id, p]));
      setHostJoyKitRequests(
        jpending.map((r) => {
          const p = parseJoyKitRequestPayload(r.payload);
          return {
            id: r.id,
            userId: r.user_id,
            name: jpmap[r.user_id]?.name || 'Participant',
            requestedLevel: p.level || 'control',
            createdAt: r.created_at,
          };
        }),
      );
    })();

    const ch = supabase
      .channel(`live-signals-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_session_signals', filter: `live_session_id=eq.${sessionId}` },
        async (payload) => {
          const sig = payload.new;
          if (sig.type === 'hand_raise') {
            if (arenaHostAlertSoundRef.current) playLiriHostEventChime(hostSfxCtxRef.current, 'hand');
            const { data: prof } = await supabase.from('profiles').select('name, avatar_url').eq('id', sig.user_id).maybeSingle();
            const name = prof?.name || 'Participant';
            setPanels((prev) =>
              prev.map((p, i) =>
                i === 0
                  ? {
                      ...p,
                      events: p.events.some((e) => e.userId === sig.user_id)
                        ? p.events
                        : [...p.events, { avatar: name, userId: sig.user_id, signalId: sig.id, msg: `${name} a levé la main`, type: 'hand_up', time: nt() }],
                    }
                  : p,
              ),
            );
            setZone3RaisedHands((prev) => {
              if (prev.some((h) => h.userId === sig.user_id)) return prev;
              return [...prev, { userId: sig.user_id, signalId: sig.id, name, avatar_url: prof?.avatar_url || null, at: Date.now() }];
            });
          } else if (sig.type === 'reaction') {
            const id = Date.now() + Math.random();
            const x = 20 + Math.random() * 60;
            setFloatingReactions((prev) => [...prev, { id, emoji: sig.payload, x }]);
            setTimeout(() => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)), 2200);
          } else if (sig.type === 'longia_guest' && !isGuestUi) {
            const { data: prof } = await supabase.from('profiles').select('name').eq('id', sig.user_id).maybeSingle();
            const name = prof?.name || 'Participant';
            let detail = 'Signal LONGIA invité';
            try {
              const p = JSON.parse(String(sig.payload || '{}'));
              detail = `${String(p.type || 'signal')} — ${JSON.stringify(p.payload ?? {})}`;
            } catch {
              /* ignore */
            }
            setPanels((prev) =>
              prev.map((p, i) =>
                i === 2
                  ? {
                      ...p,
                      events: [
                        ...p.events,
                        {
                          avatar: name,
                          msg: `LONGIA invité · ${detail.slice(0, 220)}`,
                          type: 'message',
                          time: nt(),
                        },
                      ],
                    }
                  : p,
              ),
            );
          } else if (sig.type === LIVE_PERMISSION_REQUEST_SIGNAL_TYPE && !isGuestUi) {
            const parsed = parsePermissionRequestPayload(sig.payload);
            if (parsed.status && parsed.status !== 'pending') return;
            const { data: prof } = await supabase.from('profiles').select('name').eq('id', sig.user_id).maybeSingle();
            const name = prof?.name || 'Participant';
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.info('[LiriLive permission_request] host realtime INSERT', { id: sig.id, userId: sig.user_id, action: parsed.action });
            }
            setHostPermissionRequests((prev) => {
              if (prev.some((p) => p.id === sig.id)) return prev;
              return [
                ...prev,
                {
                  id: sig.id,
                  userId: sig.user_id,
                  name,
                  action: parsed.action || '',
                  createdAt: sig.created_at,
                  status: 'pending',
                },
              ];
            });
          } else if (sig.type === LIVE_JOYKIT_REQUEST_SIGNAL_TYPE && !isGuestUi) {
            const parsed = parseJoyKitRequestPayload(sig.payload);
            if (parsed.status && parsed.status !== 'pending') return;
            const { data: prof } = await supabase.from('profiles').select('name').eq('id', sig.user_id).maybeSingle();
            const name = prof?.name || 'Participant';
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.info('[LiriLive joykit_request] host realtime INSERT', { id: sig.id, userId: sig.user_id, level: parsed.level });
            }
            setHostJoyKitRequests((prev) => {
              if (prev.some((p) => p.id === sig.id)) return prev;
              return [
                ...prev,
                {
                  id: sig.id,
                  userId: sig.user_id,
                  name,
                  requestedLevel: parsed.level || 'control',
                  createdAt: sig.created_at,
                },
              ];
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_session_signals', filter: `live_session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.new.type === 'hand_raise' && payload.new.resolved) {
            // Purge par signalId ET par userId : les entrées arrivées via broadcast
            // n'ont pas de signalId → sans le filtre userId elles restaient à jamais
            // dans Modération (badge « mains levées » périmé).
            const resolvedUid = payload.new.user_id != null ? String(payload.new.user_id) : null;
            setPanels((prev) =>
              prev.map((p, i) =>
                i === 0
                  ? {
                      ...p,
                      events: p.events.filter(
                        (e) => e.signalId !== payload.new.id
                          && !(resolvedUid && e.userId != null && String(e.userId) === resolvedUid),
                      ),
                    }
                  : p,
              ),
            );
            if (isGuestUi && userId && payload.new.user_id === userId) {
              setMyHandRaised(false);
            }
            setZone3RaisedHands((prev) => prev.filter(
              (h) => h.signalId !== payload.new.id
                && !(resolvedUid && h.userId != null && String(h.userId) === resolvedUid),
            ));
          }
          if (payload.new.type === LIVE_PERMISSION_REQUEST_SIGNAL_TYPE && payload.new.resolved && !isGuestUi) {
            setHostPermissionRequests((prev) => prev.filter((p) => p.id !== payload.new.id));
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.info('[LiriLive permission_request] host realtime UPDATE resolved', { id: payload.new.id });
            }
          }
          if (payload.new.type === LIVE_JOYKIT_REQUEST_SIGNAL_TYPE && payload.new.resolved && !isGuestUi) {
            setHostJoyKitRequests((prev) => prev.filter((p) => p.id !== payload.new.id));
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.info('[LiriLive joykit_request] host realtime UPDATE resolved', { id: payload.new.id });
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, phase, isGuestUi, userId]);

  return { floatingReactions };
}
