import { addHours, subHours, addDays, startOfToday, setHours, setMinutes } from 'date-fns';

export const mockLiveClasses = [
  {
    id: 'live-101',
    title: 'Introduction à la Cosmologie',
    instructor: 'Dr. Sarah Connor',
    instructorAvatar: 'https://i.pravatar.cc/150?u=sarah',
    formation: 'Cycle Fondamental',
    startTime: subHours(new Date(), 0.5).toISOString(), // Started 30 mins ago
    endTime: addHours(new Date(), 1.5).toISOString(),
    participants: 42,
    status: 'en_cours', // en_cours, a_venir, terminee
    description: "Exploration des concepts fondamentaux de l'univers et de ses origines.",
    roomLink: '#'
  },
  {
    id: 'live-102',
    title: 'Physique Quantique : Les Bases',
    instructor: 'Prof. Albert',
    instructorAvatar: 'https://i.pravatar.cc/150?u=albert',
    formation: 'Cycle Approfondi',
    startTime: addHours(new Date(), 2).toISOString(),
    endTime: addHours(new Date(), 4).toISOString(),
    participants: 128, // registered
    status: 'a_venir',
    description: "Comprendre les particules subatomiques et leurs comportements étranges.",
    roomLink: '#'
  },
  {
    id: 'live-103',
    title: 'Atelier de Méditation Guidée',
    instructor: 'Marie Currie',
    instructorAvatar: 'https://i.pravatar.cc/150?u=marie',
    formation: 'Développement Personnel',
    startTime: setHours(setMinutes(addDays(new Date(), 1), 0), 10).toISOString(), // Tomorrow 10:00
    endTime: setHours(setMinutes(addDays(new Date(), 1), 0), 11).toISOString(),
    participants: 15,
    status: 'a_venir',
    description: "Séance pratique pour apprendre à canaliser son énergie mentale.",
    roomLink: '#'
  },
  {
    id: 'live-104',
    title: 'Histoire des Sciences Anciennes',
    instructor: 'Dr. Jones',
    instructorAvatar: 'https://i.pravatar.cc/150?u=jones',
    formation: 'Cycle Histoire',
    startTime: subHours(new Date(), 26).toISOString(), // Yesterday
    endTime: subHours(new Date(), 24).toISOString(),
    participants: 30,
    status: 'terminee',
    description: "Retour sur les découvertes majeures de l'antiquité.",
    roomLink: '#'
  },
  {
    id: 'live-105',
    title: 'Session Q&A : Module 3',
    instructor: 'Dr. Sarah Connor',
    instructorAvatar: 'https://i.pravatar.cc/150?u=sarah',
    formation: 'Cycle Fondamental',
    startTime: addDays(new Date(), 2).toISOString(),
    endTime: addDays(new Date(), 2).toISOString(),
    participants: 5,
    status: 'a_venir',
    description: "Réponses aux questions des étudiants sur le module 3.",
    roomLink: '#'
  },
  {
    id: 'live-106',
    title: 'Métaphysique Avancée',
    instructor: 'Master Yoda',
    instructorAvatar: 'https://i.pravatar.cc/150?u=yoda',
    formation: 'Cycle Spécialisé',
    startTime: subHours(new Date(), 2).toISOString(), // Ended just now
    endTime: subHours(new Date(), 0.1).toISOString(),
    participants: 8,
    status: 'terminee',
    description: "Le concept de la force dans l'univers.",
    roomLink: '#'
  },
  {
    id: 'live-107',
    title: 'Biologie et Énergie',
    instructor: 'Prof. Darwin',
    instructorAvatar: 'https://i.pravatar.cc/150?u=darwin',
    formation: 'Sciences',
    startTime: addHours(new Date(), 5).toISOString(),
    endTime: addHours(new Date(), 6).toISOString(),
    participants: 60,
    status: 'a_venir',
    description: "Le lien entre les processus biologiques et les flux énergétiques.",
    roomLink: '#'
  },
  {
    id: 'live-108',
    title: 'Revue de la Semaine',
    instructor: 'Équipe Pédagogique',
    instructorAvatar: 'https://i.pravatar.cc/150?u=team',
    formation: 'Général',
    startTime: setHours(startOfToday(), 18).toISOString(),
    endTime: setHours(startOfToday(), 19).toISOString(),
    participants: 200,
    status: 'a_venir',
    description: "Bilan hebdomadaire et annonces importantes.",
    roomLink: '#'
  }
];

export const getClassesByStatus = (status) => {
  return mockLiveClasses.filter(cls => cls.status === status);
};

export const filterClasses = ({ instructor, formation, day }) => {
  return mockLiveClasses.filter(cls => {
    const matchInstructor = instructor ? cls.instructor === instructor : true;
    const matchFormation = formation ? cls.formation === formation : true;
    // Simple day match (checking if dates fall on same day)
    const matchDay = day ? new Date(cls.startTime).toDateString() === new Date(day).toDateString() : true;
    return matchInstructor && matchFormation && matchDay;
  });
};