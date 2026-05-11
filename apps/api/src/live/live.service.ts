import { randomUUID } from 'crypto';
import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LiveKitService } from '../livekit/livekit.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { AuthUser } from '../auth/current-user.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import type { CreateLiveDto } from './create-live.dto';

const HOST_ROLES = ['owner', 'admin', 'teacher'];

const LIVE_COLUMNS =
  'id, title, description, scheduled_at, price_cents, currency, capacity, status, replay_enabled, livekit_room_name, host_user_id, created_at, updated_at';

type LiveRecord = {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  price_cents: number;
  currency: string;
  capacity: number | null;
  status: string;
  replay_enabled: boolean;
  livekit_room_name: string;
  host_user_id: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class LiveService {
  private readonly logger = new Logger(LiveService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly livekit: LiveKitService,
  ) {}

  async create(dto: CreateLiveDto, userId: string, tenant: TenantContext) {
    if (!HOST_ROLES.includes(tenant.userRole)) {
      throw new ForbiddenException(
        'Seuls owner, admin et teacher peuvent créer un live',
      );
    }

    const roomName = `${tenant.slug}_${randomUUID()}`;

    const { data, error } = await this.supabase.client
      .from('live_sessions')
      .insert({
        tenant_id: tenant.id,
        host_user_id: userId,
        title: dto.title,
        description: dto.description ?? null,
        scheduled_at: dto.scheduledAt,
        price_cents: dto.priceCents,
        currency: dto.currency ?? 'EUR',
        capacity: dto.capacity ?? null,
        replay_enabled: dto.replayEnabled ?? false,
        livekit_room_name: roomName,
        status: 'scheduled',
      })
      .select(LIVE_COLUMNS)
      .single();

    if (error) {
      this.logger.error('create live_session', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return data;
  }

  async findAll(tenantId: string, limit = 20, offset = 0) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);

    const { data, error } = await this.supabase.client
      .from('live_sessions')
      .select(LIVE_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('scheduled_at', { ascending: true })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (error) {
      this.logger.error('findAll live_sessions', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return (data ?? []) as LiveRecord[];
  }

  async findOne(id: string, tenantId: string) {
    const { data, error } = await this.supabase.client
      .from('live_sessions')
      .select(LIVE_COLUMNS)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) throw new NotFoundException(`Live "${id}" introuvable`);
    return data;
  }

  async getJoinToken(
    liveId: string,
    user: AuthUser,
    tenant: TenantContext,
  ): Promise<{ token: string; roomName: string }> {
    const live = await this.findOne(liveId, tenant.id);

    if (live.status === 'cancelled' || live.status === 'ended') {
      throw new ForbiddenException(
        `Le live est ${live.status} — accès impossible`,
      );
    }

    const isHost = HOST_ROLES.includes(tenant.userRole);

    if (!isHost) {
      const now = new Date().toISOString();
      const { data: pass } = await this.supabase.client
        .from('access_passes')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('user_id', user.id)
        .eq('resource_type', 'live_session')
        .eq('resource_id', liveId)
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gte.${now}`)
        .maybeSingle();

      if (!pass)
        throw new ForbiddenException(
          'Accès au live non autorisé — access pass requis',
        );
    }

    const token = isHost
      ? await this.livekit.generateHostToken(
          live.livekit_room_name,
          user.id,
          user.email,
        )
      : await this.livekit.generateParticipantToken(
          live.livekit_room_name,
          user.id,
          user.email,
        );

    return { token, roomName: live.livekit_room_name };
  }
}
