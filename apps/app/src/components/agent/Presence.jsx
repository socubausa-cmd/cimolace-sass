import React from 'react';
import { Check } from 'lucide-react';

/**
 * Presence — la « présence » immersive à 5 états (PARTAGÉE par les deux agents).
 *
 * state ∈ connexion | attente | reflexion | ecriture | pret. Le CSS vit dans `STYLE`
 * (lib/agent/immersiveTheme) : la classe `cca-{state}` décide quelle forme s'anime
 * (boot / dot / line / wave / done). `key={state}` relance l'onde (cca-ripple) à chaque
 * changement d'état. Purement présentational (aucun état interne, aucune dépendance métier).
 */
export default function Presence({ state = 'attente' }) {
  return (
    <div className={`cca-${state}`} style={{ position: 'relative', width: 200, height: 120, pointerEvents: 'none' }}>
      <div className="cca-glow" />
      <span key={state} className="cca-ripple" />
      <div className="cca-orbit"><span /><span /></div>
      <span className="cca-form cca-boot" />
      <span className="cca-form cca-dot" />
      <span className="cca-form cca-line" />
      <span className="cca-form cca-wave"><i /><i style={{ animationDelay: '.1s' }} /><i style={{ animationDelay: '.2s' }} /><i style={{ animationDelay: '.3s' }} /><i style={{ animationDelay: '.4s' }} /></span>
      <span className="cca-form cca-done"><Check size={20} /></span>
    </div>
  );
}
