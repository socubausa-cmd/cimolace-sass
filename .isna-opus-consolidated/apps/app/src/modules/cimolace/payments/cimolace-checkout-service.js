/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE CHECKOUT SERVICE - SERVICE DE CHECKOUT CIMOLACE
 * Utilise l'adapter Chariow pour réutiliser le moteur existant
 * ═══════════════════════════════════════════════════════════════
 */

import {
  createCimolaceSetupPayment,
  createCimolaceManualMonthlyPayment,
  checkCimolacePaymentStatus,
} from './cimolace-chariow-adapter.js';
import { getCimolaceProductManager } from './cimolace-payment-products.js';
import { getSupabaseAdmin } from '../../../../netlify/functions/_lib/supabaseAdmin.js';

// ═══════════════════════════════════════════════════════════════
// CLASS CIMOLACE CHECKOUT SERVICE
// ═══════════════════════════════════════════════════════════════

class CimolaceCheckoutService {
  constructor() {
    this.cimolaceProductManager = getCimolaceProductManager();
    this.supabase = getSupabaseAdmin();
  }

  /**
   * Crée un checkout pour le paiement de setup
   */
  async createSetupCheckout(customerData, options = {}) {
    const siteId = options.siteId;
    const plan = options.plan || 'starter';

    // Vérifier que le site existe
    if (siteId) {
      const { data: site } = await this.supabase
        .from('cimolace_sites')
        .select('id')
        .eq('id', siteId)
        .maybeSingle();

      if (!site) {
        throw new Error('Site non trouvé');
      }
    }

    const successUrl = options.redirectUrl || `${process.env.APP_BASE_URL}/cimolace/billing/setup/success`;
    const cancelUrl = `${process.env.APP_BASE_URL}/cimolace/billing/setup/cancel`;

    // Utiliser l'adapter Chariow
    const result = await createCimolaceSetupPayment({
      customer: customerData,
      successUrl,
      cancelUrl,
    });

    // Créer un enregistrement de paiement dans Supabase
    const { data: payment } = await this.supabase
      .from('cimolace_payments')
      .insert({
        site_id: siteId,
        type: 'setup',
        amount: 500,
        currency: 'EUR',
        status: 'pending',
        provider: 'chariow',
        provider_payment_id: result.saleId,
        metadata: {
          plan,
          checkout_url: result.url,
        },
      })
      .select('*')
      .single();

    return {
      checkoutUrl: result.url,
      saleId: result.saleId,
      paymentId: payment.id,
      amount: 500,
      plan,
    };
  }

  /**
   * Crée un checkout pour un abonnement mensuel
   */
  async createMonthlyCheckout(customerData, options = {}) {
    const siteId = options.siteId;
    const plan = options.plan || 'starter';
    const scheduleId = options.scheduleId;

    // Vérifier que le site existe
    if (siteId) {
      const { data: site } = await this.supabase
        .from('cimolace_sites')
        .select('id')
        .eq('id', siteId)
        .maybeSingle();

      if (!site) {
        throw new Error('Site non trouvé');
      }
    }

    const successUrl = options.redirectUrl || `${process.env.APP_BASE_URL}/cimolace/billing/monthly/success`;
    const cancelUrl = `${process.env.APP_BASE_URL}/cimolace/billing/monthly/cancel`;

    // Utiliser l'adapter Chariow
    const result = await createCimolaceManualMonthlyPayment({
      plan,
      customer: customerData,
      successUrl,
      cancelUrl,
    });

    // Créer un enregistrement de paiement dans Supabase
    const { data: payment } = await this.supabase
      .from('cimolace_payments')
      .insert({
        site_id: siteId,
        type: 'monthly',
        amount: result.amount || 150,
        currency: 'EUR',
        status: 'pending',
        provider: 'chariow',
        provider_payment_id: result.saleId,
        metadata: {
          plan,
          schedule_id: scheduleId,
          checkout_url: result.url,
        },
      })
      .select('*')
      .single();

    return {
      checkoutUrl: result.url,
      saleId: result.saleId,
      paymentId: payment.id,
      amount: payment.amount,
      plan,
    };
  }

  /**
   * Crée un checkout pour une échéance spécifique
   */
  async createScheduleCheckout(scheduleId, customerData, options = {}) {
    // Récupérer l'échéance
    const { data: schedule } = await this.supabase
      .from('cimolace_payment_schedules')
      .select('*')
      .eq('id', scheduleId)
      .maybeSingle();

    if (!schedule) {
      throw new Error('Échéance non trouvée');
    }

    if (schedule.status === 'paid') {
      throw new Error('Cette échéance est déjà payée');
    }

    // Récupérer le profil de facturation
    const { data: billingProfile } = await this.supabase
      .from('cimolace_billing_profiles')
      .select('*')
      .eq('id', schedule.billing_profile_id)
      .maybeSingle();

    if (!billingProfile) {
      throw new Error('Profil de facturation non trouvé');
    }

    const successUrl = options.redirectUrl || `${process.env.APP_BASE_URL}/cimolace/billing/schedule/success`;
    const cancelUrl = `${process.env.APP_BASE_URL}/cimolace/billing/schedule/cancel`;

    // Utiliser l'adapter Chariow
    const result = await createCimolaceManualMonthlyPayment({
      plan: billingProfile.plan_key,
      customer: customerData,
      successUrl,
      cancelUrl,
    });

    // Mettre à jour l'échéance avec le lien de paiement
    const { data: updatedSchedule } = await this.supabase
      .from('cimolace_payment_schedules')
      .update({
        payment_link: result.url,
        provider_payment_id: result.saleId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduleId)
      .select('*')
      .single();

    return {
      checkoutUrl: result.url,
      saleId: result.saleId,
      scheduleId: schedule.id,
      amount: schedule.amount,
      dueDate: schedule.due_date,
    };
  }

  /**
   * Récupère le statut d'un paiement
   */
  async getPaymentStatus(paymentId) {
    const { data: payment } = await this.supabase
      .from('cimolace_payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment) {
      throw new Error('Paiement non trouvé');
    }

    // Si le paiement a déjà un statut confirmé, le retourner
    if (payment.status === 'confirmed') {
      return {
        status: 'confirmed',
        paidAt: payment.paid_at,
        invoiceUrl: payment.provider_invoice_url,
        invoiceNumber: payment.invoice_number,
      };
    }

    // Utiliser l'adapter Chariow
    const statusResult = await checkCimolacePaymentStatus(payment.provider_payment_id);

    if (statusResult.status === 'confirmed') {
      // Mettre à jour le paiement dans Supabase
      await this.supabase
        .from('cimolace_payments')
        .update({
          status: 'confirmed',
          paid_at: statusResult.paidAt,
          provider_invoice_url: statusResult.invoiceUrl,
          invoice_number: statusResult.invoiceNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
    }

    return statusResult;
  }

  /**
   * Récupère le statut d'une échéance
   */
  async getScheduleStatus(scheduleId) {
    const { data: schedule } = await this.supabase
      .from('cimolace_payment_schedules')
      .select('*')
      .eq('id', scheduleId)
      .maybeSingle();

    if (!schedule) {
      throw new Error('Échéance non trouvée');
    }

    return {
      id: schedule.id,
      amount: schedule.amount,
      dueDate: schedule.due_date,
      status: schedule.status,
      paymentLink: schedule.payment_link,
      paidAt: schedule.paid_at,
    };
  }

  /**
   * Annule un checkout
   */
  async cancelCheckout(paymentId) {
    const { data: payment } = await this.supabase
      .from('cimolace_payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment) {
      throw new Error('Paiement non trouvé');
    }

    if (payment.status === 'confirmed') {
      throw new Error('Impossible d\'annuler un paiement confirmé');
    }

    await this.supabase
      .from('cimolace_payments')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    return { success: true };
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

let cimolaceCheckoutServiceInstance = null;

export function getCimolaceCheckoutService() {
  if (!cimolaceCheckoutServiceInstance) {
    cimolaceCheckoutServiceInstance = new CimolaceCheckoutService();
  }
  return cimolaceCheckoutServiceInstance;
}

export default CimolaceCheckoutService;
