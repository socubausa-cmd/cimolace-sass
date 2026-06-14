import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Lock, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrerequisiteValidator = ({ children }) => {
  const { user } = useAuth();
  const [canEnroll, setCanEnroll] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    checkPrerequisites();
  }, [user]);

  const checkPrerequisites = async () => {
    if (!user) {
      setChecking(false);
      return;
    }

    try {
      // Logic: Check if student has completed enough modules of 1st year
      // Simplified: Check for a flag or check if progress count >= 80% of 1st year modules
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (student) {
         // Get 1st year modules count
         const { count: totalModules } = await supabase.from('modules').select('*', { count: 'exact', head: true });
         
         // Get completed modules
         const { count: completedCount } = await supabase
            .from('student_progress')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', student.id)
            .eq('status', 'completed');
            
         // Require 80% completion (e.g., 8 out of 10 modules)
         if (totalModules > 0 && completedCount >= (totalModules * 0.8)) {
            setCanEnroll(true);
         }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setChecking(false);
    }
  };

  const handleAttempt = () => {
    if (!user) {
       // Redirect to login or show login hint handled by parent usually, but here simple alert
       window.location.href = '/login';
       return;
    }
    if (!canEnroll) {
       setShowModal(true);
    } else {
       // Proceed with enrollment logic (would normally redirect to payment or enrollment confirmation)
       window.location.href = '/enrollment/second-year'; // Placeholder
    }
  };

  if (checking) return <Button disabled className="bg-white/10 text-gray-500">Vérification...</Button>;

  if (canEnroll) {
     return children; // Render the enroll button directly if allowed
  }

  return (
    <>
      <div onClick={handleAttempt}>
         {children} 
         {/* We wrap children to intercept click via div, or pass onClick clone if children is single button */}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#192734] border border-white/10 rounded-xl p-8 max-w-md w-full text-center relative shadow-2xl">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
               <Lock className="w-8 h-8 text-yellow-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Prérequis Non Validés</h3>
            <p className="text-gray-300 mb-8">
              L'accès à la 2ème année est réservé aux étudiants ayant validé le cycle des fondements (1ère année).
            </p>
            <div className="flex flex-col gap-3">
               <Link to="/curriculum/first-year">
                  <Button className="w-full bg-[var(--school-accent)] text-black font-bold">
                     Terminer la 1ère Année
                  </Button>
               </Link>
               <Button variant="ghost" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                  Fermer
               </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PrerequisiteValidator;