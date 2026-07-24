import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Helpers Stripe « REST brut » (sans SDK) — extraits du pattern éprouvé de
 * billing.service.ts pour être réutilisés par le checkout des offres élève
 * (offering-checkout) SANS toucher billing.service (zéro régression facturation).
 *
 * Toutes les valeurs sensibles viennent de l'env (STRIPE_SECRET_KEY, *_WEBHOOK_SECRET).
 */

const STRIPE_API = 'https://api.stripe.com/v1';

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * En-tête Authorization Stripe.
 * `secretKey` optionnel : si fourni (clé du TENANT), il prime sur l'env plateforme.
 * Comportement par défaut inchangé (env) quand l'argument est omis.
 */
export function stripeAuth(secretKey?: string): string {
  return `Bearer ${secretKey || process.env.STRIPE_SECRET_KEY || ''}`;
}

/**
 * POST /v1/checkout/sessions (form-urlencoded). Renvoie { id, url }. Throw si !ok.
 * `secretKey` optionnel : clé du tenant ; défaut = STRIPE_SECRET_KEY (env), donc
 * 100 % rétro-compatible avec les appels existants qui ne le passent pas.
 */
export async function stripeCreateCheckoutSession(
  params: URLSearchParams,
  secretKey?: string,
): Promise<{ id: string; url: string }> {
  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: stripeAuth(secretKey),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Stripe Checkout error ${res.status}: ${t.slice(0, 300)}`);
  }
  return (await res.json()) as { id: string; url: string };
}

export async function stripeCreateCustomer(
  params: URLSearchParams,
  secretKey?: string,
): Promise<{ id: string; email?: string }> {
  const res = await fetch(`${STRIPE_API}/customers`, {
    method: 'POST',
    headers: {
      Authorization: stripeAuth(secretKey),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Stripe Customer error ${res.status}: ${t.slice(0, 300)}`);
  }
  return (await res.json()) as { id: string; email?: string };
}

export async function stripeCreatePaymentIntent(
  params: URLSearchParams,
  secretKey?: string,
): Promise<{ id: string; client_secret: string; status?: string }> {
  const res = await fetch(`${STRIPE_API}/payment_intents`, {
    method: 'POST',
    headers: {
      Authorization: stripeAuth(secretKey),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Stripe PaymentIntent error ${res.status}: ${t.slice(0, 300)}`);
  }
  return (await res.json()) as { id: string; client_secret: string; status?: string };
}

export async function stripeCreateProduct(
  params: URLSearchParams,
  secretKey?: string,
): Promise<{ id: string; name?: string }> {
  const res = await fetch(`${STRIPE_API}/products`, {
    method: 'POST',
    headers: {
      Authorization: stripeAuth(secretKey),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Stripe Product error ${res.status}: ${t.slice(0, 300)}`);
  }
  return (await res.json()) as { id: string; name?: string };
}

export async function stripeCreatePrice(
  params: URLSearchParams,
  secretKey?: string,
): Promise<{ id: string }> {
  const res = await fetch(`${STRIPE_API}/prices`, {
    method: 'POST',
    headers: {
      Authorization: stripeAuth(secretKey),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Stripe Price error ${res.status}: ${t.slice(0, 300)}`);
  }
  return (await res.json()) as { id: string };
}

export async function stripeCreateIncompleteSubscription(
  params: URLSearchParams,
  secretKey?: string,
): Promise<{
  id: string;
  status?: string;
  latest_invoice?: {
    id?: string;
    payment_intent?: { id: string; client_secret: string; status?: string } | string | null;
    confirmation_secret?: { client_secret?: string; type?: string } | string | null;
  } | string | null;
}> {
  const res = await fetch(`${STRIPE_API}/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: stripeAuth(secretKey),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Stripe Subscription error ${res.status}: ${t.slice(0, 300)}`);
  }
  return (await res.json()) as any;
}

/** GET /v1/subscriptions/{id} → période + statut faisant foi. null si erreur. */
export async function stripeFetchSubscription(subId: string, secretKey?: string): Promise<any | null> {
  if (!subId) return null;
  const res = await fetch(`${STRIPE_API}/subscriptions/${subId}`, {
    headers: { Authorization: stripeAuth(secretKey) },
  });
  if (!res.ok) return null;
  return res.json();
}

export function unixToIso(unix?: number | null): string | null {
  return unix ? new Date(unix * 1000).toISOString() : null;
}

/** Mappe le statut Stripe vers l'enum billing_subscriptions. */
export function mapStripeStatus(s?: string): string {
  switch (s) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'paused':
      return 'paused';
    case 'incomplete_expired':
      return 'expired';
    default:
      return 'pending';
  }
}

/**
 * Vérifie la signature Stripe (`stripe-signature: t=…,v1=…`) en HMAC-SHA256 sur
 * `${t}.${raw}`, tolérance anti-rejeu 5 min. Renvoie l'événement parsé si valide, sinon null.
 * (Copie fidèle de billing.service.ts#verifyStripeSignature.)
 */
export function verifyStripeSignature(
  payload: Buffer,
  header: string | undefined,
  secret: string,
): any | null {
  if (!header) return null;
  const parts = header.split(',').map((p) => p.trim());
  const t = parts.find((p) => p.startsWith('t='))?.slice(2);
  const v1 = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || v1.length === 0) return null;

  const ts = parseInt(t, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return null;

  const expected = createHmac('sha256', secret)
    .update(`${t}.${payload.toString('utf8')}`, 'utf8')
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const ok = v1.some((sig) => {
    let buf: Buffer;
    try {
      buf = Buffer.from(sig, 'hex');
    } catch {
      return false;
    }
    return buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf);
  });
  if (!ok) return null;

  try {
    return JSON.parse(payload.toString('utf8'));
  } catch {
    return null;
  }
}
