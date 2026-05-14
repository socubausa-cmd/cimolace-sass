import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Clock, BookOpen, Target, FileText, 
  Star, Share2, Heart, GraduationCap, MapPin, Calendar, Info, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { moduleF2Data } from '@/data/moduleData';
import { 
  WeeklyContentAccordion, 
  LearningObjectiveCard, 
  ReviewCard, 
  EvaluationCriteria 
} from '@/components/modules/ModuleComponents';

const ModuleDetailPage = () => {
  const { id } = useParams();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false); // Simulate enrollment
  const [expandedWeek, setExpandedWeek] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate API fetch
    setLoading(true);
    setTimeout(() => {
      setModule(moduleF2Data);
      setLoading(false);
    }, 500);
  }, [id]);

  const handleEnroll = () => {
    setIsEnrolled(true);
    toast({
      title: "Inscription Réussie",
      description: `Bienvenue dans le module ${module.title} !`,
      className: "bg-green-600 text-white border-none"
    });
  };

  const handleAction = (action) => {
    toast({
      title: action,
      description: "Fonctionnalité en cours de développement.",
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0F1419] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
    </div>
  );

  if (!module) return <div>Module non trouvé</div>;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20 font-sans">
      <Helmet><title>{module.title} | Curriculum</title></Helmet>

      {/* --- HERO HEADER --- */}
      <div className="relative overflow-hidden mb-12">
        <div className="absolute inset-0 bg-gradient-to-r from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5 opacity-30" />
        <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
          <Link to="/curriculum/first-year" className="inline-flex items-center text-gray-400 hover:text-[#D4AF37] mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour au Cursus
          </Link>

          <div className="flex flex-col lg:flex-row gap-12 items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="outline" className="border-[#D4AF37] text-[#D4AF37] text-lg px-3 py-1 font-bold">{module.code}</Badge>
                <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30">{module.type}</Badge>
                <span className="text-gray-400 uppercase tracking-widest text-xs font-semibold">{module.trimester}</span>
              </div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-5xl font-serif font-bold text-white mb-6 leading-tight"
              >
                {module.title}
              </motion.h1>
              
              <p className="text-xl text-gray-300 mb-8 leading-relaxed max-w-3xl">
                {module.description}
              </p>

              <div className="flex flex-wrap gap-6 text-sm text-gray-400 border-t border-white/10 pt-6">
                <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-[#D4AF37]" /> {module.duration_weeks} Semaines ({module.duration_hours}h)</div>
                <div className="flex items-center gap-2"><Target className="w-5 h-5 text-[#D4AF37]" /> Niveau {module.level}</div>
                <div className="flex items-center gap-2"><Star className="w-5 h-5 text-[#D4AF37] fill-[#D4AF37]" /> {module.rating}/5 ({module.reviews_count} avis)</div>
              </div>
            </div>

            {/* Action Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-full lg:w-96 bg-[#192734]/80 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-6">
                <img src={module.professor.avatar} alt={module.professor.name} className="w-16 h-16 rounded-full border-2 border-[#D4AF37] object-cover" />
                <div>
                  <h3 className="font-bold text-white">{module.professor.name}</h3>
                  <p className="text-xs text-[#D4AF37] uppercase">{module.professor.title}</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-6 text-sm text-gray-300">
                <div className="flex items-center gap-3"><Calendar className="w-4 h-4 text-gray-500"/> {module.dates}</div>
                <div className="flex items-center gap-3"><Clock className="w-4 h-4 text-gray-500"/> {module.schedule}</div>
                <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-gray-500"/> {module.location}</div>
              </div>

              {!isEnrolled ? (
                <div className="space-y-3">
                  <Button onClick={handleEnroll} className="w-full bg-[#D4AF37] text-black hover:bg-[#b5952f] font-bold py-6 text-lg">
                    S'inscrire au Module
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" onClick={() => handleAction("Favoris")} className="border-white/10 hover:bg-white/5"><Heart className="w-4 h-4 mr-2"/> Favoris</Button>
                    <Button variant="outline" onClick={() => handleAction("Info")} className="border-white/10 hover:bg-white/5"><Info className="w-4 h-4 mr-2"/> Infos</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Progression</span>
                      <span>0%</span>
                    </div>
                    <Progress value={0} className="h-2" />
                  </div>
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold">
                    Continuer le Module
                  </Button>
                  <Button variant="outline" className="w-full border-white/10 hover:bg-white/5">
                    Accéder au Forum
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT GRID --- */}
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-3 gap-12">
        
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-12">
          
          {/* Objectives */}
          <section>
             <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
               <Target className="w-6 h-6 text-[#D4AF37]" /> Objectifs d'Apprentissage
             </h2>
             <div className="grid gap-4">
               {module.objectives.map(obj => (
                 <LearningObjectiveCard key={obj.id} objective={obj} />
               ))}
             </div>
          </section>

          {/* Syllabus */}
          <section>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
              <FileText className="w-6 h-6 text-[#D4AF37]" /> Programme Hebdomadaire
            </h2>
            <div>
              {module.weeks.map(week => (
                <WeeklyContentAccordion 
                  key={week.number} 
                  week={week} 
                  isExpanded={expandedWeek === week.number}
                  onToggle={() => setExpandedWeek(expandedWeek === week.number ? null : week.number)}
                  isLocked={!isEnrolled && week.number > 1} // Lock content if not enrolled
                />
              ))}
            </div>
          </section>

          {/* Prerequisites & Related */}
          <section className="bg-[#192734] rounded-2xl p-8 border border-white/5">
             <h3 className="text-xl font-bold mb-4 text-white">Prérequis</h3>
             <ul className="list-disc list-inside text-gray-300 mb-8 space-y-2">
               {module.prerequisites.map((req, i) => <li key={i}>{req}</li>)}
             </ul>
             
             <h3 className="text-xl font-bold mb-4 text-white">Modules Connexes</h3>
             <div className="flex gap-3">
               {module.related_modules.map((m, i) => (
                 <Badge key={i} variant="secondary" className="bg-white/10 hover:bg-white/20 cursor-pointer px-4 py-2">Module {m}</Badge>
               ))}
             </div>
          </section>

          {/* Reviews */}
          <section>
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3"><Star className="w-6 h-6 text-[#D4AF37]" /> Avis Étudiants</h2>
                <div className="text-right">
                   <div className="text-3xl font-bold text-[#D4AF37]">{module.rating} <span className="text-sm text-gray-500 font-normal">/ 5</span></div>
                   <div className="text-xs text-green-400">{module.recommendation_rate}% recommandent ce cours</div>
                </div>
             </div>
             <div className="grid md:grid-cols-2 gap-4">
               {module.reviews.slice(0, 4).map(review => (
                 <ReviewCard key={review.id} review={review} />
               ))}
             </div>
             <Button variant="ghost" className="w-full mt-4 text-[#D4AF37] hover:bg-[#D4AF37]/10">Voir les {module.reviews_count} avis</Button>
          </section>
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-8">
          
          {/* Evaluations Widget */}
          <div className="bg-[#192734] border border-white/10 rounded-2xl p-6 sticky top-24">
             <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#D4AF37]" /> Critères d'Évaluation
             </h3>
             <EvaluationCriteria evaluations={module.evaluations} />
             
             <div className="mt-8 pt-6 border-t border-white/10">
                <h4 className="text-sm font-bold text-white mb-2">Certification</h4>
                <p className="text-sm text-gray-400 mb-4">Un certificat de réussite est délivré aux étudiants ayant obtenu une moyenne supérieure à 12/20.</p>
                <Button variant="outline" disabled className="w-full border-white/10 text-gray-500">
                   <Lock className="w-3 h-3 mr-2" /> Certificat (Verrouillé)
                </Button>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ModuleDetailPage;