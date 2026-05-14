import { useCallback, useEffect } from 'react';
import { parseLangList } from '@/lib/liriMultilangApi';
import { stopMultilangBrowserTts } from '@/lib/liriMultilangAudioGuest';
import { stopMultilangEdgeTts } from '@/lib/liriMultilangTtsEdge';

/**
 * Paramètres multilingue hôte et invité : persistance config DB, TTS browser/edge,
 * restauration depuis sessionStorage, synchronisation de la ref audio invité.
 */
export function useLiveHostMultilangSettings({
  sessionId,
  isGuestUi,
  persistSessionConfigPatch,
  setHostMultilang,
  hostMultilangPendingRef,
  hostMultilangDebounceRef,
  setGuestMultilangBrowserTtsOn,
  setGuestMultilangEdgeTtsOn,
  guestMultilangBrowserTtsOn,
  guestMultilangEdgeTtsOn,
  guestMultilangViewLang,
  guestMultilangConfig,
  guestMultilangAudioPrefsRef,
}) {
  const persistFullMultilang = useCallback(
    (next) => {
      const t = parseLangList(next.targetsStr || '');
      void persistSessionConfigPatch({
        liri_multilang: {
          enabled: next.enabled === true,
          source_lang: String(next.sourceLang || 'fr').slice(0, 12).toLowerCase(),
          target_langs: t.length ? t : ['en'],
          guest_browser_tts_offered: next.guestBrowserTtsOffered !== false,
          guest_edge_tts_offered: next.guestEdgeTtsOffered === true,
          livekit_interpreter_enabled: next.livekitInterpreterEnabled === true,
        },
      });
    },
    [persistSessionConfigPatch],
  );

  const flushHostMultilangToDb = useCallback(() => {
    persistFullMultilang(hostMultilangPendingRef.current);
  }, [persistFullMultilang, hostMultilangPendingRef]);

  const MULTILANG_PATCH_IMMEDIATE_KEYS = new Set([
    'enabled',
    'guestBrowserTtsOffered',
    'guestEdgeTtsOffered',
    'livekitInterpreterEnabled',
  ]);

  const setHostMultilangField = useCallback(
    (patch) => {
      setHostMultilang((prev) => {
        const next = { ...prev, ...patch };
        hostMultilangPendingRef.current = next;
        const immediate = Object.keys(patch).some((k) => MULTILANG_PATCH_IMMEDIATE_KEYS.has(k));
        if (immediate) {
          persistFullMultilang(next);
        } else {
          clearTimeout(hostMultilangDebounceRef.current);
          hostMultilangDebounceRef.current = setTimeout(() => flushHostMultilangToDb(), 450);
        }
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistFullMultilang, flushHostMultilangToDb, setHostMultilang, hostMultilangPendingRef, hostMultilangDebounceRef],
  );

  const setGuestMultilangBrowserTtsOnPersist = useCallback((v) => {
    setGuestMultilangBrowserTtsOn(v);
    if (v) setGuestMultilangEdgeTtsOn(false);
    if (!sessionId) return;
    try {
      sessionStorage.setItem(`liri_ml_guest_tts_${sessionId}`, v ? '1' : '0');
      if (v) sessionStorage.setItem(`liri_ml_guest_edge_tts_${sessionId}`, '0');
    } catch { /* ignore */ }
  }, [sessionId, setGuestMultilangBrowserTtsOn, setGuestMultilangEdgeTtsOn]);

  const setGuestMultilangEdgeTtsOnPersist = useCallback((v) => {
    setGuestMultilangEdgeTtsOn(v);
    if (v) setGuestMultilangBrowserTtsOn(false);
    if (!sessionId) return;
    try {
      sessionStorage.setItem(`liri_ml_guest_edge_tts_${sessionId}`, v ? '1' : '0');
      if (v) sessionStorage.setItem(`liri_ml_guest_tts_${sessionId}`, '0');
    } catch { /* ignore */ }
  }, [sessionId, setGuestMultilangEdgeTtsOn, setGuestMultilangBrowserTtsOn]);

  // Restaurer les préférences TTS invité depuis sessionStorage au montage
  useEffect(() => {
    if (!isGuestUi || !sessionId) return;
    try {
      if (sessionStorage.getItem(`liri_ml_guest_tts_${sessionId}`) === '1') {
        setGuestMultilangBrowserTtsOn(true);
        setGuestMultilangEdgeTtsOn(false);
      } else if (sessionStorage.getItem(`liri_ml_guest_edge_tts_${sessionId}`) === '1') {
        setGuestMultilangEdgeTtsOn(true);
        setGuestMultilangBrowserTtsOn(false);
      }
    } catch { /* ignore */ }
  }, [isGuestUi, sessionId, setGuestMultilangBrowserTtsOn, setGuestMultilangEdgeTtsOn]);

  // Synchroniser la ref audio invité (lue par les pipelines multilingues)
  useEffect(() => {
    guestMultilangAudioPrefsRef.current = {
      browserTtsOffered: guestMultilangConfig.guest_browser_tts_offered !== false,
      browserTtsOn: guestMultilangBrowserTtsOn,
      edgeTtsOffered: guestMultilangConfig.guest_edge_tts_offered === true,
      edgeTtsOn: guestMultilangEdgeTtsOn,
      viewLang: guestMultilangViewLang,
    };
  }, [
    guestMultilangConfig.guest_browser_tts_offered,
    guestMultilangConfig.guest_edge_tts_offered,
    guestMultilangBrowserTtsOn,
    guestMultilangEdgeTtsOn,
    guestMultilangViewLang,
    guestMultilangAudioPrefsRef,
  ]);

  useEffect(() => {
    if (!isGuestUi) return;
    if (guestMultilangViewLang === 'source' || !guestMultilangBrowserTtsOn) {
      stopMultilangBrowserTts();
    }
  }, [isGuestUi, guestMultilangViewLang, guestMultilangBrowserTtsOn]);

  useEffect(() => {
    if (!isGuestUi) return;
    if (guestMultilangViewLang === 'source' || !guestMultilangEdgeTtsOn) {
      stopMultilangEdgeTts();
    }
  }, [isGuestUi, guestMultilangViewLang, guestMultilangEdgeTtsOn]);

  return {
    persistFullMultilang,
    flushHostMultilangToDb,
    setHostMultilangField,
    setGuestMultilangBrowserTtsOnPersist,
    setGuestMultilangEdgeTtsOnPersist,
  };
}
