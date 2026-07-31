import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  const [openChapter, setOpenChapter] = useState(null);
  // Un chapitre récapitulé puis fermé ne doit pas se rouvrir tant qu'on n'a pas
  // changé de scène : sinon le moindre re-rendu relancerait le panneau à la
  // figure de l'hôte en plein direct.
  const dismissedRef = useRef(new Set());

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

  const eligible = Boolean(enabled) && isChapterEnd && summary.length > 0;

  // Changer de scène remet le compteur à zéro : l'interlude appartient à la
  // scène qui vient de se terminer, il ne survit pas à la suivante.
  useEffect(() => {
    dismissedRef.current = new Set();
    setOpenChapter(null);
  }, [currentSceneId]);

  useEffect(() => {
    if (!eligible) {
      setOpenChapter(null);
      return;
    }
    if (revealStep == null) return;
    if (Number(revealStep) < Number(maxStep)) return;
    if (dismissedRef.current.has(chapterId)) return;
    setOpenChapter(chapterId);
  }, [eligible, revealStep, maxStep, chapterId]);

  const dismiss = useCallback(() => {
    if (chapterId != null) dismissedRef.current.add(chapterId);
    setOpenChapter(null);
  }, [chapterId]);

  /** Ouverture manuelle (le prof veut récapituler tout de suite). Sans matière : sans effet. */
  const start = useCallback(() => {
    if (!eligible || chapterId == null) return;
    dismissedRef.current.delete(chapterId);
    setOpenChapter(chapterId);
  }, [eligible, chapterId]);

  return {
    pending: openChapter != null && openChapter === chapterId && summary.length > 0,
    chapterId,
    summary,
    dismiss,
    start,
  };
}

export default useChapterInterlude;
