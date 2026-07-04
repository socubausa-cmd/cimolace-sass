#!/usr/bin/env node
/* Forge une session Supabase de TEST (JWT HS256 signé avec SUPABASE_JWT_SECRET
   de .env.production) pour rendre les écrans authentifiés en dev. Écrit le JS
   d'injection dans scratchpad/inject.js. NE PAS committer d'usage prod. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function b64url(x) { return Buffer.from(x).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function loadSecret() {
  const raw = fs.readFileSync(path.resolve(__dirname, '../../.env.production'), 'utf8');
  for (const line of raw.split('\n')) { const m = line.match(/^SUPABASE_JWT_SECRET=(.*)$/); if (m) return m[1].trim().replace(/^["']|["']$/g, ''); }
  throw new Error('SUPABASE_JWT_SECRET introuvable');
}
const args = process.argv.slice(2);
const user = args[args.indexOf('--user') + 1];
const email = args[args.indexOf('--email') + 1] || 'eleve.test@isna.fr';
const outIdx = args.indexOf('--out');
const outFile = (outIdx >= 0 && args[outIdx + 1]) || '/private/tmp/claude-501/-Users-ngowazulu-Projects-toteme-core/e8af277c-2e4c-4305-8315-bf73f73a3e16/scratchpad/inject.js';
// --tenant-role : injecte app_metadata.tenant_role (décodé par SupabaseAuthContext →
// tenantRole résolu) pour tester les vues résolues par rôle (élève/owner) en dev.
const triIdx = args.indexOf('--tenant-role');
const tenantRole = (triIdx >= 0 && args[triIdx + 1]) || '';
const appMeta = tenantRole ? { provider: 'email', tenant_role: tenantRole } : { provider: 'email' };
const secret = loadSecret();
const now = Math.floor(Date.now() / 1000);
const exp = now + 60 * 60 * 12;
const header = { alg: 'HS256', typ: 'JWT' };
const payload = { aud: 'authenticated', role: 'authenticated', sub: user, email, app_metadata: appMeta, exp, iat: now, iss: 'https://fwfupxvmwtxbtbjdeqvu.supabase.co/auth/v1' };
const data = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
const sig = crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = data + '.' + sig;
const user_obj = { id: user, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'email' }, user_metadata: { full_name: 'Élève Test' }, created_at: new Date(now * 1000).toISOString() };
const session = { access_token: jwt, token_type: 'bearer', expires_in: 60 * 60 * 12, expires_at: exp, refresh_token: 'dev-review', user: user_obj };
const inject = `(async()=>{const c=window.__isnaV2SupabaseClient;if(!c)return 'no-client';try{await c.auth.setSession({access_token:${JSON.stringify(jwt)},refresh_token:'dev-review'});}catch(e){return 'setSession-err:'+(e&&e.message);}try{localStorage.setItem('sb-fwfupxvmwtxbtbjdeqvu-auth-token',${JSON.stringify(JSON.stringify(session))});}catch(e){}return 'ok';})()`;
fs.writeFileSync(outFile, inject);
console.log('minted for', user, '(jwt len', jwt.length + ')');
