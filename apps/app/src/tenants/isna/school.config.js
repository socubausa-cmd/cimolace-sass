/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE SCHOOL CONFIGURATION - ISNA
 * Configuration scolaire spécifique pour ISNA
 * ═══════════════════════════════════════════════════════════════
 */

export const isnaSchoolConfig = {
  // Structure de l'école
  structure: {
    cycles: [
      {
        id: 'fondements',
        name: 'Fondements',
        description: 'Les bases de la nutrition',
        color: '#3498db',
        icon: 'book',
      },
      {
        id: 'approfondissement',
        name: 'Approfondissement',
        description: 'Approfondissement des connaissances',
        color: '#27ae60',
        icon: 'graduation-cap',
      },
      {
        id: 'maitrise',
        name: 'Maîtrise',
        description: 'Niveau avancé et spécialisation',
        color: '#9b59b6',
        icon: 'award',
      },
    ],
  },
  
  // Types de services
  serviceTypes: [
    {
      id: 'academique',
      name: 'Académique',
      description: 'Programme académique standard',
      price: 0,
    },
    {
      id: 'prive',
      name: 'Privé',
      description: 'Programme avec accompagnement personnalisé',
      price: 150,
    },
    {
      id: 'privilegie',
      name: 'Privilégié',
      description: 'Programme premium avec avantages exclusifs',
      price: 300,
    },
    {
      id: 'autonome',
      name: 'Autonome',
      description: 'Programme en libre accès',
      price: 50,
    },
  ],
  
  // Rôles utilisateurs
  roles: {
    owner: {
      name: 'Propriétaire',
      permissions: ['all'],
      color: '#e74c3c',
    },
    admin: {
      name: 'Administrateur',
      permissions: ['manage_courses', 'manage_students', 'manage_teachers', 'view_analytics'],
      color: '#f39c12',
    },
    teacher: {
      name: 'Enseignant',
      permissions: ['create_content', 'manage_live_sessions', 'view_students'],
      color: '#3498db',
    },
    secretariat: {
      name: 'Secrétariat',
      permissions: ['manage_enrollments', 'manage_payments', 'view_students'],
      color: '#27ae60',
    },
    creator: {
      name: 'Créateur',
      permissions: ['create_content', 'manage_smartboard', 'manage_studio'],
      color: '#9b59b6',
    },
    proche: {
      name: 'Proche',
      permissions: ['view_student_progress', 'view_live_sessions'],
      color: '#1abc9c',
    },
    student: {
      name: 'Étudiant',
      permissions: ['view_courses', 'view_content', 'participate_live'],
      color: '#95a5a6',
    },
  },
  
  // Configuration des cours
  courses: {
    defaultDuration: 12, // semaines
    defaultPrice: 500,
    currency: 'EUR',
    maxStudentsPerCourse: 100,
    autoEnrollment: false,
    requireApproval: true,
  },
  
  // Configuration des lives
  lives: {
    defaultDuration: 90, // minutes
    maxParticipants: 100,
    recordingEnabled: true,
    chatEnabled: true,
    screenSharingEnabled: true,
    whiteboardEnabled: true,
  },
  
  // Configuration du smartboard
  smartboard: {
    defaultTheme: 'light',
    defaultFont: 'Inter',
    autoSaveInterval: 30000, // 30 secondes
    maxSlides: 100,
    aiAssistanceEnabled: true,
  },
  
  // Configuration du studio
  studio: {
    defaultOutputFormat: 'mp4',
    defaultResolution: '1080p',
    maxFileSize: 500, // MB
    aiEnhancementEnabled: true,
  },
  
  // Configuration des notifications
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    reminderHours: [24, 2], // heures avant
  },
  
  // Configuration des rapports
  reports: {
    enabled: true,
    frequency: 'weekly',
    includeAnalytics: true,
    includeEnrollments: true,
    includeRevenue: true,
  },
};

export default isnaSchoolConfig;
