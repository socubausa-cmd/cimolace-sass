import { addDays, subDays, startOfWeek, format, isBefore, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';

export const generateClassroomData = () => {
  const currentDate = new Date();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start

  const weeks = Array.from({ length: 4 }).map((_, wIdx) => {
    const weekNumber = wIdx + 1;
    const isCurrentWeek = wIdx === 0; // First generated week is current
    
    // Generate 5 days
    const days = Array.from({ length: 5 }).map((_, dIdx) => {
      const dayDate = addDays(weekStart, (wIdx * 7) + dIdx);
      const isPastDay = isBefore(dayDate, currentDate);
      const isToday = format(dayDate, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');
      
      return {
        id: `w${weekNumber}-d${dIdx + 1}`,
        title: `Jour ${dIdx + 1} - ${['Introduction', 'Concepts Clés', 'Pratique', 'Approfondissement', 'Synthèse'][dIdx]}`,
        date: dayDate.toISOString(),
        status: isToday ? 'current' : (isPastDay ? 'completed' : 'locked'),
        video: {
          id: `vid-${weekNumber}-${dIdx}`,
          title: `Leçon ${dIdx + 1}: Les fondements`,
          description: "Une vidéo explicative sur les principes essentiels de la journée.",
          duration: "15:30",
          url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          thumbnail: `https://source.unsplash.com/random/800x450?education,${dIdx}`,
          completed: isPastDay
        },
        content: {
          summary: "Aujourd'hui, nous avons exploré les bases fondamentales de la structure atomique et son lien avec l'énergie universelle.",
          keyPoints: [
             "La matière est composée d'énergie vibratoire.",
             "L'observateur influence l'expérience observée.",
             "La cohérence cardiaque améliore la réception cognitive."
          ],
          definitions: [
             { term: "Quanta", def: "La plus petite mesure indivisible de toute entité physique." },
             { term: "Entropie", def: "Mesure du désordre dans un système." }
          ]
        },
        notebook: {
          question: "Qu'as-tu retenu de ce cours et comment peux-tu l'appliquer ?",
          minLength: 50,
          savedContent: isPastDay ? "J'ai retenu que l'énergie est partout et que je peux l'influencer par ma pensée." : ""
        },
        quiz: {
          id: `quiz-${weekNumber}-${dIdx}`,
          minScore: 3,
          questions: [
            {
               id: 1,
               type: 'single',
               text: "Quelle est la nature fondamentale de la matière ?",
               options: ["Solide", "Liquide", "Énergie", "Gaz"],
               correctAnswer: 2,
               explanation: "La physique quantique démontre que la matière est essentiellement de l'énergie condensée."
            },
            {
               id: 2,
               type: 'boolean',
               text: "L'observateur n'a aucun impact sur l'expérience.",
               options: ["Vrai", "Faux"],
               correctAnswer: 1,
               explanation: "L'effet observateur est un principe clé de la mécanique quantique."
            },
            {
               id: 3,
               type: 'single',
               text: "Que signifie 'Entropie' ?",
               options: ["Ordre", "Désordre", "Énergie", "Masse"],
               correctAnswer: 1,
               explanation: "L'entropie mesure le degré de désordre d'un système."
            }
          ]
        }
      };
    });

    return {
      id: `week-${weekNumber}`,
      title: `Semaine ${weekNumber} - ${['Les Bases', 'L\'Énergie', 'La Conscience', 'L\'Univers'][wIdx]}`,
      description: "Objectifs de la semaine : Comprendre les interactions fondamentales.",
      status: isCurrentWeek ? 'active' : (wIdx < 0 ? 'completed' : 'locked'),
      openingLive: {
        id: `live-open-${weekNumber}`,
        title: `Live d'ouverture - Semaine ${weekNumber}`,
        instructor: "Dr. Sarah Connor",
        date: addDays(weekStart, wIdx * 7).toISOString(), // Monday
        duration: "45 min",
        status: isPast(addDays(weekStart, wIdx * 7)) ? 'replay' : 'upcoming',
        thumbnail: `https://source.unsplash.com/random/800x450?meeting,${weekNumber}`
      },
      closingLive: {
        id: `live-close-${weekNumber}`,
        title: `Live de synthèse - Semaine ${weekNumber}`,
        instructor: "Dr. Sarah Connor",
        date: addDays(weekStart, (wIdx * 7) + 4).toISOString(), // Friday
        duration: "60 min",
        status: isPast(addDays(weekStart, (wIdx * 7) + 4)) ? 'replay' : 'upcoming',
        thumbnail: `https://source.unsplash.com/random/800x450?conference,${weekNumber}`
      },
      days: days,
      requirements: {
         videosWatched: 0,
         notebooksFilled: 0,
         quizzesPassed: 0,
         liveAttended: false
      },
      validated: false
    };
  });

  return { weeks, currentWeekId: 'week-1' };
};

export const generateStudentSubmissions = (weekId) => {
   return Array.from({ length: 8 }).map((_, i) => ({
      id: `student-${i}`,
      name: `Étudiant ${i+1}`,
      avatar: `https://i.pravatar.cc/150?u=${i}`,
      notebooks: [
         { day: 1, content: "Ce cours était fascinant. J'ai bien compris le concept d'entropie.", score: 4 },
         { day: 2, content: "Un peu difficile aujourd'hui, besoin de revoir la vidéo.", score: 3 }
      ],
      quizScores: [
         { day: 1, score: 5, max: 5 },
         { day: 2, score: 3, max: 5 }
      ],
      progress: Math.floor(Math.random() * 100),
      needsHelp: Math.random() > 0.8
   }));
};