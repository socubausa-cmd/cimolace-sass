import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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
