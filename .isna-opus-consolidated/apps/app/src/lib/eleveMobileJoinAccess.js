import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

export function buildEleveLoginRedirect(pathname, search = '') {
  const redirect = `${pathname || ELEVE_MOBILE.connexion}${search || ''}`;
  return `${ELEVE_MOBILE.login}?${new URLSearchParams({ redirect }).toString()}`;
}

export function buildEleveJoinCodeUrl(code, sourcePath = `${ELEVE_MOBILE.connexion}/code`) {
  const q = new URLSearchParams({ join: String(code || '') }).toString();
  return `${sourcePath}?${q}`;
}

export async function redeemEleveAccessCode({ code, accessToken }) {
  const clean = String(code || '').trim();
  if (!clean) return { ok: false, error: 'Code manquant.' };
  if (!accessToken) return { ok: false, error: 'Authentification requise.' };

  const res = await fetch('/.netlify/functions/privileged-link-redeem', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ slug: clean }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.ok) {
    return {
      ok: false,
      status: res.status,
      error: body?.error || body?.message || 'Code invalide ou expiré.',
    };
  }
  return { ok: true, ...body };
}
