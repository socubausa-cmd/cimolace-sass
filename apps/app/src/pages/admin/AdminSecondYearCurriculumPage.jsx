import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase } from '@/lib/customSupabaseClient';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

const AdminSecondYearCurriculumPage = () => {
  const { toast } = useToast();
  const [trimesters, setTrimesters] = useState([]);
  const [modules, setModules] = useState([]);
  const [activeTab, setActiveTab] = useState('modules');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: trim } = await supabase.from('second_year_trimesters').select('*').order('order');
      setTrimesters(trim || []);
      const { data: mods } = await supabase.from('second_year_modules').select('*, second_year_trimesters(name)').order('order');
      setModules(mods || []);
    } catch (error) {
       console.error(error);
    } finally {
       setLoading(false);
    }
  };

  const trimesterColumns = [
    { key: 'order', label: '#' },
    { key: 'name', label: 'Nom' },
    { key: 'description', label: 'Description', render: (val) => <span className="line-clamp-1">{val}</span> },
  ];

  const moduleColumns = [
    { key: 'code', label: 'Code' },
    { key: 'title', label: 'Titre' },
    { key: 'second_year_trimesters', label: 'Trimestre', render: (val) => val?.name || '-' },
    { key: 'duration_weeks', label: 'Durée (sem)' },
  ];

  return (
    <div className="space-y-6">
       <Helmet><title>Admin Curriculum 2ème Année</title></Helmet>
       <h2 className="text-2xl font-bold text-white">Gestion 2ème Année</h2>
       
       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <PremiumSegmentedSelector
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'trimesters', label: 'Trimestres', badge: `${trimesters.length}` },
              { value: 'modules', label: 'Modules', badge: `${modules.length}` },
              { value: 'evaluations', label: 'Evaluations', badge: 'Bientot' },
            ]}
            layoutId="admin-second-year-curriculum-tab-segment-pill"
            className="mb-2"
            compact
            showChevron={false}
          />
          
          <TabsContent value="trimesters" className="mt-6">
             <div className="flex justify-end mb-4"><Button size="sm" className="bg-[var(--school-accent)] text-black"><Plus className="w-4 h-4 mr-2"/> Nouveau Trimestre</Button></div>
             <DataTable columns={trimesterColumns} data={trimesters} />
          </TabsContent>
          
          <TabsContent value="modules" className="mt-6">
             <div className="flex justify-end mb-4"><Button size="sm" className="bg-[var(--school-accent)] text-black"><Plus className="w-4 h-4 mr-2"/> Nouveau Module</Button></div>
             <DataTable columns={moduleColumns} data={modules} searchFields={['title', 'code']} />
          </TabsContent>

          <TabsContent value="evaluations" className="mt-6">
             <div className="text-center p-8 bg-[#192734] rounded text-gray-500">Fonctionnalité d'évaluation à venir</div>
          </TabsContent>
       </Tabs>
    </div>
  );
};

export default AdminSecondYearCurriculumPage;