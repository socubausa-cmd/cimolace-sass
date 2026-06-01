/// <reference lib="deno.ns" />
/**
 * Unified auth helper for Supabase Edge Functions.
 * Mirrors netlify/functions/_lib/auth/index.js for API consistency.
 *
 * Extracts bearer token (x-user-jwt or Authorization header),
 * validates via auth.getUser(), optionally loads profile + enforces roles,
 * and returns consistent error Response objects.
 */

import { corsHeaders } from './cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type SupabaseAdmin = ReturnType<typeof createClient>;

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  OWNER: 'owner',
  SECRETARIAT: 'secretariat',
  COMMERCIAL: 'commercial',
  SUPPORT: 'support',
  TEACHER: 'teacher',
  STUDENT: 'student',
  GUEST: 'guest',
} as const);

export const ROLE_SET_FULL_STAFF = Object.freeze(
  new Set([ROLES.ADMIN, ROLES.OWNER, ROLES.SECRETARIAT])
);

export const ROLE_SET_ANY_STAFF = Object.freeze(
  new Set([ROLES.ADMIN, ROLES.OWNER, ROLES.SECRETARIAT, ROLES.COMMERCIAL, ROLES.SUPPORT])
);

export const ROLE_SET_TEACHING = Object.freeze(
  new Set([ROLES.ADMIN, ROLES.OWNER, ROLES.SECRETARIAT, ROLES.TEACHER])
);

const ROLE_ALIASES: Record<string, string> = {
  secretaire: ROLES.SECRETARIAT,
  secretary: ROLES.SECRETARIAT,
  proprietaire: ROLES.OWNER,
  administrateur: ROLES.ADMIN,
  enseignant: ROLES.TEACHER,
  professeur: ROLES.TEACHER,
  prof: ROLES.TEACHER,
  eleve: ROLES.STUDENT,
  etudiant: ROLES.STUDENT,
};

export function normalizeRole(raw: unknown): string {
  const cleaned = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return ROLE_ALIASES[cleaned] ?? cleaned;
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function getEnv(name: string): string {
  // @ts-ignore Deno deploy
  return String(Deno.env.get(name) || '').trim();
}

export function createSupabaseAdmin(): SupabaseAdmin | null {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

function extractBearer(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const t = String(headerValue).replace(/^Bearer\s+/i, '').trim();
  return t || null;
}

export function extractUserAccessToken(req: Request): string | null {
  return (
    extractBearer(req.headers.get('x-user-jwt') || req.headers.get('X-User-Jwt')) ||
    extractBearer(req.headers.get('Authorization'))
  );
}

export interface RequireAuthOptions {
  optional?: boolean;
  roles?: Set<string> | string[];
  requireProfile?: boolean;
}

export interface AuthResult {
  admin: SupabaseAdmin;
  user: { id: string; email?: string | null };
  profile?: { id: string; role: string; email?: string | null; name?: string | null } | null;
  role?: string | null;
}

/**
 * Unified auth for Edge Functions. Returns { admin, user, profile, role, response }.
 * On error, response property is set; caller checks `if ('response' in result)`.
 *
 * Options:
 *   optional=true: missing token returns { user: null, profile: null, role: null }
 *   roles: Set or array of allowed roles; missing/invalid role returns 403 response
 *   requireProfile: if true, always fetch profile. If false, only fetch if roles gating.
 */
export async function requireAuth(
  req: Request,
  opts: RequireAuthOptions = {},
): Promise<
  AuthResult & { response?: Response }
> {
  const { optional = false, roles = null, requireProfile = true } = opts;
  const admin = createSupabaseAdmin();
  if (!admin) {
    return {
      user: { id: '', email: null },
      response: jsonResponse(500, {
        error: 'Server config invalid (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
      }),
    } as any;
  }

  const token = extractUserAccessToken(req);
  if (!token) {
    if (optional) {
      return { admin, user: { id: '', email: null }, profile: null, role: null } as any;
    }
    return {
      user: { id: '', email: null },
      response: jsonResponse(401, { error: 'Unauthorized' }),
    } as any;
  }

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return {
      user: { id: '', email: null },
      response: jsonResponse(401, { error: 'Unauthorized' }),
    } as any;
  }
  const user = userData.user;

  let profile = null;
  let role = null;
  if (requireProfile || roles) {
    const { data } = await admin
      .from('profiles')
      .select('id,role,email,name')
      .eq('id', user.id)
      .maybeSingle();
    profile = data || null;
    role = normalizeRole(profile?.role);
  }

  if (roles) {
    const allowed = roles instanceof Set ? roles : new Set(Array.isArray(roles) ? roles : [roles]);
    if (!allowed.has(role)) {
      return {
        user: { id: '', email: null },
        response: jsonResponse(403, { error: 'Forbidden' }),
      } as any;
    }
  }

  return { admin, user: { id: user.id, email: user.email }, profile, role };
}

export function requireFullStaff(req: Request, opts: Omit<RequireAuthOptions, 'roles'> = {}) {
  return requireAuth(req, { ...opts, roles: ROLE_SET_FULL_STAFF });
}

export function requireAnyStaff(req: Request, opts: Omit<RequireAuthOptions, 'roles'> = {}) {
  return requireAuth(req, { ...opts, roles: ROLE_SET_ANY_STAFF });
}

/** Backward compat: old API that worked with { response } discriminated union. */
export async function requireUser(
  req: Request,
): Promise<{ admin: SupabaseAdmin; user: { id: string; email?: string | null } } | { response: Response }> {
  const result = await requireAuth(req);
  if ('response' in result) {
    return { response: result.response };
  }
  return { admin: result.admin, user: result.user };
}

/** Backward compat: old API with role gating via array. */
export async function requireUserWithRole(
  req: Request,
  allowedRoles: string[],
): Promise<
  | { admin: SupabaseAdmin; user: { id: string; email?: string | null }; role: string }
  | { response: Response }
> {
  const result = await requireAuth(req, { roles: allowedRoles });
  if ('response' in result) {
    return { response: result.response };
  }
  return { admin: result.admin, user: result.user, role: result.role || '' };
}
