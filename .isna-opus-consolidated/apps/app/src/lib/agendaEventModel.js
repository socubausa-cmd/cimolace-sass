/** Libellés et règles métier — agenda enseignant / cycle de vie événement */

export const APPOINTMENT_TYPE_LABELS = {
  entretien: 'Entretien / consultation',
  coaching: 'Coaching',
  conseil: 'Conseil',
  classe: 'Cours',
  conference: 'Conférence',
};

export const SESSION_TYPE_LABELS = {
  entretien: 'Entretien',
  classe: 'Cours / classe',
  conference: 'Conférence',
};

export function labelForAppointmentType(type) {
  return APPOINTMENT_TYPE_LABELS[String(type || '').toLowerCase()] || type || 'Rendez-vous';
}

export function labelForSessionType(st) {
  return SESSION_TYPE_LABELS[String(st || '').toLowerCase()] || st || 'Live';
}

/** Types de RDV pour lesquels une préparation studio est recommandée (live riche). */
export function appointmentNeedsStudioPrep(appointmentType) {
  const t = String(appointmentType || '').toLowerCase();
  return ['coaching', 'classe', 'conference'].includes(t);
}

export function mapAppointmentTypeToLiveSessionType(appointmentType) {
  const t = String(appointmentType || '').toLowerCase();
  if (t === 'conference') return 'conference';
  if (t === 'coaching' || t === 'classe') return 'classe';
  return 'entretien';
}

export function preparationStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'ready') return 'Studio prêt ✓';
  if (s === 'live' || s === 'archived') return 'Terminé / live';
  if (s === 'draft') return 'Non préparé';
  return s ? `Préparation : ${s}` : '—';
}

export function studioPreparationPath({ source, id, live_session_id: linked }) {
  if (source === 'live_sessions') return `/studio/live-preparation/${id}`;
  if (source === 'appointments' && linked) return `/studio/live-preparation/${linked}`;
  return null;
}
