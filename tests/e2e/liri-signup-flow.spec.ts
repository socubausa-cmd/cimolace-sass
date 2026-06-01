import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC = process.env.E2E_BASE_URL ?? 'https://cimolace.space';
const API = process.env.E2E_API_URL ?? 'https://api.cimolace.space';
const APP = process.env.E2E_APP_URL ?? 'https://app.cimolace.space';
const SHOTS = path.resolve(process.cwd(), 'tests/e2e/screenshots');

const ts = Date.now();
const email = `e2e-liri-${ts}@cimolace.test`;
const slug = `e2e-studio-${ts}`;
const platformName = `E2E Studio ${ts}`;
const password = `E2EPass${ts}!`;
const liveTitle = `Live E2E Test ${ts}`;

type SignupData = {
  tenant?: { id?: string; slug?: string; infrastructure_type?: string };
  user?: { id?: string; email?: string };
  next_url?: string;
};

type AuthState = {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
};

let signupData: SignupData | null = null;
let authState: AuthState | null = null;

function shotPath(name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  return path.join(SHOTS, name);
}

async function capture(page: Page, filename: string) {
  await page.screenshot({ path: shotPath(filename), fullPage: true });
}

async function expectVisibleText(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}

async function expectNoServerError(page: Page) {
  await expect(page.getByText(/(404|500|502|503|504|Internal Server Error|Application error)/i)).toHaveCount(0);
}

async function fillFirst(page: Page, selectors: string[], value: string) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value);
      return;
    }
  }
  throw new Error(`Aucun champ visible pour: ${selectors.join(', ')}`);
}

async function readJson(response: { json(): Promise<unknown> }) {
  return response.json().catch(() => ({}));
}

async function restoreAuth(page: Page) {
  if (!authState) return;
  await page.context().addCookies(authState.cookies);
  await page.addInitScript((state) => {
    const originState = state.origins.find((entry) => entry.origin === window.location.origin);
    for (const item of originState?.localStorage ?? []) {
      window.localStorage.setItem(item.name, item.value);
    }
  }, authState);
}

test.describe('LIRI self-serve signup flow', () => {
  test('01 — Landing produit LIRI', async ({ page }) => {
    await page.goto(`${PUBLIC}/liri`, { waitUntil: 'networkidle' });
    await capture(page, '01-landing-liri.png');

    await expect(page).toHaveTitle(/LIRI/i);
    await expectVisibleText(page, 'Le moteur live & IA universel');
    const cta = page.getByRole('link', { name: /Créer mon espace LIRI/i }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', /\/onboarding$/);
    await expectVisibleText(page, /12 MODES LIRI/i);
    await expectVisibleText(page, /Studio/i);
    await expectVisibleText(page, /Smartboard/i);
    await expectVisibleText(page, /Masterclass Factory/i);
    await expectVisibleText(page, /multilingue/i);
    await expectVisibleText(page, /À partir de 0\s*€\/mois/i);
    await expect(page.locator('footer').getByText('LIRI').first()).toBeVisible();
    await expect(page.locator('footer').getByText(/Doc LIRI/i).first()).toBeVisible();
  });

  test('02 — Onboarding picker', async ({ page }) => {
    await page.goto(`${PUBLIC}/liri`, { waitUntil: 'networkidle' });
    await page.getByText('Créer mon espace LIRI').first().click();
    await page.waitForURL('**/onboarding');
    await capture(page, '02-onboarding-picker.png');

    for (const label of ['LIRI Studio', 'École', 'MedOS', 'Mbolo', 'Community']) {
      await expectVisibleText(page, label);
    }
    const cards = page.locator('div[class*="grid"] > div');
    await expect(cards).toHaveCount(5);
    const liriCard = cards.first();
    await expect(liriCard.getByText('LIRI Studio')).toBeVisible();
    await expect(liriCard.getByText(/NOUVEAU/i)).toBeVisible();
    const hasIndigo = await liriCard.evaluate((el) => {
      const nodes = [el, ...Array.from(el.querySelectorAll('*'))] as HTMLElement[];
      return nodes.some((node) => {
        const style = getComputedStyle(node);
        return [style.color, style.backgroundColor, style.borderColor, style.boxShadow]
          .some((value) => String(value).toLowerCase().includes('rgb(99, 102, 241)') || String(value).toLowerCase().includes('#6366f1'));
      });
    });
    expect(hasIndigo).toBeTruthy();
    await expect(page.getByText(/Mbolo/i).locator('..').getByText(/Bientôt/i).first()).toBeVisible();
    await expect(page.getByText(/Community/i).locator('..').getByText(/Bientôt/i).first()).toBeVisible();
    await expect(page.getByText(/Déjà un compte\s*\?\s*Se connecter/i)).toBeVisible();
  });

  test('03 — Formulaire création tenant', async ({ page }) => {
    await page.goto(`${PUBLIC}/onboarding`, { waitUntil: 'networkidle' });
    await page.locator('div[class*="grid"] > div').first().click();
    await page.waitForURL('**/onboarding/create?kind=liri');
    await capture(page, '03-form-empty.png');

    await expectVisibleText(page, 'CIMOLACE · LIRI STUDIO');
    await expect(page.getByRole('heading', { name: 'Créez votre plateforme.' })).toBeVisible();
    await expectVisibleText(page, /Live \+ IA · Studio · Masterclass · SmartBoard/i);
    await expect(page.locator('input[placeholder*="Académie Pierre"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Slug"], input[name="slug"]')).toBeVisible();
    await expect(page.locator('input[placeholder="vous@votreentreprise.com"], input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Créer ma plateforme LIRI/i })).toBeVisible();
    await expectVisibleText(page, /conditions/i);
    await expectVisibleText(page, /politique de confidentialité/i);
  });

  test('04 — Form rempli', async ({ page }) => {
    await page.goto(`${PUBLIC}/onboarding/create?kind=liri`, { waitUntil: 'networkidle' });
    await fillFirst(page, ['input[placeholder*="Académie Pierre"]', 'input[name="platformName"]'], platformName);
    await fillFirst(page, ['input[placeholder="vous@votreentreprise.com"]', 'input[type="email"]'], email);
    await fillFirst(page, ['input[type="password"]', 'input[name="password"]'], password);
    await page.waitForTimeout(500);
    await capture(page, '04-form-filled.png');

    await expect(page.locator('input[placeholder*="Académie Pierre"], input[name="platformName"]').first()).toHaveValue(platformName);
    await expect(page.locator('input[type="email"]').first()).toHaveValue(email);
    await expect(page.locator('input[type="password"]').first()).toHaveValue(password);
    await expectVisibleText(page, new RegExp(`cimolace\\.space/t/${slug.slice(0, 11)}`, 'i'));
    await expect(page.getByText(/erreur|required|obligatoire/i)).toHaveCount(0);
    await expectVisibleText(page, /8 caractères minimum/i);
  });

  test('05 — Submit + interception API', async ({ page }) => {
    await page.goto(`${PUBLIC}/onboarding/create?kind=liri`, { waitUntil: 'networkidle' });
    await fillFirst(page, ['input[placeholder*="Académie Pierre"]', 'input[name="platformName"]'], platformName);
    await fillFirst(page, ['input[placeholder="vous@votreentreprise.com"]', 'input[type="email"]'], email);
    await fillFirst(page, ['input[type="password"]', 'input[name="password"]'], password);

    let capturedStatus = 0;
    let capturedBody: { data?: SignupData } | SignupData = {};
    await page.route('**/signup/tenant', async (route) => {
      const response = await route.fetch();
      capturedStatus = response.status();
      capturedBody = await response.json().catch(() => ({}));
      await route.fulfill({ response });
    });

    await page.click('button:has-text("Créer ma plateforme LIRI")');
    await page.waitForURL(/\/t\/e2e-studio-/, { timeout: 20_000 }).catch(() => undefined);
    signupData = 'data' in capturedBody ? capturedBody.data ?? {} : capturedBody;
    await capture(page, '05-signup-success.png');

    expect(capturedStatus).toBe(201);
    expect(signupData?.tenant?.infrastructure_type).toBe('liri');
    expect(signupData?.tenant?.slug).toMatch(/^e2e-studio-/);
    expect(signupData?.user?.email).toBe(email);
    expect(signupData?.next_url).toContain('/admin/lives');
  });

  test('06 — Redirect vers login tenant', async ({ page }) => {
    test.skip(!signupData?.tenant?.slug, 'Signup non exécuté');
    await page.waitForURL(/app\.cimolace\.space\/t\/.*\/login/, { timeout: 10_000 }).catch(async () => {
      await page.goto(`${APP}/t/${signupData?.tenant?.slug}/login?welcome=1`, { waitUntil: 'networkidle' });
    });
    await capture(page, '06-tenant-login.png');

    await expect(page).toHaveURL(new RegExp(`/t/${signupData?.tenant?.slug}/login`));
    if (await page.getByText(/LIRI/i).count() === 0) {
      await test.info().attach('tenant-login-branding-gap', {
        body: 'La page login tenant creee pour LIRI ne montre pas le branding LIRI. Capture: tests/e2e/screenshots/06-tenant-login.png',
        contentType: 'text/plain',
      });
    }
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Se connecter/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continuer avec Google/i })).toBeVisible();
    await expectNoServerError(page);
  });

  test('07 — Login + dashboard', async ({ page }) => {
    test.skip(!signupData?.tenant?.slug, 'Signup non exécuté');
    await page.goto(`${APP}/t/${signupData?.tenant?.slug}/login?welcome=1`, { waitUntil: 'networkidle' });
    await fillFirst(page, ['input[type="email"]', 'input[name="email"]'], email);
    await fillFirst(page, ['input[type="password"]', 'input[name="password"]'], password);
    await page.click('button:has-text("Se connecter")');
    await page.waitForURL(/\/t\/.*\/(admin|courses|dashboard)/, { timeout: 20_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    authState = await page.context().storageState();
    await capture(page, '07-tenant-dashboard.png');

    if (!/\/admin/.test(page.url())) {
      await test.info().attach('tenant-login-route-gap', {
        body: `Apres login, le createur LIRI est redirige vers ${page.url()} au lieu de /admin.`,
        contentType: 'text/plain',
      });
    }
    await expect(page.getByText(/Invalid credentials/i)).toHaveCount(0);
  });

  test('08 — Page Lives', async ({ page }) => {
    test.skip(!signupData?.tenant?.slug, 'Signup non exécuté');
    await restoreAuth(page);
    await page.goto(`${APP}/t/${signupData?.tenant?.slug}/admin/lives`);
    await page.waitForLoadState('networkidle');
    await capture(page, '08-admin-lives.png');

    await expect(page.getByRole('button', { name: /Nouveau live/i })).toBeVisible();
    await expectNoServerError(page);
  });

  test('09 — Modal Nouveau live', async ({ page }) => {
    test.skip(!signupData?.tenant?.slug, 'Signup non exécuté');
    await restoreAuth(page);
    await page.goto(`${APP}/t/${signupData?.tenant?.slug}/admin/lives`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Nouveau live")');
    await capture(page, '09-new-live-modal.png');

    for (const label of [/Titre/i, /Description/i, /Date/i, /Durée/i, /Prix/i, /Public/i]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /^Créer$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Annuler/i })).toBeVisible();
  });

  test('10 — Création live', async ({ page }) => {
    test.skip(!signupData?.tenant?.slug, 'Signup non exécuté');
    await restoreAuth(page);
    await page.goto(`${APP}/t/${signupData?.tenant?.slug}/admin/lives`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Nouveau live")');
    await fillFirst(page, ['input[placeholder*="Cours"]', 'input[name="title"]', 'input[placeholder*="Titre"]'], liveTitle);
    await fillFirst(page, ['input[type="number"][placeholder*="60"]', 'input[name="duration_minutes"]', 'input[type="number"]'], '60');

    const createLivePromise = page.waitForResponse((r) =>
      r.url().includes('/lives') && r.request().method() === 'POST' && r.status() < 400,
    );
    await page.click('button[type="submit"]:has-text("Créer"), button:has-text("Créer")');
    const liveRes = await createLivePromise;
    const liveData = await readJson(liveRes);
    await capture(page, '10-live-created.png');

    expect(liveRes.status()).toBeLessThan(400);
    expect(JSON.stringify(liveData)).toMatch(/id|live/i);
    await expectVisibleText(page, liveTitle);
  });
});

test.describe('LIRI API health checks', () => {
  test('GET /health → 200 + uptime', async ({ request }) => {
    const response = await request.get(`${API}/health`);
    expect(response.status()).toBe(200);
    expect(JSON.stringify(await readJson(response))).toMatch(/uptime|ok|healthy/i);
  });

  test('POST /signup/tenant {} → 400', async ({ request }) => {
    const response = await request.post(`${API}/signup/tenant`, { data: {} });
    expect(response.status()).toBe(400);
    expect(JSON.stringify(await readJson(response))).toMatch(/email|password|platformName|required|requis/i);
  });

  test('POST /signup/tenant password court → 400', async ({ request }) => {
    const response = await request.post(`${API}/signup/tenant`, {
      data: { email: `short-${ts}@cimolace.test`, password: 'short', platformName: 'Short Pass', kind: 'liri' },
    });
    expect(response.status()).toBe(400);
  });

  test('POST /signup/tenant slug invalide → 400', async ({ request }) => {
    const response = await request.post(`${API}/signup/tenant`, {
      data: { email: `bad-slug-${ts}@cimolace.test`, password, platformName: 'Bad Slug', slug: 'X!Y', kind: 'liri' },
    });
    expect(response.status()).toBe(400);
  });

  test('POST /signup/tenant slug déjà pris → 409', async ({ request }) => {
    const duplicateSlug = `e2e-duplicate-${ts}`;
    const payload = { email: `dup-a-${ts}@cimolace.test`, password, platformName: `Dup A ${ts}`, slug: duplicateSlug, kind: 'liri' };
    const first = await request.post(`${API}/signup/tenant`, { data: payload });
    expect(first.status()).toBe(201);
    const second = await request.post(`${API}/signup/tenant`, {
      data: { ...payload, email: `dup-b-${ts}@cimolace.test`, platformName: `Dup B ${ts}` },
    });
    expect(second.status()).toBe(409);
  });

  test('POST /ai-billing/stripe/webhook sans signature → 400', async ({ request }) => {
    const response = await request.post(`${API}/ai-billing/stripe/webhook`, { data: { test: true } });
    expect(response.status()).toBe(400);
    expect(JSON.stringify(await readJson(response))).toMatch(/signature|Stripe/i);
  });
});

test.describe('LIRI performance budgets', () => {
  test('cimolace.space/liri : LCP < 2.5s, CLS < 0.1', async ({ page }) => {
    await page.goto(`${PUBLIC}/liri`, { waitUntil: 'networkidle' });
    const metrics = await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      const lcp = lcpEntries.length ? lcpEntries[lcpEntries.length - 1].startTime : nav?.loadEventEnd ?? 0;
      const cls = await new Promise<number>((resolve) => {
        let total = 0;
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
              if (!entry.hadRecentInput) total += entry.value ?? 0;
            }
          });
          observer.observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(total);
          }, 200);
        } catch {
          resolve(0);
        }
      });
      return { lcp, cls };
    });
    expect(metrics.lcp).toBeLessThan(2500);
    expect(metrics.cls).toBeLessThan(0.1);
  });
});
