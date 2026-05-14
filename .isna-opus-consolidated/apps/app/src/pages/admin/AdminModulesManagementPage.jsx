import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';

const AdminModulesManagementPage = () => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase.from('modules_year2').select('id,title,code,order,type,price,status').order('order').limit(200);
      if (error) throw error;
      setModules(data);
    } catch (error) {
      toast({ title: "Erreur", description: "Chargement échoué", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'title', label: 'Titre' },
    { key: 'type', label: 'Type' },
    { key: 'price', label: 'Prix', render: (val) => val > 0 ? `${val}€` : 'Gratuit' },
    { key: 'status', label: 'Statut' },
    { key: 'actions', label: 'Actions', render: () => (
      <div className="flex gap-2">
        <Button size="sm" variant="ghost"><Edit className="w-4 h-4" /></Button>
        <Button size="sm" variant="ghost" className="text-red-500"><Trash className="w-4 h-4" /></Button>
      </div>
    )}
  ];

  return (
    <div className="space-y-6">
      <Helmet><title>Admin Modules Y2</title></Helmet>
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Gestion Modules Année 2</h2>
        <Button className="bg-[#D4AF37] text-black"><Plus className="w-4 h-4 mr-2"/> Nouveau Module</Button>
      </div>

      <div className="bg-[#192734] border border-white/10 rounded-xl overflow-hidden">
        <DataTable columns={columns} data={modules} loading={loading} />
      </div>
    </div>
  );
};

export default AdminModulesManagementPage;