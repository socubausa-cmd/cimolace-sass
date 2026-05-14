/**
 * Suggestions Architect sans appel IA (moteur logique) — complété par IA sur demande (tokens).
 */

/**
 * @param {Record<string, unknown> | null | undefined} obj
 * @param {{ width?: number; height?: number } | undefined} canvas
 * @returns {{ id: string; title: string; detail: string }[]}
 */
export function getArchitectHeuristicSuggestions(obj, canvas) {
  const cw = canvas?.width || 1037;
  const ch = canvas?.height || 750;
  if (!obj) {
    return [
      {
        id: 'none',
        title: 'Aucun élément sélectionné',
        detail:
          'Sélectionnez une forme, un texte ou une image sur le canvas. Architect pourra proposer des proportions, styles et alignements selon la bibliothèque LIRI.',
      },
    ];
  }

  const out = [];

  if (obj.type === 'rect') {
    const w = Number(obj.width) || 1;
    const h = Number(obj.height) || 1;
    const ratio = w / h;
    if (ratio > 4 || ratio < 0.25) {
      out.push({
        id: 'rect-ratio',
        title: 'Proportions',
        detail:
          'Rectangle très allongé : envisager un ratio proche de 16:9 ou 4:3 pour un bloc visuel équilibré (cadre titre, carte).',
      });
    }
    const cr = obj.style?.cornerRadius ?? 0;
    if (cr < 4 && w > 80 && h > 40) {
      out.push({
        id: 'rect-radius',
        title: 'Coins',
        detail: 'Ajouter un léger arrondi (8–16px) pour un rendu plus “carte” et cohérent avec les presets LIRI.',
      });
    }
  }

  if (obj.type === 'text') {
    const fs = Number(obj.style?.fontSize) || 24;
    if (fs < 14) {
      out.push({
        id: 'text-small',
        title: 'Lisibilité',
        detail: 'Taille de police faible pour une diapositive : viser au moins 18–24px pour le corps, plus pour les titres.',
      });
    }
    out.push({
      id: 'text-preset',
      title: 'Typographie LIRI',
      detail:
        'Ouvrez Propriétés → presets LIRI pour appliquer une hiérarchie titre / sous-titre / corps alignée sur la charte.',
    });
  }

  if (obj.type === 'image') {
    out.push({
      id: 'img-crop',
      title: 'Cadrage',
      detail:
        'Vérifiez le recadrage et le contraste dans Propriétés ; une image narrative doit laisser de la place au texte si besoin.',
    });
  }

  if (obj.type === 'icon') {
    out.push({
      id: 'icon-size',
      title: 'Icône',
      detail:
        'Harmoniser la taille du glyphe avec les titres voisins ; préférer une couleur or LIRI (#D4AF37) ou blanc cassé.',
    });
  }

  if (obj.type === 'circle' || obj.type === 'ellipse') {
    out.push({
      id: 'shape-fill',
      title: 'Remplissage',
      detail:
        'Les ellipses servent souvent de halo ou badge : opacité modérée ou contour fin pour ne pas concurrencer le texte.',
    });
  }

  const x = Number(obj.x) ?? 0;
  const y = Number(obj.y) ?? 0;
  const w = Number(obj.width) ?? 0;
  const h = Number(obj.height) ?? 0;
  if (x < 16 || y < 16 || x + w > cw - 16 || y + h > ch - 16) {
    out.push({
      id: 'margin',
      title: 'Marges canvas',
      detail: "L'élément est proche du bord : prévoir une marge d'au moins 24–48 px pour respiration et projection live.",
    });
  }

  if (out.length === 0) {
    out.push({
      id: 'ok',
      title: 'Analyse rapide',
      detail:
        'Rien d’anormal de premier regard. Utilisez « Régénérer » pour rafraîchir les préconisations ou les variantes IA (tokens) depuis le Copilot.',
    });
  }

  return out;
}
