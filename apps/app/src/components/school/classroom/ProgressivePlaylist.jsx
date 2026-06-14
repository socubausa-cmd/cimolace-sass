import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, PlayCircle, CheckCircle, Circle, Lock, ArrowLeft, ArrowRight, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ProgressivePlaylist = ({ 
   playlistData, 
   currentFormationId, 
   currentModuleId,
   currentWeekId,
   currentDayId,
   currentVideoId,
   onVideoSelect 
}) => {
  // Navigation State (Accordion)
  const [expandedModules, setExpandedModules] = useState([currentModuleId]);
  const [expandedWeeks, setExpandedWeeks] = useState([currentWeekId]);
  const [expandedDays, setExpandedDays] = useState([currentDayId]);

  const toggleModule = (id) => {
    setExpandedModules(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const toggleWeek = (id) => {
    setExpandedWeeks(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const toggleDay = (id) => {
    setExpandedDays(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const currentFormation = playlistData.find(f => f.id === currentFormationId) || playlistData[0];
  if (!currentFormation) return null;

  return (
    <div className="flex flex-col h-full bg-[#151a21]/95 backdrop-blur-xl border-l border-white/10 w-full overflow-hidden">
       {/* Playlist Header */}
       <div className="p-4 border-b border-white/10 bg-gradient-to-b from-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] to-transparent shrink-0">
          <div className="flex items-center gap-2 text-[var(--school-accent)] mb-2">
             <div className="w-7 h-7 rounded-lg bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center">
               <LayoutList className="w-4 h-4" />
             </div>
             <span className="text-xs font-bold uppercase tracking-wider">Programme</span>
          </div>
          <h2 className="font-bold text-white text-base leading-tight mb-3 line-clamp-1">{currentFormation.title}</h2>
          
          <div className="space-y-1.5">
             <div className="flex justify-between text-xs text-gray-400">
                <span>Progression</span>
                <span className="text-[var(--school-accent)] font-medium">{currentFormation.progress}%</span>
             </div>
             <Progress value={currentFormation.progress} className="h-2 bg-white/5 rounded-full" indicatorClassName="bg-gradient-to-r from-[var(--school-accent)] to-amber-400" />
          </div>
       </div>

       {/* Scrollable Accordion Content */}
       <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
             {currentFormation.modules.map((module, mIdx) => (
                <div key={module.id} className="border border-white/10 rounded-xl overflow-hidden bg-[#151a21]/60 backdrop-blur">
                   <div 
                      className={cn(
                         "flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-all duration-200 rounded-t-xl",
                         expandedModules.includes(module.id) && "bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border-b border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]"
                      )}
                      onClick={() => toggleModule(module.id)}
                   >
                      <div className="flex items-center gap-3 overflow-hidden">
                         <Badge variant="outline" className="border-white/10 text-gray-500 text-[10px] h-5 min-w-[20px] justify-center">
                            {mIdx + 1}
                         </Badge>
                         <span className="text-sm font-semibold text-gray-200 truncate">{module.title}</span>
                      </div>
                      {expandedModules.includes(module.id) ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                   </div>

                   <AnimatePresence>
                      {expandedModules.includes(module.id) && (
                         <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                         >
                            <div className="pl-4 pr-2 py-1 space-y-1 border-t border-white/5">
                               {module.weeks.map((week, wIdx) => (
                                  <div key={week.id} className="border-l border-white/10 ml-2 pl-3 py-1">
                                     <div 
                                        className="flex items-center gap-2 cursor-pointer py-1 hover:text-[var(--school-accent)] transition-colors group"
                                        onClick={() => toggleWeek(week.id)}
                                     >
                                        {expandedWeeks.includes(week.id) ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
                                        <span className="text-xs font-medium text-gray-400 group-hover:text-white">{week.title}</span>
                                        <span className="text-[9px] bg-white/5 px-1.5 rounded text-gray-600 ml-auto">{week.progress}%</span>
                                     </div>

                                     {expandedWeeks.includes(week.id) && (
                                        <div className="mt-1 space-y-1 ml-1">
                                           {week.days.map((day, dIdx) => (
                                              <div key={day.id}>
                                                 <div 
                                                    className="flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-white/5"
                                                    onClick={() => toggleDay(day.id)}
                                                 >
                                                    {expandedDays.includes(day.id) ? <ChevronDown className="w-3 h-3 text-gray-600" /> : <ChevronRight className="w-3 h-3 text-gray-600" />}
                                                    <span className="text-sm text-gray-300">{day.title}</span>
                                                 </div>

                                                 {expandedDays.includes(day.id) && (
                                                    <div className="ml-3 pl-3 border-l border-white/5 space-y-1 my-1">
                                                       {day.videos.map((video, vIdx) => {
                                                          const isActive = video.id === currentVideoId;
                                                          const isCompleted = video.status === 'watched';
                                                          
                                                          return (
                                                             <motion.div 
                                                                key={video.id}
                                                                onClick={() => onVideoSelect(video, day.id, week.id, module.id)}
                                                                whileHover={{ x: 2 }}
                                                                className={cn(
                                                                   "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border",
                                                                   isActive 
                                                                      ? "bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] shadow-sm" 
                                                                      : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/10"
                                                                )}
                                                             >
                                                                <div className="shrink-0">
                                                                   {isCompleted ? (
                                                                      <CheckCircle className="w-4 h-4 text-green-500" />
                                                                   ) : isActive ? (
                                                                      <PlayCircle className="w-4 h-4 text-[var(--school-accent)]" />
                                                                   ) : (
                                                                      <Circle className="w-4 h-4 text-gray-600" />
                                                                   )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                   <p className={cn("text-xs truncate font-medium", isActive ? "text-[var(--school-accent)]" : "text-gray-400 group-hover:text-gray-200")}>
                                                                      {video.title}
                                                                   </p>
                                                                   <p className="text-[10px] text-gray-600 mt-0.5">{Math.floor(video.duration / 60)} min</p>
                                                                </div>
                                                             </motion.div>
                                                          )
                                                       })}
                                                    </div>
                                                 )}
                                              </div>
                                           ))}
                                        </div>
                                     )}
                                  </div>
                               ))}
                            </div>
                         </motion.div>
                      )}
                   </AnimatePresence>
                </div>
             ))}
          </div>
       </ScrollArea>

       {/* Sticky Footer Controls */}
       <div className="p-4 border-t border-white/10 bg-[#151a21]/80 backdrop-blur shrink-0 space-y-3">
          <Button className="w-full bg-[var(--school-accent)] hover:bg-amber-500 text-black font-bold h-9 text-xs uppercase tracking-wide shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
             <CheckCircle className="w-3 h-3 mr-2" /> Marquer comme terminé
          </Button>
          <div className="flex gap-2">
             <Button variant="outline" size="sm" className="flex-1 border-white/10 hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-gray-400 hover:text-[var(--school-accent)] h-8 text-xs">
                <ArrowLeft className="w-3 h-3 mr-1" /> Précédent
             </Button>
             <Button variant="outline" size="sm" className="flex-1 border-white/10 hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-gray-400 hover:text-[var(--school-accent)] h-8 text-xs">
                Suivant <ArrowRight className="w-3 h-3 ml-1" />
             </Button>
          </div>
       </div>
    </div>
  );
};

export default ProgressivePlaylist;