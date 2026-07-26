import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Préférences de création de live, persistées et RÉELLEMENT appliquées.
 *
 * Chacune correspond à un champ que l'API accepte à la création d'une session
 * (`apps/api/src/live/live.service.ts`, liste blanche `COLS`) :
 *   defaultLiveType → `session_type`
 *   autoRecord      → `recording_requested` + `replay_enabled`
 *   waitingRoom     → `config.waiting_room` (le champ nu n'est PAS une colonne)
 *
 * Toute préférence sans destination réelle n'a rien à faire ici : un réglage qui
 * ne change rien est pire qu'un réglage absent.
 */
const STORAGE_KEY = 'liri-live-prefs';

/** Vocabulaire du CHECK `live_sessions_session_type_check` (migration 20260528190002). */
export const LIVE_TYPES = [
  { value: 'webinar', label: 'Webinaire' },
  { value: 'class', label: 'Cours' },
  { value: 'workshop', label: 'Atelier' },
  { value: 'masterclass', label: 'Masterclass' },
  { value: 'debate', label: 'Débat' },
] as const;

export type LiveType = (typeof LIVE_TYPES)[number]['value'];

export type LivePrefs = {
  defaultLiveType: LiveType;
  autoRecord: boolean;
  waitingRoom: boolean;
};

const DEFAULTS: LivePrefs = { defaultLiveType: 'webinar', autoRecord: true, waitingRoom: false };

type PrefsValue = {
  prefs: LivePrefs;
  ready: boolean;
  setPref: <K extends keyof LivePrefs>(key: K, value: LivePrefs[K]) => void;
};

const PrefsContext = createContext<PrefsValue>({ prefs: DEFAULTS, ready: false, setPref: () => {} });

/** Copie hors React, pour les appels API qui n'ont pas de contexte sous la main. */
let current: LivePrefs = DEFAULTS;
export const getLivePrefs = (): LivePrefs => current;

const sanitize = (raw: unknown): LivePrefs => {
  const v = (raw ?? {}) as Partial<LivePrefs>;
  const type = LIVE_TYPES.some((t) => t.value === v.defaultLiveType)
    ? (v.defaultLiveType as LiveType)
    : DEFAULTS.defaultLiveType;
  return {
    defaultLiveType: type,
    autoRecord: typeof v.autoRecord === 'boolean' ? v.autoRecord : DEFAULTS.autoRecord,
    waitingRoom: typeof v.waitingRoom === 'boolean' ? v.waitingRoom : DEFAULTS.waitingRoom,
  };
};

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<LivePrefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const next = sanitize(JSON.parse(raw));
          current = next;
          setPrefs(next);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setPref = useCallback<PrefsValue['setPref']>((key, value) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      current = next;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<PrefsValue>(() => ({ prefs, ready, setPref }), [prefs, ready, setPref]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePreferences = () => useContext(PrefsContext);
