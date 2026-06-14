import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, PlayCircle, CheckCircle, Lock, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const FormationDetailView = ({ formation }) => {
  const [expandedModule, setExpandedModule] = useState(null);
  const [expandedWeek, setExpandedWeek] = useState(null);

  const toggleModule = (id) => setExpandedModule(expandedModule === id ? null : id);
  const toggleWeek = (id) => setExpandedWeek(expandedWeek === id ? null : id);

  return (
    <div className="border border-white/10 rounded-xl bg-[#0F1419]/50 overflow-hidden mt-4 animate-in slide-in-from-top-4 duration-300">
       <div className="p-4 md:p-6 border-b border-white/10 bg-[#192734]">
          <h2 className="text-2xl font-bold text-white mb-2">{formation.title} - Programme détaillé</h2>
          <p className="text-gray-400">{formation.description}</p>
       </div>

       <div className="p-4 md:p-6 space-y-4">
          {formation.modules.map((mod, modIdx) => (
             <div key={mod.id} className="border border-white/10 rounded-lg overflow-hidden bg-[#192734] transition-all hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
                <div 
                   className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                   onClick={() => toggleModule(mod.id)}
                >
                   <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-[#0F1419] border border-white/10 flex items-center justify-center text-[var(--school-accent)] font-bold text-sm">
                         {modIdx + 1}
                      </div>
                      <div>
                         <h4 className="font-bold text-white text-lg">{mod.title}</h4>
                         <div className="flex gap-4 text-sm text-gray-400 mt-1">
                            <span>{mod.weeks.length} semaines</span>
                            <span>•</span>
                            <span>{mod.weeks.reduce((acc, w) => acc + w.days.reduce((dAcc, d) => dAcc + d.videos.length, 0), 0)} vidéos</span>
                         </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="w-24 hidden md:block">
                         <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                            <span>Progression</span>
                            <span>30%</span>
                         </div>
                         <Progress value={30} className="h-1 bg-gray-700" indicatorClassName="bg-blue-500" />
                      </div>
                      {expandedModule === mod.id ? <ChevronDown className="w-5 h-5 text-[var(--school-accent)]" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                   </div>
                </div>

                <AnimatePresence>
                   {expandedModule === mod.id && (
                      <motion.div
                         initial={{ height: 0, opacity: 0 }}
                         animate={{ height: 'auto', opacity: 1 }}
                         exit={{ height: 0, opacity: 0 }}
                         className="overflow-hidden bg-[#0F1419]"
                      >
                         {mod.weeks.map(week => (
                            <div key={week.id} className="border-b border-white/5 last:border-0">
                               <div 
                                  className="flex items-center justify-between px-12 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                                  onClick={() => toggleWeek(week.id)}
                               >
                                  <div className="flex items-center gap-3">
                                     {expandedWeek === week.id ? <ChevronDown className="w-4 h-4 text-[var(--school-accent)]" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                                     <span className="text-sm font-medium text-gray-200">{week.title}</span>
                                     <span className="text-sm text-gray-500 ml-2">({week.days.length} jours)</span>
                                  </div>
                               </div>

                               <AnimatePresence>
                                  {expandedWeek === week.id && (
                                     <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        className="overflow-hidden bg-[#0a0e12]"
                                     >
                                        <div className="pl-16 pr-6 py-2 space-y-1 border-l-2 border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] ml-12 mb-2">
                                           {week.days.map(day => (
                                              <div key={day.id} className="flex justify-between items-center py-2 px-3 rounded hover:bg-white/5 group transition-all">
                                                 <div className="flex items-center gap-3">
                                                    {Math.random() > 0.7 ? (
                                                       <CheckCircle className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                       <PlayCircle className="w-4 h-4 text-gray-500 group-hover:text-[var(--school-accent)]" />
                                                    )}
                                                    <div>
                                                       <p className="text-sm text-gray-300 group-hover:text-white transition-colors">{day.title}</p>
                                                       <div className="flex gap-3 text-[10px] text-gray-500 mt-0.5">
                                                          <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> 45 min</span>
                                                          <span className="flex items-center gap-1"><FileText className="w-3 h-3"/> {day.videos.length} vidéos</span>
                                                       </div>
                                                    </div>
                                                 </div>
                                                 <Link to={`/classroom/video/${formation.id}/${mod.id}/${week.id}/${day.id}`}>
                                                    <Button size="sm" variant="outline" className="h-7 text-xs border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-[var(--school-accent)] hover:bg-[var(--school-accent)] hover:text-black">
                                                       Accéder
                                                    </Button>
                                                 </Link>
                                              </div>
                                           ))}
                                        </div>
                                     </motion.div>
                                  )}
                               </AnimatePresence>
                            </div>
                         ))}
                      </motion.div>
                   )}
                </AnimatePresence>
             </div>
          ))}
       </div>
    </div>
  );
};

export default FormationDetailView;