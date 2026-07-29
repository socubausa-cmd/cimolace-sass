import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { NormalizedSource, SourceType } from './pivot.types';

/**
 * ADAPTATEURS DE SOURCE — lot 2 de l'Atelier unifié.
 *
 * Le noyau ne doit PAS savoir d'où vient un contenu. Chaque adaptateur ramène
 * sa source à la même forme `{ titre, transcription, repères, durée }`.
 *
 * C'est ce qui débloque TikTok : jusqu'ici, seuls les replays pouvaient être
 * transformés en cours, parce que tout le code lisait `published_videos`
 * directement. 622 vidéos restaient inatteignables faute d'un chemin d'entrée.
 */
@Injectable()
export class SourceAdaptersService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Charge n'importe quelle source, normalisée. */
  async load(sourceType: SourceType, sourceId: string, tenantId: string): Promise<NormalizedSource> {
    switch (sourceType) {
      case 'replay':
        return this.loadReplay(sourceId, tenantId);
      case 'tiktok':
        return this.loadTiktok(sourceId, tenantId);
      case 'texte':
        return this.loadTexte(sourceId, tenantId);
      case 'document':
        return this.loadDocument(sourceId, tenantId);
      default:
        throw new BadRequestException(`Type de source inconnu : ${sourceType}`);
    }
  }

  /** Replay Zoom → R2, table `published_videos`. */
  private async loadReplay(id: string, tenantId: string): Promise<NormalizedSource> {
    const { data } = await (this.supabase.client as any)
      .from('published_videos')
      .select('id, title, transcript_text, transcript_cues, duration_sec, tenant_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!data) throw new NotFoundException('Replay introuvable pour cette école.');
    const transcript = String(data.transcript_text || '').trim();
    if (!transcript) {
      throw new BadRequestException(
        "Ce replay n'a pas encore de transcription : rien à comprendre pour l'instant.",
      );
    }
    return {
      id: data.id,
      tenantId: data.tenant_id,
      title: data.title || 'Séance',
      transcript,
      // Les imports historiques ont employé `start`, `start_sec` puis `t`.
      // Le noyau ne doit pas connaître ces trois dialectes : il reçoit toujours
      // un repère `t` normalisé, sinon toute nouvelle notion retombe à 0 seconde.
      cues: Array.isArray(data.transcript_cues)
        ? data.transcript_cues
            .map((cue: any) => ({
              t: Number(cue?.t ?? cue?.start_sec ?? cue?.start ?? 0),
              text: String(cue?.text ?? cue?.transcript ?? '').trim(),
            }))
            .filter((cue: any) => cue.text)
        : undefined,
      durationSec: data.duration_sec ?? undefined,
    };
  }

  /** Vidéo TikTok, table `precepteur_sources` (pipeline tools/precepteur-tiktok). */
  private async loadTiktok(id: string, tenantId: string): Promise<NormalizedSource> {
    const { data } = await (this.supabase.client as any)
      .from('precepteur_sources')
      .select('id, title, transcript_text, duration_sec, tenant_id, status')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!data) throw new NotFoundException('Vidéo TikTok introuvable pour cette école.');
    const transcript = String(data.transcript_text || '').trim();
    if (!transcript) {
      // 622 des 645 vidéos sont encore au statut `new` : elles doivent d'abord
      // passer par l'étape de transcription (sous-titres TikTok, sinon Whisper).
      throw new BadRequestException(
        `Cette vidéo n'est pas encore transcrite (statut « ${data.status || 'new'} »).`,
      );
    }
    return {
      id: data.id,
      tenantId: data.tenant_id,
      title: data.title || 'Vidéo',
      transcript,
      durationSec: data.duration_sec ?? undefined,
    };
  }

  /**
   * Texte collé. `sourceId` porte directement le contenu : il n'y a pas de
   * ligne en base à lire. L'identité du pivot est alors l'empreinte du texte,
   * calculée par l'appelant — deux collages identiques ne repayent pas l'IA.
   */
  private async loadTexte(raw: string, tenantId: string): Promise<NormalizedSource> {
    const transcript = String(raw || '').trim();
    if (transcript.length < 200) {
      throw new BadRequestException('Texte trop court pour en tirer un cours (200 caractères minimum).');
    }
    const firstLine = transcript.split('\n').find((l) => l.trim().length > 3) || 'Texte';
    return {
      id: 'texte',
      tenantId,
      title: firstLine.trim().slice(0, 120),
      transcript,
    };
  }

  /** Document distant (URL). Extraction volontairement minimale : texte brut. */
  private async loadDocument(url: string, tenantId: string): Promise<NormalizedSource> {
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException('URL de document invalide.');
    }
    let body = '';
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = await res.text();
    } catch (e) {
      throw new BadRequestException(`Document illisible : ${(e as Error).message}`);
    }
    // Dégraissage HTML sommaire (scripts/styles/balises) — suffisant pour du texte.
    const transcript = body
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (transcript.length < 200) {
      throw new BadRequestException("Ce document ne contient pas assez de texte exploitable.");
    }
    return { id: url, tenantId, title: url.split('/').pop() || 'Document', transcript };
  }

  /**
   * Inventaire pour l'écran Atelier : toutes les sources disponibles, avec
   * l'état de leur transcription. Sans cette vue, l'utilisateur ne sait pas
   * ce qui est prêt à être transformé.
   */
  async getSource(tenantId: string, type: SourceType, id: string) {
    if (type === 'replay') {
      const { data } = await (this.supabase.client as any)
        .from('published_videos')
        .select('id, title, duration_sec, transcript_text, created_at')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!data) throw new NotFoundException('Replay introuvable pour cette école.');
      const transcript = String(data.transcript_text || '');
      return {
        id: data.id,
        title: data.title,
        durationSec: data.duration_sec,
        ready: !!transcript.trim(),
        chars: transcript.length,
        createdAt: data.created_at,
      };
    }
    if (type === 'tiktok') {
      const { data } = await (this.supabase.client as any)
        .from('precepteur_sources')
        .select('id, title, status, transcript_text, published_at')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!data) throw new NotFoundException('Vidéo TikTok introuvable pour cette école.');
      const transcript = String(data.transcript_text || '');
      return {
        id: data.id,
        title: data.title,
        status: data.status,
        ready: !!transcript.trim(),
        chars: transcript.length,
        publishedAt: data.published_at,
      };
    }
    if (type === 'texte') {
      const raw = String(id || '');
      const firstLine = raw.split('\n').find((l) => l.trim().length > 3) || 'Texte collé';
      return {
        id: raw,
        title: firstLine.trim().slice(0, 120),
        ready: raw.trim().length >= 200,
        chars: raw.length,
      };
    }
    if (type === 'document') {
      const title = decodeURIComponent(String(id || '')).split('/').filter(Boolean).pop() || 'Document';
      return { id, title, ready: true, chars: 0 };
    }
    throw new BadRequestException(`Type de source inconnu : ${type}`);
  }

  async listSources(tenantId: string, type: SourceType) {
    if (type === 'replay') {
      const { data } = await (this.supabase.client as any)
        .from('published_videos')
        .select('id, title, duration_sec, transcript_text, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      return (data ?? []).map((v: any) => ({
        id: v.id,
        title: v.title,
        durationSec: v.duration_sec,
        ready: !!String(v.transcript_text || '').trim(),
        chars: String(v.transcript_text || '').length,
      }));
    }
    if (type === 'tiktok') {
      const { data } = await (this.supabase.client as any)
        .from('precepteur_sources')
        .select('id, title, status, transcript_text, published_at')
        .eq('tenant_id', tenantId)
        .order('published_at', { ascending: false });
      return (data ?? []).map((v: any) => ({
        id: v.id,
        title: v.title,
        status: v.status,
        ready: !!String(v.transcript_text || '').trim(),
        chars: String(v.transcript_text || '').length,
      }));
    }
    return [];
  }
}
