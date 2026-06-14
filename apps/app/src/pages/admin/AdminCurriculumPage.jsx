import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

const AdminCurriculumPage = () => {
  const { toast } = useToast();
  const [academicYears, setAcademicYears] = useState([]);
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
      // Fetch 1st Year Data
      const { data: years } = await supabase.from('academic_years').select('*').order('created_at');
      setAcademicYears(years || []);

      const { data: trim } = await supabase.from('trimesters').select('*, academic_years(name)').order('number');
      setTrimesters(trim || []);

      const { data: mods } = await supabase.from('modules').select('*, trimesters(name)').order('order');
      setModules(mods || []);
    } catch (error) {
       console.error(error);
       toast({ title: "Erreur", description: "Impossible de charger les données du programme", variant: "destructive" });
    } finally {
       setLoading(false);
    }
  };

  const yearColumns = [
    { key: 'name', label: 'Nom' },
    { key: 'status', label: 'Statut' },
    { key: 'start_date', label: 'Début' },
    { key: 'end_date', label: 'Fin' },
  ];

  const trimesterColumns = [
    { key: 'number', label: '#' },
    { key: 'name', label: 'Nom' },
    { key: 'academic_years', label: 'Année', render: (val) => val?.name || '-' },
  ];

  const moduleColumns = [
    { key: 'code', label: 'Code' },
    { key: 'title', label: 'Titre' },
    { key: 'trimesters', label: 'Trimestre', render: (val) => val?.name || '-' },
    { key: 'duration_weeks', label: 'Durée (sem)' },
  ];

  return (
    <div className="space-y-6">
       <Helmet><title>Admin Curriculum 1ère Année</title></Helmet>
       <h2 className="text-2xl font-bold text-white">Gestion 1ère Année (Fondements)</h2>
       
       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <PremiumSegmentedSelector
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'years', label: 'Annees', badge: `${academicYears.length}` },
              { value: 'trimesters', label: 'Trimestres', badge: `${trimesters.length}` },
              { value: 'modules', label: 'Modules', badge: `${modules.length}` },
            ]}
            layoutId="admin-curriculum-tab-segment-pill"
            className="mb-2"
            compact
            showChevron={false}
          />
          
          <TabsContent value="years" className="mt-6">
             <div className="flex justify-end mb-4"><Button size="sm" className="bg-[var(--school-accent)] text-black"><Plus className="w-4 h-4 mr-2"/> Nouvelle Année</Button></div>
             <DataTable columns={yearColumns} data={academicYears} />
          </TabsContent>

          <TabsContent value="trimesters" className="mt-6">
             <div className="flex justify-end mb-4"><Button size="sm" className="bg-[var(--school-accent)] text-black"><Plus className="w-4 h-4 mr-2"/> Nouveau Trimestre</Button></div>
             <DataTable columns={trimesterColumns} data={trimesters} />
          </TabsContent>
          
          <TabsContent value="modules" className="mt-6">
             <div className="flex justify-end mb-4"><Button size="sm" className="bg-[var(--school-accent)] text-black"><Plus className="w-4 h-4 mr-2"/> Nouveau Module</Button></div>
             <DataTable columns={moduleColumns} data={modules} searchFields={['title', 'code']} />
          </TabsContent>
       </Tabs>
    </div>
  );
};

export default AdminCurriculumPage;