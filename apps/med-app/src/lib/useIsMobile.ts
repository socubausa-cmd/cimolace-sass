import { useEffect, useState } from 'react';

/**
 * Vrai quand le viewport est en format téléphone / tablette étroite.
 * Partagé par tout med-app pour rendre responsive les layouts en style inline
 * (headers flex `space-between`, grilles à colonnes fixes…) qui débordaient sur
 * mobile. Breakpoint 820px, cohérent avec le shell (Layout) et la salle
 * téléconsult.
 */
export function useIsMobile(maxWidth = 820): boolean {
  const q = `(max-width: ${maxWidth}px)`;
  const [m, setM] = useState(
    typeof window !== 'undefined' ? window.matchMedia(q).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
