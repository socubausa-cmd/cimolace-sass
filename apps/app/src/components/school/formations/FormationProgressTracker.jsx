import React from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Lock } from 'lucide-react';

const FormationProgressTracker = ({ formation, studentProgress }) => {
  // Mock Progress Calculation logic
  const calculateModuleProgress = (moduleId) => {
     // Return random for demo or use real data
     return Math.floor(Math.random() * 100);
  };

  return (
    <div className="bg-[#192734] rounded-xl border border-white/10 p-6 space-y-6">
       <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-white">Votre Progression</h3>
          <span className="text-[var(--school-accent)] font-bold">35%</span>
       </div>
       <Progress value={35} className="h-2 bg-black/40" indicatorClassName="bg-[var(--school-accent)]" />
       
       <div className="space-y-1 pt-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {formation.modules.map((mod, idx) => {
             const isLocked = idx > 1; // Mock logic
             const isCompleted = idx === 0;
             
             return (
                <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isLocked ? 'opacity-50' : 'hover:bg-white/5 cursor-pointer'}`}>
                   {isLocked ? (
                      <Lock className="w-5 h-5 text-gray-600 shrink-0"/>
                   ) : isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0"/>
                   ) : (
                      <Circle className="w-5 h-5 text-[var(--school-accent)] shrink-0"/>
                   )}
                   <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isLocked ? 'text-gray-500' : 'text-white'}`}>{mod.title}</p>
                      <p className="text-sm text-gray-500">{mod.weeks.length} semaines</p>
                   </div>
                </div>
             );
          })}
       </div>
    </div>
  );
};

export default FormationProgressTracker;