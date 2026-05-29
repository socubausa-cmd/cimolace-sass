import React from 'react';
import { Helmet } from 'react-helmet';
import { Heart, Users, Shield, Phone, LifeBuoy, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const SoutienEmotionnelPage = () => {
  const { toast } = useToast();

  const handleAction = (action) => {
    toast({
      title: "Soutien Émotionnel",
      description: `Votre demande pour : ${action} a été reçue. Confidentialité garantie.`,
    });
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-20 font-sans">
      <Helmet><title>Soutien Émotionnel | PRORASCIENCE</title></Helmet>

      {/* Hero */}
      <section className="relative py-20 bg-gradient-to-b from-purple-900/20 to-[#0F1419]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="w-16 h-16 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 mb-6">
             <Heart className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6">Bien-être & Équilibre</h1>
          <p className="text-xl text-gray-300 mb-10">
             Le chemin initiatique peut être intense. Nous offrons un espace sécurisé et confidentiel pour vous écouter, vous soutenir et vous guider dans les moments de doute.
          </p>
          <div className="flex justify-center gap-4">
             <Button onClick={() => handleAction("Parler à un conseiller")} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-6 rounded-full">
                Parler à un Conseiller
             </Button>
          </div>
        </div>
      </section>

      {/* Types of Support */}
      <section className="py-16">
         <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8">
            {[
               { icon: User, title: "Soutien Individuel", desc: "Entretiens privés avec un psychologue ou un thérapeute agréé par l'académie." },
               { icon: Users, title: "Cercles de Parole", desc: "Groupes de partage bienveillants entre étudiants, facilités par un médiateur." },
               { icon: LifeBuoy, title: "Urgence Émotionnelle", desc: "Ligne d'écoute disponible pour les situations de crise spirituelle ou personnelle." }
            ].map((item, i) => {
               const Icon = item.icon || Shield;
               return (
                  <div key={i} className="bg-[#192734] p-8 rounded-2xl border border-white/5 text-center hover:border-purple-500/30 transition-all">
                     <Icon className="w-10 h-10 text-purple-400 mx-auto mb-6" />
                     <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                     <p className="text-gray-400">{item.desc}</p>
                  </div>
               );
            })}
         </div>
      </section>

      {/* Professionals */}
      <section className="py-16 bg-[#151a21]">
         <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-3xl font-bold mb-12 text-center">Nos Professionnels de l'Écoute</h2>
            <div className="space-y-6">
               {[
                  { name: "Dr. Amara", role: "Psychologue Clinicienne", spec: "Trauma & Résilience", avail: "Lun-Mer" },
                  { name: "M. Dubois", role: "Thérapeute Holistique", spec: "Gestion du Stress & Anxiété", avail: "Jeu-Sam" }
               ].map((pro, i) => (
                  <div key={i} className="bg-[#0F1419] p-6 rounded-xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                     <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-purple-900/30 flex items-center justify-center text-purple-300 font-bold">
                           {pro.name.charAt(0)}
                        </div>
                        <div>
                           <h3 className="font-bold text-lg">{pro.name}</h3>
                           <p className="text-purple-400 text-sm">{pro.role}</p>
                           <p className="text-sm text-gray-500">{pro.spec}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                           <span className="text-sm text-gray-500 block">Disponibilité</span>
                           <span className="text-sm font-medium">{pro.avail}</span>
                        </div>
                        <Button onClick={() => handleAction(`RDV avec ${pro.name}`)} variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
                           Prendre RDV
                        </Button>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* Emergency & Confidentiality */}
      <section className="py-16">
         <div className="max-w-4xl mx-auto px-6">
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center mb-12">
               <h3 className="text-2xl font-bold text-red-400 mb-4 flex items-center justify-center gap-3">
                  <Phone className="w-6 h-6" /> Ligne d'Urgence
               </h3>
               <p className="text-gray-300 mb-6">Si vous traversez une crise majeure, n'attendez pas.</p>
               <div className="text-3xl font-bold text-white tracking-widest">01 23 45 67 89</div>
               <p className="text-sm text-gray-500 mt-2">Dispo 24/7 pour les étudiants inscrits</p>
            </div>

            <div className="text-center">
               <div className="inline-flex items-center gap-2 text-gray-400 text-sm">
                  <Shield className="w-4 h-4" />
                  Confidentialité Totale Garantie • Secret Professionnel • Anonymat Respecté
               </div>
            </div>
         </div>
      </section>

    </div>
  );
};

import { User } from 'lucide-react'; // Import missing icon
export default SoutienEmotionnelPage;