import React from 'react';
import Logo from '@/components/Logo';

const DashboardRoleBanner = ({ roleLabel }) => {
  if (!roleLabel) return null;

  return (
    <div className="px-4 md:px-6 pt-4">
      <div className="max-w-7xl mx-auto rounded-2xl border border-white/10 bg-[#192734]/70 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Logo size="small" variant="dark" showText={false} />
          <p className="text-white font-semibold leading-tight">
            Tableau de bord <span className="text-[#D4AF37]">- {roleLabel}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardRoleBanner;
