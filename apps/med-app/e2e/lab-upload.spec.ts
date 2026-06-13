import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/session.json' });

test('lab upload surface exposes dropzone and uploaded bilans section', async ({
  page,
}) => {
  await page.goto('/patients');
  const firstPatientLink = page.locator('a[href^="/patients/"]').first();
  await expect(firstPatientLink).toBeVisible({ timeout: 15_000 });
  const href = await firstPatientLink.getAttribute('href');
  expect(href).toBeTruthy();
  const patientId = href!.split('/').pop()!;

  await page.goto(`/twin/${patientId}`);

  // Try to click the Bilans / Labs tab if it isn't open by default.
  const labsTab = page.getByRole('tab', { name: /bilans|labs|examens/i });
  if (await labsTab.count()) {
    await labsTab.first().click();
  }

  // Dropzone — accept any of the common patterns.
  const dropzone = page
    .locator('[data-testid="lab-dropzone"], input[type="file"], .dropzone')
    .first();
  await expect(dropzone).toBeVisible({ timeout: 10_000 });

  // Uploaded-bilans section heading.
  await expect(
    page.getByText(/bilans uploadés|uploaded bilans|bilans téléversés/i),
  ).toBeVisible({ timeout: 10_000 });
});
