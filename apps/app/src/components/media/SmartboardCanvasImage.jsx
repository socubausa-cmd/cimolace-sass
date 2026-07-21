import React from 'react';
import { useSmartboardCanvasSrc } from '@/lib/smartboardCanvasUrl';

/**
 * `<img>` pour un asset du bucket PRIVÉ `smartboard-canvas` : signe la source au moment
 * du rendu (cf. `useSmartboardCanvasSrc`). Les URLs externes / data: / blob: passent
 * sans appel réseau. Utilisable dans un `.map()` (un hook par occurrence).
 *
 * Tant que l'URL signée n'est pas prête, on rend `pending` (null par défaut) plutôt qu'un
 * `<img src="">` — ce dernier déclencherait un `onError` parasite (et masquerait le parent
 * sur les leaves qui cachent le conteneur en erreur).
 *
 * Toutes les autres props (`className`, `style`, `onError`, `loading`, `referrerPolicy`,
 * `draggable`…) sont transmises telles quelles à l'`<img>`.
 */
export default function SmartboardCanvasImage({ src, alt = '', pending = null, ...rest }) {
  const resolved = useSmartboardCanvasSrc(src);
  if (!resolved) return pending;
  return <img src={resolved} alt={alt} {...rest} />;
}
