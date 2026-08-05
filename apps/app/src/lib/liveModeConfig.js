/**
 * SOCLE « un moteur, N configs » — registre canonique des modes LIRI Live.
 *
 * LIRI Live = UN SEUL moteur (salle LiveKit + smartboard + chat + mains levées +
 * invitations + salle d'attente), décliné en MODES par simple CONFIG :
 *   • téléconsultation (MEDOS, santé)   • formation (École, cours)
 *   • culte en ligne (assemblée)        • débat (contradictoire)
 *   • conférence, masterclass, atelier, webinaire, démo commerciale…
 *
 * Ce qui DIFFÈRE d'un mode à l'autre = le VOCABULAIRE (praticien/formateur/officiant…,
 * patient/élève/fidèle…), le LAYOUT d'arène par défaut, les CAPACITÉS (qui parle, RGPD…)
 * et le BRANDING. Ce qui est COMMUN = les fonctionnalités transverses : écran de
 * connexion / salle d'attente, partage d'invitation, chat, mains levées, enregistrement.
 *
 * ⚠️ Les `id` canoniques = valeurs stockées en DB (contrainte CHECK
 * `live_sessions_session_type_check` : class, workshop, webinar, consultation, debate,
 * commercial, masterclass, conference). Le front utilise parfois des ALIAS historiques
 * ('classe'→'class', 'teleconsult'→'consultation', 'debat'→'debate') ; `normalizeLiveMode`
 * les ramène toujours à l'id canonique. `culte` N'EST PAS encore dans le CHECK → il est
 * déclaré ici mais `creatable:false` tant que la migration additive n'est pas passée.
 *
 * @see lib/liriArenaLayout.js (primitive de layout, importée ici — pas d'import inverse : zéro cycle)
 */

import { ARENA_LAYOUT } from '@/lib/liriArenaLayout';

/** Ids canoniques (= valeurs DB). */
export const LIVE_MODE = {
  FORMATION: 'class',
  CONSULTATION: 'consultation',
  CONFERENCE: 'conference',
  DEBAT: 'debate',
  CULTE: 'culte',
  MASTERCLASS: 'masterclass',
  ATELIER: 'workshop',
  WEBINAIRE: 'webinar',
  COMMERCIAL: 'commercial',
};

/** Alias front / historiques → id canonique DB. */
const MODE_ALIAS = {
  classe: 'class',
  formation: 'class',
  cours: 'class',
  teleconsult: 'consultation',
  teleconsultation: 'consultation',
  medos: 'consultation',
  debat: 'debate',
  conference_live: 'conference',
  worship: 'culte',
  culte_en_ligne: 'culte',
};

/**
 * Ramène n'importe quelle valeur (alias front, casse, DB) à un id canonique.
 * Fallback = 'class' (formation) — le mode le plus courant et le moins « spécial ».
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeLiveMode(raw) {
  const lc = String(raw || '').trim().toLowerCase();
  if (!lc) return LIVE_MODE.FORMATION;
  if (MODE_ALIAS[lc]) return MODE_ALIAS[lc];
  if (LIVE_MODES[lc]) return lc;
  return LIVE_MODE.FORMATION;
}

/**
 * Registre riche par id canonique.
 * @typedef {Object} LiveModeVocab
 * @property {string} host        - libellé de l'animateur (Formateur, Praticien, Officiant…)
 * @property {string} participant - libellé du participant (Élève, Patient, Fidèle…)
 * @property {string} guest       - libellé de l'invité externe (Invité, Proche…)
 * @property {string} room        - la salle (« la salle de cours », « la consultation »…)
 * @property {string} session     - la session (« le cours », « la consultation »…)
 * @property {string} join        - CTA d'entrée (« Rejoindre le cours »…)
 */
export const LIVE_MODES = {
  class: {
    id: 'class',
    label: 'Formation',
    shortLabel: 'Formation',
    category: 'formation',
    medical: false,
    creatable: true,
    arenaLayout: ARENA_LAYOUT.SMARTBOARD,
    epureAuto: true, // cours → mode épuré auto (smartboard dominant)
    vocab: {
      host: 'Formateur',
      participant: 'Élève',
      guest: 'Invité',
      room: 'la salle de cours',
      session: 'le cours',
      join: 'Rejoindre le cours',
    },
    invite: { perPerson: true, groupLink: true, consentRequired: false, defaultRole: 'viewer' },
    waiting: { greenRoom: true, countdown: true, agenda: true, branding: true, music: true },
  },
  consultation: {
    id: 'consultation',
    label: 'Téléconsultation',
    shortLabel: 'Téléconsult.',
    category: 'teleconsultation',
    medical: true,
    creatable: true, // via le mode MEDOS uniquement (gating côté wizard)
    cockpit: 'medos', // rendu par son propre cockpit clinique (ConsultationRoom), pas LiveHostPage
    arenaLayout: ARENA_LAYOUT.SMARTBOARD,
    epureAuto: false,
    vocab: {
      host: 'Praticien',
      participant: 'Patient',
      guest: 'Proche',
      room: 'la consultation',
      session: 'la consultation',
      join: 'Rejoindre la consultation',
    },
    invite: { perPerson: true, groupLink: true, consentRequired: true, defaultRole: 'participant' },
    waiting: { greenRoom: true, countdown: true, agenda: true, branding: true, music: true },
  },
  conference: {
    id: 'conference',
    label: 'Conférence',
    shortLabel: 'Conférence',
    category: 'conference',
    medical: false,
    creatable: true,
    arenaLayout: ARENA_LAYOUT.CONFERENCE,
    epureAuto: false,
    vocab: {
      host: 'Intervenant',
      participant: 'Participant',
      guest: 'Invité',
      room: 'la conférence',
      session: 'la conférence',
      join: 'Rejoindre la conférence',
    },
    invite: { perPerson: true, groupLink: true, consentRequired: false, defaultRole: 'viewer' },
    waiting: { greenRoom: true, countdown: true, agenda: true, branding: true, music: false },
  },
  debate: {
    id: 'debate',
    label: 'Débat',
    shortLabel: 'Débat',
    category: 'debate',
    medical: false,
    creatable: true,
    arenaLayout: ARENA_LAYOUT.PANEL, // mode Panel (débatteurs) + bannière/modérateur/vote
    epureAuto: false,
    vocab: {
      host: 'Modérateur',
      participant: 'Intervenant',
      guest: 'Invité',
      room: 'le débat',
      session: 'le débat',
      join: 'Rejoindre le débat',
    },
    invite: { perPerson: true, groupLink: true, consentRequired: false, defaultRole: 'viewer' },
    waiting: { greenRoom: true, countdown: true, agenda: true, branding: true, music: false },
  },
  culte: {
    id: 'culte',
    label: 'Culte en ligne',
    shortLabel: 'Culte',
    category: 'culte',
    medical: false,
    creatable: true, // migration additive du CHECK session_type passée (2026-08-05)
    arenaLayout: ARENA_LAYOUT.HOST_CAMERA, // officiant à l'antenne, assemblée en écoute
    epureAuto: false,
    vocab: {
      host: 'Officiant',
      participant: 'Fidèle',
      guest: 'Invité',
      room: "l'assemblée",
      session: 'le culte',
      join: "Rejoindre l'assemblée",
    },
    invite: { perPerson: false, groupLink: true, consentRequired: false, defaultRole: 'viewer' },
    waiting: { greenRoom: false, countdown: true, agenda: true, branding: true, music: true },
  },
  masterclass: {
    id: 'masterclass',
    label: 'Masterclass',
    shortLabel: 'Masterclass',
    category: 'formation',
    medical: false,
    creatable: true,
    arenaLayout: ARENA_LAYOUT.SMARTBOARD,
    epureAuto: true,
    vocab: {
      host: 'Maître',
      participant: 'Participant',
      guest: 'Invité',
      room: 'la masterclass',
      session: 'la masterclass',
      join: 'Rejoindre la masterclass',
    },
    invite: { perPerson: true, groupLink: true, consentRequired: false, defaultRole: 'viewer' },
    waiting: { greenRoom: true, countdown: true, agenda: true, branding: true, music: true },
  },
  workshop: {
    id: 'workshop',
    label: 'Atelier',
    shortLabel: 'Atelier',
    category: 'formation',
    medical: false,
    creatable: true,
    arenaLayout: ARENA_LAYOUT.SMARTBOARD,
    epureAuto: true,
    vocab: {
      host: 'Animateur',
      participant: 'Participant',
      guest: 'Invité',
      room: "l'atelier",
      session: "l'atelier",
      join: "Rejoindre l'atelier",
    },
    invite: { perPerson: true, groupLink: true, consentRequired: false, defaultRole: 'viewer' },
    waiting: { greenRoom: true, countdown: true, agenda: true, branding: true, music: false },
  },
  webinar: {
    id: 'webinar',
    label: 'Webinaire',
    shortLabel: 'Webinaire',
    category: 'conference',
    medical: false,
    creatable: true,
    arenaLayout: ARENA_LAYOUT.CONFERENCE,
    epureAuto: false,
    vocab: {
      host: 'Intervenant',
      participant: 'Participant',
      guest: 'Invité',
      room: 'le webinaire',
      session: 'le webinaire',
      join: 'Rejoindre le webinaire',
    },
    invite: { perPerson: true, groupLink: true, consentRequired: false, defaultRole: 'viewer' },
    waiting: { greenRoom: false, countdown: true, agenda: true, branding: true, music: false },
  },
  commercial: {
    id: 'commercial',
    label: 'Démo commerciale',
    shortLabel: 'Démo',
    category: 'commercial',
    medical: false,
    creatable: true,
    arenaLayout: ARENA_LAYOUT.HOST_CAMERA,
    epureAuto: false,
    vocab: {
      host: 'Présentateur',
      participant: 'Prospect',
      guest: 'Invité',
      room: 'la démo',
      session: 'la démo',
      join: 'Rejoindre la démo',
    },
    invite: { perPerson: true, groupLink: true, consentRequired: false, defaultRole: 'viewer' },
    waiting: { greenRoom: true, countdown: true, agenda: true, branding: true, music: false },
  },
};

/**
 * Libellés à plat (ids canoniques + alias souples) — source unique pour toutes les
 * surfaces qui affichaient auparavant leur propre dico ('Cours / classe',
 * 'Classe virtuelle', 'Formation'…). Inclut 'entretien' (RDV 1:1 non médical), qui
 * n'est pas un session_type live valide mais reste affiché côté agenda.
 */
const MODE_LABELS = {
  class: 'Formation',
  classe: 'Formation',
  formation: 'Formation',
  cours: 'Formation',
  consultation: 'Téléconsultation',
  teleconsult: 'Téléconsultation',
  teleconsultation: 'Téléconsultation',
  conference: 'Conférence',
  conference_live: 'Conférence',
  debate: 'Débat',
  debat: 'Débat',
  culte: 'Culte en ligne',
  worship: 'Culte en ligne',
  masterclass: 'Masterclass',
  workshop: 'Atelier',
  webinar: 'Webinaire',
  commercial: 'Démo commerciale',
  entretien: 'Entretien',
};

/**
 * Config complète d'un mode (fallback = formation). Toujours sûr à déréférencer.
 * @param {unknown} raw
 * @returns {typeof LIVE_MODES[keyof typeof LIVE_MODES]}
 */
export function getLiveModeConfig(raw) {
  return LIVE_MODES[normalizeLiveMode(raw)] || LIVE_MODES.class;
}

/**
 * Libellé humain d'un mode/type de session. Remplace les dicos SESSION_TYPES dispersés.
 * @param {unknown} raw
 * @returns {string}
 */
export function labelForLiveMode(raw) {
  const lc = String(raw || '').trim().toLowerCase();
  return MODE_LABELS[lc] || (raw ? String(raw) : 'Live');
}

/**
 * Vocabulaire du mode (host/participant/guest/room/session/join).
 * @param {unknown} raw
 * @returns {LiveModeVocab}
 */
export function vocabForLiveMode(raw) {
  return getLiveModeConfig(raw).vocab;
}

/**
 * Layout d'arène par défaut du mode.
 * @param {unknown} raw
 * @returns {string}
 */
export function arenaLayoutForLiveMode(raw) {
  return getLiveModeConfig(raw).arenaLayout;
}

/** @param {unknown} raw @returns {boolean} — mode médical (MEDOS) ? */
export function isMedicalLiveMode(raw) {
  return !!getLiveModeConfig(raw).medical;
}

/** @param {unknown} raw @returns {typeof LIVE_MODES['class']['invite']} — capacités d'invitation. */
export function liveModeInviteCaps(raw) {
  return getLiveModeConfig(raw).invite;
}

/** @param {unknown} raw @returns {typeof LIVE_MODES['class']['waiting']} — config salle d'attente. */
export function liveModeWaitingConfig(raw) {
  return getLiveModeConfig(raw).waiting;
}

/** Modes proposables à la création (hors médical, géré à part par le mode MEDOS). */
export const CREATABLE_LIVE_MODES = Object.values(LIVE_MODES).filter(
  (m) => m.creatable && !m.medical,
);
