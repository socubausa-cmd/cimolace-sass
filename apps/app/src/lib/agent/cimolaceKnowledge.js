/**
 * cimolaceKnowledge — MÉMOIRE CENTRALISÉE de Cimolace (realm `cimolace`), au schéma EXACT de
 * PRORASCIENCE_KNOWLEDGE, pour donner au realm OS Cimolace un rendu VNP data-driven (comme
 * prorascience) au lieu du seul tunnel de création. Agrégé FIDÈLEMENT depuis le contenu réel
 * (vitrine apps/public-site, homepage OS immersive, pages produits, grille tarifaire réelle).
 *
 * DÉCISIONS PRODUIT DU FONDATEUR (2026-07-11) :
 *   - POSITIONNEMENT : « L'infrastructure SaaS intelligente pour l'Afrique » (homepage OS).
 *   - TARIFICATION : le modèle VITRINE = par INFRASTRUCTURE, essai 14 j, sans engagement, à partir
 *     de 0 € (MedOS Sprout). Source : apps/public-site/src/app/pricing/page.tsx (vérité).
 *       École     : Starter 79 / Pro 199 / Business 349 €/mois
 *       MedOS      : Sprout 0 / Solo 19 / Pro 49 / Clinic 99 €/mois
 *       Bien-être  : Starter 29 / Pro 79 €/mois
 *       Créateur   : Starter 49 / Pro 149 / Business 299 €/mois
 * ⚠️ RESTE : les prix ne sont PAS en DB (tenant `cimolace` = 0 billing_plan) → non « achetables »
 *   tant qu'on ne seede pas billing_plans + stripe_price_id. Rails de paiement à confirmer
 *   (vitrine : Stripe · CinetPay · MTN · Orange Money · Chariow). Cf. workflow whygqajyf (missing[]).
 * NB : les MOTEURS (LIRI/École/MedOS/Mbolo/Community) = les briques qui POWERent les infrastructures
 *   vendues ci-dessus — d'où deux taxonomies (pillars = moteurs, offers = infrastructures priçées).
 */

export const CIMOLACE_KNOWLEDGE = {
  identity: {
    slug: 'cimolace',
    name: 'Cimolace',
    fullName: 'Cimolace — ISNA Platform',
    subtitle: "L'infrastructure SaaS intelligente pour l'Afrique — lancez votre plateforme brandée, sans coder.",
    website: 'cimolace.space',
    stats: [
      { label: 'OS métier prêts', value: '7' },
      { label: 'moteurs IA', value: '30+' },
      { label: "essai gratuit", value: '14 j' },
    ],
  },

  founder: {
    name: 'Ngowazulu',
    title: 'Fondateur de Cimolace',
    bio: "Fondateur de Cimolace et de l'écosystème ISNA / Prorascience. Cimolace est né d'une frustration d'entrepreneur africain : « J'avais une boutique, une formation, une communauté. Mais 80 % de mon temps partait à gérer des outils qui ne se parlaient pas. » Le problème n'était pas les outils, mais l'absence d'un système conçu pour l'Afrique.",
    facts: [
      { k: 'Rôle', v: 'Fondateur de Cimolace' },
      { k: 'Mandat', v: 'Donner à l\'Afrique son infrastructure SaaS' },
    ],
  },

  // Scènes DESIGNÉES (splits) fournies par le pack — surchargent le hardcode prorascience de
  // buildNodeScene/buildTenantTour (qui reste le fallback pour isna). Rend le VNP data-driven par tenant.
  scenes: {
    identity: {
      type: 'split', headline: 'Cimolace',
      left: { title: "Ce que c'est", subtitle: 'La plateforme', points: ['Une infra SaaS multi-tenant', 'Des moteurs prêts à l\'emploi', 'Invisible, comme Stripe ou Zoom'] },
      right: { title: 'Ce que ça change', subtitle: 'Pour vous', points: ['Votre marque, votre domaine', 'Du live à la boutique', 'Pensé pour l\'Afrique'] },
      tone: { left: 'gold', right: 'terra' },
    },
    vision: {
      type: 'split', headline: 'Cimolace',
      left: { title: 'Le problème', subtitle: 'Aujourd\'hui', points: ['Des outils qui ne se parlent pas', 'Des mois d\'intégration', 'Pas d\'infra pensée pour l\'Afrique'] },
      right: { title: 'La promesse', subtitle: 'Cimolace', points: ['Votre plateforme brandée', 'Sans coder, en ~10 min', 'Vous encaissez, l\'infra suit'] },
      tone: { left: 'terra', right: 'gold' },
    },
    mission: {
      type: 'split', headline: 'Notre mission',
      left: { title: 'Pourquoi', subtitle: 'Le constat', points: ['Le talent existe, pas l\'infra', 'Trop d\'outils qui ne parlent pas', 'L\'Afrique peut sauter une étape'] },
      right: { title: 'Ce qu\'on vise', subtitle: 'Le cap', points: ['Lancer sans coder', 'Encaisser (carte + mobile money)', 'La souveraineté numérique africaine'] },
      tone: { left: 'gold', right: 'terra' },
    },
  },

  vision: {
    whatIs: "Cimolace est une infrastructure SaaS multi-tenant qui fait tourner les produits de ses clients en coulisses — comme Stripe pour le paiement ou Zoom pour la vidéo. Le client garde sa marque, son domaine et ses données ; Cimolace reste invisible.",
    problem: "Les entrepreneurs assemblent des outils qui ne se parlent pas : paiement + vidéo + email + LMS + CRM, sans isolation multi-tenant, et des mois d'intégration. En Afrique, le talent existe mais pas l'infrastructure.",
    promise: "Lancer sa propre plateforme brandée, sans coder, en ~10 minutes — puis 1 à 2 heures pour brancher branding, paiements et premier produit.",
    closing: "L'Afrique ne doit pas rattraper la technologie : elle peut sauter une étape. Choisissez votre infrastructure, activez, encaissez — l'infrastructure suit.",
    pillars: [
      { title: 'LIRI — le moteur live & IA universel', points: ["Live HD (LiveKit WebRTC, jusqu'à 1000 participants) + replay", 'IA temps réel : LIRI Brain, SmartBoard, transcription, TTS/STT, multilingue', 'Intégrable dans tout site via SDK, embed widget ou API REST', 'Produit horizontal, vendable seul'] },
      { title: 'École — votre école en ligne', points: ['Lives payants + cours vidéo', 'SmartBoard IA + replay VOD', 'Certifications', 'Marque blanche : votre domaine, votre marque, vos étudiants'] },
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
    { step: 'Choisissez', kind: 'Infrastructure', items: ['une infrastructure préconfigurée (École, MedOS, Bien-être, Créateur…)', 'ou construire la vôtre moteur par moteur'], foot: '01' },
    { step: 'Brandez', kind: 'Marque', items: ['logo', 'couleurs', 'domaine personnalisé'], foot: '02 — en 5 min' },
    { step: 'Lancez', kind: 'Mise en ligne', items: ['configurer les paiements', 'inviter l\'équipe', 'publier le premier produit'], foot: '03 — espace créé en ~10 min' },
  ],

  // Offres = les INFRASTRUCTURES vendues sur la vitrine (prix d'ENTRÉE ; échelle de paliers en desc).
  // Tous les plans : essai 14 jours, sans engagement, constructeur d'infrastructure inclus.
  offers: [
    { name: 'MedOS — OS médical', price: '0 €', suffix: '/mois (dès)', desc: 'Dossiers patients + note SOAP IA + téléconsultation. Sprout gratuit (3 patients) → Solo 25 € → Pro 49 € → Clinic 99 € (illimité, white label).' },
    { name: 'École — école en ligne', price: '79 €', suffix: '/mois (dès)', desc: 'Lives + cours + SmartBoard IA + certifications. Starter 79 € → Pro 199 € (500 étudiants) → Business 349 € (white label, API).', popular: true },
    { name: 'Bien-être — coaching', price: '29 €', suffix: '/mois (dès)', desc: 'Programmes de soins + téléconsult + automatisations email/SMS + paiements. Starter 29 € → Pro 79 €.' },
    { name: 'Créateur — studio', price: '49 €', suffix: '/mois (dès)', desc: 'Studio live + monétisation directe + VOD. Starter 49 € → Pro 149 € (illimité) → Business 299 € (white label, régie pub).' },
  ],

  // Comparateur des 4 infrastructures priçées (vitrine). Rows = dimensions communes dérivées FIDÈLEMENT.
  comparison: {
    intro: 'Des plans qui grandissent avec vous — sans engagement, 14 jours d\'essai, le constructeur d\'infrastructure inclus dans tous les plans.',
    plans: [
      { name: 'MedOS', full: 'MedOS — OS médical', price: '0 €', suffix: '/mois', popular: true, desc: 'Praticiens & cliniques (en production).' },
      { name: 'École', full: 'École — école en ligne', price: '79 €', suffix: '/mois', desc: 'Formateurs & instituts.' },
      { name: 'Bien-être', full: 'Bien-être — coaching', price: '29 €', suffix: '/mois', desc: 'Coachs & thérapeutes.' },
      { name: 'Créateur', full: 'Créateur — studio', price: '49 €', suffix: '/mois', desc: 'Créateurs & studios.' },
    ],
    rows: [
      { feature: 'Essai 14 jours, sans engagement', has: [true, true, true, true] },
      { feature: 'IA embarquée (SmartBoard / SOAP / …)', has: [true, true, true, true] },
      { feature: 'Plan gratuit pour démarrer', has: [true, false, false, false] },
      { feature: 'Marque blanche (domaine perso)', has: [true, true, false, true] },
      { feature: 'Multi-utilisateurs (équipe)', has: [true, true, false, true] },
    ],
  },

  navigation: ['MedOS', 'Moteurs', 'Tarifs', 'Solutions', 'LIRI', 'Créer ma plateforme'],

  faq: [
    { q: "C'est quoi Cimolace ?", a: "L'infrastructure SaaS intelligente pour l'Afrique : un OS multi-tenant qui crée des plateformes. Vous choisissez une infrastructure (École, MedOS, Bien-être, Créateur…), vous la brandez, vous lancez. Sans coder." },
    { q: "Combien ça coûte ?", a: "Ça dépend de l'infrastructure, à partir de 0 €/mois (MedOS Sprout). École dès 79 €, Bien-être dès 29 €, Créateur dès 49 €. Tous les plans : 14 jours d'essai, sans engagement." },
    { q: "Combien de temps pour être opérationnel ?", a: "10 minutes pour créer votre espace. 1 à 2 heures pour configurer branding, paiements et votre premier produit." },
    { q: "Je peux avoir mon propre domaine ?", a: "Oui — la marque blanche avec domaine personnalisé est incluse dans les plans supérieurs (École Business, MedOS Clinic, Créateur Business)." },
    { q: "La sécurité multi-tenant ?", a: "Triple couche : Garde API → Filtre Service → RLS PostgreSQL. Chaque client est isolé des autres." },
    { q: "Quels moyens de paiement ?", a: "Carte via Stripe, et mobile money pour l'Afrique. (Rails exacts à confirmer.)" },
  ],
};

export default CIMOLACE_KNOWLEDGE;
