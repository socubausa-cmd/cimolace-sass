/**
 * useBiometric — Hook React pour FaceID / TouchID / Android Biometric.
 *
 * Wrap léger autour de `@aparajita/capacitor-biometric-auth` qui expose
 * la même API que l'ex `@capacitor-community/biometric-auth` (ce dernier
 * n'est plus publié sur npm).
 *
 * - Sur web : isAvailable() → false, authenticate() résout false sans
 *   bloquer l'UI (utile pour gate optionnellement un écran sensible).
 * - Sur natif : déclenche le prompt système. allowDeviceCredential=true
 *   accepte le PIN/passcode comme fallback (configuré dans capacitor.config.ts).
 */
import { useCallback, useEffect, useState } from 'react';

export interface UseBiometricReturn {
  isNative: boolean;
  isAvailable: () => Promise<boolean>;
  /** Lance le prompt. Retourne true si succès, false sinon (annulation/échec). */
  authenticate: (reason: string) => Promise<boolean>;
  lastError: string | null;
}

export function useBiometric(): UseBiometricReturn {
  const [isNative, setIsNative] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!cancelled) setIsNative(Capacitor.isNativePlatform());
      } catch {
        /* no-op */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isAvailable = useCallback(async (): Promise<boolean> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return false;
      const mod = await import('@aparajita/capacitor-biometric-auth');
      const info = await mod.BiometricAuth.checkBiometry();
      return Boolean(info?.isAvailable);
    } catch (err) {
      console.warn('[useBiometric] isAvailable failed', err);
      return false;
    }
  }, []);

  const authenticate = useCallback(async (reason: string): Promise<boolean> => {
    setLastError(null);
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return false;
      const mod = await import('@aparajita/capacitor-biometric-auth');
      await mod.BiometricAuth.authenticate({
        reason,
        cancelTitle: 'Annuler',
        allowDeviceCredential: true,
        iosFallbackTitle: 'Utiliser le code',
        androidTitle: 'Authentification requise',
        androidSubtitle: reason,
        androidConfirmationRequired: false,
      });
      return true;
    } catch (e: any) {
      // Le plugin throw pour annulation / échec. On normalise en false.
      const msg = e?.message || 'Authentification refusée.';
      setLastError(msg);
      return false;
    }
  }, []);

  return { isNative, isAvailable, authenticate, lastError };
}
