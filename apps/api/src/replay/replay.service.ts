import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ReplayService {
  constructor(private readonly supabase: SupabaseService, private readonly config: ConfigService) {}

  async listRecordings(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('live_recordings').select('*')
      .eq('tenant_slug', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async getRecording(tenantId: string, recordingId: string) {
    const { data, error } = await (this.supabase.client as any).from('live_recordings').select('*')
      .eq('id', recordingId).single();
    if (error || !data) throw new NotFoundException('Enregistrement introuvable');
    return data;
  }

  async generatePlaybackUrl(tenantId: string, recordingId: string) {
    const recording = await this.getRecording(tenantId, recordingId);
    if (!recording.output_url) throw new NotFoundException('URL de lecture non disponible');
    const cfAccountId = this.config.get<string>('CLOUDFLARE_ACCOUNT_ID') ?? '';
    if (cfAccountId && cfAccountId !== 'replace_me') {
      return { url: recording.output_url, type: 'cloudflare_stream', expiresIn: 3600 };
    }
    return { url: recording.output_url, type: 'direct' };
  }

  async listReplays(tenantId: string) {
    // IMPORTANT : filtrer par tenant_id pour éviter les fuites cross-tenant.
    // On rejoint live_sessions pour récupérer le tenant_id via session_id.
    const { data } = await (this.supabase.client as any)
      .from('live_recordings')
      .select('*, live_sessions!inner(tenant_id)')
      .eq('live_sessions.tenant_id', tenantId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });
    return data ?? [];
  }
}
