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
              // `*` ASSUMÉ plutôt qu'une liste de colonnes : le tableau vivant a
              // besoin de chapter_id/render_mode/audio_url, mais nommer une colonne
              // absente (migration pas encore appliquée) ferait échouer TOUTE la
              // requête — donc un direct sans aucune scène. Le coût d'un `*` sur
              // les scènes d'une seule session est négligeable devant ce risque.
              .select('*')
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
          // La publication Master Factory est désormais ATOMIQUE côté API
          // (delete + insert + config dans une même transaction SQL) : un résultat
          // vide n'est plus l'état transitoire entre delete et insert, c'est le
          // vrai contenu de la session. On l'applique donc tel quel — l'ancienne
          // garde `if (initialSlides.length)` masquait les vidages réels.
          setLiveScenes(initialSlides.map(normalizeLiveSceneToSlide).filter(Boolean));
          queueMicrotask(() => sendSmartboardHostPayload());
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, phase, sendSmartboardHostPayload, setLiveScenes]);
}
