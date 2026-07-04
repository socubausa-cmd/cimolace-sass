import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  ChevronLeft, ChevronRight, Clock, MapPin, Calendar as CalendarIcon, 
  X, Video, Users, BookOpen, AlertCircle, Award, Mic, Search, Filter,
  Check, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';

// --- Constants & Config ---
const EVENT_COLORS = {
  'Cours': { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  'Conférence': { bg: 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]', text: 'text-[var(--school-accent)]', border: 'border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]', dot: 'bg-[var(--school-accent)]' },
  'Permanence': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', dot: 'bg-green-500' },
  'Évaluation': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  'Examen': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' },
  'Cérémonie': { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', dot: 'bg-rose-500' },
  'Assemblée': { bg: 'bg-gray-400/20', text: 'text-gray-300', border: 'border-gray-400/30', dot: 'bg-gray-400' },
  // Types institutionnels (données réelles côté admin, en anglais)
  'period': { bg: 'bg-stone-400/20', text: 'text-stone-300', border: 'border-stone-400/30', dot: 'bg-stone-400' },
  'holiday': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  'exam': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' },
  'event': { bg: 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]', text: 'text-[var(--school-accent)]', border: 'border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]', dot: 'bg-[var(--school-accent)]' }
};

const EVENT_ICONS = {
  'Cours': BookOpen,
  'Conférence': Mic,
  'Permanence': Users,
  'Évaluation': AlertCircle,
  'Examen': AlertCircle,
  'Cérémonie': Award,
  'Assemblée': Users,
};

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// --- Utility Functions ---
const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const getFirstDayOfMonth = (date) => {
  const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return day === 0 ? 6 : day - 1; // Adjust for Monday start (0=Mon, 6=Sun)
};
const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};
const formatTime = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

// --- Sub-Components ---

// 1. SearchBar (Refined)
const SearchBar = ({ searchTerm, setSearchTerm }) => (
  <div className="relative w-full md:w-64">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <Input 
      type="text" 
      placeholder="Rechercher..." 
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="pl-9 bg-[#18130f] border-white/10 text-white placeholder:text-gray-500 focus:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] h-10 text-sm"
    />
  </div>
);

// 2. UpcomingEventsWidget (Updated for School Calendar Schema)
const UpcomingEventsWidget = ({ events }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const upcoming = useMemo(() => {
    return events
      .filter(e => {
        const eventStart = new Date(e.start_date);
        return eventStart > now;
      })
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .slice(0, 5);
  }, [events, now]);

  const getTimeRemaining = (dateStr) => {
    const eventDate = new Date(dateStr);
    const diff = eventDate - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}j ${hours}h`;
    return `${hours}h`;
  };

  return (
    <div className="bg-gradient-to-br from-[#2b2219] to-[#18130f] border border-white/10 rounded-xl p-6 relative overflow-hidden group mt-6">
      <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <Clock className="w-5 h-5 text-[var(--school-accent)]" />
        <h3 className="text-lg font-bold text-white font-serif">Prochains Événements</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
        {upcoming.length > 0 ? upcoming.map((evt, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={evt.id} 
            className="bg-[#18130f]/50 border border-white/5 rounded-lg p-3 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all group/card relative overflow-hidden flex flex-col justify-between h-full min-h-[100px]"
          >
            <div className={cn("absolute top-0 left-0 w-1 h-full", EVENT_COLORS[evt.type]?.dot || 'bg-gray-500')} />
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] uppercase text-gray-500 font-bold">{new Date(evt.start_date).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})}</span>
                <span className="text-[10px] font-mono text-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-1.5 rounded">{getTimeRemaining(evt.start_date)}</span>
              </div>
              <h4 className="text-sm font-bold text-white line-clamp-2 mb-1 group-hover/card:text-[var(--school-accent)] transition-colors" title={evt.title}>
                {evt.title}
              </h4>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-2">
               <Clock className="w-3 h-3" /> {formatTime(evt.start_date)}
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full text-center py-8 text-gray-500 italic text-sm">
            Aucun événement à venir prochainement.
          </div>
        )}
      </div>
    </div>
  );
};

// 3. InteractiveCalendar
const InteractiveCalendar = ({ events, currentDate, setCurrentDate, selectedDate, onDateSelect }) => {
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const blanks = Array.from({ length: firstDay });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // Helper to format date key "YYYY-MM-DD"
  const getDateKey = (dateObj) => {
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  };

  const todayKey = getDateKey(new Date());

  return (
    <div className="bg-[#2b2219] border border-white/10 rounded-xl overflow-hidden shadow-lg h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#221b15]">
        <h3 className="text-xl font-bold text-white font-serif capitalize flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-[var(--school-accent)]" />
          {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="hover:text-[var(--school-accent)] hover:bg-white/5">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} className="hover:text-[var(--school-accent)] hover:bg-white/5">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-7 border-b border-white/10 bg-[#18130f]/50">
        {DAYS.map(day => (
          <div key={day} className="py-2 text-center text-[10px] uppercase font-bold text-gray-500 tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 auto-rows-fr flex-1 bg-[#18130f]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentDate.toString()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="contents"
          >
            {blanks.map((_, i) => (
              <div key={`blank-${i}`} className="border-r border-b border-white/5 min-h-[80px] sm:min-h-[100px] bg-[#18130f]/30" />
            ))}
            
            {days.map(day => {
              const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
              const dateKey = getDateKey(d);
              
              // Filter events for this day
              const dayEvents = events.filter(e => {
                const eventDateKey = getDateKey(new Date(e.start_date));
                return eventDateKey === dateKey;
              });

              const isSelected = selectedDate === dateKey;
              const isToday = todayKey === dateKey;

              return (
                <div 
                  key={day} 
                  onClick={() => onDateSelect(dateKey)}
                  className={cn(
                    "relative border-r border-b border-white/5 p-2 transition-all cursor-pointer hover:bg-white/5 flex flex-col min-h-[80px] sm:min-h-[100px]",
                    isSelected && "bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] ring-1 ring-inset ring-[var(--school-accent)]",
                    isToday && !isSelected && "bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)] shadow-[inset_0_0_10px_color-mix(in_srgb,var(--school-accent)_12%,transparent)]"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                     <span className={cn(
                       "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                       isSelected ? "bg-[var(--school-accent)] text-black" : 
                       isToday ? "bg-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-[var(--school-accent)]" : "text-gray-400"
                     )}>
                       {day}
                     </span>
                     {isToday && <span className="w-1.5 h-1.5 bg-[var(--school-accent)] rounded-full animate-pulse" />}
                  </div>
                  
                  <div className="flex flex-wrap content-start gap-1">
                    {dayEvents.map((evt) => (
                      <div 
                        key={evt.id}
                        className={cn("w-2 h-2 rounded-full", EVENT_COLORS[evt.type]?.dot || 'bg-gray-500')} 
                        title={evt.title}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// 4. EventDetailPanel
const EventDetailPanel = ({ date, events, onViewFullDetails }) => {
  if (!date) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#2b2219] border border-white/10 rounded-xl text-gray-500">
        <div className="p-4 rounded-full bg-white/5 mb-4">
           <CalendarIcon className="w-8 h-8 opacity-50" />
        </div>
        <p>Sélectionnez une date pour voir les événements.</p>
      </div>
    );
  }

  const formattedDate = formatDate(date);

  return (
    <div className="h-full flex flex-col bg-[#2b2219] border border-white/10 rounded-xl overflow-hidden shadow-lg">
      <div className="p-4 border-b border-white/10 bg-[#221b15]">
        <h3 className="text-lg font-bold text-white font-serif capitalize">{formattedDate}</h3>
        <p className="text-sm text-gray-400 mt-1">{events.length} événement(s) prévu(s)</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#18130f]/20">
        <AnimatePresence mode="popLayout">
          {events.length > 0 ? events.map((evt) => (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-[#18130f] border border-white/5 rounded-lg p-4 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all group relative overflow-hidden"
            >
              <div className={cn("absolute left-0 top-0 bottom-0 w-1", EVENT_COLORS[evt.type]?.dot || 'bg-gray-500')} />
              
              <div className="pl-3">
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-[10px] uppercase font-bold px-2 py-0.5 rounded border",
                    EVENT_COLORS[evt.type]?.bg || 'bg-gray-800',
                    EVENT_COLORS[evt.type]?.text || 'text-gray-400',
                    EVENT_COLORS[evt.type]?.border || 'border-gray-700'
                  )}>
                    {evt.type}
                  </span>
                  <span className="text-xs font-mono text-gray-400 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatTime(evt.start_date)}
                  </span>
                </div>
                
                <h4 className="text-white font-bold text-sm mb-2 group-hover:text-[var(--school-accent)] transition-colors">{evt.title}</h4>
                <div className="flex items-center text-sm text-gray-500 mb-3">
                   <MapPin className="w-3 h-3 mr-1" /> {evt.location || 'N/A'}
                </div>
                
                <Button 
                  onClick={() => onViewFullDetails(evt)}
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs h-8 bg-white/5 hover:bg-[var(--school-accent)] hover:text-black border border-white/5 transition-colors"
                >
                  Voir détails complets <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </div>
            </motion.div>
          )) : (
            <div className="text-center py-10 text-gray-500 text-sm italic">
              Aucun événement pour ce jour.
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// 5. EventDetailModal (Refined)
export const EventDetailModal = ({ event, onClose }) => {
  if (!event) return null;

  const Icon = EVENT_ICONS[event.type] || CalendarIcon;
  const colorSet = EVENT_COLORS[event.type] || EVENT_COLORS['Assemblée'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#2b2219] border border-white/10 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10 transition-colors p-1 bg-black/20 rounded-full">
          <X className="w-5 h-5" />
        </button>
        
        <div className="h-32 bg-gradient-to-br from-[#18130f] to-[#221b15] relative overflow-hidden flex items-end p-6">
           <div className="absolute inset-0 bg-grid-white/[0.05]" />
           <div className="relative z-10 flex items-center gap-4">
              <div className={cn("p-4 rounded-2xl border backdrop-blur-md shadow-xl", colorSet.bg, colorSet.border, colorSet.text)}>
                <Icon className="w-8 h-8" />
              </div>
              <div>
                <span className={cn("text-xs uppercase tracking-wider font-bold block mb-1", colorSet.text)}>{event.type}</span>
                <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">{event.title}</h3>
              </div>
           </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#18130f] p-3 rounded-lg border border-white/5 flex items-center gap-3">
               <CalendarIcon className="w-5 h-5 text-[var(--school-accent)]" />
               <div className="flex flex-col">
                 <span className="text-[10px] text-gray-500 uppercase">Date</span>
                 <span className="text-sm font-bold text-white">{new Date(event.start_date).toLocaleDateString('fr-FR')}</span>
               </div>
            </div>
            <div className="bg-[#18130f] p-3 rounded-lg border border-white/5 flex items-center gap-3">
               <Clock className="w-5 h-5 text-[var(--school-accent)]" />
               <div className="flex flex-col">
                 <span className="text-[10px] text-gray-500 uppercase">Horaire</span>
                 <span className="text-sm font-bold text-white">
                   {formatTime(event.start_date)} - {formatTime(event.end_date)}
                 </span>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-400 bg-white/5 p-3 rounded-lg">
             <MapPin className="w-4 h-4 text-gray-500" />
             Lieu: <span className="text-white ml-1">{event.location || 'En ligne'}</span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Description</h4>
            <p className="text-gray-300 text-sm leading-relaxed max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
              {event.description || "Aucune description supplémentaire disponible pour cet événement."}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-2">
             <span className="text-sm text-gray-500">Cycle:</span>
             <span className="inline-block px-2 py-0.5 bg-white/10 rounded text-xs text-white font-bold border border-white/10">
               {event.cycle || 'Tous'}
             </span>
          </div>

          <div className="pt-4 flex gap-3 border-t border-white/10 mt-4">
             <Button className="flex-1 bg-[var(--school-accent)] hover:bg-[#b5952f] text-black font-bold">
                Ajouter à l'agenda
             </Button>
             {event.location && (event.location.includes('http') || event.location.includes('Zoom')) && (
               <Button onClick={() => window.open(event.location, '_blank')} variant="outline" className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                 <Video className="w-4 h-4 mr-2" /> REJOINDRE
               </Button>
             )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// 7. CalendarSection (Main Wrapper Updated)
export const CalendarSection = () => {
  const [allEvents, setAllEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [modalEvent, setModalEvent] = useState(null);

  // Fetch Data from 'school_calendar'
  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('school_calendar')
        .select('*')
        .order('start_date', { ascending: true });
        
      if (data) setAllEvents(data);
    };
    fetchEvents();
  }, []);

  // Filter Logic
  const filteredEvents = useMemo(() => {
    return allEvents.filter(evt => {
      const matchesSearch = evt.title.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [allEvents, searchTerm]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return filteredEvents.filter(e => {
       // Convert timestamp to YYYY-MM-DD for comparison
       const evtDate = new Date(e.start_date);
       const dateKey = `${evtDate.getFullYear()}-${String(evtDate.getMonth() + 1).padStart(2, '0')}-${String(evtDate.getDate()).padStart(2, '0')}`;
       return dateKey === selectedDate;
    });
  }, [filteredEvents, selectedDate]);

  return (
    <div className="space-y-6">
      {/* Top Bar: Search Only for simplicity/space, filters can be added if needed */}
      <div className="flex justify-end">
        <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      </div>

      {/* Middle: Calendar & Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[700px]">
        {/* Calendar Grid (60%) */}
        <div className="lg:col-span-3 h-full">
          <InteractiveCalendar 
            events={filteredEvents}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
          />
        </div>
        
        {/* Detail Panel (40%) */}
        <div className="lg:col-span-2 h-full">
          <EventDetailPanel 
            date={selectedDate} 
            events={selectedDayEvents} 
            onViewFullDetails={setModalEvent}
          />
        </div>
      </div>

      {/* Bottom: Upcoming Widget */}
      <div className="pt-2 border-t border-white/5">
        <UpcomingEventsWidget events={allEvents} />
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalEvent && (
          <EventDetailModal event={modalEvent} onClose={() => setModalEvent(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};