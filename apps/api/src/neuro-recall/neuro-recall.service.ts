import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class NeuroRecallService {
  constructor(private readonly supabase: SupabaseService) {}

  async createDeck(tenantId: string, userId: string, title: string, cards: { question: string; answer: string }[]) {
    const { data: deck } = await (this.supabase.client as any).from('recall_decks').insert({ tenant_id: tenantId, user_id: userId, title }).select('*').single();
    for (const c of cards) {
      await (this.supabase.client as any).from('recall_cards').insert({ tenant_id: tenantId, deck_id: deck.id, question: c.question, answer: c.answer });
    }
    return deck;
  }

  async listDecks(tenantId: string, userId: string) {
    const { data } = await (this.supabase.client as any).from('recall_decks').select('*').eq('tenant_id', tenantId).eq('user_id', userId);
    return data ?? [];
  }

  async getDueCards(tenantId: string, deckId: string, userId: string) {
    const now = new Date().toISOString();
    const { data } = await (this.supabase.client as any).from('recall_cards').select('*').eq('deck_id', deckId).eq('tenant_id', tenantId).or(`next_review_at.is.null,next_review_at.lte.${now}`).order('created_at').limit(20);
    return data ?? [];
  }

  async reviewCard(tenantId: string, cardId: string, quality: number) {
    const { data: card } = await (this.supabase.client as any).from('recall_cards').select('*').eq('id', cardId).single();
    if (!card) return { error: 'Carte introuvable' };
    const interval = Math.max(1, Math.round((card.interval_hours ?? 24) * (quality >= 4 ? 2.5 : 1)));
    const nextReview = new Date(Date.now() + interval * 3600000).toISOString();
    await (this.supabase.client as any).from('recall_cards').update({ interval_hours: interval, last_reviewed_at: new Date().toISOString(), next_review_at: nextReview, review_count: (card.review_count ?? 0) + 1 }).eq('id', cardId);
    return { interval_hours: interval, next_review_at: nextReview };
  }

  async getStats(tenantId: string, userId: string) {
    const { data } = await (this.supabase.client as any).from('recall_cards').select('*', { count: 'exact' }).eq('tenant_id', tenantId);
    const now = new Date().toISOString();
    const { data: due } = await (this.supabase.client as any).from('recall_cards').select('*', { count: 'exact' }).eq('tenant_id', tenantId).lte('next_review_at', now);
    return { totalCards: data?.length ?? 0, dueCards: due?.length ?? 0 };
  }
}
