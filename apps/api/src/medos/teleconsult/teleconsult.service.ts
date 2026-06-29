import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
// IMPORTANT — P5 architectural decision:
// MEDOS routes ALL video sessions through Liri (LiveService), not LiveKit
// directly. This is the contract: one video authority for the whole
// platform, so MEDOS / Mbolo / ISNA share recording, replay, billing
// minutes, and any future provider swap. After P5.4, MEDOS no longer
// imports LiveKitService or LiveKitModule at all.
import { LiveService } from '../../live/live.service';
import type { TenantContext } from '../../tenant/tenant.types';
import {
  CreateTeleconsultDto,
  EndTeleconsultDto,
} from './dto/teleconsult.dto';

@Injectable()
export class TeleconsultService {
  private readonly logger = new Logger(TeleconsultService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly liri: LiveService,
  ) {}

  /**
   * Crée une session de téléconsultation : record DB + room LiveKit. Si un
   * appointment_id est fourni, le RDV est passé en type 'teleconsult'.
   */
  async create(
    tenant: TenantContext,
    practitionerId: string,
    dto: CreateTeleconsultDto,
  ) {
    const { data: patient, error: patErr } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('id', dto.patient_id)
      .single();
    if (patErr || !patient) throw new NotFoundException('Patient introuvable');

    // Pré-créer un ID pour pouvoir générer le room name. Liri.roomNameFor
    // est une fonction pure — pas besoin de provisionner la room LiveKit
    // à ce stade (Liri.issueTokenForSession s'en occupe au premier join).
    const tempSessionId = crypto.randomUUID();
    const roomName = this.liri.roomNameFor(tenant.slug, tempSessionId);

    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_sessions')
      .insert({
        id: tempSessionId,
        tenant_id: tenant.id,
        appointment_id: dto.appointment_id ?? null,
        patient_id: dto.patient_id,
        practitioner_id: practitionerId,
        livekit_room_name: roomName,
        status: 'scheduled',
        recording_consented: dto.recording_consented ?? false,
      })
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error('createTeleconsult', error?.message);
      throw new InternalServerErrorException(
        'Création de la session impossible',
      );
    }

    // Lier le RDV à la session
    if (dto.appointment_id) {
      await (this.supabase.client as any)
        .from('med_appointments')
        .update({
          teleconsult_session_id: (data as any).id,
          appointment_type: 'teleconsult',
        })
        .eq('tenant_id', tenant.id)
        .eq('id', dto.appointment_id);
    }

    return data;
  }

  /**
   * Issue a video session token. ROUTED THROUGH LIRI — MEDOS no longer
   * touches LiveKit directly. The medical access control (patient owns
   * the session, doctor belongs to the tenant) stays here; the actual
   * token issuance is delegated to Liri so recording / replay / billing
   * minutes can be unified across MEDOS / Mbolo / ISNA.
   */
  async issueToken(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    sessionId: string,
    displayName?: string,
  ): Promise<{ room: string; token: string; url: string; ttl: string }> {
    const { data: session, error } = await this.supabase.client
      .from('med_teleconsult_sessions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', sessionId)
      .single();
    if (error || !session) throw new NotFoundException('Session introuvable');

    // Medical access control (kept in MEDOS — Liri doesn't need to know
    // about patient_user_id ↔ session.patient_id rules).
    if (actorRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', (session as any).patient_id)
        .single();
      if ((pat as any)?.patient_user_id !== actorId) {
        throw new ForbiddenException('Accès refusé à cette session');
      }
    }

    const isHost =
      actorRole === 'practitioner' ||
      actorRole === 'owner' ||
      actorRole === 'clinic_admin';

    // Bridge → full immersive Liri room. When the practitioner (host) starts
    // the call, mirror this teleconsult into a `live_sessions` row whose id
    // EQUALS the teleconsult session id. Because the LiveKit room name is
    // derived from that id (scopedRoomName(slug, id)), the immersive
    // LiveHostPage (which the practitioner opens at /studio/live-arena/:id)
    // and the patient (whose token is derived from the same id) land in the
    // SAME room — with zero change to the shared live-class token path.
    if (isHost) {
      await this.ensureImmersiveLiveSession(
        tenant,
        session as any,
        actorId,
      );
    }

    // Delegate to Liri. The session.id is a stable, unique external_ref
    // so re-joins reuse the same LiveKit room. The metadata blob lets the
    // billing UI link back to the medical appointment without re-querying
    // the MEDOS-owned table.
    const result = await this.liri.issueTokenForSession({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      externalRef: sessionId,
      purpose: 'medical_teleconsult',
      userId: actorId,
      displayName,
      role: isHost ? 'host' : 'guest',
      // A teleconsultation is a two-way call: the PATIENT (guest) must be
      // able to publish their camera + mic. Without this they'd get a
      // subscribe-only token and stay invisible to the practitioner.
      guestCanPublish: true,
      metadata: {
        appointment_id: (session as any).appointment_id ?? null,
        patient_id: (session as any).patient_id ?? null,
      },
    });

    return {
      room: result.room,
      token: result.token,
      url: result.url,
      ttl: result.ttl,
    };
  }

  /**
   * Contexte clinique d'une session de téléconsultation, pour le COCKPIT
   * partagé (jumeau 3D / SOAP / graphiques) — côté studio (praticien) ET
   * côté patient.
   *
   * Ne renvoie QUE le strict nécessaire pour amorcer le chargement du
   * dossier : l'id du patient + son nom d'affichage + le rôle de l'appelant.
   * AUCUNE donnée clinique ici — le cockpit charge ensuite le jumeau / la
   * note via leurs endpoints dédiés (déjà gardés indépendamment).
   *
   * Contrôle d'accès STRICT (leçon C1 — la service-role contourne la RLS,
   * l'isolation est donc 100 % applicative) :
   *   - patient : doit être LE patient de cette session (patient_user_id) ;
   *   - staff   : practitioner / owner / clinic_admin du tenant (le select
   *               est déjà tenant-scopé) ;
   *   - tout autre cas → 403.
   */
  async getClinicalContext(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    sessionId: string,
  ): Promise<{
    session_id: string;
    patient_id: string;
    patient_name: string;
    sex: 'female' | 'male';
    practitioner_id: string;
    appointment_id: string | null;
    role: 'host' | 'patient';
  }> {
    const { data: session, error } = await this.supabase.client
      .from('med_teleconsult_sessions')
      .select('id, patient_id, practitioner_id, appointment_id')
      .eq('tenant_id', tenant.id)
      .eq('id', sessionId)
      .single();
    if (error || !session) throw new NotFoundException('Session introuvable');

    const isHost =
      actorRole === 'practitioner' ||
      actorRole === 'owner' ||
      actorRole === 'clinic_admin';

    if (actorRole === 'patient') {
      // Le patient ne voit le contexte QUE de sa propre session.
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', (session as any).patient_id)
        .single();
      if ((pat as any)?.patient_user_id !== actorId) {
        throw new ForbiddenException('Accès refusé à cette session');
      }
    } else if (!isHost) {
      // Ni patient propriétaire, ni staff soignant → interdit.
      throw new ForbiddenException('Accès refusé à cette session');
    }

    const { data: patient } = await this.supabase.client
      .from('med_patients')
      .select('first_name, last_name, gender')
      .eq('tenant_id', tenant.id)
      .eq('id', (session as any).patient_id)
      .single();

    const fullName = patient
      ? `${(patient as any).first_name ?? ''} ${(patient as any).last_name ?? ''}`.trim()
      : '';
    // Corps 3D : 'male' uniquement si explicitement masculin, sinon 'female'
    // (modèle par défaut du jumeau). Aucune autre valeur de gender n'est
    // exposée — seul le choix de mesh anatomique en dépend.
    const sex: 'female' | 'male' =
      String((patient as any)?.gender ?? '').toLowerCase().startsWith('m')
        ? 'male'
        : 'female';

    return {
      session_id: (session as any).id,
      patient_id: (session as any).patient_id,
      patient_name: fullName || 'Patient',
      sex,
      practitioner_id: (session as any).practitioner_id,
      appointment_id: (session as any).appointment_id ?? null,
      role: isHost ? 'host' : 'patient',
    };
  }

  /**
   * Mirror a teleconsult session into a `live_sessions` row so the FULL
   * immersive Liri room (LiveHostPage — video grid + SmartBoard for the
   * practitioner to present images / sketch) can mount on it. Idempotent:
   * the row id == the teleconsult session id, so re-calls are no-ops.
   *
   * Additive by design — `kind='teleconsult'` keeps these rows out of the
   * live-class listings, and nothing in the class path is touched.
   */
  private async ensureImmersiveLiveSession(
    tenant: TenantContext,
    session: {
      id: string;
      patient_id: string;
      livekit_room_name: string;
    },
    hostUserId: string,
  ): Promise<void> {
    try {
      const { data: existing } = await this.supabase.client
        .from('live_sessions')
        .select('id')
        .eq('id', session.id)
        .maybeSingle();
      if (existing) return;

      // Nice human title from the patient name (best-effort).
      let title = 'Téléconsultation';
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('first_name, last_name')
        .eq('id', session.patient_id)
        .maybeSingle();
      const name = `${(pat as any)?.first_name ?? ''} ${(pat as any)?.last_name ?? ''}`.trim();
      if (name) title = `Téléconsultation — ${name}`;

      const { error } = await (this.supabase.client as any)
        .from('live_sessions')
        .insert({
          id: session.id,
          tenant_id: tenant.id,
          host_user_id: hostUserId,
          title,
          scheduled_at: new Date().toISOString(),
          status: 'scheduled',
          kind: 'teleconsult',
          livekit_room_name: session.livekit_room_name,
        });
      if (error && !String(error.message).includes('duplicate')) {
        this.logger.warn(
          'ensureImmersiveLiveSession insert failed (non-blocking): ' +
            error.message,
        );
      }
    } catch (err) {
      this.logger.warn(
        'ensureImmersiveLiveSession failed (non-blocking): ' +
          (err as Error).message,
      );
    }
  }

  async markJoined(
    tenant: TenantContext,
    actorRole: TenantContext['userRole'],
    sessionId: string,
  ) {
    const field =
      actorRole === 'patient'
        ? 'patient_joined_at'
        : 'practitioner_joined_at';
    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_sessions')
      .update({ [field]: new Date().toISOString(), status: 'active' })
      .eq('tenant_id', tenant.id)
      .eq('id', sessionId)
      .select('*')
      .single();
    if (error || !data) throw new NotFoundException('Session introuvable');
    return data;
  }

  // ── Inviter un PROCHE (+ consentement RGPD du patient) ────────────────────
  // Un proche n'a pas de compte tenant : il rejoint via un lien token-gaté.
  // Garde fail-closed : aucun token vidéo n'est délivré tant que le PATIENT
  // n'a pas explicitement consenti (trace consent_by / consent_at).

  /** Charge la session (tenant-scopée) ou 404. */
  private async loadSession(tenantId: string, sessionId: string): Promise<any> {
    const { data, error } = await this.supabase.client
      .from('med_teleconsult_sessions')
      .select('id, patient_id, practitioner_id')
      .eq('tenant_id', tenantId)
      .eq('id', sessionId)
      .single();
    if (error || !data) throw new NotFoundException('Session introuvable');
    return data;
  }

  /** Vérifie que l'appelant est BIEN le patient propriétaire de la session. */
  private async assertPatientOwnsSession(
    session: any,
    actorId: string,
  ): Promise<void> {
    const { data: pat } = await this.supabase.client
      .from('med_patients')
      .select('patient_user_id')
      .eq('id', session.patient_id)
      .single();
    if ((pat as any)?.patient_user_id !== actorId) {
      throw new ForbiddenException('Accès refusé à cette session');
    }
  }

  /** Host : crée une invitation pour un proche → renvoie le token (= id). */
  async createInvite(
    tenant: TenantContext,
    hostId: string,
    sessionId: string,
    dto: { display_name?: string; relationship?: string },
  ): Promise<any> {
    await this.loadSession(tenant.id, sessionId);
    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_invites')
      .insert({
        tenant_id: tenant.id,
        session_id: sessionId,
        display_name: (dto.display_name || '').trim() || 'Proche',
        relationship: (dto.relationship || '').trim() || null,
        status: 'consent_requested',
        created_by: hostId,
      })
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error('createInvite', error?.message);
      throw new InternalServerErrorException("Création de l'invitation impossible");
    }
    return data;
  }

  /** Host OU patient-propriétaire : liste les invitations actives de la session. */
  async listInvites(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    sessionId: string,
  ): Promise<any[]> {
    const session = await this.loadSession(tenant.id, sessionId);
    if (actorRole === 'patient') await this.assertPatientOwnsSession(session, actorId);
    const { data, error } = await this.supabase.client
      .from('med_teleconsult_invites')
      .select('id, display_name, relationship, status, consent_at, created_at')
      .eq('tenant_id', tenant.id)
      .eq('session_id', sessionId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * PATIENT uniquement : tranche le consentement (RGPD). Seul le patient
   * propriétaire de la session peut autoriser/refuser la participation d'un
   * proche au partage de ses données de santé. La décision est tracée.
   */
  async consentInvite(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    sessionId: string,
    inviteId: string,
    granted: boolean,
  ): Promise<any> {
    const session = await this.loadSession(tenant.id, sessionId);
    if (actorRole !== 'patient') {
      throw new ForbiddenException(
        'Seul le patient peut consentir à la participation d’un proche',
      );
    }
    await this.assertPatientOwnsSession(session, actorId);
    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_invites')
      .update({
        status: granted ? 'consented' : 'denied',
        consent_by: actorId,
        consent_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant.id)
      .eq('session_id', sessionId)
      .eq('id', inviteId)
      .select('id, status, consent_at')
      .single();
    if (error || !data) throw new NotFoundException('Invitation introuvable');
    return data;
  }

  /** Host OU patient-propriétaire : révoque une invitation (proche exclu). */
  async revokeInvite(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    sessionId: string,
    inviteId: string,
  ): Promise<any> {
    const session = await this.loadSession(tenant.id, sessionId);
    if (actorRole === 'patient') await this.assertPatientOwnsSession(session, actorId);
    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_invites')
      .update({ status: 'revoked' })
      .eq('tenant_id', tenant.id)
      .eq('session_id', sessionId)
      .eq('id', inviteId)
      .select('id, status')
      .single();
    if (error || !data) throw new NotFoundException('Invitation introuvable');
    return data;
  }

  /**
   * PUBLIC (token-gaté) : statut d'une invitation, pour la page du proche.
   * Renvoie le STRICT minimum (aucune donnée de santé) : où en est le
   * consentement + le nom du proche + le nom de la clinique.
   */
  async getInvitePublicStatus(inviteId: string): Promise<{
    status: string;
    display_name: string;
    session_id: string;
    clinic_name: string;
  }> {
    const { data: invite } = await (this.supabase.client as any)
      .from('med_teleconsult_invites')
      .select('id, session_id, tenant_id, display_name, status')
      .eq('id', inviteId)
      .maybeSingle();
    if (!invite) throw new NotFoundException('Invitation introuvable');
    const { data: tenant } = await this.supabase.client
      .from('tenants')
      .select('name')
      .eq('id', (invite as any).tenant_id)
      .maybeSingle();
    return {
      status: (invite as any).status,
      display_name: (invite as any).display_name,
      session_id: (invite as any).session_id,
      clinic_name: (tenant as any)?.name || 'Consultation',
    };
  }

  /**
   * PUBLIC (token-gaté) : délivre le token vidéo INVITÉ au proche. FAIL-CLOSED —
   * uniquement si le patient a consenti (status 'consented' ou déjà 'admitted'
   * pour les reconnexions). Le proche rejoint la MÊME room que la session
   * (externalRef = session_id) en invité publiant (caméra + micro).
   */
  async issueInviteToken(inviteId: string): Promise<{
    url: string;
    token: string;
    display_name: string;
    session_id: string;
  }> {
    const { data: invite } = await (this.supabase.client as any)
      .from('med_teleconsult_invites')
      .select('id, session_id, tenant_id, display_name, status')
      .eq('id', inviteId)
      .maybeSingle();
    if (!invite) throw new NotFoundException('Invitation introuvable');
    const inv = invite as any;
    if (inv.status !== 'consented' && inv.status !== 'admitted') {
      throw new ForbiddenException(
        "En attente de l'autorisation du patient",
      );
    }

    const { data: tenant } = await this.supabase.client
      .from('tenants')
      .select('slug')
      .eq('id', inv.tenant_id)
      .single();
    if (!tenant) throw new NotFoundException('Tenant introuvable');

    const result = await this.liri.issueTokenForSession({
      tenantId: inv.tenant_id,
      tenantSlug: (tenant as any).slug,
      externalRef: inv.session_id,
      purpose: 'medical_teleconsult',
      userId: `proche_${inv.id}`,
      displayName: inv.display_name,
      role: 'guest',
      guestCanPublish: true,
      metadata: { teleconsult_invite_id: inv.id },
    });

    if (inv.status !== 'admitted') {
      await (this.supabase.client as any)
        .from('med_teleconsult_invites')
        .update({ status: 'admitted', joined_at: new Date().toISOString() })
        .eq('id', inv.id);
    }

    return {
      url: result.url,
      token: result.token,
      display_name: inv.display_name,
      session_id: inv.session_id,
    };
  }

  /**
   * Convenience flow for the UI: from an appointment, get-or-create the
   * teleconsult session (doctor) or fetch the existing one (patient),
   * then issue a token. Lets the UI implement "Start / Join" as a single
   * click without juggling two endpoints.
   */
  async joinFromAppointment(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    appointmentId: string,
    displayName?: string,
  ): Promise<{ session_id: string; room: string; token: string; url: string; ttl: string }> {
    const { data: appt } = await this.supabase.client
      .from('med_appointments')
      .select('id, patient_id, practitioner_id, teleconsult_session_id, appointment_type')
      .eq('tenant_id', tenant.id)
      .eq('id', appointmentId)
      .single();
    if (!appt) throw new NotFoundException('RDV introuvable');
    const a = appt as any;

    // Verify the patient owns this appointment
    if (actorRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', a.patient_id)
        .single();
      if ((pat as any)?.patient_user_id !== actorId) {
        throw new ForbiddenException('Accès refusé à ce RDV');
      }
    }

    let sessionId: string | null = a.teleconsult_session_id;

    if (!sessionId) {
      if (actorRole === 'patient') {
        throw new NotFoundException(
          "Aucune session de téléconsultation n'est encore prête. Demandez à votre praticien de la démarrer.",
        );
      }
      const session = await this.create(tenant, a.practitioner_id, {
        patient_id: a.patient_id,
        appointment_id: a.id,
        recording_consented: false,
      });
      sessionId = (session as any).id as string;
    }

    const tokenResp = await this.issueToken(
      tenant,
      actorId,
      actorRole,
      sessionId,
      displayName,
    );
    return { session_id: sessionId, ...tokenResp };
  }

  async end(
    tenant: TenantContext,
    actorRole: TenantContext['userRole'],
    sessionId: string,
    dto: EndTeleconsultDto,
  ) {
    const { data: session, error: loadErr } = await this.supabase.client
      .from('med_teleconsult_sessions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', sessionId)
      .single();
    if (loadErr || !session) throw new NotFoundException('Session introuvable');

    const sessionRow = session as any;
    const now = new Date().toISOString();

    // Calculer durée si on a un join_at
    const earliestJoin =
      sessionRow.practitioner_joined_at && sessionRow.patient_joined_at
        ? new Date(
            Math.min(
              new Date(sessionRow.practitioner_joined_at).getTime(),
              new Date(sessionRow.patient_joined_at).getTime(),
            ),
          )
        : sessionRow.practitioner_joined_at
          ? new Date(sessionRow.practitioner_joined_at)
          : sessionRow.patient_joined_at
            ? new Date(sessionRow.patient_joined_at)
            : null;

    const durationSec = earliestJoin
      ? Math.floor((Date.now() - earliestJoin.getTime()) / 1000)
      : null;

    const leftField =
      actorRole === 'patient'
        ? { patient_left_at: now }
        : { practitioner_left_at: now };

    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_sessions')
      .update({
        ...leftField,
        status: 'ended',
        ended_reason: dto.ended_reason ?? 'normal',
        connection_quality: dto.connection_quality ?? null,
        technical_issues: dto.technical_issues ?? null,
        quick_note: dto.quick_note ?? null,
        duration_seconds: durationSec,
      })
      .eq('tenant_id', tenant.id)
      .eq('id', sessionId)
      .select('*')
      .single();
    if (error || !data)
      throw new InternalServerErrorException('Fin de session impossible');

    // Tell Liri the session ended so its ledger row gets a duration. Failing
    // here would not invalidate the MEDOS-side end, so we swallow the error.
    try {
      await this.liri.endLiriSession(tenant.id, sessionId);
    } catch (err) {
      this.logger.warn(
        'liri.endLiriSession failed (non-blocking): ' +
          (err as Error).message,
      );
    }

    return data;
  }

  async list(tenant: TenantContext, filters: { patient_id?: string } = {}) {
    let q = this.supabase.client
      .from('med_teleconsult_sessions')
      .select('*')
      .eq('tenant_id', tenant.id);
    if (filters.patient_id) q = q.eq('patient_id', filters.patient_id);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }
}
