import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, PlayCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ModuleProgressTracker = ({ moduleId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && moduleId) {
      fetchProgress();
    }
  }, [user, moduleId]);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('student_progress')
        .select('*')
        .eq('module_id', moduleId)
        .eq('student_id', await getStudentId(user.id)) // Helper to get student ID from user ID
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setProgress(data || { status: 'not_started', progress_percentage: 0 });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStudentId = async (userId) => {
     // In a real scenario, fetch student ID from users table or similar
     // For this schema, assume students table links user_id
     const { data } = await supabase.from('students').select('id').eq('user_id', userId).single();
     return data?.id;
  };

  const updateStatus = async (newStatus) => {
    try {
      setLoading(true);
      const studentId = await getStudentId(user.id);
      if (!studentId) {
         toast({ title: "Erreur", description: "Compte étudiant introuvable", variant: "destructive" });
         return;
      }

      const upsertData = {
         student_id: studentId,
         module_id: moduleId,
         status: newStatus,
         progress_percentage: newStatus === 'completed' ? 100 : (newStatus === 'in_progress' ? 10 : 0),
         completion_date: newStatus === 'completed' ? new Date() : null
      };

      // Check if exists first to update or insert (if no unique constraint on pair)
      // Ideally unique constraint exists on (student_id, module_id)
      // Using upsert if constraint exists
      
      const { data: existing } = await supabase.from('student_progress').select('id').eq('student_id', studentId).eq('module_id', moduleId).maybeSingle();

      let error;
      if (existing) {
         const { error: updError } = await supabase.from('student_progress').update(upsertData).eq('id', existing.id);
         error = updError;
      } else {
         const { error: insError } = await supabase.from('student_progress').insert([upsertData]);
         error = insError;
      }

      if (error) throw error;
      
      setProgress({ ...progress, ...upsertData });
      toast({ title: "Succès", description: `Statut mis à jour : ${newStatus === 'completed' ? 'Terminé' : 'En cours'}` });

    } catch (error) {
       console.error(error);
       toast({ title: "Erreur", description: "Mise à jour échouée", variant: "destructive" });
    } finally {
       setLoading(false);
    }
  };

  if (loading && !progress) return <div className="h-20 bg-white/5 animate-pulse rounded-xl"></div>;

  return (
    <div className="bg-[#192734] border border-white/10 rounded-xl p-6 mb-8 flex items-center justify-between flex-wrap gap-4">
       <div>
          <h4 className="text-sm font-bold text-gray-400 uppercase mb-1">Votre Progression</h4>
          <div className="flex items-center gap-3">
             <div className="text-2xl font-bold text-white">{progress?.progress_percentage || 0}%</div>
             <div className="w-32 h-2 bg-black/40 rounded-full overflow-hidden">
                <div className="h-full bg-[#D4AF37] transition-all duration-500" style={{ width: `${progress?.progress_percentage || 0}%` }}></div>
             </div>
          </div>
       </div>

       <div className="flex gap-2">
          {progress?.status === 'completed' ? (
             <div className="flex items-center gap-2 text-green-500 bg-green-500/10 px-4 py-2 rounded-lg border border-green-500/20 font-bold">
                <CheckCircle className="w-5 h-5" /> Module Terminé
             </div>
          ) : (
             <>
                {progress?.status !== 'in_progress' && (
                   <Button onClick={() => updateStatus('in_progress')} className="bg-[#D4AF37] text-black font-bold hover:bg-[#b5952f]">
                      <PlayCircle className="w-4 h-4 mr-2" /> Démarrer
                   </Button>
                )}
                {progress?.status === 'in_progress' && (
                   <Button onClick={() => updateStatus('completed')} variant="outline" className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10">
                      <CheckCircle className="w-4 h-4 mr-2" /> Marquer comme Terminé
                   </Button>
                )}
             </>
          )}
       </div>
    </div>
  );
};

export default ModuleProgressTracker;