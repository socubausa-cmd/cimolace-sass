import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { CheckCircle, PlayCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const SecondYearProgressTracker = ({ moduleId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && moduleId) fetchProgress();
  }, [user, moduleId]);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user.id).single();
      if (student) {
        const { data } = await supabase
           .from('second_year_student_progress')
           .select('*')
           .eq('module_id', moduleId)
           .eq('student_id', student.id)
           .maybeSingle();
        setProgress(data || { status: 'not_started', progress_percentage: 0 });
      }
    } catch (error) {
       console.error(error);
    } finally {
       setLoading(false);
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      setLoading(true);
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user.id).single();
      if (!student) return;

      const upsertData = {
         student_id: student.id,
         module_id: moduleId,
         status: newStatus,
         progress_percentage: newStatus === 'completed' ? 100 : (newStatus === 'in_progress' ? 10 : 0),
         completion_date: newStatus === 'completed' ? new Date() : null
      };

      const { data: existing } = await supabase
         .from('second_year_student_progress')
         .select('id')
         .eq('student_id', student.id)
         .eq('module_id', moduleId)
         .maybeSingle();

      if (existing) {
         await supabase.from('second_year_student_progress').update(upsertData).eq('id', existing.id);
      } else {
         await supabase.from('second_year_student_progress').insert([upsertData]);
      }
      
      setProgress({ ...progress, ...upsertData });
      toast({ title: "Succès", description: `Statut mis à jour : ${newStatus}` });
    } catch (error) {
       toast({ title: "Erreur", description: "Impossible de mettre à jour", variant: "destructive" });
    } finally {
       setLoading(false);
    }
  };

  if (loading) return <div className="h-16 bg-white/5 animate-pulse rounded-xl"></div>;

  return (
    <div className="bg-[#192734] border border-white/10 rounded-xl p-6 flex items-center justify-between">
       <div>
          <h4 className="text-sm font-bold text-gray-400 uppercase mb-1">Votre Avancement</h4>
          <div className="flex items-center gap-3">
             <div className="text-2xl font-bold text-white">{progress?.progress_percentage || 0}%</div>
             <div className="w-32 h-2 bg-black/40 rounded-full overflow-hidden">
                <div className="h-full bg-[#D4AF37] transition-all" style={{ width: `${progress?.progress_percentage || 0}%` }}></div>
             </div>
          </div>
       </div>
       <div>
          {progress?.status === 'completed' ? (
             <span className="flex items-center gap-2 text-green-500 font-bold bg-green-500/10 px-4 py-2 rounded-lg"><CheckCircle className="w-5 h-5"/> Terminé</span>
          ) : progress?.status === 'in_progress' ? (
             <Button onClick={() => updateStatus('completed')} variant="outline" className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"><CheckCircle className="w-4 h-4 mr-2"/> Terminer</Button>
          ) : (
             <Button onClick={() => updateStatus('in_progress')} className="bg-[#D4AF37] text-black hover:bg-[#b5952f]"><PlayCircle className="w-4 h-4 mr-2"/> Commencer</Button>
          )}
       </div>
    </div>
  );
};

export default SecondYearProgressTracker;