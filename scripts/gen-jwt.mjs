import fs from 'fs';
import https from 'https';
import path from 'path';

const envFiles = ['.env', 'apps/api/.env', 'apps/app/.env'];

for (const file of envFiles) {
  const fullPath = path.resolve(file);
  if (!fs.existsSync(fullPath)) continue;

  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const [rawKey, ...rawValueParts] = trimmed.split('=');
    const key = rawKey.trim();
    if (process.env[key]) continue;

    const value = rawValueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.MEDOS_DEMO_EMAIL;
const password = process.env.MEDOS_DEMO_PASSWORD;

const missing = [
  ['SUPABASE_URL or VITE_SUPABASE_URL', supabaseUrl],
  ['SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY', supabaseAnonKey],
  ['MEDOS_DEMO_EMAIL', email],
  ['MEDOS_DEMO_PASSWORD', password],
].filter(([, value]) => !value);

if (missing.length > 0) {
  console.error('Missing required environment variables:');
  for (const [name] of missing) console.error(`- ${name}`);
  console.error('');
  console.error('Example:');
  console.error('MEDOS_DEMO_EMAIL="user@example.com" MEDOS_DEMO_PASSWORD="password" node scripts/gen-jwt.mjs');
  process.exit(1);
}

const { hostname, pathname } = new URL(supabaseUrl);
const data = JSON.stringify({
  email,
  password,
  gotrue_meta_security: {},
});

const options = {
  hostname,
  path: `${pathname.replace(/\/$/, '')}/auth/v1/token?grant_type=password`,
  method: 'POST',
  headers: {
    apikey: supabaseAnonKey,
    'Content-Type': 'application/json',
  },
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      console.error(`ERROR: Supabase returned non-JSON response (${res.statusCode})`);
      console.error(body);
      process.exit(1);
    }

    if (parsed.access_token) {
      console.log(`ACCESS_TOKEN=${parsed.access_token}`);
      console.log(`EXPIRES_AT=${parsed.expires_at ? new Date(parsed.expires_at * 1000).toISOString() : 'N/A'}`);
      console.log(`USER_ID=${parsed.user?.id || 'N/A'}`);
      console.log(`ROLE=${parsed.user?.role || 'N/A'}`);
      return;
    }

    console.error(`ERROR: Supabase authentication failed (${res.statusCode})`);
    console.error(JSON.stringify(parsed, null, 2));
    process.exit(1);
  });
});

req.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

req.write(data);
req.end();
