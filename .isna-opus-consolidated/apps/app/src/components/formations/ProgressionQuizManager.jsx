import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash, Copy, FileText, Layout, Calendar } from 'lucide-react';
import QuizBuilder from './QuizBuilder';
import { useToast } from '@/components/ui/use-toast';

const ProgressionQuizManager = ({ formation, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [editingQuiz, setEditingQuiz] = useState(null);
  const { toast } = useToast();

  // Helper to extract all quizzes from formation hierarchy
  // Realistically, quizzes might be stored in a separate table, but here we assume they are attached to structure
  // For 'ProgressionQuizManager' we will assume a top-level list or we extract them. 
  // Let's assume 'formation.quizzes' exists for week/module/final, and day quizzes are inside 'modules'.
  
  // To simplify for this demo, we'll assume `formation.additionalQuizzes` stores Week/Module/Final quizzes.
  // Day quizzes are managed in the day itself, but we can list them here read-only or link to them.
  
  const quizzes = formation.additionalQuizzes || [];

  const handleSaveQuiz = (quizData) => {
    let newQuizzes = [...quizzes];
    const existingIdx = newQuizzes.findIndex(q => q.id === quizData.id);
    
    if (existingIdx >= 0) {
       newQuizzes[existingIdx] = quizData;
    } else {
       newQuizzes.push(quizData);
    }
    
    onUpdate({ ...formation, additionalQuizzes: newQuizzes });
    setEditingQuiz(null);
    toast({ title: "Quiz enregistré", description: "Le quiz a été sauvegardé avec succès." });
  };

  const deleteQuiz = (quizId) => {
     if (confirm("Êtes-vous sûr de vouloir supprimer ce quiz ?")) {
        const newQuizzes = quizzes.filter(q => q.id !== quizId);
        onUpdate({ ...formation, additionalQuizzes: newQuizzes });
        toast({ title: "Quiz supprimé" });
     }
  };

  const duplicateQuiz = (quiz) => {
     const newQuiz = {
        ...quiz,
        id: `qz-${Date.now()}`,
        title: `${quiz.title} (Copie)`
     };
     onUpdate({ ...formation, additionalQuizzes: [...quizzes, newQuiz] });
     toast({ title: "Quiz dupliqué" });
  };

  const filterQuizzes = (type) => {
     if (type === 'all') return quizzes;
     return quizzes.filter(q => q.type === type);
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Gestion des Évaluations</h3>
          <Button onClick={() => setEditingQuiz({ type: 'week' })} className="bg-[#D4AF37] text-black hover:bg-yellow-500">
             <Plus className="w-4 h-4 mr-2"/> Nouveau Quiz
          </Button>
       </div>

       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-[#192734] border border-white/10 w-full justify-start">
             <TabsTrigger value="all">Tous</TabsTrigger>
             <TabsTrigger value="week">Hebdomadaire</TabsTrigger>
             <TabsTrigger value="module">Modulaire</TabsTrigger>
             <TabsTrigger value="final">Final</TabsTrigger>
          </TabsList>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
             {filterQuizzes(activeTab).map(quiz => (
                <Card key={quiz.id} className="bg-[#192734] border-white/10 hover:border-[#D4AF37] transition-colors group">
                   <CardContent className="p-5 space-y-4">
                      <div className="flex justify-between items-start">
                         <Badge variant="outline" className={`
                            ${quiz.type === 'week' ? 'text-blue-400 border-blue-400' : ''}
                            ${quiz.type === 'module' ? 'text-purple-400 border-purple-400' : ''}
                            ${quiz.type === 'final' ? 'text-red-400 border-red-400' : ''}
                         `}>
                            {quiz.type === 'week' && <Calendar className="w-3 h-3 mr-1"/>}
                            {quiz.type === 'module' && <Layout className="w-3 h-3 mr-1"/>}
                            {quiz.type === 'final' && <FileText className="w-3 h-3 mr-1"/>}
                            {quiz.type.toUpperCase()}
                         </Badge>
                         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-400 hover:text-white" onClick={() => duplicateQuiz(quiz)}><Copy className="w-3 h-3"/></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:bg-red-500/20" onClick={() => deleteQuiz(quiz.id)}><Trash className="w-3 h-3"/></Button>
                         </div>
                      </div>
                      
                      <div>
                         <h4 className="font-bold text-white text-lg line-clamp-1">{quiz.title}</h4>
                         <p className="text-gray-400 text-sm line-clamp-2 mt-1">{quiz.description || "Aucune description"}</p>
                      </div>

                      <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                         <span className="text-sm text-gray-500">{quiz.questions?.length || 0} Questions</span>
                         <Button size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={() => setEditingQuiz(quiz)}>
                            <Edit className="w-3 h-3 mr-2"/> Modifier
                         </Button>
                      </div>
                   </CardContent>
                </Card>
             ))}
             
             {filterQuizzes(activeTab).length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500 border-2 border-dashed border-white/10 rounded-lg">
                   <FileText className="w-12 h-12 mx-auto mb-4 opacity-20"/>
                   <p>Aucun quiz trouvé dans cette catégorie.</p>
                </div>
             )}
          </div>
       </Tabs>

       {/* Fullscreen Editor Dialog */}
       <Dialog open={!!editingQuiz} onOpenChange={() => setEditingQuiz(null)}>
          <DialogContent className="max-w-[95vw] w-full h-[95vh] bg-[#0F1419] border-white/10 p-0 overflow-hidden">
             <DialogTitle className="sr-only">Éditeur de quiz</DialogTitle>
             {editingQuiz && (
                <QuizBuilder 
                   quiz={editingQuiz.id ? editingQuiz : null} 
                   scope={editingQuiz.type || 'week'}
                   onSave={handleSaveQuiz} 
                   onCancel={() => setEditingQuiz(null)} 
                />
             )}
          </DialogContent>
       </Dialog>
    </div>
  );
};

export default ProgressionQuizManager;