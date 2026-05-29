import { useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  buildLiveScenesFromUploadedSlides,
  normalizeLiveSceneToSlide,
} from '@/lib/liveSceneNormalize';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Realtime `live_scenes` + relecture `live_sessions.config` pour diapos uploadées ;
 * met à jour les scènes SmartBoard et rediffuse le payload hôte.
 */
export function useLiveHostLiveScenesRealtime({
  sessionId,
  phase,
  sendSmartboardHostPayload,
  setLiveScenes,
}) {
  useEffect(() => {
    if (!sessionId || phase !== PHASE.LIVE) return;
    const ch = supabase
      .channel(`live-scenes-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_scenes',
          filter: `live_session_id=eq.${sessionId}`,
        },
        async () => {
          const [{ data: rows }, { data: sessRow }] = await Promise.all([
            supabase
              .from('live_scenes')
              .select('id, name, order_index, content_payload_json')
              .eq('live_session_id', sessionId)
              .order('order_index', { ascending: true }),
            supabase.from('live_sessions').select('config').eq('id', sessionId).maybeSingle(),
          ]);
          let cfg = {};
          try {
            cfg = typeof sessRow?.config === 'string' ? JSON.parse(sessRow.config) : (sessRow?.config || {});
          } catch {
            /* ignore */
          }
          let initialSlides = [...(rows || [])].sort(
            (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
          );
          const uploadedSlideScenes = buildLiveScenesFromUploadedSlides(cfg?.smartboard_slides);
          if (uploadedSlideScenes.length) {
            initialSlides = [...initialSlides, ...uploadedSlideScenes].sort(
              (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
            );
          }
          if (initialSlides.length) {
            const normalized = initialSlides.map(normalizeLiveSceneToSlide).filter(Boolean);
            if (normalized.length) setLiveScenes(normalized);
          }
          queueMicrotask(() => sendSmartboardHostPayload());
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, phase, sendSmartboardHostPayload, setLiveScenes]);
}
