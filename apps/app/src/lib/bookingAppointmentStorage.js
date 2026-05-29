const KEY = 'isna_visitor_appointment_v1';

/** Sauvegarde locale du dernier RDV visiteur (complète l'API si hors-ligne). */
export function saveVisitorAppointmentSnapshot(payload) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ...payload,
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    /* ignore */
  }
}

export function loadVisitorAppointmentSnapshot() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearVisitorAppointmentSnapshot() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
