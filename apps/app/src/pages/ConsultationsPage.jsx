import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Calendar, MessageSquare, Heart, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const ConsultationsPage = () => {
  const { toast } = useToast();

  const handleBookClick = (consultationType) => {
    toast({
      title: `Réservation de consultation "${consultationType}"`,
      description: "🚧 Le système de réservation en ligne n'est pas encore implémenté—mais ne vous inquiétez pas ! Vous pouvez le demander dans votre prochain message ! 🚀",
    });
  };

  const consultations = [
    {
      id: 1,
      title: "Guidance Spirituelle Personnalisée",
      description: "Recevez des conseils éclairés pour naviguer sur votre chemin de vie, comprendre les défis et activer votre potentiel intérieur.",
      price: "75€ / 60 min",
      icon: Heart,
      image: "https://images.unsplash.com/photo-1518066000714-cdcd82ab5959?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTM2NXwwfDF8c2VhcmNofDEwfHxzdGFycyUyMGdhbGF4eSUyMG1lZGl0YXRpb258ZW58MHx8fHwxNzAwMDAwMDAw&ixlib=rb-4.0.3&q=80&w=1080",
    },
    {
      id: 2,
      title: "Coaching en Méditation Avancée",
      description: "Approfondissez votre pratique méditative avec un accompagnement sur mesure pour atteindre des états de conscience supérieurs.",
      price: "90€ / 75 min",
      icon: MessageSquare,
      image: "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTM2NXwwfDF8c2VhcmNofDEwfHxkcmltYSUyMGx1Y2lkZSUyMGdhbGF4eXxlbnwwfHx8fDE3MDAwMDAwMDAw&ixlib=rb-4.0.3&q=80&w=1080",
    },
    {
      id: 3,
      title: "Tirage de Cartes Intuitif",
      description: "Obtenez des perspectives claires sur votre situation actuelle et future grâce à un tirage de cartes intuitif et une interprétation profonde.",
      price: "60€ / 45 min",
      icon: Calendar,
      image: "https://images.unsplash.com/photo-1518066000714-cdcd82ab5959?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTM2NXwwfDF8c2VhcmNofDEwfHxzdGFycyUyMGdhbGF4eSUyMG1lZGl0YXRpb258ZW58MHx8fHwxNzAwMDAwMDAw&ixlib=rb-4.0.3&q=80&w=1080",
    },
  ];

  return (
    <div className="min-h-screen py-20 px-4">
      <Helmet>
        <title>Consultations Spirituelles - Prorascience.org</title>
        <meta name="description" content="Réservez une consultation spirituelle privée pour une guidance, un coaching ou un tirage intuitif." />
      </Helmet>

      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 gradient-text">Consultations Spirituelles</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Bénéficiez d'un accompagnement personnalisé pour votre épanouissement spirituel et votre clarté intérieure.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {consultations.map((consultation, index) => {
            const Icon = consultation.icon;
            return (
              <motion.div
                key={consultation.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 card-hover flex flex-col"
              >
                <img className="w-full h-48 object-cover rounded-lg mb-4" alt={consultation.title} src="https://images.unsplash.com/photo-1551062657-faa29d4266ab" />
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white mb-4">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">{consultation.title}</h2>
                <p className="text-gray-300 mb-4 flex-grow">{consultation.description}</p>
                
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-3xl font-bold gradient-text">{consultation.price}</span>
                  <Button onClick={() => handleBookClick(consultation.title)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 btn-glow">
                    <DollarSign className="h-4 w-4 mr-2" /> Réserver
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

export default ConsultationsPage;