import { addDays, subDays, addHours } from 'date-fns';

export const generateCoachingSessions = () => {
  return Array.from({ length: 15 }).map((_, i) => ({
    id: `sess-${i + 1}`,
    title: `Session de Coaching ${i + 1}`,
    description: 'Suivi mensuel et objectifs.',
    coachId: 'coach-1',
    coachName: 'Jean Admin',
    studentIds: ['stu-1'],
    date: addDays(new Date(), i - 5).toISOString(),
    startTime: '10:00',
    endTime: '11:00',
    type: Math.random() > 0.5 ? 'coaching' : 'mentoring',
    location: 'online',
    status: i < 5 ? 'completed' : 'scheduled',
    price: 150
  }));
};

export const generateWorkshops = () => {
  return Array.from({ length: 8 }).map((_, i) => ({
    id: `ws-${i + 1}`,
    title: `Atelier ${i + 1}: Maîtrise Avancée`,
    description: 'Un atelier intensif sur les techniques avancées.',
    facilitatorId: 'coach-1',
    category: 'Development',
    date: addDays(new Date(), i * 3).toISOString(),
    startTime: '14:00',
    endTime: '17:00',
    location: 'online',
    spots: 20,
    enrolledCount: Math.floor(Math.random() * 15),
    price: 300,
    status: 'scheduled',
    level: 'intermediate'
  }));
};