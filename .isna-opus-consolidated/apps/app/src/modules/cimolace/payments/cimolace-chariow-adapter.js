/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE CHARIOW ADAPTER - ADAPTEUR POUR MOTEUR CHARIOW EXISTANT
 * Utilise le moteur Chariow existant dans ISNA sans recréer un nouveau système
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Crée un paiement de setup CIMOLACE
 * Utilise le moteur Chariow existant avec le produit SETUP
 */
export async function createCimolaceSetupPayment({ customer, successUrl, cancelUrl }) {
  const apiKey = process.env.CHARIOW_API_KEY;
  const productId = process.env.CHARIOW_PRODUCT_SETUP;

  if (!apiKey || apiKey.startsWith('sk_live_TODO')) {
    throw new Error('CHARIOW_API_KEY manquant dans .env.local');
  }

  const body = {
    product_id: productId,
    email: customer?.email || '',
    first_name: customer?.firstName || '',
    last_name: customer?.lastName || '',
    redirect_url: successUrl,
    custom_metadata: {
      type: 'setup',
      source: 'cimolace-backend',
    },
    ...(customer?.phone && {
      phone: {
        number: customer.phone,
        country_code: customer.phoneCountry || 'GA',
      },
    }),
  };

  const res = await fetch('https://api.chariow.com/v1/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  // Gérer les différents états Chariow
  switch (data?.data?.step) {
    case 'awaiting_payment':
      return { url: data.data.payment.checkout_url, saleId: data.data.purchase?.id };
    case 'completed':
      return { url: `${successUrl}?sale=${data.data.purchase?.id}`, saleId: data.data.purchase?.id };
    case 'already_purchased':
      return { url: `${successUrl}?already=1`, saleId: null };
    default:
      throw new Error('Réponse Chariow inattendue', { details: data });
  }
}

/**
 * Crée un paiement mensuel manuel CIMOLACE
 * Utilise le moteur Chariow existant avec le produit correspondant au plan
 */
export async function createCimolaceManualMonthlyPayment({ plan, customer, successUrl, cancelUrl }) {
  const apiKey = process.env.CHARIOW_API_KEY;

  if (!apiKey || apiKey.startsWith('sk_live_TODO')) {
    throw new Error('CHARIOW_API_KEY manquant dans .env.local');
  }

  // Mapping des plans CIMOLACE vers les produits Chariow existants
  const planProductMap = {
    starter: process.env.CHARIOW_PRODUCT_START,
    Start: process.env.CHARIOW_PRODUCT_START,
    pro: process.env.CHARIOW_PRODUCT_BUSINESS,
    Business: process.env.CHARIOW_PRODUCT_BUSINESS,
    elite: process.env.CHARIOW_PRODUCT_ENTREPRISE,
    Entreprise: process.env.CHARIOW_PRODUCT_ENTREPRISE,
  };

  const productId = planProductMap[plan] || planProductMap['Start'];

  if (!productId) {
    throw new Error(`Produit Chariow non trouvé pour le plan: ${plan}`);
  }

  const body = {
    product_id: productId,
    email: customer?.email || '',
    first_name: customer?.firstName || '',
    last_name: customer?.lastName || '',
    redirect_url: successUrl,
    custom_metadata: {
      type: 'monthly_manual',
      plan,
      source: 'cimolace-backend',
    },
    ...(customer?.phone && {
      phone: {
        number: customer.phone,
        country_code: customer.phoneCountry || 'GA',
      },
    }),
  };

  const res = await fetch('https://api.chariow.com/v1/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  // Gérer les différents états Chariow
  switch (data?.data?.step) {
    case 'awaiting_payment':
      return { url: data.data.payment.checkout_url, saleId: data.data.purchase?.id };
    case 'completed':
      return { url: `${successUrl}?sale=${data.data.purchase?.id}`, saleId: data.data.purchase?.id };
    case 'already_purchased':
      return { url: `${successUrl}?already=1`, saleId: null };
    default:
      throw new Error('Réponse Chariow inattendue', { details: data });
  }
}

/**
 * Vérifie le statut d'un paiement Chariow
 * Utilise le moteur Chariow existant
 */
export async function checkCimolacePaymentStatus(saleId) {
  const apiKey = process.env.CHARIOW_API_KEY;

  if (!apiKey) {
    throw new Error('CHARIOW_API_KEY manquant');
  }

  const res = await fetch(`https://api.chariow.com/v1/sales/${encodeURIComponent(saleId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Erreur Chariow: ${data?.message || res.status}`);
  }

  const sale = data?.data || data;
  const status = sale?.status || 'unknown';
  const payment = sale?.payment || {};

  // Mapping des statuts Chariow vers CIMOLACE
  const statusMap = {
    completed: 'confirmed',
    settled: 'confirmed',
    failed: 'failed',
    abandoned: 'expired',
    pending: 'pending',
  };

  return {
    status: statusMap[status] || status,
    paidAt: payment?.paid_at || sale?.paid_at,
    invoiceUrl: payment?.receipt_url || payment?.invoice_url,
    invoiceNumber: payment?.reference || sale?.invoice_number,
  };
}

/**
 * Récupère les produits Chariow disponibles pour CIMOLACE
 */
export function getCimolaceChariowProducts() {
  return {
    setup: process.env.CHARIOW_PRODUCT_SETUP,
    Start: process.env.CHARIOW_PRODUCT_START,
    Business: process.env.CHARIOW_PRODUCT_BUSINESS,
    Entreprise: process.env.CHARIOW_PRODUCT_ENTREPRISE,
  };
}

export default {
  createCimolaceSetupPayment,
  createCimolaceManualMonthlyPayment,
  checkCimolacePaymentStatus,
  getCimolaceChariowProducts,
};
