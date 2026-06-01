/**
 * TeamInvitesService — invitations équipe + admin invite.
 *
 * Tables requises (à créer en migration si absentes) :
 *   - team_invitations (MANQUANTE en DB courante)
 *   - access_audit_log (MANQUANTE en DB courante)
 *   - profiles (existe)
 *
 * En cas d'absence de table, on retourne une erreur explicite côté API.
 */

import { BadRequestException, Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

const ALLOWED_ROLES = new Set([
  'teacher',
  'secretariat',
  'admin',
  'creator',
  'student',
  'commercial',
  'support',
  'content_editor',
  'admin_limite',
  'owner',
]);

@Injectable()
export class TeamInvitesService {
  private readonly logger = new Logger(TeamInvitesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private getRedirectUrl(): string {
    const base =
      this.config.get<string>('APP_BASE_URL') ??
      this.config.get<string>('NEXT_PUBLIC_APP_URL') ??
      'https://app.cimolace.com';
    return `${base.replace(/\/$/, '')}/auth/callback`;
  }

  // ─── 1. Send team invite ──────────────────────────────────────────────────

  async sendInvite(
    tenantId: string,
    requesterId: string,
    requesterRole: string,
    input: {
      email?: string;
      role?: string;
      firstName?: string;
      lastName?: string;
      permissionsInitial?: string[];
      scope?: string;
      customMessage?: string;
      validityDays?: number;
    },
  ) {
    const email = (input.email ?? '').trim().toLowerCase();
    const role = (input.role ?? '').trim().toLowerCase();
    const firstName = (input.firstName ?? '').trim();
    const lastName = (input.lastName ?? '').trim();
    const validityDays = Math.min(30, Math.max(1, Number(input.validityDays ?? 7) || 7));

    if (!email) throw new BadRequestException('email requis');
    if (!ALLOWED_ROLES.has(role)) throw new BadRequestException('Invalid role');

    const lowerRole = requesterRole.toLowerCase();
    if (lowerRole !== 'owner' && ['owner', 'admin'].includes(role)) {
      throw new ForbiddenException('Only owner can invite owner/admin');
    }
    if (lowerRole === 'secretariat' && ['owner', 'admin', 'secretariat'].includes(role)) {
      throw new ForbiddenException('Le secrétariat ne peut pas inviter ce rôle.');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    let authInviteId: string | null = null;
    try {
      const { data: inviteData, error: inviteError } = await (this.supabase
        .client as any).auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: [firstName, lastName].filter(Boolean).join(' ') || email,
          role,
          status: 'active',
          tenant_id: tenantId,
        },
        redirectTo: this.getRedirectUrl(),
      });
      if (inviteError) {
        const msg = String(inviteError.message ?? '').toLowerCase();
        if (msg.includes('already') || msg.includes('registered')) {
          throw new BadRequestException(
            'Cet email a déjà un compte. L\'utilisateur peut se connecter directement.',
          );
        }
        throw new BadRequestException(inviteError.message);
      }
      authInviteId = inviteData?.user?.id ?? null;

      if (authInviteId) {
        await (this.supabase.client as any).from('profiles').upsert(
          {
            id: authInviteId,
            email,
            name: [firstName, lastName].filter(Boolean).join(' ') || email,
            role,
            status: 'active',
          },
          { onConflict: 'id' },
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof ForbiddenException) throw err;
      throw new BadRequestException((err as Error).message ?? 'Invite failed');
    }

    // Insert in team_invitations (TABLE may be missing — handled gracefully)
    let invitation: any = null;
    try {
      const { data, error } = await (this.supabase.client as any)
        .from('team_invitations')
        .insert({
          email,
          first_name: firstName || null,
          last_name: lastName || null,
          role,
          permissions_initial: input.permissionsInitial ?? [],
          scope: input.scope ?? null,
          expires_at: expiresAt.toISOString(),
          invited_by: requesterId,
          auth_invite_id: authInviteId,
          status: 'pending',
          custom_message: input.customMessage ?? null,
          cimolace_tenant_id: tenantId,
        })
        .select('id, email, role, expires_at, status')
        .single();
      if (error) {
        this.logger.warn(`team_invitations insert: ${error.message}`);
      } else {
        invitation = data;
      }
    } catch (e) {
      this.logger.warn(`team_invitations table missing? ${(e as Error).message}`);
    }

    // Audit log (table may be missing)
    try {
      await (this.supabase.client as any).from('access_audit_log').insert({
        action: 'team_invitation_created',
        resource_type: 'team_invitation',
        resource_id: invitation?.id ?? null,
        actor_id: requesterId,
        changes: { email, role, expires_at: expiresAt.toISOString() },
        cimolace_tenant_id: tenantId,
      });
    } catch {
      /* audit non bloquant */
    }

    return {
      ok: true,
      invitation: invitation ?? {
        email,
        role,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
        auth_invite_id: authInviteId,
        note: 'team_invitations table missing — only auth invite created',
      },
      message: 'Invitation envoyée par email.',
    };
  }

  // ─── 2. Resend link ───────────────────────────────────────────────────────

  async resendLink(tenantId: string, requesterRole: string, invitationId: string) {
    const lowerRole = requesterRole.toLowerCase();
    if (lowerRole !== 'owner' && lowerRole !== 'admin') {
      throw new ForbiddenException('Only owner/admin can resend invites');
    }
    if (!invitationId) throw new BadRequestException('invitationId requis');

    let inv: any = null;
    try {
      const { data } = await (this.supabase.client as any)
        .from('team_invitations')
        .select('id, email, auth_invite_id')
        .eq('id', invitationId)
        .eq('status', 'pending')
        .maybeSingle();
      inv = data;
    } catch (e) {
      this.logger.warn(`team_invitations missing: ${(e as Error).message}`);
      throw new BadRequestException('team_invitations table indisponible');
    }
    if (!inv) throw new NotFoundException('Invitation introuvable ou expirée');

    const { data: linkData, error } = await (this.supabase.client as any).auth.admin.generateLink({
      type: 'magiclink',
      email: inv.email,
      options: { redirectTo: this.getRedirectUrl() },
    });
    if (error) throw new BadRequestException(error.message ?? 'Generate link failed');

    const link = linkData?.properties?.action_link ?? linkData?.action_link ?? null;
    if (!link) throw new BadRequestException('Lien non généré');

    return { ok: true, link, email: inv.email };
  }

  // ─── 3. Admin invite (création + activation) ──────────────────────────────

  async adminInvite(
    tenantId: string,
    requesterRole: string,
    input: { email?: string; name?: string; role?: string; status?: string },
  ) {
    const lowerRole = requesterRole.toLowerCase();
    if (lowerRole !== 'owner' && lowerRole !== 'admin') {
      throw new ForbiddenException('Forbidden');
    }

    const email = (input.email ?? '').trim().toLowerCase();
    const name = (input.name ?? '').trim();
    const role = (input.role ?? '').trim().toLowerCase();
    const status = (input.status ?? 'active').trim().toLowerCase();

    const allowedRoles = [
      'owner',
      'admin',
      'creator',
      'secretariat',
      'teacher',
      'student',
      'visitor',
    ];
    const allowedStatuses = ['active', 'inactive', 'suspended'];

    if (!email) throw new BadRequestException('Email requis');
    if (!allowedRoles.includes(role)) throw new BadRequestException('Invalid role');
    if (!allowedStatuses.includes(status)) throw new BadRequestException('Invalid status');

    if (lowerRole !== 'owner' && (role === 'owner' || role === 'admin')) {
      throw new ForbiddenException('Only owner can assign owner/admin role');
    }

    const { data: inviteData, error: inviteError } = await (this.supabase
      .client as any).auth.admin.inviteUserByEmail(email, {
      data: { full_name: name, role, status, tenant_id: tenantId },
    });
    if (inviteError) throw new BadRequestException(inviteError.message);

    const invitedId = inviteData?.user?.id;
    if (!invitedId) throw new BadRequestException('Invite succeeded but user id missing');

    await (this.supabase.client as any).from('profiles').upsert(
      { id: invitedId, email, name, role, status },
      { onConflict: 'id' },
    );

    return { ok: true, user: { id: invitedId, email, name, role, status } };
  }
}
