/**
 * Couches de communication live (matrice produit).
 * Aparté A/V : WebRTC + signalisation Realtime ; préécoute : lecteur audio local (hors LiveKit).
 */

export const LIVE_COMM_LAYER = {
  PUBLIC_FORUM: 'public_forum',
  PRIVATE_DM: 'private_dm',
  HOST_LONGIA: 'host_longia',
  STUDENT_LONGIA: 'student_longia',
  ASIDE_AUDIO: 'aside_audio',
  ASIDE_AV: 'aside_av',
  HEADPHONE_MONITOR: 'headphone_monitor',
};

// Clés littérales (= valeurs de LIVE_COMM_LAYER) — évite les clés calculées `[...]`
// qui peuvent créer un TDZ en production (Rollup/Vite tree-shaking).
/** Bandeau hôte (plateau + messagerie) : minimum de cartes affichées, le reste en emplacements vides « Panel disponible ». */
export const LIVE_STRIP_DOCK_MIN_MEMBER_SLOTS = 10;

/** Cartes membre (dock horizontal plateau + colonne messagerie) : même inclinaison / zoom que le bandeau central. */
export const LIVE_MEMBER_PANEL_TILT_DEG = 9;
export const LIVE_MEMBER_PANEL_TILT_HOVER_SCALE = 1.08;

export const LIVE_COMM_COPY = {
  public_forum: 'Forum public — visible par les inscrits à la séance',
  private_dm: 'Aparté texte — formateur et ce membre uniquement (persistant)',
  host_longia: 'Coach LONGIA — canal privé formateur (contexte déroulé, salle)',
  student_longia: 'Coach LONGIA — canal privé élève (progression, parcours)',
  aside_audio: 'Aparté audio — WebRTC privé (micro hors flux salle)',
  aside_av: 'Aparté audio + vidéo — WebRTC privé (hors flux salle)',
  headphone_monitor: 'Préécoute casque — mix privé hôte (hors flux public)',
};
