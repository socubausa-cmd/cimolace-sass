/**
 * LiriEcolePage — Module ÉCOLE complet DANS le portail LIRI (`/liri/ecole`).
 *
 * Embarque la TOTALITÉ du back-office école (les 6 familles / ~24 onglets) DANS le
 * shell du portail LIRI (`LiriPortalShell`), au lieu du vieux shell admin séparé
 * (`LiriDashboardShell` « style isna ») → on ne retombe plus jamais hors du portail.
 *
 * - SHELL = `LiriPortalShell` (rail Accueil/Lives/Forum/Studio/École/Biblio/Brain).
 * - SOUS-NAV = sous-rail des familles (SOURCE UNIQUE `buildOwnerMenuGroups`, partagée
 *   avec l'ancien back-office) → zéro divergence de menu.
 * - CONTENU = `OwnerDashboardBody` (le switch d'onglets réutilisé tel quel), avec
 *   `basePath="/liri/ecole"` pour que toutes les navigations internes restent dans le
 *   portail.
 * - THÈME = sombre chaud (tokens `--lt-*` remappés terracotta) → épouse le shell.
 * - GATE = visible si un moteur école est actif (tenant_services), fail-open.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { OwnerDashboardBody } from '@/pages/OwnerDashboard';
import { buildOwnerMenuGroups } from '@/components/owner/ownerMenuGroups';
import { useResolvedTenantSlug } from '@/hooks/useResolvedTenantSlug';
import { SslThemeProvider } from '@/pages/school/student-school-life/sslTheme';
import ErrorBoundary from '@/components/ErrorBoundary';
import { catalogApi } from '@/lib/api-v2';

const ECOLE_BASE = '/liri/ecole';

// Les surfaces back-office lisent les tokens `--lt-*` (définis sous le shell admin).
// On les REMAPPE en SOMBRE CHAUD (palette portail : cartes sombres chaudes + accent
// terracotta) → le contenu épouse le shell au lieu d'un fond blanc froid.
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
  '--school-accent': '#d97757',
  '--school-accent-rgb': '217 119 87',
};

// Certaines surfaces (CalendarSection…) hardcodent des bleus navy froids → on les
// remappe vers du sombre CHAUD, scopé au contenu École (.ecole-warm-scope).
const ECOLE_WARM_CSS = `
.ecole-warm-scope .bg-\\[\\#0F1419\\],
.ecole-warm-scope .bg-\\[\\#0F1419\\]\\/50,
.ecole-warm-scope .bg-\\[\\#0F1419\\]\\/30,
.ecole-warm-scope .bg-\\[\\#0F1419\\]\\/20 { background-color: #191512 !important; }
.ecole-warm-scope .bg-\\[\\#192734\\] { background-color: #221f1b !important; }
.ecole-warm-scope .bg-\\[\\#16202A\\] { background-color: #1d1916 !important; }
.ecole-warm-scope .from-\\[\\#192734\\] { --tw-gradient-from: #221f1b var(--tw-gradient-from-position) !important; }
.ecole-warm-scope .to-\\[\\#0F1419\\] { --tw-gradient-to: #191512 var(--tw-gradient-to-position) !important; }
`;

// Clés tenant_services qui « allument » le moteur école.
const ECOLE_SERVICE_KEYS = ['course_builder', 'school', 'school_module', 'formations'];

export default function LiriEcolePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { slug: payoutTenantSlug } = useResolvedTenantSlug();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const [ecoleActive, setEcoleActive] = useState(null); // null=inconnu (affiché), false=non activé

  const menuGroups = buildOwnerMenuGroups(payoutTenantSlug, ECOLE_BASE);

  // GATE : l'École s'affiche si un moteur école est actif (tenant_services). Fail-open.
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

  // Sélection d'un item du sous-rail : href → navigation directe ; sinon → onglet (?tab=).
  const selectItem = (item) => {
    if (item.href) {
      if (/^https?:\/\//.test(item.href)) window.location.assign(item.href);
      else navigate(item.href);
      return;
    }
    navigate(`${ECOLE_BASE}?tab=${item.id}`);
  };

  // Moteur école NON activé → état d'activation (au lieu d'enfermer).
  if (ecoleActive === false) {
    return (
      <LiriPortalShell active="ecole">
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl text-white lp-ember"><GraduationCap size={26} /></span>
          <h2 className="text-[18px] font-semibold lp-ink">L'École n'est pas activée</h2>
          <p className="max-w-md text-[13px] lp-muted">
            Active le moteur École pour gérer formations, calendrier, élèves, coaching,
            certificats et finances directement depuis LIRI — sans site web.
          </p>
        </div>
      </LiriPortalShell>
    );
  }

  return (
    <LiriPortalShell active="ecole">
      <div className="flex h-full min-h-0" style={ECOLE_THEME_VARS}>
        <style>{ECOLE_WARM_CSS}</style>

        {/* Sous-rail École — les 6 familles (source unique partagée avec le back-office) */}
        <aside className="hidden md:flex w-[212px] shrink-0 flex-col overflow-y-auto border-r lp-line py-3">
          {menuGroups.map((group) => (
            <div key={group.section} className="px-2 pb-1.5 pt-3 first:pt-1">
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">{group.section}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = !item.href && item.id === activeTab;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors ${
                      isActive
                        ? 'font-semibold text-[var(--school-accent)]'
                        : 'text-stone-300 hover:bg-white/[0.04] hover:text-white'
                    }`}
                    style={isActive ? { background: 'color-mix(in srgb, var(--school-accent) 16%, transparent)' } : undefined}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* Contenu — back-office complet réutilisé, sombre chaud, scopé pour le calendrier */}
        <div className="ecole-warm-scope min-h-0 flex-1 overflow-auto">
          <ErrorBoundary key={activeTab} logTag={`LIRI École · ${activeTab}`}>
            <SslThemeProvider mode="dark">
              <div className="p-4">
                <OwnerDashboardBody activeTab={activeTab} basePath={ECOLE_BASE} />
              </div>
            </SslThemeProvider>
          </ErrorBoundary>
        </div>
      </div>
    </LiriPortalShell>
  );
}
