/**
 * cimolaceKnowledge — MÉMOIRE CENTRALISÉE de Cimolace (realm `cimolace`), au schéma EXACT de
 * PRORASCIENCE_KNOWLEDGE, pour donner au realm OS Cimolace un rendu VNP data-driven (comme
 * prorascience) au lieu du seul tunnel de création. Agrégé FIDÈLEMENT depuis le contenu réel
 * (vitrine apps/public-site, homepage OS immersive, pages produits MedOS/moteurs, grille SaaS).
 *
 * ⚠️ DÉCISIONS PRODUIT EN ATTENTE (le contenu réel de Cimolace se contredit — à trancher par le
 * fondateur avant de figer / brancher le VNP) :
 *   - POSITIONNEMENT : la vitrine cimolace.space dit « L'OS qui crée des plateformes SaaS » (40+
 *     moteurs, dès 19 €/mois) ; la homepage OS dit « Infrastructure intelligente pour l'Afrique »
 *     (30+ moteurs, dès 150 €/mois). Ce pack retient la baseline vitrine pour `subtitle`.
 *   - PRIX : deux modèles coexistent — (a) grille SaaS interne 500 € setup + START 150 / BUSINESS
 *     200 / ENTREPRISE 300 (retenue ici, consigne) ; (b) vitrine « dès 19 €/mois » + paliers par
 *     infra (MedOS 0/19/49/99, École 79/199/349) + crédits IA LIRI. À unifier.
 *   - PRIX PAS EN DB : le tenant `cimolace` a 0 billing_plan (grille code-only, pas de stripe_price_id) →
 *     non payable en l'état. Prérequis avant de rendre les forfaits « achetables » comme prorascience.
 *   - RAILS PAIEMENT : vitrine « Stripe · CinetPay · MTN · Orange Money · Chariow » vs mémoire
 *     globale « PawaPay + Airtel (XAF/XOF) ». À réconcilier.
 * Voir le workflow `cimolace-knowledge-pack` (whygqajyf) pour les 31 « missing » détaillés.
 */

export const CIMOLACE_KNOWLEDGE = {
  identity: {
    slug: 'cimolace',
    name: 'Cimolace',
    fullName: 'Cimolace — ISNA Platform',
    subtitle: "L'OS qui crée des plateformes SaaS — votre plateforme, vos règles, zéro code.",
    website: 'cimolace.space',
    stats: [
      { label: 'OS métier prêts', value: '7' },
      { label: 'moteurs IA', value: '30+' },
      { label: 'stack unifiée', value: '1' },
    ],
  },

  founder: {
    name: 'Ngowazulu',
    title: 'Fondateur de Cimolace',
    bio: "Fondateur de Cimolace et de l'écosystème ISNA / Prorascience. Cimolace est né d'une frustration d'entrepreneur africain : « J'avais une boutique, une formation, une communauté. Mais 80 % de mon temps partait à gérer des outils qui ne se parlaient pas. » Le problème n'était pas les outils, mais l'absence d'un système conçu pour l'Afrique.",
  },

  vision: {
    whatIs: "Cimolace est une infrastructure SaaS multi-tenant qui fait tourner les produits de ses clients en coulisses — comme Stripe pour le paiement ou Zoom pour la vidéo. Le client garde sa marque, son domaine et ses données ; Cimolace reste invisible.",
    problem: "Les entrepreneurs assemblent des outils qui ne se parlent pas : Stripe + Zoom/LiveKit + email transactionnel + LMS + CRM, sans isolation multi-tenant, et des mois d'intégration. En Afrique, le talent existe mais pas l'infrastructure.",
    promise: "Lancer sa propre plateforme brandée, sans coder, en ~10 minutes — puis 1 à 2 heures pour brancher branding, paiements et premier produit.",
    closing: "L'Afrique ne doit pas rattraper la technologie : elle peut sauter une étape. Choisissez vos OS, activez, encaissez — l'infrastructure suit.",
    pillars: [
      { title: 'LIRI — le moteur live & IA universel', points: ['Live HD (LiveKit WebRTC, jusqu\'à 1000 participants) + replay', 'IA temps réel : LIRI Brain, SmartBoard, transcription, TTS/STT, multilingue', 'Intégrable dans tout site via SDK, embed widget ou API REST', 'Produit horizontal, vendable seul'] },
      { title: 'École (LIRI École) — votre école en ligne', points: ['Lives payants + cours vidéo', 'SmartBoard IA + replay VOD', 'Certifications', 'Marque blanche : votre domaine, votre marque, vos étudiants'] },
      { title: 'MedOS — l\'OS médical des praticiens (en production)', points: ['Dossiers patients (EHR) + notes SOAP', 'IA Charting : transcription + note SOAP en ~30 s', 'Téléconsultation + ordonnances PDF', 'RGPD natif : consentement, audit trail, chiffrement AES-256'] },
      { title: 'Mbolo — e-commerce mobile-first pour l\'Afrique', points: ['Catalogue + panier / commandes', 'Paiements mobile money', 'Moteur multi-tenant déjà présent dans l\'API Cimolace', 'Statut : à venir'] },
      { title: 'Community — votre communauté en ligne', points: ['Forums thématiques + modération', 'Événements & inscriptions, cotisations / adhésions', 'Chat (canaux publics & privés) + notifications + fil d\'actualité', 'Statut : à venir'] },
    ],
    values: [
      { title: 'Paiement panafricain', desc: "Carte (Stripe, EUR) et mobile money Afrique — encaissement, remboursement et abonnements natifs, zéro commission sur les ventes." },
      { title: 'IA embarquée', desc: "30+ moteurs IA : génération de cours, notes cliniques SOAP, légendes réseaux, mémoire de live." },
      { title: 'Marque blanche invisible', desc: "Votre domaine, votre identité ; Cimolace reste invisible, à la manière de Stripe ou Zoom." },
      { title: 'Afrique-first', desc: "Conçu pour la réalité du terrain africain ; données hébergées en Afrique ; isolation multi-tenant triple couche (Garde API → Service → RLS PostgreSQL)." },
    ],
  },

  // La méthode = les 3 temps d'adoption de Cimolace.
  method: [
    { step: 'Choisissez', kind: 'Infrastructure', items: ['une infrastructure préconfigurée (École, MedOS, Boutique…)', 'ou construire la vôtre moteur par moteur'], foot: '01' },
    { step: 'Brandez', kind: 'Marque', items: ['logo', 'couleurs', 'domaine personnalisé'], foot: '02 — en 5 min' },
    { step: 'Lancez', kind: 'Mise en ligne', items: ['configurer les paiements', 'inviter l\'équipe', 'publier le premier produit'], foot: '03 — espace créé en ~10 min' },
  ],

  // Offres — grille SaaS interne (⚠️ à unifier avec la tarification vitrine, cf. en-tête).
  offers: [
    { name: 'Installation', price: '500 €', suffix: '/une fois', desc: 'Pack création : votre plateforme brandée, prête en minutes.' },
    { name: 'START', price: '150 €', suffix: '/mois', desc: 'Un espace prêt à l\'emploi (lives + replay, dossiers + téléconsult, ou catalogue + paiement). Zéro commission sur les ventes.' },
    { name: 'BUSINESS', price: '200 €', suffix: '/mois', desc: 'Multi-classes, multi-praticiens ou multi-boutiques, avec IA.', popular: true },
    { name: 'ENTREPRISE', price: '300 €', suffix: '/mois', desc: 'Puissance maximale, sans plafond.' },
  ],

  comparison: {
    intro: 'La grille SaaS Cimolace, du palier d\'entrée à la pleine puissance — installation unique de 500 €, puis abonnement mensuel, zéro commission sur les ventes.',
    plans: [
      { name: 'START', full: 'START', price: '150 €', suffix: '/mois', desc: 'Un espace prêt à l\'emploi (lives / dossiers / catalogue).' },
      { name: 'BUSINESS', full: 'BUSINESS', price: '200 €', suffix: '/mois', popular: true, desc: 'Multi-classes / multi-praticiens / multi-boutiques + IA.' },
      { name: 'ENTREPRISE', full: 'ENTREPRISE', price: '300 €', suffix: '/mois', desc: 'Puissance maximale, sans plafond.' },
    ],
    rows: [
      { feature: 'Installation unique (500 €)', has: [true, true, true] },
      { feature: 'Zéro commission sur les ventes', has: [true, true, true] },
      { feature: 'Un espace (lives / dossiers / catalogue)', has: [true, true, true] },
      { feature: 'Multi-classes / multi-praticiens / multi-boutiques', has: [false, true, true] },
      { feature: 'Moteurs IA embarqués', has: [false, true, true] },
      { feature: 'Capacité sans plafond', has: [false, false, true] },
    ],
  },

  navigation: ['MedOS', 'Moteurs', 'Tarifs', 'Solutions', 'LIRI', 'Créer ma plateforme'],

  faq: [
    { q: "C'est quoi Cimolace ?", a: "Un OS SaaS multi-tenant qui crée des plateformes. Vous choisissez une infrastructure (École, MedOS, Boutique…), vous la brandez, vous lancez. Sans coder." },
    { q: "Combien de temps pour être opérationnel ?", a: "10 minutes pour créer votre espace. 1 à 2 heures pour configurer branding, paiements et votre premier produit." },
    { q: "Je peux avoir mon propre domaine ?", a: "Oui. La marque blanche avec domaine personnalisé est incluse dans les plans supérieurs." },
    { q: "La sécurité multi-tenant ?", a: "Triple couche : Garde API → Filtre Service → RLS PostgreSQL. Chaque client est isolé des autres." },
    { q: "Quels moyens de paiement ?", a: "Carte via Stripe, et mobile money pour l'Afrique. (Rails exacts à confirmer.)" },
    { q: "Un plan gratuit ?", a: "MedOS propose un plan gratuit (3 patients). Essai gratuit pour découvrir les autres infrastructures." },
  ],
};

export default CIMOLACE_KNOWLEDGE;
