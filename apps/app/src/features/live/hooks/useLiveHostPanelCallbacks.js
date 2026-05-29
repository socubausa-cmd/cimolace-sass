import { useCallback } from 'react';
import { nt } from '@/features/live/host/liveHostUtils';
import { playLiriHostEventChime } from '@/lib/liriHostEventChime';

/**
 * Callbacks de mise à jour des panneaux hôte : chat → notifications, salle d'attente + chime,
 * main levée / baissée, message chat temps réel, et insertion question NeuronQ.
 * Note : la sync initiale des mains levées (handRaises) reste dans la page car elle dépend
 * de useLiveSessionRealtime qui consomme onHandRaise/onChatMessage en paramètre.
 */
export function useLiveHostPanelCallbacks({
  setPanels,
  prevWaitingIdsRef,
  arenaHostAlertSoundRef,
  hostSfxCtxRef,
}) {
  const appendLiveChatToNotificationsPanel = useCallback((name, text) => {
    setPanels((prev) =>
      prev.map((p, i) =>
        i === 2
          ? {
              ...p,
              events: [
                ...p.events,
                { avatar: name, msg: `${name}: ${text}`, type: 'message', time: nt() },
              ],
            }
          : p,
      ),
    );
  }, [setPanels]);

  const syncWaitingRoomPanelAndChime = useCallback((entries) => {
    entries.forEach((e) => {
      if (!prevWaitingIdsRef.current.has(e.id)) {
        if (arenaHostAlertSoundRef.current) {
          playLiriHostEventChime(hostSfxCtxRef.current, 'waiting');
        }
      }
    });
    prevWaitingIdsRef.current = new Set(entries.map((e) => e.id));
    setPanels((prev) =>
      prev.map((p, i) =>
        i === 1
          ? {
              ...p,
              events: entries.map((e) => ({
                avatar: e.profile?.name || 'Participant',
                msg: `${e.profile?.name || 'Participant'} attend d'entrer`,
                type: 'join',
                time: nt(),
                entryId: e.id,
              })),
            }
          : p,
      ),
    );
  }, [setPanels, prevWaitingIdsRef, arenaHostAlertSoundRef, hostSfxCtxRef]);

  const onHandRaise = useCallback((payload) => {
    const name = payload.userName || payload.userId || 'Élève';
    const evt = {
      avatar: name,
      userId: payload.userId,
      msg: `${name} ${payload.raised ? 'a levé la main' : 'a baissé la main'}`,
      type: payload.raised ? 'hand_up' : 'hand_down',
      time: nt(),
    };
    if (payload.raised) {
      setPanels(prev => prev.map((p, i) => i === 0 ? { ...p, events: [...p.events.filter(e => e.userId !== payload.userId), evt] } : p));
      if (arenaHostAlertSoundRef.current) playLiriHostEventChime(hostSfxCtxRef.current, 'hand');
    } else {
      setPanels(prev => prev.map((p, i) => i === 0 ? { ...p, events: p.events.filter(e => e.userId !== payload.userId) } : p));
    }
    setPanels(prev => prev.map((p, i) => i === 2 ? { ...p, events: [...p.events, { ...evt, msg: `${name} ${payload.raised ? '✋ main levée' : '✋ main baissée'}`, type: 'info' }] } : p));
  }, [setPanels, arenaHostAlertSoundRef, hostSfxCtxRef]);

  const onChatMessage = useCallback((payload) => {
    const name = payload.userName || payload.userId || 'Élève';
    setPanels(prev => prev.map((p, i) => i === 2 ? { ...p, events: [...p.events, { avatar: name, msg: payload.text || '...', type: 'message', time: nt() }] } : p));
  }, [setPanels]);

  const onNeuronqQuestionInsert = useCallback((row) => {
    if (arenaHostAlertSoundRef.current) playLiriHostEventChime(hostSfxCtxRef.current, 'default');
    setPanels((prev) =>
      prev.map((p, i) =>
        i === 2
          ? {
              ...p,
              events: [
                ...p.events,
                {
                  avatar: 'NeuronQ',
                  msg: `Nouvelle question : ${(row.raw_text || '').substring(0, 60)}`,
                  type: 'message',
                  time: nt(),
                },
              ],
            }
          : p,
      ),
    );
  }, [setPanels, arenaHostAlertSoundRef, hostSfxCtxRef]);

  return {
    appendLiveChatToNotificationsPanel,
    syncWaitingRoomPanelAndChime,
    onHandRaise,
    onChatMessage,
    onNeuronqQuestionInsert,
  };
}
