import { buildDeckFromMindmap } from '@/lib/smartboard/buildDeckFromMindmap';

/**
 * Construit les chapitres « Salle de classe » immersive (Tableau Vivant) à partir
 * du contenu généré en post-production d'une vidéo de cours.
 *
 * @param {{ mindmap?: any, chapters?: any[] }} source — typiquement le `videoMemo`
 *   normalisé du player, OU le `formation_day_contents.data` brut (qui porte aussi
 *   `mindmap` + `chapters`). Les deux ont la même forme utile.
 * @returns {{ chapterLabel?: string, title: string, subtitle: string, blocks: any[], narration: string }[]}
 *   `[]` si rien à jouer (pas de mindmap/slideContent) → le bouton immersif ne s'affiche pas.
 */
export function buildClassroomChapters(source) {
  try {
    const deck = buildDeckFromMindmap(
      source?.mindmap || null,
      Array.isArray(source?.chapters) ? source.chapters : [],
    );
    const sections = deck?.sections || [];
    const sc = (s) => s?.slideContent || {};
    const out = [];
    for (const section of sections) {
      const slides = section?.slides || [];
      if (!slides.length) continue;
      const first = sc(slides[0]);
      const title = section.label || first.title || slides[0]?.label || 'Chapitre';
      const idea = slides.map((s) => sc(s).ideeCentrale || s.summary).filter(Boolean)[0];
      const objectif = slides.map((s) => sc(s).objectif).filter(Boolean)[0];
      const branches = (first.branches || []).map((b) => b?.label).filter(Boolean);
      const keyPoints = slides.map((s) => sc(s).aRetenir || s.label).filter(Boolean);
      const retain = slides.map((s) => sc(s).aRetenir).filter(Boolean)[0];
      const list = (branches.length ? branches : keyPoints).slice(0, 4);
      const blocks = [];
      if (idea) blocks.push({ type: 'idea', label: 'Idée centrale', text: idea });
      if (objectif) blocks.push({ type: 'objective', label: 'Objectif', text: objectif });
      if (list.length) blocks.push({ type: 'list', label: 'Les points clés', items: list });
      if (retain) blocks.push({ type: 'retain', label: 'À retenir', text: retain });
      if (!blocks.length) continue;
      const narration = [title, idea, objectif, ...list, retain].filter(Boolean).join('. ');
      out.push({ chapterLabel: section.label, title, subtitle: '', blocks, narration });
    }
    return out;
  } catch {
    return [];
  }
}

export default buildClassroomChapters;
