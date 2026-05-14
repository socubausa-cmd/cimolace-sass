import React from 'react';
import { Link } from 'react-router-dom';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { Button } from '@/components/ui/button';
import { Info, LogIn, XCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const DemoBadge = () => {
  const { isDemoMode, toggleDemoMode } = useDemoMode();

  if (!isDemoMode) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex items-center gap-2 animate-in slide-in-from-top-5 duration-500">
      <div className="bg-orange-500/90 text-white backdrop-blur-md border border-orange-400 rounded-full px-4 py-2 shadow-lg flex items-center gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 cursor-help">
                <Info className="w-4 h-4" />
                <span className="font-bold text-sm uppercase tracking-wide">Mode Démo</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-[#192734] border-white/10 text-white max-w-xs">
              <p>Vous naviguez dans l'espace étudiant avec des données fictives. Aucune modification ne sera sauvegardée.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="h-4 w-px bg-white/30 mx-1"></div>

        <Link to="/login">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-white hover:bg-white/20 hover:text-white text-xs">
            <LogIn className="w-3 h-3 mr-1" /> Se connecter
          </Button>
        </Link>

        <Button 
          size="sm" 
          variant="ghost" 
          className="h-6 px-2 text-white hover:bg-white/20 hover:text-white text-xs"
          onClick={() => toggleDemoMode(false)}
        >
          <XCircle className="w-3 h-3 mr-1" /> Quitter
        </Button>
      </div>
    </div>
  );
};

export default DemoBadge;