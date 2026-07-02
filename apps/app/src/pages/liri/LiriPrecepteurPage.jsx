/**
 * LiriPrecepteurPage — Le Précepteur (cours enseigné, narré + dessiné à la main)
 * monté DANS le chrome du portail LIRI (`LiriPortalShell`, rail « École » actif).
 *
 * Réutilise LE MÊME moteur de rendu que la démo publique `/precepteur` et que le cours
 * exporté `/precepteur/cours` : le composant **`PrecepteurPlayer`** (export nommé de
 * `@/pages/dev/PrecepteurDemoPage`). AUCUNE duplication du rendu (SketchRenderer /
 * AtelierPrompt / voix / images restent tels quels — ISNA intact). On se contente de
 * L'ENVELOPPER dans le shell chaud LIRI.
 *
 * DUAL-MODE (via useParams, calqué sur PrecepteurCoursePage) :
 *   A. Avec `:masterclassId` → on charge la masterclass persistée (`masterclassApi.get`,
 *      GET /masterclass-factory/:id) et on joue son `precepteur_course` s'il est jouable.
 *      Garde-fous « chargement » et « cours introuvable » (jamais de crash).
 *   B. Sans param → DÉMO : on monte le cours canonique `CANONICAL_COURSE`.
 *
 * ⚠️ `PrecepteurPlayer` ne valide PAS `course` (il fait `course.concepts.flatMap` d'entrée) :
 *    on garde donc `isPlayableCourse` AVANT de le monter (copie de PrecepteurCoursePage).
 *
 * ⚠️ Le player rend une PAGE plein écran (`min-h-screen`, fond sombre `#0b0f17` imposé,
 *    en-tête/progression/pied propres). Aucune prop (embedded/chrome) n'existe pour l'adapter :
 *    on l'accepte tel quel à l'intérieur du `<main>` chaud du shell (scroll interne).
 *
 * Import EAGER (pattern prouvé du portail, cf. LiriForumPage) — pas de lazy ici.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PrecepteurPlayer } from '@/pages/dev/PrecepteurDemoPage';
import { CANONICAL_COURSE } from '@/pages/dev/precepteurCanonicalCourse';
import { masterclassApi } from '@/lib/api-v2';

// Un `PrecepteurCourse` est jouable s'il a au moins un concept portant au moins une scène.
// Copie EXACTE du prédicat de PrecepteurCoursePage — le player ne valide rien lui-même.
function isPlayableCourse(course) {
  if (!course || !Array.isArray(course.concepts) || course.concepts.length === 0) return false;
  return course.concepts.some((c) => Array.isArray(c.scenes) && c.scenes.length > 0);
}

/**
 * Coquille de contenu : fond chaud `var(--base)`, plein-hauteur + scroll interne
 * (le `<main>` du shell force 100% et `overflow-hidden`, comme LiriForumPage), et pose
 * `--school-accent: #d97757` pour réchauffer les accents thémables du rendu Précepteur.
 * Tout le chrome que l'on AJOUTE (états de chargement / introuvable) utilise les classes
 * `.lp-*` du portail — aucune couleur navy/violet ajoutée par nous.
 */
function PrecepteurCanvas({ children }) {
  return (
    <div
      className="h-full min-h-0 overflow-y-auto overflow-x-hidden"
      style={{ background: 'var(--base)', '--school-accent': '#d97757' }}
    >
      {children}
    </div>
  );
}

// État plein-cadre (chargement / introuvable) rendu dans le ton chaud du portail (.lp-*).
function PrecepteurState({ title, body }) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-6 text-center">
      <span className="lp-muted text-[11px] font-bold uppercase tracking-[0.2em]">
        Le Précepteur · cours enseigné
      </span>
      <h1 className="lp-ink mt-3 text-2xl font-extrabold">{title}</h1>
      <p className="lp-muted mt-3 max-w-md text-sm leading-relaxed">{body}</p>
    </div>
  );
}

export default function LiriPrecepteurPage() {
  const { masterclassId } = useParams();

  // MODE B (démo, sans id) : cours canonique, figé au montage.
  const demoCourse = useMemo(() => (masterclassId ? null : CANONICAL_COURSE), [masterclassId]);

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

  // Cours effectif à jouer selon le mode.
  const course = masterclassId ? remoteCourse : demoCourse;

  // Choix de l'écran interne (garde-fous AVANT le player, qui ne valide rien).
  let inner;
  if (masterclassId && loading) {
    inner = (
      <PrecepteurState
        title="Chargement du cours…"
        body="Récupération de la Masterclass enseignée par Le Précepteur."
      />
    );
  } else if (masterclassId && (notFound || !isPlayableCourse(course))) {
    inner = (
      <PrecepteurState
        title="Cours introuvable"
        body="Cette Masterclass n’existe pas, ou elle ne contient pas de Cours numérique (Précepteur) jouable."
      />
    );
  } else if (!isPlayableCourse(course)) {
    // Filet de sécurité (ne devrait pas arriver : le cours canonique est jouable).
    inner = (
      <PrecepteurState
        title="Aucun cours à jouer"
        body="Le cours de démonstration est indisponible pour le moment."
      />
    );
  } else {
    // Seul chemin qui monte le MOTEUR partagé — non re-skinné (rendu Précepteur tel quel).
    inner = <PrecepteurPlayer course={course} />;
  }

  return (
    <LiriPortalShell active="ecole">
      <PrecepteurCanvas>
        <ErrorBoundary logTag="LIRI Précepteur">{inner}</ErrorBoundary>
      </PrecepteurCanvas>
    </LiriPortalShell>
  );
}
