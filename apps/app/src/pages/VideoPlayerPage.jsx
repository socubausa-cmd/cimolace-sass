import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateVideoPlaylistData } from '@/lib/mockVideoPlaylistData';
import VideoPlayer from '@/components/classroom/VideoPlayer';
import ProgressivePlaylist from '@/components/classroom/ProgressivePlaylist';
import { VideoProgressProvider, useVideoProgress } from '@/components/classroom/VideoProgressTracker';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

// Main Content Component wrapped in Provider
const VideoPlayerContent = () => {
  const navigate = useNavigate();
  const [playlistData, setPlaylistData] = useState([]);
  const [currentFormationId, setCurrentFormationId] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  
  // Track hierarchy context
  const [context, setContext] = useState({
    moduleId: null,
    weekId: null,
    dayId: null
  });

  const { markVideoAsWatched } = useVideoProgress();

  useEffect(() => {
    // Initialize Data
    const data = generateVideoPlaylistData();
    setPlaylistData(data);
    
    // Default to first available if no ID (or handle params logic here if needed)
    if (data.length > 0) {
      const formation = data[0];
      setCurrentFormationId(formation.id);
      
      const firstModule = formation.modules[0];
      const firstWeek = firstModule.weeks[0];
      const firstDay = firstWeek.days[0];
      const firstVideo = firstDay.videos[0];
      
      setCurrentVideo(firstVideo);
      setContext({
        moduleId: firstModule.id,
        weekId: firstWeek.id,
        dayId: firstDay.id
      });
    }
  }, []);

  const handleVideoSelect = (video, dayId, weekId, moduleId) => {
    setCurrentVideo(video);
    setContext({ moduleId, weekId, dayId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleVideoEnded = () => {
    if (currentVideo) {
       markVideoAsWatched(currentVideo.id);
       // Logic to auto-play next video could go here
    }
  };

  if (!currentVideo) return <div className="min-h-screen bg-[#0F1419] flex items-center justify-center text-white">Chargement...</div>;

  return (
    <div className="h-screen bg-[#0F1419] text-white flex flex-col overflow-hidden">
       {/* Header */}
       <header className="h-16 bg-[#192734] border-b border-white/10 flex items-center justify-between px-4 md:px-6 shrink-0 z-20 shadow-md">
          <div className="flex items-center gap-4">
             <Button variant="ghost" size="icon" onClick={() => navigate('/classroom/videos')} className="text-gray-400 hover:text-white hidden md:flex">
                <ChevronLeft className="w-6 h-6" />
             </Button>
             
             {/* Mobile Playlist Toggle */}
             <Sheet>
                <SheetTrigger asChild>
                   <Button variant="ghost" size="icon" className="md:hidden text-[#D4AF37]">
                      <Menu className="w-6 h-6" />
                   </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 bg-[#192734] border-r border-white/10 w-[85%] sm:w-[350px]">
                   <ProgressivePlaylist 
                      playlistData={playlistData}
                      currentFormationId={currentFormationId}
                      currentModuleId={context.moduleId}
                      currentWeekId={context.weekId}
                      currentDayId={context.dayId}
                      currentVideoId={currentVideo.id}
                      onVideoSelect={(v, d, w, m) => {
                         handleVideoSelect(v, d, w, m);
                         // Close sheet logic would require state control of sheet
                      }}
                   />
                </SheetContent>
             </Sheet>

             <div>
                <h1 className="font-bold text-sm md:text-lg leading-tight truncate max-w-[200px] md:max-w-md">{currentVideo.title}</h1>
                <p className="text-[10px] md:text-sm text-gray-400 flex items-center gap-2">
                   <span className="text-[#D4AF37]">Module {context.moduleId ? 'Actif' : ''}</span>
                   <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                   <span>Semaine {context.weekId ? 'Active' : ''}</span>
                </p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <Button variant="outline" className="hidden md:flex border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black font-bold text-xs h-8">
                Tableau de bord
             </Button>
          </div>
       </header>

       <div className="flex-1 flex overflow-hidden relative">
          {/* Main Video Area (70%) */}
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-[#0F1419]">
             <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
                <VideoPlayer 
                   video={currentVideo} 
                   onEnded={handleVideoEnded}
                />
             </div>
             
             {/* Spacer for bottom scrolling */}
             <div className="h-20"></div>
          </div>

          {/* Desktop/Tablet Sidebar (30%) */}
          <div className="hidden md:flex w-[350px] lg:w-[400px] bg-[#192734] border-l border-white/10 flex-col z-10 shadow-xl">
             <ProgressivePlaylist 
                playlistData={playlistData}
                currentFormationId={currentFormationId}
                currentModuleId={context.moduleId}
                currentWeekId={context.weekId}
                currentDayId={context.dayId}
                currentVideoId={currentVideo.id}
                onVideoSelect={handleVideoSelect}
             />
          </div>
       </div>
    </div>
  );
};

// Wrapper Page
const VideoPlayerPage = () => {
   return (
      <VideoProgressProvider>
         <VideoPlayerContent />
      </VideoProgressProvider>
   );
};

export default VideoPlayerPage;