import { useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizeScriptSections } from '@/features/live/host/liveSmartboardLegacySlides';
import { mergeSmartboardSceneFlags } from '@/lib/smartboardNavigatorScenes';
import { parseLangList } from '@/lib/liriMultilangApi';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Realtime `live_sessions` (canal `live-session-meta-*`) : titre, dates, config
 * (script, scènes, images partagées, shop, progressive playback, LIRI audio, multilingue hôte).
 */
export function useLiveHostLiveSessionMetaRealtime({
  sessionId,
  phase,
  isGuestUi,
  setSessionTitle,
  setStartedAt,
  setLiveEtapes,
  setSmartboardSceneFlags,
  setSharedImageGallery,
  setSharedImageLoop,
  setShopProducts,
  setProgressivePlayback,
  setHostMultilang,
  applyLiriAudioFromConfig,
}) {
  useEffect(() => {
    if (!sessionId || phase !== PHASE.LIVE) return;
    const ch = supabase
      .channel(`live-session-meta-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const n = payload.new;
          if (!n) return;
          if (n.title != null && String(n.title).trim()) setSessionTitle(String(n.title));
          if (n.started_at) setStartedAt(n.started_at);
          if (n.config == null) return;
          try {
            const parsed = typeof n.config === 'string' ? JSON.parse(n.config) : (n.config || {});
            const sections = parsed.smartboard_master_script_sections;
            if (Array.isArray(sections) && sections.length > 0) {
              setLiveEtapes(normalizeScriptSections(sections));
            }
            setSmartboardSceneFlags(mergeSmartboardSceneFlags(parsed?.smartboard_scenes));
            if (Array.isArray(parsed?.smartboard_shared_images)) {
              setSharedImageGallery(parsed.smartboard_shared_images);
            }
            setSharedImageLoop(parsed?.smartboard_shared_images_loop === true);
            if (Array.isArray(parsed?.smartboard_shop_products)) {
              setShopProducts(parsed.smartboard_shop_products);
            }
            if (typeof parsed.smartboard_progressive_playback === 'boolean') {
              setProgressivePlayback(parsed.smartboard_progressive_playback);
            }
            applyLiriAudioFromConfig(parsed, { devDemo: false });
            if (!isGuestUi) {
              const hml = parsed.liri_multilang;
              if (hml && typeof hml === 'object') {
                const hEnabled = hml.enabled === true;
                const hSource = String(hml.source_lang || 'fr').slice(0, 12).toLowerCase();
                const hTargets = Array.isArray(hml.target_langs)
                  ? hml.target_langs
                      .map((x) => String(x).toLowerCase().slice(0, 12))
                      .filter(Boolean)
                      .slice(0, 12)
                  : parseLangList(String(hml.target_langs || ''));
                const hLangs = hTargets.length ? hTargets : ['en'];
                setHostMultilang({
                  enabled: hEnabled,
                  sourceLang: hSource,
                  targetsStr: hLangs.join(', '),
                  guestBrowserTtsOffered: hml.guest_browser_tts_offered !== false,
                  guestEdgeTtsOffered: hml.guest_edge_tts_offered === true,
                  livekitInterpreterEnabled: hml.livekit_interpreter_enabled === true,
                });
              }
            }
          } catch {
            /* ignore */
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [
    sessionId,
    phase,
    isGuestUi,
    applyLiriAudioFromConfig,
    setSessionTitle,
    setStartedAt,
    setLiveEtapes,
    setSmartboardSceneFlags,
    setSharedImageGallery,
    setSharedImageLoop,
    setShopProducts,
    setProgressivePlayback,
    setHostMultilang,
  ]);
}
