import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateTemplateDto, SendCampaignDto, SendEmailDto } from './dto/email.dto';

@Injectable()
export class EmailEngineService {
  private readonly logger = new Logger(EmailEngineService.name);
  private readonly resendKey: string;
  private readonly from: string;

  constructor(private readonly supabase: SupabaseService, config: ConfigService) {
    this.resendKey = config.get<string>('RESEND_API_KEY') ?? '';
    this.from = config.get<string>('RESEND_FROM') ?? 'noreply@cimolace.com';
  }

  async listTemplates(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('email_templates').select('*').eq('tenant_id', tenantId);
    return data ?? [];
  }

  async createTemplate(tenantId: string, dto: CreateTemplateDto) {
    const { data } = await (this.supabase.client as any).from('email_templates').insert({ tenant_id: tenantId, ...dto }).select('*').single();
    return data;
  }

  async sendEmail(tenantId: string, dto: SendEmailDto) {
    if (!this.resendKey || this.resendKey === 'replace_me') return { status: 'disabled' };
    const { data: tpl } = await (this.supabase.client as any).from('email_templates').select('*').eq('template_key', dto.templateKey).eq('tenant_id', tenantId).single();
    let html = tpl?.html_content ?? '';
    if (dto.data) for (const [k, v] of Object.entries(dto.data)) html = html.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { 'Authorization': `Bearer ${this.resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.from, to: [dto.to], subject: tpl?.subject ?? '', html }),
      });
      return resp.ok ? { status: 'sent' } : { status: 'failed', code: resp.status };
    } catch (e) { return { status: 'error', message: String(e) }; }
  }

  async sendCampaign(tenantId: string, dto: SendCampaignDto) {
    const recipients = await this.getRecipients(tenantId, dto.recipientFilter ?? {});
    const results = [];
    for (const r of recipients) {
      const r2 = await this.sendEmail(tenantId, { to: r.email, templateKey: dto.templateKey, data: r });
      results.push(r2);
    }
    await (this.supabase.client as any).from('email_campaigns').insert({ tenant_id: tenantId, name: dto.campaignName, template_key: dto.templateKey, recipient_count: recipients.length, status: 'sent' });
    return { sent: results.length };
  }

  async listCampaigns(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('email_campaigns').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  private async getRecipients(tenantId: string, filter: Record<string, any>) {
    let q = (this.supabase.client as any).from('tenant_memberships').select('user_id').eq('tenant_id', tenantId);
    if (filter.role) q = q.eq('role', filter.role);
    const { data } = await q;
    return (data ?? []).map((r: any) => ({ email: r.user_id, ...r }));
  }
}
