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

  // ── Bloc 10 — Email Avancé ──────────────────────────────────────────────

  async sendAnnouncement(tenantId: string, subject: string, content: string, aiPolish = true) {
    let polished = content;
    if (aiPolish) {
      try {
        const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY || ''}` },
          body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: `Polish this announcement (keep same language): ${content}` }], max_tokens: 500 }),
        });
        if (resp.ok) {
          const json: any = await resp.json();
          polished = json.choices?.[0]?.message?.content?.trim() || content;
        }
      } catch { /* fallback to original */ }
    }

    const members = await this.getRecipients(tenantId, {});
    for (const m of members) {
      await this.sendEmail(tenantId, { to: m.email, templateKey: 'announcement', data: { subject, content: polished, name: m.name || '' } });
    }
    await (this.supabase.client as any).from('announcements').insert({
      tenant_id: tenantId, subject, content: polished, recipient_count: members.length,
    });
    return { sent: members.length, polished: aiPolish };
  }

  async handleInboundWebhook(tenantId: string, from: string, subject: string, body: string) {
    await (this.supabase.client as any).from('inbound_emails').insert({
      tenant_id: tenantId, from_address: from, subject, body, status: 'received',
    });
    return { received: true };
  }

  async listInboundEmails(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('inbound_emails').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50);
    return data ?? [];
  }

  async getResponseSuggestion(tenantId: string, emailId: string) {
    const { data: email } = await (this.supabase.client as any).from('inbound_emails').select('*').eq('id', emailId).single();
    if (!email) return { suggestion: '' };
    // Simple auto-reply suggestion
    return { suggestion: `Bonjour,\n\nMerci pour votre message concernant "${email.subject}".\n\nNous vous répondrons dans les plus brefs délais.\n\nCordialement,\nL'équipe Cimolace` };
  }
}
