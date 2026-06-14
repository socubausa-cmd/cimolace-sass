import React from 'react';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import Header from '@/components/Header';

const StudentWorkshopRegistration = () => {
  return (
    <div className="min-h-screen bg-[#0F1419] flex flex-col">
       <Header />
       <main className="flex-grow pt-24 px-4 container mx-auto text-white">
          <div className="max-w-4xl mx-auto">
             <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-full text-[var(--school-accent)]">
                   <Users className="w-8 h-8" />
                </div>
                <div>
                   <h1 className="text-3xl font-bold">Ateliers Disponibles</h1>
                   <p className="text-gray-400">Inscrivez-vous aux prochains ateliers exclusifs.</p>
                </div>
             </div>
             
             <div className="bg-[#192734] border border-white/10 rounded-xl p-12 text-center text-gray-400">
                <p className="text-lg mb-4">Aucun atelier ouvert aux inscriptions pour le moment.</p>
                <Button className="bg-[var(--school-accent)] text-black">Me prévenir</Button>
             </div>
          </div>
       </main>
    </div>
  );
};

export default StudentWorkshopRegistration;