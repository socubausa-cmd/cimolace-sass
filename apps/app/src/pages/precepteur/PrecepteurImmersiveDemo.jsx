import React, { useMemo } from 'react';
import FormationStage from '@/components/agent/FormationStage';
import { CANONICAL_COURSE } from '@/pages/dev/precepteurCanonicalCourse';
import { masterclassProjectToPrecepteurCourse } from '@/lib/precepteur/fromMasterclass';

/**
 * PrecepteurImmersiveDemo — entrée de la route publique `/precepteur` :
 * le SECTEUR FORMATION du cerveau immersif Cimolace (FormationStage) — Cimolace joue le cours
 * dans SA coque (présence + voix serif + croquis + « parler à la présence »), zéro bouton,
 * zéro interface propre au Précepteur. Le Précepteur n'est que la matière (conformCourse) + le
 * cerveau (precepteur-brain) appelés par Cimolace.
 *
 * Charge le cours : un `MasterclassProject` déposé dans localStorage (`precepteur:sourceProject`)
 * est joué ; sinon repli sur le cours canonique figé.
 */
function loadCourse() {
  try {
    const raw = window.localStorage.getItem('precepteur:sourceProject');
    if (raw) {
      const course = masterclassProjectToPrecepteurCourse(JSON.parse(raw));
      if (course && Array.isArray(course.concepts) && course.concepts.some((c) => Array.isArray(c.scenes) && c.scenes.length)) {
        return course;
      }
    }
  } catch { /* JSON invalide / mode privé → repli canonique */ }
  return CANONICAL_COURSE;
}

export default function PrecepteurImmersiveDemo() {
  const course = useMemo(() => loadCourse(), []);
  return <FormationStage course={course} />;
}
