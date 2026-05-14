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

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;
  private readonly jwtSecret: string;

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
  }

  /** Vérifie un token Supabase (utilisateurs internes CIMOLACE). */
  async verifyToken(token: string) {
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? '', role: 'authenticated' };
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
