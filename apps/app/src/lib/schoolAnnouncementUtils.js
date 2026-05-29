/** Filtre affichage annonces vie scolaire selon le profil connecté. */
export function announcementVisibleForViewer(ann, user) {
  const aud = String(ann?.audience || 'students_all');
  if (!user?.id) return aud === 'everyone';
  const r = String(user.role || '').toLowerCase();
  const isStudent = r === 'student';
  const isStaff = ['teacher', 'secretariat', 'admin', 'owner', 'creator'].includes(r);
  if (aud === 'everyone') return true;
  if (aud === 'teachers_staff') return isStaff;
  if (aud === 'students_all' || aud.startsWith('cycle_') || aud.startsWith('year_')) {
    return isStudent || isStaff;
  }
  return false;
}

export function audienceToTargetRole(audience) {
  const aud = String(audience || 'students_all');
  if (aud === 'everyone') return 'all';
  if (aud === 'teachers_staff') return 'teacher';
  return 'student';
}

export function categoryToPriority(category) {
  const c = String(category || 'info').toLowerCase();
  if (c === 'alert') return 'urgent';
  return 'normal';
}

export function cleanExtrasJson(raw) {
  const o = raw && typeof raw === 'object' ? { ...raw } : {};
  const keys = ['link_url', 'phone', 'product_id', 'module_id', 'image_url'];
  const out = {};
  keys.forEach((k) => {
    const v = o[k];
    if (v != null && String(v).trim() !== '') out[k] = String(v).trim();
  });
  return out;
}
