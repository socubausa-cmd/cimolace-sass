import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/session.json' });

test('twin wizard renders 4 steps', async ({ page }) => {
  await page.goto('/twin/new');

  // Wait for the wizard shell.
  await expect(page).toHaveURL(/\/twin\/new/);

  // The wizard should expose 4 step indicators. We accept either a stepper
  // role, numbered chips, or text labels.
  const steps = page.locator(
    '[data-testid="wizard-step"], [role="tab"][aria-label*="Step"], .wizard-step',
  );
  await expect(steps.first()).toBeVisible({ timeout: 10_000 });
  await expect(steps).toHaveCount(4);
});
