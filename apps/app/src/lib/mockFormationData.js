import { subDays, addDays, format } from 'date-fns';

// Helper functions
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const generateId = (prefix) => `${prefix}-${Math.random().toString(36).substr(2, 9)}`;

export const generateRichFormations = (count = 8) => {
  const categories = ['Développement Personnel', 'Spiritualité', 'Histoire', 'Sciences', 'Métaphysique'];
  const levels = ['Débutant', 'Intermédiaire', 'Avancé', 'Expert'];
  const years = ['1ère année', '2ème année', '3ème année'];
  const statuses = ['published', 'draft', 'archived'];

  return Array.from({ length: count }).map((_, i) => {
    const formationId = generateId('fmt');
    const moduleCount = randomInt(3, 5);
    
    // Generate Modules
    const modules = Array.from({ length: moduleCount }).map((_, m) => {
      const weekCount = randomInt(2, 3);
      
      // Generate Weeks
      const weeks = Array.from({ length: weekCount }).map((_, w) => {
        
        // Generate Days
        const days = Array.from({ length: 5 }).map((_, d) => {
          
          // Generate Videos (Multiple)
          const videos = Array.from({ length: randomInt(0, 2) }).map((_, v) => ({
            id: generateId('vid'),
            title: `Vidéo ${v + 1}: Concept Clé`,
            description: "Une exploration approfondie du sujet du jour.",
            type: random(['youtube', 'vimeo']),
            url: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Placeholder
            duration: randomInt(15, 60), // minutes
            summary: "Ce qu'il faut retenir de cette leçon..."
          }));

          // Generate Content Reader (Slides or Gamma)
          let reader = null;
          const readerType = Math.random();
          
          if (readerType > 0.7) {
            // Slides
            reader = {
              id: generateId('ppt'),
              type: 'slides',
              title: 'Support de cours interactif',
              description: 'Diapositives du cours',
              slides: Array.from({ length: 5 }).map((_, s) => ({
                id: generateId('slide'),
                title: `Slide ${s + 1}`,
                content: `<p>Contenu riche pour la slide ${s + 1}. <strong>Point important</strong> à retenir.</p><ul><li>Concept A</li><li>Concept B</li></ul>`,
                image: s % 2 === 0 ? `https://source.unsplash.com/random/800x600?sig=${s}` : null,
                animation: random(['fade', 'slide', 'zoom', 'rotate', 'bounce']),
                duration: 0.5,
                delay: 0
              }))
            };
          } else if (readerType > 0.4) {
             // Gamma
             reader = {
                id: generateId('gam'),
                type: 'gamma',
                title: 'Présentation Gamma',
                description: 'Support visuel externe',
                embedUrl: 'https://gamma.app/embed/example'
             };
          }

          // Generate Quiz
          const hasQuiz = Math.random() > 0.6;
          const quiz = hasQuiz ? {
            id: generateId('qz'),
            title: "Quiz de validation",
            description: "Testez vos connaissances sur ce jour.",
            questions: Array.from({ length: 3 }).map((_, q) => ({
               id: generateId('qst'),
               statement: `Question ${q + 1} sur le sujet du jour ?`,
               type: 'multiple_choice',
               options: ['Réponse A (Correcte)', 'Réponse B', 'Réponse C'],
               correct: 0,
               points: 5
            }))
          } : null;

          return {
            id: generateId('day'),
            title: `Jour ${d + 1}`,
            description: "Focus sur la pratique quotidienne.",
            order: d + 1,
            videos,
            reader,
            quiz
          };
        });

        return {
          id: generateId('wk'),
          title: `Semaine ${w + 1}`,
          description: "Introduction aux concepts de la semaine.",
          order: w + 1,
          days
        };
      });

      return {
        id: generateId('mod'),
        title: `Module ${m + 1}: ${random(['Fondations', 'Concepts Avancés', 'Pratique', 'Maîtrise'])}`,
        description: "Description détaillée du module et de ses objectifs pédagogiques.",
        order: m + 1,
        weeks
      };
    });

    // Generate Students
    const studentCount = randomInt(5, 20);
    const enrolledStudents = Array.from({ length: studentCount }).map((_, s) => {
      const progress = randomInt(0, 100);
      let status = 'in_progress';
      if (progress === 0) status = 'not_started';
      if (progress === 100) status = 'completed';

      return {
        id: generateId('stu'),
        name: `Étudiant ${s + 1}`,
        email: `student${s + 1}@example.com`,
        enrollmentDate: subDays(new Date(), randomInt(1, 365)).toISOString(),
        progress,
        status,
        avatar: `https://i.pravatar.cc/150?u=${s}`,
        lastActive: subDays(new Date(), randomInt(0, 30)).toISOString()
      };
    });

    return {
      id: formationId,
      title: `Formation ${i + 1}: ${random(categories)}`,
      description: "Une formation complète pour transformer votre compréhension du sujet.",
      thumbnail: `https://source.unsplash.com/random/400x300?sig=${i}`,
      coverImage: `https://source.unsplash.com/random/800x600?sig=${i}`,
      category: random(categories),
      level: random(levels),
      year: random(years),
      status: random(statuses),
      price: randomInt(99, 499),
      duration: `${moduleCount * 4} semaines`,
      createdAt: subDays(new Date(), randomInt(30, 700)).toISOString(),
      updatedAt: subDays(new Date(), randomInt(1, 30)).toISOString(),
      modules,
      enrolledStudents,
      config: {
        isPrivate: Math.random() > 0.8,
        hasCertificate: true,
        certificateDuration: 12,
        hasGrading: true,
        minPassScore: 70
      }
    };
  });
};

export const generateFullHierarchy = () => {
  const years = [
    {
      id: 'year-1',
      name: '1ère année',
      description: 'Cycle Fondamental',
      trimesters: [
        {
          id: 'trim-1-1',
          name: 'Trimestre 1',
          modules: Array.from({ length: 3 }).map((_, i) => ({
            id: `mod-1-1-${i}`,
            title: `Module ${i + 1}`,
            code: `M1.${i + 1}`
          }))
        },
        {
          id: 'trim-1-2',
          name: 'Trimestre 2',
          modules: Array.from({ length: 3 }).map((_, i) => ({
            id: `mod-1-2-${i}`,
            title: `Module ${i + 4}`,
            code: `M1.${i + 4}`
          }))
        },
        {
          id: 'trim-1-3',
          name: 'Trimestre 3',
          modules: Array.from({ length: 3 }).map((_, i) => ({
            id: `mod-1-3-${i}`,
            title: `Module ${i + 7}`,
            code: `M1.${i + 7}`
          }))
        }
      ]
    },
    {
      id: 'year-2',
      name: '2ème année',
      description: 'Cycle Approfondi',
      trimesters: [
        {
          id: 'trim-2-1',
          name: 'Trimestre 1',
          modules: Array.from({ length: 3 }).map((_, i) => ({
            id: `mod-2-1-${i}`,
            title: `Module ${i + 1}`,
            code: `M2.${i + 1}`
          }))
        },
        {
          id: 'trim-2-2',
          name: 'Trimestre 2',
          modules: Array.from({ length: 3 }).map((_, i) => ({
            id: `mod-2-2-${i}`,
            title: `Module ${i + 4}`,
            code: `M2.${i + 4}`
          }))
        },
        {
          id: 'trim-2-3',
          name: 'Trimestre 3',
          modules: Array.from({ length: 3 }).map((_, i) => ({
            id: `mod-2-3-${i}`,
            title: `Module ${i + 7}`,
            code: `M2.${i + 7}`
          }))
        }
      ]
    },
    {
      id: 'year-3',
      name: '3ème année',
      description: 'Cycle Spécialisé',
      trimesters: [
        {
          id: 'trim-3-1',
          name: 'Trimestre 1',
          modules: Array.from({ length: 3 }).map((_, i) => ({
            id: `mod-3-1-${i}`,
            title: `Module ${i + 1}`,
            code: `M3.${i + 1}`
          }))
        },
        {
          id: 'trim-3-2',
          name: 'Trimestre 2',
          modules: Array.from({ length: 3 }).map((_, i) => ({
            id: `mod-3-2-${i}`,
            title: `Module ${i + 4}`,
            code: `M3.${i + 4}`
          }))
        },
        {
          id: 'trim-3-3',
          name: 'Trimestre 3',
          modules: Array.from({ length: 3 }).map((_, i) => ({
            id: `mod-3-3-${i}`,
            title: `Module ${i + 7}`,
            code: `M3.${i + 7}`
          }))
        }
      ]
    }
  ];

  return { years };
};

export const generateStudentProgress = (studentId, hierarchy) => {
  const progress = {};

  hierarchy.years.forEach(year => {
    progress[year.id] = {
      yearId: year.id,
      yearName: year.name,
      trimesters: year.trimesters.map(trimester => ({
        trimesterId: trimester.id,
        trimesterName: trimester.name,
        modules: trimester.modules.map(module => ({
          moduleId: module.id,
          moduleName: module.title,
          moduleCode: module.code,
          status: random(['not_started', 'in_progress', 'completed']),
          progress: randomInt(0, 100),
          score: randomInt(0, 20),
          completionDate: null
        }))
      }))
    };
  });

  return progress;
};