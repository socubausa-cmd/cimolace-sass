/**
 * Helpers REST PayPal Orders v2 (sans SDK) — mêmes principes que stripe-rest.util :
 * appels serveur-à-serveur, credentials DU TENANT (sinon env plateforme), montant
 * TOUJOURS calculé serveur. Flux : OAuth client_credentials → create order (CAPTURE)
 * → l'acheteur approuve sur PayPal → capture → fulfillment (membership/reçu).
 */

export type PaypalMode = 'sandbox' | 'live';

export interface PaypalCreds {
  clientId: string;
  clientSecret: string;
  mode: PaypalMode;
}

/** Normalise le mode PayPal ('live' | 'production' → live ; tout le reste → sandbox). */
export function normalizePaypalMode(mode?: string | null): PaypalMode {
  const m = String(mode || '').toLowerCase();
  return m === 'live' || m === 'production' ? 'live' : 'sandbox';
}

/** Base API PayPal selon le mode (sandbox par défaut : jamais de débit réel par erreur). */
export function paypalBaseUrl(mode?: string | null): string {
  return normalizePaypalMode(mode) === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/** Résout les creds PayPal effectifs : tenant si présents, sinon env plateforme. Null si aucun. */
export function resolvePaypalCreds(
  tenantCreds: { creds?: Record<string, string>; mode?: string | null } | null,
): PaypalCreds | null {
  const tClient = tenantCreds?.creds?.client_id;
  const tSecret = tenantCreds?.creds?.client_secret;
  if (tClient && tSecret) {
    return {
      clientId: tClient,
      clientSecret: tSecret,
      mode: normalizePaypalMode(tenantCreds?.mode),
    };
  }
  const eClient = process.env.PAYPAL_CLIENT_ID;
  const eSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (eClient && eSecret) {
    return {
      clientId: eClient,
      clientSecret: eSecret,
      mode: normalizePaypalMode(process.env.PAYPAL_MODE),
    };
  }
  return null;
}

/** Jeton d'accès OAuth (client_credentials). Lève sur échec (creds invalides / réseau). */
export async function paypalAccessToken(creds: PaypalCreds): Promise<string> {
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
  const res = await fetch(`${paypalBaseUrl(creds.mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`PayPal OAuth ${res.status}: ${t.slice(0, 200)}`);
  }
  const data: any = await res.json();
  if (!data?.access_token) throw new Error('PayPal OAuth: access_token manquant');
  return data.access_token as string;
}

/**
 * Crée un ordre PayPal (intent CAPTURE). Montant en CENTIMES → converti en unité
 * majeure avec 2 décimales. `customId` = notre référence (deposit id) relue à la capture.
 * Renvoie { id, approveUrl }.
 */
export async function paypalCreateOrder(
  creds: PaypalCreds,
  accessToken: string,
  opts: {
    amountCents: number;
    currency: string;
    description: string;
    customId: string;
    returnUrl: string;
    cancelUrl: string;
    brandName?: string;
  },
): Promise<{ id: string; approveUrl: string | null }> {
  const value = (opts.amountCents / 100).toFixed(2);
  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: { currency_code: String(opts.currency || 'EUR').toUpperCase(), value },
        description: opts.description.slice(0, 127),
        custom_id: opts.customId.slice(0, 127),
      },
    ],
    application_context: {
      brand_name: (opts.brandName || 'PRORASCIENCE').slice(0, 127),
      user_action: 'PAY_NOW',
      return_url: opts.returnUrl,
      cancel_url: opts.cancelUrl,
      shipping_preference: 'NO_SHIPPING',
    },
  };
  const res = await fetch(`${paypalBaseUrl(creds.mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`PayPal createOrder ${res.status}: ${t.slice(0, 240)}`);
  }
  const data: any = await res.json();
  const approve = Array.isArray(data?.links)
    ? data.links.find((l: any) => l?.rel === 'approve')?.href ?? null
    : null;
  return { id: String(data.id), approveUrl: approve };
}

/**
 * Capture un ordre approuvé. Renvoie { status, captureId, amountCents, currency }.
 * status attendu = 'COMPLETED' pour accorder l'accès. Idempotent côté PayPal
 * (une 2e capture d'un ordre déjà capturé renvoie 422 ORDER_ALREADY_CAPTURED —
 * on le traite comme un succès déjà acquis).
 */
export async function paypalCaptureOrder(
  creds: PaypalCreds,
  accessToken: string,
  orderId: string,
): Promise<{ status: string; captureId: string | null; amountCents: number | null; currency: string | null }> {
  const res = await fetch(`${paypalBaseUrl(creds.mode)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const alreadyCaptured =
      res.status === 422 &&
      JSON.stringify(data || {}).includes('ORDER_ALREADY_CAPTURED');
    if (alreadyCaptured) {
      return { status: 'COMPLETED', captureId: null, amountCents: null, currency: null };
    }
    throw new Error(`PayPal capture ${res.status}: ${JSON.stringify(data).slice(0, 240)}`);
  }
  const cap = data?.purchase_units?.[0]?.payments?.captures?.[0] ?? null;
  const amt = cap?.amount?.value != null ? Math.round(Number(cap.amount.value) * 100) : null;
  return {
    status: String(data?.status || cap?.status || 'UNKNOWN').toUpperCase(),
    captureId: cap?.id ?? null,
    amountCents: amt,
    currency: cap?.amount?.currency_code ?? null,
  };
}
