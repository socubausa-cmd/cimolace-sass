import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/session.json' });

const EXPECTED_TABS = 8;

test('twin page exposes 8 clickable tabs', async ({ page }) => {
  // Hit /patients first to grab the first patient id, then route to its twin.
  await page.goto('/patients');
  const firstPatientLink = page.locator('a[href^="/patients/"]').first();
  await expect(firstPatientLink).toBeVisible({ timeout: 15_000 });
  const href = await firstPatientLink.getAttribute('href');
  expect(href).toBeTruthy();
  const patientId = href!.split('/').pop()!;

  await page.goto(`/twin/${patientId}`);

  const tabs = page.locator('[role="tab"], [data-testid="twin-tab"]');
  await expect(tabs.first()).toBeVisible({ timeout: 15_000 });
  await expect(tabs).toHaveCount(EXPECTED_TABS);

  for (let i = 0; i < EXPECTED_TABS; i += 1) {
    const tab = tabs.nth(i);
    await tab.click();
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `e2e-results/twin-tab-${i + 1}.png`,
      fullPage: true,
    });
  }
});
