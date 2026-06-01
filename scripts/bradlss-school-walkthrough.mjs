import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const ORIGIN = process.env.CIMOLACE_WALKTHROUGH_ORIGIN || 'http://127.0.0.1:5173';
const API = process.env.CIMOLACE_WALKTHROUGH_API || 'http://localhost:4002';
const OUT_DIR = '/private/tmp/bradlss-school-walkthrough';
const EMAIL = 'cimolace-admin@prorascience.local';
const PASSWORD = 'CimolaceDev2026';
const TENANT_SLUG = 'bradlss-scolle';

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${url} -> ${res.status}: ${text}`);
  return body?.data ?? body;
}

function supabaseStorageKey(url) {
  const host = new URL(url).host;
  const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : host;
  return `sb-${ref}-auth-token`;
}

async function connectCdp(port, targetOrigin) {
  let pages;
  for (let i = 0; i < 80; i += 1) {
    try {
      pages = await requestJson(`http://127.0.0.1:${port}/json/list`);
      break;
    } catch {
      await delay(100);
    }
  }
  const page =
    pages?.find((target) => target.type === 'page' && target.url?.startsWith(targetOrigin)) ||
    pages?.find((target) => target.type === 'page') ||
    pages?.[0];
  if (!page?.webSocketDebuggerUrl) throw new Error('Chrome page CDP unavailable');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  const send = (method, params = {}) => {
    id += 1;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };

  return { ws, send };
}

async function apiFetch(pathname, token, init = {}) {
  return requestJson(`${API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function ensureSchool(token) {
  const existing = await apiFetch('/cimolace-backoffice/clients', token);
  const rows = Array.isArray(existing) ? existing : [];
  const found = rows.find(
    (client) => client.portal_slug === TENANT_SLUG || client.name === 'BRADLSS Scolle',
  );
  if (found?.id) return { client: found, created: false };

  const payload = {
    name: 'BRADLSS Scolle',
    slug: TENANT_SLUG,
    owner_email: 'owner@bradlss.school',
    business_name: 'BRADLSS Scolle Academy',
    domain: 'school.bradlss.com',
    plan: 'school',
    logo_url: 'https://dummyimage.com/256x256/111827/d4af37&text=B',
    favicon_url: 'https://dummyimage.com/64x64/111827/d4af37&text=B',
    contact_email: 'contact@bradlss.school',
    brand_colors: {
      primary: '#101828',
      secondary: '#1f2937',
      accent: '#d4af37',
    },
    font_family: 'Inter, system-ui, sans-serif',
    radius: '10px',
    branding_zones: {
      header: true,
      footer: true,
      publicVitrine: true,
      memberApp: true,
      liveStudio: true,
      adminBackoffice: true,
    },
    reason: 'Création guidée BRADLSS Scolle depuis le modèle ISNA Prorascience',
  };

  const preview = await apiFetch('/cimolace-backoffice/provision-school/preview', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const provisioned = await apiFetch('/cimolace-backoffice/provision-school', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { ...provisioned, preview, created: true, payload };
}

async function ensureTenantMembership(env, tenantId, userId) {
  if (!tenantId || !userId) return null;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service credentials missing for tenant membership proof');
  }
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await adminClient
    .from('tenant_memberships')
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        role: 'owner',
        status: 'active',
      },
      { onConflict: 'tenant_id,user_id' },
    )
    .select('tenant_id, user_id, role, status')
    .single();
  if (error) throw error;
  return data;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const env = {
    ...loadEnv(path.join(ROOT, 'apps/app/.env')),
    ...loadEnv(path.join(ROOT, 'apps/app/.env.local')),
    ...loadEnv(path.join(ROOT, 'apps/api/.env')),
  };

  await requestJson(`${API}/health`);
  await fetch(`${ORIGIN}/cimolace/login`, { method: 'HEAD' });

  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('No Cimolace admin token');

  const school = await ensureSchool(token);
  const clientId = school.client?.id ?? school.provisioned?.client?.id ?? school.client_id;
  const tenantId = school.tenant?.id ?? school.client?.tenant_id;
  const membership = await ensureTenantMembership(env, tenantId, data.user?.id);
  const controlPlane = clientId
    ? await apiFetch(`/cimolace-backoffice/clients/${clientId}/control-plane`, token)
    : null;

  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const port = 9633 + Math.floor(Math.random() * 300);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bradlss-chrome-'));
  const proc = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${port}`,
      '--window-size=1440,1000',
      `${ORIGIN}/cimolace/login`,
    ],
    { stdio: 'ignore' },
  );

  const shots = [];
  try {
    const cdp = await connectCdp(port, ORIGIN);
    const { send } = cdp;
    await send('Page.enable');
    await send('Network.enable');
    await send('Runtime.enable');
    const persistedSession = JSON.stringify({
      currentSession: data.session,
      expiresAt: data.session?.expires_at,
    });
    const authKey = supabaseStorageKey(env.VITE_SUPABASE_URL);

    const screenshot = async (name, label) => {
      await delay(1200);
      const pageState = await send('Runtime.evaluate', {
        expression: `(async () => {
          const token = localStorage.getItem('isna-v2-debug-api-bearer') || '';
          let mine = null;
          try {
            const res = await fetch(${JSON.stringify(API)} + '/tenants/mine', {
              headers: {
                Authorization: 'Bearer ' + token,
                'X-Tenant-Slug': localStorage.getItem('isna-v2-tenant-slug') || localStorage.getItem('tenantSlug') || ''
              }
            });
            mine = { ok: res.ok, status: res.status, body: (await res.text()).slice(0, 600) };
          } catch (error) {
            mine = { ok: false, error: String(error?.message || error) };
          }
          return JSON.stringify({
            href: location.href,
            pathname: location.pathname,
            title: document.title,
            text: document.body?.innerText?.slice(0, 800) || '',
            hasApiToken: Boolean(token),
            tenantSlug: localStorage.getItem('isna-v2-tenant-slug') || localStorage.getItem('tenantSlug') || '',
            mine
          });
        })()`,
        awaitPromise: true,
        returnByValue: true,
      }).catch(() => ({ result: { value: '{}' } }));
      const { data: png } = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
      });
      const file = path.join(OUT_DIR, `${name}.png`);
      fs.writeFileSync(file, Buffer.from(png, 'base64'));
      const state = JSON.parse(pageState?.result?.value || '{}');
      shots.push({ name, label, file, state });
      return file;
    };

    const setAuth = async () => {
      await send('Runtime.evaluate', {
        expression: `
          localStorage.setItem(${JSON.stringify(authKey)}, ${JSON.stringify(persistedSession)});
          localStorage.setItem('isna-v2-debug-api-bearer', ${JSON.stringify(token)});
          localStorage.setItem('isna-v2-tenant-slug', ${JSON.stringify(TENANT_SLUG)});
          localStorage.setItem('tenantSlug', ${JSON.stringify(TENANT_SLUG)});
          localStorage.setItem('selectedTenantSlug', ${JSON.stringify(TENANT_SLUG)});
          true;
        `,
      });
    };

    const goto = async (pathname, name, label, wait = 3000) => {
      await setAuth();
      await send('Page.navigate', { url: `${ORIGIN}${pathname}` });
      await delay(wait);
      await setAuth();
      await delay(500);
      return screenshot(name, label);
    };

    const loginCimolaceOperator = async () => {
      await setAuth();
      await send('Runtime.evaluate', {
        expression: `
          (() => {
            const form = document.querySelector('[data-cimolace-login-form]');
            if (!form) return false;
            const setValue = (input, value) => {
              const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value')?.set;
              setter ? setter.call(input, value) : input.value = value;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            };
            setValue(form.elements.email, ${JSON.stringify(EMAIL)});
            setValue(form.elements.password, ${JSON.stringify(PASSWORD)});
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            return true;
          })()
        `,
        awaitPromise: true,
        returnByValue: true,
      });
      await delay(3500);
      await setAuth();
    };

    await goto('/cimolace/login', '01-cimolace-login', 'Connexion Cimolace');
    await loginCimolaceOperator();
    await goto('/cimolace/admin/school-provisioning', '02-school-builder-empty', 'Constructeur infrastructure école');
    await send('Runtime.evaluate', {
      expression: `
        function setByPlaceholder(placeholder, value) {
          const input = [...document.querySelectorAll('input, textarea')]
            .find((el) => el.getAttribute('placeholder') === placeholder);
          if (!input) return false;
          const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value')?.set;
          setter ? setter.call(input, value) : input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        setByPlaceholder('École Fatima', 'BRADLSS Scolle');
        setByPlaceholder('ecole-fatima', ${JSON.stringify(TENANT_SLUG)});
        setByPlaceholder('admin@ecole.org', 'owner@bradlss.school');
        setByPlaceholder('École Fatima SARL', 'BRADLSS Scolle Academy');
        setByPlaceholder('ecole.prorascience.org', 'school.bradlss.com');
        setByPlaceholder('contact@ecole.org', 'contact@bradlss.school');
        setByPlaceholder('Création depuis le modèle ISNA Prorascience', 'Création guidée BRADLSS Scolle');
        true;
      `,
    });
    await screenshot('03-school-builder-filled', 'Constructeur rempli BRADLSS');
    await send('Runtime.evaluate', {
      expression: `
        [...document.querySelectorAll('button')]
          .find((button) => button.textContent.trim() === 'Prévisualiser')
          ?.click();
        true;
      `,
    });
    await delay(4000);
    await screenshot('04-school-builder-preview', 'Prévisualisation moteurs et branding');

    if (clientId) {
      await goto(`/cimolace/admin/clients/${clientId}`, '05-cimolace-client-control', 'Control plane Cimolace du tenant');
    }
    await goto(`/t/${TENANT_SLUG}`, '06-tenant-public-home', 'Vitrine publique école');
    await goto(`/t/${TENANT_SLUG}/courses`, '07-tenant-public-courses', 'Catalogue public école');
    await goto(`/t/${TENANT_SLUG}/login`, '08-tenant-login', 'Connexion membre école');
    await goto(`/t/${TENANT_SLUG}/signup`, '09-tenant-signup', 'Inscription membre école');
    await goto(`/t/${TENANT_SLUG}/admin`, '10-owner-admin-dashboard', 'Tableau de bord propriétaire/admin');
    await goto(`/t/${TENANT_SLUG}/admin/settings`, '11-owner-branding-settings', 'Configuration branding et tenant');
    await goto(`/t/${TENANT_SLUG}/admin/billing`, '12-owner-billing', 'Facturation abonnement école');
    await goto(`/t/${TENANT_SLUG}/admin/courses`, '13-admin-courses', 'Gestion formations');
    await goto(`/t/${TENANT_SLUG}/admin/students`, '14-admin-students', 'Gestion élèves');
    await goto(`/t/${TENANT_SLUG}/admin/lives`, '15-admin-lives', 'LIRI Live admin');
    await goto(`/t/${TENANT_SLUG}/admin/smartboard`, '16-admin-smartboard', 'SmartBoard Designer');
    await goto(`/t/${TENANT_SLUG}/admin/studio`, '17-admin-studio', 'Studio Creator');
    await goto('/teacher-space/dashboard', '18-teacher-dashboard', 'Vue professeur dashboard');
    await goto('/teacher-space/live', '19-teacher-live', 'Vue professeur sessions live');
    await goto('/student-school-life/dashboard', '20-student-dashboard', 'Vue élève dashboard');
    await goto('/student-school-life/agenda', '21-student-agenda', 'Vue élève agenda');
    await goto('/student-school-life/documents', '22-student-documents', 'Vue élève documents');

    cdp.ws.close();
  } finally {
    proc.kill('SIGTERM');
  }

  const report = {
    tenantSlug: TENANT_SLUG,
    tenantId,
    clientId,
    membership,
    created: Boolean(school.created),
    school,
    controlPlane: controlPlane
      ? {
          client: controlPlane.client,
          tenant: controlPlane.appTenant,
          servicesCount: controlPlane.services?.length ?? 0,
          providers: controlPlane.providers,
          diagnostics: controlPlane.diagnostics,
        }
      : null,
    shots,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
