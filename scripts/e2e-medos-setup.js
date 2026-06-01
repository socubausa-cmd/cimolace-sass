const fs = require('fs');
const https = require('https');
const path = require('path');

for (const file of ['.env', 'apps/api/.env']) {
  const fullPath = path.resolve(file);
  if (!fs.existsSync(fullPath)) continue;

  for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const [rawKey, ...rawValueParts] = trimmed.split('=');
    const key = rawKey.trim();
    if (process.env[key]) continue;

    process.env[key] = rawValueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testPassword = process.env.MEDOS_E2E_PASSWORD;

const missing = [
  ['SUPABASE_URL', supabaseUrl],
  ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey],
  ['MEDOS_E2E_PASSWORD', testPassword],
].filter(([, value]) => !value);

if (missing.length > 0) {
  console.error('Missing required environment variables:');
  for (const [name] of missing) console.error(`- ${name}`);
  console.error('');
  console.error('Example:');
  console.error('MEDOS_E2E_PASSWORD="strong-test-password" node scripts/e2e-medos-setup.js');
  process.exit(1);
}

const { hostname } = new URL(supabaseUrl);

function supabaseAdmin(method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname,
      path: requestPath,
      method,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function createUser(role, suffix) {
  const user = await supabaseAdmin('POST', '/auth/v1/admin/users', {
    email: `medos-${role}-${suffix}@e2e.test`,
    password: testPassword,
    email_confirm: true,
    user_metadata: { role },
  });

  console.log(`${role.toUpperCase()}:`, JSON.stringify({ id: user.data?.id, email: user.data?.email }));
}

async function main() {
  const suffix = Date.now();

  await createUser('practitioner', suffix);
  await createUser('receptionist', suffix);
  await createUser('patient', suffix);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
