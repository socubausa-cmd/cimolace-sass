/**
 * usePush — Hook React pour Capacitor PushNotifications.
 *
 * - Sur web : noop (token reste null, requestPermission renvoie 'denied').
 * - Sur natif (iOS / Android via Capacitor) : enregistre l'appareil,
 *   stocke le token APNS/FCM et écoute les notifications entrantes.
 *
 * Backend TODO : envoyer le token retourné vers /api/devices/register
 * pour cibler l'utilisateur depuis le serveur (cf. MOBILE_FEATURES.md).
 */
import { useCallback, useEffect, useState } from 'react';

type AnyNotif = {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  id?: string;
};

type PushPermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

export interface UsePushReturn {
  token: string | null;
  lastNotification: AnyNotif | null;
  permission: PushPermissionState | null;
  requestPermission: () => Promise<PushPermissionState>;
  /** True si on tourne dans une coquille native Capacitor (iOS/Android). */
  isNative: boolean;
}

export function usePush(): UsePushReturn {
  const [token, setToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<AnyNotif | null>(null);
  const [permission, setPermission] = useState<PushPermissionState | null>(null);
  const [isNative, setIsNative] = useState<boolean>(false);

  // Demande explicite de permission (à appeler sur tap utilisateur).
  const requestPermission = useCallback(async (): Promise<PushPermissionState> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        setPermission('denied');
        return 'denied';
      }
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const res = await PushNotifications.requestPermissions();
      const state = (res.receive as PushPermissionState) ?? 'denied';
      setPermission(state);
      if (state === 'granted') {
        await PushNotifications.register();
      }
      return state;
    } catch (err) {
      // Plugin absent (ex: tests jsdom) — on retombe en 'denied'.
      console.warn('[usePush] requestPermission failed', err);
      setPermission('denied');
      return 'denied';
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const listenerHandles: Array<{ remove: () => Promise<void> | void }> = [];

    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        const native = Capacitor.isNativePlatform();
        if (cancelled) return;
        setIsNative(native);
        if (!native) return;

        const { PushNotifications } = await import('@capacitor/push-notifications');

        // Vérifie l'état actuel sans forcer une demande.
        try {
          const status = await PushNotifications.checkPermissions();
          if (!cancelled) setPermission((status.receive as PushPermissionState) ?? null);
        } catch {
          /* no-op */
        }

        // Token APNS/FCM.
        const regHandle = await PushNotifications.addListener(
          'registration',
          (t: { value: string }) => { if (!cancelled) setToken(t.value); },
        );
        listenerHandles.push(regHandle);

        // Erreur d'enregistrement (ex: simulateur iOS sans APNS).
        const errHandle = await PushNotifications.addListener(
          'registrationError',
          (e: unknown) => { console.warn('[usePush] registrationError', e); },
        );
        listenerHandles.push(errHandle);

        // Notification reçue alors que l'app est au premier plan.
        const recvHandle = await PushNotifications.addListener(
          'pushNotificationReceived',
          (n: AnyNotif) => { if (!cancelled) setLastNotification(n); },
        );
        listenerHandles.push(recvHandle);

        // Notification "actionnée" (utilisateur a tapé dessus depuis le shade).
        const actHandle = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (a: { notification: AnyNotif }) => {
            if (!cancelled) setLastNotification(a.notification);
          },
        );
        listenerHandles.push(actHandle);
      } catch (err) {
        console.warn('[usePush] init failed', err);
      }
    })();

    return () => {
      cancelled = true;
      for (const h of listenerHandles) {
        try { void h.remove(); } catch { /* no-op */ }
      }
    };
  }, []);

  return { token, lastNotification, permission, requestPermission, isNative };
}
