import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { 
  ArrowLeft, Clock, BookOpen, Target, FileText, 
  ChevronDown, ChevronUp, Download, PlayCircle, Lock,
  CheckCircle, User, Calendar, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SecondYearModuleDetailPage = () => {
  const { code } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [module, setModule] = useState(null);
  const [relatedModules, setRelatedModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedWeek, setExpandedWeek] = useState(null);

  useEffect(() => {
    fetchModuleData();
  }, [code]);

  const fetchModuleData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch Main Module
      const { data: modData, error: modError } = await supabase
        .from('modules_year2_complete')
        .select('*')
        .eq('code', code)
        .single();
      
      if (modError) throw modError;
      setModule(modData);

      // Fetch Related (Same Part)
      if (modData) {
        const { data: relData } = await supabase
          .from('modules_year2_complete')
          .select('code, title, type')
          .eq('part', modData.part)
          .neq('code', modData.code)
          .limit(3);
        setRelatedModules(relData || []);
      }
    } catch (err) {
      console.error("Error fetching module:", err);
      
      let errorMessage = "Impossible de charger le module.";
      
      // Handle Infinite Recursion Error (Postgres code 42P17)
      if (err.code === '42P17') {
        errorMessage = "Erreur système (boucle de sécurité détectée). Veuillez contacter le support.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = () => {
    if (!user) {
      toast({ title: "Connexion requise", description: "Veuillez vous connecter pour vous inscrire." });
      return;
    }
    toast({
      title: "Inscription",
      description: `Vous avez demandé l'accès au module ${module.code}.`,
      className: "bg-[#D4AF37] text-black border-none"
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0F1419] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#0F1419] flex flex-col items-center justify-center text-white p-4 text-center">
      <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-xl max-w-md backdrop-blur-sm">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-red-400 mb-2">Erreur de chargement</h2>
        <p className="text-gray-300 mb-6">{error}</p>
        <div className="flex gap-4 justify-center">
          <Link to="/year2-modules">
            <Button variant="outline" className="border-white/20 hover:bg-white/10">
              Retour au catalogue
            </Button>
          </Link>
          <Button onClick={fetchModuleData} variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/20">
            Réessayer
          </Button>
        </div>
      </div>
    </div>
  );

  if (!module) return (
    <div className="min-h-screen bg-[#0F1419] flex items-center justify-center text-white">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Module non trouvé</h2>
        <Link to="/year2-modules" className="text-[#D4AF37] hover:underline">Retour au catalogue</Link>
      </div>
    </div>
  );

  // Parse JSON data safely
  const objectives = Array.isArray(module.learning_objectives) ? module.learning_objectives : [];
  const weeks = Array.isArray(module.weekly_content) ? module.weekly_content : [];
  const resources = Array.isArray(module.resources) ? module.resources : [];
  const evaluation = typeof module.evaluation === 'object' ? module.evaluation : {};

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20 font-sans">
      <Helmet><title>{module.title} | {module.code}</title></Helmet>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-6 mb-8">
        <Link to="/year2-modules" className="inline-flex items-center text-gray-400 hover:text-[#D4AF37] transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour au Catalogue 2ème Année
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-3 gap-12">
        
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge className="bg-[#D4AF37] text-black font-bold text-lg px-3">{module.code}</Badge>
              <span className="text-[#D4AF37] font-semibold tracking-wide uppercase text-sm border border-[#D4AF37]/30 px-3 py-1 rounded-full bg-[#D4AF37]/10">
                {module.part}
              </span>
              <Badge variant="outline" className="text-gray-400 border-gray-600">{module.type}</Badge>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6 leading-tight">
              {module.title}
            </h1>

            <div className="flex flex-wrap gap-6 text-sm text-gray-400 border-b border-white/10 pb-8 mb-8">
              <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-[#D4AF37]" /> {module.duration_weeks} Semaines</div>
              <div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#D4AF37]" /> {module.duration_hours} Heures</div>
              <div className="flex items-center gap-2"><Target className="w-5 h-5 text-[#D4AF37]" /> Niveau {module.level}</div>
            </div>

            {/* Objectives */}
            <div className="bg-[#192734] border border-white/5 rounded-2xl p-8 mb-10">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Target className="w-6 h-6 text-[#D4AF37]" /> Objectifs
              </h2>
              <ul className="grid gap-4">
                {objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Weekly Content */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <FileText className="w-6 h-6 text-[#D4AF37]" /> Programme Détaillé
              </h2>
              {weeks.map((week, idx) => (
                <div key={idx} className="bg-[#192734] border border-white/5 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => setExpandedWeek(expandedWeek === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#0F1419] flex items-center justify-center font-bold text-[#D4AF37] border border-[#D4AF37]/20">
                        {week.week || idx + 1}
                      </div>
                      <h3 className="font-bold text-lg">{week.topic}</h3>
                    </div>
                    {expandedWeek === idx ? <ChevronUp className="w-5 h-5 text-[#D4AF37]" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                  </button>
                  <AnimatePresence>
                    {expandedWeek === idx && (
                      <motion.div 
                        initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 pt-0 border-t border-white/5 bg-[#0F1419]/30 text-gray-300">
                          <p className="mb-4">{week.details}</p>
                          {/* Placeholder for deeper week content if avail */}
                          <div className="flex gap-2 text-sm text-gray-500 italic">
                            <span>• Vidéo de cours</span>
                            <span>• Exercices pratiques</span>
                            <span>• Quiz de validation</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          
          {/* Action Card */}
          <div className="bg-[#192734] border border-[#D4AF37]/30 rounded-2xl p-6 shadow-2xl sticky top-24">
            <div className="text-center mb-6">
              <span className="text-gray-400 text-sm uppercase">Investissement</span>
              <div className="text-4xl font-bold text-white mt-1">{module.price > 0 ? `${module.price}€` : "Inclus"}</div>
              <p className="text-sm text-gray-500 mt-2">Accès à vie • Certificat Inclus</p>
            </div>
            
            <Button onClick={handleEnroll} className="w-full bg-[#D4AF37] text-black font-bold py-6 text-lg hover:bg-[#b5952f] mb-4">
              Accéder au Module
            </Button>
            
            <div className="space-y-4 pt-6 border-t border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Enseigné par</p>
                  <p className="font-bold text-white">{module.professor}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <Calendar className="w-5 h-5 text-gray-500" />
                 <span className="text-sm text-gray-300">{module.availability || "Disponible immédiatement"}</span>
              </div>
            </div>
          </div>

          {/* Resources Widget */}
          <div className="bg-[#192734] border border-white/5 rounded-2xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-[#D4AF37]" /> Ressources Incluses
            </h3>
            <div className="space-y-3">
              {resources.length > 0 ? resources.map((res, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg text-sm text-gray-300">
                  {res.type === 'Video' ? <PlayCircle className="w-4 h-4 text-blue-400"/> : <FileText className="w-4 h-4 text-red-400"/>}
                  <span className="line-clamp-1">{res.title}</span>
                </div>
              )) : <p className="text-gray-500 text-sm">Ressources disponibles après inscription.</p>}
            </div>
          </div>

          {/* Evaluation Widget */}
          <div className="bg-[#192734] border border-white/5 rounded-2xl p-6">
             <h3 className="font-bold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#D4AF37]" /> Validation
             </h3>
             <p className="text-sm text-gray-300 mb-2">Critères : {evaluation.criteria || "Participation et Quiz"}</p>
             <div className="w-full bg-gray-700 h-1.5 rounded-full mt-2">
                <div className="bg-green-500 h-1.5 rounded-full w-3/4"></div>
             </div>
             <p className="text-sm text-gray-500 mt-2">Note minimale requise : 14/20</p>
          </div>

          {/* Related Modules */}
          {relatedModules.length > 0 && (
             <div className="pt-6 border-t border-white/10">
                <h4 className="font-bold text-sm text-gray-400 uppercase mb-4">Dans la même partie</h4>
                <div className="space-y-3">
                   {relatedModules.map((rel, i) => (
                      <Link key={i} to={`/year2-modules/${rel.code}`} className="block p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                         <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-white text-sm">{rel.code}</span>
                            <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded text-gray-400">{rel.type}</span>
                         </div>
                         <p className="text-sm text-gray-400 line-clamp-1">{rel.title}</p>
                      </Link>
                   ))}
                </div>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SecondYearModuleDetailPage;