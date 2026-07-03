import { supabase } from '@/lib/customSupabaseClient';

/**
 * Prise de notes élève MULTI-SOURCE (table `formation_student_notes` généralisée).
 * Une note est rattachée à sa SOURCE : un cours, un live (replay) ou un cours Précepteur.
 * Le hub « Mes notes » les liste (filtre par source + lien vers l'origine).
 *
 * source_type : 'course' | 'live' | 'precepteur'
 * source_id   : identifiant de la source (formation_id / live_session_id / course id précepteur)
 * source_ref  : sous-localisateur optionnel (jour, chapitre…) — '' par défaut
 * source_title: titre dénormalisé (affichage hub sans jointure)
 *
 * NB : upsert par (student, source_type, source_id, source_ref) via un SELECT→UPDATE/INSERT
 * (l'index unique est PARTIEL WHERE source_type<>'course', non exploitable par onConflict côté
 * client). Pour les COURS, le lecteur garde son upsert d'origine — voir CoursePlayerInterface.
 */

export const NOTE_SOURCES = {
  course: { key: 'course', label: 'Cours' },
  live: { key: 'live', label: 'Live' },
  precepteur: { key: 'precepteur', label: 'Précepteur' },
};

const SELECT_COLS =
  'id,content,source_type,source_id,source_title,source_ref,formation_id,day_id,video_id,updated_at,created_at';

/** Liste TOUTES les notes de l'élève (toutes sources), les plus récentes d'abord. */
export async function listStudentNotes(studentId) {
  if (!studentId) return [];
  const { data, error } = await supabase
    .from('formation_student_notes')
    .select(SELECT_COLS)
    .eq('student_id', studentId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  // Ne garde que les notes avec du contenu réel (une note vide = pas une note).
  return (data || []).filter((n) => (n.content || '').trim().length > 0);
}

/** Charge la note (non-cours) d'une source donnée pour l'élève, ou null. */
export async function loadSourceNote({ studentId, sourceType, sourceId, sourceRef = '' }) {
  if (!studentId || !sourceType || !sourceId) return null;
  const { data, error } = await supabase
    .from('formation_student_notes')
    .select(SELECT_COLS)
    .eq('student_id', studentId)
    .eq('source_type', sourceType)
    .eq('source_id', String(sourceId))
    .eq('source_ref', sourceRef || '')
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Enregistre (upsert « manuel ») la note d'une source NON-cours.
 * Renvoie la ligne enregistrée. Contenu vide → supprime la note existante.
 */
export async function saveSourceNote({ studentId, sourceType, sourceId, sourceRef = '', sourceTitle = null, content }) {
  if (!studentId || !sourceType || !sourceId) throw new Error('saveSourceNote: source incomplète');
  const existing = await loadSourceNote({ studentId, sourceType, sourceId, sourceRef });
  const trimmed = (content || '').trim();

  if (!trimmed) {
    if (existing?.id) {
      await supabase.from('formation_student_notes').delete().eq('id', existing.id);
    }
    return null;
  }

  const now = new Date().toISOString();
  if (existing?.id) {
    const { data, error } = await supabase
      .from('formation_student_notes')
      .update({ content: trimmed, source_title: sourceTitle ?? existing.source_title, updated_at: now })
      .eq('id', existing.id)
      .select(SELECT_COLS)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('formation_student_notes')
    .insert({
      student_id: studentId,
      source_type: sourceType,
      source_id: String(sourceId),
      source_ref: sourceRef || '',
      source_title: sourceTitle,
      content: trimmed,
      // Colonnes « cours » laissées vides (nullable pour live/précepteur) sauf video_id (défaut '')
      video_id: '',
      updated_at: now,
    })
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Route de l'origine d'une note selon sa source (pour « ouvrir le live/cours »). */
export function noteSourceLink(note) {
  if (!note) return null;
  const id = note.source_id;
  switch (note.source_type) {
    case 'live':
      return id ? `/liri/forum/replay/${id}` : null;
    case 'precepteur':
      return id ? `/liri/precepteur/cours/${id}` : null;
    case 'course':
    default:
      return id ? `/student-school-life/cours/${id}` : null;
  }
}
