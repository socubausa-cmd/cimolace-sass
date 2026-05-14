import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CyclesPage = () => {
  const { level } = useParams();
  
  const cyclesData = {
    'debutant': {
      title: 'Cycle Disciple',
      description: 'L\'entrée dans l\'univers de la connaissance.',
      modules: ['Fondamentaux théoriques', 'Introduction aux outils', 'Méthodologie de travail', 'Premier projet guidé'],
      duration: '3 mois',
      price: '290€'
    },
    'intermediaire': {
      title: 'Cycle Initié',
      description: 'La consolidation des acquis et la pratique intensive.',
      modules: ['Théorie avancée', 'Ateliers pratiques', 'Études de cas complexes', 'Projets autonomes'],
      duration: '6 mois',
      price: '590€'
    },
    'avance': {
      title: 'Cycle Maître',
      description: 'L\'excellence et la transmission.',
      modules: ['Expertise sectorielle', 'Pédagogie et transmission', 'Grand Œuvre (Projet final)', 'Certification Maître'],
      duration: '12 mois',
      price: '990€'
    }
  };

  const cycle = cyclesData[level];

  if (!cycle) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-[#0F1419] py-20 px-4 flex items-center justify-center">
      <Helmet><title>{cycle.title} - PRORASCIENCE</title></Helmet>
      
      <div className="max-w-3xl w-full bg-white/5 border border-yellow-500/30 rounded-2xl p-8 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 text-center">
          <span className="inline-block px-3 py-1 bg-yellow-500/20 text-yellow-500 text-sm font-bold rounded-full mb-6 uppercase tracking-wider">
            Programme Détaillé
          </span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">{cycle.title}</h1>
          <p className="text-xl text-gray-300 mb-12">{cycle.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-12">
            <div>
              <h3 className="font-bold text-white mb-4 text-lg">Modules du programme</h3>
              <ul className="space-y-3">
                {cycle.modules.map((mod, i) => (
                  <li key={i} className="flex items-start text-gray-400">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    {mod}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-black/30 rounded-xl p-6 border border-white/5">
              <div className="mb-6">
                <p className="text-sm text-gray-400">Durée estimée</p>
                <p className="text-2xl font-bold text-white">{cycle.duration}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-400">Tarif du cycle</p>
                <p className="text-3xl font-bold text-yellow-500">{cycle.price}</p>
              </div>
              <Button className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold">
                S'inscrire au cycle
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CyclesPage;