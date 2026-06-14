import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Play, Pause, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const animations = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  slide: { initial: { x: 100, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -100, opacity: 0 } },
  zoom: { initial: { scale: 0.8, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 1.2, opacity: 0 } },
  rotate: { initial: { rotate: -10, opacity: 0 }, animate: { rotate: 0, opacity: 1 }, exit: { rotate: 10, opacity: 0 } },
  bounce: { initial: { y: -50, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 50, opacity: 0 } }
};

const ProjectorMode = ({ slides, initialSlide = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialSlide);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentSlide = slides[currentIndex];
  const progress = ((currentIndex + 1) / slides.length) * 100;

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => (prev < slides.length - 1 ? prev + 1 : prev));
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => console.log(e));
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen(); 
        setIsFullscreen(false);
      }
    }
  };

  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  // Auto-play Logic (Simple)
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        if (currentIndex < slides.length - 1) handleNext();
        else setIsPlaying(false);
      }, (currentSlide.duration * 1000) + 3000); // Duration + 3s reading time
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, slides.length, handleNext, currentSlide.duration]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col text-white">
      {/* Top Bar */}
      <div className="flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 w-full z-20">
        <h2 className="text-lg font-bold opacity-80">{currentSlide.title}</h2>
        <div className="flex gap-2">
           <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/10">
              {isFullscreen ? <Minimize className="w-5 h-5"/> : <Maximize className="w-5 h-5"/>}
           </Button>
           <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-red-500/20 hover:text-red-500">
              <X className="w-6 h-6"/>
           </Button>
        </div>
      </div>

      {/* Slide Content Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-8 md:p-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            variants={animations[currentSlide.animation || 'fade']}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: currentSlide.duration || 0.5, delay: currentSlide.delay || 0 }}
            className="w-full max-w-6xl h-full flex flex-col md:flex-row items-center gap-8 md:gap-16"
          >
             {/* Left/Center Text */}
             <div className={`flex-1 space-y-6 ${currentSlide.image ? 'md:text-left' : 'text-center'}`}>
                <h1 className="text-4xl md:text-6xl font-serif font-bold text-[var(--school-accent)] leading-tight">
                   {currentSlide.title}
                </h1>
                <div 
                   className="prose prose-invert prose-lg md:prose-xl max-w-none"
                   dangerouslySetInnerHTML={{ __html: currentSlide.content }}
                />
             </div>

             {/* Right Image (if exists) */}
             {currentSlide.image && (
                <div className="flex-1 h-full max-h-[60vh] flex items-center justify-center">
                   <img 
                      src={currentSlide.image} 
                      alt="Slide visual" 
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
                   />
                </div>
             )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="p-6 bg-gradient-to-t from-black/90 to-transparent z-20 space-y-4">
         <Progress value={progress} className="h-1 bg-white/10" indicatorClassName="bg-[var(--school-accent)]" />
         
         <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-gray-400">
               {currentIndex + 1} / {slides.length}
            </span>

            <div className="flex gap-4">
               <Button variant="outline" size="icon" onClick={handlePrev} disabled={currentIndex === 0} className="rounded-full border-white/20 hover:bg-white/10 text-white">
                  <ChevronLeft className="w-5 h-5"/>
               </Button>
               <Button variant="outline" size="icon" onClick={() => setIsPlaying(!isPlaying)} className={`rounded-full border-white/20 hover:bg-white/10 ${isPlaying ? 'text-[var(--school-accent)]' : 'text-white'}`}>
                  {isPlaying ? <Pause className="w-5 h-5"/> : <Play className="w-5 h-5"/>}
               </Button>
               <Button variant="outline" size="icon" onClick={handleNext} disabled={currentIndex === slides.length - 1} className="rounded-full border-white/20 hover:bg-white/10 text-white">
                  <ChevronRight className="w-5 h-5"/>
               </Button>
            </div>

            <div className="w-10"></div> {/* Spacer for alignment */}
         </div>
      </div>
    </div>
  );
};

export default ProjectorMode;