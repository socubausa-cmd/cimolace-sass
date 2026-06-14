import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet';
import { ArrowLeft, Calendar, BookOpen, Clock } from 'lucide-react';

const SecondYearTrimesterDetailPage = () => {
  const { id } = useParams();
  const [trimester, setTrimester] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: trimData } = await supabase.from('second_year_trimesters').select('*').eq('id', id).single();
      setTrimester(trimData);
      
      const { data: modData } = await supabase.from('second_year_modules').select('*').eq('trimester_id', id).order('order');
      setModules(modData || []);
    } catch (error) {
       console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0F1419] flex items-center justify-center"><div className="w-12 h-12 border-4 border-[var(--school-accent)] border-t-transparent rounded-full animate-spin"></div></div>;
  if (!trimester) return <div className="text-white text-center p-20">Introuvable</div>;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <Helmet><title>{trimester.name} | PRORASCIENCE</title></Helmet>
      
      <div className="max-w-7xl mx-auto px-6">
        <Link to="/curriculum/second-year">
          <Button variant="ghost" className="pl-0 text-gray-400 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour au Programme
          </Button>
        </Link>

        <div className="grid lg:grid-cols-3 gap-12">
          {/* Info Panel */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-[#192734] border border-white/10 rounded-2xl p-8 sticky top-28">
               <span className="text-[var(--school-accent)] font-bold text-sm tracking-wider uppercase mb-2 block">Trimestre {trimester.order}</span>
               <h1 className="text-3xl font-serif font-bold mb-4">{trimester.name}</h1>
               <p className="text-gray-400 mb-8 leading-relaxed">{trimester.description}</p>
               
               <div className="space-y-4 pt-6 border-t border-white/10">
                  <h3 className="font-bold text-white mb-2">Objectifs</h3>
                  <ul className="space-y-2">
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

          {/* Modules */}
          <div className="lg:col-span-2 space-y-6">
             <h2 className="text-2xl font-bold mb-6">Modules du Trimestre</h2>
             {modules.map((module) => (
                <div key={module.id} className="bg-[#192734] border border-white/5 rounded-xl p-6 flex flex-col sm:flex-row gap-6 hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] transition-colors">
                   <div className="w-16 h-16 bg-[#0F1419] rounded-lg flex items-center justify-center border border-white/10 shrink-0 text-[var(--school-accent)] font-bold text-lg">
                      {module.code}
                   </div>
                   <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">{module.title}</h3>
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{module.description}</p>
                      <div className="flex gap-4 text-sm text-gray-500 uppercase font-bold">
                         <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {module.duration_weeks} Semaines</span>
                         <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {module.duration_hours} Heures</span>
                      </div>
                   </div>
                   <Link to={`/curriculum/module-2/${module.id}`}>
                      <Button className="bg-[var(--school-accent)] text-black font-bold">Voir</Button>
                   </Link>
                </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecondYearTrimesterDetailPage;