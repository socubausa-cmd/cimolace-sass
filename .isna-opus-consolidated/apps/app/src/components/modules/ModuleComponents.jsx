import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, ChevronUp, FileText, Video, Mic, 
  BookOpen, Download, Star, Lock, CheckCircle, 
  Clock, Calendar, User, Info 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// --- Utility Helper ---
export const getResourceIcon = (type) => {
  switch (type) {
    case 'PDF': return <FileText className="w-4 h-4" />;
    case 'Video': return <Video className="w-4 h-4" />;
    case 'Audio': return <Mic className="w-4 h-4" />;
    case 'Article': return <BookOpen className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
};

// --- WeeklyContentAccordion ---
export const WeeklyContentAccordion = ({ week, isExpanded, onToggle, isLocked = false }) => {
  return (
    <div className="bg-[#192734] border border-white/5 rounded-xl overflow-hidden mb-4 transition-all duration-300 hover:border-[#D4AF37]/30">
      <button 
        onClick={onToggle}
        disabled={isLocked}
        className={cn(
          "w-full flex items-center justify-between p-6 transition-colors text-left",
          isLocked ? "opacity-70 cursor-not-allowed bg-black/20" : "hover:bg-white/5 cursor-pointer"
        )}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border",
            isLocked ? "bg-gray-800 border-gray-700 text-gray-500" : "bg-[#0F1419] border-[#D4AF37]/30 text-[#D4AF37]"
          )}>
            {isLocked ? <Lock className="w-5 h-5" /> : week.number}
          </div>
          <div>
            <h3 className={cn("font-bold text-lg", isLocked ? "text-gray-500" : "text-white")}>
              {week.title}
            </h3>
            <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
              <Clock className="w-3 h-3" /> {week.duration}
            </div>
          </div>
        </div>
        {isLocked ? null : (isExpanded ? <ChevronUp className="w-5 h-5 text-[#D4AF37]" /> : <ChevronDown className="w-5 h-5 text-gray-400" />)}
      </button>
      
      <AnimatePresence>
        {isExpanded && !isLocked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-6 pt-0 border-t border-white/5 bg-[#0F1419]/30">
              <p className="text-gray-300 mb-6 italic">{week.description}</p>
              
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-sm font-bold text-[#D4AF37] uppercase mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> Sujets Abordés
                  </h4>
                  <ul className="space-y-2">
                    {week.topics.map((topic, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-1.5 shrink-0"></span>
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-sm font-bold text-[#D4AF37] uppercase mb-3 flex items-center gap-2">
                    <Download className="w-4 h-4" /> Ressources
                  </h4>
                  <div className="space-y-2">
                    {week.resources.map((res, idx) => (
                      <ResourceCard key={idx} resource={res} />
                    ))}
                  </div>
                </div>
              </div>

              {week.exercises && (
                <div className="mt-6 pt-6 border-t border-white/5">
                   <h4 className="text-sm font-bold text-[#D4AF37] uppercase mb-3">Exercices Pratiques</h4>
                   <div className="grid gap-2">
                     {week.exercises.map((ex, idx) => (
                       <div key={idx} className="bg-white/5 p-3 rounded-lg text-sm text-gray-300 border border-white/5 flex items-center justify-between">
                         <span>{ex}</span>
                         <Button size="sm" variant="ghost" className="h-6 text-[#D4AF37] hover:text-white">Détails</Button>
                       </div>
                     ))}
                   </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- LearningObjectiveCard ---
export const LearningObjectiveCard = ({ objective }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className="bg-[#192734] border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/5 transition-colors group"
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="mt-1">
            <CheckCircle className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h4 className="font-bold text-white group-hover:text-[#D4AF37] transition-colors">{objective.title}</h4>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <p className="text-sm text-gray-400 mt-2">{objective.description}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-gray-500 transition-transform", isOpen && "rotate-180")} />
      </div>
      {objective.bloom_level && (
        <div className="mt-2 ml-8">
           <Badge variant="outline" className="text-[10px] text-gray-500 border-gray-700">{objective.bloom_level}</Badge>
        </div>
      )}
    </div>
  );
};

// --- ResourceCard ---
export const ResourceCard = ({ resource }) => {
  const { toast } = useToast();

  const handleAccess = (e) => {
    e.stopPropagation();
    toast({
      title: "Accès Ressource",
      description: `Ouverture de : ${resource.title}`,
      duration: 2000
    });
  };

  return (
    <div 
      onClick={handleAccess}
      className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors border border-transparent hover:border-white/10"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-md",
          resource.type === 'PDF' ? "bg-red-500/10 text-red-400" :
          resource.type === 'Video' ? "bg-blue-500/10 text-blue-400" :
          resource.type === 'Audio' ? "bg-purple-500/10 text-purple-400" : "bg-green-500/10 text-green-400"
        )}>
          {getResourceIcon(resource.type)}
        </div>
        <div>
           <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors line-clamp-1">{resource.title}</p>
           <p className="text-[10px] text-gray-500">{resource.type} • {resource.duration}</p>
        </div>
      </div>
      <Download className="w-4 h-4 text-gray-600 group-hover:text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-all" />
    </div>
  );
};

// --- ReviewCard ---
export const ReviewCard = ({ review }) => (
  <div className="bg-[#192734] p-4 rounded-xl border border-white/5">
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center gap-2">
         <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-bold text-xs">
            {review.user.charAt(0)}
         </div>
         <div>
            <p className="text-sm font-bold text-white">{review.user}</p>
            <p className="text-sm text-gray-500">{new Date(review.date).toLocaleDateString()}</p>
         </div>
      </div>
      <div className="flex items-center gap-0.5">
         {[...Array(5)].map((_, i) => (
            <Star key={i} className={cn("w-3 h-3", i < review.rating ? "text-[#D4AF37] fill-[#D4AF37]" : "text-gray-700")} />
         ))}
      </div>
    </div>
    <p className="text-sm text-gray-400 italic">"{review.comment}"</p>
  </div>
);

// --- EvaluationCriteria ---
export const EvaluationCriteria = ({ evaluations }) => (
  <div className="space-y-6">
    <div>
      <h4 className="text-sm font-bold text-[#D4AF37] uppercase mb-3 border-b border-white/10 pb-2">Contrôle Continu</h4>
      <div className="space-y-3">
        {evaluations.continuous.map((item, i) => (
           <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
              <div>
                 <p className="font-medium text-white text-sm">{item.name}</p>
                 <p className="text-sm text-gray-500">{item.criteria}</p>
              </div>
              <Badge className="bg-[#D4AF37] text-black font-bold">{item.weight}</Badge>
           </div>
        ))}
      </div>
    </div>
    <div>
      <h4 className="text-sm font-bold text-[#D4AF37] uppercase mb-3 border-b border-white/10 pb-2">Examen Final</h4>
      <div className="space-y-3">
        {evaluations.final.map((item, i) => (
           <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
              <div>
                 <p className="font-medium text-white text-sm">{item.name}</p>
                 <p className="text-sm text-gray-500">{item.criteria}</p>
              </div>
              <Badge className="bg-[#D4AF37] text-black font-bold">{item.weight}</Badge>
           </div>
        ))}
      </div>
    </div>
  </div>
);