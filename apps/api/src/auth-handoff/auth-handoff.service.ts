import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Cross-app session handoff (SSO between Cimolace first-party apps).
 *
 * med-app (med.cimolace.space) and the studio (app.cimolace.space) are
 * separate origins with separate Supabase sessions. When a practitioner
 * starts a teleconsultation from med-app, we need them to land authenticated
 * in the immersive Liri room (studio) WITHOUT a second login — and without
 * ever putting a token in a URL.
 *
 * Flow:
 *   1. med-app (authenticated) calls createCode() → gets a one-time code.
 *   2. med-app opens app.cimolace.space/handoff?code=…&next=…
 *   3. studio calls exchange(code) → gets the session tokens (over HTTPS)
 *      and does supabase.auth.setSession(...).
 *
 * Tokens only ever travel in HTTPS bodies + a transient DB row. The code is
 * single-use (atomic update guard) and expires in 2 minutes.
 */
@Injectable()
export class AuthHandoffService {
  private readonly ttlSeconds = 120;

  constructor(private readonly supabase: SupabaseService) {}

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  async createCode(
    userId: string,
    accessToken: string,
    refreshToken: string,
  ): Promise<{ code: string; expires_in: number }> {
    const code = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + this.ttlSeconds * 1000,
    ).toISOString();
    const { error } = await (this.supabase.client as any)
      .from('auth_handoff_codes')
      .insert({
        code_hash: this.hash(code),
        access_token: accessToken,
        refresh_token: refreshToken,
        user_id: userId,
        expires_at: expiresAt,
      });
    if (error) {
      throw new Error('handoff create failed: ' + error.message);
    }
    return { code, expires_in: this.ttlSeconds };
  }

  /**
   * Atomically consume the code: the UPDATE only matches a row that is still
   * unused AND unexpired, so a replay (or a race) finds nothing and is
   * rejected. Returns the relayed session tokens.
   */
  async exchange(
    code: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    if (!code) throw new UnauthorizedException('Code de handoff manquant');
    const nowIso = new Date().toISOString();
    const { data, error } = await (this.supabase.client as any)
      .from('auth_handoff_codes')
      .update({ used_at: nowIso })
      .eq('code_hash', this.hash(code))
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .select('access_token, refresh_token')
      .single();
    if (error || !data) {
      throw new UnauthorizedException('Code de handoff invalide ou expiré');
    }
    return {
      access_token: (data as any).access_token,
      refresh_token: (data as any).refresh_token,
    };
  }
}
