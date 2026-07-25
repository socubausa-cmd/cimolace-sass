import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import {
  CreateProgramDto,
  CreateStepDto,
  EnrollPatientDto,
  GenerateProgramDto,
  UpdateEnrollmentDto,
  UpdateProgramDto,
} from './dto/programs.dto';

// Formes libres attendues du LLM (validées défensivement à la persistance).
type GeneratedProgram = {
  title?: string;
  description?: string;
  category?: string;
  duration_days?: number;
};
type GeneratedStep = {
  position?: number;
  title?: string;
  description?: string;
  step_type?:
    | 'task'
    | 'form'
    | 'measurement'
    | 'content'
    | 'appointment'
    | 'reminder';
  due_after_days?: number;
  content_md?: string;
  is_required?: boolean;
};

/**
 * Prompt système de l'agent générateur. Encode la règle CLÉ : le calendrier vit
 * dans les étapes — `due_after_days` = jour du parcours (0-based), `position` =
 * ordre du créneau dans la journée. Aucune migration : on plie le programme
 * (repas, rituels, courses) sur le modèle med_program_steps existant.
 */
function buildProgramGeneratorSystemPrompt(
  language: 'fr' | 'en',
  category?: string,
): string {
  const langName = language === 'fr' ? 'French (français)' : 'English';
  return [
    'You are the MEDOS Program Builder — an expert clinical & nutrition program designer.',
    'You transform source material (a program deck, PDF, or practitioner notes) into a structured, safe, day-by-day MEDOS care program.',
    '',
    'OUTPUT: Return ONLY valid JSON (no prose, no markdown code fences) matching EXACTLY this shape:',
    '{',
    '  "program": { "title": string, "description": string, "category": one of ["weight_loss","detox","stress","post_op","chronic_disease","fertility","pregnancy","nutrition","rehab","custom"], "duration_days": integer },',
    '  "steps": [ { "position": integer, "title": string, "description": string, "step_type": one of ["task","form","measurement","content","appointment","reminder"], "due_after_days": integer, "content_md": string, "is_required": boolean } ]',
    '}',
    '',
    'CALENDAR ENCODING (critical):',
    '- "due_after_days" = the program day the step belongs to, 0-based (day 1 => 0, day 2 => 1 …).',
    '- "position" = order of the item WITHIN that day (e.g. morning ritual = 0, breakfast = 1, snack 1 = 2, lunch = 3, snack 2 = 4, dinner = 5, snack 3 = 6).',
    '- CALENDAR steps: emit ONE step_type "content" step PER DAY (due_after_days 0,1,2…, position 0). Title "Jour N — {weekday}". content_md = that day\'s menu as a SHORT markdown list of dish NAMES only (no recipes), grouped by slot (Petit-déjeuner / Collation 1 / Déjeuner / Collation 2 / Dîner / Collation 3). NEVER put a full recipe in a calendar step.',
    '- RECIPE LIBRARY: after the days, emit ONE step per UNIQUE recipe (deduplicated — a recipe reused on several days appears ONCE): step_type "content", due_after_days 0, position starting at 100 (101,102…), title "📖 Recette — {name}", content_md = the concise recipe (ingredients bullet list + core directions).',
    '- DAILY RITUALS: ONE step_type "content", due_after_days 0, position 0, title "Rituels quotidiens (chaque jour)", listing every recurring daily ritual with quantities.',
    '- SHOPPING LIST: ONE step_type "content" per week, due_after_days 0, position 300, title "🛒 Liste de courses — Semaine N", content_md = that week\'s ingredients grouped by aisle.',
    '- DISCLAIMER: if the source has a medical disclaimer, ONE step_type "content", due_after_days 0, position 400, title "Avertissement médical".',
    '',
    'RULES:',
    '- Preserve every recipe, ritual and quantity, but keep each recipe CONCISE: ingredients list + core directions only; OMIT optional "Notes / Variations / Leftovers / Serving size" sections. Never invent medical claims.',
    '- If the source is only part of a longer program (e.g. "week 1"), set duration_days to the FULL length if stated, and generate steps for the days you have content for.',
    `- Write ALL titles, descriptions and content_md in ${langName}. Translate faithfully if the source is in another language.`,
    category ? `- Category hint (use unless clearly wrong): "${category}".` : '',
    '- Output JSON ONLY. No trailing commas. Escape newlines inside strings. Do not wrap in code fences.',
  ]
    .filter(Boolean)
    .join('\n');
}

@Injectable()
export class ProgramsService {
  private readonly logger = new Logger(ProgramsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  // ─── Programs ────────────────────────────────────────────────────────────

  async create(
    tenant: TenantContext,
    actorId: string,
    dto: CreateProgramDto,
  ) {
    const { data, error } = await (this.supabase.client as any)
      .from('med_programs')
      .insert({
        tenant_id: tenant.id,
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category ?? 'custom',
        duration_days: dto.duration_days ?? null,
        is_template: dto.is_template ?? false,
        created_by: actorId,
      })
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error('createProgram', error?.message);
      throw new InternalServerErrorException('Création du programme impossible');
    }
    return data;
  }

  // ─── Agent générateur (source → programme + étapes calendaires) ────────────

  /**
   * Transforme une matière source en programme MEDOS complet via LLM, puis
   * persiste sur le modèle EXISTANT (med_programs + med_program_steps). Le
   * calendrier est encodé dans les étapes (due_after_days = jour, position =
   * créneau). Aucune migration requise.
   */
  async generate(
    tenant: TenantContext,
    actorId: string,
    dto: GenerateProgramDto,
  ) {
    const language = dto.language ?? 'fr';
    const parsed = await this.callProgramGenerator(dto, language);

    const program = await this.create(tenant, actorId, {
      title: (dto.title_hint || parsed.program.title || 'Programme').slice(0, 200),
      description: parsed.program.description ?? undefined,
      category:
        (dto.category as CreateProgramDto['category']) ||
        (parsed.program.category as CreateProgramDto['category']) ||
        'custom',
      duration_days: dto.duration_days || parsed.program.duration_days || undefined,
      is_template: dto.is_template ?? true,
    });

    let stepsCreated = 0;
    const created: { id: string; idx: number }[] = [];
    for (let i = 0; i < parsed.steps.length; i++) {
      const s = parsed.steps[i];
      try {
        const step = await this.addStep(tenant, program.id, {
          position: typeof s.position === 'number' ? s.position : i,
          title: String(s.title ?? `Étape ${i + 1}`).slice(0, 200),
          description: s.description ?? undefined,
          step_type: s.step_type ?? 'content',
          due_after_days:
            typeof s.due_after_days === 'number' ? s.due_after_days : 0,
          content_md: s.content_md ?? undefined,
          is_required: s.is_required ?? true,
        });
        if (step?.id) created.push({ id: step.id, idx: i });
        stepsCreated++;
      } catch (err) {
        this.logger.warn(
          `generate: étape ${i} ignorée — ${(err as Error)?.message ?? err}`,
        );
      }
    }

    // i18n bilingue (best-effort) : on traduit dans l'autre langue et on peuple
    // les colonnes *_i18n. NON bloquant : si la migration i18n n'est pas encore
    // appliquée (colonnes absentes), l'écriture échoue silencieusement et le
    // programme reste servi en langue de base.
    let i18n = false;
    if (dto.bilingual !== false) {
      try {
        const other = language === 'fr' ? 'en' : 'fr';
        const t = await this.translateProgram(parsed, other);
        await this.writeI18nBestEffort(program.id, language, other, parsed, t, created);
        i18n = true;
      } catch (err) {
        this.logger.warn(
          `generate: i18n non appliqué (migration absente ?) — ${(err as Error)?.message ?? err}`,
        );
      }
    }

    return {
      program,
      steps_created: stepsCreated,
      steps_total: parsed.steps.length,
      language,
      i18n,
    };
  }

  /** Traduit un programme généré dans `target` (même structure, mêmes index). */
  private async translateProgram(
    parsed: { program: GeneratedProgram; steps: GeneratedStep[] },
    target: 'fr' | 'en',
  ): Promise<{ program: GeneratedProgram; steps: GeneratedStep[] }> {
    const targetName = target === 'fr' ? 'French (français)' : 'English';
    const system = [
      'You are a professional translator for a health/nutrition program.',
      `Translate ALL values of "title", "description" and "content_md" into ${targetName}.`,
      'Return ONLY valid JSON with EXACTLY the same shape and the SAME array order/length as the input:',
      '{ "program": { "title": string, "description": string }, "steps": [ { "title": string, "description": string, "content_md": string } ] }',
      'Do not translate proper nouns that should stay (brand names). Keep markdown structure (bullets, bold). JSON only.',
    ].join('\n');
    const payload = JSON.stringify({
      program: { title: parsed.program.title, description: parsed.program.description },
      steps: parsed.steps.map((s) => ({
        title: s.title,
        description: s.description ?? '',
        content_md: s.content_md ?? '',
      })),
    });
    const deepseekKey = this.config.get<string>('DEEPSEEK_API_KEY');
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    let text = '';
    if (deepseekKey && deepseekKey !== 'replace_me') {
      text = await this.chatCompletionsJson(
        'https://api.deepseek.com/v1/chat/completions',
        deepseekKey,
        'deepseek-v4-pro',
        32000,
        system,
        payload,
      );
    } else if (openaiKey && openaiKey !== 'replace_me') {
      text = await this.chatCompletionsJson(
        'https://api.openai.com/v1/chat/completions',
        openaiKey,
        'gpt-4o',
        16000,
        system,
        payload,
      );
    } else {
      throw new Error('aucun provider LLM pour la traduction');
    }
    return this.parseProgramJson(text);
  }

  /** Écrit les colonnes *_i18n (best-effort ; échoue si migration absente). */
  private async writeI18nBestEffort(
    programId: string,
    base: 'fr' | 'en',
    other: 'fr' | 'en',
    parsed: { program: GeneratedProgram; steps: GeneratedStep[] },
    translated: { program: GeneratedProgram; steps: GeneratedStep[] },
    created: { id: string; idx: number }[],
  ): Promise<void> {
    const pair = (a?: string, b?: string) => ({ [base]: a ?? '', [other]: b ?? '' });
    // Programme (une seule requête — révèle tout de suite si les colonnes existent).
    const { error } = await (this.supabase.client as any)
      .from('med_programs')
      .update({
        title_i18n: pair(parsed.program.title, translated.program.title),
        description_i18n: pair(parsed.program.description, translated.program.description),
      })
      .eq('id', programId);
    if (error) throw new Error(error.message);
    // Étapes.
    for (const { id, idx } of created) {
      const src = parsed.steps[idx];
      const tr = translated.steps[idx];
      await (this.supabase.client as any)
        .from('med_program_steps')
        .update({
          title_i18n: pair(src?.title, tr?.title),
          description_i18n: pair(src?.description ?? undefined, tr?.description ?? undefined),
          content_md_i18n: pair(src?.content_md ?? undefined, tr?.content_md ?? undefined),
        })
        .eq('id', id);
    }
  }

  private async callProgramGenerator(
    dto: GenerateProgramDto,
    language: 'fr' | 'en',
  ): Promise<{ program: GeneratedProgram; steps: GeneratedStep[] }> {
    const system = buildProgramGeneratorSystemPrompt(language, dto.category);
    const source = dto.source;

    // Bascule multi-provider (ex. Anthropic sans crédits → DeepSeek/OpenAI).
    // Ordre : DeepSeek v4-pro (fiable + JSON mode), OpenAI gpt-4o, Anthropic.
    const deepseekKey = this.config.get<string>('DEEPSEEK_API_KEY');
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');

    const providers: { name: string; run: () => Promise<string> }[] = [];
    if (deepseekKey && deepseekKey !== 'replace_me') {
      providers.push({
        name: 'deepseek',
        run: () =>
          this.chatCompletionsJson(
            'https://api.deepseek.com/v1/chat/completions',
            deepseekKey,
            dto.model || 'deepseek-v4-pro',
            32000,
            system,
            source,
          ),
      });
    }
    if (openaiKey && openaiKey !== 'replace_me') {
      providers.push({
        name: 'openai',
        run: () =>
          this.chatCompletionsJson(
            'https://api.openai.com/v1/chat/completions',
            openaiKey,
            'gpt-4o',
            16000,
            system,
            source,
          ),
      });
    }
    if (anthropicKey && anthropicKey !== 'replace_me') {
      providers.push({
        name: 'anthropic',
        run: () =>
          this.anthropicText(anthropicKey, 'claude-sonnet-4-6', system, source),
      });
    }
    if (providers.length === 0) {
      throw new InternalServerErrorException(
        'Générateur IA non configuré (aucune clé LLM : DEEPSEEK / OPENAI / ANTHROPIC).',
      );
    }

    let lastErr = 'aucun provider';
    for (const p of providers) {
      try {
        const text = await p.run();
        return this.parseProgramJson(text);
      } catch (err) {
        lastErr = `${p.name}: ${(err as Error)?.message ?? err}`;
        this.logger.warn(`generate provider ${lastErr}`);
      }
    }
    throw new InternalServerErrorException(
      `Générateur IA indisponible (${lastErr}).`,
    );
  }

  /** Provider OpenAI-compatible (DeepSeek, OpenAI) avec JSON mode forcé. */
  private async chatCompletionsJson(
    url: string,
    apiKey: string,
    model: string,
    maxTokens: number,
    system: string,
    user: string,
  ): Promise<string> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(
        `${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    if (json.choices?.[0]?.finish_reason === 'length') {
      throw new Error('réponse tronquée (max_tokens atteint)');
    }
    return json.choices?.[0]?.message?.content ?? '';
  }

  private async anthropicText(
    apiKey: string,
    model: string,
    system: string,
    user: string,
  ): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) {
      throw new Error(
        `${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as {
      content?: { text?: string }[];
      stop_reason?: string;
    };
    if (json.stop_reason === 'max_tokens') {
      throw new Error('réponse tronquée (max_tokens atteint)');
    }
    return json.content?.[0]?.text ?? '';
  }

  private parseProgramJson(raw: string): {
    program: GeneratedProgram;
    steps: GeneratedStep[];
  } {
    let t = raw
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();
    const first = t.indexOf('{');
    const last = t.lastIndexOf('}');
    if (first >= 0 && last > first) t = t.slice(first, last + 1);
    let obj: { program?: GeneratedProgram; steps?: GeneratedStep[] };
    try {
      obj = JSON.parse(t);
    } catch {
      throw new InternalServerErrorException(
        "Réponse de l'agent non parsable (JSON invalide).",
      );
    }
    if (!obj?.program || typeof obj.program !== 'object' || !Array.isArray(obj.steps)) {
      throw new InternalServerErrorException(
        "Réponse de l'agent au mauvais format (program/steps manquants).",
      );
    }
    return { program: obj.program, steps: obj.steps };
  }

  async list(tenant: TenantContext, category?: string) {
    let q = this.supabase.client
      .from('med_programs')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true);
    if (category) q = q.eq('category', category);
    const { data, error } = await q.order('title', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async get(tenant: TenantContext, programId: string) {
    const { data, error } = await this.supabase.client
      .from('med_programs')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', programId)
      .single();
    if (error || !data) throw new NotFoundException('Programme introuvable');

    const steps = await this.listSteps(tenant, programId);
    return { ...(data as Record<string, unknown>), steps };
  }

  async update(
    tenant: TenantContext,
    programId: string,
    dto: UpdateProgramDto,
  ) {
    const patch: Record<string, unknown> = {};
    (['title', 'description', 'category', 'duration_days', 'is_active'] as const).forEach(
      (k) => {
        if (dto[k] !== undefined) patch[k] = dto[k];
      },
    );
    if (Object.keys(patch).length === 0) return this.get(tenant, programId);

    const { data, error } = await (this.supabase.client as any)
      .from('med_programs')
      .update(patch)
      .eq('tenant_id', tenant.id)
      .eq('id', programId)
      .select('*')
      .single();
    if (error || !data) throw new NotFoundException('Programme introuvable');
    return data;
  }

  // ─── Steps ───────────────────────────────────────────────────────────────

  async addStep(
    tenant: TenantContext,
    programId: string,
    dto: CreateStepDto,
  ) {
    // S'assurer que le programme existe
    await this.get(tenant, programId);

    const { data, error } = await (this.supabase.client as any)
      .from('med_program_steps')
      .insert({
        tenant_id: tenant.id,
        program_id: programId,
        position: dto.position ?? 0,
        title: dto.title,
        description: dto.description ?? null,
        step_type: dto.step_type ?? 'task',
        due_after_days: dto.due_after_days ?? 0,
        linked_form_id: dto.linked_form_id ?? null,
        content_md: dto.content_md ?? null,
        is_required: dto.is_required ?? true,
      })
      .select('*')
      .single();
    if (error || !data) {
      throw new InternalServerErrorException("Ajout de l'étape impossible");
    }
    return data;
  }

  async listSteps(tenant: TenantContext, programId: string) {
    const { data, error } = await this.supabase.client
      .from('med_program_steps')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('program_id', programId)
      .order('position', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async removeStep(tenant: TenantContext, programId: string, stepId: string) {
    const { data, error } = await (this.supabase.client as any)
      .from('med_program_steps')
      .delete()
      .eq('tenant_id', tenant.id)
      .eq('program_id', programId)
      .eq('id', stepId)
      .select('id')
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Étape introuvable');
    return { id: (data as any).id };
  }

  // ─── Enrollments ─────────────────────────────────────────────────────────

  async enroll(
    tenant: TenantContext,
    actorId: string,
    programId: string,
    dto: EnrollPatientDto,
  ) {
    // Vérifier patient + programme
    const { data: patient } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('id', dto.patient_id)
      .single();
    if (!patient) throw new NotFoundException('Patient introuvable');
    await this.get(tenant, programId);

    const { data, error } = await (this.supabase.client as any)
      .from('med_program_enrollments')
      .insert({
        tenant_id: tenant.id,
        program_id: programId,
        patient_id: dto.patient_id,
        enrolled_by: actorId,
        notes: dto.notes ?? null,
      })
      .select('*')
      .single();
    if (error || !data) {
      if (error?.code === '23505') {
        throw new ConflictException('Patient déjà inscrit à ce programme');
      }
      throw new InternalServerErrorException("Inscription impossible");
    }
    return data;
  }

  async listEnrollments(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    filters: { patient_id?: string; status?: string } = {},
  ) {
    let q = this.supabase.client
      .from('med_program_enrollments')
      .select('*')
      .eq('tenant_id', tenant.id);

    if (actorRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('patient_user_id', actorId)
        .maybeSingle();
      if (!pat) return [];
      q = q.eq('patient_id', (pat as any).id);
    } else if (filters.patient_id) {
      q = q.eq('patient_id', filters.patient_id);
    }
    if (filters.status) q = q.eq('status', filters.status);

    const { data, error } = await q.order('enrolled_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async updateEnrollment(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    enrollmentId: string,
    dto: UpdateEnrollmentDto,
  ) {
    // Patient peut UPDATE son propre progress (current_step_position, status='abandoned')
    if (actorRole === 'patient') {
      const { data: enr } = await this.supabase.client
        .from('med_program_enrollments')
        .select('*, patient:med_patients!inner(patient_user_id)')
        .eq('id', enrollmentId)
        .single();
      if (
        !enr ||
        ((enr as any).patient as any)?.patient_user_id !== actorId
      ) {
        throw new ForbiddenException("Accès refusé à cette inscription");
      }
      // Restreindre les champs modifiables par le patient
      const allowed = ['current_step_position', 'progress_percent'];
      const patientPatch: Record<string, unknown> = {};
      allowed.forEach((k) => {
        if ((dto as any)[k] !== undefined) patientPatch[k] = (dto as any)[k];
      });
      if (dto.status === 'abandoned') patientPatch.status = 'abandoned';

      if (Object.keys(patientPatch).length === 0) return enr;
      const { data, error } = await (this.supabase.client as any)
        .from('med_program_enrollments')
        .update(patientPatch)
        .eq('id', enrollmentId)
        .select('*')
        .single();
      if (error || !data)
        throw new InternalServerErrorException('Mise à jour impossible');
      return data;
    }

    // Staff : tout est permis
    const patch: Record<string, unknown> = {};
    (
      ['status', 'current_step_position', 'progress_percent', 'notes'] as const
    ).forEach((k) => {
      if (dto[k] !== undefined) patch[k] = dto[k];
    });
    if (dto.status === 'completed') {
      patch.completed_at = new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) {
      const { data } = await this.supabase.client
        .from('med_program_enrollments')
        .select('*')
        .eq('id', enrollmentId)
        .single();
      return data;
    }
    const { data, error } = await (this.supabase.client as any)
      .from('med_program_enrollments')
      .update(patch)
      .eq('tenant_id', tenant.id)
      .eq('id', enrollmentId)
      .select('*')
      .single();
    if (error || !data) throw new NotFoundException('Inscription introuvable');
    return data;
  }
}
