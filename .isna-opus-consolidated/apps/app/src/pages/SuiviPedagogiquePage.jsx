import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { 
  BookOpen, TrendingUp, CheckSquare, FileText,
  UserCheck, Calendar, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const SuiviPedagogiquePage = () => {
  const { toast } = useToast();

  const handleAction = (action) => {
    toast({
      title: "Suivi Pédagogique",
      description: `Demande reçue pour : ${action}.`,
    });
  };

  const services = [
    { title: "Aide aux Devoirs", desc: "Assistance pour les exercices hebdomadaires et les dissertations.", icon: BookOpen },
    { title: "Préparation Examens", desc: "Révision intensive et examens blancs avant les certifications.", icon: CheckSquare },
    { title: "Clarification de Concepts", desc: "Explication approfondie des modules complexes (ex: Rimseas).", icon: FileText },
    { title: "Méthodologie", desc: "Apprendre à apprendre : organisation, prise de notes, synthèse.", icon: TrendingUp }
  ];

  const tutors = [
    { name: "Sophie M.", module: "Modules F1-F5", rate: "30€/h", status: "Disponible" },
    { name: "Jean K.", module: "Modules F6-F10", rate: "35€/h", status: "Complet" },
    { name: "Lucie D.", module: "Cycle 2", rate: "45€/h", status: "Disponible" }
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-20 font-sans">
      <Helmet><title>Suivi Pédagogique | PRORASCIENCE</title></Helmet>

      {/* Hero */}
      <section className="relative py-20 bg-[#151a21] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 mb-6 px-4 py-1">Réussite Académique</Badge>
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6">Suivi Pédagogique Personnalisé</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
             Ne restez pas bloqué sur une notion. Nos tuteurs certifiés vous accompagnent pour garantir votre réussite et la maîtrise parfaite des modules.
          </p>
          <Button onClick={() => handleAction("Demander un tuteur")} size="lg" className="bg-green-600 text-white hover:bg-green-700 font-bold px-8">
             Trouver un Tuteur
          </Button>
        </div>
      </section>

      {/* Services */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
           <h2 className="text-3xl font-bold mb-12 text-center">Nos Services de Soutien</h2>
           <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {services.map((svc, i) => (
                 <div key={i} className="bg-[#192734] p-6 rounded-xl border border-white/5 hover:border-green-500/30 transition-all">
                    <svc.icon className="w-10 h-10 text-green-400 mb-4" />
                    <h3 className="font-bold text-lg mb-2">{svc.title}</h3>
                    <p className="text-sm text-gray-400">{svc.desc}</p>
                 </div>
              ))}
           </div>
        </div>
      </section>

      {/* Tutors */}
      <section className="py-16 bg-[#151a21]">
         <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold mb-12 text-center">Tuteurs Disponibles</h2>
            <div className="grid md:grid-cols-3 gap-8">
               {tutors.map((tutor, i) => (
                  <div key={i} className="bg-[#0F1419] p-6 rounded-xl border border-white/5 flex flex-col items-center text-center">
                     <div className="w-20 h-20 rounded-full bg-gray-700 mb-4 flex items-center justify-center text-2xl font-bold text-gray-400">
                        {tutor.name.charAt(0)}
                     </div>
                     <h3 className="font-bold text-lg">{tutor.name}</h3>
                     <p className="text-green-400 text-sm mb-4">{tutor.module}</p>
                     <div className="w-full border-t border-white/5 pt-4 mt-auto">
                        <div className="flex justify-between items-center text-sm mb-4">
                           <span className="text-gray-400">Tarif</span>
                           <span className="font-bold">{tutor.rate}</span>
                        </div>
                        <Button 
                           disabled={tutor.status === "Complet"}
                           onClick={() => handleAction(`Tuteur ${tutor.name}`)} 
                           className={`w-full ${tutor.status === "Complet" ? "bg-gray-700 text-gray-400" : "bg-green-600 text-white hover:bg-green-700"}`}
                        >
                           {tutor.status === "Complet" ? "Complet" : "Réserver"}
                        </Button>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* Resources */}
      <section className="py-16">
         <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-6">Ressources en Libre Accès</h2>
            <p className="text-gray-400 mb-8">Consultez nos fiches de révision et résumés de modules gratuitement.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {["Fiches F1-F4", "Glossaire", "Annales Corrigées", "Mémo Rimseas"].map((res, i) => (
                  <Button key={i} variant="outline" className="h-20 border-white/10 hover:bg-white/5 flex flex-col gap-2">
                     <FileText className="w-5 h-5 text-green-400" />
                     {res}
                  </Button>
               ))}
            </div>
         </div>
      </section>

    </div>
  );
};

export default SuiviPedagogiquePage;