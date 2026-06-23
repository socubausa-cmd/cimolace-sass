/**
 * SocialPublisherService — Publication sur TikTok, Facebook/Instagram Reels.
 *
 * Architecture "draft-first" :
 *   1. On crée un brouillon en base (social_posts)
 *   2. L'admin valide depuis le dashboard
 *   3. La publication effective est déclenchée par le worker
 *
 * TikTok API : Content Posting API (v2)
 * Meta API : Graph API (v19.0) — Pages / Reels
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class SocialPublisherService {
  private readonly logger = new Logger(SocialPublisherService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Présigne l'URL R2 (GET) du clip. Le bucket est PRIVÉ : une URL directe
   * renvoie 403 → TikTok/Meta ne peuvent pas tirer la vidéo. TTL large (7 j max
   * R2) car la plateforme télécharge la vidéo de façon asynchrone après l'appel.
   */
  private async presignClipUrl(storageKey: string): Promise<string | null> {
    const accountId = this.config.get<string>('CF_R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('CF_R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('CF_R2_SECRET_ACCESS_KEY');
    const bucket = this.config.get<string>('CF_R2_BUCKET');
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
      { expiresIn: 604800 },
    );
  }

  // ─── Gestion des tokens sociaux ──────────────────────────────────────────

  async saveToken(tenantId: string, dto: {
    platform: string;
    access_token: string;
    refresh_token?: string;
    page_id?: string;
    page_name?: string;
  }) {
    const { data: existing } = await (this.supabase.client as any)
      .from('social_tokens')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('platform', dto.platform)
      .maybeSingle();

    if (existing) {
      await (this.supabase.client as any)
        .from('social_tokens')
        .update({
          access_token: dto.access_token,
          refresh_token: dto.refresh_token || null,
          page_id: dto.page_id || null,
          page_name: dto.page_name || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await (this.supabase.client as any)
        .from('social_tokens')
        .insert({ tenant_id: tenantId, ...dto });
    }
  }

  async getTokens(tenantId: string) {
    const { data } = await (this.supabase.client as any)
      .from('social_tokens')
      .select('platform, page_name, page_id, created_at')
      .eq('tenant_id', tenantId);
    return data || [];
  }

  async getToken(tenantId: string, platform: string) {
    const { data } = await (this.supabase.client as any)
      .from('social_tokens')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('platform', platform)
      .maybeSingle();
    return data;
  }

  // ─── Création d'un brouillon de publication (draft) ───────────────────────

  async createDraft(tenantId: string, dto: {
    short_clip_id: string;
    platform: string;
    title?: string;
    description?: string;
    hashtags?: string[];
  }) {
    const { data, error } = await (this.supabase.client as any)
      .from('social_posts')
      .insert({
        short_clip_id: dto.short_clip_id,
        tenant_id: tenantId,
        platform: dto.platform,
        title: dto.title || null,
        description: dto.description || null,
        hashtags: dto.hashtags || [],
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ─── Lister les posts (drafts + publiés) ─────────────────────────────────

  async listPosts(tenantId: string) {
    const { data } = await (this.supabase.client as any)
      .from('social_posts')
      .select(`
        *,
        short_clip:short_clip_id(id, title, duration_sec, storage_key, thumbnail_url)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    return data || [];
  }

  // ─── Publier sur TikTok ──────────────────────────────────────────────────

  async publishToTikTok(tenantId: string, postId: string): Promise<boolean> {
    const post = await this.getPost(postId);
    if (!post) throw new Error('Post introuvable');

    const token = await this.getToken(tenantId, 'tiktok');
    if (!token) throw new Error('Token TikTok non configuré');

    const clip = await this.getShortClip(post.short_clip_id);
    if (!clip) throw new Error('Clip introuvable');

    // Bucket R2 privé → on PRÉSIGNE pour que la plateforme puisse tirer la vidéo.
    const videoUrl = clip.storage_key
      ? await this.presignClipUrl(clip.storage_key)
      : null;

    if (!videoUrl) throw new Error('URL vidéo introuvable');

    try {
      // TikTok Content Posting API v2
      const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: videoUrl,
          },
          post_info: {
            title: post.title || clip.title || 'Extrait',
            description: post.description || '',
            hashtags: post.hashtags || [],
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_stitch: false,
            disable_comment: false,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`TikTok API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const publishId = data?.data?.publish_id;

      await this.updatePostStatus(postId, {
        status: 'published',
        platform_post_id: publishId || null,
        platform_url: `https://tiktok.com/@${token.page_name || 'user'}/video/${publishId}`,
        published_at: new Date().toISOString(),
      });

      this.logger.log(`✅ Publié sur TikTok: ${post.title || clip.title}`);
      return true;
    } catch (err) {
      await this.updatePostStatus(postId, {
        status: 'failed',
        error_message: (err as Error).message,
      });
      this.logger.error(`❌ TikTok publish failed: ${(err as Error).message}`);
      return false;
    }
  }

  // ─── Publier sur Facebook / Instagram Reels ──────────────────────────────

  async publishToFacebook(tenantId: string, postId: string): Promise<boolean> {
    const post = await this.getPost(postId);
    if (!post) throw new Error('Post introuvable');

    const token = await this.getToken(tenantId, 'facebook');
    if (!token) throw new Error('Token Facebook non configuré');

    const clip = await this.getShortClip(post.short_clip_id);
    if (!clip) throw new Error('Clip introuvable');

    // Bucket R2 privé → on PRÉSIGNE pour que la plateforme puisse tirer la vidéo.
    const videoUrl = clip.storage_key
      ? await this.presignClipUrl(clip.storage_key)
      : null;

    if (!videoUrl) throw new Error('URL vidéo introuvable');

    try {
      const pageId = token.page_id;
      if (!pageId) throw new Error('Facebook Page ID manquant');

      const fbUrl = `https://graph.facebook.com/v19.0/${pageId}/video_reels`;
      const params = new URLSearchParams({
        access_token: token.access_token,
        video_url: videoUrl,
        title: post.title || clip.title || 'Extrait',
        description: post.description || '',
        ...(post.hashtags?.length ? { hashtags: post.hashtags.join(',') } : {}),
      });

      const res = await fetch(`${fbUrl}&${params}`, { method: 'POST' });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Facebook API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const fbPostId = data?.id;

      let platformUrl = null;
      if (fbPostId) {
        platformUrl = `https://facebook.com/${fbPostId}`;
      }

      await this.updatePostStatus(postId, {
        status: 'published',
        platform_post_id: fbPostId || null,
        platform_url: platformUrl,
        published_at: new Date().toISOString(),
      });

      this.logger.log(`✅ Publié sur Facebook: ${post.title || clip.title}`);
      return true;
    } catch (err) {
      await this.updatePostStatus(postId, {
        status: 'failed',
        error_message: (err as Error).message,
      });
      this.logger.error(`❌ Facebook publish failed: ${(err as Error).message}`);
      return false;
    }
  }

  // ─── Publier multi-plateforme ────────────────────────────────────────────

  async publishAll(tenantId: string, postId: string) {
    const results: Record<string, boolean> = {};

    results.tiktok = await this.publishToTikTok(tenantId, postId).catch(() => false);
    results.facebook = await this.publishToFacebook(tenantId, postId).catch(() => false);

    return results;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async getPost(postId: string) {
    const { data } = await (this.supabase.client as any)
      .from('social_posts')
      .select('*')
      .eq('id', postId)
      .single();
    return data;
  }

  private async getShortClip(clipId: string) {
    const { data } = await (this.supabase.client as any)
      .from('short_clips')
      .select('*')
      .eq('id', clipId)
      .single();
    return data;
  }

  private async updatePostStatus(postId: string, updates: Record<string, any>) {
    await (this.supabase.client as any)
      .from('social_posts')
      .update(updates)
      .eq('id', postId);
  }
}
