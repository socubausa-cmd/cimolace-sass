import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, FileText, Check, AlertCircle, MessageSquare, Layers, Calendar, BookOpen, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { generateClassroomData, generateStudentSubmissions } from '@/lib/mockClassroomData';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

const TeacherClassroomPage = ({ defaultView = 'classroom' }) => {
  const { weekId } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState(defaultView);
  const classroomData = useMemo(() => generateClassroomData(), []);
  const availableWeeks = classroomData.weeks || [];
  const activeWeek = useMemo(() => {
    if (!weekId) return availableWeeks[0] || null;
    const byExactId = availableWeeks.find((w) => String(w.id) === String(weekId));
    if (byExactId) return byExactId;
    const byNumber = availableWeeks.find((w) => String(w.id).replace('week-', '') === String(weekId));
    return byNumber || availableWeeks[0] || null;
  }, [availableWeeks, weekId]);

  const [students] = useState(generateStudentSubmissions(activeWeek?.id || weekId));
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentPanelTab, setStudentPanelTab] = useState('notebook');
  const totalNeedsHelp = students.filter((s) => s.needsHelp).length;
  const totalValidated = students.filter((s) => Number(s.progress || 0) >= 75).length;
  const avgProgress = students.length
    ? Math.round(students.reduce((acc, s) => acc + Number(s.progress || 0), 0) / students.length)
    : 0;

  const classesRows = useMemo(() => {
    return availableWeeks.map((week) => {
      const status = week.status === 'active' ? 'active' : week.status === 'completed' ? 'completed' : 'planned';
      return {
        id: week.id,
        title: week.title,
        description: week.description,
        sessions: (week.days || []).length,
        liveLabel: week.openingLive?.status === 'replay' ? 'Replay' : 'Planifié',
        status,
      };
    });
  }, [availableWeeks]);

  return (
    <div className="space-y-6">
       <div className="premium-panel p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Dashboard Professeur - Classes</h1>
              <p className="text-gray-400 text-sm mt-1">Pilotage pédagogique premium avec vue classe et vue multi-classes.</p>
            </div>
            <PremiumSegmentedSelector
              value={view}
              onChange={setView}
              options={[
                { value: 'classroom', label: 'Gestion de classe' },
                { value: 'classes', label: 'Gestion des classes' },
              ]}
              layoutId="teacher-classroom-view-segment-pill"
              compact
              showChevron={false}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Card className="premium-panel border-red-500/20">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Besoin d'aide</p>
                <p className="text-2xl font-bold text-red-400">{totalNeedsHelp}</p>
              </CardContent>
            </Card>
            <Card className="premium-panel border-green-500/20">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Élèves validés</p>
                <p className="text-2xl font-bold text-green-400">{totalValidated}</p>
              </CardContent>
            </Card>
            <Card className="premium-panel">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Progression moyenne</p>
                <p className="text-2xl font-bold text-[#D4AF37]">{avgProgress}%</p>
              </CardContent>
            </Card>
          </div>
       </div>

       <AnimatePresence mode="wait">
         {view === 'classroom' ? (
           <motion.div
             key="teacher-classroom-view"
             initial={{ opacity: 0, y: 8 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -8 }}
             transition={{ duration: 0.2 }}
             className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[70vh]"
           >
             <Card className="premium-panel border-white/10 flex flex-col overflow-hidden">
               <div className="p-4 border-b border-white/10 font-bold text-white flex items-center justify-between">
                 <span>Étudiants - {activeWeek?.title || 'Classe active'}</span>
                 <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30">
                   {students.length}
                 </Badge>
               </div>
               <ScrollArea className="flex-1">
                 <div className="p-2 space-y-1">
                   {students.map(student => (
                     <div
                       key={student.id}
                       onClick={() => setSelectedStudent(student)}
                       className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${
                         selectedStudent?.id === student.id ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/30' : 'hover:bg-white/5 border border-transparent'
                       }`}
                     >
                       <Avatar className="w-10 h-10 border border-white/10">
                         <AvatarImage src={student.avatar} />
                         <AvatarFallback>{student.name[0]}</AvatarFallback>
                       </Avatar>
                       <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-center mb-1">
                           <span className="font-bold text-gray-200 truncate">{student.name}</span>
                           {student.needsHelp && <AlertCircle className="w-4 h-4 text-red-500" />}
                         </div>
                         <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                           <div className="bg-green-500 h-full" style={{ width: `${student.progress}%` }} />
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </ScrollArea>
             </Card>

             <Card className="premium-panel border-white/10 lg:col-span-2 flex flex-col overflow-hidden">
               {selectedStudent ? (
                 <div className="flex flex-col h-full">
                   <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#15202B]">
                     <div className="flex items-center gap-4">
                       <Avatar className="w-12 h-12">
                         <AvatarImage src={selectedStudent.avatar} />
                         <AvatarFallback>{selectedStudent.name[0]}</AvatarFallback>
                       </Avatar>
                       <div>
                         <h2 className="text-xl font-bold text-white">{selectedStudent.name}</h2>
                         <p className="text-sm text-gray-400">Participation pédagogique: active</p>
                       </div>
                     </div>
                     <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold gap-2">
                       <MessageSquare className="w-4 h-4" /> Message privé
                     </Button>
                   </div>

                  <Tabs value={studentPanelTab} onValueChange={setStudentPanelTab} className="flex-1 flex flex-col">
                     <div className="px-6 pt-4">
                      <PremiumSegmentedSelector
                        value={studentPanelTab}
                        onChange={setStudentPanelTab}
                        options={[
                          { value: 'notebook', label: 'Cahiers', badge: `${selectedStudent.notebooks.length}` },
                          { value: 'quiz', label: 'Resultats quiz' },
                        ]}
                        layoutId="teacher-student-panel-segment-pill"
                        compact
                        showChevron={false}
                      />
                     </div>

                     <TabsContent value="notebook" className="flex-1 p-6 overflow-hidden flex flex-col">
                       <ScrollArea className="flex-1 pr-4">
                         <div className="space-y-6">
                           {selectedStudent.notebooks.map((entry, idx) => (
                             <div key={idx} className="bg-[#0F1419] p-4 rounded-lg border border-white/5">
                               <div className="flex justify-between mb-3">
                                 <h4 className="font-bold text-[#D4AF37]">Jour {entry.day}</h4>
                                 <span className="text-sm text-gray-500">Score auto: {entry.score}/5</span>
                               </div>
                               <p className="text-gray-300 italic mb-4">"{entry.content}"</p>
                               <div className="pl-4 border-l-2 border-blue-500/30">
                                 <label className="text-xs text-blue-400 mb-1 block">Feedback enseignant</label>
                                 <Textarea placeholder="Laisser un commentaire..." className="bg-black/20 border-white/10 text-sm h-20 text-white" />
                                 <div className="mt-2 text-right">
                                   <Button size="sm" variant="secondary" className="h-7 text-xs">Envoyer correction</Button>
                                 </div>
                               </div>
                             </div>
                           ))}
                         </div>
                       </ScrollArea>
                     </TabsContent>

                     <TabsContent value="quiz" className="flex-1 p-6">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {selectedStudent.quizScores.map((quiz, idx) => (
                           <Card key={idx} className="bg-[#0F1419] p-4 border-white/5 flex justify-between items-center">
                             <span className="text-gray-300">Quiz Jour {quiz.day}</span>
                             <span className={`font-bold ${quiz.score === quiz.max ? 'text-green-500' : 'text-yellow-500'}`}>
                               {quiz.score}/{quiz.max}
                             </span>
                           </Card>
                         ))}
                       </div>
                     </TabsContent>
                   </Tabs>
                 </div>
               ) : (
                 <div className="flex-1 flex items-center justify-center text-gray-500">
                   Sélectionnez un étudiant pour voir les détails.
                 </div>
               )}
             </Card>
           </motion.div>
         ) : (
           <motion.div
             key="teacher-classes-view"
             initial={{ opacity: 0, y: 8 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -8 }}
             transition={{ duration: 0.2 }}
             className="space-y-4"
           >
             {classesRows.map((row) => (
               <Card key={row.id} className="premium-panel border-white/10">
                 <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
                   <div>
                     <p className="text-white font-semibold">{row.title}</p>
                     <p className="text-gray-400 text-sm mt-1">{row.description}</p>
                     <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                       <span className="inline-flex items-center gap-1"><Layers className="w-3 h-3" /> {row.sessions} séances</span>
                       <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Live: {row.liveLabel}</span>
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <Badge className={row.status === 'active' ? 'bg-green-500' : row.status === 'completed' ? 'bg-blue-500' : 'bg-gray-500'}>
                       {row.status === 'active' ? 'Active' : row.status === 'completed' ? 'Terminée' : 'Planifiée'}
                     </Badge>
                     <Button
                       onClick={() => {
                         setView('classroom');
                         navigate(`/teacher-space/classroom/${row.id}`);
                       }}
                       className="bg-[#D4AF37] text-black hover:bg-[#c4a030]"
                     >
                       Ouvrir <ArrowRight className="w-4 h-4 ml-2" />
                     </Button>
                   </div>
                 </CardContent>
               </Card>
             ))}
             {classesRows.length === 0 ? (
               <Card className="premium-panel border-white/10">
                 <CardContent className="p-10 text-center">
                   <BookOpen className="w-8 h-8 text-[#D4AF37] mx-auto mb-3" />
                   <p className="text-white font-medium">Aucune classe disponible</p>
                 </CardContent>
               </Card>
             ) : null}
           </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
};

export default TeacherClassroomPage;