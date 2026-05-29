/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE CONTENT CONFIGURATION - ISNA
 * Configuration de contenu spécifique pour ISNA
 * ═══════════════════════════════════════════════════════════════
 */

export const isnaContentConfig = {
  // Pages
  pages: {
    home: {
      title: 'Accueil - ISNA',
      description: 'Institut Supérieur de Nutrition Alimentaire',
    },
    courses: {
      title: 'Formations - ISNA',
      description: 'Découvrez nos formations en nutrition',
    },
    about: {
      title: 'À propos - ISNA',
      description: 'En savoir plus sur ISNA',
    },
    contact: {
      title: 'Contact - ISNA',
      description: 'Nous contacter',
    },
  },
  
  // Messages
  messages: {
    welcome: 'Bienvenue sur la plateforme ISNA',
    loginSuccess: 'Connexion réussie',
    logoutSuccess: 'Déconnexion réussie',
    enrollmentSuccess: 'Inscription réussie',
    paymentSuccess: 'Paiement effectué avec succès',
    enrollmentPending: 'Votre inscription est en attente de validation',
    enrollmentRejected: 'Votre inscription a été refusée',
    courseCompleted: 'Formation terminée',
    moduleCompleted: 'Module terminé',
    lessonCompleted: 'Leçon terminée',
    liveStartingSoon: 'Session live qui commence bientôt',
    liveEnded: 'Session live terminée',
  },
  
  // Labels
  labels: {
    course: 'Formation',
    courses: 'Formations',
    module: 'Module',
    modules: 'Modules',
    lesson: 'Leçon',
    lessons: 'Leçons',
    student: 'Étudiant',
    students: 'Étudiants',
    teacher: 'Enseignant',
    teachers: 'Enseignants',
    liveSession: 'Session en direct',
    liveSessions: 'Sessions en direct',
    smartboard: 'Tableau intelligent',
    smartboards: 'Tableaux intelligents',
    studio: 'Studio',
    studios: 'Studios',
    replay: 'Replay',
    replays: 'Replays',
    enrollment: 'Inscription',
    enrollments: 'Inscriptions',
    certificate: 'Certificat',
    certificates: 'Certificats',
  },
  
  // Descriptions
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
  
  // Boutons
  buttons: {
    enroll: 'S\'inscrire',
    startCourse: 'Commencer la formation',
    continueCourse: 'Continuer',
    viewDetails: 'Voir les détails',
    joinLive: 'Rejoindre le live',
    viewReplay: 'Voir le replay',
    downloadCertificate: 'Télécharger le certificat',
    contactSupport: 'Contacter le support',
  },
  
  // Erreurs
  errors: {
    notFound: 'Page non trouvée',
    unauthorized: 'Non autorisé',
    serverError: 'Erreur serveur',
    enrollmentFailed: 'L\'inscription a échoué',
    paymentFailed: 'Le paiement a échoué',
    liveConnectionFailed: 'Échec de connexion au live',
  },
  
  // Formulaires
  forms: {
    login: {
      title: 'Connexion',
      email: 'Email',
      password: 'Mot de passe',
      rememberMe: 'Se souvenir de moi',
      forgotPassword: 'Mot de passe oublié ?',
      noAccount: 'Pas de compte ?',
      signUp: 'S\'inscrire',
    },
    register: {
      title: 'Inscription',
      firstName: 'Prénom',
      lastName: 'Nom',
      email: 'Email',
      password: 'Mot de passe',
      confirmPassword: 'Confirmer le mot de passe',
      agreeTerms: 'J\'accepte les conditions d\'utilisation',
      alreadyHaveAccount: 'Déjà un compte ?',
      signIn: 'Se connecter',
    },
    enrollment: {
      title: 'Inscription à la formation',
      selectService: 'Sélectionner le type de service',
      review: 'Réviser votre inscription',
      confirm: 'Confirmer l\'inscription',
    },
  },
  
  // Emails
  emails: {
    welcome: {
      subject: 'Bienvenue sur ISNA',
      template: 'welcome',
    },
    enrollmentConfirmation: {
      subject: 'Confirmation d\'inscription - ISNA',
      template: 'enrollment-confirmation',
    },
    enrollmentPending: {
      subject: 'Votre inscription est en attente - ISNA',
      template: 'enrollment-pending',
    },
    enrollmentApproved: {
      subject: 'Votre inscription a été approuvée - ISNA',
      template: 'enrollment-approved',
    },
    enrollmentRejected: {
      subject: 'Votre inscription a été refusée - ISNA',
      template: 'enrollment-rejected',
    },
    courseCompleted: {
      subject: 'Félicitations ! Formation terminée - ISNA',
      template: 'course-completed',
    },
    liveReminder: {
      subject: 'Rappel : Session live bientôt - ISNA',
      template: 'live-reminder',
    },
  },
};

export default isnaContentConfig;
