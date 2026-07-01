import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { PrecepteurPlayer } from '@/pages/dev/PrecepteurDemoPage';
import { masterclassProjectToPrecepteurCourse } from '@/lib/precepteur/fromMasterclass';

/**
 * PrecepteurCoursePage — route /precepteur/cours.
 *
 * REND un « Cours numérique (Précepteur) » exporté depuis la Masterclass Factory :
 * on lit le `MasterclassProject` déposé en localStorage (clé identique à celle écrite
 * par le bouton d'export de MasterclassFactoryPage), on le TRANSFORME en `PrecepteurCourse`
 * via `masterclassProjectToPrecepteurCourse`, puis on le joue avec le MOTEUR partagé
 * `PrecepteurPlayer` (le même que la démo /precepteur — aucune duplication du rendu).
 *
 * Si aucun projet exploitable n'est présent → écran vide explicite (on NE rejoue PAS la
 * démo canonique ici : cette page est dédiée au cours exporté).
 */

// Doit correspondre EXACTEMENT à la clé écrite par MasterclassFactoryPage (bouton export).
const SOURCE_PROJECT_KEY = 'precepteur:sourceProject';

// Lit + transforme le MasterclassProject de localStorage → PrecepteurCourse ; null si absent/vide.
// Ne jette JAMAIS : toute erreur (JSON invalide, projet partiel) → null → écran vide.
function loadExportedCourse() {
  try {
    const raw = window.localStorage.getItem(SOURCE_PROJECT_KEY);
    if (!raw) return null;
    const project = JSON.parse(raw);
    const course = masterclassProjectToPrecepteurCourse(project);
    if (!course || !Array.isArray(course.concepts) || course.concepts.length === 0) return null;
    const hasScenes = course.concepts.some((c) => Array.isArray(c.scenes) && c.scenes.length > 0);
    return hasScenes ? course : null;
  } catch {
    return null;
  }
}

export default function PrecepteurCoursePage() {
  const course = useMemo(() => loadExportedCourse(), []);

  if (!course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0f17] px-6 text-center">
        <div className="mb-4 flex items-center gap-2 text-amber-400/90">
          <GraduationCap className="h-6 w-6" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Le Précepteur · cours numérique</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white">Aucun cours à jouer</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
          Génère une Masterclass, puis choisis l’export{' '}
          <strong className="text-white/80">« Cours numérique (Précepteur) »</strong> à l’étape Export
          pour ouvrir le cours enseigné ici.
        </p>
        <Link
          to="/dashboard/tools/masterclass-factory"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#7C3AED] px-6 py-3 text-sm font-bold text-white hover:bg-violet-500"
        >
          Ouvrir la Masterclass Factory
        </Link>
      </div>
    );
  }

  return <PrecepteurPlayer course={course} />;
}
