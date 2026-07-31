import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * INTERLUDE DE REFORMULATION — §3.2 du cahier des charges « Tableau Vivant » :
 * « Avant de passer au chapitre suivant, le tableau passe au premier plan et
 * récapitule. »
 *
 * Ce hook ne décide QUE du déclenchement et du contenu. L'affichage (les 6 lois)
 * est le travail de `ChapterInterlude`.
 *
 * RÈGLE DURE — aucune invention : la reformulation est bâtie exclusivement avec
 * ce que les scènes du chapitre écoulé portent déjà (`ia_data.slide_summary`,
 * `ia_data.core_idea` à défaut). Si le chapitre n'a AUCUN résumé exploitable,
 * l'interlude ne se déclenche pas — mieux vaut pas d'interlude qu'un
 * récapitulatif fabriqué de toutes pièces devant une classe.
 *
 * Ce que ce hook NE fait PAS (à ne pas croire sur parole d'un futur lecteur) :
 * - il ne narre rien : la voix off de la reformulation (§3.2 point 3) suppose un
 *   audio produit en post-prod (lot 4), qui n'existe pas encore ici ;
 * - il ne met aucune vidéo en pause : en direct, le tableau se superpose, il ne
 *   pilote pas le flux ;
 * - il ne déclenche RIEN sur la dernière scène du deck (pas de « chapitre
 *   suivant » à annoncer) ;
 * - sans `chapter_id` sur les scènes (contenus publiés avant la migration
 *   20260731), il reste inerte : comportement strictement inchangé.
 */

/** Nombre de paliers de révélation d'une scène progressive (0 → 3). */
const SCENE_MAX_STEP = 3;

const chapterOf = (scene) => {
  const raw = scene?.chapter_id ?? scene?.ia_data?.chapter_id ?? null;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** Point récapitulatif d'une scène : son résumé, à défaut son idée centrale. Jamais les deux. */
const pointOf = (scene) => {
  const ia = scene?.ia_data || {};
  const raw = ia.slide_summary ?? scene?.slide_summary ?? ia.core_idea ?? scene?.core_idea ?? '';
  const text = String(raw || '').trim();
  return text.length >= 3 ? text : '';
};

export function useChapterInterlude({
  /** Liste ORDONNÉE des scènes (format normalisé `normalizeLiveSceneToSlide`). */
  scenes,
  currentSceneId,
  /** Palier de révélation de la scène courante — l'interlude attend le tableau complet. */
  revealStep = null,
  maxStep = SCENE_MAX_STEP,
  enabled = true,
} = {}) {
  const list = Array.isArray(scenes) ? scenes : null;

  // L'ouverture est DÉRIVÉE du palier de révélation, pas synchronisée par un
  // effet : un effet aurait rouvert le panneau au moindre re-rendu de la scène
  // (parallaxe, régie, narration) après une fermeture par le prof.
  const [, forceRender] = useState(0);
  const localRef = useRef({ sceneKey: null, dismissed: new Set(), forced: null });
  const sceneKey = currentSceneId == null ? null : String(currentSceneId);
  if (localRef.current.sceneKey !== sceneKey) {
    // Changer de scène remet le compteur à zéro : l'interlude appartient à la
    // scène qui vient de se terminer, il ne survit pas à la suivante.
    localRef.current = { sceneKey, dismissed: new Set(), forced: null };
  }

  const index = useMemo(() => {
    if (!list || currentSceneId == null) return -1;
    return list.findIndex((s) => s && String(s.id) === String(currentSceneId));
  }, [list, currentSceneId]);

  const chapterId = index >= 0 ? chapterOf(list[index]) : null;

  /** Fin de chapitre = la scène SUIVANTE appartient à un autre chapitre. */
  const isChapterEnd = useMemo(() => {
    if (index < 0 || chapterId == null || !list) return false;
    const next = list[index + 1];
    const nextChapter = chapterOf(next);
    return nextChapter != null && nextChapter !== chapterId;
  }, [list, index, chapterId]);

  const summary = useMemo(() => {
    if (!list || chapterId == null || !isChapterEnd) return [];
    const seen = new Set();
    const points = [];
    for (const scene of list) {
      if (chapterOf(scene) !== chapterId) continue;
      const text = pointOf(scene);
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      points.push(text);
    }
    return points;
  }, [list, chapterId, isChapterEnd]);

  /**
   * Un chapitre d'UNE SEULE scène n'a rien à récapituler : l'interlude
   * réafficherait, en plein écran, la phrase que l'élève vient de lire. Le
   * cahier des charges demande une reformulation de ce qui a été PARCOURU, pas
   * un doublon. C'est le cas courant du tunnel Master Factory, qui publie
   * aujourd'hui une scène par chapitre — sans cette garde, un interlude
   * s'interposerait après CHAQUE scène du direct.
   */
  const chapterSceneCount = useMemo(() => {
    if (!list || chapterId == null) return 0;
    return list.filter((scene) => chapterOf(scene) === chapterId).length;
  }, [list, chapterId]);

  const eligible = Boolean(enabled)
    && isChapterEnd
    && chapterSceneCount >= 2
    && summary.length > 0;

  const dismiss = useCallback(() => {
    if (chapterId != null) localRef.current.dismissed.add(chapterId);
    localRef.current.forced = null;
    forceRender((n) => n + 1);
  }, [chapterId]);

  /** Ouverture manuelle (le prof récapitule tout de suite). Sans matière : sans effet. */
  const start = useCallback(() => {
    if (!eligible || chapterId == null) return;
    localRef.current.dismissed.delete(chapterId);
    localRef.current.forced = chapterId;
    forceRender((n) => n + 1);
  }, [eligible, chapterId]);

  // Le tableau doit être ALLÉ AU BOUT avant d'être récapitulé : on n'interrompt
  // pas une scène en cours de révélation. Un tableau montré d'un coup n'atteint
  // jamais ce palier — d'où l'ouverture manuelle `start`.
  const reachedEnd = revealStep != null && Number(revealStep) >= Number(maxStep);
  const pending = eligible
    && !localRef.current.dismissed.has(chapterId)
    && (localRef.current.forced === chapterId || reachedEnd);

  return { pending, chapterId, summary, dismiss, start };
}

export default useChapterInterlude;
