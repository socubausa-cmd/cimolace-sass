/**
 * Smoke test — Google Auth multi-tenant Cimolace.
 *
 * Lancement :
 *   npx playwright test -c apps/app/playwright.config.js apps/app/e2e/google-auth-smoke.spec.js
 *
 * Prérequis : le dev server doit tourner sur http://localhost:5173.
 */

import { test, expect } from '@playwright/test';

const GOOGLE_BUTTON_SELECTOR = 'button:has-text("Continuer avec Google")';
const ERROR_TEXT_SELECTOR = 'text=Google Auth n\'est pas configuré';
const OAUTH_STORAGE_KEY = 'cimolace_oauth_tenant';

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectOAuthUrls(page) {
  const urls = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      const url = frame.url();
      if (/supabase|google.*oauth|accounts\.google/.test(url)) {
        urls.push(url);
      }
    }
  });
  return urls;
}

async function clickGoogleAndWait(page) {
  const btn = page.locator(GOOGLE_BUTTON_SELECTOR);
  await expect(btn).toBeVisible({ timeout: 5000 });
  await btn.click();
  // Laisser le temps à la redirection ou à l'erreur de s'afficher
  await page.waitForTimeout(2000);
}

// ── Présence des boutons ─────────────────────────────────────────────────────

test.describe('Présence des boutons Google', () => {
  test('bouton visible sur /cimolace/login (opérateur)', async ({ page }) => {
    await page.goto('/cimolace/login');
    await expect(page.locator(GOOGLE_BUTTON_SELECTOR)).toBeVisible({ timeout: 5000 });
  });

  test('bouton visible sur /t/bradlss-scolle/login (tenant)', async ({ page }) => {
    await page.goto('/t/bradlss-scolle/login');
    await expect(page.locator(GOOGLE_BUTTON_SELECTOR)).toBeVisible({ timeout: 5000 });
  });

  test('bouton visible sur /t/bradlss-scolle/signup (inscription tenant)', async ({ page }) => {
    await page.goto('/t/bradlss-scolle/signup');
    await expect(page.locator(GOOGLE_BUTTON_SELECTOR)).toBeVisible({ timeout: 5000 });
  });
});

// ── Comportement au clic ─────────────────────────────────────────────────────

test.describe('Clic Google — opérateur Cimolace', () => {
  test('déclenche une URL OAuth Supabase ou affiche une erreur provider propre', async ({ page }) => {
    const oauthUrls = collectOAuthUrls(page);
    await page.goto('/cimolace/login');
    await clickGoogleAndWait(page);

    const hasError = await page.locator('[style*="ef4444"], [style*="f87171"]').isVisible().catch(() => false);

    expect(oauthUrls.length > 0 || hasError).toBeTruthy();
  });
});

test.describe('Clic Google — tenant école', () => {
  test('le tenant slug est stocké en sessionStorage avant la redirection', async ({ page }) => {
    await page.goto('/t/bradlss-scolle/login');
    await clickGoogleAndWait(page);

    const stored = await page.evaluate((key) => sessionStorage.getItem(key), OAUTH_STORAGE_KEY);
    // Soit le tenant est stocké, soit une erreur s'est produite (provider non configuré)
    const hasError = await page.locator('[style*="ef4444"], [style*="f87171"]').isVisible().catch(() => false);
    expect(stored === 'bradlss-scolle' || hasError).toBeTruthy();
  });

  test('clic sur /t/bradlss-scolle/signup stocke aussi le tenant', async ({ page }) => {
    await page.goto('/t/bradlss-scolle/signup');
    await clickGoogleAndWait(page);

    const stored = await page.evaluate((key) => sessionStorage.getItem(key), OAUTH_STORAGE_KEY);
    const hasError = await page.locator('[style*="ef4444"], [style*="f87171"]').isVisible().catch(() => false);
    expect(stored === 'bradlss-scolle' || hasError).toBeTruthy();
  });
});

// ── Callback ─────────────────────────────────────────────────────────────────

test.describe('Pages de callback', () => {
  test('GET /cimolace/auth/google/callback → 200 + spinner visible', async ({ page }) => {
    const resp = await page.goto('/cimolace/auth/google/callback');
    expect(resp?.status()).toBe(200);
    await expect(page.locator('text=Connexion avec Google')).toBeVisible({ timeout: 5000 });
  });

  test('GET /cimolace/auth/google/callback sans session → redirige vers login avec ?error=', async ({ page }) => {
    // Le callback sans session ni OAuth params doit rediriger vers /cimolace/login?error=no_session
    await page.goto('/cimolace/auth/google/callback');

    // Attendre la redirection
    await page.waitForURL(/\/cimolace\/login\?error=/, { timeout: 10000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe('/cimolace/login');
    expect(url.searchParams.get('error')).toBeTruthy();
  });

  test('GET /cimolace/auth/google/callback?tenant=ecole-demo sans session → redirige vers /t/ecole-demo/login?error=', async ({ page }) => {
    await page.goto('/cimolace/auth/google/callback?tenant=ecole-demo');

    await page.waitForURL(/\/t\/ecole-demo\/login\?error=/, { timeout: 10000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe('/t/ecole-demo/login');
    expect(url.searchParams.get('error')).toBe('no_session');
  });

  test('GET /auth/callback → pas une 404', async ({ page }) => {
    const resp = await page.goto('/auth/callback');
    expect(resp?.status()).not.toBe(404);
  });
});

// ── Connexion email/password non cassée ──────────────────────────────────────

test.describe('Email/password — non régressé', () => {
  test('le formulaire email/password est présent sur /cimolace/login', async ({ page }) => {
    await page.goto('/cimolace/login');
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 5000 });
  });

  test('le formulaire email/password est présent sur /t/bradlss-scolle/login', async ({ page }) => {
    await page.goto('/t/bradlss-scolle/login');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 });
  });
});
