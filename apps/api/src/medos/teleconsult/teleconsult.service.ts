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
