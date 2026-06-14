import React from 'react';
import { CheckCircle, AlertCircle, Award } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const WeekClosureBlock = ({ requirements, onValidate }) => {
   const { videosWatched, notebooksFilled, quizzesPassed, liveAttended } = requirements;
   const totalVideos = 5;
   const totalNotebooks = 5;
   const totalQuizzes = 5;

   const isComplete = videosWatched >= totalVideos && notebooksFilled >= totalNotebooks && quizzesPassed >= totalQuizzes;

   return (
      <Card className="bg-gradient-to-r from-[#192734] to-[#0f172a] border-white/10 p-8 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-[var(--school-accent)] opacity-10 rounded-full blur-3xl"></div>
         
         <div className="relative z-10 text-center mb-8">
            <div className="inline-flex items-center justify-center p-4 bg-green-500/10 rounded-full mb-4 ring-1 ring-green-500/30">
               <Award className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-white">Validation de la Semaine</h2>
            <p className="text-gray-400">Complétez toutes les étapes pour débloquer la suite.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-2xl mx-auto">
            <RequirementItem label="Vidéos visionnées" current={videosWatched} total={totalVideos} />
            <RequirementItem label="Cahiers remplis" current={notebooksFilled} total={totalNotebooks} />
            <RequirementItem label="Quiz réussis" current={quizzesPassed} total={totalQuizzes} />
            <div className="bg-black/20 p-4 rounded-lg border border-white/5 flex items-center justify-between">
               <span className="text-gray-300">Live de synthèse</span>
               {liveAttended ? <CheckCircle className="w-5 h-5 text-green-500" /> : <span className="text-xs text-yellow-500">Optionnel</span>}
            </div>
         </div>

         <div className="flex justify-center">
            <Button 
               onClick={onValidate} 
               disabled={!isComplete}
               className={`h-12 px-8 text-lg font-bold transition-all ${
                  isComplete 
                     ? "bg-green-600 hover:bg-green-700 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]" 
                     : "bg-gray-700 text-gray-400 cursor-not-allowed"
               }`}
            >
               {isComplete ? "Valider la Semaine & Continuer" : "Terminez les activités pour valider"}
            </Button>
         </div>
      </Card>
   );
};

const RequirementItem = ({ label, current, total }) => {
   const progress = (current / total) * 100;
   const isDone = current >= total;

   return (
      <div className="bg-black/20 p-4 rounded-lg border border-white/5">
         <div className="flex justify-between mb-2">
            <span className="text-gray-300 text-sm font-medium">{label}</span>
            <span className={isDone ? "text-green-500" : "text-[var(--school-accent)]"}>{current}/{total}</span>
         </div>
         <Progress value={progress} className="h-1.5 bg-gray-700" indicatorClassName={isDone ? "bg-green-500" : "bg-[var(--school-accent)]"} />
      </div>
   );
};

export default WeekClosureBlock;