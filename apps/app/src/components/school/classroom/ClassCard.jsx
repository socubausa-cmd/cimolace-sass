import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Users, Video, PlayCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ClassCard = ({ classData }) => {
  const getStatusBadge = (status) => {
    switch(status) {
       case 'en_cours': return <Badge className="bg-red-500 text-white animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]">EN DIRECT 🔴</Badge>;
       case 'a_venir': return <Badge variant="outline" className="border-blue-500 text-blue-400 bg-blue-500/10">À venir</Badge>;
       case 'terminee': return <Badge variant="secondary" className="bg-gray-700 text-gray-400">Terminée</Badge>;
       default: return null;
    }
  };

  return (
    <Card className="bg-[#192734] border-white/10 overflow-hidden hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] hover:shadow-xl transition-all duration-300 group flex flex-col h-full">
       <div className="relative h-40 bg-gray-800 overflow-hidden">
          <img 
            src={`https://source.unsplash.com/random/800x600?classroom,lecture&sig=${classData.id}`} 
            alt={classData.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
          />
          <div className="absolute top-3 left-3 z-10">
             {getStatusBadge(classData.status)}
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#192734] to-transparent h-20"></div>
       </div>

       <div className="p-5 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-2">
             <h3 className="text-lg font-bold text-white group-hover:text-[var(--school-accent)] transition-colors line-clamp-2 leading-tight">
                {classData.title}
             </h3>
          </div>
          
          <div className="flex items-center gap-2 mb-4">
             <img src={classData.instructorAvatar || "https://i.pravatar.cc/150"} alt={classData.instructor} className="w-6 h-6 rounded-full border border-white/10" />
             <span className="text-sm text-gray-300 font-medium">{classData.instructor}</span>
          </div>

          <div className="space-y-2 mb-4 text-sm text-gray-400 flex-1">
             <div className="flex items-center gap-2 bg-[#0F1419] p-2 rounded border border-white/5">
                <Clock className="w-3.5 h-3.5 text-[var(--school-accent)]" />
                <span>
                   {format(new Date(classData.startTime), 'dd MMM yyyy • HH:mm', { locale: fr })}
                </span>
             </div>
             <div className="flex items-center gap-2 bg-[#0F1419] p-2 rounded border border-white/5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>{classData.participants} participants inscrits</span>
             </div>
          </div>

          <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
             {classData.status === 'en_cours' ? (
                <Link to={`/classroom/live/${classData.id}`} className="col-span-2">
                  <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold gap-2">
                     <Video className="w-4 h-4" /> Rejoindre
                  </Button>
                </Link>
             ) : classData.status === 'terminee' ? (
                <Button variant="outline" className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5 gap-2 col-span-2">
                   <PlayCircle className="w-4 h-4" /> Voir l'enregistrement
                </Button>
             ) : (
                <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold col-span-2">
                   S'inscrire
                </Button>
             )}
             
             {classData.status !== 'en_cours' && classData.status !== 'terminee' && (
                <Button variant="ghost" className="col-span-2 text-sm text-gray-400 hover:text-white h-8">
                   Voir les détails
                </Button>
             )}
          </div>
       </div>
    </Card>
  );
};

export default ClassCard;