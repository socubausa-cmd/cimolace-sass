/**
 * ZoomEngineService — Orchestre la synchronisation des enregistrements Zoom.
 *
 * Utilise Zoom Cloud Recording API via OAuth pour lister et télécharger
 * les enregistrements, puis stocker les métadonnées en base.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SupabaseService } from '../supabase/supabase.service';
import { ZoomOAuthService } from './zoom-oauth.service';

const ZOOM_API_BASE = 'https://api.zoom.us/v2';

@Injectable()
export class ZoomEngineService {
  private readonly logger = new Logger(ZoomEngineService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly zoomOAuth: ZoomOAuthService,
  ) {}

  // ── Synchroniser les enregistrements depuis Zoom ─────────────────────────

  async syncRecordings(tenantId: string, days = 30): Promise<{
    found: number;
    new: number;
    logId: string;
  }> {
    // Créer un log de sync
    const { data: logEntry, error: logErr } = await (this.supabase.client as any)
      .from('zoom_sync_logs')
      .insert({ tenant_id: tenantId, status: 'running' })
      .select('id')
      .single();

    if (logErr) throw new Error(`Erreur création log: ${logErr.message}`);
    const logId = logEntry.id;

    try {
      const token = await this.zoomOAuth.getValidToken(tenantId);
      const recordings = await this.fetchRecordings(token, days);

      let newCount = 0;
      for (const rec of recordings) {
        const saved = await this.upsertRecording(tenantId, rec);
        if (saved) newCount++;
      }

      // Mettre à jour le log
      await (this.supabase.client as any)
        .from('zoom_sync_logs')
        .update({
          status: 'success',
          recordings_found: recordings.length,
          recordings_new: newCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logId);

      this.logger.log(`Sync terminé: ${recordings.length} trouvées, ${newCount} nouvelles`);

      return { found: recordings.length, new: newCount, logId };
    } catch (err) {
      await (this.supabase.client as any)
        .from('zoom_sync_logs')
        .update({
          status: 'error',
          error_message: (err as Error).message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logId);

      throw err;
    }
  }

  // ── Appel API Zoom Cloud Recording ────────────────────────────────────────

  private async fetchRecordings(token: string, days: number): Promise<any[]> {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = new Date().toISOString().split('T')[0];

    let allRecordings: any[] = [];
    let pageToken: string | null = null;

    do {
      const params: URLSearchParams = new URLSearchParams({ from, to, page_size: '30' });
      if (pageToken) params.append('next_page_token', pageToken);

      const res: Response = await fetch(`${ZOOM_API_BASE}/users/me/recordings?${params}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Zoom API error ${res.status}: ${text}`);
      }

      const data: any = await res.json();
      allRecordings = allRecordings.concat(data.meetings || []);
      pageToken = data.next_page_token || null;
    } while (pageToken);

    return allRecordings;
  }

  // ── Sauvegarder ou ignorer un enregistrement ──────────────────────────────

  private async upsertRecording(tenantId: string, meeting: any): Promise<boolean> {
    const uuid = meeting.uuid;
    if (!uuid) return false;

    const { data: existing } = await (this.supabase.client as any)
      .from('zoom_recordings')
      .select('id')
      .eq('zoom_meeting_id', uuid)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existing) return false; // Déjà importé

    const recordingFiles = meeting.recording_files || [];
    const videoFiles = recordingFiles.filter((f: any) =>
      f.file_type === 'MP4' && f.status === 'completed'
    );

    if (videoFiles.length === 0) return false;

    // Prendre le premier MP4 (souvent le recording principal)
    const mainVideo = videoFiles[0];
    const totalSize = recordingFiles.reduce((acc: number, f: any) => acc + (f.file_size || 0), 0);
    const totalDuration = meeting.duration || 0;

    // Extraire le topic comme titre, nettoyé
    const topic = meeting.topic || 'Réunion sans titre';

    await (this.supabase.client as any)
      .from('zoom_recordings')
      .insert({
        tenant_id: tenantId,
        zoom_meeting_id: uuid,
        zoom_meeting_number: meeting.id,
        topic,
        agenda: meeting.agenda || null,
        start_time: meeting.start_time || null,
        end_time: meeting.end_time || null,
        duration_min: totalDuration,
        recording_count: videoFiles.length,
        total_size: totalSize,
        status: 'pending',
        download_url: mainVideo.download_url || null,
        thumbnail_url: null,
        metadata: { recording_files_count: recordingFiles.length, video_files: videoFiles.length },
      });

    return true;
  }

  // ─── CRUD Enregistrements ─────────────────────────────────────────────────

  async listRecordings(tenantId: string, options?: {
    status?: string;
    is_published?: boolean;
    limit?: number;
    offset?: number;
  }) {
    let query = (this.supabase.client as any)
      .from('zoom_recordings')
      .select('id, zoom_meeting_number, topic, agenda, start_time, duration_min, status, is_published, category, tags, thumbnail_url, playback_url, created_at, updated_at, error_message', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.status) query = query.eq('status', options.status);
    if (options?.is_published !== undefined) query = query.eq('is_published', options.is_published);
    if (options?.limit) query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data || [], total: count || 0 };
  }

  async getRecording(tenantId: string, recordingId: string) {
    const { data, error } = await (this.supabase.client as any)
      .from('zoom_recordings')
      .select('*')
      .eq('id', recordingId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !data) throw new Error('Enregistrement introuvable');
    return data;
  }

  async updateRecording(tenantId: string, recordingId: string, updates: any) {
    const { data, error } = await (this.supabase.client as any)
      .from('zoom_recordings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', recordingId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteRecording(tenantId: string, recordingId: string) {
    await (this.supabase.client as any)
      .from('zoom_recordings')
      .delete()
      .eq('id', recordingId)
      .eq('tenant_id', tenantId);
  }

  // ─── Sync Logs ────────────────────────────────────────────────────────────

  async getSyncLogs(tenantId: string, limit = 10) {
    const { data } = await (this.supabase.client as any)
      .from('zoom_sync_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(limit);
    return data || [];
  }

  // ─── Vidéos publiées ─────────────────────────────────────────────────────

  async publishVideo(tenantId: string, dto: {
    recording_id: string;
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
    is_featured?: boolean;
  }) {
    const recording = await this.getRecording(tenantId, dto.recording_id);
    if (!recording.playback_url && !recording.download_url) {
      throw new Error('Cette vidéo n\'a pas encore été téléchargée. Lancez d\'abord le traitement.');
    }

    const { data, error } = await (this.supabase.client as any)
      .from('published_videos')
      .insert({
        recording_id: recording.id,
        tenant_id: tenantId,
        title: dto.title || recording.topic,
        description: dto.description || recording.agenda || null,
        playback_url: recording.playback_url,
        thumbnail_url: recording.thumbnail_url || null,
        duration_sec: recording.duration_min ? recording.duration_min * 60 : null,
        category: dto.category || recording.category || null,
        tags: dto.tags || recording.tags || [],
        is_featured: dto.is_featured || false,
        is_public: true,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    // Marquer le recording comme publié
    await (this.supabase.client as any)
      .from('zoom_recordings')
      .update({ is_published: true, published_at: new Date().toISOString(), status: 'published' })
      .eq('id', recording.id);

    return data;
  }

  async listPublishedVideos(tenantId: string) {
    const { data } = await (this.supabase.client as any)
      .from('published_videos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_public', true)
      .order('published_at', { ascending: false });
    const rows: any[] = data || [];
    // Les vidéos hébergées sur R2 stockent une `storage_key` : on présigne à la lecture
    // (URL éphémère, régénérée à chaque appel) — même modèle que les replays live.
    await Promise.all(
      rows.map(async (row) => {
        if (row.storage_key) {
          const signed = await this.presignR2(row.storage_key);
          if (signed) row.playback_url = signed;
        }
      }),
    );
    return rows;
  }

  // ── Présignature R2 (lecture) ─────────────────────────────────────────────
  private async presignR2(key: string, ttlSeconds = 604800): Promise<string | null> {
    const accountId = process.env.CF_R2_ACCOUNT_ID;
    const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY;
    const bucket = process.env.CF_R2_BUCKET;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !key) return null;
    try {
      const client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
      return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: ttlSeconds,
      });
    } catch (err) {
      this.logger.error(`presignR2 failed: ${(err as Error).message}`);
      return null;
    }
  }

  async unpublishVideo(videoId: string) {
    await (this.supabase.client as any)
      .from('published_videos')
      .update({ is_public: false })
      .eq('id', videoId);
  }
}
