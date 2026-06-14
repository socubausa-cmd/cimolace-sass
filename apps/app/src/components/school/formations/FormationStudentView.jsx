import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlayCircle, CheckCircle, Lock, ChevronRight, Clock, BookOpen, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';

const FormationStudentView = ({ formation, enrolled = false, progress = 0 }) => {
  const navigate = useNavigate();
  const [detailsOpen, setDetailsOpen] = useState(false);

  // If used in a list (Card View)
  if (!detailsOpen) {
     return (
        <Card className="bg-[#192734] border-white/10 hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] transition-all group overflow-hidden flex flex-col h-full shadow-lg hover:shadow-2xl hover:-translate-y-1 duration-300 cursor-pointer" onClick={() => setDetailsOpen(true)}>
           <div className="h-48 bg-gray-800 relative overflow-hidden">
              <img src={formation.thumbnail || formation.coverImage} alt={formation.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute top-3 right-3 flex gap-2">
                 <Badge className="bg-black/60 backdrop-blur border border-white/10 text-[var(--school-accent)]">{formation.year}</Badge>
              </div>
              {enrolled && (
                 <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                    <div className="h-full bg-[var(--school-accent)]" style={{width: `${progress}%`}}></div>
                 </div>
              )}
           </div>
           
           <CardContent className="p-5 flex-1 flex flex-col">
              <h3 className="text-white text-xl font-bold line-clamp-1 mb-2">{formation.title}</h3>
              <p className="text-sm text-gray-400 line-clamp-2 mb-4 flex-1">{formation.description}</p>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-4 border-t border-white/5">
                 <span className="flex items-center gap-1"><BookOpen className="w-3 h-3 text-[var(--school-accent)]"/> {formation.modules.length} Modules</span>
                 <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[var(--school-accent)]"/> {formation.duration}</span>
              </div>
              
              <Button className={`w-full mt-4 ${enrolled ? 'bg-green-600 hover:bg-green-700' : 'bg-[var(--school-accent)] hover:bg-yellow-500 text-black'}`}>
                 {enrolled ? 'Continuer' : "S'inscrire"}
              </Button>
           </CardContent>

           {/* Details Modal built-in for quick view */}
           <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
              <DialogContent className="max-w-6xl h-[90vh] bg-[#0F1419] border-white/10 text-white p-0 flex flex-col overflow-hidden">
                 <DialogTitle className="sr-only">Détails de la formation</DialogTitle>
                 {/* Modal Header */}
                 <div className="relative h-64 shrink-0">
                    <img src={formation.coverImage} className="w-full h-full object-cover opacity-50" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F1419] via-transparent to-transparent"></div>
                    <div className="absolute bottom-6 left-8 right-8">
                       <Badge className="mb-4 bg-[var(--school-accent)] text-black hover:bg-[var(--school-accent)]">{formation.year}</Badge>
                       <h2 className="text-4xl font-serif font-bold text-white mb-2">{formation.title}</h2>
                       <div className="flex items-center gap-6 text-gray-300 text-sm">
                          <span className="flex items-center gap-2"><Clock className="w-4 h-4"/> {formation.duration}</span>
                          <span className="flex items-center gap-2"><BookOpen className="w-4 h-4"/> {formation.modules.length} Modules</span>
                          <span className="flex items-center gap-2"><Trophy className="w-4 h-4"/> Certificat Inclus</span>
                       </div>
                    </div>
                 </div>

                 {/* Modal Content */}
                 <div className="flex-1 overflow-y-auto p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                       <div className="lg:col-span-2 space-y-8">
                          <div>
                             <h3 className="text-xl font-bold text-white mb-4">À propos</h3>
                             <p className="text-gray-400 leading-relaxed">{formation.description}</p>
                          </div>

                          <div>
                             <h3 className="text-xl font-bold text-white mb-6">Programme</h3>
                             <div className="space-y-4">
                                {formation.modules.map((mod, idx) => (
                                   <div key={idx} className="bg-[#192734] rounded-lg border border-white/10 overflow-hidden">
                                      <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
                                         <div className="flex items-center gap-4">
                                            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-[var(--school-accent)]">{idx+1}</span>
                                            <h4 className="font-bold text-white">{mod.title}</h4>
                                         </div>
                                         <span className="text-sm text-gray-500">{mod.weeks.length} semaines</span>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>
                       </div>

                       <div className="space-y-6">
                          <Card className="bg-[#192734] border-white/10 sticky top-4">
                             <CardContent className="p-6 space-y-6">
                                {enrolled ? (
                                   <div className="space-y-4">
                                      <div className="flex justify-between text-sm text-gray-400">
                                         <span>Progression</span>
                                         <span className="text-[var(--school-accent)]">{progress}%</span>
                                      </div>
                                      <Progress value={progress} className="h-2" indicatorClassName="bg-[var(--school-accent)]" />
                                      <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12" onClick={() => navigate(`/formation/${formation.id}/learn`)}>
                                         Reprendre le cours
                                      </Button>
                                   </div>
                                ) : (
                                   <div className="space-y-4">
                                      <div className="text-3xl font-bold text-white text-center">{formation.price}€</div>
                                      <Button className="w-full bg-[var(--school-accent)] hover:bg-yellow-500 text-black font-bold h-12">
                                         Rejoindre la formation
                                      </Button>
                                      <p className="text-xs text-center text-gray-500">Accès immédiat • Satisfait ou remboursé</p>
                                   </div>
                                )}
                             </CardContent>
                          </Card>
                       </div>
                    </div>
                 </div>
              </DialogContent>
           </Dialog>
        </Card>
     );
  }
  return null; 
};

export default FormationStudentView;