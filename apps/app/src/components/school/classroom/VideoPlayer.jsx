import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, 
  SkipBack, SkipForward, Subtitles, MoreVertical, Download, Share2, Flag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useVideoProgress } from './VideoProgressTracker';

const formatTime = (seconds) => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const VideoPlayer = ({ video, onEnded, onProgressUpdate }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  // Safe hook usage - will return fallback if provider is missing
  const { updateVideoProgress, getVideoProgress } = useVideoProgress();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [quality, setQuality] = useState('1080p');
  
  const controlsTimeoutRef = useRef(null);

  // Load saved progress on mount - moved to top level
  useEffect(() => {
    if (video?.id) {
      const saved = getVideoProgress(video.id);
      if (saved && saved.currentTime > 0 && videoRef.current) {
        videoRef.current.currentTime = saved.currentTime;
        setCurrentTime(saved.currentTime);
      }
    }
  }, [video?.id, getVideoProgress]);

  // Safety check for video prop - moved after hooks
  if (!video) {
    return <div className="aspect-video bg-black flex items-center justify-center text-gray-500">Vidéo non disponible</div>;
  }

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (video?.id) {
        updateVideoProgress(video.id, videoRef.current.currentTime, videoRef.current.duration);
      }
      if (onProgressUpdate) onProgressUpdate(videoRef.current.currentTime, videoRef.current.duration);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (value) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.volume = newMuted ? 0 : volume;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const changeSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Main Player Container */}
      <div 
        ref={containerRef}
        className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group select-none ring-1 ring-white/10"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={video.url}
          className="w-full h-full object-contain"
          onClick={handlePlayPause}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={onEnded}
          poster={video.thumbnail}
        />

        {/* Loading / Big Play Button Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none transition-opacity duration-300">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
               <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
          </div>
        )}

        {/* Gradient Overlay for Controls */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent transition-opacity duration-300 flex flex-col justify-end p-4 md:p-6",
          showControls ? "opacity-100" : "opacity-0"
        )}>
          {/* Progress Bar */}
          <div className="mb-4 group/timeline relative h-2 flex items-center cursor-pointer">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={1}
              onValueChange={handleSeek}
              className="z-20 [&>.relative>.absolute]:bg-[#D4AF37] [&>.relative]:bg-white/20"
            />
            {/* Hover timestamp tooltip could go here */}
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handlePlayPause} className="text-white hover:text-[#D4AF37] transition-colors">
                {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current" />}
              </button>
              
              <div className="flex items-center gap-2 group/volume">
                <button onClick={toggleMute} className="text-white hover:text-[#D4AF37] transition-colors">
                  {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </button>
                <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300">
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    min={0}
                    max={1}
                    step={0.1}
                    onValueChange={handleVolumeChange}
                    className="w-20 ml-2 [&>.relative>.absolute]:bg-white [&>.relative]:bg-white/30"
                  />
                </div>
              </div>

              <div className="text-white text-sm font-mono tracking-wide">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
               {/* Speed Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-white/80 hover:text-white hover:bg-white/10 px-2 py-1 rounded text-sm font-bold transition-all">
                    {playbackSpeed}x
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#192734] border-[#D4AF37]/20 text-white">
                  {[0.5, 1, 1.25, 1.5, 2].map(speed => (
                    <DropdownMenuItem 
                      key={speed} 
                      onClick={() => changeSpeed(speed)}
                      className={cn("cursor-pointer hover:bg-white/10 focus:bg-white/10", playbackSpeed === speed && "text-[#D4AF37]")}
                    >
                      {speed}x
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Quality Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-white/80 hover:text-white hover:bg-white/10 px-2 py-1 rounded text-xs font-bold border border-white/20 transition-all uppercase">
                    {quality}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#192734] border-[#D4AF37]/20 text-white">
                  {['1080p', '720p', '480p', 'Auto'].map(q => (
                    <DropdownMenuItem 
                      key={q} 
                      onClick={() => setQuality(q)}
                      className={cn("cursor-pointer hover:bg-white/10 focus:bg-white/10", quality === q && "text-[#D4AF37]")}
                    >
                      {q}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <button onClick={toggleFullscreen} className="text-white hover:text-[#D4AF37] transition-colors">
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Details & Resources */}
      <div className="space-y-6">
        <div className="flex justify-between items-start gap-4 flex-wrap">
           <div className="flex-1 min-w-[300px]">
              <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 mb-2">
                 {video.title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                 <span className="flex items-center gap-1"><Play className="w-3 h-3" /> {formatTime(video.duration)} min</span>
                 <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                 <span>Publié le 12 Oct 2024</span>
              </div>
           </div>
           
           <div className="flex gap-2">
              <TooltipProvider>
                 <Tooltip>
                    <TooltipTrigger asChild>
                       <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/5 text-gray-300 hover:text-white gap-2">
                          <Share2 className="w-4 h-4" /> <span className="hidden sm:inline">Partager</span>
                       </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copier le lien</TooltipContent>
                 </Tooltip>

                 <Tooltip>
                    <TooltipTrigger asChild>
                       <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/5 text-gray-300 hover:text-white gap-2">
                          <Flag className="w-4 h-4" /> <span className="hidden sm:inline">Signaler</span>
                       </Button>
                    </TooltipTrigger>
                    <TooltipContent>Signaler un problème</TooltipContent>
                 </Tooltip>
              </TooltipProvider>
           </div>
        </div>

        <div className="bg-[#192734] rounded-xl p-6 border border-white/5">
           <h3 className="font-bold text-white mb-3 text-lg">À propos de ce cours</h3>
           <p className="text-gray-300 leading-relaxed mb-6">
              {video.description}
           </p>
           
           {video.resources && video.resources.length > 0 && (
              <div className="border-t border-white/10 pt-4">
                 <h4 className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider mb-3">Ressources & Fichiers</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {video.resources.map((resource, idx) => (
                       <a 
                          key={idx} 
                          href={resource.url}
                          className="flex items-center justify-between p-3 rounded-lg bg-[#0F1419] border border-white/5 hover:border-[#D4AF37]/50 hover:bg-white/5 transition-all group"
                       >
                          <div className="flex items-center gap-3">
                             <div className="p-2 bg-[#D4AF37]/10 rounded text-[#D4AF37]">
                                <Download className="w-4 h-4" />
                             </div>
                             <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                                {resource.title}
                             </span>
                          </div>
                          <Badge variant="secondary" className="text-[10px] bg-white/5 text-gray-500 uppercase">{resource.type}</Badge>
                       </a>
                    ))}
                 </div>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;