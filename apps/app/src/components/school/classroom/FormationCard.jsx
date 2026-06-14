import React from 'react';
import { BookOpen, Clock, PlayCircle, ChevronRight, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const FormationCard = ({ formation, onExpand }) => {
  const isStarted = formation.enrolledStudents?.[0]?.progress > 0;
  const progress = formation.enrolledStudents?.[0]?.progress || 0;

  return (
    <Card className="bg-[#192734] border-white/10 overflow-hidden hover:border-green-500/30 transition-all duration-300 group flex flex-col h-full">
       <div className="relative h-40 bg-gray-800 overflow-hidden">
          <img 
             src={formation.thumbnail || `https://source.unsplash.com/random/800x600?education,book&sig=${formation.id}`} 
             alt={formation.title}
             className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
          />
          <div className="absolute top-3 left-3">
             <Badge className="bg-[#0F1419]/80 backdrop-blur text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
                {formation.level}
             </Badge>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#192734] to-transparent h-24"></div>
          
          <div className="absolute bottom-3 left-4 right-4">
             <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span>Progression</span>
                <span>{progress}%</span>
             </div>
             <Progress value={progress} className="h-1.5 bg-gray-700" indicatorClassName={progress === 100 ? "bg-green-500" : "bg-[var(--school-accent)]"} />
          </div>
       </div>

       <div className="p-5 flex-1 flex flex-col">
          <div className="mb-3">
             <h3 className="text-lg font-bold text-white group-hover:text-green-400 transition-colors line-clamp-1">
                {formation.title}
             </h3>
             <p className="text-sm text-gray-400 line-clamp-2 mt-1 min-h-[40px]">
                {formation.description}
             </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4 text-sm text-gray-500">
             <div className="flex items-center gap-1.5 bg-[#0F1419] p-1.5 rounded">
                <BookOpen className="w-3 h-3 text-blue-400" /> {formation.modules.length} Modules
             </div>
             <div className="flex items-center gap-1.5 bg-[#0F1419] p-1.5 rounded">
                <PlayCircle className="w-3 h-3 text-red-400" /> {formation.modules.reduce((acc, m) => acc + m.weeks.reduce((wAcc, w) => wAcc + w.days.reduce((dAcc, d) => dAcc + d.videos.length, 0), 0), 0)} Vidéos
             </div>
             <div className="flex items-center gap-1.5 bg-[#0F1419] p-1.5 rounded">
                <Clock className="w-3 h-3 text-[var(--school-accent)]" /> {formation.duration}
             </div>
             <div className="flex items-center gap-1.5 bg-[#0F1419] p-1.5 rounded">
                <Award className="w-3 h-3 text-purple-400" /> Certifiant
             </div>
          </div>

          <div className="mt-auto pt-4 border-t border-white/5 flex gap-3">
             <Button 
                onClick={() => onExpand(formation.id)}
                className={`flex-1 font-bold ${
                   isStarted 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-[var(--school-accent)] text-black hover:bg-yellow-500'
                }`}
             >
                {isStarted ? 'Continuer' : 'Commencer'} <ChevronRight className="w-4 h-4 ml-1" />
             </Button>
             <Button variant="ghost" className="px-3 text-gray-400 hover:text-white border border-white/10" onClick={() => onExpand(formation.id)}>
                Détails
             </Button>
          </div>
       </div>
    </Card>
  );
};

export default FormationCard;