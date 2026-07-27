import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ENGINES, engineItems, visibleEngines, type EngineDef, type EngineKey, type NavItem } from '@/lib/engines-nav';
import { useTenant } from '@/lib/tenant';

/**
 * Moteur actif de l'app native. Le choix est persisté : on ne veut pas qu'un
 * formateur qui vit dans École retombe sur LIRI à chaque lancement.
 *
 * Garde-fou : si le moteur mémorisé n'est plus proposé (service résilié, rôle
 * changé), on retombe sur le premier moteur disponible plutôt que d'afficher
 * une barre vide.
 */
const STORAGE_KEY = 'liri-active-engine';

type EngineValue = {
  engine: EngineKey;
  setEngine: (k: EngineKey) => void;
  engines: EngineDef[];
  items: NavItem[];
};

const FALLBACK: EngineValue = { engine: 'liri', setEngine: () => {}, engines: [], items: [] };
const EngineContext = createContext<EngineValue>(FALLBACK);

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const { isCreator, schoolActive, shopActive, ready } = useTenant();
  const [stored, setStored] = useState<EngineKey | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => { if (ENGINES.some((e) => e.key === v)) setStored(v as EngineKey); })
      .catch(() => {});
  }, []);

  const filter = useMemo(() => ({ isCreator, schoolActive, shopActive }), [isCreator, schoolActive, shopActive]);
  const engines = useMemo(() => visibleEngines(filter), [filter]);

  // Tant que les services ne sont pas chargés, on n'a rien d'autorité : on garde
  // LIRI (toujours disponible) plutôt que de faire clignoter la barre.
  const engine: EngineKey = useMemo(() => {
    if (!ready) return 'liri';
    if (stored && engines.some((e) => e.key === stored)) return stored;
    return engines[0]?.key ?? 'liri';
  }, [ready, stored, engines]);

  const setEngine = useCallback((k: EngineKey) => {
    setStored(k);
    AsyncStorage.setItem(STORAGE_KEY, k).catch(() => {});
  }, []);

  const items = useMemo(() => engineItems(engine, filter), [engine, filter]);

  const value = useMemo<EngineValue>(() => ({ engine, setEngine, engines, items }), [engine, setEngine, engines, items]);
  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

export const useEngine = () => useContext(EngineContext);
