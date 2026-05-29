import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Book, Lightbulb, Zap, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const ArticlesPage = () => {
  const { toast } = useToast();

  const handleReadMoreClick = (articleTitle) => {
    toast({
      title: `Lecture de l'article "${articleTitle}"`,
      description: "🚧 La page de l'article n'est pas encore implémentée—mais ne vous inquiétez pas ! Vous pouvez la demander dans votre prochain message ! 🚀",
    });
  };

  const articles = [
    {
      id: 1,
      title: "L'ISNA et l'Éveil de la Conscience",
      category: "Développement Personnel",
      date: "15 Septembre 2024",
      excerpt: "Explorez comment l'Ingénierie des Sciences Nocturnes Avancées peut transformer votre perception de la réalité et accélérer votre éveil spirituel.",
      image: "https://images.unsplash.com/photo-1518066000714-cdcd82ab5959?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTM2NXwwfDF8c2VhcmNofDEwfHxzdGFycyUyMGdhbGF4eSUyMG1lZGl0YXRpb258ZW58MHx8fHwxNzAwMDAwMDAw&ixlib=rb-4.0.3&q=80&w=1080",
      icon: Lightbulb,
    },
    {
      id: 2,
      title: "Méditation Quantique : Au-delà du Mental",
      category: "Méditation",
      date: "10 Septembre 2024",
      excerpt: "Découvrez les techniques de méditation quantique pour accéder à des états de conscience profonds et manifester vos désirs.",
      image: "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTM2NXwwfDF8c2VhcmNofDEwfHxkcmltYSUyMGx1Y2lkZSUyMGdhbGF4eXxlbnwwfHx8fDE3MDAwMDAwMDAw&ixlib=rb-4.0.3&q=80&w=1080",
      icon: Zap,
    },
    {
      id: 3,
      title: "Le Pouvoir des Rêves et leur Interprétation",
      category: "Rêves",
      date: "01 Septembre 2024",
      excerpt: "Apprenez à décoder les messages de vos rêves et à utiliser leur sagesse pour guider votre vie quotidienne.",
      image: "https://images.unsplash.com/photo-1518066000714-cdcd82ab5959?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTM2NXwwfDF8c2VhcmNofDEwfHxzdGFycyUyMGdhbGF4eSUyMG1lZGl0YXRpb258ZW58MHx8fHwxNzAwMDAwMDAw&ixlib=rb-4.0.3&q=80&w=1080",
      icon: Moon,
    },
  ];

  return (
    <div className="min-h-screen py-20 px-4">
      <Helmet>
        <title>Articles & Inspirations - Prorascience.org</title>
        <meta name="description" content="Lisez nos articles et réflexions sur la spiritualité, les sciences nocturnes avancées et le développement personnel." />
      </Helmet>

      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 gradient-text">Articles & Inspirations</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Explorez nos réflexions et recherches pour nourrir votre esprit et éclairer votre chemin.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map((article, index) => {
            const Icon = article.icon;
            return (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white/5 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 card-hover flex flex-col"
              >
                <img className="w-full h-48 object-cover" alt={article.title} src="https://images.unsplash.com/photo-1595872018818-97555653a011" />
                <div className="p-4 flex-grow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-purple-400 font-semibold flex items-center">
                      <Icon className="h-4 w-4 mr-1" /> {article.category}
                    </span>
                    <span className="text-sm text-gray-400">{article.date}</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">{article.title}</h2>
                  <p className="text-gray-300 text-sm mb-4 flex-grow">{article.excerpt}</p>
                  <Button onClick={() => handleReadMoreClick(article.title)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 btn-glow w-full">
                    <Book className="h-4 w-4 mr-2" /> Lire la suite
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ArticlesPage;