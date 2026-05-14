import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateVideoAssetDto } from './dto/create-video-asset.dto';

export type VideoAsset = {
  id: string;
  tenant_id: string;
  uploaded_by: string;
  provider: 'mux' | 'cloudflare' | 'local';
  provider_asset_id: string | null;
  playback_id: string | null;
  playback_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  status: 'waiting' | 'preparing' | 'ready' | 'errored';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class VideoEngineService {
  private readonly logger = new Logger(VideoEngineService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  // ── Asset Catalog ────────────────────────────────────────────────────────

  async listAssets(tenantId: string): Promise<VideoAsset[]> {
    const { data } = await (this.supabase.client as any)
      .from('video_assets')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    return (data as VideoAsset[]) ?? [];
  }

  async getAsset(tenantId: string, assetId: string): Promise<VideoAsset> {
    const { data, error } = await (this.supabase.client as any)
      .from('video_assets')
      .select('*')
      .eq('id', assetId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) throw new NotFoundException('Asset vidéo introuvable');
    return data as VideoAsset;
  }

  // ── Upload / Ingest ───────────────────────────────────────────────────────

  async createAsset(
    tenantId: string,
    userId: string,
    dto: CreateVideoAssetDto,
  ): Promise<VideoAsset> {
    const provider = dto.provider ?? this.detectProvider();

    // Initiate upload with selected provider
    const providerData = await this.initiateProviderUpload(provider, dto);

    const { data, error } = await (this.supabase.client as any)
      .from('video_assets')
      .insert({
        tenant_id: tenantId,
        uploaded_by: userId,
        provider,
        provider_asset_id: providerData.assetId ?? null,
        playback_id: providerData.playbackId ?? null,
        playback_url: providerData.playbackUrl ?? null,
        status: providerData.status ?? 'waiting',
        duration_sec: dto.duration_sec ?? null,
        metadata: { title: dto.title, source_url: dto.source_url, ...providerData.meta },
      })
      .select('*')
      .single();

    if (error || !data) throw new Error(error?.message ?? 'Échec création asset vidéo');
    return data as VideoAsset;
  }

  async deleteAsset(tenantId: string, assetId: string): Promise<void> {
    const asset = await this.getAsset(tenantId, assetId);

    // Best-effort: delete from provider
    await this.deleteFromProvider(asset).catch((e) =>
      this.logger.warn(`Provider delete failed for ${assetId}: ${e.message}`),
    );

    await (this.supabase.client as any)
      .from('video_assets')
      .delete()
      .eq('id', assetId)
      .eq('tenant_id', tenantId);
  }

  // ── Webhook handler (called by provider webhooks) ────────────────────────

  async handleProviderWebhook(
    provider: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (provider === 'mux') {
      await this.handleMuxWebhook(payload);
    } else if (provider === 'cloudflare') {
      await this.handleCloudflareWebhook(payload);
    }
  }

  // ── Provider Implementations ──────────────────────────────────────────────

  private detectProvider(): 'mux' | 'cloudflare' | 'local' {
    if (this.config.get<string>('MUX_TOKEN_ID')) return 'mux';
    if (this.config.get<string>('CLOUDFLARE_STREAM_TOKEN')) return 'cloudflare';
    return 'local';
  }

  private async initiateProviderUpload(
    provider: 'mux' | 'cloudflare' | 'local',
    dto: CreateVideoAssetDto,
  ): Promise<{
    assetId?: string;
    playbackId?: string;
    playbackUrl?: string;
    uploadUrl?: string;
    status: VideoAsset['status'];
    meta: Record<string, unknown>;
  }> {
    switch (provider) {
      case 'mux':
        return this.muxCreateUpload(dto);
      case 'cloudflare':
        return this.cloudflareCreateUpload(dto);
      default:
        return { status: 'waiting', meta: { note: 'local provider — no CDN' } };
    }
  }

  // ── Mux ──────────────────────────────────────────────────────────────────

  private async muxCreateUpload(dto: CreateVideoAssetDto): Promise<{
    assetId?: string;
    playbackId?: string;
    playbackUrl?: string;
    uploadUrl?: string;
    status: VideoAsset['status'];
    meta: Record<string, unknown>;
  }> {
    const tokenId = this.config.get<string>('MUX_TOKEN_ID');
    const tokenSecret = this.config.get<string>('MUX_TOKEN_SECRET');

    if (!tokenId || !tokenSecret || tokenId === 'replace_me') {
      this.logger.warn('MUX_TOKEN_ID/SECRET non configurés — mode local');
      return { status: 'waiting', meta: { provider_note: 'mux_unconfigured' } };
    }

    const credentials = Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64');

    // If source_url provided, use direct upload from URL
    if (dto.source_url) {
      const res = await fetch('https://api.mux.com/video/v1/assets', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [{ url: dto.source_url }],
          playback_policy: ['public'],
          meta: { title: dto.title },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`Mux asset creation failed: ${err}`);
        return { status: 'errored', meta: { mux_error: err } };
      }

      const json = await res.json() as any;
      const asset = json.data;
      const playbackId = asset.playback_ids?.[0]?.id;

      return {
        assetId: asset.id,
        playbackId,
        playbackUrl: playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : undefined,
        status: asset.status === 'ready' ? 'ready' : 'preparing',
        meta: { mux_asset_id: asset.id },
      };
    }

    // Direct upload URL for client-side upload
    const res = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        new_asset_settings: { playback_policy: ['public'] },
        cors_origin: '*',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Mux upload creation failed: ${err}`);
      return { status: 'errored', meta: { mux_error: err } };
    }

    const json = await res.json() as any;
    return {
      assetId: json.data?.asset_id,
      uploadUrl: json.data?.url,
      status: 'waiting',
      meta: { mux_upload_id: json.data?.id, upload_url: json.data?.url },
    };
  }

  private async handleMuxWebhook(payload: Record<string, unknown>): Promise<void> {
    const type = payload['type'] as string;
    const data = payload['data'] as Record<string, unknown>;
    if (!data?.id) return;

    const assetId = data.id as string;
    const playbackId = (data['playback_ids'] as any[])?.[0]?.id;

    let status: VideoAsset['status'] | null = null;
    if (type === 'video.asset.ready') status = 'ready';
    else if (type === 'video.asset.errored') status = 'errored';
    else if (type === 'video.upload.asset_created') status = 'preparing';

    if (!status) return;

    await (this.supabase.client as any)
      .from('video_assets')
      .update({
        status,
        playback_id: playbackId ?? null,
        playback_url: playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null,
        thumbnail_url: playbackId
          ? `https://image.mux.com/${playbackId}/thumbnail.jpg`
          : null,
        duration_sec: data['duration'] ?? null,
      })
      .eq('provider', 'mux')
      .eq('provider_asset_id', assetId);
  }

  // ── Cloudflare Stream ─────────────────────────────────────────────────────

  private async cloudflareCreateUpload(dto: CreateVideoAssetDto): Promise<{
    assetId?: string;
    playbackId?: string;
    playbackUrl?: string;
    uploadUrl?: string;
    status: VideoAsset['status'];
    meta: Record<string, unknown>;
  }> {
    const token = this.config.get<string>('CLOUDFLARE_STREAM_TOKEN');
    const accountId = this.config.get<string>('CLOUDFLARE_ACCOUNT_ID');

    if (!token || !accountId || token === 'replace_me') {
      this.logger.warn('CLOUDFLARE_STREAM_TOKEN/ACCOUNT_ID non configurés — mode local');
      return { status: 'waiting', meta: { provider_note: 'cloudflare_unconfigured' } };
    }

    if (dto.source_url) {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: dto.source_url, meta: { name: dto.title } }),
        },
      );

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`Cloudflare Stream copy failed: ${err}`);
        return { status: 'errored', meta: { cf_error: err } };
      }

      const json = await res.json() as any;
      const result = json.result;
      return {
        assetId: result.uid,
        playbackUrl: result.playback?.hls,
        status: result.readyToStream ? 'ready' : 'preparing',
        meta: { cf_uid: result.uid },
      };
    }

    // TUS direct upload
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': '0',
          'Upload-Metadata': `name ${Buffer.from(dto.title).toString('base64')}`,
        },
      },
    );

    const uploadUrl = res.headers.get('Location');
    const uid = res.headers.get('stream-media-id');
    return {
      assetId: uid ?? undefined,
      uploadUrl: uploadUrl ?? undefined,
      status: 'waiting',
      meta: { cf_uid: uid, upload_url: uploadUrl },
    };
  }

  private async handleCloudflareWebhook(payload: Record<string, unknown>): Promise<void> {
    const uid = payload['uid'] as string;
    if (!uid) return;

    const readyToStream = payload['readyToStream'] as boolean;
    const status: VideoAsset['status'] = readyToStream ? 'ready' : 'preparing';

    await (this.supabase.client as any)
      .from('video_assets')
      .update({ status })
      .eq('provider', 'cloudflare')
      .eq('provider_asset_id', uid);
  }

  private async deleteFromProvider(asset: VideoAsset): Promise<void> {
    if (asset.provider === 'mux' && asset.provider_asset_id) {
      const tokenId = this.config.get<string>('MUX_TOKEN_ID');
      const tokenSecret = this.config.get<string>('MUX_TOKEN_SECRET');
      if (!tokenId || !tokenSecret) return;
      const credentials = Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64');
      await fetch(`https://api.mux.com/video/v1/assets/${asset.provider_asset_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Basic ${credentials}` },
      });
    } else if (asset.provider === 'cloudflare' && asset.provider_asset_id) {
      const token = this.config.get<string>('CLOUDFLARE_STREAM_TOKEN');
      const accountId = this.config.get<string>('CLOUDFLARE_ACCOUNT_ID');
      if (!token || !accountId) return;
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${asset.provider_asset_id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      );
    }
  }
}
