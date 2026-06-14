import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, PlayCircle, FileText, ChevronRight, Menu, X, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CoursePlayerPage = () => {
  const { id } = useParams(); // Should be course ID or logic to find course
  const navigate = useNavigate();
  // Mock finding data for demo purposes since we don't have full routing for ID yet
  const { formations } = useDataSync();
  
  // Flattening for demo find
  const allCourses = formations.flatMap(f => f.modules).flatMap(m => m.courses || []);
  const course = allCourses[0]; // Just take first for demo if id not found
  const parentModule = formations.flatMap(f => f.modules).find(m => m.courses?.some(c => c.id === course?.id));

  const [activeSlide, setActiveSlide] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!course) return <div className="text-white p-20 text-center">Cours non trouvé.</div>;

  const slides = course.content?.slides || [{title: "Contenu", content: "..."}];

  return (
    <div className="h-screen bg-[#0F1419] flex overflow-hidden">
      {/* Course Sidebar */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-white/10 bg-[#192734] flex flex-col"
          >
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
               <h3 className="font-bold text-white truncate max-w-[200px]">{parentModule?.title || "Module"}</h3>
               <Button size="icon" variant="ghost" onClick={() => setIsSidebarOpen(false)} className="text-gray-400"><X className="h-4 w-4"/></Button>
            </div>
            <ScrollArea className="flex-1">
               <div className="p-4 space-y-2">
                 {parentModule?.courses?.map((c, idx) => (
                   <div key={c.id} className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer ${c.id === course.id ? 'bg-[var(--school-accent)] text-black' : 'text-gray-400 hover:bg-white/5'}`}>
                      {c.type === 'video' ? <PlayCircle className="h-4 w-4"/> : <FileText className="h-4 w-4"/>}
                      <div className="text-sm font-medium line-clamp-2">{c.title}</div>
                      {c.completed && <CheckCircle className="h-3 w-3 ml-auto text-green-500"/>}
                   </div>
                 ))}
               </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0F1419]">
           <div className="flex items-center gap-4">
             {!isSidebarOpen && <Button size="icon" variant="ghost" onClick={() => setIsSidebarOpen(true)} className="text-white"><Menu className="h-5 w-5"/></Button>}
             <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4 mr-2"/> Retour</Button>
           </div>
           <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">Progression: 45%</span>
              <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-[var(--school-accent)] w-[45%]"></div>
              </div>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">Terminer leçon</Button>
           </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 flex justify-center">
           <div className="w-full max-w-4xl space-y-8">
              <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative group">
                 {/* Simulated Content Player */}
                 <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-12 text-center">
                    <div>
                       <h1 className="text-4xl font-serif font-bold text-white mb-6">{slides[activeSlide]?.title}</h1>
                       <p className="text-xl text-gray-300 leading-relaxed">{slides[activeSlide]?.content}</p>
                    </div>
                 </div>

                 {/* Slide Controls */}
                 <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="secondary" disabled={activeSlide === 0} onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}>Précédent</Button>
                    <span className="bg-black/50 text-white px-3 py-2 rounded-lg backdrop-blur text-sm">{activeSlide + 1} / {slides.length}</span>
                    <Button variant="secondary" disabled={activeSlide === slides.length - 1} onClick={() => setActiveSlide(Math.min(slides.length - 1, activeSlide + 1))}>Suivant</Button>
                 </div>
              </div>

              <div className="bg-[#192734] rounded-xl p-6 border border-white/10">
                 <h2 className="text-xl font-bold text-white mb-4">Notes & Ressources</h2>
                 <p className="text-gray-400 text-sm mb-4">{course.description}</p>
                 <div className="flex gap-2">
                    {course.resources?.map(r => (
                      <Button key={r.id} variant="outline" size="sm" className="border-white/10 text-gray-300">
                        <FileText className="h-3 w-3 mr-2"/> {r.title}
                      </Button>
                    ))}
                 </div>
              </div>
           </div>
        </main>
      </div>
    </div>
  );
};

export default CoursePlayerPage;