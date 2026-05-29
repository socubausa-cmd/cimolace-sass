/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE PAYMENT WEBHOOKS - GESTION DES WEBHOOKS
 * ═══════════════════════════════════════════════════════════════
 */

import { getPaymentEngine } from './payment-engine.js';
import { getProductManager } from './payment-products.js';

// ═══════════════════════════════════════════════════════════════
// CLASS WEBHOOK MANAGER
// ═══════════════════════════════════════════════════════════════

class WebhookManager {
  constructor() {
    this.paymentEngine = getPaymentEngine();
    this.productManager = getProductManager();
  }

  /**
   * Traite un webhook Chariow
   */
  async handleChariowWebhook(event) {
    const eventType = event.event_type;
    const purchase = event.purchase || {};
    const payment = event.payment || {};
    const metadata = purchase.metadata || {};

    console.log('[WebhookManager] Webhook reçu:', eventType);

    switch (eventType) {
      case 'payment.completed':
      case 'payment.success':
        return this.handlePaymentCompleted(event);
      case 'payment.failed':
        return this.handlePaymentFailed(event);
      case 'purchase.completed':
        return this.handlePurchaseCompleted(event);
      default:
        console.log('[WebhookManager] Type d\'événement non géré:', eventType);
        return { received: true, processed: false };
    }
  }

  /**
   * Traite un paiement complété
   */
  async handlePaymentCompleted(event) {
    const purchase = event.purchase || {};
    const payment = event.payment || {};
    const metadata = purchase.metadata || {};

    const paymentType = metadata.payment_type || 'unknown';
    const cimolaceProductId = metadata.cimolace_product_id;
    const siteId = metadata.cimolace_site_id;
    const paymentScheduleId = metadata.payment_schedule_id;

    console.log('[WebhookManager] Paiement complété:', {
      type: paymentType,
      productId: cimolaceProductId,
      siteId,
      paymentScheduleId,
    });

    // Récupérer le statut du paiement
    const paymentStatus = await this.paymentEngine.getPaymentStatus(purchase.id);

    return {
      received: true,
      processed: true,
      paymentType,
      cimolaceProductId,
      siteId,
      paymentScheduleId,
      paymentStatus,
    };
  }

  /**
   * Traite un paiement échoué
   */
  async handlePaymentFailed(event) {
    const purchase = event.purchase || {};
    const metadata = purchase.metadata || {};

    console.log('[WebhookManager] Paiement échoué:', purchase.id);

    return {
      received: true,
      processed: true,
      paymentId: purchase.id,
      status: 'failed',
    };
  }

  /**
   * Traite un achat complété
   */
  async handlePurchaseCompleted(event) {
    const purchase = event.purchase || {};
    const metadata = purchase.metadata || {};

    console.log('[WebhookManager] Achat complété:', purchase.id);

    return {
      received: true,
      processed: true,
      purchaseId: purchase.id,
      metadata,
    };
  }

  /**
   * Valide un webhook Chariow
   */
  validateChariowWebhook(event) {
    return event && event.event_type && event.purchase;
  }

  /**
   * Extrait les métadonnées CIMOLACE d'un webhook
   */
  extractCimolaceMetadata(event) {
    const purchase = event.purchase || {};
    const metadata = purchase.metadata || {};

    return {
      paymentType: metadata.payment_type,
      cimolaceProductId: metadata.cimolace_product_id,
      siteId: metadata.cimolace_site_id,
      paymentScheduleId: metadata.payment_schedule_id,
      plan: metadata.plan,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

let webhookManagerInstance = null;

export function getWebhookManager() {
  if (!webhookManagerInstance) {
    webhookManagerInstance = new WebhookManager();
  }
  return webhookManagerInstance;
}

export default WebhookManager;
