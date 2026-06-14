import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet';
import { ArrowLeft, Calendar, BookOpen, Clock, ChevronRight } from 'lucide-react';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const TrimesterDetailPage = () => {
  const { id } = useParams();
  const [trimester, setTrimester] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrimesterData();
  }, [id]);

  const fetchTrimesterData = async () => {
    try {
      setLoading(true);
      
      const { data: trimData, error: trimError } = await supabase
        .from('trimesters')
        .select('*')
        .eq('id', id)
        .single();
      
      if (trimError) throw trimError;
      setTrimester(trimData);
      
      const { data: modData, error: modError } = await supabase
        .from('modules')
        .select('id,title,order,trimester_id')
        .eq('trimester_id', id)
        .limit(100)
        .order('order');
        
      if (modError) throw modError;
      setModules(modData);
    } catch (error) {
       console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--school-accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!trimester) return <div className="text-white text-center p-20">Introuvable</div>;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <Helmet>
        <title>{`${trimester.name} | ${isnaTenantConfig.branding.name}`}</title>
      </Helmet>
      
      <div className="max-w-7xl mx-auto px-6">
        <Link to="/curriculum/first-year">
          <Button variant="ghost" className="pl-0 text-gray-400 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour au Programme
          </Button>
        </Link>

        <div className="grid lg:grid-cols-3 gap-12">
          {/* Sidebar / Info */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-[#192734] border border-white/10 rounded-2xl p-8 sticky top-28">
               <span className="text-[var(--school-accent)] font-bold text-sm tracking-wider uppercase mb-2 block">Trimestre {trimester.number}</span>
               <h1 className="text-3xl font-serif font-bold mb-4">{trimester.name.replace(`Trimestre ${trimester.number} : `, '')}</h1>
               <p className="text-gray-400 mb-8 leading-relaxed">
                 {trimester.description}
               </p>

               <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                     <Calendar className="w-5 h-5 text-[var(--school-accent)]" />
                     <span>{new Date(trimester.start_date).toLocaleDateString()} - {new Date(trimester.end_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                     <BookOpen className="w-5 h-5 text-[var(--school-accent)]" />
                     <span>{modules.length} Modules</span>
                  </div>
               </div>

               <div className="border-t border-white/10 pt-6">
                  <h3 className="font-bold text-white mb-4">Objectifs Pédagogiques</h3>
                  <ul className="space-y-3">
                     {trimester.objectives?.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                           <span className="w-1.5 h-1.5 rounded-full bg-[var(--school-accent)] mt-1.5 shrink-0"></span>
                           {obj}
                        </li>
                     ))}
                  </ul>
               </div>
            </div>
          </div>

          {/* Modules List */}
          <div className="lg:col-span-2 space-y-6">
             <h2 className="text-2xl font-bold mb-6">Modules du Trimestre</h2>
             {modules.map((module) => (
                <div key={module.id} className="bg-[#192734] border border-white/5 rounded-xl p-6 hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] transition-colors flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                   <div className="w-16 h-16 bg-[#0F1419] rounded-lg flex flex-col items-center justify-center border border-white/10 shrink-0">
                      <span className="text-[var(--school-accent)] font-bold text-lg">{module.code}</span>
                   </div>
                   
                   <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">{module.title}</h3>
                      <p className="text-gray-400 text-sm line-clamp-2 mb-3">{module.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 uppercase tracking-wide font-bold">
                         <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {module.duration_weeks} Semaines</span>
                         <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {module.duration_hours} Heures</span>
                      </div>
                   </div>

                   <Link to={`/curriculum/module/${module.id}`}>
                      <Button className="bg-[var(--school-accent)] text-black font-bold hover:bg-[#b5952f]">
                         Voir le Module
                      </Button>
                   </Link>
                </div>
             ))}

             {modules.length === 0 && (
                <div className="text-center py-20 bg-[#192734] rounded-xl border border-dashed border-white/10">
                   <p className="text-gray-500">Aucun module disponible pour ce trimestre.</p>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrimesterDetailPage;