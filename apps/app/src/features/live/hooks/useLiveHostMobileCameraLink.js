import { useEffect, useState } from 'react';
import { createLiveMobileCameraLink } from '@/services/livekitApi';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Génère un lien caméra mobile temporaire quand la modale est ouverte,
 * et expose l'état de chargement / erreur / URL.
 */
export function useLiveHostMobileCameraLink({ sessionId, phase, isGuestUi }) {
  const [mobileCameraLinkOpen, setMobileCameraLinkOpen] = useState(false);
  const [mobileCameraJoinUrl, setMobileCameraJoinUrl] = useState('');
  const [mobileCameraLinkExpires, setMobileCameraLinkExpires] = useState('');
  const [mobileCameraLinkLoading, setMobileCameraLinkLoading] = useState(false);
  const [mobileCameraLinkErr, setMobileCameraLinkErr] = useState('');

  useEffect(() => {
    if (!mobileCameraLinkOpen || !sessionId || phase !== PHASE.LIVE || isGuestUi) return undefined;
    let cancelled = false;
    setMobileCameraLinkLoading(true);
    setMobileCameraJoinUrl('');
    setMobileCameraLinkErr('');
    createLiveMobileCameraLink(sessionId)
      .then((d) => {
        if (cancelled) return;
        setMobileCameraJoinUrl(d.joinUrl || '');
        setMobileCameraLinkExpires(d.expiresAt || '');
      })
      .catch((e) => {
        if (cancelled) return;
        setMobileCameraLinkErr(e?.message || 'Erreur');
      })
      .finally(() => {
        if (!cancelled) setMobileCameraLinkLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mobileCameraLinkOpen, sessionId, phase, isGuestUi]);

  return {
    mobileCameraLinkOpen,
    setMobileCameraLinkOpen,
    mobileCameraJoinUrl,
    mobileCameraLinkExpires,
    mobileCameraLinkLoading,
    mobileCameraLinkErr,
  };
}
