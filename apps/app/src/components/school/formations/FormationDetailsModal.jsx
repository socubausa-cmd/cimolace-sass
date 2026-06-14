import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Layers, Clock, Users, Video, FileText, Presentation, X, Calendar, Layout } from 'lucide-react';
import FormationStatistics from './FormationStatistics';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const FormationDetailsModal = ({ formation, isOpen, onClose }) => {
  const navigate = useNavigate();
  if (!formation) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#151a21]/95 backdrop-blur-xl border border-white/10 text-white max-w-[95vw] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Détails de la formation</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div className="bg-[#151a21]/80 backdrop-blur p-6 border-b border-white/10 flex flex-col md:flex-row gap-6 shrink-0 relative">
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/formation/${formation.id}/learn`)}
              className="border-white/10 text-white hover:bg-white/5"
            >
              <Layout className="w-4 h-4 mr-2" /> Aperçu élève
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white"/></Button>
          </div>
          
          <div className="w-full md:w-64 h-40 bg-gray-800 rounded-lg overflow-hidden shrink-0 border border-white/10 shadow-xl">
             {formation.thumbnail ? (
               <img src={formation.thumbnail} alt={formation.title} className="w-full h-full object-cover" />
             ) : (
               <div className="w-full h-full flex items-center justify-center bg-[#0F1419] text-gray-500">Aucune image</div>
             )}
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-bold text-white font-serif">{formation.title}</h2>
              <Badge className={formation.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                {formation.status === 'published' ? 'Publié' : formation.status === 'draft' ? 'Brouillon' : 'Archivé'}
              </Badge>
              <Badge className="bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]">{formation.year}</Badge>
            </div>
            
            <p className="text-gray-400 max-w-3xl line-clamp-2">{formation.description}</p>
            
            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 mt-2">
              <span className="flex items-center gap-1"><Layers className="w-4 h-4 text-[var(--school-accent)]"/> {formation.level}</span>
              <span className="flex items-center gap-1"><BookOpen className="w-4 h-4 text-[var(--school-accent)]"/> {formation.modules?.length || 0} Modules</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-[var(--school-accent)]"/> {formation.duration}</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4 text-[var(--school-accent)]"/> {formation.enrolledStudents?.length || 0} Étudiants</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="structure" className="h-full flex flex-col">
            <div className="px-6 py-2 bg-[#151a21]/60 backdrop-blur border-b border-white/10">
              <TabsList className="bg-transparent p-0 gap-4">
                <TabsTrigger value="structure" className="data-[state=active]:bg-[var(--school-accent)] data-[state=active]:text-black text-gray-400 px-4 py-2 rounded-full transition-all">Structure & Contenu</TabsTrigger>
                <TabsTrigger value="students" className="data-[state=active]:bg-[var(--school-accent)] data-[state=active]:text-black text-gray-400 px-4 py-2 rounded-full transition-all">Étudiants Inscrits</TabsTrigger>
                <TabsTrigger value="stats" className="data-[state=active]:bg-[var(--school-accent)] data-[state=active]:text-black text-gray-400 px-4 py-2 rounded-full transition-all">Statistiques</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 bg-[#0F1419]/80">
              <div className="p-8">
                <TabsContent value="structure" className="mt-0 space-y-4">
                  <Accordion type="multiple" className="w-full space-y-4">
                    {formation.modules?.map((module, idx) => (
                      <AccordionItem key={module.id} value={module.id} className="border border-white/10 bg-[#151a21]/80 backdrop-blur rounded-lg px-4 shadow-lg">
                        <AccordionTrigger className="hover:no-underline py-4">
                          <div className="flex items-center gap-4 text-left">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] font-bold text-sm">
                              {idx + 1}
                            </span>
                            <div>
                              <h4 className="font-bold text-white text-lg">{module.title}</h4>
                              <p className="text-sm text-gray-400">{module.weeks?.length} semaines</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="space-y-6 pl-12 border-l border-white/5 ml-4 mt-2">
                            {module.weeks?.map((week) => (
                              <div key={week.id} className="space-y-3">
                                <h5 className="text-sm font-bold text-gray-300 uppercase tracking-wider">{week.title}</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {week.days?.map((day) => (
                                    <div key={day.id} className="bg-black/40 p-4 rounded-lg border border-white/5 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-colors">
                                      <p className="text-sm font-bold text-white mb-3 border-b border-white/10 pb-2">{day.title}</p>
                                      <div className="space-y-2">
                                        {day.videos?.map((video) => (
                                          <div key={video.id} className="flex items-center gap-2 text-sm text-gray-400">
                                            <Video className="w-3 h-3 text-[var(--school-accent)]"/>
                                            <span className="truncate flex-1">{video.title}</span>
                                            <span className="text-gray-600">{video.duration}m</span>
                                          </div>
                                        ))}
                                        {day.powerpoint && (
                                           <div className="flex items-center gap-2 text-xs text-blue-400">
                                              <Presentation className="w-3 h-3"/>
                                              <span className="truncate">{day.powerpoint.title}</span>
                                           </div>
                                        )}
                                        {day.quiz && (
                                           <div className="flex items-center gap-2 text-xs text-green-400">
                                              <FileText className="w-3 h-3"/>
                                              <span>Quiz de validation</span>
                                           </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </TabsContent>

                <TabsContent value="students" className="mt-0">
                  <div className="bg-[#151a21]/80 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-[#0F1419] text-gray-400 border-b border-white/10">
                        <tr>
                          <th className="p-4 font-medium">Étudiant</th>
                          <th className="p-4 font-medium">Date d'inscription</th>
                          <th className="p-4 font-medium">Progression</th>
                          <th className="p-4 font-medium">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {formation.enrolledStudents?.map((student) => (
                          <tr key={student.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8"><AvatarImage src={student.avatar} /><AvatarFallback>{student.name.charAt(0)}</AvatarFallback></Avatar>
                                <div>
                                  <p className="font-bold text-white">{student.name}</p>
                                  <p className="text-sm text-gray-500">{student.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-gray-400">{format(new Date(student.enrollmentDate), 'dd MMM yyyy', {locale: fr})}</td>
                            <td className="p-4 w-48">
                              <div className="flex items-center gap-2">
                                <Progress value={student.progress} className="h-2 bg-black/40" indicatorClassName="bg-[var(--school-accent)]" />
                                <span className="text-xs text-white w-8">{student.progress}%</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge className={
                                student.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                student.status === 'suspended' ? 'bg-red-500/20 text-red-400' :
                                'bg-blue-500/20 text-blue-400'
                              }>
                                {student.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="stats" className="mt-0">
                   <FormationStatistics formation={formation} />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FormationDetailsModal;