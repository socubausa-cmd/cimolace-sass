/**
 * sketchFit.mjs — CADRAGE DÉTERMINISTE d'un croquis du Précepteur (partagé par le générateur
 * approfondi et l'outil de recadrage des cours déjà en base).
 */
/**
 * CADRAGE DÉTERMINISTE — le modèle dessine souvent au centre (x 25→75), si bien que le croquis
 * n'occupe que la moitié du tableau et paraît minuscule, labels illisibles. On recadre donc
 * TOUJOURS : homothétie (même facteur en x et en y → aucune déformation) pour remplir la zone
 * utile, puis recentrage. Les rayons suivent le même facteur.
 */
export const FIT = { x0: 8, x1: 92, y0: 14, y1: 86, maxZoom: 2.4 };
export function fitSketchToCanvas(elements) {
  const pts = [];
  for (const e of elements) {
    if (e.center) pts.push(e.center);
    if (e.from) pts.push(e.from);
    if (e.to) pts.push(e.to);
    // Un cercle/spirale déborde de son centre : on tient compte du rayon.
    if (e.center && Number.isFinite(e.radius)) {
      pts.push([e.center[0] - e.radius, e.center[1] - e.radius], [e.center[0] + e.radius, e.center[1] + e.radius]);
    }
  }
  if (pts.length < 2) return elements;
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const w = maxX - minX; const h = maxY - minY;
  if (w < 1 && h < 1) return elements; // tout au même point : rien à cadrer
  const s = Math.min(FIT.maxZoom, Math.min((FIT.x1 - FIT.x0) / Math.max(w, 1), (FIT.y1 - FIT.y0) / Math.max(h, 1)));
  if (s <= 1.05) return elements; // déjà bien cadré
  const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
  const tx = (FIT.x0 + FIT.x1) / 2; const ty = (FIT.y0 + FIT.y1) / 2;
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));
  const map = (p) => [clamp(tx + (p[0] - cx) * s), clamp(ty + (p[1] - cy) * s)];
  return elements.map((e) => ({
    ...e,
    ...(e.center ? { center: map(e.center) } : {}),
    ...(e.from ? { from: map(e.from) } : {}),
    ...(e.to ? { to: map(e.to) } : {}),
    ...(Number.isFinite(e.radius) ? { radius: Math.max(2, Math.min(45, Math.round(e.radius * s * 10) / 10)) } : {}),
  }));
}

