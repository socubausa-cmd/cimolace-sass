/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE USE TENANT HOOK
 * Hook React pour accéder aux données du tenant
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { getCurrentTenant, getTenantConfig, getTenantBranding, getTenantLimits, getTenantContent, hasFeature } from '../lib/tenant/getCurrentTenant.js';
import { getFeatureGating } from '../lib/tenant/featureGating.js';

/**
 * Hook pour accéder aux données du tenant actuel
 * @param {string} tenantSlug - Le slug du tenant
 */
export function useTenant(tenantSlug) {
  const [tenant, setTenant] = useState(null);
  const [config, setConfig] = useState(null);
  const [branding, setBranding] = useState(null);
  const [limits, setLimits] = useState(null);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadTenantData() {
      try {
        setLoading(true);
        setError(null);

        const [tenantData, configData, brandingData, limitsData, contentData] = await Promise.all([
          getCurrentTenant(tenantSlug),
          getTenantConfig(tenantSlug),
          getTenantBranding(tenantSlug),
          getTenantLimits(tenantSlug),
          getTenantContent(tenantSlug),
        ]);

        setTenant(tenantData);
        setConfig(configData);
        setBranding(brandingData);
        setLimits(limitsData);
        setContent(contentData);

        if (!tenantData) {
          setError(`Tenant "${tenantSlug}" non trouvé`);
        }
      } catch (err) {
        console.error('Error loading tenant data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (tenantSlug) {
      loadTenantData();
    }
  }, [tenantSlug]);

  return {
    tenant,
    config,
    branding,
    limits,
    content,
    loading,
    error,
    isActive: tenant?.status === 'active',
  };
}

/**
 * Hook pour vérifier si une feature est activée pour le tenant
 * @param {string} tenantSlug - Le slug du tenant
 * @param {string} feature - La feature à vérifier
 */
export function useFeature(tenantSlug, feature) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkFeature() {
      try {
        setLoading(true);
        const isEnabled = await hasFeature(tenantSlug, feature);
        setEnabled(isEnabled);
      } catch (err) {
        console.error('Error checking feature:', err);
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    }

    if (tenantSlug && feature) {
      checkFeature();
    }
  }, [tenantSlug, feature]);

  return { enabled, loading };
}

/**
 * Hook pour accéder au système de feature gating
 * @param {string} tenantSlug - Le slug du tenant
 */
export function useFeatureGating(tenantSlug) {
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeatures() {
      try {
        setLoading(true);
        const featureGating = getFeatureGating();
        const enabledFeatures = await featureGating.getEnabledFeatures(tenantSlug);
        setFeatures(enabledFeatures);
      } catch (err) {
        console.error('Error loading features:', err);
        setFeatures({});
      } finally {
        setLoading(false);
      }
    }

    if (tenantSlug) {
      loadFeatures();
    }
  }, [tenantSlug]);

  const checkFeature = async (featureKey) => {
    const featureGating = getFeatureGating();
    return await featureGating.isEnabled(tenantSlug, featureKey);
  };

  return {
    features,
    loading,
    checkFeature,
    hasSchoolEngine: features.school_engine,
    hasLiveRoom: features.live_room,
    hasSmartboard: features.smartboard,
    hasCreatorStudio: features.creator_studio,
    hasAdminBooking: features.admin_booking,
    hasMarketingCreator: features.marketing_creator,
    hasNeuroRecall: features.neuro_recall,
    hasReplaySystem: features.replay_system,
  };
}

export default useTenant;
