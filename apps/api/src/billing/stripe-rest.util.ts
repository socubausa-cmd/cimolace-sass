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

export function stripeAuth(): string {
  return `Bearer ${process.env.STRIPE_SECRET_KEY ?? ''}`;
}

/** POST /v1/checkout/sessions (form-urlencoded). Renvoie { id, url }. Throw si !ok. */
export async function stripeCreateCheckoutSession(
  params: URLSearchParams,
): Promise<{ id: string; url: string }> {
  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: stripeAuth(),
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

/** GET /v1/subscriptions/{id} → période + statut faisant foi. null si erreur. */
export async function stripeFetchSubscription(subId: string): Promise<any | null> {
  if (!subId) return null;
  const res = await fetch(`${STRIPE_API}/subscriptions/${subId}`, {
    headers: { Authorization: stripeAuth() },
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
