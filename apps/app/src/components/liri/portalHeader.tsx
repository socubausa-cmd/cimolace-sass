import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * En-tête contextuel du portail LIRI — RÈGLE D'ORGANISATION DES MENUS (niveau 3).
 *
 * Hiérarchie : rail icônes (espaces) → sous-rail (sections) → EN-TÊTE (sous-vues de la
 * section active). Les sous-vues NE sont PLUS une barre dans le corps : la page active
 * les « remonte » dans la topbar (fil d'Ariane + onglets), via ces hooks.
 *
 * Deux contextes séparés (setters STABLES vs valeurs) → la page pousse sans boucle de
 * rendu (les hooks ne dépendent que des setters stables, jamais des valeurs).
 */
export type PortalTab = { value: string; label: string };
export type PortalTabs = { items: PortalTab[]; active: string; onChange: (v: string) => void } | null;

type Setters = { setCrumb: (c: string[] | null) => void; setTabs: (t: PortalTabs) => void };
type Values = { crumb: string[] | null; tabs: PortalTabs };

const SettersCtx = createContext<Setters | null>(null);
const ValuesCtx = createContext<Values>({ crumb: null, tabs: null });

export function PortalHeaderProvider({ children }: { children: ReactNode }) {
  const [crumb, setCrumb] = useState<string[] | null>(null);
  const [tabs, setTabs] = useState<PortalTabs>(null);
  // Setters référentiellement stables (useState setters le sont déjà) → aucun re-run des hooks.
  const setters = useMemo<Setters>(() => ({ setCrumb, setTabs }), []);
  const values = useMemo<Values>(() => ({ crumb, tabs }), [crumb, tabs]);
  return (
    <SettersCtx.Provider value={setters}>
      <ValuesCtx.Provider value={values}>{children}</ValuesCtx.Provider>
    </SettersCtx.Provider>
  );
}

/** Lu par LiriPortalShell pour rendre l'en-tête. */
export function usePortalHeaderValues() {
  return useContext(ValuesCtx);
}

/** `true` si on est rendu DANS le portail (en-tête disponible). Sinon (back-office nu), la page rend sa barre inline. */
export function useInPortalHeader() {
  return useContext(SettersCtx) != null;
}

/** Pousse un fil d'Ariane (ex. ['École', 'Paramètres']) dans l'en-tête ; nettoie au démontage. */
export function usePortalCrumb(crumb: string[] | null) {
  const setters = useContext(SettersCtx);
  const key = crumb ? crumb.join(' › ') : '';
  useEffect(() => {
    if (!setters) return;
    setters.setCrumb(crumb && crumb.length ? crumb : null);
    return () => setters.setCrumb(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setters, key]);
}

/** Pousse les sous-vues (onglets) dans l'en-tête ; nettoie au démontage. */
export function usePortalTabs(items: PortalTab[] | null, active: string, onChange: (v: string) => void) {
  const setters = useContext(SettersCtx);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const itemsKey = items ? items.map((i) => i.value).join('|') : '';
  useEffect(() => {
    if (!setters || !items || !items.length) return;
    setters.setTabs({ items, active, onChange: (v) => onChangeRef.current(v) });
    return () => setters.setTabs(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setters, itemsKey, active]);
}
