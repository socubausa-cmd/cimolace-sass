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
