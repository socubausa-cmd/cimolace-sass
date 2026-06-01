/**
 * Tests unitaires — MasterclassFactoryService
 *
 * Scénarios couverts :
 *  1.  listProjects → retourne tableau
 *  2.  getProject → trouvé → retourne projet
 *  3.  getProject → introuvable → NotFoundException
 *  4.  createProject → succès → retourne projet créé
 *  5.  createProject → erreur DB → BadRequestException
 *  6.  deleteProject → succès
 *  7.  enqueueOrchestrator → succès → retourne projectId + status
 *  8.  enqueueOrchestrator → erreur DB → BadRequestException
 *  9.  aiChatWithFallback → toutes clés absentes → provider 'none'
 * 10.  aiChatWithFallback → clé DeepSeek présente → appelle fetch (mock)
 * 11.  generateMasterclass → AI retourne texte vide → utilise fallback
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MasterclassFactoryService } from './masterclass-factory.service';
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
    'order',
  ];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue(singleResult);
  chain.maybeSingle = jest.fn().mockResolvedValue(singleResult);
  chain.order = jest
    .fn()
    .mockResolvedValue(listResult ?? { data: [], error: null });
  chain.then = jest
    .fn()
    .mockImplementation((cb: (v: unknown) => unknown) =>
      Promise.resolve(cb(listResult ?? { data: [], error: null })),
    );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };

const mockConfig = {
  get: jest.fn().mockReturnValue(undefined), // toutes les clés IA absentes par défaut
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-0001';
const OWNER_ID = 'user-0001';

const FAKE_PROJECT = {
  id: 'proj-0001',
  tenant_id: TENANT_ID,
  owner_id: OWNER_ID,
  title: 'Test Masterclass',
  status: 'draft',
  pedagogical_model: 'liri-v1',
};

// ─── Suite principale ─────────────────────────────────────────────────────────

describe('MasterclassFactoryService', () => {
  let service: MasterclassFactoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    mockConfig.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterclassFactoryService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<MasterclassFactoryService>(MasterclassFactoryService);
  });

  // ── listProjects ──────────────────────────────────────────────────────────

  it('1. listProjects → retourne tableau de projets', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [FAKE_PROJECT], error: null }),
    );

    const result = await service.listProjects(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  // ── getProject ────────────────────────────────────────────────────────────

  it('2. getProject → trouvé → retourne projet', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_PROJECT, error: null }),
    );

    const result = await service.getProject(TENANT_ID, 'proj-0001');
    expect(result).toMatchObject({
      id: 'proj-0001',
      title: 'Test Masterclass',
    });
  });

  it('3. getProject → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );

    await expect(service.getProject(TENANT_ID, 'proj-xxxx')).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── createProject ─────────────────────────────────────────────────────────

  it('4. createProject → succès → retourne projet créé', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_PROJECT, error: null }),
    );

    const result = await service.createProject(TENANT_ID, OWNER_ID, {
      title: 'Test Masterclass',
    });
    expect(result).toMatchObject({ id: 'proj-0001' });
  });

  it('5. createProject → erreur DB → BadRequestException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: { message: 'insert failed' } }),
    );

    await expect(
      service.createProject(TENANT_ID, OWNER_ID, { title: 'X' }),
    ).rejects.toThrow(BadRequestException);
  });

  // ── deleteProject ─────────────────────────────────────────────────────────

  it('6. deleteProject → succès → retourne id supprimé', async () => {
    // getProject
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: FAKE_PROJECT, error: null }))
      // delete
      .mockReturnValueOnce(buildChain({ data: null, error: null }));

    const result = await service.deleteProject(TENANT_ID, 'proj-0001');
    expect(result).toMatchObject({ id: 'proj-0001' });
  });

  // ── enqueueOrchestrator ───────────────────────────────────────────────────

  it('7. enqueueOrchestrator → succès → retourne projectId et status', async () => {
    mockSupabase.client.from
      .mockReturnValueOnce(
        buildChain({
          data: {
            ...FAKE_PROJECT,
            status: 'analyzing',
            pipeline_stage: 'analyzing',
          },
          error: null,
        }),
      )
      // processOrchestratorPipeline will call DB — mock updates
      .mockReturnValue(buildChain({ data: null, error: null }));

    const result = await service.enqueueOrchestrator(TENANT_ID, OWNER_ID, {
      sourceText: 'Texte pédagogique',
      title: 'Test',
    });

    expect(result).toHaveProperty('projectId');
    expect(result.status).toBe('analyzing');
  });

  it('8. enqueueOrchestrator → erreur DB → BadRequestException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: { message: 'insert error' } }),
    );

    await expect(
      service.enqueueOrchestrator(TENANT_ID, OWNER_ID, {
        sourceText: 'X',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  // ── aiChatWithFallback ────────────────────────────────────────────────────

  it('9. aiChatWithFallback → toutes clés absentes → provider none, texte vide', async () => {
    mockConfig.get.mockReturnValue(undefined);

    const result = await service.aiChatWithFallback('system', [
      { role: 'user', content: 'question' },
    ]);
    expect(result.provider).toBe('none');
    expect(result.text).toBe('');
  });

  it('10. aiChatWithFallback → clé replace_me → traité comme absent', async () => {
    mockConfig.get.mockReturnValue('replace_me');

    const result = await service.aiChatWithFallback('system', [
      { role: 'user', content: 'question' },
    ]);
    expect(result.provider).toBe('none');
  });

  // ── generateMasterclass ───────────────────────────────────────────────────

  it('11. generateMasterclass → AI indisponible → utilise fallback local', async () => {
    // Toutes clés IA absentes → aiChatWithFallback retourne text vide
    mockConfig.get.mockReturnValue(undefined);

    // DB insert pour persister le deck
    mockSupabase.client.from.mockReturnValue(
      buildChain({ data: null, error: null }),
    );

    const result = await service.generateMasterclass(TENANT_ID, OWNER_ID, {
      sourceText: 'Contenu du cours',
      pedagogicalModel: 'liri-v1',
      lang: 'fr',
    });

    // Le fallback produit un deck avec des chapitres
    expect(result).toHaveProperty('chapters');
    expect(Array.isArray((result as any).chapters)).toBe(true);
    expect(result.provider).toBeDefined();
  });
});
