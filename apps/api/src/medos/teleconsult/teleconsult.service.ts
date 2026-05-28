import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { LiveKitService } from '../../livekit/livekit.service';
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
    private readonly livekit: LiveKitService,
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

    // Pré-créer un ID pour pouvoir générer le room name
    const tempSessionId = crypto.randomUUID();
    const roomName = LiveKitService.scopedRoomName(tenant.slug, tempSessionId);

    // Ensure la room LiveKit existe
    try {
      await this.livekit.ensureRoom(roomName, tempSessionId, practitionerId);
    } catch (err: any) {
      this.logger.error('ensureRoom failed', err?.message);
      throw new InternalServerErrorException(
        'Impossible de créer la room LiveKit (config manquante ?)',
      );
    }

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

  /** Génère un token LiveKit pour rejoindre la room (host ou participant). */
  async issueToken(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    sessionId: string,
    displayName?: string,
  ): Promise<{ room: string; token: string; ttl: string }> {
    const { data: session, error } = await this.supabase.client
      .from('med_teleconsult_sessions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', sessionId)
      .single();
    if (error || !session) throw new NotFoundException('Session introuvable');

    // Vérifier accès
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

    const roomName = (session as any).livekit_room_name as string;
    const isHost =
      actorRole === 'practitioner' ||
      actorRole === 'owner' ||
      actorRole === 'clinic_admin';

    const token = isHost
      ? await this.livekit.generateHostToken(roomName, actorId, displayName)
      : await this.livekit.generateParticipantToken(
          roomName,
          actorId,
          displayName,
        );

    return { room: roomName, token, ttl: isHost ? '4h' : '1h' };
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
