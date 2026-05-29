import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LayoutDashboard, Sparkles } from 'lucide-react';
import OwnerDashboardLayout from '@/components/owner/OwnerDashboardLayout';

/**
 * Aperçu de la coque web (sidebar + topbar + panneau) sans authentification.
 * Uniquement en `npm run dev` — voir /dev/owner-shell
 */
export default function OwnerShellDevPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

  return (
    <OwnerDashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="space-y-6 text-left">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-200/90">
              <Sparkles className="h-3.5 w-3.5" />
              Aperçu coque (dev, sans session)
            </p>
            <h1 className="mt-3 text-2xl font-bold text-white">Dashboard</h1>
            <p className="mt-1 text-sm text-white/55">
              Navigation / halos LIRI — contenu de démo pour valider le design.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {['Étudiants', 'Cours', 'Lives 7j', 'Alertes'].map((label) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-[#121A25]/80 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl font-bold text-white">0</span>
                <span className="rounded-lg bg-indigo-500/15 p-2 text-indigo-200">
                  <LayoutDashboard className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-white/50">{label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-sm text-white/45">
          Zone de contenu factice — connecte-toi sur <code className="text-white/60">/owner-dashboard</code> pour
          les données réelles.
        </div>
      </div>
    </OwnerDashboardLayout>
  );
}
