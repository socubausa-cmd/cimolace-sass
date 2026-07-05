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

  private get enabled() {
    return !!this.resendKey && this.resendKey !== 'replace_me';
  }

  /**
   * Expéditeur PAR TENANT. Chaque tenant émet depuis SON domaine vérifié
   * (ex. zahirwellness.com) au lieu du global cimolace.com — c'est ce qui rend
   * les emails « attachés » au tenant.
   *
   * SOURCE DE VÉRITÉ UNIFIÉE (L6) = `tenant_notification_settings.email_from`
   * (+ email_from_name), la MÊME que celle lue par le worker (email.js/tenantNotif)
   * et par les insertions email_queue (checkout, student-invite). Avant, cette
   * méthode lisait `tenants.metadata.email` → un tenant configuré dans un seul des
   * deux → email envoyé depuis le mauvais domaine (bounce). On garde `metadata.email`
   * en REPLI (rétrocompat), puis l'expéditeur global.
   */
  async resolveFrom(tenantId: string): Promise<string> {
    try {
      // 1) Source canonique : tenant_notification_settings.
      const { data: ns } = await (this.supabase.client as any)
        .from('tenant_notification_settings')
        .select('email_from, email_from_name')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (ns?.email_from) {
        return ns.email_from_name ? `${ns.email_from_name} <${ns.email_from}>` : ns.email_from;
      }
      // 2) Repli rétrocompat : tenants.metadata.email.
      const { data: t } = await (this.supabase.client as any)
        .from('tenants')
        .select('name, metadata')
        .eq('id', tenantId)
        .single();
      const cfg = (t?.metadata?.email ?? {}) as { from?: string; domain?: string };
      if (cfg.from) return cfg.from;
      if (cfg.domain) return `${t?.name ?? 'Notification'} <noreply@${cfg.domain}>`;
    } catch {
      /* fallback global ci-dessous */
    }
    return this.from;
  }

  /**
   * Envoi transactionnel direct (HTML inline, sans template en base) depuis le
   * domaine du tenant. Best-effort : renvoie un statut, ne jette jamais.
   * `{ status: 'disabled' }` si aucune clé Resend → l'appelant ne casse pas.
   */
  async sendRaw(
    tenantId: string,
    to: string,
    subject: string,
    html: string,
  ): Promise<{ status: string; from?: string; code?: number; message?: string }> {
    if (!this.enabled) return { status: 'disabled' };
    if (!to) return { status: 'skipped', message: 'no recipient' };
    const from = await this.resolveFrom(tenantId);
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });
      return resp.ok ? { status: 'sent', from } : { status: 'failed', code: resp.status };
    } catch (e) {
      return { status: 'error', message: String(e) };
    }
  }

  /**
   * Gabarit HTML minimal, white-label (couleur de marque optionnelle). Sert aux
   * emails d'événements (invitation, formulaire assigné, note partagée).
   */
  brandedHtml(opts: { title: string; body: string; ctaLabel?: string; ctaUrl?: string; brand?: string }) {
    const accent = opts.brand || '#2f6f4f';
    const cta = opts.ctaUrl
      ? `<p style="margin:28px 0"><a href="${opts.ctaUrl}" style="background:${accent};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${opts.ctaLabel ?? 'Ouvrir'}</a></p>`
      : '';
    return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1c2b24">
      <h2 style="color:${accent};font-size:20px;margin:0 0 12px">${opts.title}</h2>
      <p style="font-size:15px;line-height:1.6;margin:0 0 8px">${opts.body}</p>
      ${cta}
      <p style="font-size:12px;color:#8a978f;margin-top:28px">Cet email vous est envoyé par votre espace santé.</p>
    </div>`;
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
