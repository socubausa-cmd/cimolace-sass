/**
 * POST /api/checkout/cimolace
 *
 * Gère les 3 providers de paiement : Stripe, PayPal, Chariow.
 *
 * Body :
 *   {
 *     type:     "setup" | "subscription"
 *     plan?:    "Start" | "Business" | "Entreprise"   (si type=subscription)
 *     provider: "stripe" | "paypal" | "chariow"
 *     customer?: { firstName, lastName, email, phone, phoneCountry }
 *   }
 *
 * Variables d'env à ajouter dans .env.local :
 *
 *   # Stripe
 *   STRIPE_SECRET_KEY=sk_test_...
 *   STRIPE_PRICE_SETUP=price_...
 *   STRIPE_PRICE_START=price_...
 *   STRIPE_PRICE_BUSINESS=price_...
 *   STRIPE_PRICE_ENTREPRISE=price_...
 *
 *   # PayPal
 *   PAYPAL_CLIENT_ID=...
 *   PAYPAL_CLIENT_SECRET=...
 *   PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com   # ou https://api-m.paypal.com en prod
 *
 *   # Chariow
 *   CHARIOW_API_KEY=sk_live_...
 *   CHARIOW_PRODUCT_SETUP=prd_...          # product_id boutique création 850€
 *   CHARIOW_PRODUCT_START=prd_...
 *   CHARIOW_PRODUCT_BUSINESS=prd_...
 *   CHARIOW_PRODUCT_ENTREPRISE=prd_...
 *
 *   # Général
 *   NEXT_PUBLIC_URL=https://votresite.com
 */

import { NextResponse } from "next/server";

// ─── Config ─────────────────────────────────────────────────────────────────

const STRIPE_PRICES = {
  setup:      process.env.STRIPE_PRICE_SETUP       || "price_TODO_setup",
  Start:      process.env.STRIPE_PRICE_START        || "price_TODO_start",
  Business:   process.env.STRIPE_PRICE_BUSINESS     || "price_TODO_business",
  Entreprise: process.env.STRIPE_PRICE_ENTREPRISE   || "price_TODO_entreprise",
};

const CHARIOW_PRODUCTS = {
  setup:      process.env.CHARIOW_PRODUCT_SETUP       || "prd_TODO_setup",
  Start:      process.env.CHARIOW_PRODUCT_START        || "prd_TODO_start",
  Business:   process.env.CHARIOW_PRODUCT_BUSINESS     || "prd_TODO_business",
  Entreprise: process.env.CHARIOW_PRODUCT_ENTREPRISE   || "prd_TODO_entreprise",
};

const PAYPAL_AMOUNTS = {
  setup:      { value: "850.00", currency: "EUR" },
  Start:      { value: "150.00", currency: "EUR" },
  Business:   { value: "200.00", currency: "EUR" },
  Entreprise: { value: "300.00", currency: "EUR" },
};

const BASE_URL = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function productKey(type, plan) {
  return type === "setup" ? "setup" : plan;
}

// ─── Stripe ──────────────────────────────────────────────────────────────────

async function stripeCheckout({ type, plan, successUrl, cancelUrl }) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey || secretKey.startsWith("sk_TODO")) {
    return { placeholder: true, provider: "stripe", message: "STRIPE_SECRET_KEY manquant dans .env.local" };
  }

  // Lazy import pour éviter les erreurs si le package n'est pas encore installé
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  const priceId = STRIPE_PRICES[productKey(type, plan)];
  const mode    = type === "setup" ? "payment" : "subscription";

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url:  cancelUrl,
  });

  return { url: session.url };
}

// ─── PayPal ──────────────────────────────────────────────────────────────────

async function getPayPalToken() {
  const clientId     = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const base         = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

  if (!clientId || !clientSecret) return null;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res  = await fetch(`${base}/v1/oauth2/token`, {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const json = await res.json();
  return json.access_token || null;
}

async function paypalCheckout({ type, plan, customer, successUrl, cancelUrl }) {
  const base = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

  if (!process.env.PAYPAL_CLIENT_ID) {
    return { placeholder: true, provider: "paypal", message: "PAYPAL_CLIENT_ID manquant dans .env.local" };
  }

  const token = await getPayPalToken();
  if (!token) {
    return { error: "Impossible d'obtenir un token PayPal" };
  }

  const amount = PAYPAL_AMOUNTS[productKey(type, plan)];
  const description =
    type === "setup"
      ? "CIMOLACE — Pack création boutique 850€"
      : `CIMOLACE — Abonnement ${plan}`;

  const order = await fetch(`${base}/v2/checkout/orders`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description,
          amount: { currency_code: amount.currency, value: amount.value },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: successUrl,
            cancel_url:  cancelUrl,
            brand_name:  "CIMOLACE",
            locale:      "fr-FR",
            landing_page: "LOGIN",
          },
        },
      },
      ...(customer?.email && {
        payer: {
          email_address: customer.email,
          name: {
            given_name: customer.firstName || "",
            surname:    customer.lastName  || "",
          },
          phone: customer.phone
            ? {
                phone_type:   "MOBILE",
                phone_number: { national_number: customer.phone },
              }
            : undefined,
        },
      }),
    }),
  });

  const orderData = await order.json();
  const approveLink = orderData?.links?.find((l) => l.rel === "payer-action")?.href;

  return approveLink
    ? { url: approveLink }
    : { error: "PayPal order creation failed", details: orderData };
}

// ─── Chariow ─────────────────────────────────────────────────────────────────

async function chariowCheckout({ type, plan, customer, successUrl }) {
  const apiKey = process.env.CHARIOW_API_KEY;

  if (!apiKey || apiKey.startsWith("sk_live_TODO")) {
    return { placeholder: true, provider: "chariow", message: "CHARIOW_API_KEY manquant dans .env.local" };
  }

  const productId = CHARIOW_PRODUCTS[productKey(type, plan)];

  const body = {
    product_id:   productId,
    email:        customer?.email     || "",
    first_name:   customer?.firstName || "",
    last_name:    customer?.lastName  || "",
    redirect_url: successUrl,
    custom_metadata: { type, plan, source: "cimolace-landing" },
    ...(customer?.phone && {
      phone: {
        number:       customer.phone,
        country_code: customer.phoneCountry || "FR",
      },
    }),
  };

  const res = await fetch("https://api.chariow.com/v1/checkout", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  // Gérer les différents états Chariow
  switch (data?.data?.step) {
    case "awaiting_payment":
      return { url: data.data.payment.checkout_url };
    case "completed":
      return { url: `${successUrl}?sale=${data.data.purchase?.id}` };
    case "already_purchased":
      return { url: `${successUrl}?already=1` };
    default:
      return { error: "Réponse Chariow inattendue", details: data };
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, plan, provider = "stripe", customer } = body;

    if (!type || !["setup", "subscription"].includes(type)) {
      return NextResponse.json({ error: "Paramètre type invalide" }, { status: 400 });
    }
    if (type === "subscription" && !["Start", "Business", "Entreprise"].includes(plan)) {
      return NextResponse.json({ error: "Paramètre plan invalide" }, { status: 400 });
    }

    const successUrl = `${BASE_URL}/cimolace?success=1&provider=${provider}`;
    const cancelUrl  = `${BASE_URL}/cimolace?cancelled=1`;

    let result;

    switch (provider) {
      case "paypal":
        result = await paypalCheckout({ type, plan, customer, successUrl, cancelUrl });
        break;
      case "chariow":
        result = await chariowCheckout({ type, plan, customer, successUrl });
        break;
      case "stripe":
      default:
        result = await stripeCheckout({ type, plan, successUrl, cancelUrl });
        break;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[cimolace/checkout]", err);
    return NextResponse.json({ error: "Erreur serveur", message: err.message }, { status: 500 });
  }
}
