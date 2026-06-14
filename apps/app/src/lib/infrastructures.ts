import type { InfrastructureType } from './api';

export const INFRASTRUCTURES: Array<{
  type: InfrastructureType;
  name: string;
  description: string;
  status: string;
  engines: string[];
}> = [
  {
    type: 'school',
    name: 'Ecole / ISNA',
    description: 'Formations, lives payants, replay, calendrier et marketing.',
    status: 'MVP pret',
    // Aligné sur le manifeste canonique backend (school-engine-manifest.ts : 11 moteurs
    // core + recommended ; Masterclass = addon non activé par défaut).
    // Source de vérité = GET /catalog/templates ; cette liste statique n'est qu'un aperçu.
    engines: [
      'SmartBoard', 'LIRI Live', 'Replay', 'Course Builder', 'Calendrier', 'Marketing',
      'Studio Créateur', 'Neuro Recall', 'Paiements', 'Chat', 'Notifications',
    ],
  },
  {
    type: 'medos',
    name: 'MedOS',
    description: 'Dossiers patients, notes, prescriptions et programmes de soin.',
    status: 'Prototype',
    engines: ['EHR', 'Notes SOAP', 'Prescriptions', 'Forms', 'Health tracking', 'Care programs', 'Charting IA', 'RGPD'],
  },
  {
    type: 'mbolo',
    name: 'Mbolo / VirtuelMbolo',
    description: 'Catalogue, panier, commandes, paiements locaux et back-office boutique.',
    status: 'A construire',
    engines: ['Pay Engine', 'CinetPay', 'SMS', 'WhatsApp', 'Notifications', 'Catalogue', 'Panier', 'Commandes', 'Stock', 'Storefront', 'Admin'],
  },
  {
    type: 'wellness',
    name: 'Wellness',
    description: 'Coaching, suivi sante, programmes, chat et communaute.',
    status: 'Beta',
    engines: ['Care programs', 'Health tracking', 'Calendrier', 'Chat', 'Forum'],
  },
  {
    type: 'creator',
    name: 'Creator',
    description: 'Studio, live, replay, paiement et marketing createur.',
    status: 'Beta',
    engines: ['Studio Creator', 'LIRI Live', 'Replay', 'Pay Engine', 'Marketing'],
  },
  {
    type: 'temple',
    name: 'Temple',
    description: 'Lives, calendrier, forum, paiement et chat communautaire.',
    status: 'Plus tard',
    engines: ['LIRI Live', 'Calendrier', 'Forum', 'Pay Engine', 'Chat'],
  },
  {
    type: 'community',
    name: 'Communaute',
    description: 'Forum, chat, evenements, paiement et notifications.',
    status: 'Plus tard',
    engines: ['Forum', 'Chat', 'Calendrier', 'Pay Engine', 'Notifications'],
  },
];

export function formatServiceKey(key: string) {
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
