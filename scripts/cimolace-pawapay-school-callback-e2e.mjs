import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

const root = process.cwd();
const env = {
  ...loadEnv(path.join(root, 'apps/app/.env')),
  ...loadEnv(path.join(root, 'apps/api/.env')),
};
const report = JSON.parse(
  fs.readFileSync('/private/tmp/cimolace-provision-school-e2e/report.json', 'utf8'),
);
const tenant = report.provisioned.tenant;
const authClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
  email: 'cimolace-admin@prorascience.local',
  password: 'CimolaceDev2026',
});
if (authError) throw authError;
const userId = authData.user?.id;
if (!userId) throw new Error('No authenticated user id for E2E');
const depositId = randomUUID();
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const now = new Date().toISOString();

const subscriptionPayload = {
  tenant_id: tenant.id,
  user_id: userId,
  plan_id: 'school_starter',
  provider: 'pawapay',
  provider_checkout_id: depositId,
  status: 'pending',
  amount_cents: 2900000,
  currency: 'XOF',
  customer_phone: '+22997000000',
  customer_phone_country: 'BEN',
  metadata: {
    source: 'e2e_pawapay_callback_simulation',
    plan: 'starter',
    tenant_slug: tenant.slug,
  },
  updated_at: now,
};
const { data: existingSubscription } = await supabase
  .from('billing_subscriptions')
  .select('id')
  .eq('tenant_id', tenant.id)
  .maybeSingle();
const sub = existingSubscription?.id
  ? await supabase
      .from('billing_subscriptions')
      .update(subscriptionPayload)
      .eq('id', existingSubscription.id)
  : await supabase
      .from('billing_subscriptions')
      .insert({ ...subscriptionPayload, created_at: now });
if (sub.error) throw sub.error;

const tx = await supabase.from('payment_transactions').insert({
  tenant_id: tenant.id,
  provider: 'pawapay',
  transaction_id: depositId,
  amount_cents: 2900000,
  currency: 'XOF',
  status: 'processing',
});
if (tx.error) throw tx.error;

const callback = {
  depositId,
  status: 'COMPLETED',
  amount: '29000',
  currency: 'XOF',
  country: 'BEN',
  providerTransactionId: `e2e-${depositId}`,
  metadata: {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    plan: 'starter',
    productType: 'school_plan',
  },
};
const res = await fetch('https://api.cimolace.space/checkout/webhook/pawapay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(callback),
});
const text = await res.text();
if (!res.ok) throw new Error(`webhook ${res.status}: ${text}`);

const { data: tenantAfter, error: tenantError } = await supabase
  .from('tenants')
  .select('id, slug, billing_status, plan, status')
  .eq('id', tenant.id)
  .single();
if (tenantError) throw tenantError;

const { data: subAfter, error: subError } = await supabase
  .from('billing_subscriptions')
  .select('provider, status, provider_checkout_id, provider_transaction_id, current_period_start, current_period_end')
  .eq('tenant_id', tenant.id)
  .maybeSingle();
if (subError) throw subError;

const { data: txAfter, error: txError } = await supabase
  .from('payment_transactions')
  .select('provider, transaction_id, amount_cents, currency, status')
  .eq('tenant_id', tenant.id)
  .eq('transaction_id', depositId)
  .maybeSingle();
if (txError) throw txError;

console.log(
  JSON.stringify(
    {
      depositId,
      webhook: JSON.parse(text),
      tenantAfter,
      subscriptionAfter: subAfter,
      transactionAfter: txAfter,
    },
    null,
    2,
  ),
);
