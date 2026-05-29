/** Chemins du forum « tableau de bord » par espace (hors page legacy `/formation/:id/forum`). */

export const FORUM_COMMUNITY_PATH = {
  student: '/student-school-life/forum',
  teacher: '/teacher-space/forum',
  secretariat: '/secretariat-space/forum',
};

/**
 * URL de la liste forum (index) selon le rôle effectif.
 */
export function forumCommunityUrlForRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'teacher') return FORUM_COMMUNITY_PATH.teacher;
  if (r === 'secretariat') return FORUM_COMMUNITY_PATH.secretariat;
  if (r === 'owner' || r === 'admin') return '/owner-dashboard?tab=forum';
  return FORUM_COMMUNITY_PATH.student;
}

/**
 * URL du forum d'une formation (avec lien optionnel vers une question).
 */
export function formationForumUrlForRole(role, formationId, questionId) {
  if (!formationId) return forumCommunityUrlForRole(role);
  const r = String(role || '').toLowerCase();
  const qid = questionId ? String(questionId).trim() : '';
  const q = qid ? `?questionId=${encodeURIComponent(qid)}` : '';

  if (r === 'teacher') return `${FORUM_COMMUNITY_PATH.teacher}/formation/${formationId}${q}`;
  if (r === 'secretariat') return `${FORUM_COMMUNITY_PATH.secretariat}/formation/${formationId}${q}`;
  if (r === 'owner' || r === 'admin') {
    const p = new URLSearchParams();
    p.set('tab', 'forum');
    p.set('formationId', formationId);
    if (qid) p.set('questionId', qid);
    return `/owner-dashboard?${p.toString()}`;
  }
  return `${FORUM_COMMUNITY_PATH.student}/formation/${formationId}${q}`;
}

/** @deprecated — utiliser formationForumUrlForRole('student', formationId) */
export function studentFormationForumPath(formationId) {
  return formationForumUrlForRole('student', formationId);
}
