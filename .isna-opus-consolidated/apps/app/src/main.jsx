import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { rewriteNetlifyFunctionsFetchInput } from '@/lib/androidApiHost';
import App from '@/App';
import '@/index.css';
/* Après toutes les règles de index.css (dont Tailwind) : le thème LIRI gagne en cascade */
import '@/styles/liri-brand-theme.css';

/** Capacitor : les fetch('/.netlify/functions/...') ne doivent pas rester sur https://localhost. */
const __appFetch = window.fetch.bind(window);
window.fetch = function fetchWithNativeNetlifyBase(input, init) {
  return __appFetch(rewriteNetlifyFunctionsFetchInput(input), init);
};

async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0a0908' });
  } catch {
    /* WebView sans plugin */
  }
  try {
    await SplashScreen.hide();
  } catch {
    /* déjà masqué */
  }

  /**
   * Shell élève en WebView : point d'entrée unique `VITE_CAPACITOR_ENTRY_PATH`
   * ou, par défaut, `/m/eleve` si le bundle est en variante `VITE_APP_VARIANT=eleve`.
   * Le site web (navigateur) n'est jamais redirigé ici — seule l'app native.
   */
  try {
    const isEleveBuild = import.meta?.env?.VITE_APP_VARIANT === 'eleve';
    const entry =
      (typeof import.meta.env.VITE_CAPACITOR_ENTRY_PATH === 'string' &&
        import.meta.env.VITE_CAPACITOR_ENTRY_PATH.trim()) ||
      (isEleveBuild ? '/m/eleve' : null);
    if (entry) {
      const { pathname } = window.location;
      if (!pathname.startsWith(entry)) {
        window.history.replaceState({}, '', entry);
      }
    }
  } catch {
    /* navigation indisponible */
  }

  const eleveEntryPath =
    (typeof import.meta.env.VITE_CAPACITOR_ENTRY_PATH === 'string' && import.meta.env.VITE_CAPACITOR_ENTRY_PATH.trim()) ||
    (import.meta?.env?.VITE_APP_VARIANT === 'eleve' ? '/m/eleve' : null);
  CapApp.addListener('backButton', () => {
    const p = window.location?.pathname || '';
    if (eleveEntryPath && p === eleveEntryPath) return;
    window.history.back();
  });
}
void initNativeShell();

// @livekit/components-react lit cette clé — absence = warning console
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('lk-user-choices') == null) {
    localStorage.setItem('lk-user-choices', JSON.stringify({}));
  }
} catch {
  /* mode privé / quota */
}

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AbortError') event.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);