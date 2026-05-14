/**
 * Données de démonstration pour l’UI hôte LIRI (slides vides, preview constructeur).
 * Activer explicitement : VITE_LIRI_UI_MOCK=true
 * En dev, si l’hôte n’a aucune scène : affichage des mocks pour prévisualiser l’interface.
 */

import { normalizeLiveSceneToSlide } from '@/lib/liveSceneNormalize';

export function shouldMergeLiriHostMocks(isHost, slidesLength) {
  if (!isHost) return false;
  if (import.meta.env.VITE_LIRI_UI_MOCK === 'true') return true;
  if (import.meta.env.DEV && slidesLength === 0) return true;
  return false;
}

/** Scènes factices (format live_scenes / brouillon) */
export const LIRI_MOCK_SCENES_RAW = [
  {
    id: 'mock-intro',
    name: 'Introduction · Vision du cours',
    order_index: 0,
    content_payload_json: {
      elements: [
        { id: 'b1', type: 'badge', content: 'Module 1 · Fondations', x: 48, y: 38, width: 220, height: 28, zIndex: 2 },
        { id: 't1', type: 'title', content: 'Les principes clés', x: 48, y: 82, width: 840, height: 100, zIndex: 3, animation: 'fade-up' },
        { id: 'p1', type: 'paragraph', content: 'Une progression claire : du concept à la pratique, avec des repères visuels et des transitions maîtrisées.', x: 48, y: 200, width: 700, height: 100, zIndex: 2 },
        { id: 'q1', type: 'quote', content: '« La pédagogie premium, c’est la clarté + l’émotion. »', x: 48, y: 340, width: 720, height: 64, zIndex: 2, animation: 'spotlight' },
      ],
    },
  },
  {
    id: 'mock-plan',
    name: 'Plan pédagogique',
    order_index: 1,
    content_payload_json: {
      elements: [
        { id: 'b2', type: 'badge', content: 'Infographie', x: 48, y: 40, width: 160, height: 28, zIndex: 2 },
        { id: 't2', type: 'title', content: 'Les 4 temps', x: 48, y: 88, width: 780, height: 96, zIndex: 3 },
        { id: 'p2', type: 'paragraph', content: '1) Ancrage · 2) Démonstration · 3) Exercice guidé · 4) Synthèse & Q/R', x: 48, y: 210, width: 680, height: 120, zIndex: 2 },
      ],
    },
  },
  {
    id: 'mock-deep',
    name: 'Approfondissement',
    order_index: 2,
    content_payload_json: {
      elements: [
        { id: 't3', type: 'title', content: 'Cas pratique', x: 48, y: 90, width: 760, height: 88, zIndex: 3 },
        { id: 'p3', type: 'paragraph', content: 'Exemple concret issu du terrain : étapes, pièges à éviter, indicateurs de réussite.', x: 48, y: 200, width: 720, height: 140, zIndex: 2 },
      ],
    },
  },
  {
    id: 'mock-out',
    name: 'Synthèse & suite',
    order_index: 3,
    content_payload_json: {
      elements: [
        { id: 't4', type: 'title', content: 'Prochaines étapes', x: 48, y: 88, width: 800, height: 96, zIndex: 3 },
        { id: 'p4', type: 'paragraph', content: 'Ressources, devoirs, rendez-vous de suivi — tout est dans l’espace cours.', x: 48, y: 210, width: 700, height: 100, zIndex: 2 },
        { id: 'q4', type: 'quote', content: 'Rappel : une idée maîtrisée vaut mieux que dix survolées.', x: 48, y: 340, width: 700, height: 72, zIndex: 2, animation: 'spotlight' },
      ],
    },
  },
];

export function getMockSlidesNormalized() {
  return LIRI_MOCK_SCENES_RAW.map(normalizeLiveSceneToSlide).filter(Boolean);
}

/** Participants fictifs (fusionnés avec LiveKit, sans doublon d’id) */
export const LIRI_MOCK_PARTICIPANTS = [
  { id: 'mock-participant-1', name: 'Aminata K.', isLocal: false, isHost: false, avatar_url: 'https://i.pravatar.cc/128?img=47', liveJoinedAtMs: Date.now() - 55 * 60 * 1000, locationLabel: 'Paris, France' },
  { id: 'mock-participant-2', name: 'Thomas R.', isLocal: false, isHost: false, avatar_url: 'https://i.pravatar.cc/128?img=12', liveJoinedAtMs: Date.now() - 12 * 60 * 1000, locationLabel: 'Lyon, France' },
  { id: 'mock-participant-3', name: 'Léa M.', isLocal: false, isHost: false, avatar_url: 'https://i.pravatar.cc/128?img=32', liveJoinedAtMs: Date.now() - 3 * 60 * 1000, locationLabel: null },
  { id: 'mock-participant-4', name: 'Yassine B.', isLocal: false, isHost: false, avatar_url: 'https://i.pravatar.cc/128?img=59', liveJoinedAtMs: Date.now() - 120 * 60 * 1000, locationLabel: 'Bruxelles, Belgique' },
];

export const LIRI_MOCK_SCRIPT_SECTIONS = [
  { id: 'ms1', slide_index: 0, title: 'Accroche & intention', content: '【Objectif】\nPoser le cadre et l’objectif mesurable de la séance.\n\n【Rétention】\nUne phrase d’intention claire dès les 2 premières minutes.', script: 'Poser le cadre et l’objectif mesurable de la séance.', objective: 'Poser le cadre et l’objectif mesurable de la séance.', retention: 'Une phrase d’intention claire dès les 2 premières minutes.' },
  { id: 'ms2', slide_index: 1, title: 'Corps · démonstration', content: '【Objectif】\nMontrer la méthode pas à pas avec un exemple visuel.', script: 'Montrer la méthode pas à pas avec un exemple visuel.', objective: 'Montrer la méthode pas à pas avec un exemple visuel.', memorization_tip: 'Répéter la structure en 3 temps : voir → faire → nommer.' },
  { id: 'ms3', slide_index: 2, title: 'Interaction', content: '【Objectif】\nVérifier la compréhension (Neuron-Q, mains levées).', script: 'Vérifier la compréhension.', objective: 'Vérifier la compréhension (Neuron-Q, mains levées).', retention: 'Une question ouverte avant chaque transition majeure.' },
  { id: 'ms4', slide_index: 3, title: 'Clôture', content: '【Objectif】\nSynthèse + appel à l’action pour la suite du parcours.', script: 'Synthèse + appel à l’action.', objective: 'Synthèse + appel à l’action pour la suite du parcours.', retention: 'Toujours terminer par « ce que vous retenez » + prochaine étape.' },
];

export const LIRI_MOCK_RAISED_HANDS = [
  { userId: 'mock-hand-1', name: 'Aminata K.', at: Date.now() - 120000 },
];

export function mergeParticipantsWithMocks(participants, enabled) {
  if (!enabled) return participants;
  const ids = new Set((participants || []).map((p) => p.id));
  const extra = LIRI_MOCK_PARTICIPANTS.filter((p) => !ids.has(p.id));
  return [...(participants || []), ...extra];
}

export function mergeRaisedHandsWithMocks(hands, enabled) {
  if (!enabled) return hands;
  if ((hands || []).length > 0) return hands;
  return [...LIRI_MOCK_RAISED_HANDS];
}
