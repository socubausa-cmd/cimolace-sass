import React, { useState } from 'react';
import { FileText, ChevronRight, Save, MessageSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const NotebookSection = ({ data }) => {
  const { notebook = [], progression = {} } = data;
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [grading, setGrading] = useState({ comprehension: 0, clarity: 0, effort: 0, comment: '' });
  const { toast } = useToast();

  const handleSelect = (entry) => {
    setSelectedEntry(entry);
    setGrading({
      comprehension: entry.grades?.comprehension || 0,
      clarity: entry.grades?.clarity || 0,
      effort: entry.grades?.effort || 0,
      comment: entry.teacherComment || ''
    });
  };

  const handleSaveGrade = () => {
    // In a real app, this would update via API. Here we simulate local update via toast.
    // The parent component should handle the actual data mutation via context.
    toast({ title: "Note enregistrée", description: "Le cahier a été mis à jour avec succès." });
    // Simulate updating the selected entry view
    setSelectedEntry(prev => ({ 
      ...prev, 
      grades: { comprehension: grading.comprehension, clarity: grading.clarity, effort: grading.effort },
      teacherComment: grading.comment
    }));
  };

  // Group notebook by Module -> Week
  const grouped = progression.modules?.reduce((acc, mod) => {
    const entries = notebook.filter(n => n.moduleId === mod.id);
    if(entries.length > 0) acc.push({ ...mod, entries });
    return acc;
  }, []) || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[700px]">
      {/* Sidebar Tree */}
      <Card className="lg:col-span-4 bg-[#192734] border-white/10 h-full flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/10 font-bold text-white">Arborescence</div>
        <ScrollArea className="flex-1">
          <Accordion type="multiple" className="w-full">
            {grouped.map(mod => (
              <AccordionItem key={mod.id} value={mod.id} className="border-b border-white/5">
                <AccordionTrigger className="px-4 py-3 hover:bg-white/5 text-sm font-bold text-gray-200">
                   {mod.title}
                </AccordionTrigger>
                <AccordionContent>
                   <div className="pl-4">
                      {mod.entries.map(entry => (
                        <div 
                          key={entry.id} 
                          onClick={() => handleSelect(entry)}
                          className={`py-2 px-3 text-sm cursor-pointer flex justify-between items-center transition-colors border-l-2 ${selectedEntry?.id === entry.id ? 'border-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-white' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                          <span className="truncate">{entry.dayTitle}</span>
                          {entry.grades && <Badge variant="outline" className="text-[10px] h-5 px-1 border-green-500/30 text-green-500">Noté</Badge>}
                        </div>
                      ))}
                   </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </Card>

      {/* Main Grading Area */}
      <Card className="lg:col-span-8 bg-[#192734] border-white/10 h-full flex flex-col overflow-hidden">
        {selectedEntry ? (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-white/10 bg-black/20">
              <h2 className="text-xl font-bold text-white mb-1">{selectedEntry.dayTitle}</h2>
              <div className="flex gap-2 text-sm text-gray-400">
                <span>{selectedEntry.moduleTitle}</span> • <span>{selectedEntry.weekTitle}</span> • <span>{format(new Date(selectedEntry.date), 'dd MMMM yyyy', {locale: fr})}</span>
              </div>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                 {/* Student Answer */}
                 <div className="space-y-2">
                   <h3 className="text-[var(--school-accent)] font-bold flex items-center gap-2"><FileText className="w-4 h-4"/> Réponse de l'élève</h3>
                   <div className="bg-black/20 p-4 rounded-lg border border-white/5 text-gray-300 leading-relaxed font-serif">
                     "{selectedEntry.content}"
                   </div>
                 </div>

                 {/* Grading Form */}
                 <div className="bg-[#0F1419] p-6 rounded-xl border border-white/10 space-y-6">
                    <h3 className="text-white font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-400"/> Évaluation & Feedback</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="space-y-2">
                          <label className="text-sm text-gray-400">Compréhension ({grading.comprehension}/10)</label>
                          <Slider 
                            min={0} 
                            max={10} 
                            step={1} 
                            value={[grading.comprehension]} 
                            onValueChange={(vals) => setGrading({...grading, comprehension: vals[0]})} 
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-sm text-gray-400">Clarté ({grading.clarity}/5)</label>
                          <Slider 
                            min={0} 
                            max={5} 
                            step={1} 
                            value={[grading.clarity]} 
                            onValueChange={(vals) => setGrading({...grading, clarity: vals[0]})} 
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-sm text-gray-400">Effort ({grading.effort}/5)</label>
                          <Slider 
                            min={0} 
                            max={5} 
                            step={1} 
                            value={[grading.effort]} 
                            onValueChange={(vals) => setGrading({...grading, effort: vals[0]})} 
                          />
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-sm text-gray-400">Commentaire du Professeur</label>
                       <Textarea 
                         value={grading.comment} 
                         onChange={(e) => setGrading({...grading, comment: e.target.value})} 
                         className="bg-black/30 border-white/10 min-h-[100px]"
                         placeholder="Votre feedback constructif..."
                       />
                    </div>

                    <div className="flex justify-end pt-2">
                       <Button onClick={handleSaveGrade} className="bg-[var(--school-accent)] text-black font-bold hover:bg-yellow-500 gap-2">
                          <Save className="w-4 h-4" /> Enregistrer la note
                       </Button>
                    </div>
                 </div>
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 flex-col gap-2">
             <FileText className="w-12 h-12 opacity-20" />
             <p>Sélectionnez une entrée dans l'arborescence pour corriger.</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default NotebookSection;