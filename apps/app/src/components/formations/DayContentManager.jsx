import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Presentation, FileText, Plus, Trash, Edit, Globe, MonitorPlay, Layers } from 'lucide-react';
import VideoUploadModal from './VideoUploadModal';
import PowerPointSlideEditor from './PowerPointSlideEditor';
import GammaIntegration from './GammaIntegration';
import QuizBuilder from './QuizBuilder';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DayContentManager = ({ day, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('videos');
  const [modalOpen, setModalOpen] = useState({ type: null, data: null, index: null });

  // --- Handlers ---
  const handleAddVideo = (videoData) => {
    onUpdate({ ...day, videos: [videoData] });
    setModalOpen({ type: null });
  };

  const handleUpdateReader = (readerData) => {
    onUpdate({ ...day, reader: readerData });
    setModalOpen({ type: null });
  };

  const handleUpdateQuiz = (quizData) => {
    onUpdate({ ...day, quiz: quizData });
    setModalOpen({ type: null });
  };

  const removeVideo = (idx) => {
    const newVideos = day.videos.filter((_, i) => i !== idx);
    onUpdate({ ...day, videos: newVideos });
  };

  const removeReader = () => onUpdate({ ...day, reader: null });
  const removeQuiz = () => onUpdate({ ...day, quiz: null });

  return (
    <div className="bg-black/20 p-4 rounded-lg border border-white/5 space-y-4">
      <div className="flex items-center justify-between">
         <h4 className="font-bold text-white text-sm">{day.title} - Contenu</h4>
         <div className="flex gap-2">
            <Badge variant="outline" className={day.videos?.length ? 'bg-blue-500/20 text-blue-400' : 'text-gray-600'}>
               <Video className="w-3 h-3 mr-1"/> {day.videos?.length || 0}
            </Badge>
            <Badge variant="outline" className={day.reader ? 'bg-orange-500/20 text-orange-400' : 'text-gray-600'}>
               <Presentation className="w-3 h-3 mr-1"/> {day.reader ? 1 : 0}
            </Badge>
            <Badge variant="outline" className={day.quiz ? 'bg-green-500/20 text-green-400' : 'text-gray-600'}>
               <FileText className="w-3 h-3 mr-1"/> {day.quiz ? 1 : 0}
            </Badge>
         </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
         <TabsList className="bg-[#0F1419] border border-white/10 w-full h-auto p-1 grid grid-cols-3">
            <TabsTrigger value="videos" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">Vidéos</TabsTrigger>
            <TabsTrigger value="reader" className="text-xs data-[state=active]:bg-orange-600 data-[state=active]:text-white">Support (PPT/Gamma)</TabsTrigger>
            <TabsTrigger value="quiz" className="text-xs data-[state=active]:bg-green-600 data-[state=active]:text-white">Quiz</TabsTrigger>
         </TabsList>

         <div className="pt-4 min-h-[150px]">
            {/* --- VIDEOS --- */}
            <TabsContent value="videos" className="mt-0 space-y-3">
               {day.videos?.map((vid, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-[#192734] rounded border border-white/10 group">
                     <div className="flex items-center gap-3 overflow-hidden">
                        <Video className="w-4 h-4 text-blue-400 shrink-0"/>
                        <div className="truncate">
                           <p className="text-xs font-bold text-white truncate">{vid.title}</p>
                           <p className="text-[10px] text-gray-500">{vid.duration} min • {vid.type}</p>
                        </div>
                     </div>
                     <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-500 hover:text-red-400" onClick={() => removeVideo(idx)}><Trash className="w-3 h-3"/></Button>
                  </div>
               ))}
               <Button size="sm" variant="outline" className="w-full border-dashed border-white/20 text-gray-400 hover:text-white" onClick={() => setModalOpen({ type: 'video' })}>
                  <Plus className="w-3 h-3 mr-2"/> Ajouter une vidéo
               </Button>
            </TabsContent>

            {/* --- READER (PPT/Gamma) --- */}
            <TabsContent value="reader" className="mt-0 space-y-3">
               {day.reader ? (
                  <div className="p-3 bg-[#192734] rounded border border-orange-500/30 relative">
                     <div className="flex items-center gap-3 mb-2">
                        {day.reader.type === 'gamma' ? <Globe className="w-5 h-5 text-pink-400"/> : <MonitorPlay className="w-5 h-5 text-orange-400"/>}
                        <div>
                           <p className="text-sm font-bold text-white">{day.reader.title}</p>
                           <p className="text-sm text-gray-500">{day.reader.type === 'gamma' ? 'Intégration Gamma' : `${day.reader.slides?.length || 0} Slides`}</p>
                        </div>
                     </div>
                     <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={() => setModalOpen({ type: day.reader.type, data: day.reader })}>Modifier</Button>
                        <Button size="sm" variant="destructive" className="h-7 text-xs flex-1" onClick={removeReader}>Supprimer</Button>
                     </div>
                  </div>
               ) : (
                  <div className="grid grid-cols-2 gap-2">
                     <Button variant="outline" className="h-20 flex flex-col gap-2 border-white/10 hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/50" onClick={() => setModalOpen({ type: 'slides' })}>
                        <Layers className="w-6 h-6"/>
                        <span className="text-xs">Créer Slides</span>
                     </Button>
                     <Button variant="outline" className="h-20 flex flex-col gap-2 border-white/10 hover:bg-pink-500/10 hover:text-pink-400 hover:border-pink-500/50" onClick={() => setModalOpen({ type: 'gamma' })}>
                        <Globe className="w-6 h-6"/>
                        <span className="text-xs">Lien Gamma</span>
                     </Button>
                  </div>
               )}
            </TabsContent>

            {/* --- QUIZ --- */}
            <TabsContent value="quiz" className="mt-0 space-y-3">
               {day.quiz ? (
                  <div className="p-3 bg-[#192734] rounded border border-green-500/30">
                     <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-5 h-5 text-green-400"/>
                        <div>
                           <p className="text-sm font-bold text-white">{day.quiz.title}</p>
                           <p className="text-sm text-gray-500">{day.quiz.questions?.length || 0} Questions</p>
                        </div>
                     </div>
                     <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={() => setModalOpen({ type: 'quiz', data: day.quiz })}>Modifier</Button>
                        <Button size="sm" variant="destructive" className="h-7 text-xs flex-1" onClick={removeQuiz}>Supprimer</Button>
                     </div>
                  </div>
               ) : (
                  <Button size="sm" variant="outline" className="w-full h-20 flex flex-col gap-2 border-dashed border-white/20 text-gray-400 hover:text-green-400 hover:border-green-500/50 hover:bg-green-500/10" onClick={() => setModalOpen({ type: 'quiz' })}>
                     <Plus className="w-6 h-6"/>
                     <span>Créer un Quiz</span>
                  </Button>
               )}
            </TabsContent>
         </div>
      </Tabs>

      {/* --- MODALS --- */}
      <VideoUploadModal 
         isOpen={modalOpen.type === 'video'} 
         onClose={() => setModalOpen({ type: null })} 
         onSave={handleAddVideo} 
      />
      
      <Dialog open={modalOpen.type === 'slides'} onOpenChange={() => setModalOpen({ type: null })}>
         <DialogContent className="max-w-4xl h-[90vh] bg-[#15202B] border-white/10 text-white p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Éditeur de slides</DialogTitle>
            </DialogHeader>
             {/* Note: In a real app we'd pass existing slides to edit, for now simple builder placeholder */}
             <div className="p-6">
                <h2 className="text-xl font-bold mb-4">Éditeur de Slides</h2>
                {/* Simplified Slide Editor Integration - Full implementation would be complex here */}
                <div className="text-center py-20 text-gray-500">
                   <p>L'éditeur complet de slides serait ici.</p>
                   <Button className="mt-4" onClick={() => handleUpdateReader({ type: 'slides', title: 'Nouveau Support', slides: [] })}>Sauvegarder (Simulé)</Button>
                </div>
             </div>
         </DialogContent>
      </Dialog>

      <Dialog open={modalOpen.type === 'gamma'} onOpenChange={() => setModalOpen({ type: null })}>
         <DialogContent className="max-w-2xl bg-[#15202B] border-white/10 text-white">
            <DialogHeader className="sr-only">
              <DialogTitle>Lien Gamma</DialogTitle>
            </DialogHeader>
            <GammaIntegration data={modalOpen.data} onSave={handleUpdateReader} />
         </DialogContent>
      </Dialog>

      <Dialog open={modalOpen.type === 'quiz'} onOpenChange={() => setModalOpen({ type: null })}>
         <DialogContent className="max-w-4xl h-[90vh] overflow-y-auto bg-[#15202B] border-white/10 text-white">
            <DialogHeader className="sr-only">
              <DialogTitle>Éditeur de quiz</DialogTitle>
            </DialogHeader>
            <QuizBuilder quiz={modalOpen.data} onSave={handleUpdateQuiz} onCancel={() => setModalOpen({ type: null })} />
         </DialogContent>
      </Dialog>
    </div>
  );
};

export default DayContentManager;