import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { EnqueueJobDto, AiJobType } from './dto/enqueue-job.dto';

type AiJob = {
  id: string;
  tenant_id: string;
  type: AiJobType;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  model: string;
  error_msg: string | null;
  created_at: string;
};

@Injectable()
export class AiWorkerService {
  private readonly logger = new Logger(AiWorkerService.name);
  private processing = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  // ── Job Queue ─────────────────────────────────────────────────────────────

  async enqueue(tenantId: string, dto: EnqueueJobDto): Promise<AiJob> {
    const { data, error } = await (this.supabase.client as any)
      .from('ai_jobs')
      .insert({
        tenant_id: tenantId,
        type: dto.type,
        payload: dto.payload,
        model: dto.model ?? 'deepseek-chat',
        status: 'queued',
      })
      .select('*')
      .single();

    if (error || !data) throw new Error(error?.message ?? 'Échec création job IA');

    // Process in background (fire & forget)
    this.processNext().catch((e) => this.logger.error('Worker error:', e));

    return data as AiJob;
  }

  async getJob(tenantId: string, jobId: string): Promise<AiJob | null> {
    const { data } = await (this.supabase.client as any)
      .from('ai_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .single();
    return (data as AiJob) ?? null;
  }

  async listJobs(tenantId: string, limit = 20): Promise<AiJob[]> {
    const { data } = await (this.supabase.client as any)
      .from('ai_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data as AiJob[]) ?? [];
  }

  // ── Worker loop ───────────────────────────────────────────────────────────

  /**
   * Picks one queued job and processes it.
   * NestJS ScheduleModule can call this every N seconds via @Cron.
   * Also called inline after enqueue() for low-latency dev experience.
   */
  async processNext(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      // Pick oldest queued job (FIFO)
      const { data: jobs } = await (this.supabase.client as any)
        .from('ai_jobs')
        .select('*')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(1);

      const job = (jobs as AiJob[] | null)?.[0];
      if (!job) return;

      await this.runJob(job);
    } finally {
      this.processing = false;
    }
  }

  private async runJob(job: AiJob): Promise<void> {
    this.logger.log(`Processing AI job ${job.id} (${job.type})`);

    // Mark as processing
    await (this.supabase.client as any)
      .from('ai_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', job.id);

    try {
      const result = await this.executeJob(job);

      await (this.supabase.client as any)
        .from('ai_jobs')
        .update({
          status: 'completed',
          result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      this.logger.log(`Job ${job.id} completed`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Job ${job.id} failed: ${msg}`);

      await (this.supabase.client as any)
        .from('ai_jobs')
        .update({
          status: 'failed',
          error_msg: msg,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }
  }

  // ── Job Executors ─────────────────────────────────────────────────────────

  private async executeJob(job: AiJob): Promise<Record<string, unknown>> {
    switch (job.type) {
      case 'enhance_segment':
        return this.enhanceSegment(job);
      case 'generate_quiz':
        return this.generateQuiz(job);
      case 'summarize':
        return this.summarize(job);
      case 'analyze_doc':
        return this.analyzeDoc(job);
      default:
        throw new Error(`Type de job inconnu: ${job.type}`);
    }
  }

  private async enhanceSegment(job: AiJob): Promise<Record<string, unknown>> {
    const { content, segmentId } = job.payload as { content: string; segmentId?: string };
    if (!content) throw new Error('payload.content requis pour enhance_segment');

    const enhanced = await this.callLLM(
      job.model,
      `Tu es un expert en pédagogie. Améliore ce contenu de cours pour le rendre plus clair, 
      structuré et engageant. Garde le même sens. Réponds uniquement avec le contenu amélioré.`,
      content,
    );

    // Update segment if segmentId provided
    if (segmentId) {
      await (this.supabase.client as any)
        .from('pipeline_segments')
        .update({ content: enhanced, ai_enhanced: true })
        .eq('id', segmentId);
    }

    return { enhanced, segmentId };
  }

  private async generateQuiz(job: AiJob): Promise<Record<string, unknown>> {
    const { content, questionCount = 5 } = job.payload as {
      content: string;
      questionCount?: number;
    };
    if (!content) throw new Error('payload.content requis pour generate_quiz');

    const raw = await this.callLLM(
      job.model,
      `Génère ${questionCount} questions QCM (4 choix chacune) basées sur ce contenu.
      Format JSON: [{"question":"...","choices":["A","B","C","D"],"answer":"A","explanation":"..."}]
      Réponds uniquement avec le JSON valide.`,
      content,
    );

    let questions: unknown[] = [];
    try {
      // Extract JSON from response
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) questions = JSON.parse(match[0]) as unknown[];
    } catch {
      questions = [{ raw }];
    }

    return { questions, count: questions.length };
  }

  private async summarize(job: AiJob): Promise<Record<string, unknown>> {
    const { content, maxWords = 200 } = job.payload as {
      content: string;
      maxWords?: number;
    };
    if (!content) throw new Error('payload.content requis pour summarize');

    const summary = await this.callLLM(
      job.model,
      `Résume ce contenu en ${maxWords} mots maximum. Sois concis et garde les points clés.`,
      content,
    );

    return { summary, wordCount: summary.split(/\s+/).length };
  }

  private async analyzeDoc(job: AiJob): Promise<Record<string, unknown>> {
    const { url, content } = job.payload as { url?: string; content?: string };
    const text = content ?? `Document à analyser: ${url ?? 'non fourni'}`;

    const analysis = await this.callLLM(
      job.model,
      `Analyse ce document et fournis:
      1. Un résumé exécutif (3 phrases)
      2. Les 5 points clés
      3. Les thèmes principaux
      Format JSON: {"summary":"...","keyPoints":["..."],"themes":["..."]}
      Réponds uniquement avec le JSON valide.`,
      text,
    );

    let parsed: Record<string, unknown> = { raw: analysis };
    try {
      const match = analysis.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      // keep raw
    }

    return { ...parsed, url };
  }

  // ── LLM Call (OpenAI-compatible) ─────────────────────────────────────────

  private async callLLM(model: string, system: string, user: string): Promise<string> {
    // Route to correct provider based on model name
    if (model.startsWith('claude')) {
      return this.callAnthropic(model, system, user);
    }
    if (model.startsWith('deepseek')) {
      return this.callDeepSeek(model, system, user);
    }
    return this.callOpenAICompat(model, system, user);
  }

  private async callDeepSeek(model: string, system: string, user: string): Promise<string> {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey || apiKey === 'replace_me') {
      return `[MOCK — DeepSeek non configuré] Résultat simulé pour: ${user.slice(0, 100)}`;
    }

    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error(`DeepSeek error ${res.status}: ${await res.text()}`);
    const json = await res.json() as any;
    return json.choices?.[0]?.message?.content ?? '';
  }

  private async callAnthropic(model: string, system: string, user: string): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey || apiKey === 'replace_me') {
      return `[MOCK — Anthropic non configuré] Résultat simulé pour: ${user.slice(0, 100)}`;
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
    const json = await res.json() as any;
    return json.content?.[0]?.text ?? '';
  }

  private async callOpenAICompat(model: string, system: string, user: string): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey === 'replace_me') {
      return `[MOCK — OpenAI non configuré] Résultat simulé pour: ${user.slice(0, 100)}`;
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    const json = await res.json() as any;
    return json.choices?.[0]?.message?.content ?? '';
  }
}
