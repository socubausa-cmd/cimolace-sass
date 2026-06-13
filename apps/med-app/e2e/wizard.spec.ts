import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/session.json' });

test('complete patient wizard creates a patient and lands on /twin/:uuid', async ({
  page,
}) => {
  await page.goto('/twin/new');

  const stamp = Date.now();
  const firstName = `E2E${stamp}`;
  const lastName = 'Smoke';

  // Step 1 — identity.
  await page.getByLabel(/first name|prénom/i).fill(firstName);
  await page.getByLabel(/last name|nom/i).fill(lastName);
  await page.getByLabel(/date of birth|naissance/i).fill('1990-01-15');
  await page.getByRole('button', { name: /next|suivant/i }).click();

  // Step 2 — demographics / contact (best-effort fill).
  const emailField = page.getByLabel(/email/i);
  if (await emailField.count()) {
    await emailField.fill(`${firstName.toLowerCase()}@e2e.local`);
  }
  await page.getByRole('button', { name: /next|suivant/i }).click();

  // Step 3 — medical / consent.
  await page.getByRole('button', { name: /next|suivant/i }).click();

  // Step 4 — review + create.
  await page
    .getByRole('button', { name: /create|finish|terminer|créer/i })
    .click();

  // Expect redirect to /twin/:uuid.
  const uuidRe =
    /\/twin\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  await expect(page).toHaveURL(uuidRe, { timeout: 20_000 });
});
