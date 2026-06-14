import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash, CheckCircle, HelpCircle, Save, ArrowLeft, MoreHorizontal, LayoutList } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

const QuizBuilder = ({ quiz, scope = 'day', parentId = null, onSave, onCancel }) => {
  const [data, setData] = useState(quiz || {
    id: `qz-${Date.now()}`,
    title: '',
    description: '',
    type: scope, // day, week, module, final
    parentId: parentId,
    questions: []
  });
  
  const { toast } = useToast();
  const [activeQuestion, setActiveQuestion] = useState(null);

  // Auto-set title based on scope if empty
  useEffect(() => {
     if (!data.title && scope) {
        const titles = {
           'day': 'Quiz du Jour',
           'week': 'Évaluation Hebdomadaire',
           'module': 'Certification du Module',
           'final': 'Examen Final'
        };
        setData(prev => ({ ...prev, title: titles[scope] || '' }));
     }
  }, [scope]);

  const addQuestion = () => {
    const newQ = {
       id: Date.now(),
       statement: '',
       type: 'multiple_choice',
       options: ['', '', '', ''],
       correctAnswer: 0,
       points: 10,
       explanation: ''
    };
    setData(prev => ({ ...prev, questions: [...prev.questions, newQ] }));
    setActiveQuestion(prev => prev === null ? 0 : prev); // Auto-select if first
  };

  const updateQuestion = (idx, field, value) => {
    const newQs = [...data.questions];
    newQs[idx] = { ...newQs[idx], [field]: value };
    setData({ ...data, questions: newQs });
  };

  const updateOption = (qIdx, oIdx, value) => {
    const newQs = [...data.questions];
    newQs[qIdx].options[oIdx] = value;
    setData({ ...data, questions: newQs });
  };

  const removeQuestion = (idx) => {
    const newQs = data.questions.filter((_, i) => i !== idx);
    setData({ ...data, questions: newQs });
    if (activeQuestion === idx) setActiveQuestion(null);
    if (activeQuestion > idx) setActiveQuestion(activeQuestion - 1);
  };

  const handleSave = () => {
    if (!data.title) {
       toast({ title: "Titre requis", description: "Veuillez donner un titre au quiz.", variant: "destructive" });
       return;
    }
    if (data.questions.length === 0) {
       toast({ title: "Questions requises", description: "Ajoutez au moins une question.", variant: "destructive" });
       return;
    }
    
    // Validate all questions have statement and correct answer
    const invalidQ = data.questions.find(q => !q.statement || (q.type === 'multiple_choice' && q.options.some(o => !o)));
    if (invalidQ) {
       toast({ title: "Incomplet", description: "Vérifiez que toutes les questions et options sont remplies.", variant: "destructive" });
       return;
    }

    onSave(data);
  };

  return (
    <div className="flex flex-col h-full bg-[#0F1419] text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#192734]">
         <div className="flex items-center gap-4">
             <Button variant="ghost" onClick={onCancel}><ArrowLeft className="w-5 h-5"/></Button>
             <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                   Constructeur de Quiz 
                   <Badge variant="outline" className="text-[var(--school-accent)] border-[var(--school-accent)] capitalize">{data.type}</Badge>
                </h2>
                <p className="text-sm text-gray-400">Créez des évaluations interactives pour valider les acquis.</p>
             </div>
         </div>
         <Button onClick={handleSave} className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold gap-2">
            <Save className="w-4 h-4"/> Enregistrer
         </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
         {/* Sidebar: Question List */}
         <div className="w-80 border-r border-white/10 bg-[#15202B] flex flex-col">
            <div className="p-4 border-b border-white/10 space-y-3">
               <div className="space-y-1">
                  <Label>Titre du Quiz</Label>
                  <Input value={data.title} onChange={e => setData({...data, title: e.target.value})} className="bg-[#0F1419] border-white/10 h-8" />
               </div>
               <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea value={data.description} onChange={e => setData({...data, description: e.target.value})} className="bg-[#0F1419] border-white/10 h-16 text-xs" />
               </div>
            </div>
            
            <ScrollArea className="flex-1">
               <div className="p-4 space-y-2">
                  {data.questions.map((q, idx) => (
                     <div 
                        key={q.id} 
                        onClick={() => setActiveQuestion(idx)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${activeQuestion === idx ? 'bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border-[var(--school-accent)] shadow-lg' : 'bg-[#192734] border-white/5 hover:bg-white/5'}`}
                     >
                        <div className="flex justify-between items-start mb-1">
                           <span className="text-xs font-bold text-gray-400">Q{idx + 1}</span>
                           <Button size="icon" variant="ghost" className="h-5 w-5 text-gray-500 hover:text-red-400" onClick={(e) => { e.stopPropagation(); removeQuestion(idx); }}>
                              <Trash className="w-3 h-3"/>
                           </Button>
                        </div>
                        <p className="text-sm font-medium line-clamp-2">{q.statement || "Nouvelle question..."}</p>
                        <div className="mt-2 flex gap-2 text-[10px] text-gray-500">
                           <span className="bg-black/20 px-1.5 py-0.5 rounded capitalize">{q.type.replace('_', ' ')}</span>
                           <span className="bg-black/20 px-1.5 py-0.5 rounded">{q.points} pts</span>
                        </div>
                     </div>
                  ))}
               </div>
            </ScrollArea>

            <div className="p-4 border-t border-white/10">
               <Button onClick={addQuestion} className="w-full border-dashed border-white/20 text-gray-400 hover:text-white" variant="outline">
                  <Plus className="w-4 h-4 mr-2"/> Ajouter Question
               </Button>
            </div>
         </div>

         {/* Main Content: Question Editor */}
         <div className="flex-1 bg-[#0F1419] p-8 overflow-y-auto">
            {activeQuestion !== null && data.questions[activeQuestion] ? (
               <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-center">
                     <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="bg-[var(--school-accent)] text-black w-8 h-8 rounded-full flex items-center justify-center text-sm">
                           {activeQuestion + 1}
                        </span>
                        Édition de la question
                     </h3>
                     <div className="flex gap-4">
                        <Select 
                           value={data.questions[activeQuestion].type} 
                           onValueChange={v => updateQuestion(activeQuestion, 'type', v)}
                        >
                           <SelectTrigger className="w-[180px] bg-[#192734] border-white/10"><SelectValue /></SelectTrigger>
                           <SelectContent>
                              <SelectItem value="multiple_choice">Choix Multiple</SelectItem>
                              <SelectItem value="true_false">Vrai / Faux</SelectItem>
                              <SelectItem value="short_answer">Réponse Courte</SelectItem>
                           </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2 bg-[#192734] px-3 rounded border border-white/10">
                           <span className="text-sm text-gray-400">Points:</span>
                           <Input 
                              type="number" 
                              value={data.questions[activeQuestion].points} 
                              onChange={e => updateQuestion(activeQuestion, 'points', parseInt(e.target.value))} 
                              className="w-16 h-8 bg-transparent border-none text-right font-bold"
                           />
                        </div>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <Label className="text-lg">Énoncé de la question</Label>
                     <Textarea 
                        value={data.questions[activeQuestion].statement}
                        onChange={e => updateQuestion(activeQuestion, 'statement', e.target.value)}
                        className="bg-[#192734] border-white/10 text-lg min-h-[100px]"
                        placeholder="Posez votre question ici..."
                     />
                  </div>

                  {/* Answers Section */}
                  <div className="space-y-4 p-6 bg-[#192734]/50 rounded-xl border border-white/10">
                     <Label className="text-[var(--school-accent)]">Réponses & Corrections</Label>
                     
                     {data.questions[activeQuestion].type === 'multiple_choice' && (
                        <div className="space-y-3">
                           {data.questions[activeQuestion].options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-center gap-4 group">
                                 <div 
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${data.questions[activeQuestion].correctAnswer === oIdx ? 'border-green-500 bg-green-500/20' : 'border-gray-600 hover:border-white'}`}
                                    onClick={() => updateQuestion(activeQuestion, 'correctAnswer', oIdx)}
                                 >
                                    {data.questions[activeQuestion].correctAnswer === oIdx && <div className="w-3 h-3 rounded-full bg-green-500"></div>}
                                 </div>
                                 <Input 
                                    value={opt} 
                                    onChange={e => updateOption(activeQuestion, oIdx, e.target.value)}
                                    className={`bg-[#0F1419] border-white/10 flex-1 ${data.questions[activeQuestion].correctAnswer === oIdx ? 'text-green-400 font-medium' : ''}`}
                                    placeholder={`Option ${oIdx + 1}`}
                                 />
                                 <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-400" 
                                    onClick={() => {
                                       const newOpts = [...data.questions[activeQuestion].options];
                                       newOpts.splice(oIdx, 1);
                                       updateQuestion(activeQuestion, 'options', newOpts);
                                    }}
                                 ><Trash className="w-4 h-4"/></Button>
                              </div>
                           ))}
                           <Button variant="ghost" size="sm" onClick={() => updateQuestion(activeQuestion, 'options', [...data.questions[activeQuestion].options, ''])} className="text-[var(--school-accent)]">+ Ajouter une option</Button>
                        </div>
                     )}

                     {data.questions[activeQuestion].type === 'true_false' && (
                        <div className="flex gap-4">
                           {['Vrai', 'Faux'].map((opt, oIdx) => (
                              <div 
                                 key={oIdx} 
                                 onClick={() => updateQuestion(activeQuestion, 'correctAnswer', oIdx)}
                                 className={`flex-1 p-6 rounded-lg border-2 cursor-pointer text-center font-bold text-xl transition-all ${data.questions[activeQuestion].correctAnswer === oIdx ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-white/10 hover:bg-white/5'}`}
                              >
                                 {opt}
                              </div>
                           ))}
                        </div>
                     )}
                     
                     {data.questions[activeQuestion].type === 'short_answer' && (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-200 text-sm">
                           <p>Pour les réponses courtes, la validation sera manuelle par le professeur.</p>
                        </div>
                     )}
                  </div>

                  <div className="space-y-2">
                     <Label>Explication (Affichée après réponse)</Label>
                     <Textarea 
                        value={data.questions[activeQuestion].explanation}
                        onChange={e => updateQuestion(activeQuestion, 'explanation', e.target.value)}
                        className="bg-[#192734] border-white/10"
                        placeholder="Expliquez pourquoi la réponse est correcte..."
                     />
                  </div>
               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <LayoutList className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg">Sélectionnez ou ajoutez une question</p>
                  <p className="text-sm">Utilisez le menu de gauche pour gérer vos questions.</p>
                  <Button onClick={addQuestion} className="mt-6 bg-[var(--school-accent)] text-black hover:bg-yellow-500">
                     Créer ma première question
                  </Button>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default QuizBuilder;