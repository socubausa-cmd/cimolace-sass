/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE WEBHOOK HANDLER - HANDLER SPÉCIFIQUE CIMOLACE
 * ═══════════════════════════════════════════════════════════════
 */

import { getWebhookManager } from '../../../core/payments/payment-webhooks.js';
import { getSupabaseAdmin } from '../../../../netlify/functions/_lib/supabaseAdmin.js';

// ═══════════════════════════════════════════════════════════════
// CLASS CIMOLACE WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════════════

class CimolaceWebhookHandler {
  constructor() {
    this.webhookManager = getWebhookManager();
    this.supabase = getSupabaseAdmin();
  }

  /**
   * Traite un webhook Chariow pour CIMOLACE
   */
  async handleChariowWebhook(event) {
    console.log('[CimolaceWebhookHandler] Webhook reçu:', event.event_type);

    // Valider le webhook
    if (!this.webhookManager.validateChariowWebhook(event)) {
      throw new Error('Webhook invalide');
    }

    // Traiter via le webhook manager générique
    const result = await this.webhookManager.handleChariowWebhook(event);

    // Extraire les métadonnées CIMOLACE
    const cimolaceMetadata = this.webhookManager.extractCimolaceMetadata(event);

    // Traiter selon le type de paiement
    if (cimolaceMetadata.paymentType === 'setup') {
      await this.handleSetupPayment(event, cimolaceMetadata);
    } else if (cimolaceMetadata.paymentType === 'monthly') {
      await this.handleMonthlyPayment(event, cimolaceMetadata);
    }

    return result;
  }

  /**
   * Traite un paiement de setup
   */
  async handleSetupPayment(event, metadata) {
    console.log('[CimolaceWebhookHandler] Traitement paiement setup');

    const purchase = event.purchase || {};
    const payment = event.payment || {};

    // Trouver le paiement correspondant
    const { data: paymentRecord } = await this.supabase
      .from('cimolace_payments')
      .select('*')
      .eq('provider_payment_id', purchase.id)
      .eq('type', 'setup')
      .maybeSingle();

    if (!paymentRecord) {
      console.log('[CimolaceWebhookHandler] Paiement setup non trouvé');
      return;
    }

    // Mettre à jour le paiement comme confirmé
    await this.supabase
      .from('cimolace_payments')
      .update({
        status: 'confirmed',
        paid_at: payment.paid_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentRecord.id);

    // Créer ou mettre à jour le profil de facturation
    let billingProfile = await this.getBillingProfile(paymentRecord.site_id);
    
    if (!billingProfile) {
      billingProfile = await this.createBillingProfile(paymentRecord.site_id, metadata.plan);
    } else {
      billingProfile = await this.markSetupPaid(billingProfile.id);
    }

    // Créer la facture de setup
    await this.createInvoice(paymentRecord.site_id, billingProfile.id, paymentRecord.amount, 'setup');

    console.log('[CimolaceWebhookHandler] Paiement setup traité avec succès');
  }

  /**
   * Traite un paiement mensuel
   */
  async handleMonthlyPayment(event, metadata) {
    console.log('[CimolaceWebhookHandler] Traitement paiement mensuel');

    const purchase = event.purchase || {};
    const payment = event.payment || {};

    if (!metadata.paymentScheduleId) {
      console.log('[CimolaceWebhookHandler] payment_schedule_id manquant');
      return;
    }

    // Marquer l'échéance comme payée
    await this.markSchedulePaid(metadata.paymentScheduleId, purchase.id);

    // Mettre à jour la facture correspondante
    await this.updateMonthlyInvoice(metadata.paymentScheduleId);

    console.log('[CimolaceWebhookHandler] Paiement mensuel traité avec succès');
  }

  /**
   * Récupère un profil de facturation par site
   */
  async getBillingProfile(siteId) {
    const { data: profile } = await this.supabase
      .from('cimolace_billing_profiles')
      .select('*')
      .eq('site_id', siteId)
      .maybeSingle();

    return profile;
  }

  /**
   * Crée un profil de facturation
   */
  async createBillingProfile(siteId, plan) {
    const planPrices = {
      starter: 150,
      pro: 200,
      elite: 300,
    };

    const { data: profile } = await this.supabase
      .from('cimolace_billing_profiles')
      .insert({
        site_id: siteId,
        billing_mode: 'chariow_manual',
        plan_key: plan,
        monthly_amount: planPrices[plan] || 150,
        setup_status: 'paid',
        subscription_status: 'active',
        next_billing_date: this.calculateNextBillingDate(),
        metadata: {},
      })
      .select('*')
      .single();

    return profile;
  }

  /**
   * Marque le setup comme payé
   */
  async markSetupPaid(profileId) {
    const { data: profile } = await this.supabase
      .from('cimolace_billing_profiles')
      .update({
        setup_status: 'paid',
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)
      .select('*')
      .single();

    // Mettre à jour la prochaine date de facturation
    await this.supabase
      .from('cimolace_billing_profiles')
      .update({
        next_billing_date: this.calculateNextBillingDate(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);

    return profile;
  }

  /**
   * Marque une échéance comme payée
   */
  async markSchedulePaid(scheduleId, providerPaymentId) {
    await this.supabase
      .from('cimolace_payment_schedules')
      .update({
        status: 'paid',
        provider_payment_id: providerPaymentId,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduleId);
  }

  /**
   * Met à jour la facture mensuelle
   */
  async updateMonthlyInvoice(scheduleId) {
    // Récupérer l'échéance
    const { data: schedule } = await this.supabase
      .from('cimolace_payment_schedules')
      .select('*')
      .eq('id', scheduleId)
      .maybeSingle();

    if (!schedule) return;

    // Mettre à jour la facture correspondante
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    await this.supabase
      .from('cimolace_invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('billing_profile_id', schedule.billing_profile_id)
      .eq('type', 'monthly')
      .eq('status', 'pending')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());
  }

  /**
   * Crée une facture
   */
  async createInvoice(siteId, billingProfileId, amount, type) {
    const invoiceNumber = this.generateInvoiceNumber();

    await this.supabase
      .from('cimolace_invoices')
      .insert({
        site_id: siteId,
        billing_profile_id: billingProfileId,
        invoice_number: invoiceNumber,
        amount: amount,
        currency: 'EUR',
        type: type,
        status: 'paid',
        due_date: new Date().toISOString(),
        paid_at: new Date().toISOString(),
        metadata: {},
      });
  }

  /**
   * Calcule la prochaine date de facturation
   */
  calculateNextBillingDate() {
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    return nextDate.toISOString();
  }

  /**
   * Génère un numéro de facture
   */
  generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}${month}-${random}`;
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

let cimolaceWebhookHandlerInstance = null;

export function getCimolaceWebhookHandler() {
  if (!cimolaceWebhookHandlerInstance) {
    cimolaceWebhookHandlerInstance = new CimolaceWebhookHandler();
  }
  return cimolaceWebhookHandlerInstance;
}

export default CimolaceWebhookHandler;
