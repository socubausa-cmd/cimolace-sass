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
}
