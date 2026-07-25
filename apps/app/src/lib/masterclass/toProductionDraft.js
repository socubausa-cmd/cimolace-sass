/**
 * MasterclassProject (Factory) → draft du POSTE PRODUCTION — cours MAGISTRAL.
 *
 * Le pont existant « Publier en classe » passe par le format Précepteur
 * (`concepts[].scenes[]`) : une performance narrative. Un cours reconstruit depuis un
 * replay doit au contraire conserver la STRUCTURE PÉDAGOGIQUE DU MASTERSCRIPT :
 * chapitres × 21 segments LIRI, slides et script du professeur.
 *
 * Mapping : 1 chapitre = 1 jour de production ; les segments renseignés deviennent le
 * support du jour (une slide par segment) ; le script oral est joint en notes du
 * professeur. Les jours sont groupés en semaines de 4.
 *
 * @param {Object} project  MasterclassProject (pedagogy[] prioritaire, chapters[] en repli)
 * @param {{title?:string, description?:string, level?:string, category?:string, status?:string}} [opts]
 * @returns {{title, description, status, category, level, modules:Array}} draft pour usePublishToClassroom
 */

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const toHtml = (txt) =>
  String(txt || '')
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('');

/** Segments d'un chapitre → slides de support (une slide par segment renseigné). */
function chapterToSlides(ch) {
  const segs = Array.isArray(ch?.segments) ? ch.segments : [];
  const slides = segs
    .filter((s) => String(s?.content || '').trim())
    .map((s) => ({
      title: s.title || `Segment ${s.segment_id ?? ''}`.trim(),
      content: toHtml(s.content),
    }));
  // Chapitre sans segments exploitables : au moins l'objectif, pour ne pas produire un jour vide.
  if (!slides.length && (ch?.objective || ch?.content)) {
    slides.push({ title: ch.title || 'Leçon', content: toHtml(ch.objective || ch.content) });
  }
  return slides;
}

/** Scripts oraux du chapitre → une slide « Notes du professeur » en fin de support. */
function chapterToTeacherNotes(ch) {
  const segs = Array.isArray(ch?.segments) ? ch.segments : [];
  const lines = segs.map((s) => String(s?.oral_script || '').trim()).filter(Boolean);
  if (!lines.length) return null;
  return { title: 'Notes du professeur — script oral', content: toHtml(lines.join('\n\n')) };
}

export function masterclassProjectToProductionDraft(project, opts = {}) {
  const p = project || {};
  const chapters = (Array.isArray(p.pedagogy) && p.pedagogy.length ? p.pedagogy
    : Array.isArray(p.chapters) ? p.chapters : []);

  const days = chapters
    .map((ch, i) => {
      const slides = chapterToSlides(ch);
      if (!slides.length) return null;
      const notes = chapterToTeacherNotes(ch);
      if (notes) slides.push(notes);
      return {
        title: ch.title || `Chapitre ${i + 1}`,
        powerpoint: { type: 'slides', title: ch.title || `Chapitre ${i + 1}`, slides },
      };
    })
    .filter(Boolean);

  const weeks = [];
  for (let i = 0; i < days.length; i += 4) {
    weeks.push({ title: `Semaine ${weeks.length + 1}`, days: days.slice(i, i + 4) });
  }

  const title = opts.title
    || p.analysis?.global_subject
    || p.analysis?.title
    || chapters[0]?.title
    || 'Cours magistral';

  return {
    title: String(title).slice(0, 200),
    description: opts.description || p.analysis?.summary || p.analysis?.global_subject || '',
    status: opts.status || 'draft',      // le créateur publie depuis le poste production
    category: opts.category || undefined,
    level: opts.level || p.analysis?.level || undefined,
    modules: [{ title: 'Programme', weeks: weeks.length ? weeks : [{ title: 'Semaine 1', days: [] }] }],
  };
}

export default masterclassProjectToProductionDraft;
