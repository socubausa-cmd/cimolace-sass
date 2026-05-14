import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import type {
  AnalyzeDocumentDto,
  EnqueueOrchestratorDto,
  GenerateMasterclassDto,
} from './dto/generate-masterclass.dto';

// ── Segment definitions ──────────────────────────────────────────────────────

interface SegmentDef {
  id: number;
  name: string;
  role: string;
  format: string;
  accentColor: string;
}

const LIRI_21_SEGMENTS: SegmentDef[] = [
  { id: 1, name: 'Objectif', role: "Définit ce que l'élève sera capable de faire", format: "3 compétences observables", accentColor: '#D4AF37' },
  { id: 2, name: 'Compétence', role: 'Compétence précise du chapitre', format: 'Nom + description + 3 indicateurs', accentColor: '#a78bfa' },
  { id: 3, name: 'Connaissance', role: 'Prérequis + nouvelles connaissances', format: 'Bloc "déjà savoir" + Bloc "apprendre"', accentColor: '#38bdf8' },
  { id: 4, name: 'Mise en situation', role: 'Scénario concret', format: '"Imaginez que…" contexte + enjeu', accentColor: '#f59e0b' },
  { id: 5, name: 'Tension', role: 'Contradiction qui force la réflexion', format: '"Et pourtant…" inconfort cognitif', accentColor: '#f43f5e' },
  { id: 6, name: 'Expérience de pensée', role: 'Hypothèse à explorer', format: '"Imaginez un monde où…"', accentColor: '#c084fc' },
  { id: 7, name: 'Révélation', role: 'Découverte centrale', format: '"Ce que peu de gens savent…" percutant', accentColor: '#fbbf24' },
  { id: 8, name: 'Leçon simple', role: 'Explication accessible', format: '1 phrase + 3-4 phrases explication', accentColor: '#34d399' },
  { id: 9, name: 'Leçon développée', role: 'Approfondissement 3 parties', format: 'Contexte / Mécanisme / Implications', accentColor: '#38bdf8' },
  { id: 10, name: 'Analogies', role: 'Analogie mémorable', format: '"X est comme Y parce que…"', accentColor: '#c084fc' },
  { id: 11, name: 'Exemples', role: '2-3 exemples concrets', format: 'Contexte + manifestation + leçon', accentColor: '#34d399' },
  { id: 12, name: 'Contre-exemples', role: 'Distinction précise', format: 'Ce que ce N\'EST PAS', accentColor: '#f43f5e' },
  { id: 13, name: 'Synthèse visuelle', role: 'Schéma ou tableau', format: 'Mermaid ou description visuelle', accentColor: '#fbbf24' },
  { id: 14, name: 'Checkpoint', role: 'Question de vérification', format: 'Question + réponse attendue', accentColor: '#f59e0b' },
  { id: 15, name: 'Application', role: 'Exercice pratique', format: 'Consigne + contexte + corrigé', accentColor: '#34d399' },
  { id: 16, name: 'Ouverture', role: 'Lien vers le chapitre suivant', format: 'Question ouverte ou teaser', accentColor: '#c084fc' },
  { id: 17, name: 'Résumé', role: 'Synthèse du chapitre', format: '5 points clés maximum', accentColor: '#D4AF37' },
  { id: 18, name: 'Glossaire', role: 'Définitions clés', format: 'Terme : définition courte', accentColor: '#38bdf8' },
  { id: 19, name: 'Pour aller plus loin', role: 'Ressources complémentaires', format: 'Livres, articles, vidéos', accentColor: '#a78bfa' },
  { id: 20, name: 'Script oral', role: 'Discours du professeur', format: '6-10 phrases, ton naturel', accentColor: '#f43f5e' },
  { id: 21, name: 'Script mot à mot', role: 'Discours complet', format: 'Prêt à lire à voix haute', accentColor: '#fbbf24' },
];

const FAILURE_26_SEGMENTS: SegmentDef[] = [
  { id: 1, name: 'Erreur déclencheur', role: 'Erreur commune présentée', format: 'Présenter l\'erreur sans la corriger', accentColor: '#f43f5e' },
  { id: 2, name: 'Engagement', role: "L'élève prend position", format: '"Selon toi, est-ce correct ?"', accentColor: '#f59e0b' },
  { id: 3, name: 'Réfutation', role: 'Démonstration de l\'échec', format: 'Preuve que l\'erreur ne fonctionne pas', accentColor: '#f43f5e' },
  { id: 4, name: 'Prise de conscience', role: 'Reconnaître l\'échec', format: 'Moment de basculement cognitif', accentColor: '#c084fc' },
  { id: 5, name: 'Objectif', role: 'Ce qui sera appris', format: '3 compétences', accentColor: '#D4AF37' },
  { id: 6, name: 'Compétence', role: 'Compétence cible', format: 'Nom + indicateurs', accentColor: '#a78bfa' },
  { id: 7, name: 'Connaissance', role: 'Prérequis + nouveau', format: '2 blocs', accentColor: '#38bdf8' },
  { id: 8, name: 'Mise en situation', role: 'Scénario réel', format: '"Imaginez que…"', accentColor: '#f59e0b' },
  { id: 9, name: 'Tension', role: 'Paradoxe', format: '"Et pourtant…"', accentColor: '#f43f5e' },
  { id: 10, name: 'Expérience de pensée', role: 'Hypothèse', format: '"Supposons que…"', accentColor: '#c084fc' },
  { id: 11, name: 'Révélation', role: 'Découverte', format: 'Court, percutant', accentColor: '#fbbf24' },
  { id: 12, name: 'Leçon simple', role: 'Explication base', format: '1 phrase + explication', accentColor: '#34d399' },
  { id: 13, name: 'Leçon développée', role: '3 parties', format: 'Contexte/Mécanisme/Implications', accentColor: '#38bdf8' },
  { id: 14, name: 'Analogies', role: 'Image mentale', format: '"X est comme Y"', accentColor: '#c084fc' },
  { id: 15, name: 'Exemples', role: 'Cas concrets', format: '2-3 exemples', accentColor: '#34d399' },
  { id: 16, name: 'Contre-exemples', role: 'Distinction', format: 'Ce que ce n\'est PAS', accentColor: '#f43f5e' },
  { id: 17, name: 'Synthèse visuelle', role: 'Schéma', format: 'Mermaid ou visuel', accentColor: '#fbbf24' },
  { id: 18, name: 'Checkpoint', role: 'Vérification', format: 'Question + réponse', accentColor: '#f59e0b' },
  { id: 19, name: 'Application', role: 'Exercice', format: 'Consigne + corrigé', accentColor: '#34d399' },
  { id: 20, name: 'Correction erreur initiale', role: 'Retour sur l\'erreur', format: 'Pourquoi c\'était faux + solution', accentColor: '#f43f5e' },
  { id: 21, name: 'Méta-apprentissage', role: 'Leçon sur l\'apprentissage', format: 'Ce que l\'échec nous apprend', accentColor: '#c084fc' },
  { id: 22, name: 'Ouverture', role: 'Lien suivant', format: 'Question ou teaser', accentColor: '#c084fc' },
  { id: 23, name: 'Résumé', role: '5 points clés', format: 'Synthèse', accentColor: '#D4AF37' },
  { id: 24, name: 'Glossaire', role: 'Définitions', format: 'Terme : def', accentColor: '#38bdf8' },
  { id: 25, name: 'Script oral', role: 'Discours prof', format: '6-10 phrases', accentColor: '#f43f5e' },
  { id: 26, name: 'Script mot à mot', role: 'Discours complet', format: 'Prêt à lire', accentColor: '#fbbf24' },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface AiMessage { role: 'system' | 'user' | 'assistant'; content: string }

interface ChapterOutput {
  id: string;
  order: number;
  title: string;
  objective: string;
  duration: string;
  segments: SegmentOutput[];
}

interface SegmentOutput {
  segment_id: number;
  phase_id: number | null;
  phase_name: string | null;
  name: string;
  title: string;
  content: string;
  key_points: string[];
  oral_script: string;
  teacher_note: string;
  interaction: string;
}

interface DeckOutput {
  deck_title: string;
  subtitle: string;
  label: string;
  chapters: ChapterOutput[];
  provider: string;
  model_version: string;
  pedagogical_model: string;
}

interface AnalysisReport {
  subjects: string[];
  passes: { subject: string; locations: string[] }[];
  stats: { wordCount: number; paragraphCount: number; estimatedDensity: string };
  centralTheme: string;
  targetAudience: string;
  prerequisites: string;
  recommendedOrder: string[];
  textMap: { start: number; end: number; summary: string }[];
  provider: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class MasterclassFactoryService {
  private readonly logger = new Logger(MasterclassFactoryService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private get db(): any { return this.db; }

  // ── Public API ──────────────────────────────────────────────────────────

  async listProjects(tenantId: string) {
    const { data } = await this.db
      .from('liri_projects')
      .select('id, title, project_type, status, pedagogical_model, pipeline_stage, chapter_count, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  async getProject(tenantId: string, projectId: string) {
    const { data, error } = await this.db
      .from('liri_projects')
      .select('*')
      .eq('id', projectId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !data) throw new NotFoundException('Projet introuvable');
    return data;
  }

  async createProject(tenantId: string, ownerId: string, dto: { title: string; sourceText?: string; pedagogicalModel?: string }) {
    const { data, error } = await this.db
      .from('liri_projects')
      .insert({
        tenant_id: tenantId,
        owner_id: ownerId,
        title: dto.title,
        source_text: dto.sourceText ?? '',
        pedagogical_model: dto.pedagogicalModel ?? 'liri-v1',
        status: 'draft',
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteProject(tenantId: string, projectId: string) {
    await this.getProject(tenantId, projectId);
    await this.db.from('liri_projects').delete().eq('id', projectId).eq('tenant_id', tenantId);
    return { id: projectId };
  }

  // ── Document Analysis ──────────────────────────────────────────────────

  async analyzeDocument(tenantId: string, dto: AnalyzeDocumentDto): Promise<AnalysisReport> {
    const sourceText = dto.sourceText;
    const lang = dto.lang ?? 'fr';

    const systemPrompt = `Tu es un analyste pédagogique expert. Analyse ce document et produis un rapport structuré en JSON.

IMPORTANT : Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après.`;

    const userPrompt = `Analyse ce document et produis un rapport d'analyse complet.

RÈGLES :
1. Détecte TOUS les sujets/thèmes traités
2. Pour chaque sujet, liste les passages (lignes/positions) où il apparaît
3. Calcule les statistiques (mots, paragraphes, densité)
4. Identifie le thème central
5. Détermine l'audience cible et les prérequis
6. Propose un ordre pédagogique recommandé (les dépendances conceptuelles)
7. Pour chaque passage candidat, donne début→fin avec résumé

Format JSON de sortie OBLIGATOIRE :
{
  "subjects": ["sujet1", "sujet2", ...],
  "passes": [{"subject": "sujet1", "locations": ["lignes 12-45", ...]}],
  "stats": {"wordCount": 1234, "paragraphCount": 56, "estimatedDensity": "moyenne"},
  "centralTheme": "Description courte du thème central",
  "targetAudience": "Profil type du lecteur",
  "prerequisites": "Prérequis estimés",
  "recommendedOrder": ["sujet3", "sujet1", "sujet2"],
  "textMap": [{"start": 0, "end": 500, "summary": "Introduction au concept X"}]
}

Document à analyser (${lang}) :
"""
${sourceText.slice(0, 15000)}
"""`;

    const result = await this.aiChatWithFallback(systemPrompt, [{ role: 'user', content: userPrompt }], 2000);
    return this.parseJsonSafely(result.text, this.fallbackAnalysis(sourceText));
  }

  // ── Masterclass Generation ──────────────────────────────────────────────

  async generateMasterclass(
    tenantId: string,
    ownerId: string,
    dto: GenerateMasterclassDto,
  ): Promise<DeckOutput> {
    const model = dto.pedagogicalModel ?? 'liri-v1';
    const segments = model === 'failure-v2' ? FAILURE_26_SEGMENTS : LIRI_21_SEGMENTS;
    const modelName = model === 'failure-v2' ? 'Échec Productif 26 segments' : 'LIRI 21 segments';

    const systemPrompt = this.buildFactorySystemPrompt(model, segments, modelName);
    const userPrompt = this.buildFactoryUserPrompt(dto.sourceText, segments, dto.lang ?? 'fr');

    const result = await this.aiChatWithFallback(systemPrompt, [{ role: 'user', content: userPrompt }], 4000);

    const deck = this.parseJsonSafely(result.text, this.fallbackDeck(dto.sourceText, segments, model));

    // Persist to liri_projects
    try {
      await this.db.from('liri_projects').insert({
        tenant_id: tenantId,
        owner_id: ownerId,
        title: deck.deck_title || 'Nouveau cours',
        project_type: 'masterclass',
        source_text: dto.sourceText,
        pedagogical_model: model,
        status: 'complete',
        deck_json: deck as any,
        chapters: deck.chapters as any,
        chapter_count: deck.chapters.length,
      });
    } catch (e: any) {
      this.logger.warn(`Failed to persist masterclass: ${e.message}`);
    }

    return { ...deck, provider: result.provider, model_version: model };
  }

  // ── Orchestrator (async pipeline) ───────────────────────────────────────

  async enqueueOrchestrator(tenantId: string, ownerId: string, dto: EnqueueOrchestratorDto) {
    const model = dto.pedagogicalModel ?? 'liri-v1';
    const { data, error } = await this.db
      .from('liri_projects')
      .insert({
        tenant_id: tenantId,
        owner_id: ownerId,
        title: dto.title ?? 'Projet orchestré',
        project_type: 'masterclass',
        source_text: dto.sourceText,
        pedagogical_model: model,
        status: 'analyzing',
        pipeline_stage: 'analyzing',
      })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);

    // Launch async processing (in a real system, this goes to a worker queue)
    this.processOrchestratorPipeline(data.id, dto.sourceText, model).catch((e) =>
      this.logger.error(`Orchestrator pipeline failed for ${data.id}: ${e.message}`),
    );

    return { projectId: data.id, status: 'analyzing', pipelineStage: 'analyzing' };
  }

  private async processOrchestratorPipeline(projectId: string, sourceText: string, model: string) {
    const client = this.db as any;

    // Stage 1: Analyze
    await client.from('liri_projects').update({ pipeline_stage: 'analyzing' }).eq('id', projectId);
    const analysis = await this.analyzeDocument('system', { sourceText });

    await client.from('liri_projects').update({
      analysis_report: analysis as any,
      pipeline_stage: 'block_detection',
    }).eq('id', projectId);

    // Stage 2: Block detection (simplified — in production, another AI call)
    const blocks = this.naiveDetectBlocks(sourceText);
    await client.from('liri_projects').update({
      sense_blocks: blocks as any,
      pipeline_stage: 'chapter_building',
    }).eq('id', projectId);

    // Stage 3: Chapter building (in production, AI regrouping)
    const chapters = this.naiveBuildChapters(blocks);
    await client.from('liri_projects').update({
      chapters: chapters as any,
      pipeline_stage: 'segment_filling',
    }).eq('id', projectId);

    // Stage 4: Generate full deck
    const segments = model === 'failure-v2' ? FAILURE_26_SEGMENTS : LIRI_21_SEGMENTS;
    const deck = await this.generateMasterclass('system', 'system', { sourceText, pedagogicalModel: model });

    await client.from('liri_projects').update({
      deck_json: deck as any,
      segments: deck.chapters.flatMap(c => c.segments) as any,
      chapter_count: deck.chapters.length,
      status: 'complete',
      pipeline_stage: 'done',
    }).eq('id', projectId);
  }

  // ── Fallback decks (when AI is unavailable) ─────────────────────────────

  private fallbackAnalysis(sourceText: string): AnalysisReport {
    const words = sourceText.split(/\s+/).filter(Boolean);
    const paragraphs = sourceText.split(/\n\n+/).filter(p => p.trim());
    return {
      subjects: ['Sujet principal (fallback — AI indisponible)'],
      passes: [{ subject: 'Sujet principal', locations: ['lignes 1-fin'] }],
      stats: { wordCount: words.length, paragraphCount: paragraphs.length, estimatedDensity: 'moyenne' },
      centralTheme: 'Analyse non disponible (clé API manquante)',
      targetAudience: 'Non déterminé',
      prerequisites: 'Non déterminé',
      recommendedOrder: ['Sujet principal'],
      textMap: paragraphs.slice(0, 5).map((p, i) => ({ start: i * p.length, end: (i + 1) * p.length, summary: p.slice(0, 80) })),
      provider: 'fallback',
    };
  }

  private fallbackDeck(sourceText: string, segmentsDef: SegmentDef[], model: string): DeckOutput {
    const paragraphs = sourceText.split(/\n\n+/).filter(p => p.trim()).slice(0, 5);
    const chapters: ChapterOutput[] = paragraphs.map((para, ci) => {
      const segs: SegmentOutput[] = segmentsDef.map((seg, si) => ({
        segment_id: seg.id,
        phase_id: null,
        phase_name: null,
        name: seg.name,
        title: `${seg.name} — Chapitre ${ci + 1}`,
        content: `[Fallback] ${seg.role}. Configurez les clés API (DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, ou OPENAI_API_KEY) pour activer la génération IA complète. Extrait source: "${para.slice(0, 100)}..."`,
        key_points: ['Point clé 1', 'Point clé 2', 'Point clé 3'],
        oral_script: `Script oral pour le segment ${seg.name}.`,
        teacher_note: 'Note enseignant.',
        interaction: 'Interaction suggérée.',
      }));
      return { id: `ch${ci + 1}`, order: ci, title: `Chapitre ${ci + 1}`, objective: `Objectif du chapitre ${ci + 1}`, duration: '30 min', segments: segs };
    });

    return {
      deck_title: 'Cours LIRI (mode fallback)',
      subtitle: 'Génération IA non disponible — configurez les clés API',
      label: model,
      chapters,
      provider: 'fallback',
      model_version: 'none',
      pedagogical_model: model,
    };
  }

  private naiveDetectBlocks(text: string): any[] {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    return paragraphs.map((p, i) => ({
      id: `block-${i + 1}`,
      startPos: i * p.length,
      endPos: (i + 1) * p.length,
      subject: `Thème ${i + 1}`,
      idea: p.slice(0, 150),
      sourceRef: `paragraphe ${i + 1}`,
    }));
  }

  private naiveBuildChapters(blocks: any[]): any[] {
    const groups: Record<string, any[]> = {};
    for (const b of blocks) groups[b.subject] = [...(groups[b.subject] ?? []), b];
    return Object.entries(groups).map(([subject, blks], i) => ({
      id: `ch-${i + 1}`,
      order: i,
      title: subject,
      objective: `Objectif ${subject}`,
      source_block_ids: blks.map((b: any) => b.id),
      segments: [],
    }));
  }

  // ── AI Multi-Provider Fallback ──────────────────────────────────────────

  async aiChatWithFallback(
    system: string,
    messages: AiMessage[],
    maxTokens = 2000,
  ): Promise<{ text: string; provider: string }> {
    const allMessages = [{ role: 'system' as const, content: system }, ...messages];

    // Provider 1: DeepSeek
    const deepseekKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (deepseekKey && deepseekKey !== 'replace_me') {
      try {
        const text = await this.callOpenAICompat(
          'https://api.deepseek.com/v1', deepseekKey, 'deepseek-chat', allMessages, maxTokens,
        );
        if (text) return { text, provider: 'deepseek' };
      } catch (e: any) {
        this.logger.warn(`DeepSeek fallback: ${e.message}`);
      }
    }

    // Provider 2: Anthropic Claude
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey && anthropicKey !== 'replace_me') {
      try {
        const text = await this.callAnthropic(anthropicKey, 'claude-haiku-4-5', system, messages, maxTokens);
        if (text) return { text, provider: 'claude' };
      } catch (e: any) {
        this.logger.warn(`Anthropic fallback: ${e.message}`);
      }
    }

    // Provider 3: OpenAI
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey && openaiKey !== 'replace_me') {
      try {
        const text = await this.callOpenAICompat(
          'https://api.openai.com/v1', openaiKey, 'gpt-4o-mini', allMessages, maxTokens,
        );
        if (text) return { text, provider: 'openai' };
      } catch (e: any) {
        this.logger.warn(`OpenAI fallback: ${e.message}`);
      }
    }

    return { text: '', provider: 'none' };
  }

  private async callOpenAICompat(
    baseUrl: string, apiKey: string, model: string,
    messages: AiMessage[], maxTokens: number,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.5 }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: any = await res.json();
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('Empty response');
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callAnthropic(
    apiKey: string, model: string, system: string,
    messages: AiMessage[], maxTokens: number,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const userMessages = messages.filter(m => m.role !== 'system');
      const body: any = { model, max_tokens: maxTokens, temperature: 0.5, messages: userMessages };
      if (system) body.system = system;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: any = await res.json();
      const text = json.content?.[0]?.text?.trim();
      if (!text) throw new Error('Empty response');
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private buildFactorySystemPrompt(model: string, segments: SegmentDef[], modelName: string): string {
    const segmentList = segments.map(s => `  ${s.id}. ${s.name} — ${s.role}`).join('\n');
    return `Tu es un expert en conception pédagogique LIRI. Tu génères des cours complets selon le modèle "${modelName}" (${segments.length} segments par chapitre).

RÈGLE ABSOLUE : réponds UNIQUEMENT avec un objet JSON valide. Pas de markdown, pas de texte avant/après.

Structure de sortie obligatoire :
{
  "deck_title": "Titre du cours",
  "subtitle": "Sous-titre accrocheur",
  "label": "${model}",
  "chapters": [
    {
      "id": "ch1",
      "order": 0,
      "title": "Titre du chapitre",
      "objective": "Objectif pédagogique du chapitre",
      "duration": "30 min",
      "segments": [
        {
          "segment_id": 1,
          "name": "Nom du segment",
          "title": "Titre affiché",
          "content": "Contenu principal (max 2000 car.)",
          "key_points": ["point 1", "point 2", "point 3"],
          "oral_script": "Discours oral (max 2000 car.)",
          "teacher_note": "Note pour l'enseignant (max 600 car.)",
          "interaction": "Interaction suggérée (max 400 car.)"
        }
      ]
    }
  ]
}

Les ${segments.length} segments obligatoires (dans l'ordre) pour CHAQUE chapitre :
${segmentList}

Contraintes :
- 3 à 5 chapitres maximum
- Chaque chapitre contient EXACTEMENT tous les ${segments.length} segments
- Le contenu est en français
- Les key_points sont 3 à 5 idées essentielles
- Le ton est professionnel mais accessible`;
  }

  private buildFactoryUserPrompt(sourceText: string, segments: SegmentDef[], lang: string): string {
    const segmentNames = segments.map(s => s.name).join(', ');
    return `Génère un cours complet à partir du texte source ci-dessous.
Langue : ${lang}
Modèle : ${segments.length} segments (${segmentNames})

Texte source :
"""
${sourceText.slice(0, 12000)}
"""

Produis le JSON complet du cours.`;
  }

  private parseJsonSafely<T>(text: string, fallback: T): T {
    if (!text || typeof text !== 'string') return fallback;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : fallback;
    } catch {
      return fallback;
    }
  }
}
