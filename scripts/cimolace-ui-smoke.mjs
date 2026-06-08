import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const ORIGIN = process.env.CIMOLACE_SMOKE_ORIGIN || 'http://localhost:5173';
const OUT_DIR = '/private/tmp/cimolace-ui-smoke';
const EMAIL = 'cimolace-admin@prorascience.local';
const PASSWORD = 'CimolaceDev2026';

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

const env = {
  ...loadEnv(path.join(ROOT, 'apps/app/.env')),
  ...loadEnv(path.join(ROOT, 'apps/app/.env.local')),
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function supabaseStorageKey() {
  try {
    const host = new URL(env.VITE_SUPABASE_URL).host;
    const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : host;
    return `sb-${ref}-auth-token`;
  } catch {
    return 'sb-local-auth-token';
  }
}

async function requestJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function assertHttpReachable(url) {
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) throw new Error(`${url} unreachable -> ${res.status}`);
}

async function connectCdp(port) {
  let pages;
  for (let i = 0; i < 50; i += 1) {
    try {
      pages = await requestJson(`http://127.0.0.1:${port}/json/list`);
      break;
    } catch {
      await delay(100);
    }
  }
  const page =
    pages?.find((target) => target.type === 'page' && target.url?.startsWith(ORIGIN)) ||
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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await assertHttpReachable(`${ORIGIN}/cimolace/login`);

  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw error;
  const persistedSession = JSON.stringify({
    currentSession: data.session,
    expiresAt: data.session?.expires_at,
  });

  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const port = 9333 + Math.floor(Math.random() * 300);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cimolace-chrome-'));
  const proc = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    '--window-size=1440,1000',
    `${ORIGIN}/cimolace/login`,
  ], { stdio: 'ignore' });

  try {
    const cdp = await connectCdp(port);
    const { send } = cdp;
    const events = [];
    cdp.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.method === 'Runtime.consoleAPICalled') {
        events.push({
          type: 'console',
          level: message.params.type,
          text: message.params.args?.map((arg) => arg.value || arg.description || '').join(' '),
        });
      }
      if (message.method === 'Runtime.exceptionThrown') {
        events.push({
          type: 'exception',
          text: message.params.exceptionDetails?.text,
          description: message.params.exceptionDetails?.exception?.description,
        });
      }
      if (message.method === 'Network.loadingFailed') {
        events.push({
          type: 'network-failed',
          url: message.params.requestId,
          errorText: message.params.errorText,
        });
      }
    });
    await send('Page.enable');
    await send('Network.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: `${ORIGIN}/cimolace/login` });
    await delay(2000);

    const screenshot = async (name) => {
      await delay(700);
      const { data: png } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      const file = path.join(OUT_DIR, `${name}.png`);
      fs.writeFileSync(file, Buffer.from(png, 'base64'));
      return file;
    };

    await delay(1000);
    const loginShot = await screenshot('01-login');

    await send('Runtime.evaluate', {
      expression: `
        const email = document.querySelector('input[name=email]');
        const password = document.querySelector('input[name=password]');
        email.value = ${JSON.stringify(EMAIL)};
        password.value = ${JSON.stringify(PASSWORD)};
        email.dispatchEvent(new Event('input', { bubbles: true }));
        password.dispatchEvent(new Event('input', { bubbles: true }));
        true;
      `,
    });
    const filledShot = await screenshot('02-login-filled');

    await send('Runtime.evaluate', {
      expression: `
        document.querySelector('[data-cimolace-login-form]').requestSubmit();
        true;
      `,
    });
    await delay(12000);
    await send('Runtime.evaluate', {
      expression: `
        if (location.pathname === '/cimolace/login') {
          localStorage.setItem(${JSON.stringify(supabaseStorageKey())}, ${JSON.stringify(persistedSession)});
          localStorage.setItem('isna-v2-debug-api-bearer', ${JSON.stringify(data.session?.access_token || '')});
          localStorage.setItem('isna-v2-tenant-slug', 'isna');
          localStorage.setItem('tenantSlug', 'isna');
          location.assign('/cimolace/admin');
        }
        true;
      `,
    });
    await delay(5000);
    const adminShot = await screenshot('03-admin');

    await send('Runtime.evaluate', {
      expression: `
        [...document.querySelectorAll('a')]
          .find((a) => a.href.endsWith('/cimolace/admin/clients'))
          ?.click();
        true;
      `,
    });
    await delay(12000);
    const clientsShot = await screenshot('04-clients');

    const clickSidebar = async (suffix, name) => {
      await send('Runtime.evaluate', {
        expression: `
          const target = [...document.querySelectorAll('a')]
            .find((a) => a.href.endsWith(${JSON.stringify(suffix)}));
          if (target) target.click();
          else location.assign(${JSON.stringify(`${ORIGIN}`)} + ${JSON.stringify(suffix)});
          true;
        `,
      });
      await delay(3000);
      return screenshot(name);
    };

    const sitesShot = await clickSidebar('/cimolace/admin/sites', '05-sites');
    const schoolProvisioningShot = await clickSidebar('/cimolace/admin/school-provisioning', '06-school-provisioning');
    const previewSlug = `ecole-smoke-${Date.now()}`;
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
        setByPlaceholder('École Fatima', 'École Smoke');
        setByPlaceholder('ecole-fatima', ${JSON.stringify(previewSlug)});
        setByPlaceholder('admin@ecole.org', 'owner-smoke@example.test');
        setByPlaceholder('École Fatima SARL', 'École Smoke SARL');
        setByPlaceholder('ecole.prorascience.org', ${JSON.stringify(`${previewSlug}.prorascience.org`)});
        setByPlaceholder('contact@ecole.org', 'contact-smoke@example.test');
        setByPlaceholder('Création depuis le modèle ISNA Prorascience', 'Smoke test preview only');
        true;
      `,
    });
    await delay(500);
    await send('Runtime.evaluate', {
      expression: `
        [...document.querySelectorAll('button')]
          .find((button) => button.textContent.trim() === 'Prévisualiser')
          ?.click();
        true;
      `,
    });
    await delay(5000);
    const schoolProvisioningPreviewShot = await screenshot('06-school-provisioning-preview');
    const monitoringShot = await clickSidebar('/cimolace/admin/monitoring', '07-monitoring');
    const billingShot = await clickSidebar('/cimolace/admin/billing', '07-billing');
    const supportShot = await clickSidebar('/cimolace/admin/support', '08-support');

    await clickSidebar('/cimolace/admin/clients', '09-return-clients');
    const isnaClient = await send('Runtime.evaluate', {
      expression: `
        fetch('http://localhost:4002/cimolace-backoffice/clients', {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('isna-v2-debug-api-bearer') }
        }).then(async (r) => {
          const body = await r.json();
          const rows = body.data || body;
          const isna = rows.find((client) => client.portal_slug === 'isna' || client.name === 'ISNA');
          return isna ? { id: isna.id, slug: isna.portal_slug, name: isna.name } : null;
        })
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const isnaId = isnaClient.result.value?.id;
    await send('Runtime.evaluate', {
      expression: `
        const isnaId = ${JSON.stringify(isnaId)};
        if (isnaId) {
          location.assign('/cimolace/admin/clients/' + isnaId);
        } else {
          [...document.querySelectorAll('a')]
            .find((a) => a.href.includes('/cimolace/admin/clients/') && !a.href.endsWith('/clients'))
            ?.click();
        }
        true;
      `,
    });
    await delay(5000);
    const detailOverviewShot = await screenshot('08-client-detail-overview');
    const clickTab = async (label, name) => {
      await send('Runtime.evaluate', {
        expression: `
          [...document.querySelectorAll('button')]
            .find((button) => button.textContent.trim() === ${JSON.stringify(label)})
            ?.click();
          true;
        `,
      });
      await delay(1000);
      return screenshot(name);
    };
    const detailSchoolModelShot = await clickTab('Modèle école', '09-client-detail-school-model');
    const detailDiagnosticShot = await clickTab('Diagnostic', '09-client-detail-diagnostic');
    const detailEnginesShot = await clickTab('Moteurs', '10-client-detail-engines');
    const detailApiShot = await clickTab('API & secrets', '11-client-detail-api');
    const detailBillingShot = await clickTab('Facturation', '12-client-detail-billing');

    const domText = await send('Runtime.evaluate', {
      expression: `document.body.innerText.slice(0, 4000)`,
      returnByValue: true,
    });
    const browserState = await send('Runtime.evaluate', {
      expression: `({
        href: location.href,
        keys: Object.keys(localStorage).filter((key) => key.includes('auth') || key.includes('sb-') || key.includes('isna-v2')),
        token: localStorage.getItem('isna-v2-debug-api-bearer') ? 'present' : 'missing',
        tenant: localStorage.getItem('isna-v2-tenant-slug') || '',
        authValue: (() => {
          const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
          const raw = key ? localStorage.getItem(key) : '';
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw);
            return {
              hasAccessToken: Boolean(parsed.access_token),
              hasCurrentSession: Boolean(parsed.currentSession),
              userEmail: parsed.user?.email || parsed.currentSession?.user?.email || null,
              expiresAt: parsed.expires_at || parsed.currentSession?.expires_at || null
            };
          } catch (error) {
            return { parseError: String(error), raw: raw.slice(0, 80) };
          }
        })()
      })`,
      returnByValue: true,
    });

    const apiResult = await send('Runtime.evaluate', {
      expression: `
        fetch('http://localhost:4002/cimolace-backoffice/clients', {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('isna-v2-debug-api-bearer') }
        }).then(async (r) => {
          const body = await r.json().catch(() => ({}));
          const rows = body.data || body || [];
          const clients = Array.isArray(rows) ? rows : [];
          const isna = clients.find((client) => client.portal_slug === 'isna' || client.name === 'ISNA');
          return {
            status: r.status,
            clientCount: clients.length,
            isna: isna ? {
              id: isna.id,
              name: isna.name,
              status: isna.status,
              portal_slug: isna.portal_slug,
              tenant_id: isna.tenant_id
            } : null
          };
        })
      `,
      awaitPromise: true,
      returnByValue: true,
    });

    const finalText = String(domText.result.value || '');
    const finalState = browserState.result.value || {};
    const finalHref = String(finalState.href || '');
    const browserErrorPatterns = [
      'ERR_CONNECTION_REFUSED',
      'Ce site est inaccessible',
      "This site can't be reached",
      "localhost n'autorise pas la connexion",
    ];
    const browserError = browserErrorPatterns.find((pattern) => finalText.includes(pattern));
    if (browserError) throw new Error(`Smoke landed on browser error page: ${browserError}`);
    if (!finalHref.includes('/cimolace/admin/clients/')) {
      throw new Error(`Smoke did not reach a Cimolace client detail page: ${finalHref}`);
    }
    if (!finalText.includes('Facturation') || !finalText.includes('API')) {
      throw new Error('Smoke final client detail page is missing expected Cimolace sections');
    }
    if (apiResult.result.value?.status !== 200) {
      throw new Error(`Cimolace clients API smoke failed: ${apiResult.result.value?.status}`);
    }

    const report = {
      loginShot,
      filledShot,
      adminShot,
      clientsShot,
      sitesShot,
      schoolProvisioningShot,
      schoolProvisioningPreviewShot,
      monitoringShot,
      billingShot,
      supportShot,
      detailOverviewShot,
      detailSchoolModelShot,
      detailDiagnosticShot,
      detailEnginesShot,
      detailApiShot,
      detailBillingShot,
      bodyTextSample: domText.result.value,
      browserState: browserState.result.value,
      api: apiResult.result.value,
      events: events.slice(-30),
    };
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    cdp.ws.close();
  } finally {
    proc.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
