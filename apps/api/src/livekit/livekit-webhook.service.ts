import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookReceiver } from 'livekit-server-sdk';
import { SupabaseService } from '../supabase/supabase.service';
import type { Json } from '../supabase/supabase.service';
import { LiveService } from '../live/live.service';

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
    private readonly liri: LiveService,
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
        await this.handleRoomFinished(liveSessionId, now, roomName);
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
    roomName?: string,
  ): Promise<void> {
    // 1. ISNA school flow (legacy live_sessions table)
    if (liveSessionId) {
      await this.supabase.client
        .from('live_sessions')
        .update({ status: 'ended', ended_at: now })
        .eq('id', liveSessionId);
      this.logger.log(`Live ${liveSessionId} ended via webhook`);
    }

    // 2. Liri unified ledger (covers MEDOS teleconsult, Mbolo live shopping,
    //    any future engine that called liri.issueTokenForSession). Without
    //    this, sessions where the user closes the tab without clicking
    //    "End call" stay open forever and skew billing.
    if (roomName) {
      try {
        const result = await this.liri.endLiriSessionByRoomName(roomName);
        if (result) {
          this.logger.log(
            `Liri session ${result.session_id} auto-ended via webhook (${result.duration_seconds}s)`,
          );
        }
      } catch (err) {
        this.logger.warn(
          'liri.endLiriSessionByRoomName failed: ' + (err as Error).message,
        );
      }
    }
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

    // Démarrer l'egress d'enregistrement quand l'HÔTE rejoint la room : la room est
    // alors ACTIVE (l'hôte va publier sa caméra/écran) → l'egress composite peut
    // démarrer. C'est le BON timing (≠ à l'émission du token, où la room est encore
    // vide → LiveKit refuse l'egress → 'failed'). Non bloquant.
    try {
      const { data: sess } = await this.supabase.client
        .from('live_sessions')
        .select('host_user_id, tenant_id')
        .eq('id', liveSessionId)
        .maybeSingle();
      const s = sess as { host_user_id?: string; tenant_id?: string } | null;
      if (s?.host_user_id === userId && s?.tenant_id) {
        await this.liri.maybeStartRecording(s.tenant_id, liveSessionId);
      }
    } catch (err) {
      this.logger.warn(
        'egress auto-start (participant_joined hôte) échec: ' + (err as Error).message,
      );
    }
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

    // Pont replay : l'enregistrement est complet → on écrit l'état lu par l'élève
    // (live_neuro_recall_state) via LiveService.publishReplay, selon le réglage de
    // publication du tenant (auto/revue). Appel SYSTÈME (pas d'actorId) → fiable, non
    // bloquant. Remplace l'ancien UPDATE live_sessions (colonnes recording_url/
    // replay_available/recording_status INEXISTANTES → échouait silencieusement).
    if (outputUrl && liveSessionId) {
      const { data: sess } = await this.supabase.client
        .from('live_sessions')
        .select('tenant_id')
        .eq('id', liveSessionId)
        .maybeSingle();
      const tenantId = (sess as { tenant_id?: string } | null)?.tenant_id;
      if (tenantId) {
        try {
          await this.liri.publishReplay(tenantId, liveSessionId);
        } catch (err) {
          this.logger.warn(
            'publishReplay (pont webhook) échec: ' + (err as Error).message,
          );
        }
      }
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
