/**
 * SocialPublisherService — Publication sur TikTok, Facebook, Instagram, LinkedIn.
 *
 * Architecture "draft-first" :
 *   1. On crée un brouillon en base (social_posts)
 *   2. L'admin valide depuis le dashboard
 *   3. La publication effective est déclenchée à la main / par le worker
 *
 * TikTok   : Content Posting API v2 (PULL_FROM_URL)
 * Meta     : Graph API v19.0 — Facebook Page Reels + Instagram Reels (2 temps)
 * LinkedIn : /rest API versionnée — upload d'octets (pas de PULL_FROM_URL)
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

  /**
   * Télécharge les octets du clip depuis R2. LinkedIn n'accepte PAS de
   * PULL_FROM_URL (contrairement à TikTok/Meta) : il faut lui POUSSER la vidéo.
   */
  private async downloadClipBytes(storageKey: string): Promise<Uint8Array | null> {
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
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
    );
    if (!res.Body) return null;
    return (res.Body as any).transformToByteArray();
  }

  /** Légende commune (titre + description + hashtags normalisés). */
  private buildCaption(post: any, clip: any): string {
    const tags = (post.hashtags || [])
      .map((h: string) => (h.startsWith('#') ? h : `#${h}`))
      .join(' ');
    return [post.title || clip.title, post.description, tags]
      .filter(Boolean)
      .join('\n\n');
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

  // ─── Publier sur Instagram Reels (via le compte Meta) ────────────────────
  // IG passe par l'API Graph avec le token 'facebook' (Meta) + l'ig_user_id
  // résolu à la connexion. Flux en 2 temps : conteneur REELS → attente encodage
  // → media_publish.
  async publishToInstagram(tenantId: string, postId: string): Promise<boolean> {
    const post = await this.getPost(postId);
    if (!post) throw new Error('Post introuvable');

    const token = await this.getToken(tenantId, 'facebook');
    if (!token) throw new Error('Compte Meta (Facebook/Instagram) non connecté');
    const igUserId = token.metadata?.ig_user_id;
    if (!igUserId) {
      throw new Error(
        'Aucun compte Instagram Business lié à la Page Facebook connectée',
      );
    }

    const clip = await this.getShortClip(post.short_clip_id);
    if (!clip) throw new Error('Clip introuvable');

    const videoUrl = clip.storage_key
      ? await this.presignClipUrl(clip.storage_key)
      : null;
    if (!videoUrl) throw new Error('URL vidéo introuvable');

    try {
      // 1) Création du conteneur média (REELS)
      const createParams = new URLSearchParams({
        media_type: 'REELS',
        video_url: videoUrl,
        caption: this.buildCaption(post, clip),
        access_token: token.access_token,
      });
      const createRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media?${createParams}`,
        { method: 'POST' },
      );
      const createData: any = await createRes.json();
      if (!createRes.ok || !createData?.id) {
        throw new Error(
          `IG container ${createRes.status}: ${JSON.stringify(createData).slice(0, 200)}`,
        );
      }
      const creationId = createData.id;

      // 2) Attente de l'encodage (IG traite la vidéo de façon asynchrone)
      let ready = false;
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const stRes = await fetch(
          `https://graph.facebook.com/v19.0/${creationId}?fields=status_code&access_token=${token.access_token}`,
        );
        const stData: any = await stRes.json();
        if (stData?.status_code === 'FINISHED') {
          ready = true;
          break;
        }
        if (stData?.status_code === 'ERROR') {
          throw new Error('Instagram a rejeté la vidéo (encodage)');
        }
      }
      if (!ready) throw new Error('Instagram : encodage trop long (timeout)');

      // 3) Publication
      const pubParams = new URLSearchParams({
        creation_id: creationId,
        access_token: token.access_token,
      });
      const pubRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media_publish?${pubParams}`,
        { method: 'POST' },
      );
      const pubData: any = await pubRes.json();
      if (!pubRes.ok || !pubData?.id) {
        throw new Error(
          `IG publish ${pubRes.status}: ${JSON.stringify(pubData).slice(0, 200)}`,
        );
      }

      await this.updatePostStatus(postId, {
        status: 'published',
        platform_post_id: pubData.id,
        platform_url: `https://www.instagram.com/reel/${pubData.id}`,
        published_at: new Date().toISOString(),
      });
      this.logger.log(`✅ Publié sur Instagram: ${post.title || clip.title}`);
      return true;
    } catch (err) {
      await this.updatePostStatus(postId, {
        status: 'failed',
        error_message: (err as Error).message,
      });
      this.logger.error(`❌ Instagram publish failed: ${(err as Error).message}`);
      return false;
    }
  }

  // ─── Publier sur LinkedIn (vidéo native) ─────────────────────────────────
  // LinkedIn n'a pas de PULL_FROM_URL : on initialise l'upload, on POUSSE les
  // octets, on finalise, puis on crée le post (/rest API, versionnée).
  async publishToLinkedIn(tenantId: string, postId: string): Promise<boolean> {
    const post = await this.getPost(postId);
    if (!post) throw new Error('Post introuvable');

    const token = await this.getToken(tenantId, 'linkedin');
    if (!token) throw new Error('Compte LinkedIn non connecté');
    const author = token.page_id; // urn:li:person:xxx (résolu à la connexion)
    if (!author) throw new Error('URN auteur LinkedIn introuvable');

    const clip = await this.getShortClip(post.short_clip_id);
    if (!clip) throw new Error('Clip introuvable');

    const bytes = clip.storage_key
      ? await this.downloadClipBytes(clip.storage_key)
      : null;
    if (!bytes) throw new Error('Vidéo introuvable (R2)');

    const VER = {
      'LinkedIn-Version': '202401',
      'X-Restli-Protocol-Version': '2.0.0',
    };
    const AUTH = `Bearer ${token.access_token}`;

    try {
      // 1) Initialiser l'upload
      const initRes = await fetch(
        'https://api.linkedin.com/rest/videos?action=initializeUpload',
        {
          method: 'POST',
          headers: { Authorization: AUTH, 'Content-Type': 'application/json', ...VER },
          body: JSON.stringify({
            initializeUploadRequest: {
              owner: author,
              fileSizeBytes: bytes.length,
              uploadCaptions: false,
              uploadThumbnail: false,
            },
          }),
        },
      );
      const initData: any = await initRes.json();
      if (!initRes.ok) {
        throw new Error(
          `LinkedIn init ${initRes.status}: ${JSON.stringify(initData).slice(0, 200)}`,
        );
      }
      const videoUrn = initData?.value?.video;
      const instructions = initData?.value?.uploadInstructions || [];
      if (!videoUrn || !instructions.length) {
        throw new Error('LinkedIn : réponse d’initialisation invalide');
      }

      // 2) Pousser les octets (une partie suffit pour un short)
      const uploadedPartIds: string[] = [];
      for (const ins of instructions) {
        const first = ins.firstByte ?? 0;
        const last = ins.lastByte ?? bytes.length - 1;
        const putRes = await fetch(ins.uploadUrl, {
          method: 'PUT',
          headers: { Authorization: AUTH, 'Content-Type': 'application/octet-stream' },
          body: Buffer.from(bytes.slice(first, last + 1)),
        });
        if (!putRes.ok) {
          throw new Error(`LinkedIn upload part ${putRes.status}`);
        }
        const etag = putRes.headers.get('etag');
        if (etag) uploadedPartIds.push(etag.replace(/"/g, ''));
      }

      // 3) Finaliser
      const finRes = await fetch(
        'https://api.linkedin.com/rest/videos?action=finalizeUpload',
        {
          method: 'POST',
          headers: { Authorization: AUTH, 'Content-Type': 'application/json', ...VER },
          body: JSON.stringify({
            finalizeUploadRequest: {
              video: videoUrn,
              uploadToken: '',
              uploadedPartIds,
            },
          }),
        },
      );
      if (!finRes.ok) {
        const t = await finRes.text();
        throw new Error(`LinkedIn finalize ${finRes.status}: ${t.slice(0, 200)}`);
      }

      // 4) Créer le post
      const postRes = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: { Authorization: AUTH, 'Content-Type': 'application/json', ...VER },
        body: JSON.stringify({
          author,
          commentary: this.buildCaption(post, clip),
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          content: {
            media: { title: post.title || clip.title || 'Extrait', id: videoUrn },
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
      });
      if (!postRes.ok) {
        const t = await postRes.text();
        throw new Error(`LinkedIn post ${postRes.status}: ${t.slice(0, 200)}`);
      }
      const liId =
        postRes.headers.get('x-restli-id') ||
        postRes.headers.get('x-linkedin-id') ||
        null;

      await this.updatePostStatus(postId, {
        status: 'published',
        platform_post_id: liId,
        platform_url: liId
          ? `https://www.linkedin.com/feed/update/${liId}`
          : null,
        published_at: new Date().toISOString(),
      });
      this.logger.log(`✅ Publié sur LinkedIn: ${post.title || clip.title}`);
      return true;
    } catch (err) {
      await this.updatePostStatus(postId, {
        status: 'failed',
        error_message: (err as Error).message,
      });
      this.logger.error(`❌ LinkedIn publish failed: ${(err as Error).message}`);
      return false;
    }
  }

  // ─── Publier multi-plateforme ────────────────────────────────────────────

  /** Dispatch selon la plateforme d'un post. */
  async publishOne(
    tenantId: string,
    postId: string,
    platform: string,
  ): Promise<boolean> {
    switch (platform) {
      case 'tiktok':
        return this.publishToTikTok(tenantId, postId);
      case 'facebook':
        return this.publishToFacebook(tenantId, postId);
      case 'instagram':
        return this.publishToInstagram(tenantId, postId);
      case 'linkedin':
        return this.publishToLinkedIn(tenantId, postId);
      default:
        throw new Error(`Plateforme non supportée: ${platform}`);
    }
  }

  /** Publie le clip sur tous les réseaux CONNECTÉS (token présent). */
  async publishAll(tenantId: string, postId: string) {
    const results: Record<string, boolean> = {};
    const targets: Array<{ platform: string; tokenKey: string }> = [
      { platform: 'tiktok', tokenKey: 'tiktok' },
      { platform: 'facebook', tokenKey: 'facebook' },
      { platform: 'instagram', tokenKey: 'facebook' }, // IG via le compte Meta
      { platform: 'linkedin', tokenKey: 'linkedin' },
    ];
    for (const { platform, tokenKey } of targets) {
      const tok = await this.getToken(tenantId, tokenKey);
      if (!tok) continue; // réseau non connecté → on saute
      results[platform] = await this.publishOne(tenantId, postId, platform).catch(
        () => false,
      );
    }
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
