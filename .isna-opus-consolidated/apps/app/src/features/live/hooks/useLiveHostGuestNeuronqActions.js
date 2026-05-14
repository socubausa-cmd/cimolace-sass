import { useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { assertGuestLiveAction } from '@/lib/liriLive/assertGuestPermissionServer';
import { nt } from '@/features/live/host/liveHostUtils';

/**
 * Invité NeuronQ : reformulation edge `neuronq-reformulate` + insertion `live_neuronq_questions`.
 */
export function useLiveHostGuestNeuronqActions({
  sessionId,
  userId,
  debateNeuronqEnabled,
  isGuestUi,
  permCtxOptional,
  guestNeuronqCombinedRaw,
  guestNeuronqReformulated,
  toast,
  setNeuronqReformulating,
  setGuestNeuronqReformulated,
  setNeuronqGuestSubmitting,
  setGuestNeuronqVolets,
  setGuestNeuronqPanelOpen,
  setPanels,
}) {
  const neuronqReformulateGuest = useCallback(
    async (rawText) => {
      const t = String(rawText || '').trim();
      if (!t) return;
      setNeuronqReformulating(true);
      try {
        const { data, error } = await supabase.functions.invoke('neuronq-reformulate', {
          body: { rawText: t },
        });
        if (error) {
          setGuestNeuronqReformulated(t);
          toast({
            title: 'Reformulation indisponible',
            description: 'Le texte brut est conservé. Vous pouvez envoyer tel quel.',
            variant: 'destructive',
          });
          return;
        }
        setGuestNeuronqReformulated(data?.reformulated ?? data?.reformulatedText ?? t);
      } catch {
        setGuestNeuronqReformulated(t);
        toast({
          title: 'Reformulation indisponible',
          description: 'Le texte brut est conservé.',
          variant: 'destructive',
        });
      } finally {
        setNeuronqReformulating(false);
      }
    },
    [toast, setNeuronqReformulating, setGuestNeuronqReformulated],
  );

  const submitGuestNeuronq = useCallback(async () => {
    const raw = String(guestNeuronqCombinedRaw || '').trim();
    if (!debateNeuronqEnabled || !raw || !sessionId || !userId) return;
    if (isGuestUi && permCtxOptional) {
      const ok = await assertGuestLiveAction(supabase, permCtxOptional, {
        liveSessionId: sessionId,
        userId,
        action: 'canUseNeuronQ',
      });
      if (!ok) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[LiriLive Phase6] NeuronQ envoi refusé (RPC / permissions)', { sessionId });
        }
        toast({
          title: 'Envoi impossible',
          description: 'Permission NeuronQ non confirmée côté serveur.',
          variant: 'destructive',
        });
        return;
      }
    }
    const refText = String(guestNeuronqReformulated || '').trim() || raw;
    setNeuronqGuestSubmitting(true);
    try {
      const { error } = await supabase.from('live_neuronq_questions').insert({
        live_session_id: sessionId,
        user_id: userId,
        raw_text: raw,
        reformulated_text: refText,
        status: 'pending',
      });
      if (error) throw error;
      setGuestNeuronqVolets(['']);
      setGuestNeuronqReformulated('');
      setGuestNeuronqPanelOpen(false);
      toast({ title: 'Question envoyée', description: 'Le formateur la verra dans sa file NeuronQ.' });
      setPanels((prev) =>
        prev.map((p, i) =>
          i === 2
            ? {
                ...p,
                events: [
                  ...p.events,
                  { avatar: 'NeuronQ', msg: 'Question envoyée au formateur.', type: 'info', time: nt() },
                ],
              }
            : p,
        ),
      );
    } catch (e) {
      console.warn('[LiveHost] NeuronQ guest submit:', e?.message || e);
      toast({
        title: 'Envoi impossible',
        description: e?.message || 'Réessayez dans un instant.',
        variant: 'destructive',
      });
    } finally {
      setNeuronqGuestSubmitting(false);
    }
  }, [
    debateNeuronqEnabled,
    sessionId,
    userId,
    guestNeuronqCombinedRaw,
    guestNeuronqReformulated,
    toast,
    isGuestUi,
    permCtxOptional,
    setNeuronqGuestSubmitting,
    setGuestNeuronqVolets,
    setGuestNeuronqReformulated,
    setGuestNeuronqPanelOpen,
    setPanels,
  ]);

  return { neuronqReformulateGuest, submitGuestNeuronq };
}
