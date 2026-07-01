/**
 * fromMasterclass.js — TRANSFORME un `MasterclassProject` en `PrecepteurCourse`.
 *
 * PURE ESM. Aucun import (ni alias `@/…`, ni dépendance bundler) : ce module doit
 * tourner tel quel sous Node nu (`node fichier.mjs`) pour la preuve automatisée.
 *
 * ── Ce qui est mappé (cf. contrat de rendu « Le Précepteur » + mapping chapitre→scènes) ──
 *   lecon           <- chapter.simple_lesson  ET/OU  chapter.deep_lesson
 *                      (fallback chapter.knowledge_to_transmit)
 *   amorce_croquis  <- chapter.thought_experiment  (amorce « au tableau »)
 *   atelier         <- chapter.workshop.{questions[0], expected_answers, expected_errors}
 *                      + chapter.revelation_moment (reveal_narration)
 *   image_analogie  <- chapter.analogies[0].content  (+ real_application → caption)
 *   transition      <- chapter.transition_to_next
 *
 * ── Le CROQUIS (`type:'croquis'` + `reveal_sketch`) ──
 *   `MasterclassChapter` ne porte AUCUNE donnée géométrique (`sketch.elements[]`,
 *   coordonnées, kinds). Or `SketchRenderer` accède à `el.from[0]` / `el.center[0]`
 *   SANS garde → un croquis vide/mal formé fait planter le rendu. On l'OMET donc
 *   proprement (pas de scène `croquis`, pas de `reveal_sketch`) plutôt que d'émettre
 *   un placeholder fragile. Le contenu de l'expérience de pensée reste transmis via
 *   la scène `amorce_croquis`. Aucune scène produite ne peut crasher le renderer.
 *
 * @param {import('../liri-masterclass/types').MasterclassProject|Object} project
 * @returns {{ title: string, concepts: Array<{ id?: string, title: string, scenes: Object[] }> }}
 */

/** Texte non vide et « propre » (string trim), sinon '' */
function txt(v) {
  if (v == null) return '';
  const s = String(v).trim();
  return s;
}

/** Renvoie true si la valeur est un texte exploitable (non vide après trim). */
function has(v) {
  return txt(v).length > 0;
}

/** Tableau de strings nettoyées (retire les vides). */
function strList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => txt(x)).filter((s) => s.length > 0);
}

/**
 * Ateliers : `ack_variants` n'a AUCUNE source dans le chapitre (micro-feedbacks du
 * prof). On fournit un jeu par défaut cohérent pour que la révélation soit vivante.
 */
const DEFAULT_ACK = {
  ok: ['Exactement.', 'Tu y es.', 'C’est ça même.', 'Voilà.'],
  partial: ['Presque — pousse d’un cran.', 'Tu tiens un bout du fil…', 'Bonne direction.'],
  wrong: ['Pas tout à fait.', 'Regarde encore.', 'Non — mais l’erreur est instructive.'],
};

/** Extrait le contenu de la 1re analogie ({type?, content?} | string). */
function firstAnalogyContent(analogies) {
  if (!Array.isArray(analogies) || analogies.length === 0) return '';
  const a0 = analogies[0];
  if (a0 == null) return '';
  if (typeof a0 === 'string') return txt(a0);
  return txt(a0.content);
}

/**
 * Construit les scènes d'UN chapitre, dans l'ordre pédagogique du Précepteur.
 * Chaque scène respecte EXACTEMENT les champs requis de son `type` (contrat).
 * @param {Object} ch  un MasterclassChapter (idéalement issu de project.pedagogy)
 * @returns {Object[]} scènes (jamais crashantes pour le renderer)
 */
function chapterToScenes(ch) {
  const chapter = ch || {};
  const scenes = [];
  const title = txt(chapter.title);

  // ── 1) LEÇON(s) écrite(s) à la main ──────────────────────────────────────
  // simple_lesson d'abord (leçon « simple »), puis deep_lesson (leçon « profonde »).
  // Le TITRE du chapitre n'est porté que par la 1re leçon (h2 optionnel).
  const simple = txt(chapter.simple_lesson);
  const deep = txt(chapter.deep_lesson);
  const fallbackKnowledge = txt(chapter.knowledge_to_transmit);

  let firstLessonEmitted = false;
  if (simple) {
    scenes.push({
      type: 'lecon',
      ...(title ? { title } : {}),
      board_text: simple,
      narration: simple,
    });
    firstLessonEmitted = true;
  }
  if (deep) {
    scenes.push({
      type: 'lecon',
      // titre seulement si aucune 1re leçon ne l'a déjà porté (évite le doublon)
      ...(!firstLessonEmitted && title ? { title } : {}),
      board_text: deep,
      narration: deep,
    });
    firstLessonEmitted = true;
  }
  // Aucune leçon rédigée → repli sur le savoir à transmettre (squelette).
  if (!firstLessonEmitted && fallbackKnowledge) {
    scenes.push({
      type: 'lecon',
      ...(title ? { title } : {}),
      board_text: fallbackKnowledge,
      narration: fallbackKnowledge,
    });
    firstLessonEmitted = true;
  }

  // ── 2) AMORCE « au tableau » ← thought_experiment ────────────────────────
  // Le champ REQUIS d'`amorce_croquis` est `narration` (seul contenu affiché + voix).
  // L'expérience de pensée = le contenu naturel de l'amorce. (Le vrai croquis vectoriel
  // n'a pas de source → on ne produit PAS de scène `croquis`, cf. entête.)
  const thought = txt(chapter.thought_experiment);
  if (thought) {
    scenes.push({ type: 'amorce_croquis', narration: thought });
  }

  // ── 3) ATELIER (nominatif) ← workshop + revelation_moment ────────────────
  const workshop = chapter.workshop || {};
  const questions = strList(workshop.questions);
  const question = questions[0] || '';
  const revealNarration = txt(chapter.revelation_moment) || txt(chapter.main_revelation);
  // On n'émet l'atelier que s'il a de quoi être joué (question OU révélation).
  if (question || revealNarration) {
    const atelier = {
      type: 'atelier',
      address: '{{student_name}}', // littéral (non lu par le code, mais présent au canonical)
      question: question || `Que retiens-tu de « ${title || 'ce chapitre'} » ?`,
      expected_answers: strList(workshop.expected_answers),
      expected_errors: strList(workshop.expected_errors),
      ack_variants: DEFAULT_ACK,
      reveal_narration:
        revealNarration ||
        'Voilà l’essentiel de ce que nous venons de voir ensemble.',
    };
    // `instructions` du workshop = meilleur candidat pour un indice (optionnel).
    if (has(workshop.instructions)) atelier.hint = txt(workshop.instructions);
    // NOTE: pas de `reveal_sketch` — même absence de source géométrique que `croquis`.
    scenes.push(atelier);
  }

  // ── 4) IMAGE / ANALOGIE ← analogies[0] (+ real_application → caption) ─────
  const analogie = firstAnalogyContent(chapter.analogies);
  if (analogie) {
    const scene = {
      type: 'image_analogie',
      analogie,
      narration: analogie,
    };
    // `real_application` sert de légende à l'exemple « Dans la nature » (approx.).
    // `subject` n'a pas de source (enum d'anim front) → on ne fournit pas
    // `animated_example` sans `subject` valide (le renderer lit `.subject`).
    // (image_prompt / analogy_anim sans source → on les laisse absents : la page
    //  affiche alors le texte de l'analogie seul, sans crash.)
    scenes.push(scene);
  }

  // ── 5) TRANSITION ← transition_to_next ───────────────────────────────────
  const transition = txt(chapter.transition_to_next);
  if (transition) {
    scenes.push({ type: 'transition', narration: transition });
  }

  return scenes;
}

/**
 * Choisit le tableau de chapitres à consommer.
 * `project.pedagogy[]` = chapitres ENRICHIS (leçons, atelier, analogies…) → prioritaire.
 * `project.chapters[]` = squelette (fallback). Accepte aussi un tableau nu.
 */
function pickChapters(project) {
  if (Array.isArray(project)) return project;
  const p = project || {};
  if (Array.isArray(p.pedagogy) && p.pedagogy.length > 0) return p.pedagogy;
  if (Array.isArray(p.chapters) && p.chapters.length > 0) return p.chapters;
  return [];
}

/**
 * TRANSFORME un `MasterclassProject` en `PrecepteurCourse` (format du contrat de rendu).
 * Un chapitre Masterclass → un `concept` Précepteur ; ses champs → les scènes.
 *
 * Robuste : project null/partiel, chapitres sans champs, tableaux manquants → jamais
 * de throw, jamais de scène crashante. Un concept sans AUCUNE scène exploitable est
 * écarté (le rendu aplati `flatMap` n'aime pas les concepts vides).
 *
 * @param {import('../liri-masterclass/types').MasterclassProject|Object} project
 * @returns {{ title: string, concepts: Array<{ id?: string, title: string, scenes: Object[] }> }}
 */
export function masterclassProjectToPrecepteurCourse(project) {
  const p = project || {};
  const chapters = pickChapters(p);

  // Titre du cours : analysis.global_subject → project.title → repli.
  const analysisSubject = txt(p?.analysis?.global_subject);
  const projectTitle = txt(p?.title);
  const courseTitle = analysisSubject || projectTitle || 'Cours du Précepteur';

  const concepts = [];
  chapters.forEach((ch, i) => {
    const chapter = ch || {};
    const scenes = chapterToScenes(chapter);
    if (scenes.length === 0) return; // concept vide → écarté (sinon rendu vide)
    const conceptTitle = txt(chapter.title) || `Chapitre ${i + 1}`;
    const idSource = chapter.chapter_id != null ? chapter.chapter_id : chapter.id;
    concepts.push({
      ...(idSource != null ? { id: String(idSource) } : {}),
      title: conceptTitle,
      scenes,
    });
  });

  return { title: courseTitle, concepts };
}

export default masterclassProjectToPrecepteurCourse;
