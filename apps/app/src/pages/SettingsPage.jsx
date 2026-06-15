import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import OwnerDashboardLayout from '@/components/owner/OwnerDashboardLayout';
import { GeneralSettingsForm, SecuritySettingsForm, StripeSettingsForm } from '@/components/settings/SettingsForms';
import TenantPayoutProvidersForm from '@/components/settings/TenantPayoutProvidersForm';
import { AnimatePresence, motion } from 'framer-motion';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import { Settings, CalendarDays, CreditCard, Shield, Bell, Plug } from 'lucide-react';

import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';
import { useResolvedTenantSlug } from '@/hooks/useResolvedTenantSlug';

const SETTINGS_TABS = new Set(['general', 'academic', 'payments', 'security', 'notifications', 'integrations']);

/* Thème CLAIR « Wix Studio » — aligné sur OwnerDashboardOverview. */
const LT_GOLD_INK = '#8A6D1A';
const lightPanel = {
  background: '#FFFFFF',
  border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  borderRadius: 14,
};

const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { slug: hostTenantSlug, loading: hostTenantLoading } = useResolvedTenantSlug();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() =>
    tabFromUrl && SETTINGS_TABS.has(tabFromUrl) ? tabFromUrl : 'general',
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && SETTINGS_TABS.has(t)) setActiveTab(t);
  }, [searchParams]);

  const handleSettingsTab = (tab) => {
    setActiveTab(tab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  };
  const settingsOptions = [
    { value: 'general', label: 'Général', badge: 'Base', icon: Settings },
    { value: 'academic', label: 'Année Scolaire', badge: 'Calendrier', icon: CalendarDays },
    { value: 'payments', label: 'Paiements', badge: 'Facturation', icon: CreditCard },
    { value: 'security', label: 'Sécurité', badge: 'Accès', icon: Shield },
    { value: 'notifications', label: 'Notifications', badge: 'Alertes', icon: Bell },
    { value: 'integrations', label: 'Intégrations', badge: 'Services', icon: Plug },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <div className="p-4" style={lightPanel}><GeneralSettingsForm /></div>;
      case 'security':
        return <div className="p-4" style={lightPanel}><SecuritySettingsForm /></div>;
      case 'integrations':
        return (
          <div className="grid gap-6 p-4" style={lightPanel}>
            <StripeSettingsForm />
          </div>
        );
      case 'payments':
        return (
          <div className="space-y-4">
            <div
              className="flex flex-wrap items-center justify-between gap-3 p-4"
              style={{ ...lightPanel, border: '1px solid rgba(212,175,55,0.35)', background: '#FFFDF6' }}
            >
              <p className="text-sm text-zinc-600">
                Lien encaissement pour le tenant résolu depuis ce domaine{' '}
                {hostTenantLoading ? (
                  <span className="text-zinc-400">(chargement…)</span>
                ) : (
                  <>
                    (<code className="text-zinc-700">{hostTenantSlug}</code>) :{' '}
                    <Link
                      to={`/t/${hostTenantSlug}/admin/settings`}
                      className="break-all font-mono text-xs hover:underline"
                      style={{ color: LT_GOLD_INK }}
                    >
                      /t/{hostTenantSlug}/admin/settings
                    </Link>
                  </>
                )}
                {!hostTenantLoading && hostTenantSlug !== String(isnaTenantConfig.slug || '').toLowerCase() ? (
                  <span className="mt-2 block text-xs text-zinc-500">
                    Accès config par défaut ISNA :{' '}
                    <Link
                      to={`/t/${isnaTenantConfig.slug}/admin/settings`}
                      className="font-mono hover:underline"
                      style={{ color: LT_GOLD_INK }}
                    >
                      /t/{isnaTenantConfig.slug}/admin/settings
                    </Link>
                  </span>
                ) : null}
                <span className="mt-2 block text-xs text-zinc-500">
                  Le champ slug sous le tutoriel reste éditable pour un autre tenant si vos droits le permettent.
                </span>
              </p>
            </div>
            <div className="p-4" style={lightPanel}>
              <TenantPayoutProvidersForm initialTenantSlug={hostTenantSlug} />
            </div>
          </div>
        );
      case 'academic':
        return <div className="text-zinc-500 p-8 text-center" style={lightPanel}>Paramètres année scolaire (À venir)</div>;
      case 'notifications':
        return <div className="text-zinc-500 p-8 text-center" style={lightPanel}>Paramètres notifications (À venir)</div>;
      default:
        return null;
    }
  };

  return (
    <OwnerDashboardLayout activeTab="settings" onTabChange={() => {}}>
       <div className="space-y-6">
          <div className="p-6" style={lightPanel}>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Paramètres</h1>
            <p className="text-zinc-500 mt-1.5">Configuration globale de la plateforme.</p>
          </div>

          <PremiumSegmentedSelector
            value={activeTab}
            onChange={handleSettingsTab}
            options={settingsOptions}
            layoutId="settings-segment-pill"
            railClassName="!bg-[#F4F5F7] !border-black/5"
            optionClassName="!text-zinc-500 [&.text-white]:!text-zinc-900 hover:!bg-black/[0.03]"
          />

          <div className="mt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {renderTabContent()}
              </motion.div>
            </AnimatePresence>
          </div>
       </div>
    </OwnerDashboardLayout>
  );
};

export default SettingsPage;