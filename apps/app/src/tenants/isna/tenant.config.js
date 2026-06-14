/**
 * ═══════════════════════════════════════════════════════════════
 * TENANT ISNA — école / PRORASCIENCE (client du moteur multi-tenant)
 * Ne pas confondre avec la marque produit CIMOLACE (`tenants/cimolace/`).
 * ═══════════════════════════════════════════════════════════════
 */

export const isnaTenantConfig = {
  id: '4f6faaa8-43a0-46d6-b98a-99ea1154f9ea',
  slug: 'isna',
  name: 'Institut Supérieur de Nutrition Alimentaire',
  email: 'contact@isna.pro',
  status: 'active',
  
  // Features activées pour ISNA
  features: {
    school_engine: true,
    live_room: true,
    smartboard: true,
    creator_studio: true,
    admin_booking: true,
    marketing_creator: true,
    neuro_recall: true,
    replay_system: true,
  },
  
  // Limits pour ISNA
  limits: {
    maxStudents: 1000,
    maxCourses: 50,
    maxLiveSessions: 100,
    storageGB: 100,
    maxTeachers: 20,
  },
  
  // Branding ISNA
  branding: {
    name: 'ISNA',
    fullName: 'Institut Supérieur de Nutrition Alimentaire',
    logo: '/logos/isna-logo.png',
    primaryColor: '#1a5f7a',
    secondaryColor: '#2c3e50',
    accentColor: '#D4AF37',
    backgroundColor: '#f8f9fa',
    domain: 'isna.pro',
    /** Origine publique canonique (Helmet, OG, JSON-LD vitrine). `domain` reste l'hôte applicatif / e-mail. */
    publicSiteOrigin: 'https://prorascience.org',
    /**
     * Contact affiché sur la vitrine (fallback si pas de `app_settings.contact_email`
     * ni `VITE_VITRINE_CONTACT_EMAIL`). À l'installation : renseigner l'e-mail dans
     * Admin → Paramètres ; pour Cimolace, l'e-mail du tenant technique alimente aussi
     * `metadata.branding.vitrineContactEmail` (voir `tenantService.mapToTenantConfig`).
     */
    vitrineContactEmail: 'infos@prorascience.org',
    favicon: '/favicons/isna-favicon.ico',
  },
  
  // Contenu spécifique ISNA
  content: {
    // Messages personnalisés
    messages: {
      welcome: 'Bienvenue sur la plateforme ISNA',
      loginSuccess: 'Connexion réussie',
      logoutSuccess: 'Déconnexion réussie',
      enrollmentSuccess: 'Inscription réussie',
      paymentSuccess: 'Paiement effectué avec succès',
    },
    
    // Labels personnalisés
    labels: {
      course: 'Formation',
      module: 'Module',
      lesson: 'Leçon',
      student: 'Étudiant',
      teacher: 'Enseignant',
      liveSession: 'Session en direct',
      smartboard: 'Tableau intelligent',
    },
    
    // Descriptions personnalisées
    descriptions: {
      schoolEngine: 'Moteur d\'école complet pour gérer formations, modules et leçons',
      liveRoom: 'Système de live streaming pour sessions en direct interactives',
      smartboard: 'Tableau intelligent avec support IA pour enseignements enrichis',
      creatorStudio: 'Studio de création pour produire contenu pédagogique',
      adminBooking: 'Système de réservation pour gestion administrative',
      marketingCreator: 'Outils marketing pour campagnes et tunnels',
      neuroRecall: 'Système de rappel neuro-cognitif pour rétention',
      replaySystem: 'Système de replay pour revoir les sessions',
    },
  },
  
  // Métadonnées additionnelles
  metadata: {
    schoolType: 'nutrition',
    language: 'fr',
    timezone: 'Europe/Paris',
    currency: 'EUR',
    foundedYear: 2020,
    socialLinks: {
      website: 'https://prorascience.org',
      facebook: 'https://facebook.com/isna.pro',
      instagram: 'https://instagram.com/isna.pro',
      linkedin: 'https://linkedin.com/company/isna-pro',
    },
  },
};

export default isnaTenantConfig;
