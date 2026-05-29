/**
 * Miniatures du catalogue (21 modules), index 0 = module 1.
 * Remplace une entrée par un chemin local (ex. `/catalog-modules/01-ontologie.png`) quand l'asset est prêt.
 * Ici : images stables via picsum (seed = un visuel distinct par module).
 */
const W = 400;
const H = 400;

export const FORMATION_CATALOG_THUMBNAIL_URLS = Array.from({ length: 21 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return `https://picsum.photos/seed/prorascience-cat-${n}/${W}/${H}`;
});
