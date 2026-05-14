import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { SendNotificationDto, UpdatePreferencesDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resendKey: string;
  private readonly twilioSid: string;
  private readonly twilioToken: string;

  constructor(private readonly supabase: SupabaseService, config: ConfigService) {
    this.resendKey = config.get<string>('RESEND_API_KEY') ?? '';
    this.twilioSid = config.get<string>('TWILIO_ACCOUNT_SID') ?? '';
    this.twilioToken = config.get<string>('TWILIO_AUTH_TOKEN') ?? '';
  }

  async send(tenantId: string, dto: SendNotificationDto) {
    const channels = dto.channels ?? ['in_app'];
    const results: Record<string, any> = {};

    if (channels.includes('in_app') || channels.includes('push')) {
      const { data, error } = await (this.supabase.client as any).from('notifications').insert({
        tenant_id: tenantId, user_id: dto.userId, title: dto.title, body: dto.body,
        template_key: dto.templateKey ?? null, data: dto.data ?? {},
        channel: channels.includes('push') ? 'push' : 'in_app',
      }).select('*').single();
      if (!error) results.in_app = data;
      else this.logger.error('in_app notif failed', error);
    }

    if (channels.includes('email') && this.resendKey && this.resendKey !== 'replace_me') {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { 'Authorization': `Bearer ${this.resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Cimolace <noreply@cimolace.com>', to: [dto.userId], subject: dto.title, text: dto.body }),
        });
        results.email = resp.ok ? 'sent' : `failed:${resp.status}`;
      } catch (e) { results.email = `error:${String(e)}`; }
    }

    if (channels.includes('sms') && this.twilioSid !== 'replace_me') {
      results.sms = 'twilio_placeholder';
    }

    return results;
  }

  async getUserNotifications(tenantId: string, userId: string, limit = 20) {
    const { data } = await (this.supabase.client as any).from('notifications')
      .select('*').eq('tenant_id', tenantId).eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return data ?? [];
  }

  async markRead(tenantId: string, notificationId: string) {
    await (this.supabase.client as any).from('notifications').update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId).eq('tenant_id', tenantId);
  }

  async getPreferences(tenantId: string, userId: string) {
    const { data } = await (this.supabase.client as any).from('notification_preferences')
      .select('*').eq('tenant_id', tenantId).eq('user_id', userId).single();
    return data ?? { email_notifications: true, sms_notifications: false, push_notifications: true, in_app_notifications: true };
  }

  async updatePreferences(tenantId: string, userId: string, dto: UpdatePreferencesDto) {
    const { data } = await (this.supabase.client as any).from('notification_preferences').upsert({
      tenant_id: tenantId, user_id: userId, ...dto,
    }, { onConflict: 'tenant_id,user_id' }).select('*').single();
    return data;
  }
}
