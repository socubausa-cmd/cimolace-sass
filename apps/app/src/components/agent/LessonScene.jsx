import React, { useMemo } from 'react';
import { PrecepteurPlayer } from '@/pages/dev/PrecepteurDemoPage';
import { conformCourseSync } from '@/lib/precepteur/conformCourse';
import { CANONICAL_COURSE } from '@/pages/dev/precepteurCanonicalCourse';

/**
 * LessonScene — LE PRÉCEPTEUR embarqué comme SECTEUR « formation » de l'assistant Cimolace.
 *
 * Encapsule le lecteur prouvé `PrecepteurPlayer` (mode `embedded` = fond transparent, sans son
 * propre chrome/menus/couleurs) pour l'afficher NATIVEMENT dans la coque Cimolace : c'est
 * Cimolace (le cerveau général) qui appelle le Précepteur (le cerveau formation) et n'affiche
 * que le CONTENU du cours. `autoBegin` + `studentName` → pas de start-screen à boutons.
 *
 * Tout le poids (voix, croquis, atelier, SFX, framer-motion, conformCourse) reste DERRIÈRE cette
 * frontière lazy → le bundle initial de l'assistant Cimolace reste léger.
 */

// Cours embarquables. Lot 1 : le cours canonique (démo du moteur, temps→spirale, showcase
// complet main-qui-écrit + croquis + atelier). Les cours sur-mesure Cimolace viennent ensuite.
const COURSES = { demo: CANONICAL_COURSE };

export default function LessonScene({ courseKey = 'demo', studentName, onScene }) {
  const conformed = useMemo(() => {
    try { return conformCourseSync(COURSES[courseKey] || CANONICAL_COURSE).course; }
    catch { return CANONICAL_COURSE; }
  }, [courseKey]);
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '78vh', display: 'flex' }}>
      <PrecepteurPlayer course={conformed} embedded onScene={onScene} studentName={studentName} autoBegin />
    </div>
  );
}
