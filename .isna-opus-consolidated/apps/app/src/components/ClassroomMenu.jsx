import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, Clock, Users, Video } from 'lucide-react';
import { useActiveClasses } from '@/hooks/useActiveClasses';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ClassroomMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { activeClasses, loading } = useActiveClasses();
  const rootRef = useRef(null);

  const currentClasses = activeClasses.filter(c => c.status === 'active');
  const upcomingClasses = activeClasses.filter(c => c.status === 'upcoming');
  const activeCount = currentClasses.length;

  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  return (
    <div 
      ref={rootRef}
      className="relative h-full flex items-center"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button 
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 text-[0.8rem] xl:text-sm font-medium transition-all duration-300 rounded-lg group ${
          isOpen || activeCount > 0 ? 'text-[#D4AF37] bg-white/5' : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}
      >
        <div className="relative">
          <BookOpen className={`w-4 h-4 xl:w-5 xl:h-5 ${isOpen || activeCount > 0 ? 'text-[#D4AF37]' : 'text-gray-500 group-hover:text-white'}`} />
          {activeCount > 0 && (
            <span className="absolute -top-2 -right-2 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] text-white justify-center items-center">
                {activeCount}
              </span>
            </span>
          )}
        </div>
        <span className="uppercase tracking-tight font-bold whitespace-nowrap hidden lg:inline">Aller en classe</span>
        <ChevronDown 
          className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#D4AF37]' : 'text-gray-600'}`} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-1/2 -translate-x-1/2 top-[calc(100%-0.5rem)] pt-4 w-80 z-50"
          >
            <div className="bg-[#192734]/95 border border-white/10 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-md ring-1 ring-black/5">
              
              {/* Decorative top border */}
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-80"></div>
              
              <div className="p-3">
                <div className="mb-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider flex justify-between items-center">
                  <span>En direct</span>
                  {activeCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                </div>

                {loading ? (
                  <div className="p-4 text-center text-sm text-gray-500">Chargement...</div>
                ) : currentClasses.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {currentClasses.map((cls) => (
                      <Link 
                        key={cls.id} 
                        to={`/classroom/${cls.id}`}
                        className="block p-3 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20 hover:bg-[#D4AF37]/20 transition-colors group"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-bold text-white group-hover:text-[#D4AF37] transition-colors">{cls.title}</h4>
                          <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-400 bg-red-500/10 px-1.5 py-0.5 h-auto">En cours</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                          <span className="bg-white/10 px-1.5 rounded">{cls.professor}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                             <Users className="w-3 h-3" /> {cls.participants} présents
                          </div>
                          <div className="flex items-center gap-1 text-[#D4AF37]">
                             Rejoindre <Video className="w-3 h-3" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-sm text-gray-500 bg-white/5 rounded-lg mb-4">
                    Aucun cours en direct actuellement
                  </div>
                )}

                {upcomingClasses.length > 0 && (
                  <>
                    <div className="mb-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2 border-t border-white/10 pt-2">
                      À venir
                    </div>
                    <div className="space-y-1">
                      {upcomingClasses.map((cls) => (
                        <div key={cls.id} className="p-2 rounded hover:bg-white/5 transition-colors">
                           <div className="flex justify-between items-center">
                              <h5 className="text-sm text-gray-300 font-medium truncate max-w-[180px]">{cls.title}</h5>
                              <span className="text-xs text-[#D4AF37] font-mono">
                                 {format(new Date(cls.startTime), 'HH:mm')}
                              </span>
                           </div>
                           <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                              <Clock className="w-3 h-3" /> Commence dans {Math.round((new Date(cls.startTime) - new Date()) / 60000)} min
                           </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="mt-3 pt-2 border-t border-white/10">
                  <Link to="/vie-scolaire?tab=calendar" className="block text-center text-xs text-[#D4AF37] hover:text-white transition-colors py-1">
                    Voir tout l'emploi du temps
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClassroomMenu;