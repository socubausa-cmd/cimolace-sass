/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE PAYMENT PRODUCTS - PRODUITS SPÉCIFIQUES CIMOLACE
 * ═══════════════════════════════════════════════════════════════
 */

import { getProductManager } from '../../../core/payments/payment-products.js';

// ═══════════════════════════════════════════════════════════════
// PRODUITS CIMOLACE
// ═══════════════════════════════════════════════════════════════

const CIMOLACE_PRODUCTS = {
  setup: {
    id: 'setup',
    name: 'Configuration Virtuel-Mbolo',
    description: 'Frais de configuration initiale pour votre site Virtuel-Mbolo',
    price: 500,
    currency: 'EUR',
    type: 'one_time',
    provider: 'chariow',
    providerProductId: process.env.CHARIOW_PRODUCT_SETUP,
    metadata: {
      category: 'setup',
      requiresSubscription: true,
    },
  },
  Start: {
    id: 'Start',
    name: 'Virtuel-Mbolo Starter',
    description: 'Abonnement mensuel plan Starter - Fonctionnalités essentielles',
    price: 150,
    currency: 'EUR',
    type: 'monthly_manual',
    provider: 'chariow',
    providerProductId: process.env.CHARIOW_PRODUCT_START,
    metadata: {
      category: 'subscription',
      plan: 'starter',
      features: [
        'Site e-commerce',
        'Gestion produits',
        'Paiement Chariow',
        'Support email',
      ],
    },
  },
  Business: {
    id: 'Business',
    name: 'Virtuel-Mbolo Pro',
    description: 'Abonnement mensuel plan Pro - Fonctionnalités avancées',
    price: 200,
    currency: 'EUR',
    type: 'monthly_manual',
    provider: 'chariow',
    providerProductId: process.env.CHARIOW_PRODUCT_BUSINESS,
    metadata: {
      category: 'subscription',
      plan: 'pro',
      features: [
        'Tout du plan Starter',
        'Live streaming',
        'IA Marketing',
        'Analytics avancés',
        'Support prioritaire',
      ],
    },
  },
  Entreprise: {
    id: 'Entreprise',
    name: 'Virtuel-Mbolo Elite',
    description: 'Abonnement mensuel plan Elite - Toutes les fonctionnalités',
    price: 300,
    currency: 'EUR',
    type: 'monthly_manual',
    provider: 'chariow',
    providerProductId: process.env.CHARIOW_PRODUCT_ENTREPRISE,
    metadata: {
      category: 'subscription',
      plan: 'elite',
      features: [
        'Tout du plan Pro',
        'Stockage illimité',
        'API dédiée',
        'Intégration sur mesure',
        'Account manager',
      ],
    },
  },
};

// ═══════════════════════════════════════════════════════════════
// CLASS CIMOLACE PRODUCT MANAGER
// ═══════════════════════════════════════════════════════════════

class CimolaceProductManager {
  constructor() {
    this.products = CIMOLACE_PRODUCTS;
    this.baseProductManager = getProductManager();
  }

  /**
   * Initialise les produits CIMOLACE dans le product manager de base
   */
  initializeProducts() {
    Object.values(this.products).forEach(product => {
      this.baseProductManager.upsertProduct(product);
    });
  }

  /**
   * Récupère tous les produits CIMOLACE
   */
  getCimolaceProducts() {
    return Object.values(this.products);
  }

  /**
   * Récupère un produit CIMOLACE par ID
   */
  getCimolaceProductById(productId) {
    return this.products[productId] || null;
  }

  /**
   * Récupère un produit par plan (Start, Business, Entreprise)
   */
  getCimolaceProductByPlan(plan) {
    const planMap = {
      starter: 'Start',
      pro: 'Business',
      elite: 'Entreprise',
    };
    const productId = planMap[plan] || plan;
    return this.getCimolaceProductById(productId);
  }

  /**
   * Récupère le produit de setup
   */
  getSetupProduct() {
    return this.getCimolaceProductById('setup');
  }

  /**
   * Récupère les produits d'abonnement
   */
  getSubscriptionProducts() {
    return Object.values(this.products).filter(p => p.type === 'monthly_manual');
  }

  /**
   * Récupère les fonctionnalités d'un produit
   */
  getProductFeatures(productId) {
    const product = this.getCimolaceProductById(productId);
    return product?.metadata?.features || [];
  }

  /**
   * Compare deux produits
   */
  compareProducts(productId1, productId2) {
    const product1 = this.getCimolaceProductById(productId1);
    const product2 = this.getCimolaceProductById(productId2);

    if (!product1 || !product2) {
      return null;
    }

    return {
      priceDifference: product2.price - product1.price,
      features1: product1.metadata?.features || [],
      features2: product2.metadata?.features || [],
      featuresAdded: (product2.metadata?.features || []).filter(
        f => !(product1.metadata?.features || []).includes(f)
      ),
    };
  }

  /**
   * Calcule le prix annuel d'un produit
   */
  calculateAnnualPrice(productId) {
    const product = this.getCimolaceProductById(productId);
    if (!product || product.type !== 'monthly_manual') {
      return null;
    }
    return product.price * 12;
  }

  /**
   * Calcule l'économie annuelle par rapport au plan supérieur
   */
  calculateAnnualSavings(currentPlanId, targetPlanId) {
    const currentPrice = this.getCimolaceProductById(currentPlanId)?.price || 0;
    const targetPrice = this.getCimolaceProductById(targetPlanId)?.price || 0;
    const annualDifference = (targetPrice - currentPrice) * 12;
    return annualDifference;
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

let cimolaceProductManagerInstance = null;

export function getCimolaceProductManager() {
  if (!cimolaceProductManagerInstance) {
    cimolaceProductManagerInstance = new CimolaceProductManager();
    cimolaceProductManagerInstance.initializeProducts();
  }
  return cimolaceProductManagerInstance;
}

export default CimolaceProductManager;
