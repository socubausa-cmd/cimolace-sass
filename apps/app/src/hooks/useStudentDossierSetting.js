import { useState, useEffect } from 'react';
import { tenantsApi } from '@/lib/api-v2';
import { activeTenantConfig } from '@/lib/tenant/activeTenantConfig';

/**
 * Logique PARTAGÉE du réglage « dossier élève » (KYC certificats), réutilisée par
 * les DEUX surfaces de réglages owner :
 *   - TenantAdminSettingsPage (shell ACADEMY, /t/:slug/admin/settings)
 *   - SettingsPage (onglet Paramètres d'OwnerDashboard, embarqué dans le portail
 *     LIRI /liri/ecole)
 * Source de vérité = tenants.metadata.settings.requiresStudentDossier (lu via
 * tenantsApi.current(), double-wrap défensif) ; repli sur activeTenantConfig
 * (founder ISNA = true). Écriture owner/admin via PATCH /tenants/current/settings.
 */
export function useStudentDossierSetting() {
  const [value, setValue] = useState(null); // null = en cours de chargement
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    tenantsApi
      .current()
      .then((t) => {
        if (!alive) return;
        const meta = t?.metadata ?? t?.data?.metadata ?? null;
        setValue(
          typeof meta?.settings?.requiresStudentDossier === 'boolean'
            ? meta.settings.requiresStudentDossier
            : !!activeTenantConfig.requiresStudentDossier,
        );
      })
      .catch(() => {
        if (alive) setValue(!!activeTenantConfig.requiresStudentDossier);
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = async (next) => {
    const prev = value;
    setValue(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await tenantsApi.updateSettings({ requiresStudentDossier: next });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setValue(prev);
      setError(e?.message ?? 'Erreur lors de la mise à jour du réglage');
    } finally {
      setSaving(false);
    }
  };

  return { value, saving, saved, error, save };
}
