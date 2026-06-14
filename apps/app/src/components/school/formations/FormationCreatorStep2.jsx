import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash, GripVertical, Copy } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import DayContentManager from './DayContentManager';

const isUuid = (value) => {
  if (!value) return false;
  const s = String(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
};

const FormationCreatorStep2 = ({ modules, setModules }) => {
  const { toast } = useToast();
  
  // Helpers
  const addModule = () => setModules([...modules, { id: Date.now(), title: `Module ${modules.length + 1}`, weeks: [] }]);
  
  const updateModule = (mIdx, field, val) => {
    const newMods = [...modules];
    newMods[mIdx][field] = val;
    setModules(newMods);
  };
  
  const removeModule = (mIdx) => {
     setModules(modules.filter((_, i) => i !== mIdx));
  };

  const addWeek = (mIdx) => {
    const newMods = [...modules];
    newMods[mIdx].weeks.push({ id: Date.now(), title: `Semaine ${newMods[mIdx].weeks.length + 1}`, days: [] });
    setModules(newMods);
  };

  const removeWeek = (mIdx, wIdx) => {
     const newMods = [...modules];
     newMods[mIdx].weeks.splice(wIdx, 1);
     setModules(newMods);
  };

  const addDay = (mIdx, wIdx) => {
    const newMods = [...modules];
    newMods[mIdx].weeks[wIdx].days.push({ id: Date.now(), title: `Jour ${newMods[mIdx].weeks[wIdx].days.length + 1}`, videos: [], reader: null, quiz: null });
    setModules(newMods);
  };

  const removeDay = (mIdx, wIdx, dIdx) => {
     const newMods = [...modules];
     newMods[mIdx].weeks[wIdx].days.splice(dIdx, 1);
     setModules(newMods);
  };

  const updateDay = (mIdx, wIdx, dIdx, updatedDay) => {
     const newMods = [...modules];
     newMods[mIdx].weeks[wIdx].days[dIdx] = updatedDay;
     setModules(newMods);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in">
       <div className="flex justify-between items-center pb-4 border-b border-white/10">
          <div>
             <h3 className="text-xl font-bold text-white">Structure & Contenu</h3>
             <p className="text-sm text-gray-400">Organisez votre formation par Modules, Semaines et Jours.</p>
          </div>
          <Button onClick={addModule} className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold"><Plus className="w-4 h-4 mr-2"/> Ajouter Module</Button>
       </div>
       
       <div className="space-y-4">
          {modules.map((module, mIdx) => (
             <div key={module.id} className="border border-white/10 rounded-lg bg-[#15202B] overflow-hidden">
                {/* Module Header */}
                <div className="p-4 bg-[#192734] flex items-center gap-4 border-b border-white/5">
                   <GripVertical className="text-gray-600 cursor-move" />
                   <span className="font-bold text-[#D4AF37] whitespace-nowrap">Module {mIdx+1}</span>
                   <Input 
                     value={module.title} 
                     onChange={(e) => updateModule(mIdx, 'title', e.target.value)} 
                     className="bg-[#0F1419] border-transparent focus:border-white/20 text-white font-bold h-9"
                   />
                   <Button variant="ghost" size="icon" onClick={() => removeModule(mIdx)} className="text-gray-500 hover:text-red-400 ml-auto"><Trash className="w-4 h-4"/></Button>
                </div>

                {/* Weeks Area */}
                <div className="p-4 space-y-6">
                   {module.weeks.map((week, wIdx) => (
                      <div key={week.id} className="pl-4 border-l-2 border-white/10 space-y-4">
                         {/* Week Header */}
                         <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Semaine {wIdx+1}</span>
                            <Input 
                               value={week.title} 
                               onChange={(e) => { const nm = [...modules]; nm[mIdx].weeks[wIdx].title = e.target.value; setModules(nm); }} 
                               className="h-8 w-64 bg-[#0F1419] border-white/10 text-xs" 
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-600 hover:text-red-400" onClick={() => removeWeek(mIdx, wIdx)}><Trash className="w-3 h-3"/></Button>
                         </div>

                         {/* Days Grid */}
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {week.days.map((day, dIdx) => (
                               <div key={day.id} className="bg-[#0F1419] p-3 rounded-lg border border-white/5 group relative">
                                  <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                                     <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                                       <Input
                                         value={day.title}
                                         onChange={(e) => { const nm = [...modules]; nm[mIdx].weeks[wIdx].days[dIdx].title = e.target.value; setModules(nm); }}
                                         className="h-7 bg-transparent border-none text-white font-bold text-sm p-0 focus-visible:ring-0 w-32 min-w-[6rem]"
                                       />
                                       {isUuid(day.id) && (
                                         <Button
                                           type="button"
                                           size="sm"
                                           variant="ghost"
                                           className="h-7 text-[10px] text-gray-400 hover:text-[#D4AF37] shrink-0"
                                           onClick={async () => {
                                             try {
                                               await navigator.clipboard.writeText(String(day.id));
                                               toast({
                                                 title: 'UUID du jour copié',
                                                 description: 'Collez-le dans la page post-live (NeuroRecall) pour créer le contenu vidéo replay.',
                                               });
                                             } catch {
                                               toast({
                                                 title: 'Copie impossible',
                                                 description: String(day.id),
                                                 variant: 'destructive',
                                               });
                                             }
                                           }}
                                         >
                                           <Copy className="w-3 h-3 mr-1" />
                                           UUID jour
                                         </Button>
                                       )}
                                     </div>
                                     <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => removeDay(mIdx, wIdx, dIdx)}><Trash className="w-3 h-3"/></Button>
                                  </div>
                                  {!isUuid(day.id) && (
                                    <p className="text-[10px] text-amber-200/70 mb-2">
                                      Enregistrez la structure pour obtenir l'UUID Supabase du jour (requis pour NeuroRecall).
                                    </p>
                                  )}

                                  {/* Day Content Manager */}
                                  <DayContentManager 
                                     day={day} 
                                     onUpdate={(updatedDay) => updateDay(mIdx, wIdx, dIdx, updatedDay)} 
                                  />
                               </div>
                            ))}
                            
                            {/* Add Day Button */}
                            <Button variant="outline" className="h-full min-h-[100px] border-dashed border-white/10 text-gray-500 hover:text-white hover:bg-white/5 flex flex-col gap-2" onClick={() => addDay(mIdx, wIdx)}>
                               <Plus className="w-6 h-6"/>
                               <span>Ajouter Jour</span>
                            </Button>
                         </div>
                      </div>
                   ))}
                   
                   <Button variant="ghost" size="sm" onClick={() => addWeek(mIdx)} className="text-[#D4AF37] hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 ml-4">
                      <Plus className="w-3 h-3 mr-2"/> Ajouter une Semaine
                   </Button>
                </div>
             </div>
          ))}
       </div>

       {modules.length === 0 && (
          <div className="text-center py-20 bg-[#15202B] rounded-lg border-2 border-dashed border-white/10 text-gray-500">
             <p>Aucun module créé.</p>
             <Button onClick={addModule} className="mt-4 bg-[#D4AF37] text-black">Commencer</Button>
          </div>
       )}
    </div>
  );
};

export default FormationCreatorStep2;