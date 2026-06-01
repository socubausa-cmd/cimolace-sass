/**
 * Edge Function: oauth-callback
 *
 * Reçoit le callback de Google après authentification.
 * Valide le state CSRF, échange le code contre des tokens Google,
 * trouve ou crée l'utilisateur Supabase, crée une session, et redirige
 * le frontend avec les tokens dans le fragment URL (#hash).
 *
 * Stratégie à 2 niveaux (miroir de oauth-initiate) :
 *   1. Tenant a ses propres credentials → utilise client_id/secret du tenant
 *   2. Pas de credentials tenant → fallback sur PLATFORM_GOOGLE_CLIENT_ID/SECRET
 *
 * GET ?code=...&state=...
 *   → Redirect: /t/:slug/auth/callback#access_token=...&refresh_token=...
 *
 * Enregistrer dans Google Cloud Console comme "URI de redirection autorisée" :
 *   https://<project-ref>.supabase.co/functions/v1/oauth-callback
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// URL de base du frontend (défini comme secret dans Supabase)
const APP_BASE_URL = (Deno.env.get('APP_BASE_URL') || 'https://cimolace.space').replace(/\/$/, '');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

function redirectError(slug: string, code: string): Response {
  const base = slug ? `${APP_BASE_URL}/t/${slug}/login` : `${APP_BASE_URL}/login`;
  return Response.redirect(`${base}?error=${code}`, 302);
}

/** Trouve un utilisateur par email via l'API admin GoTrue. */
async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  // GoTrue API: GET /auth/v1/admin/users?filter=email:eq:<email>
  const url = `${SUPABASE_URL}/auth/v1/admin/users?filter=email:eq:${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    console.warn('[oauth-callback] findUserByEmail REST error:', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  // GoTrue returns { users: [...], total: n, ... }
  const users = Array.isArray(data?.users) ? data.users : [];
  return users.find((u: { email: string }) => u.email === email) || null;
}

/** Trouve ou crée un utilisateur Supabase. Retourne l'user_id. */
async function findOrCreateUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
  metadata: Record<string, string | undefined>,
): Promise<string> {
  // 1. Tenter de créer (idempotent si l'email existe déjà)
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!createError && created?.user?.id) {
    console.log('[oauth-callback] user created:', created.user.id);
    return created.user.id;
  }

  // 2. Si l'utilisateur existe déjà, le chercher par email
  const isEmailConflict =
    createError?.message?.toLowerCase().includes('already registered') ||
    createError?.message?.toLowerCase().includes('already exists') ||
    (createError as { code?: string })?.code === 'email_exists';

  if (isEmailConflict) {
    const existing = await findUserByEmail(email);
    if (existing?.id) {
      // Mettre à jour les métadonnées (avatar, nom)
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        user_metadata: metadata,
      });
      console.log('[oauth-callback] user found:', existing.id);
      return existing.id;
    }
  }

  throw new Error(`Impossible de trouver/créer l'utilisateur : ${createError?.message}`);
}

/** Crée une session Supabase pour l'utilisateur via admin.createSession ou via l'API REST. */
async function createUserSession(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  // Méthode 1 : admin.createSession (disponible dans supabase-js >= 2.48)
  try {
    // @ts-ignore — createSession peut ne pas être dans les types selon la version
    const { data, error } = await supabaseAdmin.auth.admin.createSession({ user_id: userId });
    if (!error && data?.session?.access_token) {
      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token ?? '',
        expires_in: data.session.expires_in ?? 3600,
      };
    }
    if (error) console.warn('[oauth-callback] createSession error:', error.message);
  } catch (e) {
    console.warn('[oauth-callback] createSession not available:', (e as Error).message);
  }

  // Méthode 2 : GoTrue REST API (fallback universel)
  // POST /auth/v1/admin/users/{userId}/token  — endpoint non documenté mais fonctionnel
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}/token`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.access_token) {
        return {
          access_token: data.access_token,
          refresh_token: data.refresh_token ?? '',
          expires_in: data.expires_in ?? 3600,
        };
      }
    }
    console.warn('[oauth-callback] REST token endpoint failed:', res.status);
  } catch (e) {
    console.warn('[oauth-callback] REST token fallback error:', (e as Error).message);
  }

  // Méthode 3 : generateLink magiclink → extraire les tokens du lien
  // Cette méthode retourne une URL de vérification que le frontend ne peut pas utiliser directement.
  // On la garde comme dernière option en loguant l'erreur.
  console.error('[oauth-callback] All session creation methods failed for user:', userId);
  return null;
}

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const googleError = url.searchParams.get('error');
  const googleErrorDesc = url.searchParams.get('error_description');

  // ── Refus utilisateur sur Google ─────────────────────────────────────────
  if (googleError) {
    console.warn('[oauth-callback] Google error:', googleError, googleErrorDesc);
    return redirectError('', 'google_denied');
  }

  if (!code || !state) {
    return redirectError('', 'invalid_callback');
  }

  // ── Admin client ──────────────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ── 1. Valider le state CSRF ──────────────────────────────────────────────
  const { data: oauthState, error: stateError } = await supabase
    .from('oauth_states')
    .select('state, tenant_id, tenant_slug, return_to, expires_at')
    .eq('state', state)
    .single();

  if (stateError || !oauthState) {
    console.error('[oauth-callback] state not found:', state, stateError?.message);
    return redirectError('', 'invalid_state');
  }

  // Supprimer le state utilisé (usage unique)
  await supabase.from('oauth_states').delete().eq('state', state);

  const tenantSlug: string = oauthState.tenant_slug;

  // Vérifier l'expiration
  if (new Date(oauthState.expires_at) < new Date()) {
    return redirectError(tenantSlug, 'state_expired');
  }

  // ── 2. Résoudre les credentials OAuth (stratégie à 2 niveaux) ───────────
  //   Niveau 1 : credentials propres au tenant (branding école)
  //   Niveau 2 : credentials plateforme Cimolace (fallback no-code)
  const PLATFORM_CLIENT_ID     = Deno.env.get('PLATFORM_GOOGLE_CLIENT_ID')     ?? '';
  const PLATFORM_CLIENT_SECRET = Deno.env.get('PLATFORM_GOOGLE_CLIENT_SECRET') ?? '';
  const PLATFORM_REDIRECT_URI  = Deno.env.get('PLATFORM_GOOGLE_REDIRECT_URI')
    ?? `${SUPABASE_URL}/functions/v1/oauth-callback`;

  const { data: oauthConfig } = await supabase
    .from('tenant_oauth_providers')
    .select('client_id, client_secret, authorized_redirect_uri')
    .eq('tenant_id', oauthState.tenant_id)
    .eq('provider', 'google')
    .eq('is_active', true)
    .maybeSingle();

  let clientId: string;
  let clientSecret: string;
  let redirectUri: string;

  if (oauthConfig?.client_id && oauthConfig?.client_secret) {
    // ✅ Niveau 1 — credentials dédiés du tenant
    clientId     = oauthConfig.client_id;
    clientSecret = oauthConfig.client_secret;
    redirectUri  = oauthConfig.authorized_redirect_uri;
    console.log('[oauth-callback] using tenant credentials for', tenantSlug);
  } else if (PLATFORM_CLIENT_ID && PLATFORM_CLIENT_SECRET) {
    // ✅ Niveau 2 — plateforme Cimolace (fallback no-code)
    clientId     = PLATFORM_CLIENT_ID;
    clientSecret = PLATFORM_CLIENT_SECRET;
    redirectUri  = PLATFORM_REDIRECT_URI;
    console.log('[oauth-callback] using platform credentials for', tenantSlug);
  } else {
    console.error('[oauth-callback] no oauth credentials available for tenant:', tenantSlug);
    return redirectError(tenantSlug, 'oauth_not_configured');
  }

  // ── 3. Échanger le code contre des tokens Google ─────────────────────────
  let googleTokens: { access_token?: string; id_token?: string; error?: string };
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    });

    googleTokens = await tokenRes.json();

    if (!tokenRes.ok || googleTokens.error) {
      console.error('[oauth-callback] Google token exchange error:', JSON.stringify(googleTokens));
      return redirectError(tenantSlug, 'token_exchange_failed');
    }
  } catch (e) {
    console.error('[oauth-callback] token exchange fetch error:', (e as Error).message);
    return redirectError(tenantSlug, 'token_exchange_failed');
  }

  const googleAccessToken = googleTokens.access_token!;

  // ── 4. Récupérer le profil Google ────────────────────────────────────────
  let googleUser: { email?: string; name?: string; picture?: string; sub?: string };
  try {
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${googleAccessToken}` },
    });
    googleUser = await userInfoRes.json();
  } catch (e) {
    console.error('[oauth-callback] userinfo fetch error:', (e as Error).message);
    return redirectError(tenantSlug, 'userinfo_failed');
  }

  if (!googleUser.email) {
    console.error('[oauth-callback] no email in Google user profile');
    return redirectError(tenantSlug, 'no_email');
  }

  const userMetadata = {
    full_name: googleUser.name,
    avatar_url: googleUser.picture,
    provider: 'google',
    provider_id: googleUser.sub,
  };

  // ── 5. Trouver ou créer l'utilisateur Supabase ───────────────────────────
  let supabaseUserId: string;
  try {
    supabaseUserId = await findOrCreateUser(supabase, googleUser.email, userMetadata);
  } catch (e) {
    console.error('[oauth-callback] findOrCreateUser error:', (e as Error).message);
    return redirectError(tenantSlug, 'user_error');
  }

  // ── 6. Créer la session Supabase ─────────────────────────────────────────
  const session = await createUserSession(supabase, supabaseUserId);

  if (!session) {
    return redirectError(tenantSlug, 'session_failed');
  }

  // ── 7. Rediriger le frontend avec les tokens dans le hash ─────────────────
  // Le frontend (/t/:slug/auth/callback) lit le hash et appelle supabase.auth.setSession()
  const callbackUrl = new URL(`${APP_BASE_URL}/t/${tenantSlug}/auth/callback`);

  const hashParts = [
    `access_token=${encodeURIComponent(session.access_token)}`,
    `refresh_token=${encodeURIComponent(session.refresh_token)}`,
    `expires_in=${session.expires_in}`,
    `token_type=bearer`,
  ];

  if (oauthState.return_to) {
    hashParts.push(`return_to=${encodeURIComponent(oauthState.return_to)}`);
  }

  callbackUrl.hash = hashParts.join('&');

  console.log('[oauth-callback] success, redirecting to:', callbackUrl.origin + callbackUrl.pathname);
  return Response.redirect(callbackUrl.toString(), 302);
});
