import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
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
- Ne jamais inventer des informations absentes de la transcription.
- Si une section SOAP ne peut pas être remplie faute d'information, laisser la valeur null.
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

  // ── Claude SOAP generation ────────────────────────────────────────────────

  /**
   * Génère une note SOAP structurée à partir de la transcription,
   * en appelant Claude claude-3-5-sonnet via l'API Anthropic.
   */
  async generateSoapNote(
    transcript: string,
    contextHint?: string,
  ): Promise<SoapResult> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    if (!apiKey) {
      throw new InternalServerErrorException(
        'ANTHROPIC_API_KEY non configuré — génération SOAP impossible.',
      );
    }

    const userMessage = contextHint
      ? `Contexte fourni par le praticien : ${contextHint}\n\nTranscription de la consultation :\n\n${transcript}`
      : `Transcription de la consultation :\n\n${transcript}`;

    const model = 'claude-3-5-sonnet-20241022';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: SOAP_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Claude API error ${response.status}: ${body}`);
      throw new InternalServerErrorException(
        `Échec de la génération SOAP (${response.status})`,
      );
    }

    const result = await response.json();
    const rawText: string = result?.content?.[0]?.text ?? '';
    const tokensUsed: number = result?.usage?.output_tokens ?? 0;

    // Parser le JSON retourné par Claude
    let soap: any;
    try {
      // Claude peut entourer le JSON de backticks — on les retire
      const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      soap = JSON.parse(cleaned);
    } catch {
      this.logger.error(
        'Impossible de parser la réponse SOAP de Claude',
        rawText,
      );
      throw new InternalServerErrorException(
        'La génération SOAP a retourné une réponse non structurée.',
      );
    }

    return {
      subjective: soap.subjective ?? null,
      objective: soap.objective ?? null,
      assessment: soap.assessment ?? null,
      plan: soap.plan ?? null,
      free_text: soap.free_text ?? null,
      icd10_suggestions: Array.isArray(soap.icd10_suggestions)
        ? soap.icd10_suggestions
        : [],
      model_used: model,
      tokens_used: tokensUsed,
    };
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

    // Créer le job
    const { data: job, error: jobErr } = await this.supabase.client
      .from('med_charting_jobs')
      .insert({
        tenant_id: tenant.id,
        patient_id: dto.patient_id,
        note_id: dto.note_id ?? null,
        practitioner_id: practitionerId,
        audio_url: dto.audio_url,
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
    // ── Étape 1 : Transcription ──────────────────────────────────────────
    await this.updateJob(job.id, { status: 'transcribing' });

    let transcript: string;
    try {
      transcript = await this.transcribeAudio(
        dto.audio_url,
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
      generation_provider: 'anthropic',
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
