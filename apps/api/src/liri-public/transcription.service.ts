/**
 * TranscriptionService — STT (speech-to-text) pour LIRI.
 *
 * Stratégie :
 *   - Live STT : non implémenté ici (nécessite pipeline WebSocket dédié).
 *     Recommandé : LiveKit AgentDispatch + Deepgram/AssemblyAI pour le live.
 *   - Replay STT : OpenAI Whisper API sur le recording URL (R2 / S3).
 *     Coût : ~$0.006/min, latence : ~1× durée audio.
 *
 * Fallback : si OPENAI_API_KEY absent → renvoie un placeholder.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Transcrit le dernier enregistrement d'une session.
   * Met à jour live_sessions.transcript.
   */
  async transcribeSession(
    tenantId: string,
    sessionId: string,
    options?: { language?: string; force?: boolean },
  ): Promise<{
    transcript: string;
    language: string;
    duration_seconds?: number;
    cached?: boolean;
  }> {
    // 1. Récupérer la session + transcript existant
    const { data: session } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('id, tenant_id, transcript, status')
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!session) {
      throw new BadRequestException('Session introuvable');
    }

    // Cache : si déjà transcrit et pas forcé, on renvoie
    if ((session as any).transcript && !options?.force) {
      return {
        transcript: (session as any).transcript,
        language: options?.language ?? 'fr',
        cached: true,
      };
    }

    // 2. Récupérer le dernier recording disponible
    const { data: recording } = await (this.supabase.client as any)
      .from('live_recordings')
      .select('id, file_url, duration_seconds, status')
      .eq('session_id', sessionId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!recording?.file_url) {
      throw new BadRequestException(
        'Aucun enregistrement disponible. Lancez d\'abord la session et terminez-la avec recording activé.',
      );
    }

    // 3. Whisper API
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey === 'replace_me') {
      this.logger.warn('OPENAI_API_KEY absent — transcript placeholder');
      const placeholder = `[Transcription non disponible — configurez OPENAI_API_KEY]\nRecording: ${recording.file_url}\nDurée: ${recording.duration_seconds}s`;
      return { transcript: placeholder, language: options?.language ?? 'fr' };
    }

    try {
      // Whisper attend un FormData multipart avec le fichier
      // Pour un fichier distant (R2), on doit le télécharger d'abord
      const audioRes = await fetch(recording.file_url, { signal: AbortSignal.timeout(60000) });
      if (!audioRes.ok) {
        throw new Error(`Impossible de récupérer le recording: ${audioRes.status}`);
      }
      const audioBlob = await audioRes.blob();

      const form = new FormData();
      form.append('file', audioBlob, 'recording.mp4');
      form.append('model', 'whisper-1');
      if (options?.language) form.append('language', options.language);

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(300000), // 5 min max
      });

      if (!whisperRes.ok) {
        const err = await whisperRes.text();
        throw new Error(`Whisper error ${whisperRes.status}: ${err}`);
      }

      const result = await whisperRes.json();
      const transcript = result.text || '';

      // 4. Sauvegarder dans live_sessions.transcript
      await (this.supabase.client as any)
        .from('live_sessions')
        .update({ transcript, updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      return {
        transcript,
        language: options?.language ?? result.language ?? 'fr',
        duration_seconds: recording.duration_seconds,
      };
    } catch (err) {
      this.logger.error('Whisper transcription failed', (err as Error).message);
      throw new BadRequestException(
        `Transcription échouée : ${(err as Error).message}`,
      );
    }
  }

  /**
   * Génère un résumé IA d'une session (déjà transcrite).
   * Met à jour live_sessions.summary.
   */
  async summarizeSession(
    tenantId: string,
    sessionId: string,
    options?: { length?: 'short' | 'medium' | 'long'; format?: 'paragraph' | 'bullets' },
  ): Promise<{ summary: string; cached?: boolean }> {
    const { data: session } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('id, transcript, summary, title')
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!session) throw new BadRequestException('Session introuvable');
    if (!(session as any).transcript) {
      throw new BadRequestException(
        'Session non transcrite. Appelez /transcribe avant /summary.',
      );
    }
    if ((session as any).summary) {
      return { summary: (session as any).summary, cached: true };
    }

    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey || apiKey === 'replace_me') {
      return { summary: '[Service de résumé non disponible]' };
    }

    const length = options?.length ?? 'medium';
    const format = options?.format ?? 'bullets';

    const targetWords = length === 'short' ? 80 : length === 'long' ? 400 : 200;
    const formatHint = format === 'bullets'
      ? 'Format : liste à puces structurée par thème.'
      : 'Format : paragraphes fluides.';

    const prompt = `Résume cette session live "${(session as any).title}" en ~${targetWords} mots. ${formatHint}\n\nTranscript:\n${(session as any).transcript.slice(0, 12000)}`;

    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
        }),
        signal: AbortSignal.timeout(60000),
      });

      const json = await res.json();
      const summary = json.choices?.[0]?.message?.content?.trim() || '';

      await (this.supabase.client as any)
        .from('live_sessions')
        .update({ summary, updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      return { summary };
    } catch (err) {
      this.logger.error('Summary failed', (err as Error).message);
      throw new BadRequestException(`Résumé échoué : ${(err as Error).message}`);
    }
  }

  /**
   * Génère des cartes Neuro Recall (Q/R) à partir du transcript d'une session.
   */
  async generateRecallCards(
    tenantId: string,
    sessionId: string,
    options?: { count?: number; difficulty?: 'easy' | 'medium' | 'hard' },
  ): Promise<{ cards: { question: string; answer: string }[]; session_title: string }> {
    const { data: session } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('id, transcript, title')
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!session) throw new BadRequestException('Session introuvable');
    if (!(session as any).transcript) {
      throw new BadRequestException(
        'Session non transcrite. Appelez /transcribe avant /neuro-recall-deck.',
      );
    }

    const count = Math.min(options?.count ?? 10, 50);
    const difficulty = options?.difficulty ?? 'medium';

    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey || apiKey === 'replace_me') {
      return { cards: [], session_title: (session as any).title };
    }

    const prompt = `À partir du transcript suivant, génère ${count} cartes de révision (Q/R) niveau ${difficulty}.
Réponds en JSON strict : {"cards":[{"question":"...","answer":"..."}]}.
Pas de markdown, pas de commentaire — juste le JSON.

Transcript:
${(session as any).transcript.slice(0, 10000)}`;

    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 3000,
        }),
        signal: AbortSignal.timeout(90000),
      });

      const json = await res.json();
      const raw = json.choices?.[0]?.message?.content?.trim() || '{"cards":[]}';

      let parsed: { cards?: { question: string; answer: string }[] };
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Try extracting JSON if wrapped in markdown
        const match = raw.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { cards: [] };
      }

      return {
        cards: parsed.cards ?? [],
        session_title: (session as any).title,
      };
    } catch (err) {
      this.logger.error('Card generation failed', (err as Error).message);
      throw new BadRequestException(
        `Génération échouée : ${(err as Error).message}`,
      );
    }
  }
}
