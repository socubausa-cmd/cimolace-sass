import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookReceiver } from 'livekit-server-sdk';
import { SupabaseService } from '../supabase/supabase.service';
import type { Json } from '../supabase/supabase.service';

type WebhookEvent = {
  event: string;
  room?: { name?: string };
  participant?: { identity?: string; metadata?: string };
  egressInfo?: {
    egressId?: string;
    status?: string;
    duration?: number;
    fileResults?: Array<{ downloadUrl?: string }>;
    downloadUrl?: string;
  };
};

@Injectable()
export class LiveKitWebhookService {
  private readonly logger = new Logger(LiveKitWebhookService.name);
  private readonly receiver: WebhookReceiver;

  constructor(
    config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    const apiKey = config.get<string>('LIVEKIT_API_KEY') ?? '';
    const apiSecret = config.get<string>('LIVEKIT_API_SECRET') ?? '';
    this.receiver = new WebhookReceiver(apiKey, apiSecret);
  }

  async handle(rawBody: string, authorization: string): Promise<void> {
    let event: WebhookEvent;
    try {
      event = (await this.receiver.receive(
        rawBody,
        authorization,
      )) as unknown as WebhookEvent;
    } catch {
      this.logger.warn('Webhook verification failed');
      return;
    }

    const roomName = event.room?.name ?? '';
    const now = new Date().toISOString();

    const { data: sessionRow } = await this.supabase.client
      .from('live_sessions')
      .select('id')
      .or(
        `video_room_id.eq.${roomName},livekit_room_name.eq.${roomName}`,
      )
      .maybeSingle();
    const liveSessionId = sessionRow?.id ?? null;

    void this.supabase.client
      .from('live_webhook_events')
      .insert({
        event_type: event.event,
        room_name: roomName,
        session_type: 'production',
        live_session_id: liveSessionId,
        payload: event as unknown as Json,
      });

    switch (event.event) {
      case 'room_finished':
      case 'room_stopped':
        await this.handleRoomFinished(liveSessionId, now);
        break;
      case 'participant_joined':
        await this.handleParticipantJoined(event, liveSessionId, now);
        break;
      case 'participant_left':
        await this.handleParticipantLeft(event, liveSessionId, now);
        break;
      case 'egress_started':
      case 'egress_updated':
        await this.handleEgressUpdated(event);
        break;
      case 'egress_ended':
        await this.handleEgressEnded(event, liveSessionId);
        break;
      default:
        break;
    }
  }

  private async handleRoomFinished(
    liveSessionId: string | null,
    now: string,
  ): Promise<void> {
    if (!liveSessionId) return;
    await this.supabase.client
      .from('live_sessions')
      .update({ status: 'ended', ended_at: now })
      .eq('id', liveSessionId);
    this.logger.log(`Live ${liveSessionId} ended via webhook`);
  }

  private async handleParticipantJoined(
    event: WebhookEvent,
    liveSessionId: string | null,
    now: string,
  ): Promise<void> {
    const metadata = this.parseMetadata(event.participant?.metadata);
    const userId = metadata.userId ?? event.participant?.identity;
    if (!userId || !liveSessionId) return;
    await this.supabase.client
      .from('live_session_participants')
      .upsert(
        { live_session_id: liveSessionId, user_id: userId, joined_at: now },
        { onConflict: 'live_session_id,user_id' },
      );
  }

  private async handleParticipantLeft(
    event: WebhookEvent,
    liveSessionId: string | null,
    now: string,
  ): Promise<void> {
    const metadata = this.parseMetadata(event.participant?.metadata);
    const userId = metadata.userId ?? event.participant?.identity;
    if (!userId || !liveSessionId) return;
    await this.supabase.client
      .from('live_session_participants')
      .update({ left_at: now })
      .eq('live_session_id', liveSessionId)
      .eq('user_id', userId);
  }

  private async handleEgressUpdated(event: WebhookEvent): Promise<void> {
    const egressId = event.egressInfo?.egressId;
    const status = event.egressInfo?.status;
    if (!egressId) return;
    const statusMap: Record<string, string> = {
      EGRESS_STARTING: 'recording',
      EGRESS_ACTIVE: 'recording',
      EGRESS_ENDING: 'recording',
      EGRESS_COMPLETE: 'completed',
      EGRESS_FAILED: 'failed',
      EGRESS_ABORTED: 'failed',
    };
    const mapped = statusMap[status ?? ''] ?? 'recording';
    await this.supabase.client
      .from('live_recordings')
      .update({ status: mapped, raw_response: event.egressInfo as unknown as Json })
      .eq('egress_id', egressId);
  }

  private async handleEgressEnded(
    event: WebhookEvent,
    liveSessionId: string | null,
  ): Promise<void> {
    const egressInfo = event.egressInfo ?? {};
    const egressId = egressInfo.egressId;
    if (!egressId) return;

    const fileResults =
      egressInfo.fileResults ?? [];
    const outputUrl =
      fileResults[0]?.downloadUrl ?? egressInfo.downloadUrl ?? null;
    const durationMs = egressInfo.duration ?? null;

    await this.supabase.client
      .from('live_recordings')
      .update({
        status: 'completed',
        output_url: outputUrl,
        duration_seconds: durationMs
          ? Math.round(durationMs / 1000)
          : null,
        completed_at: new Date().toISOString(),
        raw_response: egressInfo as unknown as Json,
      })
      .eq('egress_id', egressId);

    if (outputUrl && liveSessionId) {
      await this.supabase.client
        .from('live_sessions')
        .update({
          recording_url: outputUrl,
          replay_available: true,
          recording_status: 'completed',
        })
        .eq('id', liveSessionId);
    }
  }

  private parseMetadata(raw?: string): Record<string, string | undefined> {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}
