import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';

async function stripeRequest(path, method = 'POST', body = {}) {
  if (!STRIPE_KEY) throw new Error('STRIPE_SECRET_KEY non configuree');
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method, headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Stripe HTTP ${res.status}`);
  return data;
}

export async function runBillingRenewal() {
  console.log('[billing-worker] Running renewal cycle');
  const now = new Date().toISOString();
  const { data: subs } = await supabase.from('subscriptions')
    .select('*').eq('status', 'active').lte('current_period_end', now).limit(100);
  if (!subs?.length) { console.log('[billing-worker] No subscriptions to renew'); return 0; }

  let renewed = 0;
  for (const sub of subs) {
    try {
      // Invoice the subscription via Stripe
      if (STRIPE_KEY && sub.stripe_subscription_id) {
        const invoice = await stripeRequest('invoices', 'POST', {
          customer: sub.stripe_customer_id,
          subscription: sub.stripe_subscription_id,
          auto_advance: true,
        });
        console.log('[billing-worker] Stripe invoice created', invoice.id);
      }

      const nextPeriod = new Date(Date.now() + 30 * 86400000).toISOString();
      await supabase.from('subscriptions').update({
        status: 'active', current_period_end: nextPeriod, updated_at: now,
      }).eq('id', sub.id);

      // Log the renewal event
      await supabase.from('billing_events').insert({
        tenant_id: sub.tenant_id, subscription_id: sub.id,
        stripe_event_id: 'renewal_' + Date.now() + '_' + sub.id.slice(0, 8),
        event_type: 'subscription_renewed', payload: { subscription_id: sub.id },
        processed: true, processed_at: now,
      });

      renewed++;
    } catch (e) {
      console.error('[billing-worker] Renewal failed', sub.id, e.message);
      await supabase.from('billing_events').insert({
        tenant_id: sub.tenant_id, subscription_id: sub.id,
        stripe_event_id: 'renewal_failed_' + Date.now(), event_type: 'renewal_failed',
        payload: { error: e.message }, processed: false, retry_count: 0,
      });
    }
  }
  console.log('[billing-worker] Renewed', renewed, '/', subs.length, 'subscriptions');
  return renewed;
}

export async function processDLQ() {
  console.log('[billing-worker] Processing DLQ');
  const { data: events } = await supabase.from('billing_events')
    .select('*').eq('processed', false).lt('retry_count', 5).order('created_at').limit(20);
  if (!events?.length) { console.log('[billing-worker] DLQ empty'); return 0; }

  let processed = 0;
  for (const evt of events) {
    try {
      // Exponential backoff: retry_count 0 = 1min, 1 = 5min, 2 = 25min, 3 = 2h, 4 = 12h
      const delays = [60, 300, 1500, 7200, 43200];
      const createdAt = new Date(evt.created_at).getTime();
      const minWait = (delays[evt.retry_count || 0] || 86400) * 1000;
      if (Date.now() - createdAt < minWait) continue; // Not ready yet

      if (evt.event_type === 'renewal_failed' && STRIPE_KEY) {
        // Retry Stripe charge
        const sub = await supabase.from('subscriptions').select('*').eq('id', evt.subscription_id).single();
        if (sub.data?.stripe_subscription_id) {
          await stripeRequest('invoices', 'POST', {
            customer: sub.data.stripe_customer_id,
            subscription: sub.data.stripe_subscription_id,
            auto_advance: true,
          });
        }
      }

      await supabase.from('billing_events').update({
        processed: true, processed_at: new Date().toISOString(),
        retry_count: (evt.retry_count || 0) + 1,
      }).eq('id', evt.id);
      processed++;
    } catch (e) {
      await supabase.from('billing_events').update({
        retry_count: (evt.retry_count || 0) + 1,
        error: e.message,
      }).eq('id', evt.id);
    }
  }
  console.log('[billing-worker] DLQ processed', processed, '/', events.length, 'events');
  return processed;
}
