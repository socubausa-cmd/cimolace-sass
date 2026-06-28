import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import type { StartChartingDto } from './dto/start-charting.dto';

// ─── Types internes ────────────────────────────────────────────────────────

export type ChartingJobRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  note_id: string | null;
  practitioner_id: string;
  status: 'pending' | 'transcribing' | 'generating' | 'completed' | 'failed';
  audio_url: string | null;
  raw_transcript: string | null;
  soap_subjective: string | null;
  soap_objective: string | null;
  soap_assessment: string | null;
  soap_plan: string | null;
  soap_free_text: string | null;
  icd10_suggestions: { code: string; description: string }[];
  transcription_provider: string;
  generation_provider: string;
  model_used: string | null;
  tokens_used: number | null;
  error_message: string | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SoapResult = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  free_text: string;
  icd10_suggestions: { code: string; description: string }[];
  model_used: string;
  tokens_used: number;
};

// ─── Prompt médical SOAP ──────────────────────────────────────────────────

const SOAP_SYSTEM_PROMPT = `Tu es un assistant médical spécialisé en rédaction de notes cliniques SOAP.
Tu reçois la transcription d'une consultation médicale et tu dois en extraire une note SOAP structurée.

Règles absolues :
- Pour SUBJECTIF et OBJECTIF : ne jamais inventer — uniquement ce qui est rapporté ou constaté dans la transcription ; si l'information est absente, laisser null.
- Pour ANALYSE et PLAN : propose un BROUILLON d'aide à la décision — une ou des hypothèses de travail (diagnostic différentiel prudent) et une conduite à tenir raisonnable, déduites des éléments disponibles. Reste nuancé (jamais de diagnostic définitif), signale les incertitudes, ne propose que des conduites standards et sûres. Ce brouillon DOIT être relu, corrigé et validé par le praticien — la note n'est jamais signée automatiquement. Si aucun élément clinique n'est exploitable, laisser null.
- IMPÉRATIF DE FORMAT : chaque champ (subjective, objective, assessment, plan, free_text) est une SIMPLE CHAÎNE de texte en prose médicale continue — JAMAIS un objet, une liste ou du JSON imbriqué. Pour assessment et plan, rédige des phrases (ex : "Hypothèse principale : pneumonie communautaire... Conduite : radiographie thoracique, antibiothérapie probabiliste...").
- Les codes ICD-10 doivent être précis et basés uniquement sur ce qui est mentionné.
- Rédiger en français médical clair, sauf si la transcription est dans une autre langue.
- Ne jamais inclure d'informations d'identification du patient dans la réponse JSON.

Format de réponse — JSON strict (aucun texte avant ou après) :
{
  "subjective": "Plaintes, symptômes et antécédents rapportés par le patient",
  "objective": "Signes cliniques, constantes vitales, résultats d'examens",
  "assessment": "Diagnostic ou hypothèse diagnostique du praticien",
  "plan": "Plan thérapeutique : médicaments, examens complémentaires, suivi",
  "free_text": "Informations supplémentaires non couvertes par S/O/A/P",
  "icd10_suggestions": [
    {"code": "J06.9", "description": "Infection aiguë des voies respiratoires supérieures, sans précision"}
  ]
}`;

// ─── Service ──────────────────────────────────────────────────────────────

@Injectable()
export class MedChartingService {
  private readonly logger = new Logger(MedChartingService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  // ── Helpers DB ────────────────────────────────────────────────────────────

  private async updateJob(
    jobId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const db = this.supabase.client as any;
    const { error } = await db
      .from('med_charting_jobs')
      .update(patch)
      .eq('id', jobId);

    if (error) {
      this.logger.error(`updateJob ${jobId}: ${error.message}`);
    }
  }

  // ── Deepgram transcription ────────────────────────────────────────────────

  /**
   * Transcrit un fichier audio via l'API Deepgram Nova-2.
   * Fallback : si DEEPGRAM_API_KEY est absent, retourne un message d'erreur explicite.
   */
  async transcribeAudio(audioUrl: string, language = 'fr'): Promise<string> {
    const apiKey = this.config.get<string>('DEEPGRAM_API_KEY');

    if (!apiKey) {
      throw new InternalServerErrorException(
        'DEEPGRAM_API_KEY non configuré — transcription impossible.',
      );
    }

    const response = await fetch(
      `https://api.deepgram.com/v1/listen?model=nova-2&language=${language}&punctuate=true&diarize=true&smart_format=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: audioUrl }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Deepgram error ${response.status}: ${body}`);
      throw new InternalServerErrorException(
        `Échec de la transcription Deepgram (${response.status})`,
      );
    }

    const result = await response.json();
    const transcript: string =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';

    if (!transcript.trim()) {
      throw new InternalServerErrorException(
        'Transcription vide — vérifiez la qualité audio ou la langue sélectionnée.',
      );
    }

    return transcript;
  }

  // ── Deepgram realtime (streaming) — token éphémère ────────────────────────

  /**
   * Mint un TOKEN ÉPHÉMÈRE Deepgram (JWT court, scope usage::write) que le
   * NAVIGATEUR utilise pour ouvrir DIRECTEMENT le WebSocket de streaming
   * `wss://api.deepgram.com/v1/listen`. La clé serveur DEEPGRAM_API_KEY n'est
   * JAMAIS exposée au front ; aucun WebSocket ne transite par notre API.
   *
   * Endpoint Deepgram : POST https://api.deepgram.com/v1/auth/grant
   *   Header  : Authorization: Token <DEEPGRAM_API_KEY>
   *   Body    : { ttl_seconds }   (1..3600 ; défaut Deepgram = 30s)
   *   Réponse : { access_token, expires_in }
   *
   * Le token n'a besoin d'être valide qu'au moment du handshake WS ; la
   * connexion reste ensuite ouverte. Côté navigateur, l'authentification se
   * fait via le sous-protocole WebSocket : new WebSocket(url, ['token', token]).
   *
   * @param ttlSeconds  durée de vie demandée (bornée 30..60s par défaut).
   * @returns { token, expires_in }
   * @throws InternalServerErrorException (503) si la clé est absente,
   *         ou message clair si Deepgram refuse (scope insuffisant…).
   */
  async mintRealtimeToken(
    ttlSeconds = 60,
  ): Promise<{ token: string; expires_in: number }> {
    const apiKey = this.config.get<string>('DEEPGRAM_API_KEY');

    if (!apiKey) {
      // 503 explicite : la fonctionnalité temps réel n'est pas provisionnée.
      throw new ServiceUnavailableException(
        'DEEPGRAM_API_KEY non configuré — dictée en direct indisponible.',
      );
    }

    // Borne défensive : Deepgram accepte 1..3600 ; on garde un TTL court.
    const ttl = Math.min(Math.max(Math.floor(ttlSeconds) || 60, 10), 60);

    let response: Response;
    try {
      response = await fetch('https://api.deepgram.com/v1/auth/grant', {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl_seconds: ttl }),
      });
    } catch (err: any) {
      this.logger.error(`Deepgram grant network error: ${err?.message}`);
      throw new ServiceUnavailableException(
        'Service de dictée en direct injoignable — réessayez plus tard.',
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Deepgram grant ${response.status}: ${body.slice(0, 200)}`);
      if (response.status === 401 || response.status === 403) {
        // La clé existe mais n'a pas le droit de minter un token temporaire.
        throw new InternalServerErrorException(
          'Token temps réel indisponible — vérifier les scopes de la clé Deepgram (rôle Member ou supérieur requis).',
        );
      }
      throw new InternalServerErrorException(
        `Échec de génération du token temps réel Deepgram (${response.status}).`,
      );
    }

    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!data?.access_token) {
      this.logger.error('Deepgram grant: réponse sans access_token');
      throw new InternalServerErrorException(
        'Réponse inattendue de Deepgram (token manquant).',
      );
    }

    return {
      token: data.access_token,
      expires_in: typeof data.expires_in === 'number' ? data.expires_in : ttl,
    };
  }

  // ── Claude SOAP generation ────────────────────────────────────────────────

  /**
   * Génère une note SOAP structurée à partir de la transcription, via une
   * chaîne de fournisseurs IA (OpenAI-compatibles) : Mistral (primaire) →
   * DeepSeek (repli). On bascule sur le suivant si l'un échoue (crédit, 5xx…).
   */
  async generateSoapNote(
    transcript: string,
    contextHint?: string,
  ): Promise<SoapResult> {
    const userMessage = contextHint
      ? `Contexte fourni par le praticien : ${contextHint}\n\nTranscription de la consultation :\n\n${transcript}`
      : `Transcription de la consultation :\n\n${transcript}`;

    const providers: { name: string; url: string; key?: string; model: string }[] = [
      { name: 'mistral', url: 'https://api.mistral.ai/v1/chat/completions', key: this.config.get<string>('MISTRAL_API_KEY'), model: 'mistral-large-latest' },
      { name: 'deepseek', url: 'https://api.deepseek.com/v1/chat/completions', key: this.config.get<string>('DEEPSEEK_API_KEY'), model: 'deepseek-chat' },
    ].filter((p) => !!p.key);

    if (providers.length === 0) {
      throw new InternalServerErrorException(
        'Aucun fournisseur IA configuré (MISTRAL_API_KEY / DEEPSEEK_API_KEY) — génération SOAP impossible.',
      );
    }

    let lastError = '';
    for (const p of providers) {
      try {
        const response = await fetch(p.url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${p.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: p.model,
            max_tokens: 2048,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SOAP_SYSTEM_PROMPT },
              { role: 'user', content: userMessage },
            ],
          }),
        });

        if (!response.ok) {
          lastError = `${p.name} HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`;
          this.logger.warn(`SOAP ${lastError}`);
          continue;
        }

        const result = await response.json();
        const rawText: string = result?.choices?.[0]?.message?.content ?? '';
        const tokensUsed: number =
          result?.usage?.completion_tokens ?? result?.usage?.total_tokens ?? 0;

        const cleaned = rawText
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim();
        const soap: any = JSON.parse(cleaned);

        return {
          subjective: soap.subjective ?? null,
          objective: soap.objective ?? null,
          assessment: soap.assessment ?? null,
          plan: soap.plan ?? null,
          free_text: soap.free_text ?? null,
          icd10_suggestions: Array.isArray(soap.icd10_suggestions)
            ? soap.icd10_suggestions
            : [],
          model_used: `${p.name}:${p.model}`,
          tokens_used: tokensUsed,
        };
      } catch (err: any) {
        lastError = `${p.name}: ${err?.message ?? 'erreur'}`;
        this.logger.warn(`SOAP ${lastError}`);
        // on tente le fournisseur suivant
      }
    }

    throw new InternalServerErrorException(
      `Échec de la génération SOAP (tous les fournisseurs IA ont échoué). Dernier : ${lastError}`,
    );
  }

  // ── Pipeline principal ────────────────────────────────────────────────────

  /**
   * Crée un job de charting et démarre le pipeline asynchrone :
   * audio → Deepgram → Claude SOAP → draft note sauvegardée.
   *
   * Le job est retourné immédiatement (statut "pending").
   * Le pipeline s'exécute en arrière-plan sans bloquer la réponse HTTP.
   */
  async startChartingJob(
    tenant: TenantContext,
    practitionerId: string,
    dto: StartChartingDto,
  ): Promise<ChartingJobRow> {
    // Vérifier que le patient existe dans ce tenant
    const { data: patient, error: patErr } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('id', dto.patient_id)
      .single();

    if (patErr || !patient) {
      throw new NotFoundException('Patient introuvable');
    }

    // Source requise : audio (URL) OU transcription manuelle (texte).
    if (!dto.audio_url && !dto.raw_transcript?.trim()) {
      throw new BadRequestException(
        'Fournir audio_url (audio) ou raw_transcript (texte) pour lancer l’analyse.',
      );
    }

    // Créer le job
    const { data: job, error: jobErr } = await this.supabase.client
      .from('med_charting_jobs')
      .insert({
        tenant_id: tenant.id,
        patient_id: dto.patient_id,
        note_id: dto.note_id ?? null,
        practitioner_id: practitionerId,
        audio_url: dto.audio_url ?? null,
        raw_transcript: dto.raw_transcript?.trim() || null,
        status: 'pending',
        started_at: new Date().toISOString(),
      } as any)
      .select('*')
      .single();

    if (jobErr || !job) {
      this.logger.error('startChartingJob insert', jobErr?.message);
      throw new InternalServerErrorException(
        'Impossible de créer le job de charting',
      );
    }

    const jobRow = job as unknown as ChartingJobRow;

    // Démarrer le pipeline en arrière-plan (non-bloquant)
    this.runPipeline(jobRow, dto).catch((err) => {
      this.logger.error(
        `Pipeline failed for job ${jobRow.id}: ${err?.message}`,
      );
    });

    return jobRow;
  }

  /**
   * Pipeline complet : transcription → génération SOAP → mise à jour de la note.
   * Toutes les étapes mettent à jour le statut du job dans la DB.
   */
  private async runPipeline(
    job: ChartingJobRow,
    dto: StartChartingDto,
  ): Promise<void> {
    // ── Étape 1 : Transcription (sautée si transcription manuelle fournie) ─
    let transcript: string;
    const manualTranscript = dto.raw_transcript?.trim();
    if (manualTranscript) {
      transcript = manualTranscript;
    } else {
      await this.updateJob(job.id, { status: 'transcribing' });
      try {
        transcript = await this.transcribeAudio(
          dto.audio_url!,
          dto.language ?? 'fr',
        );
        await this.updateJob(job.id, { raw_transcript: transcript });
      } catch (err: any) {
        await this.updateJob(job.id, {
          status: 'failed',
          error_message: `Transcription : ${err?.message}`,
          completed_at: new Date().toISOString(),
        });
        return;
      }
    }

    // ── Étape 2 : Génération SOAP via Claude ────────────────────────────
    await this.updateJob(job.id, { status: 'generating' });

    let soap: SoapResult;
    try {
      soap = await this.generateSoapNote(transcript, dto.context_hint);
    } catch (err: any) {
      await this.updateJob(job.id, {
        status: 'failed',
        error_message: `Génération SOAP : ${err?.message}`,
        completed_at: new Date().toISOString(),
      });
      return;
    }

    // ── Étape 3 : Créer ou mettre à jour la note draft ─────────────────
    let noteId = job.note_id;

    if (!noteId) {
      // Créer une nouvelle note draft avec les données SOAP générées
      const { data: newNote, error: noteErr } = await this.supabase.client
        .from('med_consultation_notes')
        .insert({
          tenant_id: job.tenant_id,
          patient_id: job.patient_id,
          practitioner_id: job.practitioner_id,
          subjective: soap.subjective,
          objective: soap.objective,
          assessment: soap.assessment,
          plan: soap.plan,
          free_text: soap.free_text,
          ai_transcript: transcript,
          ai_draft: JSON.stringify(soap),
          ai_summary: soap.assessment,
          icd10_codes: soap.icd10_suggestions as any,
          is_signed: false,
          is_shared_with_patient: false,
        } as any)
        .select('id')
        .single();

      if (noteErr || !newNote) {
        await this.updateJob(job.id, {
          status: 'failed',
          error_message: `Création de la note : ${noteErr?.message}`,
          completed_at: new Date().toISOString(),
        });
        return;
      }

      noteId = (newNote as any).id;
    } else {
      // Mettre à jour la note existante (non signée)
      await this.supabase.client
        .from('med_consultation_notes')
        .update({
          subjective: soap.subjective,
          objective: soap.objective,
          assessment: soap.assessment,
          plan: soap.plan,
          free_text: soap.free_text,
          ai_transcript: transcript,
          ai_draft: JSON.stringify(soap),
          ai_summary: soap.assessment,
          icd10_codes: soap.icd10_suggestions as any,
        } as any)
        .eq('id', noteId)
        .eq('tenant_id', job.tenant_id)
        .eq('is_signed', false); // Ne jamais modifier une note déjà signée
    }

    // ── Étape 4 : Marquer le job comme terminé ─────────────────────────
    await this.updateJob(job.id, {
      status: 'completed',
      note_id: noteId,
      soap_subjective: soap.subjective,
      soap_objective: soap.objective,
      soap_assessment: soap.assessment,
      soap_plan: soap.plan,
      soap_free_text: soap.free_text,
      icd10_suggestions: soap.icd10_suggestions,
      generation_provider: (soap.model_used || '').split(':')[0] || 'unknown',
      model_used: soap.model_used,
      tokens_used: soap.tokens_used,
      completed_at: new Date().toISOString(),
    });

    this.logger.log(`Charting job ${job.id} completed — note ${noteId}`);
  }

  // ── Lecture du statut ─────────────────────────────────────────────────────

  async getJobStatus(
    tenant: TenantContext,
    jobId: string,
  ): Promise<ChartingJobRow> {
    const { data, error } = await this.supabase.client
      .from('med_charting_jobs')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', jobId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Job de charting introuvable');
    }

    return data;
  }

  async listJobsForPatient(
    tenant: TenantContext,
    patientId: string,
  ): Promise<ChartingJobRow[]> {
    const { data, error } = await this.supabase.client
      .from('med_charting_jobs')
      .select(
        'id, status, audio_url, started_at, completed_at, note_id, error_message, created_at',
      )
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('listJobsForPatient', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    return data ?? [];
  }
}
