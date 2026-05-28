import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import {
  CloseThreadDto,
  CreateThreadDto,
  SendMessageDto,
} from './dto/messaging.dto';

export type ThreadRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  subject: string | null;
  status: string;
  priority: string;
  last_message_at: string | null;
  last_message_by_role: string | null;
  assigned_practitioner_id: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  tenant_id: string;
  thread_id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  attachment_ids: string[];
  read_at: string | null;
  read_by_user_id: string | null;
  is_system: boolean;
  system_event: string | null;
  system_meta: Record<string, unknown> | null;
  created_at: string;
};

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private async checkPatientOwnership(
    patientId: string,
    userId: string,
  ): Promise<boolean> {
    const { data } = await this.supabase.client
      .from('med_patients')
      .select('patient_user_id')
      .eq('id', patientId)
      .single();
    return (data as any)?.patient_user_id === userId;
  }

  // ─── Threads ─────────────────────────────────────────────────────────────

  async createThread(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    dto: CreateThreadDto,
  ): Promise<{ thread: ThreadRow; first_message: MessageRow | null }> {
    // Patient ne peut créer que pour soi
    if (actorRole === 'patient') {
      const owns = await this.checkPatientOwnership(dto.patient_id, actorId);
      if (!owns) {
        throw new ForbiddenException(
          'Vous ne pouvez créer un thread que pour votre propre dossier',
        );
      }
    }

    const now = new Date().toISOString();
    const { data: thread, error } = await (this.supabase.client as any)
      .from('med_message_threads')
      .insert({
        tenant_id: tenant.id,
        patient_id: dto.patient_id,
        subject: dto.subject ?? null,
        priority: dto.priority ?? 'normal',
        status: actorRole === 'patient' ? 'awaiting_staff' : 'awaiting_patient',
        last_message_at: dto.initial_message ? now : null,
        last_message_by_role: dto.initial_message
          ? actorRole === 'patient'
            ? 'patient'
            : 'practitioner'
          : null,
      })
      .select('*')
      .single();
    if (error || !thread) {
      this.logger.error('createThread', error?.message);
      throw new InternalServerErrorException('Création du thread impossible');
    }

    let first_message: MessageRow | null = null;
    if (dto.initial_message) {
      first_message = await this.send(
        tenant,
        actorId,
        actorRole,
        (thread as any).id,
        { body: dto.initial_message },
      );
    }

    return { thread: thread as ThreadRow, first_message };
  }

  async listThreads(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    filters: { status?: string; patient_id?: string } = {},
  ): Promise<ThreadRow[]> {
    let q = this.supabase.client
      .from('med_message_threads')
      .select('*')
      .eq('tenant_id', tenant.id);

    // Patient ne voit que ses threads
    if (actorRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('patient_user_id', actorId)
        .maybeSingle();
      if (!pat) return [];
      q = q.eq('patient_id', (pat as any).id);
    } else if (filters.patient_id) {
      q = q.eq('patient_id', filters.patient_id);
    }
    if (filters.status) q = q.eq('status', filters.status);

    const { data, error } = await q.order('last_message_at', {
      ascending: false,
    });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as unknown as ThreadRow[];
  }

  async getThread(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    threadId: string,
  ): Promise<ThreadRow> {
    const { data, error } = await this.supabase.client
      .from('med_message_threads')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', threadId)
      .single();
    if (error || !data) throw new NotFoundException('Thread introuvable');

    if (actorRole === 'patient') {
      const owns = await this.checkPatientOwnership(
        (data as any).patient_id,
        actorId,
      );
      if (!owns) throw new ForbiddenException('Accès refusé à ce thread');
    }

    return data as unknown as ThreadRow;
  }

  async closeThread(
    tenant: TenantContext,
    actorId: string,
    threadId: string,
    dto: CloseThreadDto,
  ): Promise<ThreadRow> {
    const { data, error } = await (this.supabase.client as any)
      .from('med_message_threads')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_reason: dto.reason ?? null,
      })
      .eq('tenant_id', tenant.id)
      .eq('id', threadId)
      .neq('status', 'closed')
      .select('*')
      .single();
    if (error || !data) {
      throw new NotFoundException('Thread introuvable ou déjà fermé');
    }
    return data as ThreadRow;
  }

  // ─── Messages ────────────────────────────────────────────────────────────

  async send(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    threadId: string,
    dto: SendMessageDto,
  ): Promise<MessageRow> {
    // Vérifier accès au thread
    await this.getThread(tenant, actorId, actorRole, threadId);

    const now = new Date().toISOString();
    const senderRole =
      actorRole === 'patient'
        ? 'patient'
        : actorRole === 'receptionist'
          ? 'receptionist'
          : actorRole === 'clinic_admin'
            ? 'clinic_admin'
            : 'practitioner';

    const { data: msg, error } = await (this.supabase.client as any)
      .from('med_messages')
      .insert({
        tenant_id: tenant.id,
        thread_id: threadId,
        sender_id: actorId,
        sender_role: senderRole,
        body: dto.body,
        attachment_ids: dto.attachment_ids ?? [],
        is_system: false,
      })
      .select('*')
      .single();
    if (error || !msg) {
      this.logger.error('sendMessage', error?.message);
      throw new InternalServerErrorException('Envoi du message impossible');
    }

    // Update thread last_message_at + status
    await (this.supabase.client as any)
      .from('med_message_threads')
      .update({
        last_message_at: now,
        last_message_by_role: senderRole,
        status: senderRole === 'patient' ? 'awaiting_staff' : 'awaiting_patient',
      })
      .eq('id', threadId);

    return msg as MessageRow;
  }

  async listMessages(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    threadId: string,
  ): Promise<MessageRow[]> {
    await this.getThread(tenant, actorId, actorRole, threadId);

    const { data, error } = await this.supabase.client
      .from('med_messages')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as unknown as MessageRow[];
  }

  async markRead(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    threadId: string,
    messageId: string,
  ): Promise<MessageRow> {
    await this.getThread(tenant, actorId, actorRole, threadId);

    const { data, error } = await (this.supabase.client as any)
      .from('med_messages')
      .update({
        read_at: new Date().toISOString(),
        read_by_user_id: actorId,
      })
      .eq('tenant_id', tenant.id)
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .is('read_at', null)
      .select('*')
      .single();
    if (error || !data) {
      throw new NotFoundException('Message introuvable ou déjà lu');
    }
    return data as MessageRow;
  }
}
