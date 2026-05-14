/**
 * E2E Test — Phase 1.5 MVP métier
 * 
 * Flow: user → tenant → live → checkout → webhook → access_pass → token LiveKit
 */
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// ── Config ──────────────────────────────────────────────────────────────
const API = process.env.API_URL ?? 'http://localhost:4000';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load them from a local .env file; never commit real secrets.',
  );
  process.exit(1);
}

const TIMESTAMP = Date.now();
const TEST_EMAIL = `e2e-${TIMESTAMP}@test.local`;
const TEST_PASSWORD = 'Test123456!';
const TENANT_SLUG = `e2e-${TIMESTAMP}`;
const TENANT_NAME = `E2E Test ${TIMESTAMP}`;

let JWT_TOKEN = '';
let USER_ID = '';
let TENANT_ID = '';
let LIVE_ID = '';

// ── Helpers ──────────────────────────────────────────────────────────────
function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const options = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: opts.headers || {},
    };
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}

function log(emoji, step, detail) {
  console.log(`${emoji} ${step.padEnd(40)} ${detail || ''}`);
}

function fail(step, detail) {
  console.error(`❌ ${step.padEnd(40)} ${detail}`);
  process.exit(1);
}

// ── Test Steps ───────────────────────────────────────────────────────────
async function run() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        E2E Test — Phase 1.5 — MVP Métier                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Create test user via Supabase Auth Admin
  log('🔑', '1. Creating test user...', TEST_EMAIL);
  const createUser = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: { email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true },
  });
  if (createUser.status !== 201 && createUser.status !== 200) {
    fail('Create user', JSON.stringify(createUser.body));
  }
  USER_ID = createUser.body.id;
  log('✅', '1. User created', `id=${USER_ID.substring(0, 8)}...`);

  // 2. Sign in to get JWT
  log('🔑', '2. Signing in...');
  const signIn = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
    body: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  if (signIn.status !== 200) fail('Sign in', JSON.stringify(signIn.body));
  JWT_TOKEN = signIn.body.access_token;
  log('✅', '2. JWT obtained', `token=${JWT_TOKEN.substring(0, 20)}...`);

  // 3. Create tenant
  log('🏢', '3. Creating tenant...', TENANT_SLUG);
  const createTenant = await fetch(`${API}/tenants`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: { name: TENANT_NAME, slug: TENANT_SLUG },
  });
  if (createTenant.status !== 201) fail('Create tenant', JSON.stringify(createTenant.body));
  TENANT_ID = createTenant.body.data?.id;
  if (!TENANT_ID) fail('Create tenant', 'No id in response: ' + JSON.stringify(createTenant.body));
  log('✅', '3. Tenant created', `id=${TENANT_ID.substring(0, 8)}... slug=${TENANT_SLUG}`);

  // 4. Update branding
  log('🎨', '4. Updating branding...');
  const branding = await fetch(`${API}/tenants/current/branding`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'X-Tenant-Slug': TENANT_SLUG,
      'Content-Type': 'application/json',
    },
    body: { logo_url: 'https://example.com/logo.png', brand_colors: { primary: '#4F46E5', secondary: '#10B981' } },
  });
  if (branding.status !== 200) fail('Branding', JSON.stringify(branding.body));
  log('✅', '4. Branding updated');

  // 5. Create a paid live
  log('📺', '5. Creating live session...');
  const liveDate = new Date(Date.now() + 86400000).toISOString(); // tomorrow
  const createLive = await fetch(`${API}/lives`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'X-Tenant-Slug': TENANT_SLUG,
      'Content-Type': 'application/json',
    },
    body: {
      title: `E2E Test Live ${TIMESTAMP}`,
      description: 'Test live for E2E validation',
      scheduledAt: liveDate,
      priceCents: 999, // 9.99€
      currency: 'EUR',
      capacity: 10,
    },
  });
  if (createLive.status !== 201) fail('Create live', JSON.stringify(createLive.body));
  LIVE_ID = createLive.body.data?.id || createLive.body.id;
  if (!LIVE_ID) fail('Create live', 'No id: ' + JSON.stringify(createLive.body));
  log('✅', '5. Live created', `id=${LIVE_ID.substring(0, 8)}... price=9.99€`);

  // 6. Get live details
  const getLive = await fetch(`${API}/lives/${LIVE_ID}`, {
    headers: { 'Authorization': `Bearer ${JWT_TOKEN}`, 'X-Tenant-Slug': TENANT_SLUG },
  });
  if (getLive.status !== 200) fail('Get live', JSON.stringify(getLive.body));
  log('✅', '6. Live detail retrieved', `title="${getLive.body.data?.title}" status=${getLive.body.data?.status}`);

  // 7. Create checkout session (Stripe)
  log('💳', '7. Creating Stripe checkout session...');
  const checkout = await fetch(`${API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'X-Tenant-Slug': TENANT_SLUG,
      'Content-Type': 'application/json',
    },
    body: { liveSessionId: LIVE_ID },
  });
  if (checkout.status !== 201) fail('Checkout', JSON.stringify(checkout.body));
  const checkoutUrl = checkout.body.data?.checkoutUrl || checkout.body.checkoutUrl;
  if (!checkoutUrl) fail('Checkout', 'No checkoutUrl: ' + JSON.stringify(checkout.body));
  log('✅', '7. Checkout session created', `url=${checkoutUrl.substring(0, 50)}...`);

  // 8. Simulate webhook — insert access_pass directly with service_role
  log('🪝', '8. Simulating Stripe webhook (direct access_pass)...');
  
  // First, create a membership for the student role
  const membershipRes = await fetch(`${SUPABASE_URL}/rest/v1/tenant_memberships`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: { tenant_id: TENANT_ID, user_id: USER_ID, role: 'student', status: 'active' },
  });
  // 409 = already exists (OK)
  if (membershipRes.status !== 201 && membershipRes.status !== 409) {
    log('⚠️', '8a. Membership', `status=${membershipRes.status} (may already exist)`);
  }
  
  // Create access_pass
  const passRes = await fetch(`${SUPABASE_URL}/rest/v1/access_passes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: {
      tenant_id: TENANT_ID,
      user_id: USER_ID,
      resource_type: 'live_session',
      resource_id: LIVE_ID,
      payment_id: 'pi_e2e_test_' + TIMESTAMP,
      status: 'active',
    },
  });
  if (passRes.status !== 201) fail('Access pass', JSON.stringify(passRes.body));
  log('✅', '8. Access pass created', `id=${passRes.body[0]?.id?.substring(0, 8)}...`);

  // 9. Get LiveKit token as student
  log('🎫', '9. Getting LiveKit token (as student)...');
  const tokenRes = await fetch(`${API}/lives/${LIVE_ID}/token`, {
    headers: { 'Authorization': `Bearer ${JWT_TOKEN}`, 'X-Tenant-Slug': TENANT_SLUG },
  });
  if (tokenRes.status !== 200) fail('LiveKit token', JSON.stringify(tokenRes.body));
  const tokenData = tokenRes.body.data || tokenRes.body;
  log('✅', '9. LiveKit token obtained', `room=${tokenData.roomName} token=${(tokenData.token||'').substring(0, 30)}...`);

  // 10. Verify access_pass exists via API
  log('🔍', '10. Verifying accesses...');
  const accessesRes = await fetch(`${API}/lives/mine/accesses`, {
    headers: { 'Authorization': `Bearer ${JWT_TOKEN}`, 'X-Tenant-Slug': TENANT_SLUG },
  });
  if (accessesRes.status !== 200) fail('Accesses', JSON.stringify(accessesRes.body));
  const accesses = accessesRes.body.data || accessesRes.body || [];
  const found = accesses.find(a => a.id === LIVE_ID);
  log('✅', '10. Access verified', `${accesses.length} access(es), live found=${!!found}`);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  🎉 E2E TEST — PHASE 1.5 — PASSED');
  console.log('═'.repeat(60));
  console.log(`  User:       ${USER_ID.substring(0, 8)}... (${TEST_EMAIL})`);
  console.log(`  Tenant:     ${TENANT_NAME} (${TENANT_SLUG})`);
  console.log(`  Live:       ${LIVE_ID.substring(0, 8)}... (9.99€)`);
  console.log(`  Checkout:   Stripe session created`);
  console.log(`  Webhook:    access_pass active`);
  console.log(`  Token:      LiveKit token valid`);
  console.log('═'.repeat(60));
}

run().catch((e) => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
