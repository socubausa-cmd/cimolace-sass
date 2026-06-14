import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, AlertTriangle, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const QuizPlayerInterface = ({ quiz, onComplete, onCancel }) => {
  const [started, setStarted] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);
  
  const currentQ = quiz.questions[currentQIndex];
  const progress = ((currentQIndex) / quiz.questions.length) * 100;

  const handleStart = () => setStarted(true);

  const handleAnswer = (val) => {
    setAnswers({ ...answers, [currentQIndex]: parseInt(val) });
  };

  const nextQuestion = () => {
    if (currentQIndex < quiz.questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
    } else {
      setFinished(true);
    }
  };

  const prevQuestion = () => {
    if (currentQIndex > 0) setCurrentQIndex(currentQIndex - 1);
  };

  const calculateScore = () => {
    let score = 0;
    let totalPoints = 0;
    quiz.questions.forEach((q, idx) => {
      totalPoints += q.points;
      if (answers[idx] === q.correctAnswer) {
        score += q.points;
      }
    });
    return { score, totalPoints, percentage: Math.round((score / totalPoints) * 100) };
  };

  const results = finished ? calculateScore() : null;
  const passed = results ? results.percentage >= 60 : false;

  if (!started) {
     return (
        <Card className="bg-[#192734] border-white/10 max-w-2xl mx-auto mt-10 text-white">
           <CardContent className="p-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center mx-auto">
                 <CheckCircle className="w-10 h-10 text-[var(--school-accent)]"/>
              </div>
              <div>
                 <h2 className="text-2xl font-bold mb-2">{quiz.title}</h2>
                 <p className="text-gray-400">{quiz.description}</p>
              </div>
              <div className="flex justify-center gap-8 text-sm text-gray-400">
                 <span>{quiz.questions.length} Questions</span>
                 <span>~{quiz.questions.length * 2} Minutes</span>
                 <span>Passage: 60%</span>
              </div>
              <Button onClick={handleStart} className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold px-8 py-6 text-lg w-full max-w-sm">
                 Commencer le Quiz
              </Button>
           </CardContent>
        </Card>
     );
  }

  if (finished) {
     return (
        <Card className="bg-[#192734] border-white/10 max-w-3xl mx-auto mt-10 text-white animate-in fade-in zoom-in-95">
           <CardContent className="p-8">
              <div className="text-center mb-8">
                 {passed ? (
                    <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                       <CheckCircle className="w-12 h-12 text-green-500"/>
                    </div>
                 ) : (
                    <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                       <XCircle className="w-12 h-12 text-red-500"/>
                    </div>
                 )}
                 <h2 className="text-3xl font-bold mb-2">{passed ? 'Félicitations !' : 'Oups...'}</h2>
                 <p className="text-xl">
                    Score: <span className={passed ? 'text-green-400' : 'text-red-400'}>{results.percentage}%</span> ({results.score}/{results.totalPoints})
                 </p>
              </div>

              {/* Detailed Review */}
              <div className="space-y-6 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                 {quiz.questions.map((q, idx) => {
                    const isCorrect = answers[idx] === q.correctAnswer;
                    return (
                       <div key={idx} className={`p-4 rounded-lg border ${isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                          <p className="font-bold mb-2">{idx + 1}. {q.statement}</p>
                          <div className="flex justify-between text-sm">
                             <span>Votre réponse: <span className={isCorrect ? 'text-green-400' : 'text-red-400'}>{q.options[answers[idx]]}</span></span>
                             {!isCorrect && <span className="text-gray-400">Correct: {q.options[q.correctAnswer]}</span>}
                          </div>
                          {q.explanation && (
                             <div className="mt-2 text-sm text-gray-400 border-t border-white/5 pt-2">
                                <strong>Explication:</strong> {q.explanation}
                             </div>
                          )}
                       </div>
                    );
                 })}
              </div>

              <div className="flex gap-4 justify-center">
                 {!passed && (
                    <Button onClick={() => { setFinished(false); setCurrentQIndex(0); setAnswers({}); }} variant="outline" className="border-white/10 text-white">
                       <RefreshCcw className="w-4 h-4 mr-2"/> Réessayer
                    </Button>
                 )}
                 <Button onClick={() => onComplete(results)} className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold px-8">
                    {passed ? 'Continuer' : 'Terminer'}
                 </Button>
              </div>
           </CardContent>
        </Card>
     );
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 space-y-6 text-white">
       {/* Progress Bar */}
       <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
             <span>Question {currentQIndex + 1} sur {quiz.questions.length}</span>
             <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-white/10" indicatorClassName="bg-[var(--school-accent)]" />
       </div>

       <AnimatePresence mode="wait">
          <motion.div
             key={currentQIndex}
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: -20 }}
          >
             <Card className="bg-[#192734] border-white/10">
                <CardContent className="p-8">
                   <h3 className="text-xl font-bold mb-6">{currentQ.statement}</h3>
                   
                   <RadioGroup value={answers[currentQIndex]?.toString()} onValueChange={handleAnswer} className="space-y-4">
                      {currentQ.options.map((opt, oIdx) => (
                         <div key={oIdx} className={`flex items-center space-x-3 p-4 rounded-lg border transition-all cursor-pointer ${answers[currentQIndex] === oIdx ? 'border-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]' : 'border-white/10 hover:bg-white/5'}`}>
                            <RadioGroupItem value={oIdx.toString()} id={`opt-${oIdx}`} className="border-white/50 text-[var(--school-accent)]" />
                            <Label htmlFor={`opt-${oIdx}`} className="flex-1 cursor-pointer text-base">{opt}</Label>
                         </div>
                      ))}
                   </RadioGroup>
                </CardContent>
             </Card>
          </motion.div>
       </AnimatePresence>

       <div className="flex justify-between pt-4">
          <Button 
             variant="ghost" 
             onClick={prevQuestion} 
             disabled={currentQIndex === 0}
             className="text-white hover:bg-white/10"
          >
             <ArrowLeft className="w-4 h-4 mr-2"/> Précédent
          </Button>
          <Button 
             onClick={nextQuestion} 
             disabled={answers[currentQIndex] === undefined}
             className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold"
          >
             {currentQIndex === quiz.questions.length - 1 ? 'Terminer' : 'Suivant'} <ArrowRight className="w-4 h-4 ml-2"/>
          </Button>
       </div>
    </div>
  );
};

export default QuizPlayerInterface;