import { useEffect } from 'react';

import { GLOBAL_CSS } from '@/features/live/host/liveHostTheme';

export function useLiveHostGlobalStyles(spotlightOn) {
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'liri-host-css';
    el.textContent = GLOBAL_CSS;
    if (!document.getElementById('liri-host-css')) document.head.appendChild(el);
    return () => {
      document.getElementById('liri-host-css')?.remove();
    };
  }, []);

  useEffect(() => {
    if (spotlightOn) document.body.classList.add('lh-sp-on');
    else document.body.classList.remove('lh-sp-on');
    return () => document.body.classList.remove('lh-sp-on');
  }, [spotlightOn]);
}
