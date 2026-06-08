/**
 * ZoomOAuthService — Gère le flux OAuth Zoom et le refresh des tokens.
 *
 * Flow :
 *   1. Admin clique "Connecter Zoom" → redirige vers Zoom authorize URL
 *   2. Zoom redirige vers /zoom-engine/oauth/callback
 *   3. On échange le code contre access_token + refresh_token
 *   4. Les tokens sont chiffrés et stockés en DB
 *   5. Le refresh est automatique via getValidToken()
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import * as crypto from 'crypto';

const ENCRYPTION_ALGO = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

@Injectable()
export class ZoomOAuthService {
  private readonly logger = new Logger(ZoomOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {
    this.clientId = this.config.get<string>('ZOOM_CLIENT_ID') || '';
    this.clientSecret = this.config.get<string>('ZOOM_CLIENT_SECRET') || '';
    this.redirectUri = this.config.get<string>('ZOOM_REDIRECT_URI')
      || 'http://localhost:4002/zoom-engine/oauth/callback';

    const keyHex = this.config.get<string>('ZOOM_TOKEN_ENCRYPTION_KEY');
    if (!keyHex || keyHex.length !== 64) {
      this.logger.warn('ZOOM_TOKEN_ENCRYPTION_KEY manquant ou invalide (doit être 32 bytes hex)');
    }
    this.encryptionKey = Buffer.from(keyHex || '0'.repeat(64), 'hex');
  }

  // ── Chiffrement / Déchiffrement ────────────────────────────────────────────

  private encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, this.encryptionKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return iv.toString('hex') + ':' + tag + ':' + encrypted;
  }

  private decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new Error('Format chiffré invalide');
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // ── Construction URL d'autorisation ────────────────────────────────────────

  getAuthorizationUrl(tenantId: string, userId: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state: Buffer.from(JSON.stringify({ tenantId, userId })).toString('base64url'),
    });
    return `https://zoom.us/oauth/authorize?${params.toString()}`;
  }

  // ── Callback OAuth : échange du code contre des tokens ────────────────────

  async handleCallback(code: string, state: string): Promise<void> {
    let tenantId: string;
    let userId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      tenantId = decoded.tenantId;
      userId = decoded.userId;
    } catch {
      throw new Error('State invalide');
    }

    const tokenResponse = await this.exchangeCode(code);
    const { access_token, refresh_token, expires_in, scope } = tokenResponse;

    const encryptedAccess = this.encrypt(access_token);
    const encryptedRefresh = this.encrypt(refresh_token);
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    // Upsert
    const existing = await this.findToken(tenantId);
    if (existing) {
      await (this.supabase.client as any)
        .from('zoom_oauth_tokens')
        .update({
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          expires_at: expiresAt.toISOString(),
          scope,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await (this.supabase.client as any)
        .from('zoom_oauth_tokens')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          expires_at: expiresAt.toISOString(),
          scope,
        });
    }

    this.logger.log(`Zoom OAuth OK pour tenant ${tenantId}`);
  }

  // ── Récupérer un token valide (avec auto-refresh) ─────────────────────────

  async getValidToken(tenantId: string): Promise<string> {
    const token = await this.findToken(tenantId);
    if (!token) throw new Error('Aucun token Zoom trouvé. Connectez d\'abord votre compte Zoom.');

    const expiresAt = new Date(token.expires_at).getTime();
    const isExpired = Date.now() > expiresAt - 60_000; // Buffer 1min

    if (isExpired && token.refresh_token) {
      return this.refreshToken(token);
    }

    return this.decrypt(token.access_token);
  }

  // ── Refresh du token ───────────────────────────────────────────────────────

  private async refreshToken(token: any): Promise<string> {
    try {
      const refreshToken = this.decrypt(token.refresh_token);
      const res = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!res.ok) {
        throw new Error(`Refresh failed: ${res.status} ${await res.text()}`);
      }

      const data = await res.json();
      const encryptedAccess = this.encrypt(data.access_token);
      const encryptedRefresh = data.refresh_token ? this.encrypt(data.refresh_token) : token.refresh_token;
      const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

      await (this.supabase.client as any)
        .from('zoom_oauth_tokens')
        .update({
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', token.id);

      return data.access_token;
    } catch (err) {
      this.logger.error(`Refresh token échoué: ${(err as Error).message}`);
      throw err;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async findToken(tenantId: string): Promise<any> {
    const { data } = await (this.supabase.client as any)
      .from('zoom_oauth_tokens')
      .select('id, access_token, refresh_token, expires_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    return data || null;
  }

  private async exchangeCode(code: string): Promise<any> {
    const res = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!res.ok) {
      throw new Error(`Échange code échoué: ${res.status} ${await res.text()}`);
    }

    return res.json();
  }

  async isConnected(tenantId: string): Promise<boolean> {
    const token = await this.findToken(tenantId);
    return !!token;
  }

  async disconnect(tenantId: string): Promise<void> {
    await (this.supabase.client as any)
      .from('zoom_oauth_tokens')
      .delete()
      .eq('tenant_id', tenantId);
  }
}
