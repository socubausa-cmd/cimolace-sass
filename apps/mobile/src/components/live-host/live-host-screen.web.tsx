import { useRouter } from 'expo-router';

import HostShell from '@/components/live-host/host-shell';

/**
 * Route /live-host (web / Expo Go) — régie live de l'hôte.
 *
 * Rend la coque officielle `HostShell` en mode preview (données mock). Aucun
 * module LiveKit/WebRTC n'est importé ici → le bundle web ne casse pas.
 * Le vrai flux vidéo est branché dans `live-host-screen.tsx` (natif).
 */
export default function LiveHostScreenWeb() {
  const router = useRouter();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/lives');
  };
  return <HostShell onEnd={goBack} />;
}
