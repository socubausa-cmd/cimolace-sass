/**
 * MasterclassFactoryService — Génération de masterclass complètes via IA.
 *
 * Pipeline :
 *   1. Texte source → DeepSeek → structure JSON (modules + leçons)
 *   2. Insertion en DB (masterclasses + masterclass_modules + masterclass_lessons)
 *   3. Coût débité sur LIRI Credits du tenant (via le helper aiBilling)
 *
 * Fallback : si pas de DEEPSEEK_API_KEY, retombe sur l'heuristique regex.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AiBillingService } from '../ai-billing/ai-billing.service';

interface GeneratedModule {
  title: string;
  description?: string;
  lessons: { title: string; content: string; key_points?: string[] }[];
}

interface GeneratedMasterclass {
  title: string;
  description: string;
  modules: GeneratedModule[];
}

@Injectable()
export class MasterclassFactoryService {
  private readonly logger = new Logger(MasterclassFactoryService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly billing: AiBillingService,
  ) {}

  // ─── 1. Génération IA depuis un texte source ──────────────────────────────

  async generateFromText(tenantId: string, userId: string, title: string, sourceText: string) {
    if (!sourceText?.trim()) {
      throw new BadRequestException('sourceText requis');
    }

    let generated: GeneratedMasterclass;
    try {
      generated = await this.generateViaLLM(tenantId, userId, title, sourceText);
    } catch (err) {
      this.logger.warn(`LLM failed, fallback heuristique: ${(err as Error).message}`);
      generated = this.fallbackHeuristic(title, sourceText);
    }

    return this.persistMasterclass(tenantId, userId, generated, sourceText);
  }

  // ─── 2. Appel DeepSeek pour structure pédagogique ─────────────────────────

  private async generateViaLLM(
    tenantId: string,
    userId: string,
    title: string,
    sourceText: string,
  ): Promise<GeneratedMasterclass> {
    // Préférer Groq (rapide + gratuit), fallback DeepSeek
    const groqKey = this.config.get<string>('GROQ_API_KEY');
    const deepseekKey = this.config.get<string>('DEEPSEEK_API_KEY');

    if ((!groqKey || groqKey === 'replace_me') && (!deepseekKey || deepseekKey === 'replace_me')) {
      throw new Error('Aucune clé IA configurée (GROQ_API_KEY ou DEEPSEEK_API_KEY)');
    }

    const useGroq = Boolean(groqKey && groqKey !== 'replace_me');
    const apiKey = useGroq ? groqKey! : deepseekKey!;
    const apiUrl = useGroq
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.deepseek.com/chat/completions';
    const model = useGroq ? 'llama-3.3-70b-versatile' : 'deepseek-chat';
    const provider = useGroq ? 'groq' : 'deepseek';

    const trimmedSource = sourceText.slice(0, 12000);
    const prompt = `Tu es un architecte pédagogique LIRI. À partir du contenu source ci-dessous, génère une masterclass structurée en JSON STRICT.

Titre proposé : "${title || 'Masterclass'}"

Contenu source :
${trimmedSource}

Format JSON requis (rien d'autre, pas de markdown) :
{
  "title": "titre clair et engageant",
  "description": "description en 1-2 phrases qui donne envie d'apprendre",
  "modules": [
    {
      "title": "Module 1 — sujet précis",
      "description": "ce que l'élève apprendra dans ce module",
      "lessons": [
        {
          "title": "Leçon 1.1 — concept clé",
          "content": "contenu de la leçon en 100-200 mots, structuré et pédagogique",
          "key_points": ["point clé 1", "point clé 2", "point clé 3"]
        }
      ]
    }
  ]
}

Règles :
- 3 à 6 modules selon la profondeur du contenu
- 2 à 4 leçons par module
- Chaque leçon doit être actionnable et concrète
- Le contenu doit rester fidèle au source mais reformulé pédagogiquement
- Tout en français`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Tu es un architecte pédagogique LIRI expert.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`${provider} error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const json = await response.json();
    const usage = json?.usage ?? {};
    const content = json?.choices?.[0]?.message?.content ?? '{}';

    let parsed: GeneratedMasterclass;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { title, description: '', modules: [] };
    }

    if (!parsed.modules || parsed.modules.length === 0) {
      throw new Error('LLM n\'a pas retourné de modules valides');
    }

    // ─── Débit LIRI Credits (input + output) ────────────────────────────────
    try {
      await this.billing.chargeUsage(tenantId, {
        function_name: 'masterclass-factory.generate',
        provider,
        model,
        unit_type: 'tokens_in',
        unit_amount: usage.prompt_tokens ?? 0,
        user_id: userId,
        metadata: { title, modules_count: parsed.modules.length },
      });
      await this.billing.chargeUsage(tenantId, {
        function_name: 'masterclass-factory.generate',
        provider,
        model,
        unit_type: 'tokens_out',
        unit_amount: usage.completion_tokens ?? 0,
        user_id: userId,
      });
    } catch (err) {
      this.logger.warn(`Billing skipped: ${(err as Error).message}`);
    }

    return parsed;
  }

  // ─── 3. Fallback heuristique (regex split) ────────────────────────────────

  private fallbackHeuristic(title: string, sourceText: string): GeneratedMasterclass {
    const chapters = sourceText.split(/\n(?:#{1,3}\s+|(?:Chapitre|Module)\s*\d+)/i)
      .filter((c) => c.trim());

    const modules: GeneratedModule[] = (chapters.length < 2
      ? [{ title: 'Module 1', description: '', lessons: [{ title: 'Leçon 1', content: sourceText.slice(0, 500) }] }]
      : chapters.map((c, i) => {
          const lines = c.trim().split('\n').filter((l) => l.trim());
          const moduleTitle = lines[0]?.slice(0, 100) || `Module ${i + 1}`;
          const content = lines.slice(1).join('\n').slice(0, 2000) || lines[0];
          return {
            title: moduleTitle,
            description: '',
            lessons: [{ title: `Leçon ${i + 1}.1`, content: content.slice(0, 500) }],
          };
        }));

    return {
      title: title || 'Masterclass auto-générée',
      description: 'Structure générée par heuristique (DeepSeek indisponible)',
      modules,
    };
  }

  // ─── 4. Persistance DB ────────────────────────────────────────────────────

  private async persistMasterclass(
    tenantId: string,
    userId: string,
    generated: GeneratedMasterclass,
    sourceText: string,
  ) {
    // Résoudre un created_by valide (si user fourni = celui-ci, sinon owner du tenant)
    let createdBy = userId;
    if (!createdBy || createdBy === '00000000-0000-0000-0000-000000000000') {
      const { data: tenant } = await (this.supabase.client as any)
        .from('tenants')
        .select('owner_user_id')
        .eq('id', tenantId)
        .maybeSingle();
      createdBy = (tenant as any)?.owner_user_id ?? userId;
    }

    const { data: masterclass, error: mcErr } = await (this.supabase.client as any)
      .from('masterclasses')
      .insert({
        tenant_id: tenantId,
        created_by: createdBy,
        title: generated.title,
        source_text: sourceText.slice(0, 50000),
        module_count: generated.modules.length,
      })
      .select('*')
      .single();

    if (mcErr) {
      this.logger.error(`Insert masterclass error: ${mcErr.message}`);
      throw new BadRequestException(`Échec création masterclass: ${mcErr.message}`);
    }

    if (!masterclass) {
      throw new BadRequestException('Échec création masterclass');
    }

    for (let i = 0; i < generated.modules.length; i++) {
      const m = generated.modules[i];
      const { data: mod } = await (this.supabase.client as any)
        .from('masterclass_modules')
        .insert({
          tenant_id: tenantId,
          masterclass_id: masterclass.id,
          title: m.title,
          content: m.description || '',
          order_index: i,
        })
        .select('*')
        .single();

      if (!mod) continue;

      for (let j = 0; j < (m.lessons ?? []).length; j++) {
        const l = m.lessons[j];
        await (this.supabase.client as any)
          .from('masterclass_lessons')
          .insert({
            tenant_id: tenantId,
            module_id: mod.id,
            title: l.title,
            content: l.content || '',
            order_index: j,
          });
      }
    }

    return this.getMasterclass(tenantId, masterclass.id);
  }

  // ─── 5. Lecture ───────────────────────────────────────────────────────────

  async listMasterclasses(tenantId: string) {
    const { data } = await (this.supabase.client as any)
      .from('masterclasses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  async getMasterclass(tenantId: string, id: string) {
    const { data: mc } = await (this.supabase.client as any)
      .from('masterclasses')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!mc) return null;

    const { data: modules } = await (this.supabase.client as any)
      .from('masterclass_modules')
      .select('*, masterclass_lessons(*)')
      .eq('masterclass_id', id)
      .order('order_index');

    return { ...mc, modules: modules ?? [] };
  }

  // ─── 5b. Cours numérique « Le Précepteur » ────────────────────────────────

  /**
   * Persiste un « cours numérique Précepteur » (PrecepteurCourse enrichi produit par
   * la Masterclass Factory : concepts + scènes leçon/amorce/croquis/atelier/analogie)
   * comme une masterclass FIRST-CLASS : une ligne `masterclasses` portant le rendu dans
   * la colonne JSONB `precepteur_course` → visible dans /masterclasses, ouvrable en
   * « Mode Précepteur ». Pas de modules/lessons : le rendu Précepteur EST le contenu.
   * `getMasterclass` (select *) renvoie la colonne automatiquement. RLS + `created_by`
   * gérés comme `persistMasterclass`.
   */
  async savePrecepteurCourse(
    tenantId: string,
    userId: string,
    title: string,
    precepteurCourse: unknown,
    sourceText = '',
    sourceVideoId?: string,
  ) {
    if (!precepteurCourse || typeof precepteurCourse !== 'object') {
      throw new BadRequestException('precepteurCourse (objet) requis');
    }

    let createdBy = userId;
    if (!createdBy || createdBy === '00000000-0000-0000-0000-000000000000') {
      const { data: tenant } = await (this.supabase.client as any)
        .from('tenants')
        .select('owner_user_id')
        .eq('id', tenantId)
        .maybeSingle();
      createdBy = (tenant as any)?.owner_user_id ?? userId;
    }

    const { data: mc, error } = await (this.supabase.client as any)
      .from('masterclasses')
      .insert({
        tenant_id: tenantId,
        created_by: createdBy,
        title: (title || 'Cours du Précepteur').slice(0, 300),
        source_text: String(sourceText || '').slice(0, 50000),
        module_count: 0,
        precepteur_course: precepteurCourse,
        source_video_id: sourceVideoId || null,
      })
      .select('*')
      .single();

    if (error || !mc) {
      this.logger.error(`Insert precepteur masterclass error: ${error?.message}`);
      throw new BadRequestException(`Échec création cours Précepteur: ${error?.message ?? 'inconnu'}`);
    }

    return this.getMasterclass(tenantId, mc.id);
  }

  // ─── 6. Analyse document (placeholder pour futur RAG) ────────────────────

  async analyzeDocument(tenantId: string, url: string) {
    return {
      url,
      status: 'analyzed',
      summary: 'Analyse à brancher : utiliser /functions/v1/embed-knowledge + answer-question pour extraire structure et points clés.',
      keyPoints: [],
      next_step: 'POST /masterclass-factory/generate avec sourceText extrait',
    };
  }
}
