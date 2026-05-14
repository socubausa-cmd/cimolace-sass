import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MasterclassFactoryService } from '../masterclass-factory/masterclass-factory.service';

@Injectable()
export class NeuroRecallService {
  private readonly logger = new Logger(NeuroRecallService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly masterclassFactory: MasterclassFactoryService,
  ) {}

  // ── Deck CRUD ──────────────────────────────────────────────────────────

  async createDeck(tenantId: string, userId: string, title: string, cards: { question: string; answer: string }[]) {
    const { data: deck } = await (this.supabase.client as any).from('recall_decks').insert({
      tenant_id: tenantId, user_id: userId, title,
    }).select('*').single();
    for (const c of cards) {
      await (this.supabase.client as any).from('recall_cards').insert({
        tenant_id: tenantId, deck_id: deck.id, question: c.question, answer: c.answer,
      });
    }
    return deck;
  }

  async listDecks(tenantId: string, userId: string) {
    const { data } = await (this.supabase.client as any).from('recall_decks')
      .select('*').eq('tenant_id', tenantId).eq('user_id', userId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async deleteDeck(tenantId: string, deckId: string) {
    await (this.supabase.client as any).from('recall_cards').delete().eq('deck_id', deckId);
    await (this.supabase.client as any).from('recall_decks').delete().eq('id', deckId).eq('tenant_id', tenantId);
    return { id: deckId };
  }

  // ── Spaced Repetition ──────────────────────────────────────────────────

  async getDueCards(tenantId: string, deckId: string, userId: string) {
    const now = new Date().toISOString();
    const { data } = await (this.supabase.client as any).from('recall_cards')
      .select('*').eq('deck_id', deckId).eq('tenant_id', tenantId)
      .or(`next_review_at.is.null,next_review_at.lte.${now}`).order('created_at').limit(20);
    return data ?? [];
  }

  async reviewCard(tenantId: string, cardId: string, quality: number) {
    const { data: card } = await (this.supabase.client as any).from('recall_cards')
      .select('*').eq('id', cardId).single();
    if (!card) throw new NotFoundException('Carte introuvable');

    const interval = Math.max(1, Math.round((card.interval_hours ?? 24) * (quality >= 4 ? 2.5 : 1)));
    const nextReview = new Date(Date.now() + interval * 3600000).toISOString();

    await (this.supabase.client as any).from('recall_cards').update({
      interval_hours: interval, last_reviewed_at: new Date().toISOString(),
      next_review_at: nextReview, review_count: (card.review_count ?? 0) + 1,
    }).eq('id', cardId);

    return { interval_hours: interval, next_review_at: nextReview };
  }

  // ── Bootstrap Session ──────────────────────────────────────────────────

  async bootstrapSession(tenantId: string, userId: string, sourceText: string, title?: string): Promise<any> {
    // Generate flashcards from source text using AI
    let cards: { question: string; answer: string }[] = [];
    try {
      const result = await this.masterclassFactory.aiChatWithFallback(
        `Tu es un expert en neuro-pédagogie. Génère des flashcards (question/réponse) à partir du texte source. Format JSON: [{"question": "...", "answer": "..."}]`,
        [{ role: 'user', content: `Texte source:\n${sourceText.slice(0, 5000)}\n\nGénère 15-20 flashcards. Format JSON uniquement.` }],
        3000,
      );
      if (result.text) {
        const match = result.text.match(/\[[\s\S]*\]/);
        if (match) cards = JSON.parse(match[0]);
      }
    } catch (e: any) {
      this.logger.warn(`AI flashcard generation failed: ${e.message}`);
      // Fallback: split by paragraphs
      const paragraphs = sourceText.split(/\n\n+/).filter(p => p.trim()).slice(0, 10);
      cards = paragraphs.map((p, i) => ({
        question: `Concept clé ${i + 1}`,
        answer: p.slice(0, 200),
      }));
    }

    const deck = await this.createDeck(tenantId, userId, title || 'Session NeuroRecall', cards);
    return { deckId: deck.id, cardCount: cards.length, aiProvider: cards.length > 0 ? 'ai' : 'fallback' };
  }

  // ── Generate Flashcards from Course ────────────────────────────────────

  async generateFromCourse(tenantId: string, userId: string, courseText: string): Promise<any> {
    return this.bootstrapSession(tenantId, userId, courseText, 'Flashcards du cours');
  }

  // ── Node Reports (Learning Analytics) ──────────────────────────────────

  async getNodeReport(tenantId: string, deckId: string): Promise<any> {
    const { data: cards } = await (this.supabase.client as any).from('recall_cards')
      .select('*').eq('deck_id', deckId).eq('tenant_id', tenantId);

    const total = cards?.length ?? 0;
    const reviewed = cards?.filter((c: any) => c.review_count > 0).length ?? 0;
    const mastered = cards?.filter((c: any) => c.interval_hours >= 168).length ?? 0; // 7+ days interval
    const avgInterval = cards?.reduce((s: number, c: any) => s + (c.interval_hours || 24), 0) / (total || 1);

    return {
      deckId, totalCards: total, reviewedCards: reviewed,
      masteredCards: mastered, masteryRate: total > 0 ? Math.round((mastered / total) * 100) : 0,
      avgIntervalHours: Math.round(avgInterval),
    };
  }

  async getGlobalStats(tenantId: string, userId: string): Promise<any> {
    const { data: cards } = await (this.supabase.client as any).from('recall_cards')
      .select('*').eq('tenant_id', tenantId);
    const { data: decks } = await (this.supabase.client as any).from('recall_decks')
      .select('*').eq('tenant_id', tenantId).eq('user_id', userId);

    const now = new Date().toISOString();
    const due = cards?.filter((c: any) => !c.next_review_at || c.next_review_at <= now).length ?? 0;
    const totalReviewed = cards?.reduce((s: number, c: any) => s + (c.review_count || 0), 0) ?? 0;

    return {
      totalDecks: decks?.length ?? 0,
      totalCards: cards?.length ?? 0,
      dueCards: due,
      totalReviews: totalReviewed,
      avgMastery: cards?.length > 0
        ? Math.round((cards.filter((c: any) => c.interval_hours >= 168).length / cards.length) * 100)
        : 0,
    };
  }

  // ── Post-Production Content ────────────────────────────────────────────

  async createPostProdContent(tenantId: string, userId: string, pipelineId: string): Promise<any> {
    // Fetch pipeline segments and generate flashcards from them
    const { data: segments } = await (this.supabase.client as any).from('pipeline_segments')
      .select('*').eq('pipeline_id', pipelineId).eq('tenant_id', tenantId);

    if (!segments?.length) throw new BadRequestException('Aucun segment trouvé dans ce pipeline');

    const allText = segments.map((s: any) => `${s.title}: ${s.content}`).join('\n\n');
    return this.bootstrapSession(tenantId, userId, allText, `Post-prod — Pipeline ${pipelineId.slice(0, 8)}`);
  }
}
