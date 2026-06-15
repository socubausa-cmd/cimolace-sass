import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
} from './dto/invitations.dto';

const DEFAULT_EXPIRY_DAYS = 7;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Crée une invitation. Retourne le `raw_token` UNE SEULE FOIS — c'est lui
   * qui doit être envoyé au patient (par email/SMS hors API pour le MVP).
   */
  async create(
    tenant: TenantContext,
    actorId: string,
    dto: CreateInvitationDto,
  ): Promise<{
    invitation: Record<string, unknown>;
    raw_token: string;
    accept_url: string;
  }> {
    if (!dto.invited_email && !dto.invited_phone) {
      throw new BadRequestException(
        'Au moins un canal de contact requis (email ou téléphone)',
      );
    }

    // Vérifier patient existe dans le tenant
    const { data: patient } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('id', dto.patient_id)
      .single();
    if (!patient) throw new NotFoundException('Patient introuvable');

    const random = randomBytes(24).toString('hex');
    const rawToken = `inv_${tenant.slug}_${random}`;
    const tokenPrefix = `inv_${tenant.slug}_${random.slice(0, 6)}…`;
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date(
      Date.now() +
        (dto.expires_in_days ?? DEFAULT_EXPIRY_DAYS) * 86_400_000,
    ).toISOString();

    const { data, error } = await (this.supabase.client as any)
      .from('med_patient_invitations')
      .insert({
        tenant_id: tenant.id,
        patient_id: dto.patient_id,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        invited_email: dto.invited_email ?? null,
        invited_phone: dto.invited_phone ?? null,
        invited_name: dto.invited_name,
        expires_at: expiresAt,
        sent_via: dto.sent_via ?? null,
        sent_at: dto.sent_via ? new Date().toISOString() : null,
        status: dto.sent_via ? 'sent' : 'pending',
        created_by: actorId,
        custom_message: dto.custom_message ?? null,
      })
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error('createInvitation', error?.message);
      throw new InternalServerErrorException(
        "Création de l'invitation impossible",
      );
    }

    // TODO : déclencher l'envoi via apps/worker (Resend/Twilio).
    // Pour le MVP, le staff reçoit le raw_token et l'envoie manuellement.
    const acceptUrl = `https://${tenant.slug}.patient.cimolace.space/invite/accept?token=${rawToken}`;

    return {
      invitation: data as Record<string, unknown>,
      raw_token: rawToken,
      accept_url: acceptUrl,
    };
  }

  async list(tenant: TenantContext, status?: string) {
    let q = this.supabase.client
      .from('med_patient_invitations')
      .select('*')
      .eq('tenant_id', tenant.id);
    if (status) q = q.eq('status', status);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async resend(
    tenant: TenantContext,
    invitationId: string,
  ): Promise<{ id: string; resent_count: number }> {
    const { data: existing } = await this.supabase.client
      .from('med_patient_invitations')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', invitationId)
      .single();
    if (!existing) throw new NotFoundException();

    const row = existing as any;
    if (row.status === 'accepted' || row.status === 'cancelled') {
      throw new BadRequestException(
        `Impossible de renvoyer une invitation en statut "${row.status}"`,
      );
    }
    if (new Date(row.expires_at) < new Date()) {
      throw new BadRequestException(
        "L'invitation a expiré — créez-en une nouvelle",
      );
    }

    const { data, error } = await (this.supabase.client as any)
      .from('med_patient_invitations')
      .update({
        resent_count: (row.resent_count ?? 0) + 1,
        last_resent_at: new Date().toISOString(),
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', invitationId)
      .select('id, resent_count')
      .single();
    if (error || !data)
      throw new InternalServerErrorException('Renvoi impossible');
    return data as { id: string; resent_count: number };
  }

  async cancel(
    tenant: TenantContext,
    invitationId: string,
  ): Promise<{ id: string }> {
    const { data, error } = await (this.supabase.client as any)
      .from('med_patient_invitations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant.id)
      .eq('id', invitationId)
      .in('status', ['pending', 'sent', 'opened'])
      .select('id')
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Invitation introuvable ou déjà traitée');
    return { id: (data as any).id };
  }

  /**
   * Accepte une invitation et active l'accès patient. Le patient choisit son
   * mot de passe : on retrouve (ou crée) son compte Supabase à partir de
   * l'email invité, on y pose le mot de passe, on garantit le membership
   * 'patient' du tenant et on lie le compte au dossier. Le patient peut alors
   * se connecter au portail avec email + mot de passe.
   *
   * Endpoint NON authentifié — c'est le point d'entrée du patient invité
   * (pas de session préalable, donc pas d'UUID à fournir : tout est dérivé du
   * token + de l'email de l'invitation).
   */
  async accept(dto: AcceptInvitationDto): Promise<{
    invitation_id: string;
    patient_id: string;
    tenant_id: string;
    email: string | null;
  }> {
    if (!dto.token.startsWith('inv_')) {
      throw new BadRequestException('Token invalide');
    }
    const hash = createHash('sha256').update(dto.token).digest('hex');

    const { data: inv, error } = await (this.supabase.client as any)
      .from('med_patient_invitations')
      .select('*')
      .eq('token_hash', hash)
      .maybeSingle();
    if (error || !inv) throw new NotFoundException('Invitation introuvable');

    const row = inv as any;
    if (row.status === 'accepted') {
      throw new BadRequestException('Invitation déjà acceptée');
    }
    if (row.status === 'cancelled') {
      throw new BadRequestException('Invitation annulée');
    }
    if (new Date(row.expires_at) < new Date()) {
      // Marquer expirée
      await (this.supabase.client as any)
        .from('med_patient_invitations')
        .update({ status: 'expired' })
        .eq('id', row.id);
      throw new BadRequestException('Invitation expirée');
    }

    // Le dossier patient a-t-il déjà un compte auth ? (cas normal : createPatient
    // l'a provisionné — passwordless — au moment de l'ajout du patient.)
    const { data: patient } = await (this.supabase.client as any)
      .from('med_patients')
      .select('id, patient_user_id')
      .eq('id', row.patient_id)
      .eq('tenant_id', row.tenant_id)
      .maybeSingle();

    const email: string | null = (row.invited_email as string | null) ?? null;

    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      throw new InternalServerErrorException('Supabase non configuré');
    }
    const adminHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    };

    // Résoudre le compte auth : déjà lié au dossier, sinon recherche/création
    // par email (réplique la logique de MedosService.ensurePatientUser).
    let userId: string | undefined =
      ((patient as any)?.patient_user_id as string | null) ?? undefined;

    if (!userId) {
      if (!email) {
        throw new BadRequestException(
          "Cette invitation n'a pas d'email associé — impossible de créer un accès. Contactez votre praticien.",
        );
      }
      const listRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        { headers: adminHeaders },
      );
      if (listRes.ok) {
        const data = (await listRes.json()) as {
          users?: { id: string; email?: string }[];
        };
        const existing = (data?.users || []).find(
          (u) => u.email?.toLowerCase() === email.toLowerCase(),
        );
        if (existing) userId = existing.id;
      }
      if (!userId) {
        const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({
            email,
            password: dto.password,
            email_confirm: true,
            user_metadata: { created_via: 'medos-invite-accept' },
          }),
        });
        if (!createRes.ok) {
          const body = await createRes.text();
          this.logger.error(
            `accept create user failed: ${createRes.status} ${body}`,
          );
          throw new InternalServerErrorException(
            'Création du compte impossible',
          );
        }
        userId = ((await createRes.json()) as { id: string }).id;
      }
    }

    // Poser / réinitialiser le mot de passe choisi + confirmer l'email.
    const pwRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userId}`,
      {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ password: dto.password, email_confirm: true }),
      },
    );
    const pwText = await pwRes.text();
    if (!pwRes.ok) {
      this.logger.error(`accept set password failed: ${pwRes.status} ${pwText}`);
      throw new InternalServerErrorException(
        'Définition du mot de passe impossible',
      );
    }
    // Email canonique du compte = l'identifiant de connexion réel. Il peut
    // différer de invited_email si le dossier était déjà lié à un compte
    // existant — c'est CET email que le patient doit utiliser pour se connecter.
    let loginEmail: string | null = email;
    try {
      const u = JSON.parse(pwText) as { email?: string };
      if (u?.email) loginEmail = u.email;
    } catch {
      /* garde invited_email en repli */
    }

    // Garantir le membership 'patient' sur ce tenant (idempotent).
    await (this.supabase.client as any)
      .from('tenant_memberships')
      .upsert(
        {
          tenant_id: row.tenant_id,
          user_id: userId,
          role: 'patient',
          status: 'active',
        },
        { onConflict: 'tenant_id,user_id' },
      );

    // Lier le compte au dossier patient.
    await (this.supabase.client as any)
      .from('med_patients')
      .update({ patient_user_id: userId })
      .eq('id', row.patient_id)
      .eq('tenant_id', row.tenant_id);

    // Marquer l'invitation acceptée.
    const { data: updated, error: upErr } = await (
      this.supabase.client as any
    )
      .from('med_patient_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: userId,
        opened_at: row.opened_at ?? new Date().toISOString(),
      })
      .eq('id', row.id)
      .select('id, tenant_id, patient_id')
      .single();
    if (upErr || !updated) {
      throw new InternalServerErrorException('Acceptation impossible');
    }

    return {
      invitation_id: (updated as any).id,
      patient_id: (updated as any).patient_id,
      tenant_id: (updated as any).tenant_id,
      email: loginEmail,
    };
  }
}
