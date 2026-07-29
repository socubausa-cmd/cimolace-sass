import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * File d'attente « replay → cours enseignable ».
 *
 * La construction d'un cours (extraction du contenu, plan pédagogique, rédaction des
 * leçons avec contrôle anti-copie) dure plusieurs minutes : elle ne peut pas tenir dans
 * une requête HTTP. L'API se contente donc d'enregistrer une DEMANDE ; le worker
 * (`course-from-replay`) la traite et publie le cours en BROUILLON au poste production.
 */
@Injectable()
export class CourseJobService {
  constructor(private readonly supabase: SupabaseService) {}

  private get db(): any {
    return this.supabase.client as any;
  }

  /** Crée (ou réutilise) une demande pour ce replay. */
  async request(tenantId: string, userId: string, videoId: string) {
    if (!videoId) throw new BadRequestException('videoId manquant');

    const { data: video } = await this.db
      .from('published_videos')
      .select('id, title, transcript_text')
      .eq('id', videoId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!video) throw new NotFoundException('Replay introuvable pour cette école.');
    if (!video.transcript_text?.trim()) {
      throw new BadRequestException("Ce replay n'a pas encore de transcription : le cours ne peut pas être construit.");
    }

    // Une demande déjà en cours pour ce replay ? On la renvoie plutôt que d'empiler.
    const { data: running } = await this.db
      .from('course_generation_jobs')
      .select('*')
      .eq('video_id', videoId)
      .in('status', ['pending', 'extracting', 'planning', 'writing', 'publishing'])
      .maybeSingle();
    if (running) return { job: running, reused: true };

    // `source_type`/`source_id` sont renseignés dès la création : la file est
    // désormais multi-sources (Atelier unifié) et le worker s'en sert pour
    // retrouver un pivot déjà extrait — auquel cas il NE REFAIT PAS le plan.
    const { data, error } = await this.db
      .from('course_generation_jobs')
      .insert({
        tenant_id: tenantId,
        video_id: videoId,
        source_type: 'replay',
        source_id: videoId,
        requested_by: userId,
        status: 'pending',
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { job: data, reused: false };
  }

  /**
   * Met en file une source QUELCONQUE (Atelier unifié). `request()` reste
   * réservé aux replays pour ne rien casser côté Vidéothèque.
   *
   * Idempotent sur deux plans : un job déjà en vol pour cette source est
   * renvoyé tel quel, et une source déjà transformée en cours n'est pas
   * refaite (sauf `force`) — sans quoi un batch relancé repayerait tout.
   */
  async requestAny(
    tenantId: string,
    userId: string,
    sourceType: string,
    sourceId: string,
    opts: { force?: boolean } = {},
  ) {
    if (!sourceId) throw new BadRequestException('sourceId manquant');
    if (!['replay', 'tiktok'].includes(sourceType)) {
      throw new BadRequestException(
        `La production de parcours depuis « ${sourceType} » n'est pas encore branchée au worker. ` +
        'Utilise un replay ou une vidéo TikTok transcrite.',
      );
    }

    const sourceTable = sourceType === 'replay' ? 'published_videos' : 'precepteur_sources';
    const { data: source } = await this.db
      .from(sourceTable)
      .select('id, transcript_text')
      .eq('id', sourceId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!source) throw new NotFoundException('Source introuvable pour cette école.');
    if (!String(source.transcript_text || '').trim()) {
      throw new BadRequestException("Cette source n'a pas encore de transcription exploitable.");
    }

    const { data: running } = await this.db
      .from('course_generation_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .in('status', ['pending', 'extracting', 'planning', 'writing', 'publishing'])
      .maybeSingle();
    if (running) return { job: running, reused: true };

    if (!opts.force) {
      const { data: done } = await this.db
        .from('course_generation_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)
        .eq('status', 'done')
        .maybeSingle();
      if (done) {
        if (!done.pivot_id) {
          const { data: root } = await this.db
            .from('course_pivots')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('source_type', sourceType)
            .eq('source_id', sourceId)
            .eq('kind', 'comprehension')
            .is('parent_id', null)
            .maybeSingle();
          if (root?.id) {
            const { data: linked } = await this.db
              .from('course_generation_jobs')
              .update({ pivot_id: root.id })
              .eq('id', done.id)
              .select('*')
              .single();
            if (linked) return { job: linked, reused: true, alreadyDone: true };
          }
        }
        return { job: done, reused: true, alreadyDone: true };
      }
    }

    const { data, error } = await this.db
      .from('course_generation_jobs')
      .insert({
        tenant_id: tenantId,
        source_type: sourceType,
        source_id: sourceId,
        // La colonne reste alimentée pour les replays (compatibilité + FK).
        video_id: sourceType === 'replay' ? sourceId : null,
        requested_by: userId,
        status: 'pending',
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { job: data, reused: false };
  }

  /**
   * PONT « Importer une vidéo » du Studio → pipeline post-production.
   *
   * Avant : le bouton d'import du Studio téléversait le fichier dans le bucket
   * Supabase public `videos` et gardait un UUID ALÉATOIRE — jamais inséré dans
   * `published_videos`. Résultat : la transcription, les segments et
   * « course-from-replay » renvoyaient 404 (aucune ligne ne portait cet UUID).
   * Le pipeline n'était donc alimenté QUE par le CLI racine, invisible de l'UI.
   *
   * Ici on reproduit `.studio-import-file.mjs` côté serveur : on récupère l'objet
   * déjà téléversé (URL publique du bucket `videos`), on le recopie sur R2 sous
   * une clé `…/local-<slug>.<ext>` (le worker de transcription balaie `%local-%`),
   * puis on insère `zoom_recordings` + `published_videos` (transcript VIDE). Le
   * worker Deepgram écrit ensuite la transcription ; le replay se comporte alors
   * comme n'importe quel replay de la Vidéothèque (segments, cours, montage).
   *
   * Renvoie le VRAI `published_videos.id` — à brancher côté front à la place de
   * l'UUID aléatoire, pour que toute la chaîne (déjà verte) trouve la ligne.
   */
  async importStudioFile(
    tenantId: string,
    dto: { storagePath?: string; title?: string; description?: string; durationSeconds?: number },
  ) {
    const storagePath = String(dto.storagePath || '').trim().replace(/^\/+/, '');
    const title = String(dto.title || '').trim() || 'Vidéo importée (Studio)';
    if (!storagePath) throw new BadRequestException('storagePath manquant');
    if (storagePath.includes('..')) throw new BadRequestException('storagePath invalide');

    const acct = process.env.CF_R2_ACCOUNT_ID;
    const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY;
    const bucket = process.env.CF_R2_BUCKET;
    if (!acct || !accessKeyId || !secretAccessKey || !bucket) {
      throw new BadRequestException('Stockage R2 non configuré côté serveur.');
    }

    // Idempotence : un import du même titre pour ce tenant renvoie l'existant
    // (le worker de transcription reprendra si le transcript est encore vide).
    const { data: exist } = await this.db
      .from('published_videos')
      .select('id, storage_key, transcript_text')
      .eq('tenant_id', tenantId)
      .eq('title', title)
      .maybeSingle();
    if (exist) {
      return {
        publishedVideoId: exist.id,
        storageKey: exist.storage_key,
        transcribed: Boolean(String(exist.transcript_text || '').trim()),
        reused: true,
      };
    }

    const MAX = 400 * 1024 * 1024; // 400 Mo : au-delà, passer par le pipeline Zoom.
    const ext = (storagePath.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const isAudio = ['m4a', 'mp3', 'wav', 'aac', 'ogg', 'oga'].includes(ext);

    // 1) récupère le fichier déjà téléversé dans le bucket `videos`. Le bucket est
    //    PRIVÉ → on lit via le client service_role (téléchargement direct), pas via
    //    une URL publique (qui renverrait 400). Repli sur l'URL publique au cas où
    //    le bucket deviendrait public un jour.
    let buf: Buffer | null = null;
    let contentType = isAudio ? 'audio/mp4' : 'video/mp4';
    const dl = await this.db.storage.from('videos').download(storagePath);
    if (dl?.data) {
      buf = Buffer.from(await dl.data.arrayBuffer());
      if (dl.data.type) contentType = dl.data.type;
    } else {
      const supaUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
      const publicUrl = `${supaUrl}/storage/v1/object/public/videos/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(publicUrl);
      if (!res.ok) {
        throw new BadRequestException(`Fichier introuvable dans le stockage (${res.status}). Re-téléverse la vidéo.`);
      }
      buf = Buffer.from(await res.arrayBuffer());
      contentType = res.headers.get('content-type') || contentType;
    }
    if (!buf || !buf.length) throw new BadRequestException('Fichier vide ou introuvable.');
    if (buf.length > MAX) {
      throw new BadRequestException('Fichier trop volumineux pour l’import Studio (>400 Mo). Utilise le pipeline Zoom.');
    }

    // 2) copie vers R2 sous une clé `local-` (balayée par le worker de transcription).
    const slug = `${Date.now().toString(36)}-${Math.abs(this.hash(storagePath)).toString(36).slice(0, 5)}`;
    const key = `zoom-replays/${tenantId}/local-${slug}.${ext}`;
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${acct}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buf, ContentType: contentType }));

    // 3) insère la source (transcript VIDE → le worker Deepgram la prend).
    const durationSec = Math.max(0, Math.round(Number(dto.durationSeconds) || 0));
    const nowIso = new Date().toISOString();
    const { data: rec } = await this.db
      .from('zoom_recordings')
      .upsert(
        {
          tenant_id: tenantId,
          zoom_meeting_id: `studio-${slug}`,
          topic: title,
          start_time: nowIso,
          duration_min: Math.round(durationSec / 60) || 0,
          total_size: buf.length,
          status: 'downloaded',
          storage_key: key,
          category: title,
          is_published: true,
          published_at: nowIso,
          metadata: { source: 'studio-import' },
        },
        { onConflict: 'tenant_id,zoom_meeting_id' },
      )
      .select('id')
      .single();

    const { data: pv, error: pe } = await this.db
      .from('published_videos')
      .insert({
        recording_id: rec?.id || null,
        tenant_id: tenantId,
        title,
        description: String(dto.description || '').trim() || 'Import Studio — pipeline post-production',
        playback_url: key,
        duration_sec: durationSec,
        category: title,
        storage_key: key,
        source: 'zoom',
        locale: 'fr',
        is_public: true,
        published_at: nowIso,
      })
      .select('id')
      .single();
    if (pe) throw new BadRequestException('published_videos: ' + pe.message);

    return { publishedVideoId: pv.id, storageKey: key, transcribed: false, reused: false };
  }

  private hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
  }

  /** État d'une demande (le front interroge pour suivre l'avancement). */
  async get(tenantId: string, jobId: string) {
    const { data } = await this.db
      .from('course_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!data) throw new NotFoundException('Demande introuvable.');
    return data;
  }

  /** Dernière demande connue pour un replay (permet de rouvrir le suivi). */
  async latestForVideo(tenantId: string, videoId: string) {
    const { data } = await this.db
      .from('course_generation_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  }
}
