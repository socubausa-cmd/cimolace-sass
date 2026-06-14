import React, { useState, useEffect } from 'react';
import { BookOpen, PlayCircle, ChevronDown, ChevronRight, Clock, Award, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { generateRichFormations } from '@/lib/mockFormationData';
import { Link } from 'react-router-dom';

const ProgressiveLearningSectionComponent = () => {
  const [formations, setFormations] = useState([]);
  const [expandedFormation, setExpandedFormation] = useState(null);
  const [expandedModule, setExpandedModule] = useState(null);
  const [expandedWeek, setExpandedWeek] = useState(null);

  useEffect(() => {
    // Generate data on mount
    setFormations(generateRichFormations(4));
  }, []);

  const toggleFormation = (id) => setExpandedFormation(expandedFormation === id ? null : id);
  const toggleModule = (id) => setExpandedModule(expandedModule === id ? null : id);
  const toggleWeek = (id) => setExpandedWeek(expandedWeek === id ? null : id);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="grid grid-cols-1 gap-6">
          {formations.map(formation => (
             <Card key={formation.id} className="bg-[#192734] border-white/10 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                   {/* Thumbnail & Main Info */}
                   <div className="w-full md:w-64 h-48 md:h-auto bg-cover bg-center shrink-0 relative" style={{ backgroundImage: `url(${formation.thumbnail})` }}>
                      <div className="absolute inset-0 bg-black/50 md:bg-gradient-to-r md:from-black/80 md:to-transparent"></div>
                      <div className="absolute bottom-3 left-3 md:hidden">
                         <span className="bg-[var(--school-accent)] text-black text-xs font-bold px-2 py-1 rounded">{formation.level}</span>
                      </div>
                   </div>
                   
                   <div className="flex-1 p-6 space-y-4">
                      <div className="flex justify-between items-start">
                         <div>
                            <div className="flex items-center gap-2 mb-2">
                               <span className="hidden md:inline-block bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-xs font-bold px-2 py-0.5 rounded">{formation.level}</span>
                               <span className="text-gray-400 text-xs uppercase tracking-wider">{formation.category}</span>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">{formation.title}</h3>
                            <p className="text-gray-400 text-sm line-clamp-2">{formation.description}</p>
                         </div>
                         <div className="text-right hidden md:block">
                            <div className="text-3xl font-bold text-white">45%</div>
                            <div className="text-sm text-gray-500">Complété</div>
                         </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-400 border-t border-white/5 pt-4 mt-2">
                         <div className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {formation.modules.length} Modules</div>
                         <div className="flex items-center gap-1.5"><PlayCircle className="w-4 h-4" /> 45 Vidéos</div>
                         <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> 32h Total</div>
                         <div className="flex items-center gap-1.5"><Award className="w-4 h-4" /> Certificat inclus</div>
                      </div>

                      <div className="flex flex-col md:flex-row gap-3 pt-2">
                         <Button className="flex-1 bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold" onClick={() => toggleFormation(formation.id)}>
                            {expandedFormation === formation.id ? 'Masquer le contenu' : 'Voir le programme'}
                            <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${expandedFormation === formation.id ? 'rotate-180' : ''}`} />
                         </Button>
                         <Button variant="outline" className="border-white/10 text-white hover:bg-white/5">
                            Continuer l'apprentissage
                         </Button>
                      </div>
                   </div>
                </div>

                {/* Expanded Content */}
                {expandedFormation === formation.id && (
                   <div className="border-t border-white/10 bg-[#0F1419]/50 p-4 md:p-6 space-y-4 animate-in slide-in-from-top-2">
                      {formation.modules.map(mod => (
                         <div key={mod.id} className="border border-white/10 rounded-lg overflow-hidden bg-[#192734]">
                            <div 
                               className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                               onClick={() => toggleModule(mod.id)}
                            >
                               <div className="flex items-center gap-3">
                                  <div className="p-2 bg-[#0F1419] rounded-md text-[var(--school-accent)] border border-white/10">
                                     {expandedModule === mod.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </div>
                                  <div>
                                     <h4 className="font-bold text-white">{mod.title}</h4>
                                     <p className="text-sm text-gray-400">{mod.weeks.length} semaines • 12 vidéos</p>
                                  </div>
                               </div>
                               <div className="flex items-center gap-4">
                                  <div className="w-24 hidden md:block">
                                     <Progress value={30} className="h-1.5 bg-gray-700" indicatorClassName="bg-blue-500" />
                                  </div>
                                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">Ouvrir</Button>
                               </div>
                            </div>

                            {expandedModule === mod.id && (
                               <div className="border-t border-white/10 bg-[#0F1419]">
                                  {mod.weeks.map(week => (
                                     <div key={week.id} className="border-b border-white/5 last:border-0 pl-12 pr-4 py-3">
                                        <div 
                                           className="flex items-center justify-between cursor-pointer hover:text-[var(--school-accent)]"
                                           onClick={() => toggleWeek(week.id)}
                                        >
                                           <div className="flex items-center gap-2">
                                              {expandedWeek === week.id ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
                                              <span className="text-sm font-medium text-gray-200">{week.title}</span>
                                           </div>
                                           <span className="text-sm text-gray-500">{week.days.length} jours</span>
                                        </div>

                                        {expandedWeek === week.id && (
                                           <div className="mt-2 ml-6 space-y-1 border-l-2 border-white/10 pl-4 py-1">
                                              {week.days.map(day => (
                                                 <div key={day.id} className="flex justify-between items-center py-1.5 group">
                                                    <div className="flex items-center gap-2">
                                                       {Math.random() > 0.5 ? <CheckCircle className="w-3 h-3 text-green-500" /> : <PlayCircle className="w-3 h-3 text-gray-500 group-hover:text-[var(--school-accent)]" />}
                                                       <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{day.title}</span>
                                                    </div>
                                                    <Link to={`/classroom/video/${formation.id}/${mod.id}/${week.id}/${day.id}`}>
                                                       <Button size="sm" variant="ghost" className="h-6 text-[10px] uppercase border border-white/10 hover:bg-[var(--school-accent)] hover:text-black">
                                                          Accéder
                                                       </Button>
                                                    </Link>
                                                 </div>
                                              ))}
                                           </div>
                                        )}
                                     </div>
                                  ))}
                               </div>
                            )}
                         </div>
                      ))}
                   </div>
                )}
             </Card>
          ))}
       </div>
    </div>
  );
};

export default ProgressiveLearningSectionComponent;