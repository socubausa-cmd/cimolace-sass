/**
 * enrichCroquis.js — ENRICHIT un `PrecepteurCourse` avec de vraies scènes `croquis`
 * (dessin vectoriel main-levée) produites par l'edge Supabase `liri-preceptor-course`.
 *
 * ── POURQUOI ce module existe ──────────────────────────────────────────────
 * `fromMasterclass.js` OMET volontairement le type `croquis` : un `MasterclassChapter`
 * ne porte AUCUNE donnée géométrique (`from[]`, `center[]`, `kind`). Comme
 * `SketchRenderer` accède à `el.from[0]` / `el.center[0]` SANS garde, une scène
 * `croquis` sans `sketch.elements` non vide FAIT PLANTER le rendu. L'edge
 * `liri-preceptor-course` sait, elle, générer ce croquis vectoriel (sanitisé :
 * coords 0..100, `from/to` ou `center` garantis, vocab fermé). Ce module appelle
 * l'edge par concept et RÉINJECTE les croquis valides dans le cours.
 *
 * ── INVARIANT DE SÛRETÉ SACRÉ ──────────────────────────────────────────────
 * Une scène `{ type:'croquis' }` n'est JAMAIS insérée sans un `sketch.elements`
 * NON VIDE. Si l'edge renvoie `null` / `{elements:[]}` / rien d'exploitable pour
 * un concept, on n'insère RIEN pour ce concept (le contenu reste transmis par la
 * scène `amorce_croquis`, inchangée). Aucune scène produite ne peut crasher le
 * renderer.
 *
 * ── PUR ESM, injection de dépendance ───────────────────────────────────────
 * AUCUN import bundler / alias `@/…`. Le client Supabase et la logique d'appel
 * (auth, unwrap `data.sketch`, cascade d'erreurs) sont injectés via `invokeEdge`
 * — ce module reste testable sous Node nu (`node fichier.mjs`) avec un mock.
 *
 *   invokeEdge(seed) -> Promise<{ caption?: string, elements: Array } | null>
 *     seed = { chapterTitle, centralIdea, lessonText }  (au moins un requis)
 *     L'appelant est responsable de : getSession + Authorization Bearer +
 *     `supabase.functions.invoke('liri-preceptor-course', …)` + DÉBALLAGE de
 *     `data.sketch` (l'edge renvoie TOUJOURS `{ sketch: { caption?, elements } }`).
 *     Doit renvoyer `null` en cas d'échec (jamais throw attendu, mais ce module
 *     est de toute façon tolérant aux rejets).
 */

/** Texte non vide « propre » (string trim), sinon '' — miroir de fromMasterclass.txt. */
function txt(v) {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * Vrai UNIQUEMENT si le sketch est exploitable par `SketchRenderer` :
 * un objet avec un tableau `elements` NON VIDE. C'est le seul juge de l'invariant.
 * (La validité FINE de chaque élément est vérifiée par `isValidElement` au moment
 * de la coercition — voir `coerceSketch`.)
 */
function hasDrawableSketch(sketch) {
  return !!sketch
    && typeof sketch === 'object'
    && Array.isArray(sketch.elements)
    && sketch.elements.length > 0;
}

/** Vocabulaire fermé de SketchRenderer (SketchRenderer.jsx:11). */
const CENTER_KINDS = new Set(['point', 'circle', 'spiral', 'axis', 'label']);
const SEGMENT_KINDS = new Set(['vector', 'arrow', 'line', 'curve']);
const isPair = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));

/**
 * Défense en profondeur : un élément n'est sûr QUE s'il porte la géométrie que
 * `SketchRenderer` lit SANS garde (center-kinds → `center[0..1]` ; tout le reste,
 * y.c. un kind hors vocab qui tomberait dans la branche segment par défaut → `from`+`to`).
 */
function isValidElement(el) {
  if (!el || typeof el !== 'object') return false;
  const kind = String(el.kind || '').toLowerCase();
  if (CENTER_KINDS.has(kind)) return isPair(el.center);
  if (SEGMENT_KINDS.has(kind)) return isPair(el.from) && isPair(el.to);
  return false; // hors vocab fermé → rejeté (sinon branche segment → crash)
}

/**
 * Normalise le retour d'`invokeEdge` en un `sketch` sûr à insérer, ou `null`.
 * Accepte les deux formes tolérées :
 *   - déjà déballé : `{ caption?, elements }`
 *   - encore enveloppé : `{ sketch: { caption?, elements } }` (au cas où l'appelant
 *     oublierait de déballer — ceinture + bretelles, on ne casse pas l'invariant).
 * Renvoie un OBJET NEUF `{ caption?, elements }` (jamais l'entrée mutée), ou `null`.
 */
function coerceSketch(res) {
  if (!res || typeof res !== 'object') return null;
  const candidate = hasDrawableSketch(res)
    ? res
    : (res.sketch && hasDrawableSketch(res.sketch) ? res.sketch : null);
  if (!candidate) return null;
  // Défense en profondeur : ne garder que les éléments GÉOMÉTRIQUEMENT valides
  // (edge boguée un jour / blob localStorage forgé à la main → jamais de crash renderer).
  const valid = candidate.elements.filter(isValidElement);
  if (valid.length === 0) return null; // plus rien de sûr → pas de croquis (fail-safe)
  const out = { elements: valid };
  const caption = txt(candidate.caption);
  if (caption) out.caption = caption;
  return out;
}

/**
 * Position d'insertion d'un croquis DANS les scènes d'un concept :
 * juste APRÈS la scène `amorce_croquis` (l'amorce « au tableau » précède le dessin) ;
 * à défaut d'amorce, en FIN de concept. Renvoie un index d'insertion (splice).
 * @param {Object[]} scenes
 * @returns {number}
 */
function croquisInsertIndex(scenes) {
  if (!Array.isArray(scenes)) return 0;
  const amorceIdx = scenes.findIndex((sc) => sc && sc.type === 'amorce_croquis');
  return amorceIdx >= 0 ? amorceIdx + 1 : scenes.length;
}

/**
 * ENRICHIT un `PrecepteurCourse` avec des scènes `croquis`, une (au plus) par concept.
 *
 * Pour CHAQUE concept `course.concepts[i]`, appelle `invokeEdge(seedsByConcept[i])`.
 * Le seed absent (ou l'index hors bornes) → concept ignoré (pas d'appel, pas de scène).
 * Si le résultat porte un `sketch.elements` NON VIDE, insère une scène
 * `{ type:'croquis', sketch, title?, narration? }` juste après l'`amorce_croquis`
 * du concept (sinon en fin). Sinon → RIEN (invariant sacré).
 *
 * IMMUTABLE : renvoie un nouvel objet `course` (concepts + scenes clonés en surface) ;
 * l'entrée n'est jamais mutée. TOLÉRANT : tout rejet/échec d'`invokeEdge` = pas de
 * croquis pour ce concept (jamais de throw propagé). Parallélise les appels
 * (`Promise.all` — le nombre de concepts est petit).
 *
 * @param {{ title?: string, concepts?: Array<{ title?: string, scenes?: Object[] }> }} course
 * @param {Array<{ chapterTitle?: string, centralIdea?: string, lessonText?: string }>} seedsByConcept
 * @param {(seed: Object) => Promise<{ caption?: string, elements: Array } | null>} invokeEdge
 * @returns {Promise<Object>} nouveau course enrichi
 */
export async function enrichCourseWithCroquis(course, seedsByConcept, invokeEdge) {
  const src = course || {};
  const concepts = Array.isArray(src.concepts) ? src.concepts : [];
  const seeds = Array.isArray(seedsByConcept) ? seedsByConcept : [];

  // Un appel edge par concept qui a un seed. En parallèle (peu de concepts).
  // Chaque appel est isolé : un rejet → null (jamais de scène croquis fabriquée).
  const sketches = await Promise.all(
    concepts.map(async (_concept, i) => {
      const seed = seeds[i];
      if (!seed || typeof seed !== 'object') return null;
      if (typeof invokeEdge !== 'function') return null;
      try {
        const res = await invokeEdge(seed);
        return coerceSketch(res); // { caption?, elements } NON VIDE, ou null
      } catch (_e) {
        return null; // échec réseau/edge → pas de croquis, on ne casse rien
      }
    }),
  );

  const nextConcepts = concepts.map((concept, i) => {
    const c = concept || {};
    const scenes = Array.isArray(c.scenes) ? c.scenes.slice() : [];
    const sketch = sketches[i];

    // INVARIANT SACRÉ : n'insère une scène croquis QUE si sketch.elements > 0.
    if (hasDrawableSketch(sketch)) {
      const conceptTitle = txt(c.title);
      const scene = {
        type: 'croquis',
        sketch, // { caption?, elements } — garanti non vide ici
        ...(conceptTitle ? { title: conceptTitle } : {}),
        // narration = la légende du croquis si présente (sert de texte « au tableau »).
        ...(sketch.caption ? { narration: sketch.caption } : {}),
      };
      scenes.splice(croquisInsertIndex(scenes), 0, scene);
    }

    return { ...c, scenes };
  });

  return { ...src, concepts: nextConcepts };
}

/**
 * CONSTRUIT les seeds `{ chapterTitle, centralIdea, lessonText }` par concept,
 * ALIGNÉS À L'ORDRE des concepts de `masterclassProjectToPrecepteurCourse(project)`.
 *
 * ── Alignement (critique) ───────────────────────────────────────────────────
 * `masterclassProjectToPrecepteurCourse` : choisit `project.pedagogy[]` sinon
 * `project.chapters[]` (via une logique `pickChapters`), transforme chaque chapitre
 * en scènes, puis ÉCARTE tout chapitre dont `scenes.length === 0`. Pour que
 * `seedsByConcept[i]` corresponde EXACTEMENT à `course.concepts[i]`, on doit :
 *   1. lire la MÊME source de chapitres (même priorité pedagogy > chapters), et
 *   2. n'émettre un seed QUE pour les chapitres qui produisent au moins une scène.
 * On applique donc le même prédicat de « chapitre exploitable » que la transform.
 *
 * ── Mapping des champs du seed (aligné sur le contrat de l'edge) ────────────
 *   chapterTitle <- chapter.title
 *   centralIdea  <- l'amorce/révélation du chapitre : thought_experiment d'abord
 *                   (c'est la « graine du croquis » côté chapitre, ce que porte la
 *                   scène amorce_croquis), sinon revelation_moment, sinon objective.
 *                   (`central_idea` n'existe QUE sur MasterclassBlock, jamais sur
 *                   MasterclassChapter — donc pas de source directe : on prend le
 *                   meilleur équivalent visuel « au tableau ».)
 *   lessonText   <- le texte enseigné : simple_lesson + deep_lesson concaténés,
 *                   repli knowledge_to_transmit. C'est ce que l'edge illustre.
 *
 * L'edge exige au moins UN des trois non vide ; un chapitre exploitable a toujours
 * un titre ou une leçon → seed valide.
 *
 * @param {import('../liri-masterclass/types').MasterclassProject|Object} project
 * @returns {Array<{ chapterTitle: string, centralIdea: string, lessonText: string }>}
 */
export function buildCroquisSeeds(project) {
  const chapters = pickChaptersLikeTransform(project);
  const seeds = [];
  for (let i = 0; i < chapters.length; i += 1) {
    const ch = chapters[i] || {};
    // Même filtre que la transform : un chapitre sans scène = pas de concept =>
    // pas de seed (sinon décalage d'index avec course.concepts).
    if (!chapterYieldsScene(ch)) continue;

    const chapterTitle = txt(ch.title);
    const centralIdea =
      txt(ch.thought_experiment) ||
      txt(ch.revelation_moment) ||
      txt(ch.objective);
    const simple = txt(ch.simple_lesson);
    const deep = txt(ch.deep_lesson);
    const lessonText =
      [simple, deep].filter(Boolean).join('\n\n') ||
      txt(ch.knowledge_to_transmit);

    seeds.push({ chapterTitle, centralIdea, lessonText });
  }
  return seeds;
}

/**
 * MIROIR de `pickChapters` de fromMasterclass.js (priorité pedagogy > chapters,
 * tableau nu accepté). Dupliqué ici pour garder l'injection de dépendance PURE
 * (pas d'import croisé) tout en restant aligné à la transform.
 */
function pickChaptersLikeTransform(project) {
  if (Array.isArray(project)) return project;
  const p = project || {};
  if (Array.isArray(p.pedagogy) && p.pedagogy.length > 0) return p.pedagogy;
  if (Array.isArray(p.chapters) && p.chapters.length > 0) return p.chapters;
  return [];
}

/**
 * Vrai si `chapterToScenes(ch)` (dans fromMasterclass.js) produirait au moins UNE
 * scène — c.-à-d. si le chapitre a au moins un des champs suivants (dans l'ordre
 * exact des émissions de scènes de la transform) :
 *   lecon         : simple_lesson | deep_lesson | knowledge_to_transmit
 *   amorce_croquis: thought_experiment
 *   atelier       : workshop.questions[0] | revelation_moment | main_revelation
 *   image_analogie: analogies[0].content | analogies[0] (string)
 *   transition    : transition_to_next
 * Ce prédicat est le SEUL garant de l'alignement d'index seed ↔ concept.
 */
function chapterYieldsScene(ch) {
  const c = ch || {};
  if (txt(c.simple_lesson) || txt(c.deep_lesson) || txt(c.knowledge_to_transmit)) return true;
  if (txt(c.thought_experiment)) return true;

  const ws = c.workshop || {};
  const firstQuestion = Array.isArray(ws.questions)
    ? ws.questions.map((q) => txt(q)).find((q) => q.length > 0)
    : '';
  if (firstQuestion || txt(c.revelation_moment) || txt(c.main_revelation)) return true;

  const a0 = Array.isArray(c.analogies) ? c.analogies[0] : null;
  const analogie = a0 == null ? '' : (typeof a0 === 'string' ? txt(a0) : txt(a0.content));
  if (analogie) return true;

  if (txt(c.transition_to_next)) return true;

  return false;
}

export default enrichCourseWithCroquis;
