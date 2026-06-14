import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { PlayCircle, Award, Clock } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const StudentModulesDashboard = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inprogress');

  useEffect(() => {
    if (user) fetchEnrollments();
  }, [user]);

  const fetchEnrollments = async () => {
    try {
      // First get student ID from user ID
      const { data: studentData } = await supabase.from('students').select('id').eq('user_id', user.id).single();
      if (!studentData) return;

      const { data, error } = await supabase
        .from('student_module_enrollment')
        .select('*, modules_year2(*)')
        .eq('student_id', studentData.id);

      if (error) throw error;
      setEnrollments(data);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  const inProgress = enrollments.filter(e => e.status === 'enrolled');
  const completed = enrollments.filter(e => e.status === 'completed');

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <Helmet><title>{`Mes Modules | ${isnaTenantConfig.branding.name}`}</title></Helmet>

      <div className="max-w-7xl mx-auto px-6">
        <h1 className="text-3xl font-serif font-bold mb-8">Tableau de Bord Modules</h1>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <StatCard icon={PlayCircle} label="En Cours" value={inProgress.length} color="blue" />
          <StatCard icon={Award} label="Complétés" value={completed.length} color="gold" />
          <StatCard icon={Clock} label="Heures Totales" value={enrollments.reduce((acc, curr) => acc + (curr.modules_year2?.duration_hours || 0), 0)} color="purple" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <PremiumSegmentedSelector
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'inprogress', label: 'En cours', badge: `${inProgress.length}` },
              { value: 'completed', label: 'Termines', badge: `${completed.length}` },
              { value: 'available', label: 'Catalogue' },
            ]}
            layoutId="student-modules-dashboard-tab-segment-pill"
            className="mb-8"
            compact
            showChevron={false}
          />

          <TabsContent value="inprogress">
            <div className="grid md:grid-cols-2 gap-6">
              {inProgress.length === 0 ? (
                <div className="col-span-2 text-center py-10 text-gray-500">Aucun module en cours.</div>
              ) : (
                inProgress.map(enrollment => (
                  <div key={enrollment.id} className="bg-[#192734] border border-white/10 rounded-xl p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-xl">{enrollment.modules_year2.title}</h3>
                      <span className="text-xs font-mono text-gray-500">{enrollment.modules_year2.code}</span>
                    </div>
                    
                    <div className="w-full bg-black/30 h-2 rounded-full mb-2 overflow-hidden">
                      <div className="bg-[var(--school-accent)] h-full transition-all duration-500" style={{ width: `${enrollment.progress_percentage}%` }}></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-400 mb-6">
                      <span>Progression</span>
                      <span>{enrollment.progress_percentage}%</span>
                    </div>

                    <Link to={`/student/modules/${enrollment.module_id}/content`}>
                      <Button className="w-full bg-white/5 hover:bg-[var(--school-accent)] hover:text-black text-white">
                        Accéder au contenu
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="completed">
             {/* Similar grid for completed modules */}
             <div className="text-center text-gray-500">Modules terminés apparaîtront ici.</div>
          </TabsContent>

          <TabsContent value="available">
            <div className="text-center py-10">
              <p className="mb-4 text-gray-400">Découvrez de nouveaux modules pour enrichir votre parcours.</p>
              <Link to="/modules/year2-catalog">
                <Button className="bg-[var(--school-accent)] text-black">Voir le Catalogue Complet</Button>
              </Link>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StudentModulesDashboard;