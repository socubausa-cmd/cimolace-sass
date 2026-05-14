import React, { useState } from 'react';
import { 
  Book, Video, FileText, PenTool, Library, Search, Filter, 
  Download, Star, Clock, Eye, Share2, PlayCircle, Lock,
  CheckCircle, ArrowRight, BookOpen, ChevronRight, Mic
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// --- LibrarySection ---
export const LibrarySection = () => {
  const categories = [
    { id: 'all', label: 'Tout' },
    { id: 'manuels', label: 'Manuels Officiels' },
    { id: 'articles', label: 'Articles' },
    { id: 'theses', label: 'Thèses' }
  ];
  
  const resources = [
    { id: 1, title: "Le Kybalion Décrypté", author: "Hermes T.", type: "PDF", size: "2.4 MB", downloads: 1240, rating: 4.9, module: "F1 - Fondements" },
    { id: 2, title: "Histoire des Rites Africains", author: "Dr. Diop", type: "PDF", size: "5.1 MB", downloads: 850, rating: 4.8, module: "F2 - Histoire" },
    { id: 3, title: "Physique Quantique & Spiritualité", author: "Prorascience", type: "Article", size: "15 min", downloads: 2100, rating: 5.0, module: "F3 - Sciences" },
    { id: 4, title: "Guide de Méditation Solaire", author: "Maitre K.", type: "Audio", size: "45 min", downloads: 3000, rating: 4.9, module: "P1 - Pratique" },
    { id: 5, title: "Symbolisme des Cathédrales", author: "Fulcanelli", type: "PDF", size: "12 MB", downloads: 500, rating: 4.6, module: "F4 - Symbolisme" }
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between gap-4 bg-[#192734] p-4 rounded-xl border border-white/10">
        <div className="flex gap-2 overflow-x-auto">
          {categories.map(c => (
            <Button key={c.id} variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/10 whitespace-nowrap">{c.label}</Button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
           <Input placeholder="Rechercher..." className="pl-9 bg-[#0F1419] border-white/10 text-white" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {resources.map((res, idx) => (
          <motion.div 
            key={res.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group bg-[#192734] border border-white/10 rounded-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-4">
               <div className={cn("p-3 rounded-lg", res.type === 'PDF' ? 'bg-red-500/10 text-red-400' : res.type === 'Audio' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400')}>
                 {res.type === 'PDF' ? <FileText className="w-6 h-6"/> : res.type === 'Audio' ? <Mic className="w-6 h-6"/> : <BookOpen className="w-6 h-6"/>}
               </div>
               <Button size="icon" variant="ghost" className="text-gray-500 hover:text-[#D4AF37]"><Star className="w-5 h-5"/></Button>
            </div>
            
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#D4AF37] transition-colors">{res.title}</h3>
            <p className="text-sm text-gray-400 mb-4">Par {res.author}</p>
            
            <div className="flex items-center justify-between text-sm text-gray-500 border-t border-white/5 pt-4">
               <span>{res.module}</span>
               <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><Download className="w-3 h-3"/> {res.downloads}</span>
                  <span className="flex items-center gap-1 text-[#D4AF37]"><Star className="w-3 h-3 fill-current"/> {res.rating}</span>
               </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// --- VideosSection ---
export const VideosSection = () => {
  const videos = [
    { id: 1, title: "Introduction à l'Hermétisme", duration: "45:00", views: 1200, professor: "Pr. Faust", image: "https://images.unsplash.com/photo-1478720568477-152d9b164e63?w=500" },
    { id: 2, title: "Les 7 Lois Universelles", duration: "1:15:00", views: 980, professor: "Pr. Maria", image: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=500" },
    { id: 3, title: "Alchimie Opérative", duration: "55:00", views: 1500, professor: "Dr. Stone", image: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=500" }
  ];

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
         {videos.map((vid) => (
           <div key={vid.id} className="bg-[#192734] border border-white/10 rounded-xl overflow-hidden group">
              <div className="relative aspect-video">
                 <img src={vid.image} alt={vid.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircle className="w-12 h-12 text-white opacity-80 group-hover:scale-110 transition-transform cursor-pointer" />
                 </div>
                 <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">{vid.duration}</span>
              </div>
              <div className="p-4">
                 <h3 className="font-bold text-white mb-1 line-clamp-1">{vid.title}</h3>
                 <p className="text-sm text-gray-400 mb-3">{vid.professor}</p>
                 <div className="flex justify-between items-center">
                    <div className="flex gap-2 text-sm text-gray-500">
                       <span className="flex items-center gap-1"><Eye className="w-3 h-3"/> {vid.views}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="text-[#D4AF37] hover:bg-[#D4AF37]/10"><Share2 className="w-4 h-4"/></Button>
                 </div>
              </div>
           </div>
         ))}
      </div>
    </div>
  );
};

// --- DocumentsSection ---
export const DocumentsSection = () => {
  return <LibrarySection />; // Reuse Library layout for now with potentially different data source in real app
};

// --- ExercisesSection ---
export const ExercisesSection = () => {
  const activeExercises = [
    { id: 1, title: "Quiz : Les 4 Éléments", module: "F1", deadline: "2025-02-01", difficulty: "Facile", status: "pending" },
    { id: 2, title: "Dissertation : La Loi de Cause à Effet", module: "F3", deadline: "2025-02-15", difficulty: "Intermédiaire", status: "started" }
  ];
  
  const completedExercises = [
    { id: 10, title: "QCM : Histoire Ancienne", module: "F2", score: 18, total: 20, date: "2024-12-10" }
  ];

  return (
    <div className="grid lg:grid-cols-3 gap-8">
       <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold text-white">À Faire</h3>
          {activeExercises.map(ex => (
             <div key={ex.id} className="bg-[#192734] border border-white/10 rounded-xl p-6 flex justify-between items-center hover:border-[#D4AF37]/50 transition-colors">
                <div>
                   <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="border-[#D4AF37] text-[#D4AF37]">{ex.module}</Badge>
                      <span className={cn("text-xs px-2 py-0.5 rounded", ex.difficulty === 'Facile' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500')}>{ex.difficulty}</span>
                   </div>
                   <h4 className="font-bold text-white text-lg">{ex.title}</h4>
                   <p className="text-sm text-gray-400 mt-1">Date limite : {new Date(ex.deadline).toLocaleDateString()}</p>
                </div>
                <Button className="bg-[#D4AF37] text-black hover:bg-[#b5952f]">Commencer</Button>
             </div>
          ))}
       </div>

       <div className="space-y-6">
          <h3 className="text-xl font-bold text-white">Historique</h3>
          <div className="bg-[#192734] border border-white/10 rounded-xl p-6 space-y-4">
             {completedExercises.map(ex => (
                <div key={ex.id} className="pb-4 border-b border-white/5 last:border-0 last:pb-0">
                   <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-gray-300 text-sm">{ex.title}</h4>
                      <span className="font-mono font-bold text-green-400">{ex.score}/{ex.total}</span>
                   </div>
                   <div className="flex justify-between text-sm text-gray-500">
                      <span>{ex.module}</span>
                      <span>{new Date(ex.date).toLocaleDateString()}</span>
                   </div>
                </div>
             ))}
             <Button variant="outline" className="w-full border-white/10 text-gray-400 hover:text-white">Voir tout</Button>
          </div>
       </div>
    </div>
  );
};

// --- GlossarySection ---
export const GlossarySection = () => {
  const terms = [
    { term: "Âme", def: "Principe spirituel vital et immortel, par opposition au corps." },
    { term: "Aura", def: "Champ d'énergie électromagnétique entourant le corps physique." },
    { term: "Chakra", def: "Centre énergétique dans le corps subtil." },
    { term: "Dharma", def: "Loi universelle, ordre cosmique ou devoir personnel." }
  ];

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');

  return (
    <div className="space-y-8">
       <div className="flex flex-wrap gap-1 justify-center bg-[#192734] p-4 rounded-xl border border-white/10">
          {alphabet.map(letter => (
             <button key={letter} className="w-8 h-8 rounded hover:bg-[#D4AF37] hover:text-black transition-colors text-sm font-bold text-gray-400">{letter}</button>
          ))}
       </div>

       <div className="grid md:grid-cols-2 gap-4">
          {terms.map((t, i) => (
             <div key={i} className="bg-[#192734] border border-white/10 p-6 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer">
                <h3 className="text-xl font-serif font-bold text-[#D4AF37] mb-2">{t.term}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{t.def}</p>
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="text-sm text-gray-500 flex items-center hover:text-white">Voir détails <ArrowRight className="w-3 h-3 ml-1"/></span>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};