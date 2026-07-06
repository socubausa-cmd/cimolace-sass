import React, { useMemo } from 'react';
import PrecepteurImmersive from '@/pages/precepteur/PrecepteurImmersive';
import { CANONICAL_COURSE } from '@/pages/dev/precepteurCanonicalCourse';
import { masterclassProjectToPrecepteurCourse } from '@/lib/precepteur/fromMasterclass';

/**
 * PrecepteurImmersiveDemo — entrée de la route publique `/precepteur` :
 * Le Précepteur DANS le cerveau immersif (coque partagée + présence + « parler à la présence »).
 *
 * Charge le cours comme l'ancienne démo : un `MasterclassProject` déposé dans localStorage
 * (`precepteur:sourceProject`) est joué ; sinon repli sur le cours canonique figé.
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
  return <PrecepteurImmersive course={course} />;
}
