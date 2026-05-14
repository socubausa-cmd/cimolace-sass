import React from 'react';
import { Calendar, Clock, Video, PlayCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const LiveStatusBadge = ({ status }) => {
   switch(status) {
      case 'live': return <Badge className="bg-red-600 animate-pulse gap-1"><span className="w-2 h-2 bg-white rounded-full"></span> EN DIRECT</Badge>;
      case 'upcoming': return <Badge variant="outline" className="text-blue-400 border-blue-400/30 bg-blue-400/10 gap-1"><Clock className="w-3 h-3" /> À VENIR</Badge>;
      case 'replay': return <Badge variant="secondary" className="bg-white/10 text-gray-300 gap-1"><PlayCircle className="w-3 h-3" /> REPLAY DISPONIBLE</Badge>;
      default: return null;
   }
};

export const WeeklyLiveBlock = ({ liveData }) => {
  if (!liveData) return null;
  const isReplay = liveData.status === 'replay' || new Date(liveData.date) < new Date();
  const openLiveOrReplay = () => {
    const url = liveData.replayUrl || liveData.url || '';
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className="overflow-hidden bg-[#192734] border-white/10 hover:border-[#D4AF37]/50 transition-all duration-300 shadow-lg group">
       <div className="flex flex-col md:flex-row">
          <div className="md:w-1/3 relative h-48 md:h-auto overflow-hidden bg-gradient-to-br from-[#203244] to-[#101a24]">
             {liveData.thumbnail ? (
               <img
                 src={liveData.thumbnail}
                 alt={liveData.title}
                 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                 onError={(e) => {
                   e.currentTarget.style.display = 'none';
                 }}
               />
             ) : null}
             {!liveData.thumbnail ? (
               <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                 <Video className="w-7 h-7" />
               </div>
             ) : null}
             <div className="absolute top-3 left-3">
                <LiveStatusBadge status={liveData.status === 'upcoming' ? (new Date(liveData.date) < new Date() ? 'live' : 'upcoming') : liveData.status} />
             </div>
          </div>
          <div className="p-6 flex flex-col justify-center flex-1">
             <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#D4AF37] transition-colors">{liveData.title}</h3>
             
             <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-6">
                <div className="flex items-center gap-2">
                   <User className="w-4 h-4 text-[#D4AF37]" />
                   {liveData.instructor}
                </div>
                <div className="flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-blue-400" />
                   {format(new Date(liveData.date), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </div>
                <div className="flex items-center gap-2">
                   <Clock className="w-4 h-4 text-green-400" />
                   {liveData.duration}
                </div>
             </div>

             <div className="flex gap-3 mt-auto">
               <Button
                 className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold"
                 onClick={openLiveOrReplay}
                 disabled={!liveData.replayUrl && !liveData.url}
               >
                  {isReplay ? 'Regarder le Replay' : 'Rejoindre le Live'}
                </Button>
                <Button variant="outline" className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5">
                   Ajouter au calendrier
                </Button>
             </div>
          </div>
       </div>
    </Card>
  );
};

export const ClosingLiveBlock = ({ liveData }) => {
   // Reusing the same structure but distinct component for semantic clarity in usage
   return <WeeklyLiveBlock liveData={liveData} />;
};