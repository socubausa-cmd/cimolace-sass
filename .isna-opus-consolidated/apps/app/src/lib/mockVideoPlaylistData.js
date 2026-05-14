import { addDays, subDays } from 'date-fns';

const generateId = (prefix) => `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const VIDEOS_POOL = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
];

const TITLES = [
  "Introduction aux concepts fondamentaux",
  "Théorie de la relativité restreinte",
  "Mécanique quantique : les bases",
  "L'art de la méditation profonde",
  "Histoire des civilisations anciennes",
  "Principes d'hermétisme appliqués",
  "Biologie cellulaire et énergie",
  "Cosmologie moderne et trous noirs",
  "Alchimie spirituelle : phase 1",
  "Géométrie sacrée dans la nature"
];

export const generateVideoPlaylistData = () => {
  const formations = Array.from({ length: 3 }).map((_, fIdx) => {
    const formationId = generateId('fmt');
    
    const modules = Array.from({ length: 3 }).map((_, mIdx) => {
      const moduleId = generateId('mod');
      
      const weeks = Array.from({ length: 2 }).map((_, wIdx) => {
        const weekId = generateId('wk');
        
        const days = Array.from({ length: 5 }).map((_, dIdx) => {
          const dayId = generateId('day');
          
          const videos = Array.from({ length: 3 }).map((_, vIdx) => {
            const duration = randomInt(300, 1800); // 5 to 30 mins in seconds
            const watched = Math.random() > 0.7;
            const progress = watched ? 100 : (Math.random() > 0.5 ? randomInt(10, 90) : 0);
            
            return {
              id: generateId('vid'),
              title: `${TITLES[randomInt(0, TITLES.length - 1)]} - Partie ${vIdx + 1}`,
              description: "Une exploration détaillée des concepts abordés dans ce chapitre, avec des exemples concrets et des exercices pratiques.",
              url: VIDEOS_POOL[randomInt(0, VIDEOS_POOL.length - 1)],
              duration: duration,
              thumbnail: `https://source.unsplash.com/random/400x225?sig=${Math.random()}`,
              status: progress === 100 ? 'watched' : (progress > 0 ? 'in-progress' : 'unwatched'),
              progress: progress,
              resources: [
                { title: "Support de cours PDF", type: "pdf", url: "#" },
                { title: "Lien vers l'article", type: "link", url: "#" }
              ]
            };
          });

          return {
            id: dayId,
            title: `Jour ${dIdx + 1}`,
            progress: Math.round(videos.reduce((acc, v) => acc + v.progress, 0) / videos.length),
            videos
          };
        });

        return {
          id: weekId,
          title: `Semaine ${wIdx + 1}`,
          progress: Math.round(days.reduce((acc, d) => acc + d.progress, 0) / days.length),
          days
        };
      });

      return {
        id: moduleId,
        title: `Module ${mIdx + 1}: Thématique Principale`,
        progress: Math.round(weeks.reduce((acc, w) => acc + w.progress, 0) / weeks.length),
        weeks
      };
    });

    return {
      id: formationId,
      title: `Formation ${fIdx + 1}: Titre du Programme`,
      description: "Un parcours complet pour maîtriser ce domaine de connaissance.",
      progress: Math.round(modules.reduce((acc, m) => acc + m.progress, 0) / modules.length),
      modules
    };
  });

  return formations;
};