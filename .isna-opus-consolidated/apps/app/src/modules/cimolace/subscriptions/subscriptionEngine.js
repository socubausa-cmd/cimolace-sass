/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE SUBSCRIPTION ENGINE
 * Moteur de gestion des abonnements
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase';
import { SubscriptionStatus, BillingCycle, PaymentProvider } from './subscriptionTypes.js';

/**
 * SubscriptionEngine - Moteur de gestion des abonnements
 */
export class SubscriptionEngine {
  /**
   * Créer un nouvel abonnement
   */
  async createSubscription(subscriptionData) {
    const { data, error } = await supabase
      .from('cimolace_subscriptions')
      .insert({
        site_id: subscriptionData.site_id,
        provider: subscriptionData.provider || PaymentProvider.PAYPAL,
        provider_subscription_id: subscriptionData.provider_subscription_id || null,
        plan: subscriptionData.plan,
        billing_cycle: subscriptionData.billing_cycle || BillingCycle.MONTHLY,
        amount: subscriptionData.amount,
        currency: subscriptionData.currency || 'EUR',
        status: subscriptionData.status || SubscriptionStatus.ACTIVE,
        trial_ends_at: subscriptionData.trial_ends_at || null,
        current_period_start: subscriptionData.current_period_start || new Date().toISOString(),
        current_period_end: subscriptionData.current_period_end || null,
        cancel_at_period_end: subscriptionData.cancel_at_period_end || false,
        metadata: subscriptionData.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer un abonnement par ID
   */
  async getSubscriptionById(subscriptionId) {
    const { data, error } = await supabase
      .from('cimolace_subscriptions')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          domain,
          cimolace_tenants (
            id,
            name,
            email
          )
        )
      `)
      .eq('id', subscriptionId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les abonnements d'un site
   */
  async getSubscriptionsBySite(siteId) {
    const { data, error } = await supabase
      .from('cimolace_subscriptions')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les abonnements d'un client (via ses sites)
   */
  async getSubscriptionsByClient(clientId) {
    const { data, error } = await supabase
      .from('cimolace_subscriptions')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          domain
        )
      `)
      .in('site_id',
        (await supabase.from('cimolace_sites').select('id').eq('tenant_id', clientId)).data?.map(s => s.id) || []
      )
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer tous les abonnements avec filtres
   */
  async getAllSubscriptions(filters = {}) {
    let query = supabase.from('cimolace_subscriptions').select(`
      *,
      cimolace_sites (
        id,
        name,
        domain,
        cimolace_tenants (
          id,
          name,
          email
        )
      )
    `);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.provider) {
      query = query.eq('provider', filters.provider);
    }

    if (filters.plan) {
      query = query.eq('plan', filters.plan);
    }

    if (filters.site_id) {
      query = query.eq('site_id', filters.site_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Mettre à jour un abonnement
   */
  async updateSubscription(subscriptionId, updates) {
    const { data, error } = await supabase
      .from('cimolace_subscriptions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Annuler un abonnement
   */
  async cancelSubscription(subscriptionId, cancelAtPeriodEnd = true) {
    return this.updateSubscription(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
      status: SubscriptionStatus.CANCELLED,
    });
  }

  /**
   * Suspendre un abonnement
   */
  async suspendSubscription(subscriptionId) {
    return this.updateSubscription(subscriptionId, {
      status: SubscriptionStatus.SUSPENDED,
    });
  }

  /**
   * Réactiver un abonnement
   */
  async reactivateSubscription(subscriptionId) {
    return this.updateSubscription(subscriptionId, {
      status: SubscriptionStatus.ACTIVE,
      cancel_at_period_end: false,
    });
  }

  /**
   * Marquer un abonnement comme en retard
   */
  async markPastDue(subscriptionId) {
    return this.updateSubscription(subscriptionId, {
      status: SubscriptionStatus.PAST_DUE,
    });
  }

  /**
   * Récupérer les abonnements en retard
   */
  async getOverdueSubscriptions() {
    const { data, error } = await supabase
      .from('cimolace_subscriptions')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          domain,
          cimolace_tenants (
            id,
            name,
            email
          )
        )
      `)
      .eq('status', SubscriptionStatus.PAST_DUE)
      .order('current_period_end', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les abonnements actifs
   */
  async getActiveSubscriptions() {
    const { data, error } = await supabase
      .from('cimolace_subscriptions')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          domain,
          cimolace_tenants (
            id,
            name,
            email
          )
        )
      `)
      .eq('status', SubscriptionStatus.ACTIVE)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
}

// Export singleton instance
export const subscriptionEngine = new SubscriptionEngine();
