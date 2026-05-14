/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE CONFIGURATION ENGINE
 * Moteur de gestion de la configuration des sites
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase';
import { ConfigurationStepStatus } from './configurationTypes.js';

/**
 * ConfigurationEngine - Moteur de gestion de la configuration
 */
export class ConfigurationEngine {
  /**
   * Créer une étape de configuration
   */
  async createConfigurationStep(stepData) {
    const { data, error } = await supabase
      .from('cimolace_configuration_steps')
      .insert({
        site_id: stepData.site_id,
        step_number: stepData.step_number,
        step_name: stepData.step_name,
        status: stepData.status || ConfigurationStepStatus.PENDING,
        description: stepData.description || null,
        started_at: stepData.started_at || null,
        completed_at: stepData.completed_at || null,
        error_message: stepData.error_message || null,
        metadata: stepData.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer la configuration d'un site
   */
  async getSiteConfiguration(siteId) {
    const { data, error } = await supabase
      .from('cimolace_configuration_steps')
      .select('*')
      .eq('site_id', siteId)
      .order('step_number', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Démarrer une étape de configuration
   */
  async startStep(siteId, stepNumber) {
    const { data, error } = await supabase
      .from('cimolace_configuration_steps')
      .update({
        status: ConfigurationStepStatus.IN_PROGRESS,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', siteId)
      .eq('step_number', stepNumber)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Marquer une étape comme complétée
   */
  async completeStep(siteId, stepNumber) {
    const { data, error } = await supabase
      .from('cimolace_configuration_steps')
      .update({
        status: ConfigurationStepStatus.COMPLETED,
        completed_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', siteId)
      .eq('step_number', stepNumber)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Marquer une étape comme échouée
   */
  async failStep(siteId, stepNumber, errorMessage) {
    const { data, error } = await supabase
      .from('cimolace_configuration_steps')
      .update({
        status: ConfigurationStepStatus.FAILED,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', siteId)
      .eq('step_number', stepNumber)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Sauter une étape
   */
  async skipStep(siteId, stepNumber) {
    const { data, error } = await supabase
      .from('cimolace_configuration_steps')
      .update({
        status: ConfigurationStepStatus.SKIPPED,
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', siteId)
      .eq('step_number', stepNumber)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Mettre à jour une étape
   */
  async updateStep(siteId, stepNumber, updates) {
    const { data, error } = await supabase
      .from('cimolace_configuration_steps')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', siteId)
      .eq('step_number', stepNumber)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Calculer le pourcentage de progression
   */
  async getProgressPercentage(siteId) {
    const steps = await this.getSiteConfiguration(siteId);
    if (steps.length === 0) return 0;

    const completed = steps.filter(s => s.status === ConfigurationStepStatus.COMPLETED).length;
    return Math.round((completed / steps.length) * 100);
  }

  /**
   * Récupérer l'étape en cours
   */
  async getCurrentStep(siteId) {
    const { data, error } = await supabase
      .from('cimolace_configuration_steps')
      .select('*')
      .eq('site_id', siteId)
      .eq('status', ConfigurationStepStatus.IN_PROGRESS)
      .order('step_number', { ascending: true })
      .limit(1)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Récupérer la prochaine étape en attente
   */
  async getNextPendingStep(siteId) {
    const { data, error } = await supabase
      .from('cimolace_configuration_steps')
      .select('*')
      .eq('site_id', siteId)
      .eq('status', ConfigurationStepStatus.PENDING)
      .order('step_number', { ascending: true })
      .limit(1)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Vérifier si la configuration est terminée
   */
  async isConfigurationComplete(siteId) {
    const steps = await this.getSiteConfiguration(siteId);
    if (steps.length === 0) return false;

    const allCompleted = steps.every(s => 
      s.status === ConfigurationStepStatus.COMPLETED || 
      s.status === ConfigurationStepStatus.SKIPPED
    );

    return allCompleted;
  }

  /**
   * Récupérer les étapes échouées
   */
  async getFailedSteps(siteId) {
    const { data, error } = await supabase
      .from('cimolace_configuration_steps')
      .select('*')
      .eq('site_id', siteId)
      .eq('status', ConfigurationStepStatus.FAILED)
      .order('step_number', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Réinitialiser une étape
   */
  async resetStep(siteId, stepNumber) {
    const { data, error } = await supabase
      .from('cimolace_configuration_steps')
      .update({
        status: ConfigurationStepStatus.PENDING,
        started_at: null,
        completed_at: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', siteId)
      .eq('step_number', stepNumber)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Export singleton instance
export const configurationEngine = new ConfigurationEngine();
