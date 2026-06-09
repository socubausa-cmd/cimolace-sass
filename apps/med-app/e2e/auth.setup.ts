import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test as setup, expect } from '@playwright/test';

/**
 * Auth bootstrap: hit the medos admin handoff endpoint, extract the one-shot
 * code, exchange it for an access_token, and persist a Playwright storageState
 * compatible session at .auth/session.json for downstream specs.
 *
 * Specs that need an authenticated context can do:
 *   test.use({ storageState: '.auth/session.json' });
 */
const HANDOFF_URL =
  process.env.E2E_HANDOFF_URL ||
  'https://www.zahirwellness.com/api/medos-admin-handoff';

const SESSION_PATH = resolve('.auth/session.json');

setup('authenticate via medos handoff', async ({ request, baseURL }) => {
  // Step 1: hit the handoff endpoint to get a short-lived code.
  const handoffRes = await request.get(HANDOFF_URL);
  expect(handoffRes.ok(), `Handoff GET ${HANDOFF_URL} failed`).toBeTruthy();

  const handoffBody = await handoffRes.json();
  const code: string | undefined = handoffBody.code || handoffBody.handoff_code;
  expect(code, 'Handoff response missing "code"').toBeTruthy();

  // Step 2: exchange the code for an access_token via the med-app exchange endpoint.
  const exchangeUrl = new URL('/api/auth/exchange', baseURL).toString();
  const exchangeRes = await request.post(exchangeUrl, {
    data: { code },
    headers: { 'content-type': 'application/json' },
  });
  expect(
    exchangeRes.ok(),
    `Exchange POST ${exchangeUrl} failed`,
  ).toBeTruthy();

  const exchangeBody = await exchangeRes.json();
  const accessToken: string | undefined =
    exchangeBody.access_token || exchangeBody.accessToken;
  const refreshToken: string | undefined =
    exchangeBody.refresh_token || exchangeBody.refreshToken;
  expect(accessToken, 'Exchange response missing access_token').toBeTruthy();

  // Step 3: persist as Playwright storageState. We store the token in both a
  // cookie and an origin localStorage entry so whichever auth mode the app
  // uses (supabase localStorage or cookie session) finds it.
  const origin = new URL(baseURL || 'https://med.cimolace.space').origin;
  const session = {
    cookies: [
      {
        name: 'sb-access-token',
        value: accessToken!,
        domain: new URL(origin).hostname,
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: true,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [
      {
        origin,
        localStorage: [
          {
            name: 'medos.session',
            value: JSON.stringify({
              access_token: accessToken,
              refresh_token: refreshToken ?? null,
            }),
          },
        ],
      },
    ],
  };

  await mkdir(dirname(SESSION_PATH), { recursive: true });
  await writeFile(SESSION_PATH, JSON.stringify(session, null, 2), 'utf8');
});
