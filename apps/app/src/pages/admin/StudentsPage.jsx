import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { X } from 'lucide-react';

const StudentsPage = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  const columns = [
    { 
      key: 'full_name', 
      label: 'Nom Complet',
      render: (_, row) => row.profiles?.full_name || 'Inconnu'
    },
    { key: 'module', label: 'Module' },
    { key: 'enrollment_date', label: 'Date Inscription' },
    { 
      key: 'payment_status', 
      label: 'Paiement',
      render: (val) => (
        <span className={`px-2 py-1 rounded text-xs font-bold ${
          val === 'completed' ? 'bg-green-500/20 text-green-400' :
          val === 'overdue' ? 'bg-red-500/20 text-red-400' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>
          {val === 'completed' ? 'À jour' : val === 'overdue' ? 'En retard' : 'En attente'}
        </span>
      )
    },
    { 
      key: 'status', 
      label: 'Statut',
      render: (val) => (
         <span className={`w-2 h-2 rounded-full inline-block mr-2 ${val === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
      )
    }
  ];

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('id,status,profiles(full_name, email, phone)')
        .limit(500);
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      toast({ title: "Erreur", description: "Erreur chargement étudiants", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (student, newStatus) => {
    try {
      const { error } = await supabase.from('students').update({ status: newStatus }).eq('id', student.id);
      if (error) throw error;
      toast({ title: "Mis à jour", description: `Statut changé en ${newStatus}` });
      fetchStudents();
      setSelectedStudent(null);
    } catch (error) {
      toast({ title: "Erreur", description: "Mise à jour échouée", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Helmet><title>Gestion Étudiants | Admin</title></Helmet>
      <h2 className="text-2xl font-bold text-white">Étudiants Inscrits</h2>

      <DataTable 
        columns={columns} 
        data={students} 
        onView={setSelectedStudent}
        searchFields={['module']}
      />

      {/* Detail Modal */}
      {selectedStudent && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#192734] border border-white/10 rounded-xl p-6 w-full max-w-2xl shadow-2xl relative">
               <button onClick={() => setSelectedStudent(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                 <X className="w-5 h-5" />
               </button>
               
               <div className="mb-6 border-b border-white/5 pb-4">
                  <h3 className="text-2xl font-bold text-white">{selectedStudent.profiles?.full_name}</h3>
                  <p className="text-gray-400">{selectedStudent.profiles?.email}</p>
               </div>

               <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <div>
                        <h4 className="text-[#D4AF37] text-sm font-bold uppercase mb-1">Module</h4>
                        <p className="text-white text-lg">{selectedStudent.module}</p>
                     </div>
                     <div>
                        <h4 className="text-[#D4AF37] text-sm font-bold uppercase mb-1">Inscription</h4>
                        <p className="text-white">{selectedStudent.enrollment_date}</p>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <div>
                        <h4 className="text-[#D4AF37] text-sm font-bold uppercase mb-1">Paiement</h4>
                        <p className={`font-bold ${selectedStudent.payment_status === 'overdue' ? 'text-red-400' : 'text-green-400'}`}>
                           {selectedStudent.payment_status}
                        </p>
                     </div>
                     <div>
                        <h4 className="text-[#D4AF37] text-sm font-bold uppercase mb-1">Actions</h4>
                        <div className="flex gap-2">
                           <Button 
                              size="sm" 
                              variant="outline" 
                              className={selectedStudent.status === 'active' ? 'border-red-500 text-red-500 hover:bg-red-500/10' : 'border-green-500 text-green-500 hover:bg-green-500/10'}
                              onClick={() => handleStatusChange(selectedStudent, selectedStudent.status === 'active' ? 'suspended' : 'active')}
                           >
                              {selectedStudent.status === 'active' ? 'Suspendre' : 'Activer'}
                           </Button>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default StudentsPage;