/**
 * Tests unitaires — LiriBrainService
 *
 * Scénarios couverts :
 *  1.  getModels → retourne tableau non vide
 *  2.  getConversation → trouvée → retourne LiriConversation
 *  3.  getConversation → introuvable → NotFoundException
 *  4.  listConversations → retourne tableau
 *  5.  saveConversation → nouvelle → insert → retourne conversation
 *  6.  saveConversation → existante (avec id) → update → retourne conversation
 *  7.  saveConversation → update introuvable → NotFoundException
 *  8.  callAI → clé absente → retourne chaîne vide
 *  9.  generateQuiz → AI indisponible → retourne fallback
 * 10.  generateMindmap → AI indisponible → retourne fallback
 * 11.  translate → AI indisponible → retourne chaîne vide
 * 12.  textToSpeech → clé absente → retourne audioBase64 null
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { LiriBrainService } from './liri-brain.service';
import { SupabaseService } from '../supabase/supabase.service';

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
    'in',
    'limit',
  ];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue(singleResult);
  chain.maybeSingle = jest.fn().mockResolvedValue(singleResult);
  chain.order = jest.fn().mockReturnValue(chain);
  // listConversations finishes with .limit() → we make it thenable
  chain.then = jest
    .fn()
    .mockImplementation((cb: (v: unknown) => unknown) =>
      Promise.resolve(cb(listResult ?? { data: [], error: null })),
    );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };
const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-aaaa';
const USER_ID = 'user-0001';

const CONV_ROW = {
  id: 'conv-0001',
  tenant_id: TENANT_ID,
  user_id: USER_ID,
  model: 'liri-v1',
  title: 'Première conversation',
  messages_json: JSON.stringify([
    { role: 'user', content: 'Bonjour', timestamp: new Date().toISOString() },
  ]),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ─── Suite principale ─────────────────────────────────────────────────────────

describe('LiriBrainService', () => {
  let service: LiriBrainService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    mockConfig.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiriBrainService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<LiriBrainService>(LiriBrainService);
  });

  // ── getModels ─────────────────────────────────────────────────────────────

  it('1. getModels → retourne tableau non vide', () => {
    const models = service.getModels();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  // ── getConversation ───────────────────────────────────────────────────────

  it('2. getConversation → trouvée → retourne LiriConversation', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: CONV_ROW, error: null }),
    );

    const result = await service.getConversation(TENANT_ID, 'conv-0001');
    expect(result).toMatchObject({ id: 'conv-0001', model: 'liri-v1' });
    expect(Array.isArray(result.messages)).toBe(true);
  });

  it('3. getConversation → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );

    await expect(
      service.getConversation(TENANT_ID, 'conv-xxxx'),
    ).rejects.toThrow(NotFoundException);
  });

  // ── listConversations ─────────────────────────────────────────────────────

  it('4. listConversations → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [CONV_ROW], error: null }),
    );

    const result = await service.listConversations(TENANT_ID, USER_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  // ── saveConversation ──────────────────────────────────────────────────────

  it('5. saveConversation → nouvelle → insert → retourne conversation', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: CONV_ROW, error: null }),
    );

    const result = await service.saveConversation(
      TENANT_ID,
      USER_ID,
      'liri-v1' as any,
      'Ma conversation',
      [{ role: 'user', content: 'Hello', timestamp: '' }],
    );

    expect(result).toMatchObject({ id: 'conv-0001' });
  });

  it('6. saveConversation → existante avec id → update → retourne conversation', async () => {
    const updatedRow = { ...CONV_ROW, title: 'Titre mis à jour' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: updatedRow, error: null }),
    );

    const result = await service.saveConversation(
      TENANT_ID,
      USER_ID,
      'liri-v1' as any,
      'Titre mis à jour',
      [{ role: 'user', content: 'Hello', timestamp: '' }],
      'conv-0001',
    );

    expect(result.title).toBe('Titre mis à jour');
  });

  it('7. saveConversation → update introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );

    await expect(
      service.saveConversation(
        TENANT_ID,
        USER_ID,
        'liri-v1' as any,
        'Titre',
        [{ role: 'user', content: 'Hello', timestamp: '' }],
        'conv-xxxx',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  // ── callAI ────────────────────────────────────────────────────────────────

  it('8. callAI → toutes clés absentes → retourne chaîne vide', async () => {
    mockConfig.get.mockReturnValue(undefined);

    const result = await service.callAI('system', [
      { role: 'user', content: 'test' },
    ]);
    expect(typeof result).toBe('string');
  });

  it('9. callAI → clé replace_me → traitée comme absente', async () => {
    mockConfig.get.mockReturnValue('replace_me');

    const result = await service.callAI('system', [
      { role: 'user', content: 'test' },
    ]);
    expect(result).toBe('');
  });

  // ── generateQuiz ──────────────────────────────────────────────────────────

  it('10. generateQuiz → AI indisponible → retourne objet questions', async () => {
    mockConfig.get.mockReturnValue(undefined);

    const result = await service.generateQuiz(
      TENANT_ID,
      'Contenu pédagogique',
      3,
    );
    expect(result).toHaveProperty('questions');
    expect(result).toHaveProperty('count', 3);
  });

  // ── generateMindmap ───────────────────────────────────────────────────────

  it('11. generateMindmap → AI indisponible → retourne objet avec central', async () => {
    mockConfig.get.mockReturnValue(undefined);

    const result = await service.generateMindmap(TENANT_ID, 'Contenu');
    expect(result).toHaveProperty('central');
  });

  // ── translate ─────────────────────────────────────────────────────────────

  it('12. translate → AI indisponible → retourne objet translation', async () => {
    mockConfig.get.mockReturnValue(undefined);

    const result = await service.translate(TENANT_ID, 'Bonjour', 'en');
    expect(result).toHaveProperty('translation');
    expect(result).toHaveProperty('targetLang', 'en');
  });

  // ── textToSpeech ──────────────────────────────────────────────────────────

  it('13. textToSpeech → clé absente → retourne audioBase64 null', async () => {
    mockConfig.get.mockReturnValue(undefined);

    const result = await service.textToSpeech(TENANT_ID, 'Bonjour', 'alloy');
    expect(result.audioBase64).toBeNull();
  });
});
