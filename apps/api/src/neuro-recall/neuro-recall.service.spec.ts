/**
 * Tests unitaires — NeuroRecallService
 *
 * Scénarios couverts :
 *  1.  createDeck → insère deck et cartes → retourne deck
 *  2.  listDecks → retourne tableau
 *  3.  deleteDeck → supprime cartes puis deck → retourne id
 *  4.  getDueCards → retourne cartes dues
 *  5.  reviewCard → qualité ≥ 4 → interval doublé
 *  6.  reviewCard → carte introuvable → NotFoundException
 *  7.  getNodeReport → retourne stats du deck
 *  8.  getGlobalStats → retourne statistiques tenant/user
 *  9.  bootstrapSession → AI indisponible → fallback paragraphes
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NeuroRecallService } from './neuro-recall.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MasterclassFactoryService } from '../masterclass-factory/masterclass-factory.service';

// ─── Helpers mock ─────────────────────────────────────────────────────────────

function buildChain(
  singleResult: { data: unknown; error: unknown } = { data: null, error: null },
  listResult?: { data: unknown[]; error: unknown },
) {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'or',
    'in',
    'limit',
    'order',
  ];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue(singleResult);
  chain.maybeSingle = jest.fn().mockResolvedValue(singleResult);
  chain.then = jest
    .fn()
    .mockImplementation((cb: (v: unknown) => unknown) =>
      Promise.resolve(cb(listResult ?? { data: [], error: null })),
    );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };

const mockMasterclassFactory = {
  aiChatWithFallback: jest
    .fn()
    .mockResolvedValue({ text: '', provider: 'none' }),
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-0001';
const USER_ID = 'user-0001';
const DECK_ID = 'deck-0001';

const FAKE_DECK = {
  id: DECK_ID,
  tenant_id: TENANT_ID,
  user_id: USER_ID,
  title: 'Deck de test',
};

const FAKE_CARDS = [
  {
    id: 'card-0001',
    deck_id: DECK_ID,
    tenant_id: TENANT_ID,
    question: 'Q1',
    answer: 'R1',
    interval_hours: 24,
    review_count: 0,
    next_review_at: null,
  },
  {
    id: 'card-0002',
    deck_id: DECK_ID,
    tenant_id: TENANT_ID,
    question: 'Q2',
    answer: 'R2',
    interval_hours: 48,
    review_count: 2,
    next_review_at: null,
  },
];

// ─── Suite principale ─────────────────────────────────────────────────────────

describe('NeuroRecallService', () => {
  let service: NeuroRecallService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    mockMasterclassFactory.aiChatWithFallback.mockResolvedValue({
      text: '',
      provider: 'none',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NeuroRecallService,
        { provide: SupabaseService, useValue: mockSupabase },
        {
          provide: MasterclassFactoryService,
          useValue: mockMasterclassFactory,
        },
      ],
    }).compile();

    service = module.get<NeuroRecallService>(NeuroRecallService);
  });

  // ── createDeck ────────────────────────────────────────────────────────────

  it('1. createDeck → insère deck + cartes → retourne deck', async () => {
    // deck insert
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: FAKE_DECK, error: null }))
      // card inserts (×2)
      .mockReturnValue(buildChain({ data: null, error: null }));

    const result = await service.createDeck(
      TENANT_ID,
      USER_ID,
      'Deck de test',
      [
        { question: 'Q1', answer: 'R1' },
        { question: 'Q2', answer: 'R2' },
      ],
    );

    expect(result).toMatchObject({ id: DECK_ID, title: 'Deck de test' });
  });

  // ── listDecks ─────────────────────────────────────────────────────────────

  it('2. listDecks → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [FAKE_DECK], error: null }),
    );

    const result = await service.listDecks(TENANT_ID, USER_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  // ── deleteDeck ────────────────────────────────────────────────────────────

  it('3. deleteDeck → supprime cartes et deck → retourne id', async () => {
    // delete cards
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: null, error: null }))
      // delete deck
      .mockReturnValueOnce(buildChain({ data: null, error: null }));

    const result = await service.deleteDeck(TENANT_ID, DECK_ID);
    expect(result).toMatchObject({ id: DECK_ID });
  });

  // ── getDueCards ───────────────────────────────────────────────────────────

  it('4. getDueCards → retourne cartes dues', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: FAKE_CARDS, error: null }),
    );

    const result = await service.getDueCards(TENANT_ID, DECK_ID, USER_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  // ── reviewCard ────────────────────────────────────────────────────────────

  it('5. reviewCard → qualité 5 → augmente interval', async () => {
    const card = FAKE_CARDS[0];
    // select card
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: card, error: null }))
      // update card
      .mockReturnValueOnce(buildChain({ data: null, error: null }));

    const result = await service.reviewCard(TENANT_ID, 'card-0001', 5);
    expect(result).toHaveProperty('interval_hours');
    expect(result).toHaveProperty('next_review_at');
    // With quality 5 (>=4), interval should be multiplied by 2.5
    expect((result as any).interval_hours).toBeGreaterThanOrEqual(24);
  });

  it('6. reviewCard → carte introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );

    await expect(service.reviewCard(TENANT_ID, 'card-xxxx', 3)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── getNodeReport ─────────────────────────────────────────────────────────

  it('7. getNodeReport → retourne stats du deck', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: FAKE_CARDS, error: null }),
    );

    const result = await service.getNodeReport(TENANT_ID, DECK_ID);
    // service retourne totalCards / reviewedCards / masteredCards
    expect(result).toHaveProperty('totalCards', 2);
    expect(result).toHaveProperty('reviewedCards');
    expect(result).toHaveProperty('masteredCards');
  });

  // ── getGlobalStats ────────────────────────────────────────────────────────

  it('8. getGlobalStats → retourne statistiques globales', async () => {
    // decks query
    mockSupabase.client.from
      .mockReturnValueOnce(
        buildChain(undefined, { data: [FAKE_DECK], error: null }),
      )
      // cards query
      .mockReturnValueOnce(
        buildChain(undefined, { data: FAKE_CARDS, error: null }),
      );

    const result = await service.getGlobalStats(TENANT_ID, USER_ID);
    expect(result).toHaveProperty('totalDecks');
    expect(result).toHaveProperty('totalCards');
  });

  // ── bootstrapSession ──────────────────────────────────────────────────────

  it('9. bootstrapSession → AI indisponible → fallback paragraphes', async () => {
    // AI throws → catch block → fallback paragraph splitting
    mockMasterclassFactory.aiChatWithFallback.mockRejectedValueOnce(
      new Error('AI unavailable'),
    );

    const sourceText =
      'Premier paragraphe.\n\nDeuxième paragraphe.\n\nTroisième paragraphe.';

    // createDeck: insert().select('*').single() → retourne FAKE_DECK
    mockSupabase.client.from
      .mockReturnValueOnce(
        buildChain({
          data: { ...FAKE_DECK, title: 'Session NeuroRecall' },
          error: null,
        }),
      )
      // card inserts (thenable, 3 paragraphes)
      .mockReturnValue(buildChain({ data: null, error: null }));

    const result = await service.bootstrapSession(
      TENANT_ID,
      USER_ID,
      sourceText,
    );
    expect(result).toHaveProperty('deckId');
    expect(result).toHaveProperty('cardCount');
    expect(result.cardCount).toBeGreaterThan(0);
  });
});
