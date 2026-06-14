import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { BookOpen, TrendingUp, PenTool, Clock, ChevronRight } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { Button } from '@/components/ui/button';

const StudentDashboard2 = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user.id).single();
      if (student) {
         // Progress
         const { data: progData } = await supabase
            .from('second_year_student_progress')
            .select('*, second_year_modules(title, code)')
            .eq('student_id', student.id);
         setProgress(progData || []);

         // Journal (Last 3)
         const { data: journalData } = await supabase
            .from('second_year_practice_journal')
            .select('*')
            .eq('student_id', student.id)
            .order('entry_date', { ascending: false })
            .limit(3);
         setJournalEntries(journalData || []);
      }
    } catch (error) {
       console.error(error);
    } finally {
       setLoading(false);
    }
  };

  const completedCount = progress.filter(p => p.status === 'completed').length;
  const inProgressModule = progress.find(p => p.status === 'in_progress');

  if (loading) return <div className="min-h-screen bg-[#0F1419] flex items-center justify-center"><div className="w-12 h-12 border-4 border-[var(--school-accent)] border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20 px-6">
       <Helmet><title>Tableau de Bord 2ème Année | PRORASCIENCE</title></Helmet>
       <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-serif font-bold mb-8">Tableau de Bord - <span className="text-[var(--school-accent)]">Niveau Avancé</span></h1>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
             <StatCard icon={BookOpen} label="Modules Complétés" value={completedCount} color="gold" />
             <StatCard icon={TrendingUp} label="En Cours" value={progress.filter(p => p.status === 'in_progress').length} color="blue" />
             <StatCard icon={PenTool} label="Entrées Journal" value={journalEntries.length} color="green" />
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-8">
                {/* Current Module */}
                <div className="bg-[#192734] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] rounded-xl p-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                   <h2 className="text-xl font-bold mb-4">Module Actuel</h2>
                   {inProgressModule ? (
                      <div>
                         <h3 className="text-2xl font-bold text-[var(--school-accent)] mb-2">{inProgressModule.second_year_modules?.title}</h3>
                         <div className="w-full bg-black/40 h-2 rounded-full mb-4">
                            <div className="bg-[var(--school-accent)] h-full rounded-full" style={{ width: `${inProgressModule.progress_percentage}%` }}></div>
                         </div>
                         <Link to={`/curriculum/module-2/${inProgressModule.module_id}`}>
                            <Button className="bg-[var(--school-accent)] text-black font-bold">Continuer</Button>
                         </Link>
                      </div>
                   ) : (
                      <div className="text-gray-400">
                         <p className="mb-4">Aucun module en cours. Prêt à commencer le prochain ?</p>
                         <Link to="/curriculum/second-year">
                            <Button variant="outline" className="border-[var(--school-accent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]">Consulter le Programme</Button>
                         </Link>
                      </div>
                   )}
                </div>

                {/* Journal Snippets */}
                <div>
                   <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold">Journal de Pratique Récent</h2>
                      <Link to="/student/practice-journal" className="text-sm text-[var(--school-accent)] hover:underline">Tout voir</Link>
                   </div>
                   <div className="space-y-4">
                      {journalEntries.length > 0 ? journalEntries.map(entry => (
                         <div key={entry.id} className="bg-[#192734] border border-white/5 p-4 rounded-lg">
                            <p className="text-sm text-gray-500 mb-2">{new Date(entry.entry_date).toLocaleDateString()}</p>
                            <p className="text-sm text-gray-300 line-clamp-2">{entry.content}</p>
                         </div>
                      )) : <p className="text-gray-500 italic">Aucune entrée récente.</p>}
                   </div>
                </div>
             </div>

             {/* Sidebar */}
             <div className="space-y-6">
                <div className="bg-[#192734] border border-white/10 p-6 rounded-2xl">
                   <h3 className="font-bold mb-4">Outils Rapides</h3>
                   <div className="space-y-3">
                      <Link to="/student/practice-journal" className="block w-full">
                         <Button variant="outline" className="w-full justify-start border-white/10 text-gray-300 hover:text-white hover:bg-white/5">
                            <PenTool className="w-4 h-4 mr-2" /> Ouvrir le Journal
                         </Button>
                      </Link>
                      <Link to="/curriculum/second-year" className="block w-full">
                         <Button variant="outline" className="w-full justify-start border-white/10 text-gray-300 hover:text-white hover:bg-white/5">
                            <BookOpen className="w-4 h-4 mr-2" /> Programme Complet
                         </Button>
                      </Link>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default StudentDashboard2;