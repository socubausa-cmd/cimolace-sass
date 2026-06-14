import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { AlertCircle, Clock, MapPin, ExternalLink, Info, BookOpen, GraduationCap, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { EventDetailModal } from './CalendarComponents';
import { cn } from '@/lib/utils';

const CurrentEventAlert = () => {
  const [currentEvent, setCurrentEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentEvents = async () => {
      try {
        const now = new Date();
        const isoNow = now.toISOString();

        // Check for ongoing events in school_calendar table
        // We select events where start_date <= NOW and end_date > NOW
        const { data, error } = await supabase
          .from('school_calendar')
          .select('id,title,start_date,end_date,description')
          .lte('start_date', isoNow)
          .limit(20)
          .gt('end_date', isoNow);

        if (error) {
          console.error('Error fetching current events:', error);
          return;
        }

        if (data && data.length > 0) {
          // If multiple events are happening, take the first one (or prioritize by type if needed)
          setCurrentEvent(data[0]);
        } else {
          setCurrentEvent(null);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchCurrentEvents();

    // Check every 10 seconds as requested
    const interval = setInterval(fetchCurrentEvents, 10000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading && !currentEvent) return null; // Don't show anything while loading initially if nothing found
  if (!currentEvent) return null;

  const formatTime = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 z-50 relative"
        >
          <div className="animate-blink-bg border-2 border-red-600 rounded-xl p-4 md:p-6 shadow-[0_0_20px_rgba(220,38,38,0.4)] relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-6 backdrop-blur-md">
            
            {/* Header / Icon Section */}
            <div className="flex items-start md:items-center gap-4 w-full lg:w-auto">
              <div className="flex-shrink-0 relative">
                 <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
                 <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center border-2 border-red-400 relative z-10 shadow-lg">
                    <div className="w-4 h-4 md:w-5 md:h-5 bg-white rounded-full animate-pulse-custom shadow-[0_0_10px_white]" />
                 </div>
              </div>
              
              <div className="flex flex-col">
                <div className="flex items-center flex-wrap gap-2 mb-1">
                  <span className="text-[10px] md:text-xs font-black bg-red-600 text-white px-2 py-0.5 rounded shadow animate-pulse uppercase tracking-wider">
                    🔴 En Direct
                  </span>
                  <span className="text-[10px] md:text-xs font-bold text-red-200 uppercase tracking-widest border border-red-500/30 px-2 py-0.5 rounded bg-red-950/30">
                     Événement en cours
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-black text-white leading-tight font-serif tracking-tight drop-shadow-sm">
                  {currentEvent.title}
                </h3>
              </div>
            </div>

            {/* Info Section */}
            <div className="flex flex-wrap items-center justify-start lg:justify-center gap-x-6 gap-y-3 w-full lg:w-auto text-red-100/90 border-t lg:border-t-0 lg:border-l border-red-500/30 pt-4 lg:pt-0 lg:pl-6">
               <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-400" />
                  <span className="font-mono font-bold text-sm md:text-base">
                    {formatTime(currentEvent.start_date)} - {formatTime(currentEvent.end_date)}
                  </span>
               </div>
               
               <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-400" />
                  <span className="font-medium text-sm">
                    {currentEvent.location || 'En ligne'}
                  </span>
               </div>

               <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-red-400" />
                  <span className="font-medium text-sm bg-red-900/40 px-2 py-0.5 rounded border border-red-500/20">
                    {currentEvent.cycle || 'Tous'}
                  </span>
               </div>

               <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-red-400" />
                  <span className="font-medium text-sm italic opacity-80">
                    {currentEvent.type || 'Événement'}
                  </span>
               </div>
            </div>

            {/* Actions Section */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
              <Button 
                onClick={() => setShowModal(true)}
                variant="outline"
                className="w-full sm:w-auto border-red-400/30 hover:bg-red-500/20 text-red-100 hover:text-white transition-colors bg-red-950/20"
              >
                <Info className="w-4 h-4 mr-2" /> 
                Détails
              </Button>
              
              {/* Only show 'Rejoindre' if there's a link or if it's explicitly virtual */}
              <Button 
                onClick={() => {
                   if (currentEvent.location && (currentEvent.location.startsWith('http') || currentEvent.location.includes('www'))) {
                      window.open(currentEvent.location, '_blank');
                   } else {
                      // Fallback or specific logic for internal classrooms
                      window.open('https://zoom.us/join', '_blank'); // Placeholder fallback
                   }
                }}
                className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-red-400/50 animate-pulse-custom hover:animate-none transform hover:scale-105 transition-all"
              >
                <ExternalLink className="w-4 h-4 mr-2" /> 
                REJOINDRE MAINTENANT
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      
      {showModal && (
        <EventDetailModal event={currentEvent} onClose={() => setShowModal(false)} />
      )}
    </>
  );
};

export default CurrentEventAlert;