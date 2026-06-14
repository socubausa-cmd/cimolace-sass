import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, GraduationCap, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClassroomProgress } from '@/hooks/useClassroomProgress';
import { WeeklyLiveBlock, ClosingLiveBlock } from '@/components/school/classroom/ClassroomLiveComponents';
import { 
   DayNavigationControls, 
   DailyLessonBlock, 
   RetainedContentBlock, 
   StudentNotebookBlock, 
   DailyQuizBlock 
} from '@/components/school/classroom/DailyLessonComponents';
import WeekClosureBlock from '@/components/school/classroom/WeekClosureBlock';
import { VideoProgressProvider } from '@/components/school/classroom/VideoProgressTracker';

const ClassroomPageContent = () => {
  const { 
    loading, 
    currentWeek, 
    currentDay, 
    currentDayIndex,
    goToNextDay, 
    goToPrevDay,
    updateNotebook,
    submitQuiz,
    validateWeek
  } = useClassroomProgress();

  if (loading || !currentWeek) {
     return <div className="min-h-screen bg-[#0F1419] flex items-center justify-center text-white">Chargement du contenu...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0F1419] pb-20">
       {/* Hero / Header */}
       <div className="bg-gradient-to-b from-[#192734] to-[#0F1419] pt-28 pb-16 px-4 border-b border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          
          <div className="max-w-7xl mx-auto relative z-10">
             <Link to="/formations">
                <Button variant="ghost" className="text-gray-400 hover:text-white mb-6 pl-0">
                   <ChevronLeft className="w-5 h-5 mr-2" /> Retour aux formations
                </Button>
             </Link>
             
             <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                   <div className="flex items-center gap-3 mb-2">
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                         Module 1 • Année 1
                      </span>
                      <span className="text-gray-400 text-sm flex items-center gap-1">
                        <CalendarDays className="w-4 h-4" /> Semaine {currentWeek.weekNumber || 1}
                      </span>
                   </div>
                   <h1 className="text-3xl md:text-5xl font-serif font-bold text-white mb-4 leading-tight">
                      {currentWeek.title}
                   </h1>
                   <p className="text-xl text-gray-300 max-w-2xl">
                      {currentWeek.description}
                   </p>
                </div>

                <div className="w-full md:w-64 bg-black/20 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
                   <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Progression Semaine</span>
                      <span className="text-[var(--school-accent)] font-bold">45%</span>
                   </div>
                   <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-[var(--school-accent)] to-yellow-300 h-full w-[45%]"></div>
                   </div>
                </div>
             </div>
          </div>
       </div>

       <div className="max-w-5xl mx-auto px-4 -mt-8 relative z-20 space-y-12">
          
          {/* Opening Live (Only visible if start of week or explicitly placed) */}
          <div className="animate-in slide-in-from-bottom-4 duration-500 delay-100">
             <WeeklyLiveBlock liveData={currentWeek.openingLive} />
          </div>

          {/* Daily Navigation & Content */}
          <div className="animate-in slide-in-from-bottom-4 duration-500 delay-200">
             <DayNavigationControls 
                currentDay={currentDayIndex} 
                totalDays={currentWeek.days.length} 
                onNext={goToNextDay}
                onPrev={goToPrevDay}
                currentDayLabel={`Jour ${currentDayIndex + 1}`}
             />

             {currentDay && (
                <div className="space-y-8">
                   <DailyLessonBlock day={currentDay} />
                   
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-8">
                         <RetainedContentBlock content={currentDay.content} />
                         <StudentNotebookBlock 
                            question={currentDay.notebook.question} 
                            initialContent={currentDay.notebook.savedContent}
                            onSave={(content) => updateNotebook(currentDay.id, content)}
                         />
                      </div>
                      <div>
                         <DailyQuizBlock quiz={currentDay.quiz} onComplete={(score) => submitQuiz(currentDay.id, score)} />
                      </div>
                   </div>
                </div>
             )}
          </div>

          {/* Week Closure Section */}
          <div className="animate-in slide-in-from-bottom-4 duration-500 delay-300 space-y-8">
             <div className="flex items-center gap-4 my-8">
                <div className="h-px bg-white/10 flex-1"></div>
                <span className="text-gray-500 uppercase tracking-widest text-sm font-bold">Fin de Semaine</span>
                <div className="h-px bg-white/10 flex-1"></div>
             </div>

             <ClosingLiveBlock liveData={currentWeek.closingLive} />
             
             <WeekClosureBlock 
                requirements={currentWeek.requirements} 
                onValidate={validateWeek}
             />
          </div>

          <div className="text-center pt-8">
             <Link to="/classroom/archive" className="text-gray-500 hover:text-[var(--school-accent)] text-sm underline underline-offset-4 transition-colors">
                Voir les semaines précédentes (Archives)
             </Link>
          </div>
       </div>
    </div>
  );
};

const ClassroomPage = () => {
  return (
    <VideoProgressProvider>
      <ClassroomPageContent />
    </VideoProgressProvider>
  );
};

export default ClassroomPage;