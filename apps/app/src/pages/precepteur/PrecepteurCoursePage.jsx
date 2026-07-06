import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { PrecepteurPlayer } from '@/pages/dev/PrecepteurDemoPage';
import { masterclassProjectToPrecepteurCourse } from '@/lib/precepteur/fromMasterclass';
import { conformCourseSync } from '@/lib/precepteur/conformCourse';
import { masterclassApi } from '@/lib/api-v2';

/**
 * PrecepteurCoursePage — routes /precepteur/cours ET /precepteur/cours/:masterclassId.
 *
 * REND un « Cours numérique (Précepteur) » exporté depuis la Masterclass Factory.
 *
 * DEUX MODES :
 *   A. Avec `:masterclassId` (route porteuse d'id) → on charge la masterclass persistée via
 *      `masterclassApi.get(id)` (GET /masterclass-factory/:id) et on joue son
 *      `precepteur_course` s'il est jouable. Sinon → écran « cours introuvable » propre.
 *   B. Sans param → on lit localStorage, dans cet ordre de priorité :
 *        1. `precepteur:sourceCourse` — un `PrecepteurCourse` DÉJÀ enrichi par la Factory
 *           (transform + scènes croquis générées par l'edge `liri-preceptor-course`). Rendu
 *           tel quel (déjà au bon format, croquis inclus).
 *        2. `precepteur:sourceProject` — repli : le `MasterclassProject` brut, qu'on TRANSFORME
 *           via `masterclassProjectToPrecepteurCourse` (SANS croquis) pour rester rétro-compatible.
 *
 * Puis on le joue avec le MOTEUR partagé `PrecepteurPlayer` (le même que la démo /precepteur
 * — aucune duplication du rendu).
 *
 * Si aucune source exploitable n'est présente → écran vide explicite (on NE rejoue PAS la
 * démo canonique ici : cette page est dédiée au cours exporté).
 */

// Doivent correspondre EXACTEMENT aux clés écrites par MasterclassFactoryPage (bouton export).
const SOURCE_COURSE_KEY = 'precepteur:sourceCourse'; // cours déjà enrichi (prioritaire)
const SOURCE_PROJECT_KEY = 'precepteur:sourceProject'; // MasterclassProject brut (repli)

// Un `PrecepteurCourse` est jouable s'il a au moins un concept portant au moins une scène.
// Même prédicat que la garde de « jouabilité » côté Factory.
function isPlayableCourse(course) {
  if (!course || !Array.isArray(course.concepts) || course.concepts.length === 0) return false;
  return course.concepts.some((c) => Array.isArray(c.scenes) && c.scenes.length > 0);
}

// Lit le cours à jouer depuis localStorage ; null si absent/vide.
// Ne jette JAMAIS : toute erreur (JSON invalide, projet partiel) → null → écran vide.
// PRIORITÉ au cours DÉJÀ enrichi (croquis inclus) ; sinon repli sur la transform du projet brut.
function loadExportedCourse() {
  // 1) Cours déjà enrichi (rendu direct, croquis inclus).
  try {
    const rawCourse = window.localStorage.getItem(SOURCE_COURSE_KEY);
    if (rawCourse) {
      const enriched = JSON.parse(rawCourse);
      if (isPlayableCourse(enriched)) return enriched;
    }
  } catch { /* JSON invalide → on tente le repli */ }

  // 2) Repli : MasterclassProject brut → transform (sans croquis).
  try {
    const rawProject = window.localStorage.getItem(SOURCE_PROJECT_KEY);
    if (!rawProject) return null;
    const project = JSON.parse(rawProject);
    const course = masterclassProjectToPrecepteurCourse(project);
    return isPlayableCourse(course) ? course : null;
  } catch {
    return null;
  }
}

// Écran plein sombre partagé (chargement / vide / introuvable) — reprend le style de l'écran vide.
function PrecepteurScreen({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0f17] px-6 text-center">
      <div className="mb-4 flex items-center gap-2 text-amber-400/90">
        <GraduationCap className="h-6 w-6" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Le Précepteur · cours numérique</span>
      </div>
      {children}
    </div>
  );
}

export default function PrecepteurCoursePage() {
  const { masterclassId } = useParams();

  // MODE B (sans id) : cours localStorage, calculé une fois au montage (inchangé).
  const localCourse = useMemo(() => (masterclassId ? null : loadExportedCourse()), [masterclassId]);

  // MODE A (avec id) : cours chargé depuis le backend.
  const [remoteCourse, setRemoteCourse] = useState(null);
  const [loading, setLoading] = useState(Boolean(masterclassId));
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!masterclassId) return; // MODE B : rien à charger.
    let alive = true;
    setLoading(true);
    setNotFound(false);
    setRemoteCourse(null);
    masterclassApi
      .get(masterclassId)
      .then((mc) => {
        if (!alive) return;
        const course = mc?.precepteur_course;
        if (isPlayableCourse(course)) setRemoteCourse(course);
        else setNotFound(true); // masterclass existante mais pas un cours Précepteur jouable
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setNotFound(true);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [masterclassId]);

  // MODE A — chargement en cours.
  if (masterclassId && loading) {
    return (
      <PrecepteurScreen>
        <h1 className="text-2xl font-extrabold text-white">Chargement du cours…</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
          Récupération de la Masterclass enseignée par Le Précepteur.
        </p>
      </PrecepteurScreen>
    );
  }

  // MODE A — masterclass introuvable ou sans cours Précepteur jouable.
  if (masterclassId && (notFound || !remoteCourse)) {
    return (
      <PrecepteurScreen>
        <h1 className="text-2xl font-extrabold text-white">Cours introuvable</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
          Cette Masterclass n’existe pas, ou elle ne contient pas de{' '}
          <strong className="text-white/80">Cours numérique (Précepteur)</strong> jouable.
        </p>
        <Link
          to="/dashboard/tools/masterclass-factory"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#7C3AED] px-6 py-3 text-sm font-bold text-white hover:bg-violet-500"
        >
          Ouvrir la Masterclass Factory
        </Link>
      </PrecepteurScreen>
    );
  }

  // Juge de conformité (brique C) : garantit l'uniformité — injecte les dispositifs
  // déterministes (surlignage / encadré / résumé, comme A2), dédoublonne, sécurise les
  // croquis (anti-crash) et réordonne au contrat canonique (beat-aware). Non destructif ;
  // les manques LLM (croquis/atelier/image) sont flaggés, jamais inventés. null reste null.
  const rawCourse = masterclassId ? remoteCourse : localCourse;
  const course = rawCourse ? conformCourseSync(rawCourse).course : null;

  // MODE B — aucune source localStorage exploitable → écran vide explicite (inchangé).
  if (!course) {
    return (
      <PrecepteurScreen>
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
      </PrecepteurScreen>
    );
  }

  return <PrecepteurPlayer course={course} />;
}
