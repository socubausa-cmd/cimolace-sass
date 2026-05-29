import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, Clock, GraduationCap, ArrowRight, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet';

const CurriculumPage = () => {
  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState(null);
  const [trimesters, setTrimesters] = useState([]);
  const [modules, setModules] = useState([]);

  useEffect(() => {
    fetchCurriculumData();
  }, []);

  const fetchCurriculumData = async () => {
    try {
      setLoading(true);
      
      // Fetch Academic Year (assuming there's only one active or picking the first one)
      const { data: yearData, error: yearError } = await supabase
        .from('academic_years')
        .select('*')
        .eq('name', '1ère Année Prorascience - Cycle des Fondements')
        .single();
      
      if (yearError && yearError.code !== 'PGRST116') throw yearError;
      
      if (yearData) {
        setAcademicYear(yearData);
        
        // Fetch Trimesters
        const { data: trimData, error: trimError } = await supabase
          .from('trimesters')
          .select('*')
          .eq('academic_year_id', yearData.id)
          .order('number');
        
        if (trimError) throw trimError;
        setTrimesters(trimData);
        
        // Fetch Modules
        const trimesterIds = trimData.map(t => t.id);
        if (trimesterIds.length > 0) {
           const { data: modData, error: modError } = await supabase
             .from('modules')
             .select('*')
             .in('trimester_id', trimesterIds)
             .order('order');
             
           if (modError) throw modError;
           setModules(modData);
        }
      }
    } catch (error) {
      console.error('Error fetching curriculum:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!academicYear) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex flex-col items-center justify-center text-white p-4">
        <h1 className="text-3xl font-bold mb-4">Programme Non Disponible</h1>
        <p className="text-gray-400 text-center max-w-lg mb-8">Le programme académique pour cette année n'est pas encore configuré. Veuillez contacter l\'administration.</p>
        <Link to="/">
          <Button className="bg-[#D4AF37] text-black">Retour à l'accueil</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <Helmet>
        <title>Programme 1ère Année | PRORASCIENCE ACADEMY</title>
        <meta name="description" content="Découvrez le programme complet de la 1ère année : Cycle des Fondements." />
      </Helmet>

      {/* Hero Section */}
      <section className="relative px-6 py-16 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#192734] to-[#0F1419] z-0"></div>
        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full text-[#D4AF37] text-sm font-bold tracking-wide uppercase mb-6">
            Programme Académique 2025-2026
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-6">
            {academicYear.name}
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            {academicYear.description || "Un voyage initiatique de 9 mois à travers les sciences sacrées, la cosmogonie et la maîtrise de soi."}
          </p>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm md:text-base text-gray-400">
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/5">
              <Calendar className="w-5 h-5 text-[#D4AF37]" />
              <span>9 Mois (36 Semaines)</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/5">
              <Clock className="w-5 h-5 text-[#D4AF37]" />
              <span>252 Heures de cours</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/5">
              <BookOpen className="w-5 h-5 text-[#D4AF37]" />
              <span>10 Modules Fondamentaux</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trimesters Overview */}
      <section className="px-6 py-16 max-w-7xl mx-auto">
        <h2 className="text-3xl font-serif font-bold text-white mb-12 flex items-center gap-3">
          <Layers className="w-8 h-8 text-[#D4AF37]" />
          Structure de l'Année
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {trimesters.map((trimester) => {
            const trimesterModules = modules.filter(m => m.trimester_id === trimester.id);
            return (
              <div key={trimester.id} className="group bg-[#192734] border border-white/5 rounded-2xl p-8 hover:border-[#D4AF37]/30 transition-all duration-300 flex flex-col h-full">
                <div className="mb-6">
                  <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-2 block">Trimestre {trimester.number}</span>
                  <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-[#D4AF37] transition-colors">
                    {trimester.name.replace(`Trimestre ${trimester.number} : `, '')}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-3">
                    {trimester.description}
                  </p>
                </div>
                
                <div className="mt-auto space-y-6">
                  <div className="space-y-3">
                     <h4 className="text-sm font-bold text-white uppercase opacity-70">Objectifs Clés</h4>
                     <ul className="space-y-2">
                        {trimester.objectives && Array.isArray(trimester.objectives) && trimester.objectives.slice(0, 3).map((obj, i) => (
                           <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 shrink-0"></span>
                              {obj}
                           </li>
                        ))}
                     </ul>
                  </div>

                  <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                     <span className="text-sm font-bold text-white">{trimesterModules.length} Modules</span>
                     <Link to={`/curriculum/trimester/${trimester.id}`}>
                        <Button variant="ghost" className="text-[#D4AF37] hover:text-white hover:bg-[#D4AF37]/20 p-0 h-auto font-bold flex gap-2 items-center">
                           Explorer <ArrowRight className="w-4 h-4" />
                        </Button>
                     </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Full Modules List */}
      <section className="px-6 py-16 bg-[#192734]/30">
         <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-serif font-bold text-white mb-12 flex items-center gap-3">
               <GraduationCap className="w-8 h-8 text-[#D4AF37]" />
               Tous les Modules
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {modules.map((module) => (
                  <Link to={`/curriculum/module/${module.id}`} key={module.id} className="block group">
                     <div className="bg-[#0F1419] border border-white/10 rounded-xl p-6 hover:border-[#D4AF37] transition-all h-full flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                           <span className="bg-white/5 text-white text-xs font-bold px-3 py-1 rounded border border-white/5 group-hover:bg-[#D4AF37] group-hover:text-black transition-colors">
                              {module.code}
                           </span>
                           <span className="text-sm text-gray-500">{module.duration_weeks} sem.</span>
                        </div>
                        <h4 className="text-lg font-bold text-white mb-3 leading-snug group-hover:text-[#D4AF37] transition-colors">
                           {module.title}
                        </h4>
                        <p className="text-sm text-gray-500 line-clamp-2 mt-auto">
                           {module.description}
                        </p>
                     </div>
                  </Link>
               ))}
            </div>
         </div>
      </section>
    </div>
  );
};

export default CurriculumPage;