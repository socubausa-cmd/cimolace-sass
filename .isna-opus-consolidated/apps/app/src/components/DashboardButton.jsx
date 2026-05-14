import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { resolveDashboardPath } from '@/lib/dashboardRoute';

const DashboardButton = () => {
  const { user } = useAuth();

  if (!user) return null;
  const dashboardPath = resolveDashboardPath(user);

  return (
    <Link to={dashboardPath}>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button 
          className="bg-gradient-to-r from-[#D4AF37] to-amber-600 hover:from-amber-500 hover:to-yellow-500 text-black font-bold shadow-lg shadow-amber-900/20 border-0 gap-2 transition-all duration-300"
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="hidden sm:inline">Tableau de bord</span>
        </Button>
      </motion.div>
    </Link>
  );
};

export default DashboardButton;