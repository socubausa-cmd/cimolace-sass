import { addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, format, isWeekend, isToday } from 'date-fns';

// Helper for randoms
const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const generateRichStudentData = (studentId) => {
  // --- 1. Progression Structure (Modules > Weeks > Days) ---
  const modules = Array.from({ length: 8 }).map((_, mIdx) => {
    const isModuleCompleted = mIdx < 3;
    const isModuleActive = mIdx === 3;
    
    const weeks = Array.from({ length: 4 }).map((_, wIdx) => {
      const isWeekCompleted = isModuleCompleted || (isModuleActive && wIdx < 2);
      
      const days = Array.from({ length: 5 }).map((_, dIdx) => ({
        id: `d-${mIdx}-${wIdx}-${dIdx}`,
        title: `Jour ${dIdx + 1}: Concept Clé`,
        status: isWeekCompleted ? 'completed' : (isModuleActive && wIdx === 2 && dIdx === 0) ? 'in_progress' : 'locked',
        videoDuration: '45min'
      }));

      return {
        id: `w-${mIdx}-${wIdx}`,
        title: `Semaine ${wIdx + 1}`,
        days,
        progress: isWeekCompleted ? 100 : (isModuleActive && wIdx === 2) ? 20 : 0
      };
    });

    return {
      id: `mod-${mIdx}`,
      title: `Module ${mIdx + 1}: ${['Cosmologie', 'Ontologie', 'Sociologie', 'Épistémologie', 'Métaphysique', 'Éthique', 'Politique', 'Esthétique'][mIdx]}`,
      weeks,
      status: isModuleCompleted ? 'completed' : isModuleActive ? 'in_progress' : 'locked',
      percentage: isModuleCompleted ? 100 : isModuleActive ? 45 : 0
    };
  });

  // --- 2. Notebook (240 entries roughly) ---
  const notebook = [];
  modules.forEach((mod, mIdx) => {
    mod.weeks.forEach((week, wIdx) => {
      week.days.forEach((day, dIdx) => {
        if (mod.status !== 'locked') {
          notebook.push({
            id: `nb-${studentId}-${mIdx}-${wIdx}-${dIdx}`,
            moduleId: mod.id,
            moduleTitle: mod.title,
            weekTitle: week.title,
            dayTitle: day.title,
            date: subDays(new Date(), (7 - mIdx) * 30 + (4 - wIdx) * 7 + (5 - dIdx)).toISOString(),
            content: `Réflexion sur le ${day.title}. J'ai compris que la structure fondamentale repose sur...`,
            teacherComment: Math.random() > 0.4 ? "Excellent point de vue. N'oubliez pas de citer vos sources." : null,
            grades: {
              comprehension: randomInt(7, 10),
              clarity: randomInt(3, 5),
              effort: randomInt(4, 5)
            }
          });
        }
      });
    });
  });

  // --- 3. Evaluations (Quiz) ---
  const evaluations = modules.filter(m => m.status !== 'locked').flatMap((mod, mIdx) => 
    mod.weeks.map((week, wIdx) => ({
      id: `quiz-${studentId}-${mIdx}-${wIdx}`,
      title: `Quiz ${mod.title} - ${week.title}`,
      module: mod.title,
      date: subDays(new Date(), (3 - mIdx) * 30).toISOString(),
      score: randomInt(10, 20),
      maxScore: 20,
      status: 'completed',
      questions: [
        { q: "Quelle est la définition de l'Ontologie ?", a: "L'étude de l'être en tant qu'être.", correct: true },
        { q: "Qui est l'auteur principal étudié ?", a: "Cheikh Anta Diop", correct: true },
        { q: "Le concept de Maât signifie...", a: "Vérité, Justice, Ordre", correct: true }
      ]
    }))
  );

  // --- 4. Contracts ---
  const contracts = [
    {
      id: `ct-coach-${studentId}`,
      type: 'Coaching',
      coach: { name: 'Coach Principal', email: 'coach@prorascience.com' },
      startDate: subDays(new Date(), 60).toISOString(),
      endDate: addDays(new Date(), 300).toISOString(),
      totalSessions: 12,
      completedSessions: 4,
      price: 1500,
      status: 'active',
      history: [
        { date: subDays(new Date(), 45).toISOString(), duration: 60, status: 'completed' },
        { date: subDays(new Date(), 15).toISOString(), duration: 60, status: 'completed' }
      ]
    },
    {
      id: `ct-ment-${studentId}`,
      type: 'Mentorat',
      coach: { name: 'Mentor Académique', email: 'mentor@prorascience.com' },
      startDate: subDays(new Date(), 90).toISOString(),
      endDate: addDays(new Date(), 270).toISOString(),
      totalSessions: 20,
      completedSessions: 8,
      price: 1000,
      status: 'active',
      history: []
    }
  ];

  // --- 5. Problèmes : données réelles via Supabase (StudentProfileModal + student_reported_problems)

  // --- 6. Calendar Events ---
  const calendarEvents = [
    // Past events
    ...contracts[0].history.map((h, i) => ({
      id: `cal-past-${i}`,
      title: `Session Coaching #${i+1}`,
      date: h.date,
      type: 'coaching',
      status: 'completed'
    })),
    // Future events
    {
      id: `cal-fut-1`,
      title: `Session Coaching #5`,
      date: addDays(new Date(), 3).toISOString(),
      type: 'coaching',
      status: 'scheduled',
      link: 'https://zoom.us/j/123',
      time: '14:00',
      location: 'Zoom'
    },
    {
      id: `cal-fut-2`,
      title: `Live Session Module 4`,
      date: addDays(new Date(), 5).toISOString(),
      type: 'live',
      status: 'scheduled',
      link: 'https://zoom.us/j/456',
      time: '18:00',
      location: 'Zoom'
    },
    {
      id: `cal-fut-3`,
      title: `Atelier Méthodologie`,
      date: addDays(new Date(), 10).toISOString(),
      type: 'workshop',
      status: 'scheduled',
      time: '10:00',
      location: 'Campus Virtuel'
    }
  ];

  return {
    progression: {
      overall: 42,
      modules,
      stats: {
        regularity: 85,
        liveParticipation: 90,
        averageNoteQuality: 14.5,
        trend: 'up'
      }
    },
    notebook,
    evaluations,
    contracts,
    problems: [],
    calendar: calendarEvents
  };
};

// Simple in-memory store for the session
let cachedData = null;

export const getSchoolLifeData = () => {
  if (!cachedData) {
    // Generate for a mock student ID
    cachedData = {
      ...generateRichStudentData('student-123'),
      studentProfile: {
        name: "Jean-Michel Étudiant",
        year: "2ème Année",
        globalAverage: 14.5,
        warningCount: 0
      },
      announcements: [
        { id: 1, title: "Rentrée 2025", content: "La rentrée aura lieu le...", isRead: false, date: new Date().toISOString() }
      ],
      warnings: [],
      events: [],
      indicators: {
        attendance: 95,
        participation: 88,
        homework: 92
      }
    };
  }
  return cachedData;
};

export const updateSchoolLifeData = (section, newData) => {
  if (!cachedData) getSchoolLifeData();
  
  if (section === 'announcements') {
    cachedData.announcements = newData;
  } else if (section === 'notebook') {
    cachedData.notebook = newData;
  } else if (section === 'progression') {
    cachedData.progression = newData;
  }
  
  return { ...cachedData };
};