import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import type { CreateDeckDto } from './dto/create-deck.dto';
import type { UpdateSlideDto } from './dto/update-slide.dto';
import type {
  SmartboardDeckRow,
  SmartboardSlideRow,
} from './types';
import {
  DEFAULT_FORMAT,
  DEFAULT_THEME,
  DEFAULT_GLOBAL_RULES,
  DEFAULT_LAYOUT,
  SMARTBOARD_STEPS,
} from './types';

const DECK_COLUMNS = [
  'id',
  'tenant_id',
  'created_by',
  'title',
  'source_text',
  'format',
  'theme',
  'global_rules',
  'layout',
  'status',
  'created_at',
  'updated_at',
].join(',');

const SLIDE_COLUMNS = [
  'id',
  'deck_id',
  'tenant_id',
  'slide_index',
  'step',
  'title',
  'subtitle',
  'core_idea',
  'pedagogical_goal',
  'dominant_mode',
  'hero_visual',
  'development',
  'illustration',
  'illustration_image_url',
  'slide_summary',
  'progressive_build',
  'content',
  'visual',
  'graphic',
  'student_action',
  'teacher_note',
  'transition',
  'master_script',
  'created_at',
  'updated_at',
].join(',');

@Injectable()
export class SmartboardService {
  private readonly logger = new Logger(SmartboardService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ---------------------------------------------------------------------------
  // Decks
  // ---------------------------------------------------------------------------

  async createDeck(
    dto: CreateDeckDto,
    tenant: TenantContext,
    userId: string,
  ): Promise<SmartboardDeckRow> {
    const { data, error } = await this.supabase.client
      .from('smartboard_decks')
      .insert({
        tenant_id: tenant.id,
        created_by: userId,
        title: dto.title,
        source_text: dto.sourceText,
        format: DEFAULT_FORMAT as any,
        theme: DEFAULT_THEME as any,
        global_rules: DEFAULT_GLOBAL_RULES as any,
        layout: DEFAULT_LAYOUT as any,
        status: 'draft',
      })
      .select(DECK_COLUMNS)
      .single();

    if (error) {
      this.logger.error('Failed to create deck', error);
      throw new BadRequestException(error.message);
    }
    return data as unknown as SmartboardDeckRow;
  }

  async listDecks(tenantId: string): Promise<SmartboardDeckRow[]> {
    const { data, error } = await this.supabase.client
      .from('smartboard_decks')
      .select(DECK_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }
    return (data ?? []) as unknown as SmartboardDeckRow[];
  }

  async getDeck(deckId: string, tenantId: string): Promise<SmartboardDeckRow> {
    const { data, error } = await this.supabase.client
      .from('smartboard_decks')
      .select(DECK_COLUMNS)
      .eq('id', deckId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Deck "${deckId}" introuvable`);
    }
    return data as unknown as SmartboardDeckRow;
  }

  async deleteDeck(deckId: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('smartboard_decks')
      .delete()
      .eq('id', deckId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new BadRequestException(error.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Slides
  // ---------------------------------------------------------------------------

  async listSlides(
    deckId: string,
    tenantId: string,
  ): Promise<SmartboardSlideRow[]> {
    const { data, error } = await this.supabase.client
      .from('smartboard_slides')
      .select(SLIDE_COLUMNS)
      .eq('deck_id', deckId)
      .eq('tenant_id', tenantId)
      .order('slide_index', { ascending: true });

    if (error) {
      throw new BadRequestException(error.message);
    }
    return (data ?? []) as unknown as SmartboardSlideRow[];
  }

  async getSlide(
    slideId: string,
    tenantId: string,
  ): Promise<SmartboardSlideRow> {
    const { data, error } = await this.supabase.client
      .from('smartboard_slides')
      .select(SLIDE_COLUMNS)
      .eq('id', slideId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Slide "${slideId}" introuvable`);
    }
    return data as unknown as SmartboardSlideRow;
  }

  async updateSlide(
    slideId: string,
    dto: UpdateSlideDto,
    tenantId: string,
  ): Promise<SmartboardSlideRow> {
    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.subtitle !== undefined) patch.subtitle = dto.subtitle;
    if (dto.core_idea !== undefined) patch.core_idea = dto.core_idea;
    if (dto.pedagogical_goal !== undefined)
      patch.pedagogical_goal = dto.pedagogical_goal;
    if (dto.student_action !== undefined)
      patch.student_action = dto.student_action;
    if (dto.teacher_note !== undefined)
      patch.teacher_note = dto.teacher_note;
    if (dto.transition !== undefined) patch.transition = dto.transition;

    if (dto.main_text !== undefined || dto.support_text !== undefined) {
      const { data: existing } = await this.supabase.client
        .from('smartboard_slides')
        .select('content')
        .eq('id', slideId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const currentContent =
        (existing?.content as Record<string, string>) ?? {};
      patch.content = {
        main_text: dto.main_text ?? currentContent.main_text ?? '',
        support_text: dto.support_text ?? currentContent.support_text ?? '',
      };
    }

    if (dto.visual_prompt !== undefined) {
      const { data: existing } = await this.supabase.client
        .from('smartboard_slides')
        .select('visual')
        .eq('id', slideId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const currentVisual =
        (existing?.visual as Record<string, string>) ?? {};
      patch.visual = {
        type: currentVisual.type ?? 'image_symbolique',
        prompt: dto.visual_prompt,
      };
    }

    const { data, error } = await this.supabase.client
      .from('smartboard_slides')
      .update(patch as any)
      .eq('id', slideId)
      .eq('tenant_id', tenantId)
      .select(SLIDE_COLUMNS)
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'Mise à jour du slide impossible',
      );
    }
    return data as unknown as SmartboardSlideRow;
  }

  // ---------------------------------------------------------------------------
  // Slide Generation (porté de smartboard-ia-generate.js V1)
  // ---------------------------------------------------------------------------

  /**
   * Génère des slides pour un deck à partir du texte source.
   * Version initiale : fallback local sans appel IA externe.
   * Les appels IA (Claude/DeepSeek/Grok/OpenAI) seront branchés
   * dans le worker `apps/worker` pour éviter le blocage HTTP.
   */
  async generateSlides(
    deckId: string,
    tenant: TenantContext,
    userId: string,
    lang: string = 'fr',
  ): Promise<{ deckId: string; slidesGenerated: number }> {
    const deck = await this.getDeck(deckId, tenant.id);
    const sourceText = deck.source_text;

    if (!sourceText || sourceText.trim().length < 20) {
      throw new BadRequestException(
        'Le texte source doit contenir au moins 20 caractères',
      );
    }

    // Marquer le deck comme "generating"
    await this.supabase.client
      .from('smartboard_decks')
      .update({ status: 'generating' })
      .eq('id', deckId)
      .eq('tenant_id', tenant.id);

    try {
      const chapters = this.inferChapters(sourceText);
      const slides = this.buildFallbackSlides(sourceText, chapters, lang);

      // Supprimer les slides existants
      await this.supabase.client
        .from('smartboard_slides')
        .delete()
        .eq('deck_id', deckId);

      // Insérer les nouveaux slides
      const rows = slides.map((slide, index) => ({
        deck_id: deckId,
        tenant_id: tenant.id,
        slide_index: index,
        step: slide.step,
        title: slide.title,
        subtitle: '',
        core_idea: slide.pedagogical_goal,
        pedagogical_goal: slide.pedagogical_goal,
        dominant_mode: slide.dominant_mode,
        content: slide.content,
        visual: slide.visual,
        graphic: slide.graphic ?? null,
        student_action: slide.student_action ?? '',
        teacher_note: slide.teacher_note ?? '',
        transition: slide.transition ?? '',
        illustration_image_url: this.picsumUrl(slide.title),
      }));

      const { error } = await this.supabase.client
        .from('smartboard_slides')
        .insert(rows);

      if (error) {
        throw new BadRequestException(error.message);
      }

      // Marquer comme terminé
      await this.supabase.client
        .from('smartboard_decks')
        .update({ status: 'done' })
        .eq('id', deckId)
        .eq('tenant_id', tenant.id);

      return { deckId, slidesGenerated: slides.length };
    } catch (err) {
      // Remettre en draft en cas d'erreur
      await this.supabase.client
        .from('smartboard_decks')
        .update({ status: 'draft' })
        .eq('id', deckId)
        .eq('tenant_id', tenant.id);

      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers (portés de la V1)
  // ---------------------------------------------------------------------------

  private inferChapters(source: string) {
    const lines = String(source).split('\n');
    const found = lines
      .map((line) => line.trim())
      .filter((line) => /^chapitre\s+\d+/i.test(line))
      .map((line, idx) => ({
        chapter_id: `chapter_${idx + 1}`,
        title:
          line
            .replace(/^chapitre\s+\d+\s*[—:\-]?\s*/i, '')
            .trim() || `Chapitre ${idx + 1}`,
        objective: '',
        skill: '',
        knowledge: '',
      }));
    if (found.length) return found;
    return [
      {
        chapter_id: 'chapter_1',
        title: 'Chapitre 1',
        objective: '',
        skill: '',
        knowledge: '',
      },
    ];
  }

  private buildFallbackSlides(
    sourceText: string,
    chapters: { chapter_id: string; title: string; objective: string; skill: string; knowledge: string }[],
    _lang: string,
  ) {
    const allSlides: {
      slide_id: string;
      chapter_id: string;
      step: string;
      title: string;
      pedagogical_goal: string;
      dominant_mode: string;
      content: { main_text: string; support_text: string };
      visual: { type: string; prompt: string };
      graphic?: { type: string };
      student_action?: string;
      teacher_note?: string;
      transition?: string;
    }[] = [];

    for (const chapter of chapters) {
      for (const stepDef of SMARTBOARD_STEPS) {
        allSlides.push({
          slide_id: `${chapter.chapter_id}_${stepDef.key}`,
          chapter_id: chapter.chapter_id,
          step: stepDef.key,
          title: `${chapter.title} · ${stepDef.label}`,
          pedagogical_goal: chapter.objective || `Transmettre ${stepDef.label}`,
          dominant_mode: 'texte',
          content: {
            main_text:
              chapter.knowledge ||
              chapter.objective ||
              sourceText.slice(0, 220),
            support_text: chapter.skill || '',
          },
          visual: {
            type: 'text_focus',
            prompt: `Slide pédagogique ${stepDef.label} pour ${chapter.title}`,
          },
          student_action: 'Lire, reformuler, appliquer.',
          teacher_note: 'Adapter le rythme au niveau du groupe.',
          transition: 'Continuer vers l’étape suivante.',
        });
      }
    }

    return allSlides;
  }

  private picsumUrl(seed: string, w = 1037, h = 750): string {
    const s = String(seed)
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 24) || 'topic';
    return `https://picsum.photos/seed/${s}/${w}/${h}`;
  }

  // ── Public endpoints for new controller ─────────────────────────────────

  async generateFromText(tenantId: string, dto: { sourceText: string; lang?: string }) {
    const { data: deck } = await (this.supabase.client as any)
      .from('smartboard_decks')
      .insert({
        tenant_id: tenantId,
        title: 'Génération SmartBoard',
        source_text: dto.sourceText,
        format: DEFAULT_FORMAT,
        theme: DEFAULT_THEME,
        global_rules: DEFAULT_GLOBAL_RULES,
        layout: DEFAULT_LAYOUT,
        status: 'draft',
      })
      .select(DECK_COLUMNS)
      .single();

    if (!deck) throw new BadRequestException('Échec création deck');

    const result = await this.generateSlides(deck.id, { id: tenantId, slug: '' } as any, 'system', dto.lang ?? 'fr');
    return { ...result, deckId: deck.id };
  }

  listThemes() {
    return [
      { key: 'dark_cosmic_blue', label: 'Cosmique sombre', background: '#0a0a1a', accent: '#D4AF37' },
      { key: 'academic_clean', label: 'Académique épuré', background: '#ffffff', accent: '#1e3a5f' },
      { key: 'nature_warm', label: 'Nature chaleureux', background: '#f5f0e8', accent: '#2d6a4f' },
      { key: 'tech_minimal', label: 'Tech minimal', background: '#0d1117', accent: '#58a6ff' },
      { key: 'spiritual_deep', label: 'Spirituel profond', background: '#1a0a2e', accent: '#c084fc' },
    ];
  }

  listTemplates(tenantId: string) {
    return this.supabase.client
      .from('liri_assets')
      .select('id, title, asset_type, public_url, tags')
      .eq('tenant_id', tenantId)
      .eq('is_template', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => data ?? []);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Bloc 4 — SmartBoard Avancé (CDC modules 1-20)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Score Qualité Slide (Module 2) ─────────────────────────────────────

  async scoreSlideQuality(slideId: string, tenantId: string): Promise<any> {
    const slide = await this.getSlide(slideId, tenantId);
    const scores = this.computeQualityScores(slide);
    return { slideId, ...scores };
  }

  async scoreDeckQuality(deckId: string, tenantId: string): Promise<any> {
    const slides = await this.listSlides(deckId, tenantId);
    if (slides.length === 0) return { deckId, overall: 0, slides: [] };

    const scored = slides.map(s => this.computeQualityScores(s));
    const avg = (k: string) => scored.reduce((sum, s) => sum + (s as any)[k], 0) / scored.length;

    return {
      deckId,
      overall: Math.round(avg('overall')),
      readability: Math.round(avg('readability')),
      clarity: Math.round(avg('clarity')),
      density: Math.round(avg('density')),
      visualImpact: Math.round(avg('visualImpact')),
      memorability: Math.round(avg('memorability')),
      pedagogicalCoherence: Math.round(avg('pedagogicalCoherence')),
      slides: scored.map((s, i) => ({ index: i, ...s })),
    };
  }

  private computeQualityScores(slide: any): Record<string, number> {
    const title = String(slide.title || '');
    const content = typeof slide.content === 'object' ? (slide.content?.main_text || '') : String(slide.content || '');
    const teacherNote = String(slide.teacher_note || '');
    const studentAction = String(slide.student_action || '');

    const readability = title.length > 0 && title.length < 60 ? 80 : title.length === 0 ? 20 : 50;
    const clarity = content.length > 20 && content.length < 500 ? 85 : content.length === 0 ? 10 : 50;
    const density = content.length > 50 && content.length < 300 ? 80 : content.length > 500 ? 30 : 50;
    const visualImpact = slide.illustration_image_url ? 75 : 30;
    const memorability = (title.length > 0 ? 30 : 0) + (content.length > 0 ? 30 : 0) + (studentAction.length > 0 ? 20 : 0);
    const pedagogicalCoherence = teacherNote.length > 0 ? 70 : 30;

    const overall = Math.round((readability + clarity + density + visualImpact + memorability + pedagogicalCoherence) / 6);
    return { overall, readability, clarity, density, visualImpact, memorability, pedagogicalCoherence };
  }

  // ── Versioning (Module 1) ──────────────────────────────────────────────

  async listVersions(deckId: string, tenantId: string): Promise<any[]> {
    const deck = await this.getDeck(deckId, tenantId);
    const versions = (deck as any).versions || [];
    return versions.map((v: any, i: number) => ({ version: i + 1, savedAt: v.saved_at, slideCount: v.slides_json?.slides?.length || 0 }));
  }

  async saveDeckVersion(deckId: string, tenantId: string): Promise<any> {
    const deck = await this.getDeck(deckId, tenantId);
    const slides = await this.listSlides(deckId, tenantId);
    const versions = Array.isArray((deck as any).versions) ? (deck as any).versions : [];

    versions.push({ version: versions.length + 1, saved_at: new Date().toISOString(), slides });
    await (this.supabase.client as any).from('smartboard_decks').update({ versions }).eq('id', deckId).eq('tenant_id', tenantId);
    return { version: versions.length, savedAt: new Date().toISOString() };
  }

  async restoreDeckVersion(deckId: string, tenantId: string, versionIndex: number): Promise<any> {
    const deck = await this.getDeck(deckId, tenantId);
    const versions = (deck as any).versions || [];
    const v = versions[versionIndex - 1];
    if (!v) throw new NotFoundException(`Version ${versionIndex} introuvable`);

    // Delete current slides, re-insert version slides
    await (this.supabase.client as any).from('smartboard_slides').delete().eq('deck_id', deckId);
    if (v.slides?.length) {
      const rows = v.slides.map((s: any, i: number) => ({ ...s, deck_id: deckId, tenant_id: tenantId, slide_index: i }));
      await (this.supabase.client as any).from('smartboard_slides').insert(rows);
    }
    return { restored: versionIndex, slideCount: v.slides?.length || 0 };
  }

  async forkDeck(deckId: string, tenantId: string, newTitle: string): Promise<any> {
    const deck = await this.getDeck(deckId, tenantId);
    const slides = await this.listSlides(deckId, tenantId);

    const { data: forked } = await (this.supabase.client as any).from('smartboard_decks').insert({
      tenant_id: tenantId,
      title: newTitle || `${deck.title} (copie)`,
      source_text: deck.source_text,
      format: deck.format,
      theme: deck.theme,
      global_rules: (deck as any).global_rules,
      layout: (deck as any).layout,
      status: 'draft',
    }).select(DECK_COLUMNS).single();

    if (slides.length && forked) {
      const rows = slides.map((s: any, i: number) => ({
        deck_id: forked.id, tenant_id: tenantId, slide_index: i,
        step: s.step, title: s.title, subtitle: s.subtitle,
        core_idea: s.core_idea, pedagogical_goal: s.pedagogical_goal,
        dominant_mode: s.dominant_mode, content: s.content,
        visual: s.visual, graphic: s.graphic,
        student_action: s.student_action, teacher_note: s.teacher_note,
        transition: s.transition, illustration_image_url: s.illustration_image_url,
      }));
      await (this.supabase.client as any).from('smartboard_slides').insert(rows);
    }
    return forked;
  }

  // ── Dashboard Projet (Module 14) ───────────────────────────────────────

  async getDeckDashboard(tenantId: string): Promise<any> {
    const { data: decks } = await (this.supabase.client as any)
      .from('smartboard_decks').select('id, title, status, created_at, updated_at').eq('tenant_id', tenantId);

    if (!decks?.length) return { totalDecks: 0, totalSlides: 0, avgQuality: 0, byStatus: {} };

    const stats = await Promise.all((decks as any[]).map(async (d: any) => {
      const { data: slides } = await (this.supabase.client as any)
        .from('smartboard_slides').select('id').eq('deck_id', d.id);
      return { ...d, slideCount: slides?.length || 0 };
    }));

    const totalSlides = stats.reduce((sum: number, d: any) => sum + d.slideCount, 0);
    const byStatus: Record<string, number> = {};
    for (const d of stats) byStatus[d.status] = (byStatus[d.status] || 0) + 1;

    return { totalDecks: stats.length, totalSlides, avgQuality: 0, byStatus, decks: stats };
  }

  // ── Thèmes + Tonalité (Modules 4, 15) ─────────────────────────────────

  listFullThemes() {
    return [
      {
        key: 'dark_cosmic_blue', name: 'Cosmique sombre',
        tonalite: 'spirituel',
        palette: { background: '#0a0a1a', accent_primary: '#D4AF37', accent_secondary: '#7c3aed', text_primary: '#F5F1E8', text_secondary: '#94a3b8' },
        typography: { heading: 'Inter', body: 'Inter', size_heading: 28, size_body: 16 },
        visual_style: 'glass_dark_soft',
      },
      {
        key: 'academic_clean', name: 'Académique épuré',
        tonalite: 'académique',
        palette: { background: '#ffffff', accent_primary: '#1e3a5f', accent_secondary: '#3b82f6', text_primary: '#0f172a', text_secondary: '#64748b' },
        typography: { heading: 'Georgia', body: 'Georgia', size_heading: 32, size_body: 18 },
        visual_style: 'minimal_clean',
      },
      {
        key: 'nature_warm', name: 'Nature chaleureux',
        tonalite: 'narratif',
        palette: { background: '#f5f0e8', accent_primary: '#2d6a4f', accent_secondary: '#059669', text_primary: '#1a2e1a', text_secondary: '#6b7280' },
        typography: { heading: 'Merriweather', body: 'Lora', size_heading: 30, size_body: 17 },
        visual_style: 'warm_organic',
      },
      {
        key: 'tech_minimal', name: 'Tech minimal',
        tonalite: 'technique',
        palette: { background: '#0d1117', accent_primary: '#58a6ff', accent_secondary: '#3b82f6', text_primary: '#e6edf3', text_secondary: '#8b949e' },
        typography: { heading: 'JetBrains Mono', body: 'Inter', size_heading: 24, size_body: 15 },
        visual_style: 'dark_terminal',
      },
      {
        key: 'spiritual_deep', name: 'Spirituel profond',
        tonalite: 'émotionnel',
        palette: { background: '#1a0a2e', accent_primary: '#c084fc', accent_secondary: '#a855f7', text_primary: '#f3e8ff', text_secondary: '#a78bfa' },
        typography: { heading: 'Playfair Display', body: 'Crimson Text', size_heading: 34, size_body: 18 },
        visual_style: 'ethereal_glow',
      },
    ];
  }

  getTonalites() {
    return [
      { key: 'académique', label: 'Académique', description: 'Rigoureux, formel, structuré' },
      { key: 'narratif', label: 'Narratif', description: 'Histoire, storytelling, progression naturelle' },
      { key: 'spirituel', label: 'Spirituel', description: 'Méditatif, profond, inspirant' },
      { key: 'technique', label: 'Technique', description: 'Précis, concis, démonstratif' },
      { key: 'émotionnel', label: 'Émotionnel', description: 'Touchant, engageant, mémorable' },
    ];
  }

  // ── Bibliothèque Pédagogique (Module 5) ────────────────────────────────

  getPedagogicalComponents() {
    return [
      { type: 'definition', label: 'Définition', icon: 'book-open', template: { title: 'Définition : {TERME}', content: '{DÉFINITION}', visual_type: 'text_focus' } },
      { type: 'example', label: 'Exemple', icon: 'lightbulb', template: { title: 'Exemple : {CONTEXTE}', content: '{DESCRIPTION}', visual_type: 'illustration' } },
      { type: 'schema', label: 'Schéma', icon: 'git-branch', template: { title: '{TITRE}', content: '{DESCRIPTION}', visual_type: 'diagram' } },
      { type: 'comparison', label: 'Comparaison', icon: 'git-compare', template: { title: '{A} vs {B}', content: '{COMPARAISON}', visual_type: 'side_by_side' } },
      { type: 'chronology', label: 'Chronologie', icon: 'clock', template: { title: 'Chronologie : {SUJET}', content: '{ÉTAPES}', visual_type: 'timeline' } },
      { type: 'quote', label: 'Citation', icon: 'quote', template: { title: '', content: '"{CITATION}" — {AUTEUR}', visual_type: 'quote_block' } },
      { type: 'exercise', label: 'Exercice', icon: 'pencil', template: { title: 'Exercice : {NOM}', content: '{CONSIGNE}', visual_type: 'action_card' } },
      { type: 'summary', label: 'Résumé', icon: 'list-checks', template: { title: 'Résumé', content: '{POINTS_CLÉS}', visual_type: 'bullet_list' } },
    ];
  }

  // ── Anti-surcharge / Simplification IA (Modules 12, 18) ────────────────

  analyzeSlideOverload(slideId: string, tenantId: string): any {
    const slide = { title: '', content: '' } as any; // placeholder — computed from actual slide
    const titleLen = String(slide.title || '').length;
    const contentLen = String(typeof slide.content === 'object' ? (slide.content as any)?.main_text || '' : slide.content || '').length;

    const issues: string[] = [];
    if (titleLen > 60) issues.push('Titre trop long (>60 car.)');
    if (contentLen > 500) issues.push('Contenu trop dense (>500 car.) — suggérer découpage');
    if (contentLen < 20) issues.push('Contenu trop court (<20 car.) — ajouter du contenu');

    const suggestions: string[] = [];
    if (contentLen > 500) suggestions.push('Diviser en 2-3 slides');
    if (titleLen > 60) suggestions.push('Simplifier le titre en 6 mots maximum');

    return { slideId, overloaded: issues.length > 0, issues, suggestions };
  }

  analyzeDeckOverload(deckId: string, tenantId: string): any {
    return { deckId, message: 'Analyse anti-surcharge — utilisez /smartboard/decks/:id/quality pour le score complet' };
  }
}
