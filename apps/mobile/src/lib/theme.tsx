import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';

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
  mode: 'dark',
  isLight: false,
  colors: PALETTES.dark,
  toggle: () => {},
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark'); // défaut sombre (bascule vers crème via Réglages)

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

  // La teinte NATIVE (clavier, alertes, feuilles d'action, sélecteurs) ne connaît
  // pas notre bascule : sans ça, un utilisateur passé en crème garde un clavier
  // sombre. On la force donc à suivre le choix de l'app — d'où
  // `userInterfaceStyle: "automatic"` dans app.json, sans quoi cet appel est ignoré.
  useEffect(() => { Appearance.setColorScheme(mode); }, [mode]);

  const value = useMemo<ThemeValue>(
    () => ({ mode, isLight: mode === 'light', colors: PALETTES[mode] ?? PALETTES.dark, toggle, setMode }),
    [mode, toggle, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
