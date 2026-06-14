import React from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { Lock, Unlock, CheckCircle, PlayCircle, BarChart2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const ProgressionSection = ({ data }) => {
  if (!data?.progression) return <div className="text-gray-500">Aucune donnée de progression.</div>;
  const { progression } = data;

  return (
    <div className="space-y-8 animate-in fade-in-50">
       {/* 1. Global Stats */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-[#192734] border-white/10 md:col-span-2">
            <CardContent className="flex items-center gap-6 p-6">
               <div className="w-24 h-24 flex-shrink-0">
                 <CircularProgressbar value={progression.overall} text={`${progression.overall}%`} styles={buildStyles({ pathColor: '#D4AF37', textColor: '#fff', trailColor: '#333' })} />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-white">Progression Globale</h3>
                  <p className="text-gray-400 text-sm mb-2">Année en cours</p>
                  <Progress value={progression.overall} className="h-2 bg-white/10" indicatorClassName="bg-[#D4AF37]" />
               </div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#192734] border-white/10">
            <CardContent className="p-6 text-center">
               <BarChart2 className="w-8 h-8 text-blue-400 mx-auto mb-2" />
               <p className="text-3xl font-bold text-white">{progression.stats?.regularity}%</p>
               <p className="text-sm text-gray-400">Taux de Régularité</p>
            </CardContent>
          </Card>

          <Card className="bg-[#192734] border-white/10">
            <CardContent className="p-6 text-center">
               <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
               <p className="text-3xl font-bold text-white">{progression.stats?.averageNoteQuality}/20</p>
               <p className="text-sm text-gray-400">Qualité Moyenne</p>
            </CardContent>
          </Card>
       </div>

       {/* 2. Modules Detail */}
       <div className="space-y-4">
          <h3 className="text-lg font-bold text-white border-l-4 border-[#D4AF37] pl-3">Détail par Module</h3>
          <Accordion type="single" collapsible className="space-y-4">
            {progression.modules.map((module, idx) => (
              <AccordionItem key={module.id} value={module.id} className="border border-white/10 rounded-lg bg-[#192734] px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                       {module.status === 'completed' ? <CheckCircle className="text-green-500 w-5 h-5"/> : 
                        module.status === 'locked' ? <Lock className="text-gray-500 w-5 h-5"/> : 
                        <Unlock className="text-[#D4AF37] w-5 h-5"/>}
                       <div className="text-left">
                          <p className={`font-bold ${module.status === 'locked' ? 'text-gray-500' : 'text-white'}`}>{module.title}</p>
                          <p className="text-sm text-gray-400">{module.weeks?.length || 0} semaines</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <Progress value={module.percentage} className="w-24 h-2 bg-black/40" indicatorClassName={module.status === 'completed' ? 'bg-green-500' : 'bg-[#D4AF37]'} />
                       <span className="text-sm font-mono text-gray-400 w-12 text-right">{module.percentage}%</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-2">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {module.weeks.map((week, wIdx) => (
                         <div key={week.id} className="bg-black/20 p-3 rounded border border-white/5">
                            <div className="flex justify-between items-center mb-2">
                               <span className="font-bold text-gray-300">{week.title}</span>
                               <span className="text-xs text-[#D4AF37]">{week.progress}%</span>
                            </div>
                            <div className="space-y-1">
                               {week.days.map((day, dIdx) => (
                                  <div key={day.id} className="flex items-center gap-2 text-sm text-gray-500">
                                     {day.status === 'completed' ? <CheckCircle className="w-3 h-3 text-green-500"/> : 
                                      day.status === 'in_progress' ? <PlayCircle className="w-3 h-3 text-[#D4AF37]"/> : 
                                      <Lock className="w-3 h-3 text-gray-700"/>}
                                     <span className={day.status === 'locked' ? 'line-through opacity-50' : ''}>{day.title}</span>
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
       </div>
    </div>
  );
};

export default ProgressionSection;