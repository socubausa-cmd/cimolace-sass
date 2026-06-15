import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { PALETTES, type LiriPalette, type ThemeMode } from '@/constants/liri-theme';

/**
 * Teinte de l'app mobile LIRI : crème clair (défaut) ⇄ sombre, persistée (AsyncStorage).
 * Un écran appelle `const { colors } = useTheme()` et construit ses styles via
 * `makeStyles(colors)` → re-rendu automatique au changement de teinte.
 */
const STORAGE_KEY = 'liri-shell-tint';

type ThemeValue = {
  mode: ThemeMode;
  isLight: boolean;
  colors: LiriPalette;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeValue>({
  mode: 'light',
  isLight: true,
  colors: PALETTES.light,
  toggle: () => {},
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light'); // défaut crème

  // Restaure le choix persisté au démarrage.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'dark' || v === 'light') setModeState(v);
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    const next: ThemeMode = m === 'dark' ? 'dark' : 'light';
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({ mode, isLight: mode === 'light', colors: PALETTES[mode] ?? PALETTES.dark, toggle, setMode }),
    [mode, toggle, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
