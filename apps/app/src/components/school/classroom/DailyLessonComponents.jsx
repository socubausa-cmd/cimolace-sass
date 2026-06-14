import React, { useState } from 'react';
import { CheckCircle, Lock, ChevronLeft, ChevronRight, BookOpen, AlertCircle, Save, HelpCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import VideoPlayer from '@/components/school/classroom/VideoPlayer';

// --- Day Navigation ---
export const DayNavigationControls = ({ currentDay, totalDays, onNext, onPrev, currentDayLabel }) => {
  return (
    <div className="flex items-center justify-between bg-[#192734] p-4 rounded-xl border border-white/10 shadow-lg mb-6 sticky top-4 z-30">
       <Button 
         variant="ghost" 
         onClick={onPrev} 
         disabled={currentDay === 0}
         className="text-gray-400 hover:text-white disabled:opacity-30"
       >
          <ChevronLeft className="w-5 h-5 mr-2" /> Jour précédent
       </Button>

       <div className="flex flex-col items-center">
          <span className="text-[var(--school-accent)] font-bold text-lg uppercase tracking-wider">{currentDayLabel}</span>
          <div className="flex gap-1 mt-1">
             {Array.from({ length: totalDays }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i === currentDay ? 'bg-[var(--school-accent)]' : i < currentDay ? 'bg-green-500' : 'bg-gray-700'}`}></div>
             ))}
          </div>
       </div>

       <Button 
         variant="ghost" 
         onClick={onNext}
         disabled={currentDay >= totalDays - 1} // Add logic for locked days if needed
         className="text-gray-400 hover:text-white disabled:opacity-30"
       >
          Jour suivant <ChevronRight className="w-5 h-5 ml-2" />
       </Button>
    </div>
  );
};

// --- Daily Lesson Block ---
export const DailyLessonBlock = ({ day }) => {
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">{day.title}</h2>
          <span className="text-gray-400 text-sm">{new Date(day.date).toLocaleDateString()}</span>
       </div>
       
       <VideoPlayer video={day.video} />
       
       <div className="bg-[#192734] p-4 rounded-lg border border-white/5 mt-4">
          <h3 className="font-bold text-white mb-2">{day.video.title}</h3>
          <p className="text-gray-400 text-sm">{day.video.description}</p>
       </div>
    </div>
  );
};

// --- Retained Content ---
export const RetainedContentBlock = ({ content }) => {
  return (
    <Card className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border-white/10 p-6 shadow-lg">
       <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
          <div className="p-2 bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] rounded-lg">
             <BookOpen className="w-6 h-6 text-[var(--school-accent)]" />
          </div>
          <h3 className="text-xl font-bold text-white">À retenir</h3>
       </div>

       <div className="space-y-6">
          <div className="text-gray-300 leading-relaxed italic border-l-4 border-[var(--school-accent)] pl-4">
             {content.summary}
          </div>

          <div>
             <h4 className="text-sm font-bold text-[var(--school-accent)] uppercase tracking-wider mb-3">Points Clés</h4>
             <ul className="space-y-2">
                {content.keyPoints.map((point, idx) => (
                   <li key={idx} className="flex items-start gap-3 text-gray-300">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <span>{point}</span>
                   </li>
                ))}
             </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {content.definitions.map((def, idx) => (
                <div key={idx} className="bg-black/20 p-4 rounded-lg border border-white/5">
                   <span className="font-bold text-[var(--school-accent)] block mb-1">{def.term}</span>
                   <span className="text-sm text-gray-400">{def.def}</span>
                </div>
             ))}
          </div>
       </div>
    </Card>
  );
};

// --- Student Notebook ---
export const StudentNotebookBlock = ({ initialContent, question, minLength = 50, onSave }) => {
   const [content, setContent] = useState(initialContent || '');
   const [error, setError] = useState(null);
   const [saved, setSaved] = useState(false);

   const handleSave = () => {
      if (content.length < minLength) {
         setError(`Votre réponse est trop courte. Minimum ${minLength} caractères.`);
         return;
      }
      setError(null);
      onSave(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
   };

   return (
      <Card className="bg-[#192734] border-white/10 p-6 shadow-lg">
         <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
               <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Cahier de l'élève</h3>
         </div>

         <div className="mb-4">
            <label className="block text-gray-300 mb-2 font-medium">{question}</label>
            <Textarea 
               value={content}
               onChange={(e) => setContent(e.target.value)}
               placeholder="Écris ce que tu as retenu..."
               className="min-h-[150px] bg-[#0F1419] border-white/10 text-white focus:border-[var(--school-accent)]"
            />
            <div className="flex justify-between mt-2 text-xs">
               <span className={content.length < minLength ? "text-red-400" : "text-green-400"}>
                  {content.length} / {minLength} caractères
               </span>
               {error && <span className="text-red-400">{error}</span>}
            </div>
         </div>

         <div className="flex justify-end">
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
               {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
               {saved ? 'Enregistré' : 'Enregistrer'}
            </Button>
         </div>
      </Card>
   );
};

// --- Daily Quiz ---
export const DailyQuizBlock = ({ quiz, onComplete }) => {
   const [currentQIndex, setCurrentQIndex] = useState(0);
   const [selectedOption, setSelectedOption] = useState(null);
   const [score, setScore] = useState(0);
   const [showFeedback, setShowFeedback] = useState(false);
   const [isCompleted, setIsCompleted] = useState(false);

   const currentQuestion = quiz.questions[currentQIndex];
   const isLast = currentQIndex === quiz.questions.length - 1;

   const handleValidate = () => {
      setShowFeedback(true);
      if (selectedOption === currentQuestion.correctAnswer.toString()) {
         setScore(prev => prev + 1);
      }
   };

   const handleNext = () => {
      setShowFeedback(false);
      setSelectedOption(null);
      if (isLast) {
         setIsCompleted(true);
         onComplete(score + (selectedOption === currentQuestion.correctAnswer.toString() ? 1 : 0));
      } else {
         setCurrentQIndex(prev => prev + 1);
      }
   };

   if (isCompleted) {
      return (
         <Card className="bg-[#192734] border-white/10 p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
               <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Quiz Terminé !</h3>
            <p className="text-gray-400 mb-6">Vous avez obtenu un score de {score} / {quiz.questions.length}</p>
            <Progress value={(score / quiz.questions.length) * 100} className="h-2 bg-gray-700 mb-6" indicatorClassName="bg-green-500" />
            {score >= quiz.minScore ? (
               <Alert className="bg-green-500/10 border-green-500/50 text-green-400 mb-4">
                  <CheckCircle className="w-4 h-4" />
                  <AlertTitle>Succès !</AlertTitle>
                  <AlertDescription>Vous pouvez passer à la suite.</AlertDescription>
               </Alert>
            ) : (
               <Alert className="bg-red-500/10 border-red-500/50 text-red-400 mb-4">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>Attention</AlertTitle>
                  <AlertDescription>Score insuffisant. Veuillez revoir le cours.</AlertDescription>
               </Alert>
            )}
         </Card>
      );
   }

   return (
      <Card className="bg-[#192734] border-white/10 p-6 shadow-lg">
         <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-purple-500/20 rounded-lg">
                  <HelpCircle className="w-6 h-6 text-purple-400" />
               </div>
               <h3 className="text-xl font-bold text-white">Quiz du jour</h3>
            </div>
            <span className="text-sm text-gray-400">Question {currentQIndex + 1} / {quiz.questions.length}</span>
         </div>

         <div className="mb-6">
            <h4 className="text-lg text-white font-medium mb-4">{currentQuestion.text}</h4>
            <RadioGroup value={selectedOption} onValueChange={setSelectedOption} disabled={showFeedback} className="space-y-3">
               {currentQuestion.options.map((opt, idx) => (
                  <div key={idx} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                     showFeedback 
                        ? (idx === currentQuestion.correctAnswer ? "bg-green-500/20 border-green-500" : (selectedOption === idx.toString() ? "bg-red-500/20 border-red-500" : "border-white/10"))
                        : "border-white/10 hover:bg-white/5"
                  }`}>
                     <RadioGroupItem value={idx.toString()} id={`opt-${idx}`} className="border-white/30 text-[var(--school-accent)]" />
                     <Label htmlFor={`opt-${idx}`} className="text-gray-300 cursor-pointer flex-1">{opt}</Label>
                  </div>
               ))}
            </RadioGroup>
         </div>

         {showFeedback && (
            <div className="mb-6 bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg text-sm text-blue-200">
               <strong>Explication : </strong> {currentQuestion.explanation}
            </div>
         )}

         <div className="flex justify-end">
            {!showFeedback ? (
               <Button onClick={handleValidate} disabled={!selectedOption} className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold">
                  Valider
               </Button>
            ) : (
               <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                  {isLast ? "Terminer" : "Question Suivante"} <ChevronRight className="w-4 h-4 ml-2" />
               </Button>
            )}
         </div>
      </Card>
   );
};