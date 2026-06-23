/**
 * LiriEcolePage — Module ÉCOLE HORIZONTAL dans le portail LIRI (`/liri/ecole`).
 *
 * « École façon Zoom-app » : un tenant LIRI (créateur/coach SANS site vertical
 * comme ISNA) gère formations / calendrier / élèves DANS le portail LIRI, sans
 * vitrine `/t/:slug`. HORIZONTAL ≠ VERTICAL (le site ISNA `/t/:slug` reste à part).
 *
 * SHELL = chrome chaud du PORTAIL LIRI (`LiriPortalShell` : top-bar « ✦ LIRI »,
 * rail Accueil/Lives/Forum/Studio/École/Biblio/Brain) — PAS le shell admin.
 * CONTENU = surfaces back-office école réutilisées, rendues dans leur thème SSL
 * CLAIR (cream) → s'harmonise avec le terracotta du shell + fournit les tokens
 * `--lt-*` dont SecretariatOverview (Aperçu) a besoin.
 * GATE = visible si le tenant a un moteur école actif (tenant_services).
 */
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, BookOpen, Calendar, Users, GraduationCap } from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import OwnerFormationsTab from '@/components/owner/OwnerFormationsTab';
import { CalendarSection } from '@/components/school/school-life/CalendarComponents';
import SecretariatOverview from '@/components/secretariat/SecretariatOverview';
import SecretariatStudentDashboard from '@/components/secretariat/SecretariatStudentDashboard';
import { SslThemeProvider } from '@/pages/school/student-school-life/sslTheme';
import ErrorBoundary from '@/components/ErrorBoundary';
import { catalogApi } from '@/lib/api-v2';

// Les surfaces réutilisées lisent les tokens `--lt-*` (définis ailleurs sous le shell
// ADMIN `.premium-app-shell` → indéfinis ici). On les REMAPPE en SOMBRE CHAUD, à la
// palette du portail LIRI (cartes sombres chaudes + accent terracotta) → le contenu
// épouse le shell au lieu d'un fond blanc.
const ECOLE_THEME_VARS = {
  '--lt-text': '#f5f1e9',
  '--lt-sub': 'rgba(245,241,233,0.60)',
  '--lt-muted': 'rgba(245,241,233,0.42)',
  '--lt-border': 'rgba(245,241,233,0.10)',
  '--lt-card-bg': '#211e1a',
  '--lt-card-border': 'rgba(245,241,233,0.08)',
  '--lt-card-shadow': '0 10px 30px -16px rgba(0,0,0,0.6)',
  '--lt-inner-bg': '#191512',
  '--lt-gold': '#d97757',
  '--lt-gold-ink': '#e58a5f',
};

const TABS = [
  { id: 'apercu', label: 'Aperçu', icon: LayoutDashboard },
  { id: 'formations', label: 'Formations', icon: BookOpen },
  { id: 'calendrier', label: 'Calendrier', icon: Calendar },
  { id: 'eleves', label: 'Élèves', icon: Users },
];

const EMBER = '#d97757'; // accent terracotta du portail (LiriPortal.css)
// Clés tenant_services qui « allument » le moteur école (course_builder = formations).
const ECOLE_SERVICE_KEYS = ['course_builder', 'school', 'school_module', 'formations'];

export default function LiriEcolePage() {
  const [activeTab, setActiveTab] = useState('apercu');
  const [ecoleActive, setEcoleActive] = useState(null); // null=inconnu (affiché), false=non activé

  // GATE #3 : l'École s'affiche si un moteur école est actif (tenant_services).
  // Fail-open : si l'appel échoue, on n'enferme pas l'utilisateur (on affiche).
  useEffect(() => {
    let alive = true;
    catalogApi.getTenantServices()
      .then((svc) => {
        const ok = Array.isArray(svc) && svc.some((s) => s?.active && ECOLE_SERVICE_KEYS.includes(s?.service_key));
        if (alive) setEcoleActive(ok);
      })
      .catch(() => { if (alive) setEcoleActive(true); });
    return () => { alive = false; };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'formations': return <OwnerFormationsTab />;
      case 'calendrier': return <CalendarSection />;
      case 'eleves': return <SecretariatStudentDashboard />;
      case 'apercu':
      default: return <SecretariatOverview />;
    }
  };

  // Moteur école NON activé pour ce tenant → état d'activation (au lieu d'enfermer).
  if (ecoleActive === false) {
    return (
      <LiriPortalShell active="ecole">
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl text-white lp-ember"><GraduationCap size={26} /></span>
          <h2 className="text-[18px] font-semibold lp-ink">L'École n'est pas activée</h2>
          <p className="max-w-md text-[13px] lp-muted">
            Active le moteur École pour vendre tes formations, gérer un calendrier de formation
            et tes élèves directement depuis LIRI — sans site web.
          </p>
        </div>
      </LiriPortalShell>
    );
  }

  return (
    <LiriPortalShell active="ecole">
      <div className="flex h-full min-h-0 flex-col">
        {/* Sous-nav École — langage chaud du portail (lp-line, accent ember) */}
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
                      ? { background: 'rgba(217,119,87,0.15)', border: '1px solid rgba(217,119,87,0.34)', color: EMBER }
                      : { background: 'transparent', border: '1px solid transparent', color: 'rgba(245,244,238,0.55)' }
                  }
                >
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu en SOMBRE CHAUD (tokens --lt-* remappés → palette portail) → épouse
            le shell terracotta, fini le fond blanc. SslThemeProvider mode=dark pour les
            surfaces qui lisent le mode via contexte. ErrorBoundary par onglet. */}
        <div className="min-h-0 flex-1 overflow-auto" style={ECOLE_THEME_VARS}>
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
