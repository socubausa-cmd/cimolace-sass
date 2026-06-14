import React from 'react';
import { Calendar as CalendarIcon, Video, GraduationCap, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';

const EventCard = ({ event }) => {
  const isEventPast = isPast(new Date(event.date)) && !isToday(new Date(event.date));
  
  const getIcon = (type) => {
    switch(type) {
      case 'live': return <Video className="w-5 h-5 text-blue-400" />;
      case 'evaluation': return <GraduationCap className="w-5 h-5 text-[#D4AF37]" />;
      default: return <Users className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <Card className={`mb-4 bg-[#192734] border-white/10 ${isEventPast ? 'opacity-50' : ''}`}>
       <CardContent className="p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-16 text-center bg-black/20 rounded-lg py-2 border border-white/5">
             <span className="block text-sm text-gray-400 uppercase">{format(new Date(event.date), 'MMM', { locale: fr })}</span>
             <span className="block text-xl font-bold text-white">{format(new Date(event.date), 'dd')}</span>
          </div>
          
          <div className="flex-1">
             <div className="flex items-center gap-2 mb-1">
                {getIcon(event.type)}
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{event.type}</span>
                <span className="text-sm text-gray-500">• {format(new Date(event.date), 'HH:mm')}</span>
             </div>
             <h3 className="text-lg font-bold text-white">{event.title}</h3>
             <p className="text-sm text-gray-400">{event.description}</p>
          </div>

          <div className="flex-shrink-0">
             {event.link && !isEventPast && (
               <a href={event.link} target="_blank" rel="noopener noreferrer">
                 <Button size="sm" className="bg-[#D4AF37] text-black hover:bg-yellow-500">
                   Rejoindre
                 </Button>
               </a>
             )}
             {isEventPast && <span className="text-sm text-gray-500 italic">Terminé</span>}
          </div>
       </CardContent>
    </Card>
  );
};

const EventsSection = ({ data }) => {
  const upcomingEvents = data.filter(e => !isPast(new Date(e.date)) || isToday(new Date(e.date))).sort((a,b) => new Date(a.date) - new Date(b.date));
  const pastEvents = data.filter(e => isPast(new Date(e.date)) && !isToday(new Date(e.date))).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-[#D4AF37]" /> Événements à venir
        </h2>
        {upcomingEvents.length > 0 ? (
          upcomingEvents.map(evt => <EventCard key={evt.id} event={evt} />)
        ) : (
          <p className="text-gray-500">Aucun événement à venir.</p>
        )}
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-400 flex items-center gap-2">
          Historique
        </h2>
        <div className="opacity-70">
           {pastEvents.slice(0, 5).map(evt => <EventCard key={evt.id} event={evt} />)}
        </div>
      </div>
    </div>
  );
};

export default EventsSection;