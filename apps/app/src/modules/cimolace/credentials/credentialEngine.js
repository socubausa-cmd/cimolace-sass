/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE CREDENTIAL ENGINE
 * Moteur de gestion des credentials API
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase';
import { CredentialType } from './credentialTypes.js';

/**
 * CredentialEngine - Moteur de gestion des credentials
 */
export class CredentialEngine {
  /**
   * Ajouter un credential
   */
  async addCredential(credentialData) {
    const { data, error } = await supabase
      .from('cimolace_credentials')
      .insert({
        site_id: credentialData.site_id,
        key_name: credentialData.key_name,
        encrypted_value: credentialData.encrypted_value,
        key_type: credentialData.key_type || CredentialType.API_KEY,
        description: credentialData.description || null,
        last_rotated_at: credentialData.last_rotated_at || new Date().toISOString(),
        expires_at: credentialData.expires_at || null,
      })
      .select('id, key_name, key_type, description, last_rotated_at, expires_at, created_at, updated_at')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les credentials d'un site (masqués)
   */
  async getSiteCredentials(siteId) {
    const { data, error } = await supabase
      .from('cimolace_credentials')
      .select('id, key_name, key_type, description, last_rotated_at, expires_at, created_at, updated_at')
      .eq('site_id', siteId)
      .order('key_name', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer un credential par ID
   */
  async getCredentialById(credentialId) {
    const { data, error } = await supabase
      .from('cimolace_credentials')
      .select('id, key_name, key_type, description, last_rotated_at, expires_at, created_at, updated_at')
      .eq('id', credentialId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Mettre à jour un credential
   */
  async updateCredential(credentialId, updates) {
    const { data, error } = await supabase
      .from('cimolace_credentials')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', credentialId)
      .select('id, key_name, key_type, description, last_rotated_at, expires_at, created_at, updated_at')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Rotater un credential
   */
  async rotateCredential(credentialId, newEncryptedValue) {
    const { data, error } = await supabase
      .from('cimolace_credentials')
      .update({
        encrypted_value: newEncryptedValue,
        last_rotated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', credentialId)
      .select('id, key_name, key_type, description, last_rotated_at, expires_at, created_at, updated_at')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Supprimer un credential
   */
  async deleteCredential(credentialId) {
    const { error } = await supabase
      .from('cimolace_credentials')
      .delete()
      .eq('id', credentialId);

    if (error) throw error;
  }

  /**
   * Récupérer les credentials expirés
   */
  async getExpiredCredentials() {
    const { data, error } = await supabase
      .from('cimolace_credentials')
      .select('id, key_name, key_type, description, last_rotated_at, expires_at, created_at, updated_at')
      .lte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les credentials qui expirent bientôt (dans les 30 jours)
   */
  async getExpiringSoonCredentials() {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { data, error } = await supabase
      .from('cimolace_credentials')
      .select('id, key_name, key_type, description, last_rotated_at, expires_at, created_at, updated_at')
      .gte('expires_at', new Date().toISOString())
      .lte('expires_at', thirtyDaysFromNow.toISOString())
      .order('expires_at', { ascending: true });

    if (error) throw error;
    return data;
  }
}

// Export singleton instance
export const credentialEngine = new CredentialEngine();
