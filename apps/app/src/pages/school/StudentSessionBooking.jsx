import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import Header from '@/components/Header';

const StudentSessionBooking = () => {
  return (
    <div className="min-h-screen bg-[#0F1419] flex flex-col">
       <Header />
       <main className="flex-grow pt-24 px-4 container mx-auto text-white">
          <div className="max-w-4xl mx-auto">
             <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-[#D4AF37]/10 rounded-full text-[#D4AF37]">
                   <Calendar className="w-8 h-8" />
                </div>
                <div>
                   <h1 className="text-3xl font-bold">Réserver une Session</h1>
                   <p className="text-gray-400">Choisissez un créneau pour votre coaching ou mentorat.</p>
                </div>
             </div>
             
             <div className="bg-[#192734] border border-white/10 rounded-xl p-12 text-center text-gray-400">
                <p className="text-lg mb-4">Le module de réservation est en cours de maintenance.</p>
                <Button className="bg-[#D4AF37] text-black">Retour au Dashboard</Button>
             </div>
          </div>
       </main>
    </div>
  );
};

export default StudentSessionBooking;