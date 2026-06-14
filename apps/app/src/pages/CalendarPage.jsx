import React from 'react';
import { Helmet } from 'react-helmet';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CalendarPage = () => {
  const events = [
    { day: 15, month: "OCT", title: "Cérémonie d'Ouverture", time: "10:00 - 13:00", type: "Ceremony", location: "Grand Hall" },
    { day: 22, month: "OCT", title: "Début des Cours (Cycle 1)", time: "09:00", type: "Academic", location: "Salle A" },
    { day: 5, month: "NOV", title: "Conférence : Alchimie", time: "18:00 - 20:00", type: "Conference", location: "En ligne" },
    { day: 12, month: "NOV", title: "Remise des Travaux (T1)", time: "23:59", type: "Deadline", location: "Plateforme" },
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <Helmet>
        <title>Calendrier Scolaire | PRORASCIENCE</title>
      </Helmet>

      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10">
           <h1 className="text-3xl font-serif font-bold">Calendrier Scolaire 2024-2025</h1>
           <div className="flex gap-2 mt-4 md:mt-0">
              <Button variant="outline" className="border-white/10 text-white"><ChevronLeft className="w-4 h-4"/></Button>
              <span className="px-4 py-2 bg-[#192734] border border-white/10 rounded-lg font-bold">Octobre 2024</span>
              <Button variant="outline" className="border-white/10 text-white"><ChevronRight className="w-4 h-4"/></Button>
           </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
           {/* Calendar Grid Visual Placeholder */}
           <div className="lg:col-span-2 bg-[#192734] border border-white/10 rounded-2xl p-6 min-h-[400px]">
              {/* Simplified Grid for Demo */}
              <div className="grid grid-cols-7 gap-2 mb-4 text-center text-gray-400 text-sm font-bold">
                 <div>LUN</div><div>MAR</div><div>MER</div><div>JEU</div><div>VEN</div><div>SAM</div><div>DIM</div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                 {[...Array(31)].map((_, i) => (
                    <div key={i} className={`aspect-square rounded-lg border border-white/5 flex items-center justify-center relative hover:bg-white/5 cursor-pointer ${i === 14 ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] border-[var(--school-accent)]' : ''}`}>
                       <span className="text-sm">{i + 1}</span>
                       {i === 14 && <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[var(--school-accent)]"></div>}
                    </div>
                 ))}
              </div>
           </div>

           {/* Upcoming Events List */}
           <div className="space-y-4">
              <h3 className="font-bold text-lg mb-4">Événements à Venir</h3>
              {events.map((evt, i) => (
                 <div key={i} className="bg-[#192734] border border-white/5 rounded-xl p-4 flex gap-4 hover:bg-white/5 transition-colors">
                    <div className="bg-[#0F1419] rounded-lg p-2 text-center min-w-[60px] border border-white/10 flex flex-col justify-center">
                       <span className="text-xl font-bold text-white block">{evt.day}</span>
                       <span className="text-sm text-gray-500 font-bold uppercase">{evt.month}</span>
                    </div>
                    <div>
                       <h4 className="font-bold text-white mb-1">{evt.title}</h4>
                       <div className="flex gap-3 text-sm text-gray-400">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {evt.time}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {evt.location}</span>
                       </div>
                       <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                          evt.type === 'Ceremony' ? 'bg-purple-500/20 text-purple-400' : 
                          evt.type === 'Deadline' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                       }`}>
                          {evt.type}
                       </span>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;