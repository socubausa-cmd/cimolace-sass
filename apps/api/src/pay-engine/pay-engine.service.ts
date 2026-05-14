import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class PayEngineService {
  private readonly logger = new Logger(PayEngineService.name);
  private readonly cinetpayKey: string; private readonly chariowKey: string;

  constructor(private readonly supabase: SupabaseService, config: ConfigService) {
    this.cinetpayKey = config.get<string>('CINETPAY_API_KEY') ?? '';
    this.chariowKey = config.get<string>('CHARIOW_API_KEY') ?? '';
  }

  async getProviders(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('payment_providers').select('*').eq('tenant_id', tenantId);
    return data ?? [
      { provider: 'stripe', enabled: true },
      { provider: 'pawapay', enabled: false },   // Mobile Money (CMR, RWA, GHA, CIV…)
      { provider: 'cinetpay', enabled: false },
      { provider: 'chariow', enabled: false },
      { provider: 'paypal', enabled: false },
    ];
  }

  async enableProvider(tenantId: string, provider: string, enabled: boolean) {
    await (this.supabase.client as any).from('payment_providers').upsert({ tenant_id: tenantId, provider, enabled }, { onConflict: 'tenant_id,provider' });
    return { provider, enabled };
  }

  async createCinetPayPayment(tenantId: string, amount: number, currency: string, transactionId: string) {
    if (!this.cinetpayKey || this.cinetpayKey === 'replace_me') return { status: 'disabled' };
    try {
      const resp = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: this.cinetpayKey, site_id: '586136', transaction_id: transactionId, amount, currency, description: 'Paiement Cimolace' }),
      });
      const data = await resp.json();
      await (this.supabase.client as any).from('payment_transactions').insert({ tenant_id: tenantId, provider: 'cinetpay', transaction_id: transactionId, amount_cents: amount, currency, status: 'pending' });
      return data;
    } catch (e) { return { error: String(e) }; }
  }

  async getTransactions(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('payment_transactions').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }
}
