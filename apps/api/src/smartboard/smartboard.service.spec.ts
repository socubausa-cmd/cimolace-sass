/**
 * Tests unitaires — SmartboardService
 *
 * Scénarios couverts :
 *  1.  createDeck → insère en DB → retourne SmartboardDeckRow
 *  2.  createDeck → erreur DB → BadRequestException
 *  3.  listDecks → retourne tableau
 *  4.  getDeck → trouvé → retourne SmartboardDeckRow
 *  5.  getDeck → introuvable → NotFoundException
 *  6.  deleteDeck → succès
 *  7.  deleteDeck → erreur DB → BadRequestException
 *  8.  listSlides → retourne tableau ordonné
 *  9.  getSlide → trouvé → retourne SmartboardSlideRow
 * 10.  getSlide → introuvable → NotFoundException
 * 11.  updateSlide → patch simple (title) → retourne slide modifié
 * 12.  updateSlide → erreur DB → BadRequestException
 * 13.  scoreSlideQuality → retourne scores
 * 14.  scoreDeckQuality → deck vide → overall 0
 * 15.  scoreDeckQuality → plusieurs slides → calcule moyenne
 * 16.  listVersions → deck sans versions → tableau vide
 * 17.  listThemes → retourne tableau non vide
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SmartboardService } from './smartboard.service';
import { SupabaseService } from '../supabase/supabase.service';

// ─── Helpers mock ─────────────────────────────────────────────────────────────

type ChainResult = { data: unknown; error: unknown };
type ListResult = { data: unknown[]; error: unknown };

/**
 * Construit un mock de la chaîne fluent Supabase.
 * - `.single()` et `.maybeSingle()` retournent `singleResult`
 * - `.order()` retourne `listResult`
 */
function buildChain(
  singleResult: ChainResult = { data: null, error: null },
  listResult?: ListResult,
) {
  // Quand listResult est absent, le thenable se résout avec singleResult
  // (cas : await chain terminal sans .single(), ex: delete/update direct)
  const resolved = Promise.resolve(listResult ?? singleResult);
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
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
    .mockImplementation((res: any, rej?: any) => resolved.then(res, rej));
  chain.catch = jest.fn().mockImplementation((rej: any) => resolved.catch(rej));
  chain.finally = jest
    .fn()
    .mockImplementation((cb: any) => resolved.finally(cb));
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = {
  id: 'tttt-aaaa',
  slug: 'ecole-test',
  name: 'École Test',
  plan: 'school' as const,
  status: 'active' as const,
  userRole: 'owner' as const,
};

const USER_ID = 'user-0001';

const FAKE_DECK = {
  id: 'deck-0001',
  tenant_id: TENANT.id,
  created_by: USER_ID,
  title: 'Leçon 1',
  status: 'draft',
};

const FAKE_SLIDE = {
  id: 'slide-0001',
  deck_id: 'deck-0001',
  tenant_id: TENANT.id,
  slide_index: 0,
  title: 'Introduction',
  content: { main_text: 'Bonjour', support_text: '' },
  teacher_note: 'Accueillir les élèves',
  student_action: 'Écouter',
  illustration_image_url: 'https://picsum.photos/seed/intro/800/450',
};

// ─── Suite principale ─────────────────────────────────────────────────────────

describe('SmartboardService', () => {
  let service: SmartboardService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartboardService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<SmartboardService>(SmartboardService);
  });

  // ── createDeck ─────────────────────────────────────────────────────────────

  it('1. createDeck → insère en DB → retourne SmartboardDeckRow', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_DECK, error: null }),
    );

    const result = await service.createDeck(
      { title: 'Leçon 1', sourceText: 'Contenu source' },
      TENANT as any,
      USER_ID,
    );

    expect(result).toMatchObject({ id: 'deck-0001', title: 'Leçon 1' });
  });

  it('2. createDeck → erreur DB → BadRequestException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: { message: 'duplicate key' } }),
    );

    await expect(
      service.createDeck(
        { title: 'X', sourceText: '' },
        TENANT as any,
        USER_ID,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ── listDecks ──────────────────────────────────────────────────────────────

  it('3. listDecks → retourne tableau de decks', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [FAKE_DECK], error: null }),
    );

    const result = await service.listDecks(TENANT.id);
    expect(Array.isArray(result)).toBe(true);
  });

  // ── getDeck ────────────────────────────────────────────────────────────────

  it('4. getDeck → trouvé → retourne SmartboardDeckRow', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_DECK, error: null }),
    );

    const result = await service.getDeck('deck-0001', TENANT.id);
    expect(result).toMatchObject({ id: 'deck-0001' });
  });

  it('5. getDeck → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );

    await expect(service.getDeck('deck-xxxx', TENANT.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── deleteDeck ─────────────────────────────────────────────────────────────

  it("6. deleteDeck → succès (pas d'exception)", async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );

    await expect(
      service.deleteDeck('deck-0001', TENANT.id),
    ).resolves.toBeUndefined();
  });

  it('7. deleteDeck → erreur DB → BadRequestException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: { message: 'FK violation' } }),
    );

    await expect(service.deleteDeck('deck-0001', TENANT.id)).rejects.toThrow(
      BadRequestException,
    );
  });

  // ── listSlides ─────────────────────────────────────────────────────────────

  it('8. listSlides → retourne tableau ordonné', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [FAKE_SLIDE], error: null }),
    );

    const result = await service.listSlides('deck-0001', TENANT.id);
    expect(Array.isArray(result)).toBe(true);
  });

  // ── getSlide ───────────────────────────────────────────────────────────────

  it('9. getSlide → trouvé → retourne SmartboardSlideRow', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_SLIDE, error: null }),
    );

    const result = await service.getSlide('slide-0001', TENANT.id);
    expect(result).toMatchObject({ id: 'slide-0001', title: 'Introduction' });
  });

  it('10. getSlide → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );

    await expect(service.getSlide('slide-xxxx', TENANT.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── updateSlide ────────────────────────────────────────────────────────────

  it('11. updateSlide → patch title → retourne slide modifié', async () => {
    const updated = { ...FAKE_SLIDE, title: 'Introduction modifiée' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: updated, error: null }),
    );

    const result = await service.updateSlide(
      'slide-0001',
      { title: 'Introduction modifiée' },
      TENANT.id,
    );
    expect(result).toMatchObject({ title: 'Introduction modifiée' });
  });

  it('12. updateSlide avec content → lit existing puis met à jour', async () => {
    // 1er appel : lecture contenu existant
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: FAKE_SLIDE, error: null }))
      // 2e appel : mise à jour
      .mockReturnValueOnce(
        buildChain({
          data: {
            ...FAKE_SLIDE,
            content: { main_text: 'Nouveau', support_text: '' },
          },
          error: null,
        }),
      );

    const result = await service.updateSlide(
      'slide-0001',
      { main_text: 'Nouveau' },
      TENANT.id,
    );
    expect(result).toBeDefined();
  });

  it('13. updateSlide → erreur DB → BadRequestException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: { message: 'update failed' } }),
    );

    await expect(
      service.updateSlide('slide-0001', { title: 'X' } as any, TENANT.id),
    ).rejects.toThrow(BadRequestException);
  });

  // ── scoreSlideQuality ──────────────────────────────────────────────────────

  it('14. scoreSlideQuality → retourne objet avec overall', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_SLIDE, error: null }),
    );

    const result = await service.scoreSlideQuality('slide-0001', TENANT.id);
    expect(result).toHaveProperty('overall');
    expect(typeof result.overall).toBe('number');
  });

  // ── scoreDeckQuality ──────────────────────────────────────────────────────

  it('15. scoreDeckQuality → deck vide → overall 0', async () => {
    // listSlides → order chain
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [], error: null }),
    );

    const result = await service.scoreDeckQuality('deck-0001', TENANT.id);
    expect(result.overall).toBe(0);
  });

  it('16. scoreDeckQuality → 2 slides → calcule moyenne', async () => {
    const slides = [
      FAKE_SLIDE,
      {
        ...FAKE_SLIDE,
        id: 'slide-0002',
        title: 'Corps',
        illustration_image_url: null,
      },
    ];
    // listSlides
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: slides, error: null }),
    );

    const result = await service.scoreDeckQuality('deck-0001', TENANT.id);
    expect(result.slides).toHaveLength(2);
    expect(typeof result.overall).toBe('number');
  });

  // ── listVersions ──────────────────────────────────────────────────────────

  it('17. listVersions → deck sans versions → tableau vide', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_DECK, error: null }), // getDeck
    );

    const result = await service.listVersions('deck-0001', TENANT.id);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  // ── listThemes ────────────────────────────────────────────────────────────

  it('18. listThemes → retourne tableau non vide avec key + label', () => {
    const themes = service.listThemes();
    expect(Array.isArray(themes)).toBe(true);
    expect(themes.length).toBeGreaterThan(0);
    expect(themes[0]).toHaveProperty('key');
    expect(themes[0]).toHaveProperty('label');
  });
});
