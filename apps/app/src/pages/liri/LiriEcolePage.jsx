/**
 * LiriEcolePage — Module ÉCOLE HORIZONTAL dans le portail LIRI (`/liri/ecole`).
 *
 * « École façon Zoom-app » : un tenant LIRI (créateur / coach SANS site vertical
 * comme ISNA) gère formations / calendrier / élèves DANS le portail LIRI — sans
 * vitrine `/t/:slug`. HORIZONTAL ≠ VERTICAL (le site ISNA `/t/:slug` reste à part).
 *
 * DESIGN : on s'aligne sur le SHELL DU PORTAIL LIRI (`LiriPortalShell` : chrome
 * chaud terracotta, top-bar « ✦ LIRI », rail Accueil/Lives/.../École) et NON sur
 * le shell admin (LiriDashboardShell / PRORASCIENCE) → pas d'écart visuel.
 * Le contenu réutilise les surfaces back-office existantes (tenant-agnostiques) :
 *   - Formations → OwnerFormationsTab
 *   - Calendrier → CalendarSection
 *   - Élèves     → SecretariatStudentDashboard
 */
import React, { useState } from 'react';
import { BookOpen, Calendar, Users } from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import OwnerFormationsTab from '@/components/owner/OwnerFormationsTab';
import { CalendarSection } from '@/components/school/school-life/CalendarComponents';
import SecretariatStudentDashboard from '@/components/secretariat/SecretariatStudentDashboard';
import { SslThemeProvider } from '@/pages/school/student-school-life/sslTheme';
import ErrorBoundary from '@/components/ErrorBoundary';

const TABS = [
  { id: 'formations', label: 'Formations', icon: BookOpen },
  { id: 'calendrier', label: 'Calendrier', icon: Calendar },
  { id: 'eleves', label: 'Élèves', icon: Users },
];

// Accent terracotta du portail (LiriPortal.css : ~#d97757 / --coral).
const EMBER = '#d97757';

export default function LiriEcolePage() {
  const [activeTab, setActiveTab] = useState('formations');

  const renderContent = () => {
    switch (activeTab) {
      case 'calendrier': return <CalendarSection />;
      case 'eleves': return <SecretariatStudentDashboard />;
      case 'formations':
      default: return <OwnerFormationsTab />;
    }
  };

  return (
    <LiriPortalShell active="ecole">
      <div className="flex h-full min-h-0 flex-col">
        {/* Sous-nav École — dans le langage chaud du portail (lp-line, accent ember) */}
        <div className="flex items-center gap-3 border-b lp-line px-4 py-2.5">
          <span className="text-[14px] font-semibold lp-ink">École</span>
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className="lp-tr flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-medium"
                  style={
                    on
                      ? { background: 'rgba(217,119,87,0.15)', border: `1px solid rgba(217,119,87,0.34)`, color: EMBER }
                      : { background: 'transparent', border: '1px solid transparent', color: 'rgba(245,244,238,0.55)' }
                  }
                >
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu (réutilisé) — ErrorBoundary par onglet pour qu'un composant qui
            plante ne blanchisse pas tout le module. */}
        <div className="min-h-0 flex-1 overflow-auto">
          <ErrorBoundary key={activeTab} logTag={`LIRI École · ${activeTab}`}>
            <SslThemeProvider mode="dark">
              <div className="p-4">{renderContent()}</div>
            </SslThemeProvider>
          </ErrorBoundary>
        </div>
      </div>
    </LiriPortalShell>
  );
}
