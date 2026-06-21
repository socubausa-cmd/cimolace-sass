/**
 * P2 — « carte = slide, chapitre = section ».
 *
 * Construit le deck SmartBoard À PARTIR des cartes du mindmap (source unique).
 * Chaque nœud devient un SLIDE ; les slides sont groupés par chapitre (= SECTION)
 * et triés par horodatage.
 *
 * Le chapitre d'une carte est résolu dans cet ordre :
 *   1) `node.chapterIndex` (taggé côté serveur par generate-mindmap, cf. P1) ;
 *   2) sinon dérivé de l'horodatage du nœud (`timeSeconds`/`time`) contre les
 *      plages des chapitres — même logique que le serveur, pour que TOUS les
 *      mindmaps existants (générés avant le tag) fonctionnent sans régénération ;
 *   3) sinon hérité du parent.
 *
 * Le nœud racine (sans temps/chapitre) n'est pas un slide.
 * Réutilisable par la post-production (aperçu owner), le player élève et l'export.
 *
 * @param {object|null} mindmap  L'arbre mindmap (data.mindmap).
 * @param {Array} chapters       Les chapitres [{label,startSeconds|start|startText,endSeconds|end|endText}], ordre = chapterIndex.
 * @returns {{ sections: Array, slides: Array, totalSlides: number }}
 */
export function parseTimeToSeconds(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const parts = s.split(':').map((p) => Number(p));
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function buildDeckFromMindmap(mindmap, chapters = []) {
  // Plages temporelles des chapitres (pour dériver le chapitre d'une carte non taggée).
  const ranges = (Array.isArray(chapters) ? chapters : [])
    .map((c, idx) => {
      const start = parseTimeToSeconds(c?.startSeconds ?? c?.start ?? c?.startText);
      const end = parseTimeToSeconds(c?.endSeconds ?? c?.end ?? c?.endText);
      return start != null ? { idx, start, end: end != null ? end : Number.MAX_SAFE_INTEGER } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  const indexForTime = (sec) => {
    if (sec == null || !ranges.length) return null;
    for (const r of ranges) if (sec >= r.start && sec < r.end) return r.idx;
    let best = null;
    for (const r of ranges) if (r.start <= sec) best = r.idx;
    return best; // null si avant le 1er chapitre
  };

  const flatCards = [];
  const walk = (node, inherited) => {
    if (!node || typeof node !== 'object') return;
    const sec = parseTimeToSeconds(node.timeSeconds ?? node.time);
    let ci = Number.isFinite(Number(node.chapterIndex)) ? Number(node.chapterIndex) : null;
    if (ci == null) ci = indexForTime(sec);
    const resolved = ci != null ? ci : inherited;

    const label = String(node.label || node.title || node.name || '').trim();
    const summary = String(node.summary || '').trim();
    if (resolved != null && (label || summary)) {
      flatCards.push({
        id: String(node.id || ''),
        label,
        summary,
        keyPoints: Array.isArray(node.keyPoints)
          ? node.keyPoints.map((p) => String(p)).filter(Boolean).slice(0, 6)
          : [],
        time: String(node.time || '').trim(),
        timeSeconds: sec,
        chapterIndex: resolved,
        illustrationUrl: node.illustrationUrl || node.illustration_url || null,
        // Contenu riche du slide (généré par l'IA selon le prompt agent) — optionnel.
        slideContent: node.slideContent || node.slide_content || null,
        // Libellés des enfants directs → « graphique » mini-mindmap de la carte.
        childLabels: Array.isArray(node.children)
          ? node.children
              .map((c) => String(c?.label || c?.title || c?.name || '').trim())
              .filter(Boolean)
              .slice(0, 4)
          : [],
      });
    }
    if (Array.isArray(node.children)) node.children.forEach((c) => walk(c, resolved));
  };
  // On part de la racine : elle-même (sans temps/chapitre) ne sera pas un slide,
  // mais on descend dans ses enfants en propageant le chapitre hérité.
  walk(mindmap, null);

  const bySeconds = (a, b) =>
    (a.timeSeconds ?? Number.MAX_SAFE_INTEGER) - (b.timeSeconds ?? Number.MAX_SAFE_INTEGER);

  const sections = (Array.isArray(chapters) ? chapters : []).map((c, idx) => ({
    chapterIndex: idx,
    label: String(c?.label || c?.title || `Chapitre ${idx + 1}`).trim(),
    startSeconds: parseTimeToSeconds(c?.startSeconds ?? c?.start ?? c?.startText),
    endSeconds: parseTimeToSeconds(c?.endSeconds ?? c?.end ?? c?.endText),
    slides: flatCards.filter((card) => card.chapterIndex === idx).sort(bySeconds),
  }));

  // Cartes orphelines (chapterIndex hors plage) → rattachées à la dernière section.
  const maxIdx = sections.length - 1;
  if (maxIdx >= 0) {
    const orphans = flatCards.filter((card) => card.chapterIndex > maxIdx || card.chapterIndex < 0);
    if (orphans.length) sections[maxIdx].slides = sections[maxIdx].slides.concat(orphans).sort(bySeconds);
  }

  // Liste à plat dans l'ordre de lecture (pour la synchro vidéo).
  const slides = sections.flatMap((s) => s.slides.map((sl) => ({ ...sl, section: s.label })));

  return { sections, slides, totalSlides: slides.length };
}

/**
 * Adapte une CARTE (nœud mindmap) vers les props attendues par
 * `SmartboardSegmentRenderer` / `GammaSlide` — la carte EST le slide.
 * Source unique : le même contenu sert le slide SmartBoard ET le nœud de révision.
 *
 * @param {object} card        Carte issue de buildDeckFromMindmap().
 * @param {number} deckIndex   Index global du slide (pour la variété de couleurs/gradient).
 * @param {number|null} endSeconds  Fin du slide (début de la carte suivante, ou fin de section).
 * @returns {{ segment: object, aiContent: object }}
 */
export function cardToSlideProps(card, deckIndex = 0, endSeconds = null) {
  const c = card || {};
  return {
    segment: {
      index: deckIndex,
      label: c.label || 'Carte',
      startSeconds: Number.isFinite(Number(c.timeSeconds)) ? Number(c.timeSeconds) : null,
      endSeconds: Number.isFinite(Number(endSeconds)) ? Number(endSeconds) : null,
    },
    aiContent: {
      chapter_title: c.label || '',
      reformulation_text: c.summary || '',
      summary_text: c.summary || '',
      key_points_json: Array.isArray(c.keyPoints) ? c.keyPoints : [],
      illustration_url: c.illustrationUrl || null,
    },
  };
}

export default buildDeckFromMindmap;
