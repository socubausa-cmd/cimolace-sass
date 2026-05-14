import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SmsEngineService {
  private readonly logger = new Logger(SmsEngineService.name);
  private readonly twilioSid: string; private readonly twilioToken: string; private readonly twilioFrom: string;

  constructor(private readonly supabase: SupabaseService, config: ConfigService) {
    this.twilioSid = config.get<string>('TWILIO_ACCOUNT_SID') ?? '';
    this.twilioToken = config.get<string>('TWILIO_AUTH_TOKEN') ?? '';
    this.twilioFrom = config.get<string>('TWILIO_PHONE_NUMBER') ?? '';
  }

  async sendSms(tenantId: string, to: string, message: string) {
    await (this.supabase.client as any).from('sms_logs').insert({ tenant_id: tenantId, to_number: to, message, status: 'pending' });
    if (!this.twilioSid || this.twilioSid === 'replace_me') return { status: 'disabled' };
    try {
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`, {
        method: 'POST', headers: { 'Authorization': 'Basic ' + Buffer.from(`${this.twilioSid}:${this.twilioToken}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: to, From: this.twilioFrom, Body: message }).toString(),
      });
      const status = resp.ok ? 'sent' : 'failed';
      return { status };
    } catch (e) { return { status: 'error', error: String(e) }; }
  }

  async sendWhatsApp(tenantId: string, to: string, template: string, params?: string[]) {
    await (this.supabase.client as any).from('whatsapp_logs').insert({ tenant_id: tenantId, to_number: to, template, params, status: 'pending' });
    return { status: 'whatsapp_placeholder' };
  }

  async getLogs(tenantId: string, channel: string) {
    const table = channel === 'whatsapp' ? 'whatsapp_logs' : 'sms_logs';
    const { data } = await (this.supabase.client as any).from(table).select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50);
    return data ?? [];
  }
}
