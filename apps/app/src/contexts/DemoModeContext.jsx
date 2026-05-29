import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { demoStudentData } from '@/lib/mockDemoStudentData';
import { useToast } from '@/components/ui/use-toast';

const DemoModeContext = createContext();

export const DemoModeProvider = ({ children }) => {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check localStorage preference
    const demoPref = localStorage.getItem('prorascience_demo_mode');
    const userExitedDemo = localStorage.getItem('prorascience_exited_demo');

    if (isAuthenticated) {
      // Always disable demo mode if user logs in
      setIsDemoMode(false);
    } else {
      // If not authenticated, enable demo mode unless user explicitly exited previously
      // Or if user specifically requested demo mode via preference
      if (demoPref === 'active') {
        setIsDemoMode(true);
      } else if (!userExitedDemo) {
        // Auto-activate for visitors who haven't explicitly quit
        setIsDemoMode(true);
      }
    }
  }, [isAuthenticated]);

  const toggleDemoMode = (value) => {
    if (value) {
      setIsDemoMode(true);
      localStorage.setItem('prorascience_demo_mode', 'active');
      localStorage.removeItem('prorascience_exited_demo');
      toast({
        title: "Mode Démo Activé",
        description: "Vous explorez l'espace étudiant avec des données fictives.",
        variant: "default",
        className: "bg-[#D4AF37] text-black border-none"
      });
    } else {
      setIsDemoMode(false);
      localStorage.removeItem('prorascience_demo_mode');
      localStorage.setItem('prorascience_exited_demo', 'true');
      toast({
        title: "Mode Démo Désactivé",
        description: "Connectez-vous pour accéder à votre espace réel.",
      });
    }
  };

  const restrictedAction = (actionName) => {
    if (isDemoMode) {
      toast({
        title: "Action non disponible",
        description: `${actionName || 'Cette fonctionnalité'} est désactivée en mode démo.`,
        variant: "destructive"
      });
      return true; // Action was blocked
    }
    return false; // Action allowed
  };

  return (
    <DemoModeContext.Provider value={{ 
      isDemoMode, 
      demoData: demoStudentData, 
      toggleDemoMode,
      restrictedAction
    }}>
      {children}
    </DemoModeContext.Provider>
  );
};

export const useDemoMode = () => useContext(DemoModeContext);