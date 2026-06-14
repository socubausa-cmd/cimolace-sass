import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, BarChart, User, ArrowRight, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const ModuleCard = ({ module }) => {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-[#192734] border border-white/5 rounded-xl overflow-hidden hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] hover:shadow-lg hover:shadow-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] transition-all duration-300 flex flex-col h-full group"
    >
      {/* Header with Type Badge */}
      <div className="p-6 pb-4">
        <div className="flex justify-between items-start mb-4">
          <Badge variant="outline" className="border-[var(--school-accent)] text-[var(--school-accent)] font-bold">
            {module.code}
          </Badge>
          <Badge className={`
            ${module.type === 'Pratique' ? 'bg-blue-500/20 text-blue-400' : 
              module.type === 'Mystique' ? 'bg-purple-500/20 text-purple-400' : 
              module.type === 'Théorique' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}
            border border-transparent
          `}>
            {module.type || 'Standard'}
          </Badge>
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-[var(--school-accent)] transition-colors">
          {module.title}
        </h3>
        
        <div className="flex items-center text-sm text-gray-400 gap-1 mb-4">
          <User className="w-3 h-3" />
          <span>{module.professor || 'Enseignant qualifié'}</span>
        </div>
      </div>

      {/* Info Grid */}
      <div className="px-6 py-4 bg-black/20 border-y border-white/5 grid grid-cols-2 gap-4 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-[var(--school-accent)]" />
          <span>{module.duration_weeks} Semaines</span>
        </div>
        <div className="flex items-center gap-2">
          <BookOpen className="w-3 h-3 text-[var(--school-accent)]" />
          <span>{module.duration_hours} Heures</span>
        </div>
        <div className="flex items-center gap-2 col-span-2">
          <BarChart className="w-3 h-3 text-[var(--school-accent)]" />
          <span>Niveau: {module.level}</span>
        </div>
      </div>

      {/* Footer / Action */}
      <div className="p-6 mt-auto">
        <Link to={`/year2-modules/${module.code}`}>
          <Button className="w-full bg-white/5 hover:bg-[var(--school-accent)] hover:text-black text-white border border-white/10 transition-colors group-hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]">
            Voir le Module <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
};

export default ModuleCard;