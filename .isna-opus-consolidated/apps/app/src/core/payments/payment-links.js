/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE PAYMENT LINKS - GESTION DES LIENS DE PAIEMENT
 * ═══════════════════════════════════════════════════════════════
 */

import { getPaymentEngine } from './payment-engine.js';
import { getProductManager } from './payment-products.js';

// ═══════════════════════════════════════════════════════════════
// CLASS PAYMENT LINK MANAGER
// ═══════════════════════════════════════════════════════════════

class PaymentLinkManager {
  constructor() {
    this.paymentEngine = getPaymentEngine();
    this.productManager = getProductManager();
  }

  /**
   * Génère un lien de paiement pour un produit
   */
  async generatePaymentLink(productId, customerData, options = {}) {
    const product = this.productManager.getProductById(productId);
    if (!product) {
      throw new Error(`Produit ${productId} non trouvé`);
    }

    if (!product.providerProductId) {
      throw new Error(`Produit ${productId} n'a pas de providerProductId configuré`);
    }

    const checkoutRequest = {
      productId: product.providerProductId,
      customerEmail: customerData.email,
      customerName: customerData.name,
      customerPhone: customerData.phone,
      phoneCountryCode: customerData.phoneCountryCode || 'GA',
      redirectUrl: options.redirectUrl || `${process.env.APP_BASE_URL}/cimolace/billing/success`,
      customMetadata: {
        ...options.metadata,
        cimolace_product_id: productId,
        cimolace_site_id: options.siteId,
      },
      currency: product.currency,
    };

    const result = await this.paymentEngine.createCheckout(checkoutRequest);

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      checkoutUrl: result.checkoutUrl,
      saleId: result.saleId,
      productId,
    };
  }

  /**
   * Génère un lien de paiement pour le setup Virtuel-Mbolo
   */
  async generateSetupLink(customerData, options = {}) {
    return this.generatePaymentLink('virtuel_mbolo_setup', customerData, {
      ...options,
      metadata: {
        ...options.metadata,
        payment_type: 'setup',
        plan: options.plan || 'starter',
      },
    });
  }

  /**
   * Génère un lien de paiement mensuel pour un plan
   */
  async generateMonthlyLink(plan, customerData, options = {}) {
    const productId = `virtuel_mbolo_${plan}`;
    return this.generatePaymentLink(productId, customerData, {
      ...options,
      metadata: {
        ...options.metadata,
        payment_type: 'monthly',
        plan,
      },
    });
  }

  /**
   * Génère un lien de paiement pour une échéance spécifique
   */
  async generateScheduleLink(scheduleId, customerData, options = {}) {
    const product = this.productManager.getProductByPlan(options.plan || 'starter');
    if (!product) {
      throw new Error(`Plan ${options.plan} non trouvé`);
    }

    return this.generatePaymentLink(product.id, customerData, {
      ...options,
      metadata: {
        ...options.metadata,
        payment_type: 'monthly',
        payment_schedule_id: scheduleId,
      },
    });
  }

  /**
   * Valide un lien de paiement
   */
  validatePaymentLink(link) {
    if (!link || typeof link !== 'string') {
      return false;
    }
    return link.startsWith('https://pay.chariow') || link.startsWith('https://api.chariow');
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

let paymentLinkManagerInstance = null;

export function getPaymentLinkManager() {
  if (!paymentLinkManagerInstance) {
    paymentLinkManagerInstance = new PaymentLinkManager();
  }
  return paymentLinkManagerInstance;
}

export default PaymentLinkManager;
