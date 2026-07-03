import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
// jsonwebtoken est disponible en transitive dep de passport-jwt
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');

export interface MedosTokenPayload {
  sub: string;       // userId côté tenant (ex: Better Auth user id)
  email: string;
  role: string;      // practitioner | admin | owner | patient
  tenant_id: string;
  tenant_slug: string;
  iss: 'medos';
}

/** Identité Cimolace enrichie renvoyée par GET /auth/me. */
export interface CimolaceIdentity {
  id: string;
  email: string;
  role: string;
  cimolace_staff: boolean;
  metadata: Record<string, unknown>;
}

/** Rôles considérés « staff » dans cimolace_staff_members (cf. CimolaceStaffGuard). */
const CIMOLACE_STAFF_ROLES = new Set(['owner', 'admin', 'support']);

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;
  private readonly jwtSecret: string;
  private readonly cimolaceAdminEmails: Set<string>;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false } },
    );
    this.jwtSecret = process.env.MEDOS_JWT_SECRET ?? '';
    if (!this.jwtSecret) {
      console.warn('[MedOS] MEDOS_JWT_SECRET non défini — le pont tenant-token ne fonctionnera pas');
    }
    this.cimolaceAdminEmails = new Set(
      String(process.env.CIMOLACE_BACKOFFICE_ADMIN_EMAILS ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  /**
   * Vérifie un token Supabase (utilisateurs internes CIMOLACE).
   * `user_metadata` / `app_metadata` sont conservés : le JWT Supabase y porte
   * `cimolace_staff`, dont /auth/me a besoin pour flaguer un opérateur Cimolace.
   */
  async verifyToken(token: string) {
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? '',
      role: 'authenticated',
      user_metadata: (data.user.user_metadata ?? {}) as Record<string, unknown>,
      app_metadata: (data.user.app_metadata ?? {}) as Record<string, unknown>,
    };
  }

  /**
   * Résout l'identité Cimolace enrichie renvoyée par GET /auth/me.
   *
   * `req.user` (posé par JwtAuthGuard → verifyToken) ne porte que
   * { id, email, role:"authenticated", user_metadata, app_metadata }. Or le front
   * (guard CimolaceProtectedOwnerRoute + callback Google) a besoin de `role`
   * (owner/admin) et surtout de `cimolace_staff` pour décider « opérateur Cimolace ».
   *
   * Staff décidé par OR sur les mêmes sources que CimolaceStaffGuard :
   *   1. user_metadata / app_metadata `cimolace_staff` (JWT)
   *   2. table cimolace_staff_members (status=active, role owner/admin/support)
   *   3. profiles.metadata.cimolace_staff (status=active)
   *   4. liste CIMOLACE_BACKOFFICE_ADMIN_EMAILS
   * Tolérant aux pannes DB : ne JAMAIS faire échouer /auth/me.
   */
  async resolveCimolaceIdentity(user: {
    id: string;
    email?: string;
    role?: string;
    user_metadata?: Record<string, unknown> | null;
    app_metadata?: Record<string, unknown> | null;
  }): Promise<CimolaceIdentity> {
    const userId = user.id;
    const email = String(user.email ?? '').toLowerCase();
    const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;

    let cimolaceStaff =
      userMeta.cimolace_staff === true || appMeta.cimolace_staff === true;
    let staffRole: string | null = null;
    let profileMetadata: Record<string, unknown> = {};

    if (email && this.cimolaceAdminEmails.has(email)) {
      cimolaceStaff = true;
    }

    try {
      const { data: staff } = await (this.supabase as any)
        .from('cimolace_staff_members')
        .select('role,status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      const role = String(staff?.role ?? '').toLowerCase();
      if (role && CIMOLACE_STAFF_ROLES.has(role)) {
        cimolaceStaff = true;
        staffRole = role;
      }
    } catch {
      // Table absente / réseau : on n'échoue pas /auth/me.
    }

    try {
      const { data: profile } = await (this.supabase as any)
        .from('profiles')
        .select('metadata,status')
        .eq('id', userId)
        .maybeSingle();
      if (profile) {
        profileMetadata = (profile.metadata as Record<string, unknown>) ?? {};
        if (profile.status === 'active' && profileMetadata.cimolace_staff === true) {
          cimolaceStaff = true;
        }
      }
    } catch {
      // idem : lecture profil best-effort.
    }

    // `role` reflète UNIQUEMENT le statut opérateur Cimolace, aligné sur
    // CimolaceStaffGuard qui IGNORE profiles.role : on ne dérive JAMAIS le rôle de
    // profiles.role pour un non-staff (sinon un tenant profiles.role="admin" serait
    // vu opérateur). Non-staff → rôle JWT ("authenticated").
    const role =
      staffRole ||
      (cimolaceStaff ? 'owner' : String(user.role ?? 'authenticated').toLowerCase());

    return {
      id: userId,
      email: user.email ?? '',
      role,
      cimolace_staff: cimolaceStaff,
      metadata: { ...profileMetadata, cimolace_staff: cimolaceStaff },
    };
  }

  /** Génère un JWT MedOS court-terme (15 min) pour un utilisateur tenant externe. */
  generateMedosToken(payload: Omit<MedosTokenPayload, 'iss'>): string {
    if (!this.jwtSecret) throw new Error('MEDOS_JWT_SECRET manquant');
    return jwt.sign({ ...payload, iss: 'medos' }, this.jwtSecret, {
      expiresIn: '15m',
      algorithm: 'HS256',
    });
  }

  /** Vérifie un JWT émis par MedOS (pont tenant externe). */
  verifyMedosToken(token: string): MedosTokenPayload | null {
    if (!this.jwtSecret) return null;
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'medos',
      }) as MedosTokenPayload;
      return payload;
    } catch {
      return null;
    }
  }

  /** Comparaison de hashes en temps constant (anti-timing-attack). */
  safeCompare(a: string, b: string): boolean {
    try {
      return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
      return false;
    }
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
