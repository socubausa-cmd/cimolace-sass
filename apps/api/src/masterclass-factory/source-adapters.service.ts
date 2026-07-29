import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { SupabaseService } from '../supabase/supabase.service';
import type { NormalizedSource, SourceType } from './pivot.types';

export function parseTimedTranscript(raw: string): { t: number; text: string }[] {
  return String(raw || '').split(/\r?\n/).map((line) => {
    const match = line.trim().match(/^\[(?:(\d+):)?(\d{1,2}):(\d{2})\]\s*(.+)$/);
    if (!match) return null;
    const hours = Number(match[1] || 0);
    return { t: hours * 3600 + Number(match[2]) * 60 + Number(match[3]), text: match[4].trim() };
  }).filter((cue): cue is { t: number; text: string } => !!cue?.text);
}

export function groupLiveCues(cues: { t: number; text: string }[], windowSec = 25) {
  const grouped: { t: number; text: string }[] = [];
  for (const cue of cues.sort((a, b) => a.t - b.t)) {
    const current = grouped[grouped.length - 1];
    if (current && cue.t - current.t < windowSec) current.text = `${current.text} ${cue.text}`.trim();
    else grouped.push({ ...cue });
  }
  return grouped;
}

export function isPrivateNetworkAddress(address: string) {
  const value = String(address || '').toLowerCase().split('%')[0];
  if (!value) return true;
  if (isIP(value) === 4) {
    const [a, b] = value.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19));
  }
  if (isIP(value) === 6) {
    if (value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(value)) return true;
    if (value.startsWith('::ffff:')) return isPrivateNetworkAddress(value.slice(7));
  }
  return false;
}

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
      case 'live':
        return this.loadLive(sourceId, tenantId);
      case 'texte':
        return this.loadTexte(sourceId, tenantId);
      case 'document':
      case 'pdf':
      case 'audio':
      case 'video':
      case 'url':
        return this.loadRegisteredSource(sourceType, sourceId, tenantId);
      default:
        throw new BadRequestException(`Type de source inconnu : ${sourceType}`);
    }
  }

  /**
   * Persiste le résultat de n'importe quel extracteur (PDF.js, DOCX, ASR,
   * sous-titres, OCR…). Le noyau reçoit ensuite toujours du texte, sans savoir
   * quel outil l'a produit. L'empreinte rend l'import idempotent par école.
   */
  async ingest(
    tenantId: string,
    userId: string,
    input: {
      sourceType: SourceType;
      title?: string;
      contentText?: string;
      sourceUrl?: string;
      mimeType?: string;
      durationSec?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    const allowed: SourceType[] = ['document', 'texte', 'pdf', 'audio', 'video', 'url'];
    if (!allowed.includes(input.sourceType)) {
      throw new BadRequestException('Ce type possède déjà son propre adaptateur et ne doit pas être réimporté.');
    }
    let contentText = String(input.contentText || '').replace(/\r\n/g, '\n').trim();
    let remoteTitle = '';
    if (input.sourceType === 'url' && !contentText) {
      const extracted = await this.extractRemotePage(String(input.sourceUrl || ''));
      contentText = extracted.text;
      remoteTitle = extracted.title;
    }
    if (contentText.length < 200) {
      throw new BadRequestException('La source extraite est trop courte (200 caractères minimum).');
    }
    if (contentText.length > 1_000_000) {
      throw new BadRequestException('La source dépasse la limite de 1 000 000 caractères.');
    }
    const contentHash = createHash('sha256').update(contentText).digest('hex');
    const row = {
      tenant_id: tenantId,
      created_by: userId || null,
      source_type: input.sourceType,
      title: String(input.title || remoteTitle || contentText.split('\n').find(Boolean) || 'Source').trim().slice(0, 180),
      content_text: contentText,
      source_url: input.sourceUrl || null,
      mime_type: input.mimeType || null,
      duration_sec: Number.isFinite(Number(input.durationSec)) ? Math.max(0, Math.round(Number(input.durationSec))) : null,
      content_hash: contentHash,
      status: 'ready',
      metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    };
    const { data, error } = await (this.supabase.client as any)
      .from('master_factory_sources')
      .upsert(row, { onConflict: 'tenant_id,source_type,content_hash' })
      .select('id, source_type, title, status, mime_type, duration_sec, content_text, created_at')
      .single();
    if (error) throw new BadRequestException(`Import Master Factory impossible : ${error.message}`);
    return this.sourceSummary(data, true);
  }

  /** Extraction HTML/texte distante avec garde SSRF, redirects contrôlés et plafond 5 Mo. */
  private async extractRemotePage(rawUrl: string) {
    let current: URL;
    try { current = new URL(rawUrl); } catch { throw new BadRequestException('Lien invalide.'); }
    for (let redirect = 0; redirect <= 3; redirect += 1) {
      if (!['http:', 'https:'].includes(current.protocol) || current.username || current.password) {
        throw new BadRequestException('Seuls les liens HTTP(S) publics sont acceptés.');
      }
      const host = current.hostname.toLowerCase();
      if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
        throw new BadRequestException('Cette adresse réseau privée est interdite.');
      }
      const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
      if (!addresses.length || addresses.some((entry) => isPrivateNetworkAddress(entry.address))) {
        throw new BadRequestException('Cette adresse réseau ne peut pas être extraite.');
      }
      const response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000),
        headers: { 'user-agent': 'Liri-Master-Factory/1.0', accept: 'text/html,text/plain,application/json,application/xml;q=0.8' },
      }).catch((error) => { throw new BadRequestException(`Lien inaccessible : ${error.message}`); });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirect === 3) throw new BadRequestException('Redirection distante invalide ou trop longue.');
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) throw new BadRequestException(`Lien inaccessible (HTTP ${response.status}).`);
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!/(text\/|application\/(json|xml|xhtml\+xml))/.test(contentType)) {
        throw new BadRequestException('Ce lien ne renvoie pas une page texte exploitable.');
      }
      const announced = Number(response.headers.get('content-length') || 0);
      if (announced > 5_000_000) throw new BadRequestException('Page trop volumineuse (> 5 Mo).');
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (reader) {
        const part = await reader.read();
        if (part.done) break;
        total += part.value.byteLength;
        if (total > 5_000_000) { await reader.cancel(); throw new BadRequestException('Page trop volumineuse (> 5 Mo).'); }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const raw = new TextDecoder().decode(bytes);
      const title = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || current.hostname;
      const text = raw
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
        .replace(/\s+/g, ' ').trim();
      return { title, text };
    }
    throw new BadRequestException('Lien non exploitable.');
  }

  private sourceSummary(data: any, includeText = false) {
    const content = String(data?.content_text || '');
    return {
      id: data.id,
      type: data.source_type,
      title: data.title,
      status: data.status,
      ready: data.status === 'ready' && content.trim().length >= 200,
      chars: content.length,
      durationSec: data.duration_sec ?? undefined,
      mimeType: data.mime_type ?? undefined,
      createdAt: data.created_at,
      ...(includeText ? { excerpt: content.slice(0, 500) } : {}),
    };
  }

  private async loadRegisteredSource(type: SourceType, id: string, tenantId: string): Promise<NormalizedSource> {
    const { data, error } = await (this.supabase.client as any)
      .from('master_factory_sources')
      .select('id, tenant_id, source_type, title, content_text, duration_sec, status')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('source_type', type)
      .maybeSingle();
    if (error) throw new BadRequestException(`Lecture de la source impossible : ${error.message}`);
    if (!data) throw new NotFoundException('Source Master Factory introuvable pour cette école.');
    const transcript = String(data.content_text || '').trim();
    if (data.status !== 'ready' || transcript.length < 200) {
      throw new BadRequestException("Cette source n'a pas encore de texte exploitable.");
    }
    return { id: data.id, tenantId: data.tenant_id, title: data.title, transcript, durationSec: data.duration_sec ?? undefined };
  }

  private async loadLive(id: string, tenantId: string): Promise<NormalizedSource> {
    const db = this.supabase.client as any;
    const { data: session } = await db.from('live_sessions')
      .select('id, tenant_id, title, kind, session_type, started_at, ended_at')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!session) throw new NotFoundException('Session LIVE introuvable pour cette école.');
    if (session.kind === 'teleconsult') throw new BadRequestException('Une téléconsultation ne peut pas devenir un contenu pédagogique.');

    const { data: recall } = await db.from('live_neuro_recall_state')
      .select('transcript_text, workflow_status')
      .eq('live_session_id', id)
      .maybeSingle();
    let transcript = String(recall?.transcript_text || '').trim();
    let cues = parseTimedTranscript(transcript);

    if (!transcript) {
      const { data: captions } = await db.from('liri_multilang_live_captions')
        .select('source_text, occurred_at')
        .eq('live_session_id', id)
        .order('occurred_at', { ascending: true });
      const started = session.started_at ? new Date(session.started_at).getTime() : 0;
      const seen = new Set<string>();
      cues = (captions || []).map((caption: any, index: number) => ({
        t: started && caption.occurred_at
          ? Math.max(0, Math.round((new Date(caption.occurred_at).getTime() - started) / 1000))
          : index * 4,
        text: String(caption.source_text || '').trim(),
      })).filter((cue: any) => cue.text && !seen.has(cue.text) && seen.add(cue.text));
      transcript = cues.map((cue) => cue.text).join(' ').trim();
    }
    if (!transcript) throw new BadRequestException('Ce LIVE ne possède encore aucune transcription exploitable.');

    const { data: recording } = await db.from('live_recordings')
      .select('duration_seconds')
      .eq('live_session_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const elapsed = session.started_at && session.ended_at
      ? Math.max(0, Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000))
      : undefined;
    return {
      id: session.id,
      tenantId: session.tenant_id,
      title: session.title || 'Session LIVE',
      transcript,
      cues: cues.length ? groupLiveCues(cues) : undefined,
      durationSec: Number(recording?.duration_seconds || elapsed || 0) || undefined,
    };
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
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
      return this.loadRegisteredSource('texte', raw, tenantId);
    }
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

  /**
   * Inventaire pour l'écran Atelier : toutes les sources disponibles, avec
   * l'état de leur transcription. Sans cette vue, l'utilisateur ne sait pas
   * ce qui est prêt à être transformé.
   */
  async getSource(tenantId: string, type: SourceType, id: string) {
    if (type === 'live') {
      const source = await this.loadLive(id, tenantId);
      return { id: source.id, title: source.title, durationSec: source.durationSec, ready: true, chars: source.transcript.length };
    }
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
    if (['texte', 'document', 'pdf', 'audio', 'video', 'url'].includes(type)) {
      if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(id || ''))) {
        const { data, error } = await (this.supabase.client as any)
          .from('master_factory_sources')
          .select('id, source_type, title, status, mime_type, duration_sec, content_text, created_at')
          .eq('id', id).eq('tenant_id', tenantId).eq('source_type', type).maybeSingle();
        if (error) throw new BadRequestException(`Lecture de la source impossible : ${error.message}`);
        if (!data) throw new NotFoundException('Source Master Factory introuvable pour cette école.');
        return this.sourceSummary(data, true);
      }
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
    throw new BadRequestException(`Type de source inconnu : ${type}`);
  }

  async listSources(tenantId: string, type: SourceType) {
    if (type === 'live') {
      const db = this.supabase.client as any;
      const { data: sessions } = await db.from('live_sessions')
        .select('id, title, status, scheduled_at, kind')
        .eq('tenant_id', tenantId)
        .neq('kind', 'teleconsult')
        .order('scheduled_at', { ascending: false });
      const ids = (sessions || []).map((session: any) => session.id);
      const { data: states } = ids.length
        ? await db.from('live_neuro_recall_state').select('live_session_id, transcript_text, workflow_status').in('live_session_id', ids)
        : { data: [] };
      const bySession = new Map((states || []).map((state: any) => [state.live_session_id, state]));
      return (sessions || []).map((session: any) => {
        const state: any = bySession.get(session.id);
        const transcript = String(state?.transcript_text || '');
        return { id: session.id, title: session.title, status: state?.workflow_status || session.status, ready: !!transcript.trim(), chars: transcript.length };
      });
    }
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
    if (['texte', 'document', 'pdf', 'audio', 'video', 'url'].includes(type)) {
      const { data, error } = await (this.supabase.client as any)
        .from('master_factory_sources')
        .select('id, source_type, title, status, mime_type, duration_sec, content_text, created_at')
        .eq('tenant_id', tenantId)
        .eq('source_type', type)
        .order('created_at', { ascending: false });
      if (error) throw new BadRequestException(`Inventaire des sources impossible : ${error.message}`);
      return (data || []).map((source: any) => this.sourceSummary(source));
    }
    return [];
  }
}
