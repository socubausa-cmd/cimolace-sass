import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { PlayCircle, Lock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const VideosPage = () => {
  const { toast } = useToast();

  const handleWatchClick = (videoTitle, isPremium) => {
    if (isPremium) {
      toast({
        title: `Accès à la vidéo "${videoTitle}"`,
        description: "🚧 Cette fonctionnalité d'achat de vidéo premium n'est pas encore implémentée—mais ne vous inquiétez pas ! Vous pouvez la demander dans votre prochain message ! 🚀",
      });
    } else {
      toast({
        title: `Visionnage de "${videoTitle}"`,
        description: "🚧 Le lecteur vidéo n'est pas encore intégré pour cette vidéo gratuite—mais ne vous inquiétez pas ! Vous pouvez le demander dans votre prochain message ! 🚀",
      });
    }
  };

  const videos = [
    {
      id: 1,
      title: "Méditation Guidée pour l'Éveil",
      description: "Une séance de méditation profonde pour harmoniser votre esprit et ouvrir votre conscience aux énergies subtiles.",
      type: "Gratuit",
      image: "https://images.unsplash.com/photo-1518066000714-cdcd82ab5959?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTM2NXwwfDF8c2VhcmNofDEwfHxzdGFycyUyMGdhbGF4eSUyMG1lZGl0YXRpb258ZW58MHx8fHwxNzAwMDAwMDAw&ixlib=rb-4.0.3&q=80&w=1080",
    },
    {
      id: 2,
      title: "Les Secrets de la Projection Astrale",
      description: "Explorez les techniques pour voyager hors de votre corps et découvrir d'autres plans de réalité. (Contenu Premium)",
      type: "Premium",
      price: "19.99€",
      image: "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTM2NXwwfDF8c2VhcmNofDEwfHxkcmltYSUyMGx1Y2lkZSUyMGdhbGF4eXxlbnwwfHx8fDE3MDAwMDAwMDAw&ixlib=rb-4.0.3&q=80&w=1080",
    },
    {
      id: 3,
      title: "Comprendre les Synchronicités",
      description: "Décryptez les messages de l'univers et apprenez à reconnaître les signes qui guident votre chemin de vie.",
      type: "Gratuit",
      image: "https://images.unsplash.com/photo-1518066000714-cdcd82ab5959?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTM2NXwwfDF8c2VhcmNofDEwfHxzdGFycyUyMGdhbGF4eSUyMG1lZGl0YXRpb258ZW58MHx8fHwxNzAwMDAwMDAw&ixlib=rb-4.0.3&q=80&w=1080",
    },
    {
      id: 4,
      title: "Activation du Troisième Œil",
      description: "Des exercices et des méditations pour stimuler votre glande pinéale et développer votre intuition. (Contenu Premium)",
      type: "Premium",
      price: "29.99€",
      image: "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTM2NXwwfDF8c2VhcmNofDEwfHxkcmltYSUyMGx1Y2lkZSUyMGdhbGF4eXxlbnwwfHx8fDE3MDAwMDAwMDAw&ixlib=rb-4.0.3&q=80&w=1080",
    },
  ];

  return (
    <div className="min-h-screen py-20 px-4">
      <Helmet>
        <title>Vidéos ISNA - Prorascience.org</title>
        <meta name="description" content="Explorez notre bibliothèque de vidéos sur l'Ingénierie des Sciences Nocturnes Avancées, gratuites et premium." />
      </Helmet>

      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 gradient-text">Vidéos & Cours Multimédias</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Plongez dans nos contenus visuels pour approfondir votre compréhension des sciences spirituelles.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {videos.map((video, index) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 card-hover flex flex-col"
            >
              <div className="relative">
                <img className="w-full h-48 object-cover" alt={video.title} src="https://images.unsplash.com/photo-1637592156141-d41fb6234e71" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                  <Button
                    onClick={() => handleWatchClick(video.title, video.type === "Premium")}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 btn-glow"
                  >
                    {video.type === "Premium" ? <><Lock className="h-5 w-5 mr-2" /> Acheter ({video.price})</> : <><PlayCircle className="h-5 w-5 mr-2" /> Regarder</>}
                  </Button>
                </div>
              </div>
              <div className="p-4 flex-grow">
                <h2 className="text-xl font-bold text-white mb-2">{video.title}</h2>
                <p className="text-gray-300 text-sm mb-3 flex-grow">{video.description}</p>
                <div className="flex justify-between items-center mt-auto">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${video.type === "Premium" ? 'bg-yellow-600/20 text-yellow-300' : 'bg-green-600/20 text-green-300'}`}>
                    {video.type}
                  </span>
                  {video.type === "Premium" && <Star className="h-4 w-4 text-yellow-400" />}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideosPage;