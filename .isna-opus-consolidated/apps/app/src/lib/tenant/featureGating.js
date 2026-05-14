/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE FEATURE GATING - SYSTÈME DE GESTION DES FEATURES
 * ═══════════════════════════════════════════════════════════════
 */

import { hasFeature } from './getCurrentTenant.js';

// ═══════════════════════════════════════════════════════════════
// FEATURES DISPONIBLES
// ═══════════════════════════════════════════════════════════════

export const FEATURE_KEYS = {
  SCHOOL_ENGINE: 'school_engine',
  LIVE_ROOM: 'live_room',
  SMARTBOARD: 'smartboard',
  CREATOR_STUDIO: 'creator_studio',
  ADMIN_BOOKING: 'admin_booking',
  MARKETING_CREATOR: 'marketing_creator',
  NEURO_RECALL: 'neuro_recall',
  REPLAY_SYSTEM: 'replay_system',
};

// ═══════════════════════════════════════════════════════════════
// CLASS FEATURE GATING
// ═══════════════════════════════════════════════════════════════

class FeatureGating {
  /**
   * Vérifie si une feature est activée pour un tenant
   */
  async isEnabled(tenantSlug, featureKey) {
    return await hasFeature(tenantSlug, featureKey);
  }

  /**
   * Vérifie si le moteur d'école est activé
   */
  async hasSchoolEngine(tenantSlug) {
    return await this.isEnabled(tenantSlug, FEATURE_KEYS.SCHOOL_ENGINE);
  }

  /**
   * Vérifie si la live room est activée
   */
  async hasLiveRoom(tenantSlug) {
    return await this.isEnabled(tenantSlug, FEATURE_KEYS.LIVE_ROOM);
  }

  /**
   * Vérifie si le smartboard est activé
   */
  async hasSmartboard(tenantSlug) {
    return await this.isEnabled(tenantSlug, FEATURE_KEYS.SMARTBOARD);
  }

  /**
   * Vérifie si le creator studio est activé
   */
  async hasCreatorStudio(tenantSlug) {
    return await this.isEnabled(tenantSlug, FEATURE_KEYS.CREATOR_STUDIO);
  }

  /**
   * Vérifie si l'admin booking est activé
   */
  async hasAdminBooking(tenantSlug) {
    return await this.isEnabled(tenantSlug, FEATURE_KEYS.ADMIN_BOOKING);
  }

  /**
   * Vérifie si le marketing creator est activé
   */
  async hasMarketingCreator(tenantSlug) {
    return await this.isEnabled(tenantSlug, FEATURE_KEYS.MARKETING_CREATOR);
  }

  /**
   * Vérifie si le neuro recall est activé
   */
  async hasNeuroRecall(tenantSlug) {
    return await this.isEnabled(tenantSlug, FEATURE_KEYS.NEURO_RECALL);
  }

  /**
   * Vérifie si le replay system est activé
   */
  async hasReplaySystem(tenantSlug) {
    return await this.isEnabled(tenantSlug, FEATURE_KEYS.REPLAY_SYSTEM);
  }

  /**
   * Récupère toutes les features activées pour un tenant
   */
  async getEnabledFeatures(tenantSlug) {
    const enabledFeatures = {};

    for (const key of Object.values(FEATURE_KEYS)) {
      enabledFeatures[key] = await this.isEnabled(tenantSlug, key);
    }

    return enabledFeatures;
  }

  /**
   * Vérifie si une feature est requise et lève une erreur si non activée
   */
  async requireFeature(tenantSlug, featureKey, errorMessage) {
    const enabled = await this.isEnabled(tenantSlug, featureKey);

    if (!enabled) {
      throw new Error(errorMessage || `Feature ${featureKey} is not enabled for tenant ${tenantSlug}`);
    }

    return true;
  }

  /**
   * Rendu conditionnel basé sur les features
   */
  async renderIfEnabled(tenantSlug, featureKey, component, fallbackComponent) {
    const enabled = await this.isEnabled(tenantSlug, featureKey);

    if (enabled) {
      return component;
    }

    return fallbackComponent || null;
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

let featureGatingInstance = null;

export function getFeatureGating() {
  if (!featureGatingInstance) {
    featureGatingInstance = new FeatureGating();
  }
  return featureGatingInstance;
}

export default FeatureGating;
