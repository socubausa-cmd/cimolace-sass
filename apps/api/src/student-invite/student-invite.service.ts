import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AuthService } from '../auth/auth.service';

/**
 * Accès élève par CODE OTP à usage unique (L5). Décision produit :
 *  - code 8 caractères, jamais stocké en clair (seul le sha256 vit en base) ;
 *  - table `tenant_invitations` (token = hash, status, attempts, expires_at) ;
 *  - expiration 7 jours ; LOCKOUT à 5 essais ; une seule invitation active par
 *    (tenant, email) — toute nouvelle génération annule les précédentes ;
 *  - le redeem crée/retrouve le compte Supabase, pose le mot de passe choisi, et
 *    accorde la membership `student` (idempotent, jamais de downgrade).
 *
 * Séparation dure : ce code délivre une MEMBERSHIP (accès espace durable), jamais
 * un token de salle live. Patron aligné sur medos/invitations (accept).
 */
@Injectable()
export class StudentInviteService {
  private readonly logger = new Logger(StudentInviteService.name);
  private static readonly CODE_LEN = 8;
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly EXPIRY_DAYS = 7;
  // Alphabet sans caractères ambigus (0/O, 1/I/L) — code lisible/tapable.
  private static readonly ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  constructor(private readonly auth: AuthService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.auth.getClient();
  }

  private normalizeEmail(email: string): string {
    return String(email || '').trim().toLowerCase();
  }

  private normalizeCode(code: string): string {
    return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private hash(code: string): string {
    return createHash('sha256').update(this.normalizeCode(code)).digest('hex');
  }

  private genCode(): string {
    const { ALPHABET, CODE_LEN } = StudentInviteService;
    const bytes = randomBytes(CODE_LEN);
    let s = '';
    for (let i = 0; i < CODE_LEN; i += 1) s += ALPHABET[bytes[i] % ALPHABET.length];
    return s;
  }

  /** Résout un tenant ACTIF par slug → id. Null sinon. */
  private async tenantIdBySlug(slug: string): Promise<string | null> {
    const { data } = await this.db
      .from('tenants')
      .select('id, status')
      .eq('slug', String(slug || '').trim().toLowerCase())
      .maybeSingle();
    if (!data || data.status !== 'active') return null;
    return data.id as string;
  }

  /**
   * Génère un code OTP pour (tenant, email, role) et l'ENVOIE par email_queue.
   * Annule toute invitation active précédente (une seule valable à la fois).
   * `revealCode` (tests uniquement) renvoie le code en clair — JAMAIS en prod.
   */
  async generateAndSend(opts: {
    tenantId: string;
    email: string;
    role?: string;
    invitedBy?: string | null;
    revealCode?: boolean;
  }): Promise<{ ok: true; code?: string }> {
    const email = this.normalizeEmail(opts.email);
    if (!email || !/.+@.+\..+/.test(email)) {
      throw new BadRequestException('Email invalide.');
    }
    const role = ['student', 'teacher', 'member'].includes(String(opts.role))
      ? String(opts.role)
      : 'student';

    // Invalide les invitations encore ouvertes pour ce (tenant, email).
    await this.db
      .from('tenant_invitations')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('tenant_id', opts.tenantId)
      .eq('email', email)
      .in('status', ['pending', 'sent', 'opened']);

    const expiresAt = new Date(
      Date.now() + StudentInviteService.EXPIRY_DAYS * 86_400_000,
    ).toISOString();

    let code = '';
    let inserted = false;
    for (let tries = 0; tries < 6 && !inserted; tries += 1) {
      code = this.genCode();
      const { error } = await this.db.from('tenant_invitations').insert({
        tenant_id: opts.tenantId,
        email,
        role,
        token: this.hash(code),
        status: 'sent',
        attempts: 0,
        invited_by: opts.invitedBy ?? null,
        expires_at: expiresAt,
      });
      if (!error) inserted = true;
      else if (!/duplicate|unique/i.test(error.message || '')) {
        this.logger.error(`OTP insert: ${error.message}`);
        throw new InternalServerErrorException("Impossible de générer le code d'accès.");
      }
    }
    if (!inserted) throw new InternalServerErrorException('Génération du code impossible (réessayez).');

    await this.sendCodeEmail(opts.tenantId, email, code);
    return opts.revealCode ? { ok: true, code } : { ok: true };
  }

  /** Envoie le code par email_queue (expéditeur = domaine du tenant si configuré). Best-effort. */
  private async sendCodeEmail(tenantId: string, email: string, code: string): Promise<void> {
    try {
      const { data: ns } = await this.db
        .from('tenant_notification_settings')
        .select('email_from, email_from_name')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const { data: t } = await this.db
        .from('tenants')
        .select('name, slug')
        .eq('id', tenantId)
        .maybeSingle();
      const schoolName = t?.name || 'votre école';
      const activateUrl = t?.slug
        ? `${process.env.SCHOOL_FRONTEND_URL ?? 'https://prorascience.org'}/t/${t.slug}/activer?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`
        : null;
      await this.db.from('email_queue').insert({
        tenant_id: tenantId,
        to: email,
        from: ns?.email_from ?? null,
        from_name: ns?.email_from_name ?? null,
        subject: `Votre code d'accès — ${schoolName}`,
        html_body:
          `<h2>Bienvenue chez ${schoolName}</h2>` +
          `<p>Voici votre code d'accès à usage unique :</p>` +
          `<p style="font-size:26px;font-weight:800;letter-spacing:4px;font-family:monospace;">${code}</p>` +
          `<p>Il est valable 7 jours. Saisissez-le sur la page d'activation pour créer votre mot de passe et accéder à votre espace.</p>` +
          (activateUrl
            ? `<p><a href="${activateUrl}" style="display:inline-block;background:#d97757;color:#000;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:700;">Activer mon accès</a></p>`
            : '') +
          `<p style="color:#888;font-size:12px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
        status: 'pending',
      });
    } catch (e) {
      this.logger.warn(`sendCodeEmail (${email}): ${(e as Error).message}`);
    }
  }

  /**
   * Redeem d'un code : (tenant, email, code, password) → compte + membership.
   * Lockout à 5 essais (status='locked'), expiration honorée, code haché comparé.
   * Le rôle est FORCÉ à celui de l'invitation (jamais choisi par le porteur).
   */
  async redeem(opts: {
    tenantSlug?: string;
    tenantId?: string;
    email: string;
    code: string;
    password: string;
  }): Promise<{ ok: true; email: string; tenantSlug: string | null }> {
    const tenantId = opts.tenantId ?? (opts.tenantSlug ? await this.tenantIdBySlug(opts.tenantSlug) : null);
    if (!tenantId) throw new NotFoundException('École introuvable.');
    const email = this.normalizeEmail(opts.email);
    const password = String(opts.password ?? '');
    if (!email) throw new BadRequestException('Email requis.');
    if (password.length < 8) throw new BadRequestException('Mot de passe : 8 caractères minimum.');

    const { data: inv } = await this.db
      .from('tenant_invitations')
      .select('id, email, role, token, status, attempts, expires_at')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .in('status', ['pending', 'sent', 'opened'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!inv) throw new BadRequestException('Code invalide ou expiré. Demandez un nouveau code.');
    if (new Date(inv.expires_at) < new Date()) {
      await this.db.from('tenant_invitations').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', inv.id);
      throw new BadRequestException('Code expiré. Demandez un nouveau code.');
    }
    if ((inv.attempts ?? 0) >= StudentInviteService.MAX_ATTEMPTS) {
      await this.db.from('tenant_invitations').update({ status: 'locked', updated_at: new Date().toISOString() }).eq('id', inv.id);
      throw new ForbiddenException('Trop de tentatives. Demandez un nouveau code.');
    }

    // Comparaison du code (haché). Échec → incrémente attempts, verrouille à 5.
    if (this.hash(opts.code) !== inv.token) {
      const attempts = (inv.attempts ?? 0) + 1;
      const patch: Record<string, unknown> = { attempts, updated_at: new Date().toISOString() };
      const remaining = StudentInviteService.MAX_ATTEMPTS - attempts;
      if (remaining <= 0) patch.status = 'locked';
      await this.db.from('tenant_invitations').update(patch).eq('id', inv.id);
      if (remaining <= 0) {
        throw new ForbiddenException('Trop de tentatives. Demandez un nouveau code.');
      }
      throw new BadRequestException(`Code incorrect. ${remaining} tentative(s) restante(s).`);
    }

    // Succès : compte + mot de passe + membership. Le rôle vient de l'INVITATION.
    const role = ['student', 'teacher', 'member'].includes(String(inv.role)) ? String(inv.role) : 'student';
    const userId = await this.ensureUserWithPassword(email, password);

    await this.db.from('tenant_memberships').upsert(
      { tenant_id: tenantId, user_id: userId, role, status: 'active' },
      { onConflict: 'tenant_id,user_id', ignoreDuplicates: true },
    );
    // Promeut le rôle GLOBAL visitor→student (jamais de downgrade).
    try {
      const { data: profile } = await this.db.from('profiles').select('role').eq('id', userId).maybeSingle();
      const gRole = String(profile?.role || '').toLowerCase();
      if (!gRole || gRole === 'visitor') {
        await this.db.from('profiles').update({ role: 'student' }).eq('id', userId);
      }
    } catch {
      /* best-effort */
    }

    await this.db
      .from('tenant_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', inv.id);

    const { data: t } = await this.db.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
    return { ok: true, email, tenantSlug: t?.slug ?? opts.tenantSlug ?? null };
  }

  /**
   * Trouve (par email) ou crée le compte Supabase, puis pose le mot de passe +
   * confirme l'email. Utilise l'API admin REST (comme medos/invitations.accept).
   */
  private async ensureUserWithPassword(email: string, password: string): Promise<string> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) throw new InternalServerErrorException('Supabase non configuré.');
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

    let userId: string | undefined;
    const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers });
    if (listRes.ok) {
      const data = (await listRes.json()) as { users?: { id: string; email?: string }[] };
      const existing = (data?.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (existing) userId = existing.id;
    }

    if (!userId) {
      const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { created_via: 'student-otp-redeem' } }),
      });
      if (!createRes.ok) {
        const body = await createRes.text();
        this.logger.error(`redeem create user failed: ${createRes.status} ${body}`);
        throw new InternalServerErrorException('Création du compte impossible.');
      }
      userId = ((await createRes.json()) as { id: string }).id;
      return userId;
    }

    const pwRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ password, email_confirm: true }),
    });
    if (!pwRes.ok) {
      const body = await pwRes.text();
      this.logger.error(`redeem set password failed: ${pwRes.status} ${body}`);
      throw new InternalServerErrorException('Définition du mot de passe impossible.');
    }
    return userId;
  }
}
