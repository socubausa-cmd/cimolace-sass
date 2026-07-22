import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookReceiver } from 'livekit-server-sdk';
import { SupabaseService } from '../supabase/supabase.service';
import type { Json } from '../supabase/supabase.service';
import { LiveService } from '../live/live.service';
import { EmailEngineService } from '../email-engine/email-engine.service';
import { UsageService } from '../usage/usage.service';

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
    private readonly email: EmailEngineService,
    private readonly usage: UsageService,
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
    } catch (e) {
      this.logger.warn(
        `Webhook verification failed: ${(e as Error)?.message ?? 'unknown'}`,
      );
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
          // ── MÉTROLOGIE sessions Liri (téléconsult MEDOS, live shopping mbolo) :
          // ~2 participants × durée. duration_seconds=0 = déjà clôturée (déjà comptée).
          if (result.tenant_id && result.duration_seconds > 0) {
            const minutes = Math.max(1, Math.round((result.duration_seconds / 60) * 2));
            await this.usage.consume(result.tenant_id, 'live_minutes', minutes, 'livekit:liri_session', {
              liri_session_id: result.session_id,
            });
          }
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
    // joined_at AVANT l'update (il sert au calcul des minutes-participant)
    const { data: part } = await this.supabase.client
      .from('live_session_participants')
      .select('joined_at, left_at')
      .eq('live_session_id', liveSessionId)
      .eq('user_id', userId)
      .maybeSingle();
    await this.supabase.client
      .from('live_session_participants')
      .update({ left_at: now })
      .eq('live_session_id', liveSessionId)
      .eq('user_id', userId);

    // ── MÉTROLOGIE : minutes-participant consommées par ce passage. Best-effort,
    // ne casse jamais le webhook. left_at déjà posé = passage déjà compté (retry).
    try {
      const joinedAt = (part as any)?.joined_at;
      const alreadyCounted = Boolean((part as any)?.left_at);
      if (joinedAt && !alreadyCounted) {
        const minutes = Math.max(
          1,
          Math.round((new Date(now).getTime() - new Date(joinedAt).getTime()) / 60000),
        );
        const { data: sess } = await this.supabase.client
          .from('live_sessions')
          .select('tenant_id')
          .eq('id', liveSessionId)
          .maybeSingle();
        const tenantId = (sess as any)?.tenant_id;
        if (tenantId) {
          await this.usage.consume(tenantId, 'live_minutes', minutes, 'livekit:participant_left', {
            live_session_id: liveSessionId,
            user_id: userId,
          });
        }
      }
    } catch (err) {
      this.logger.warn('métrologie participant_left: ' + (err as Error).message);
    }
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
        .select('tenant_id, kind')
        .eq('id', liveSessionId)
        .maybeSingle();
      const tenantId = (sess as { tenant_id?: string } | null)?.tenant_id;
      const kind = (sess as { kind?: string } | null)?.kind;
      if (tenantId) {
        if (kind === 'teleconsult') {
          // Téléconsultation : PAS de publishReplay LIRI (recall élève + forum) —
          // on prévient le patient ET le praticien que le replay est prêt.
          try {
            await this.sendTeleconsultReplayEmail(liveSessionId, tenantId);
          } catch (err) {
            this.logger.warn(
              'email replay téléconsult (webhook) échec: ' + (err as Error).message,
            );
          }
        } else {
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
  }

  /**
   * Email « replay prêt » d'une TÉLÉCONSULTATION → patient (propriétaire) +
   * praticien. Lien vers la page replay durable (auth + garde patient-propriétaire
   * côté backend). Best-effort : ne jette jamais (l'egress est déjà finalisé).
   */
  private async sendTeleconsultReplayEmail(
    sessionId: string,
    tenantId: string,
  ): Promise<void> {
    const { data: mts } = await this.supabase.client
      .from('med_teleconsult_sessions')
      .select('id, patient_id, practitioner_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (!mts) return; // pas une téléconsult → rien à envoyer
    const { data: t } = await this.supabase.client
      .from('tenants')
      .select('slug, name')
      .eq('id', tenantId)
      .maybeSingle();
    const slug = (t as any)?.slug || '';
    const clinic = (t as any)?.name || 'votre praticien';
    const base = process.env.APP_URL || 'https://app.cimolace.space';
    const link = `${base}/teleconsult/${sessionId}/replay${slug ? `?tenant=${encodeURIComponent(slug)}` : ''}`;

    // Destinataires : patient (email med_patients, repli compte auth) + praticien.
    const recipients: Array<{ to: string; isPatient: boolean; name: string }> = [];
    const { data: pat } = await this.supabase.client
      .from('med_patients')
      .select('email, first_name, patient_user_id')
      .eq('id', (mts as any).patient_id)
      .maybeSingle();
    let patientEmail = String((pat as any)?.email || '').trim();
    if (!patientEmail && (pat as any)?.patient_user_id) {
      try {
        const { data: u } = await (this.supabase.client as any).auth.admin.getUserById(
          (pat as any).patient_user_id,
        );
        patientEmail = String(u?.user?.email || '').trim();
      } catch { /* best-effort */ }
    }
    if (patientEmail) {
      recipients.push({
        to: patientEmail,
        isPatient: true,
        name: String((pat as any)?.first_name || '').trim(),
      });
    }
    if ((mts as any).practitioner_id) {
      try {
        const { data: u } = await (this.supabase.client as any).auth.admin.getUserById(
          (mts as any).practitioner_id,
        );
        const e = String(u?.user?.email || '').trim();
        if (e && e.toLowerCase() !== patientEmail.toLowerCase()) {
          recipients.push({ to: e, isPatient: false, name: '' });
        }
      } catch { /* best-effort */ }
    }

    for (const r of recipients) {
      const html = this.email.brandedHtml({
        title: 'Votre téléconsultation est disponible en replay',
        body: r.isPatient
          ? `Bonjour${r.name ? ' ' + r.name : ''}, l'enregistrement de votre téléconsultation avec ${clinic} est prêt. Vous pouvez le revoir à tout moment via le bouton ci-dessous — accès confidentiel, réservé à vous et à votre praticien.`
          : `L'enregistrement de la téléconsultation est finalisé et disponible en replay. Accès réservé au praticien et au patient concerné.`,
        ctaLabel: "Revoir l'enregistrement",
        ctaUrl: link,
      });
      const subject = r.isPatient
        ? `Replay de votre téléconsultation — ${clinic}`
        : `Replay de téléconsultation disponible — ${clinic}`;
      try {
        await this.email.sendRaw(tenantId, r.to, subject, html);
      } catch { /* best-effort : un destinataire en échec ne bloque pas l'autre */ }
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
