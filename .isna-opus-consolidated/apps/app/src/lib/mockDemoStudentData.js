import { addDays, subDays, startOfWeek } from 'date-fns';

const today = new Date();
const nextWeek = addDays(today, 7);
const lastWeek = subDays(today, 7);

export const demoStudentData = {
  profile: {
    name: "Étudiant Démo",
    email: "demo@prorascience.com",
    role: "student",
    formation: "Cycle Fondamental - Année 1",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    level: "Niveau 1",
    studentId: "DEMO-2026-001"
  },
  stats: {
    average: 17.5,
    ranking: "3ème / 42",
    validatedWeeks: 8,
    totalWeeks: 12,
    credits: 24,
    attendance: 92
  },
  formations: [
    { 
      id: 1, 
      title: 'Cycle Fondamental - Année 1', 
      description: 'Le socle complet de la méthode Prorascience.',
      progress: 65, 
      status: 'in_progress', 
      category: 'Cursus',
      thumbnail: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=1000&auto=format&fit=crop',
      completedModules: 2,
      totalModules: 8,
      completedWeeks: 8,
      totalWeeks: 32
    },
    { 
      id: 2, 
      title: 'Introduction à l\'Ontologie', 
      description: 'Comprendre les fondements de l\'être.',
      progress: 90, 
      status: 'in_progress', 
      category: 'Module',
      thumbnail: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?q=80&w=1000&auto=format&fit=crop',
      completedModules: 4,
      totalModules: 5
    },
    { 
      id: 3, 
      title: 'Histoire des Sciences Africaines', 
      description: 'L\'apport de l\'Afrique aux sciences modernes.',
      progress: 100, 
      status: 'completed', 
      category: 'Option',
      thumbnail: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1000&auto=format&fit=crop',
      finalScore: '18.5/20',
      completionDate: '15 Jan 2026'
    },
    { 
      id: 4, 
      title: 'Maîtrise Émotionnelle', 
      description: 'Gérer ses émotions pour une meilleure clarté mentale.',
      progress: 0, 
      status: 'available', 
      category: 'Atelier',
      thumbnail: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?q=80&w=1000&auto=format&fit=crop'
    }
  ],
  evaluations: {
    upcoming: [
      { id: 101, title: 'Quiz Semaine 4: La Structure', module: 'Module 3', date: addDays(today, 2), duration: 20, questions: 15 },
      { id: 102, title: 'Examen de Mi-Parcours', module: 'Module 3', date: addDays(today, 5), duration: 90, questions: 40 },
      { id: 103, title: 'Dissertation: Conscience et Réalité', module: 'Module 3', date: addDays(today, 10), duration: 120, questions: 1 }
    ],
    completed: [
      { id: 201, title: 'Quiz Introduction', module: 'Module 1', score: 19, maxScore: 20, date: subDays(today, 20) },
      { id: 202, title: 'Examen Module 1', module: 'Module 1', score: 16.5, maxScore: 20, date: subDays(today, 15) },
      { id: 203, title: 'Quiz Semaine 1', module: 'Module 2', score: 18, maxScore: 20, date: subDays(today, 8) },
      { id: 204, title: 'Oral de validation', module: 'Module 2', score: 17, maxScore: 20, date: subDays(today, 2) }
    ]
  },
  grades: [
    { id: 1, subject: 'Module 1: Fondements', score: 19, max: 20, type: 'Quiz', date: '2025-10-10', feedback: 'Parfait.' },
    { id: 2, subject: 'Module 1: Examen', score: 16.5, max: 20, type: 'Examen', date: '2025-10-25', feedback: 'Très bonne analyse.' },
    { id: 3, subject: 'Module 2: Quiz S1', score: 18, max: 20, type: 'Quiz', date: '2025-11-05', feedback: 'Excellent.' },
    { id: 4, subject: 'Module 2: Oral', score: 17, max: 20, type: 'Oral', date: '2025-11-20', feedback: 'Très bonne éloquence.' },
    { id: 5, subject: 'Module 3: Quiz S3', score: 15, max: 20, type: 'Quiz', date: '2025-12-01', feedback: 'Bien, mais attention aux détails.' }
  ],
  agenda: [
    { id: 1, title: 'Live: Session Q&A', type: 'live', date: today, time: '18:00 - 19:30', location: 'Zoom', instructor: 'Prof. K.' },
    { id: 2, title: 'Remise Devoir M3', type: 'deadline', date: addDays(today, 2), time: '23:59', location: 'Plateforme', instructor: null },
    { id: 3, title: 'Atelier Pratique', type: 'workshop', date: addDays(today, 3), time: '14:00 - 16:00', location: 'Salle Virtuelle', instructor: 'Coach S.' },
    { id: 4, title: 'Cérémonie d\'Ouverture', type: 'event', date: addDays(today, 6), time: '20:00', location: 'Youtube Live', instructor: null }
  ],
  absences: [
    { id: 1, date: '2026-01-10', course: 'Live: Module 2', duration: '1h30', status: 'justified', reason: 'Rendez-vous médical' },
    { id: 2, date: '2026-01-24', course: 'Atelier Groupe B', duration: '2h', status: 'justified', reason: 'Problème technique' },
    { id: 3, date: '2026-02-02', course: 'Live: Q&A', duration: '1h', status: 'unjustified', reason: null }
  ],
  documents: {
    admin: [
      { id: 1, name: 'Attestation d\'inscription 2026', date: '01 Sept 2025', size: '1.2 MB' },
      { id: 2, name: 'Règlement Intérieur', date: '28 Août 2025', size: '2.4 MB' },
    ],
    academic: [
      { id: 3, name: 'Relevé de Notes T1', date: '15 Déc 2025', size: '0.8 MB' },
      { id: 4, name: 'Support de cours M2', date: '20 Jan 2026', size: '5.5 MB' },
    ],
    resources: [
      { id: 5, name: 'Guide de la Méthode', date: '01 Sept 2025', size: '15.0 MB' },
    ]
  },
  notifications: [
    { id: 1, message: 'Votre devoir "Dissertation Module 3" est à rendre bientôt.', date: new Date(), read: false },
    { id: 2, message: 'Nouvelle note disponible pour le Quiz Semaine 4.', date: subDays(today, 1), read: false },
    { id: 3, message: 'Rappel: Live Q&A ce soir à 18h.', date: today, read: false }
  ]
};