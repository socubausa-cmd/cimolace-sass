import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Clock, Target, FileText, Star, 
  Shield, UserCheck, CheckCircle, AlertTriangle, BookOpen 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { moduleY2Data } from '@/data/moduleData';
import { 
  WeeklyContentAccordion, 
  LearningObjectiveCard, 
  EvaluationCriteria 
} from '@/components/modules/ModuleComponents';

const ModuleDetailPageY2 = () => {
  const { id } = useParams();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate API fetch for Year 2 data
    setLoading(true);
    setTimeout(() => {
      setModule(moduleY2Data);
      setLoading(false);
    }, 500);
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-[#0F1419] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
    </div>
  );

  if (!module) return <div>Module non trouvé</div>;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20 font-sans">
      <Helmet><title>{module.title} | Année 2</title></Helmet>

      {/* --- YEAR 2 HEADER --- */}
      <div className="relative overflow-hidden mb-12 bg-[#192734] border-b border-white/5 pb-12">
        <div className="max-w-7xl mx-auto px-6 pt-12">
          <Link to="/curriculum/second-year" className="inline-flex items-center text-gray-400 hover:text-[#D4AF37] mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour au Catalogue Année 2
          </Link>

          <div className="flex flex-col lg:flex-row gap-12">
            <div className="flex-1">
               <div className="flex items-center gap-3 mb-4">
                  <Badge className="bg-[#D4AF37] text-black font-bold text-lg px-3 hover:bg-[#b5952f]">{module.code}</Badge>
                  <Badge variant="outline" className="text-[#D4AF37] border-[#D4AF37]">{module.type}</Badge>
                  {module.access_level && (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                       <Shield className="w-3 h-3 mr-1" /> {module.access_level}
                    </Badge>
                  )}
               </div>

               <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6 leading-tight">
                  {module.title}
               </h1>
               
               <p className="text-xl text-gray-300 mb-8 leading-relaxed max-w-3xl">
                  {module.description}
               </p>

               <div className="flex flex-wrap gap-8 text-sm text-gray-400">
                  <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-[#D4AF37]" /> {module.duration_weeks} Semaines</div>
                  {module.mentor_required && (
                    <div className="flex items-center gap-2 text-blue-400"><UserCheck className="w-5 h-5" /> Mentor Requis</div>
                  )}
                  <div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#D4AF37]" /> {module.duration_hours} Heures</div>
               </div>
            </div>

            <div className="lg:w-80">
               <div className="bg-[#0F1419] rounded-xl p-6 border border-white/10 shadow-xl">
                  <div className="mb-6">
                     <span className="text-gray-400 text-xs uppercase block mb-1">Prix Modulaire</span>
                     <span className="text-3xl font-bold text-white">{module.price === 0 ? "Inclus*" : `${module.price}€`}</span>
                     {module.price === 0 && <p className="text-[10px] text-gray-500">*Pour les étudiants en cursus académique</p>}
                  </div>

                  <div className="space-y-3">
                     <Button className="w-full bg-[#D4AF37] text-black hover:bg-[#b5952f]">S'inscrire</Button>
                     {module.mentor_required && (
                        <Button variant="outline" className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                           <UserCheck className="w-4 h-4 mr-2" /> Demander un Mentor
                        </Button>
                     )}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-3 gap-12">
         {/* Main Content */}
         <div className="lg:col-span-2 space-y-12">
            
            {/* Prereq Alert */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
               <div>
                  <h4 className="text-sm font-bold text-yellow-500">Validation Préalable Requise</h4>
                  <p className="text-xs text-yellow-200/70 mt-1">Ce module nécessite la validation du tronc commun de l'Année 1. Assurez-vous que votre dossier est à jour.</p>
               </div>
            </div>

            {/* Objectives */}
            <section>
               <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2"><Target className="w-6 h-6 text-[#D4AF37]" /> Objectifs Spécifiques</h2>
               <div className="grid gap-4">
                  {module.objectives.map(obj => <LearningObjectiveCard key={obj.id} objective={obj} />)}
               </div>
            </section>

            {/* Content */}
            <section>
               <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2"><FileText className="w-6 h-6 text-[#D4AF37]" /> Programme Détaillé</h2>
               <div>
                  {module.weeks.map(week => (
                     <WeeklyContentAccordion 
                        key={week.number} 
                        week={week} 
                        isExpanded={expandedWeek === week.number}
                        onToggle={() => setExpandedWeek(expandedWeek === week.number ? null : week.number)}
                     />
                  ))}
               </div>
            </section>
         </div>

         {/* Sidebar */}
         <div className="space-y-8">
            <div className="bg-[#192734] border border-white/10 rounded-2xl p-6">
               <h3 className="text-xl font-bold text-white mb-6">Évaluation</h3>
               <EvaluationCriteria evaluations={module.evaluations} />
            </div>

            <div className="bg-[#192734] border border-white/10 rounded-2xl p-6">
               <h3 className="text-xl font-bold text-white mb-4">Mentor Assigné</h3>
               <div className="flex items-center gap-4">
                  <img src={module.professor.avatar} alt="Mentor" className="w-12 h-12 rounded-full object-cover" />
                  <div>
                     <p className="font-bold text-white text-sm">{module.professor.name}</p>
                     <p className="text-xs text-[#D4AF37]">{module.professor.title}</p>
                  </div>
               </div>
               <p className="text-sm text-gray-500 mt-4 italic">"Ce module requiert une supervision stricte pour garantir la sécurité énergétique de l'étudiant."</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ModuleDetailPageY2;