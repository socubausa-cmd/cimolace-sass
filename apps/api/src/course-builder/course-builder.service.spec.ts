/**
 * Tests unitaires — CourseBuilderService
 *
 * Scénarios couverts :
 *  1.  createPipeline → retourne pipeline
 *  2.  listPipelines → retourne tableau
 *  3.  getPipeline → trouvé
 *  4.  getPipeline → introuvable → NotFoundException
 *  5.  deletePipeline → succès
 *  6.  autoSegment → AI indisponible → fallback local
 *  7.  listSegments → retourne tableau
 *  8.  approveSegment → succès
 *  9.  listPostProdVersions → retourne tableau
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CourseBuilderService } from './course-builder.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MasterclassFactoryService } from '../masterclass-factory/masterclass-factory.service';

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
    'range',
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
const mockMasterclass = {
  aiChatWithFallback: jest
    .fn()
    .mockResolvedValue({ text: '', provider: 'none' }),
};

const TENANT_ID = 'tenant-0001';

const FAKE_PIPELINE = {
  id: 'pipe-0001',
  tenant_id: TENANT_ID,
  name: 'Cours de test',
  // source_text doit faire ≥ 50 caractères (validation dans autoSegment)
  source_text:
    'Contenu pédagogique très riche et détaillé permettant un apprentissage approfondi.',
  status: 'pending',
};

describe('CourseBuilderService', () => {
  let service: CourseBuilderService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    mockMasterclass.aiChatWithFallback.mockResolvedValue({
      text: '',
      provider: 'none',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseBuilderService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: MasterclassFactoryService, useValue: mockMasterclass },
      ],
    }).compile();

    service = module.get<CourseBuilderService>(CourseBuilderService);
  });

  it('1. createPipeline → retourne pipeline', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_PIPELINE, error: null }),
    );
    const result = await service.createPipeline(
      TENANT_ID,
      'Cours de test',
      'Contenu',
    );
    expect(result).toMatchObject({ id: 'pipe-0001' });
  });

  it('2. listPipelines → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [FAKE_PIPELINE], error: null }),
    );
    const result = await service.listPipelines(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('3. getPipeline → trouvé → retourne pipeline', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_PIPELINE, error: null }),
    );
    const result = await service.getPipeline(TENANT_ID, 'pipe-0001');
    expect(result).toMatchObject({ id: 'pipe-0001' });
  });

  it('4. getPipeline → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    await expect(service.getPipeline(TENANT_ID, 'pipe-xxxx')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('5. deletePipeline → succès', async () => {
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: FAKE_PIPELINE, error: null })) // getPipeline
      .mockReturnValueOnce(buildChain({ data: null, error: null })); // delete
    const result = await service.deletePipeline(TENANT_ID, 'pipe-0001');
    expect(result).toMatchObject({ id: 'pipe-0001' });
  });

  it('6. autoSegment → AI indisponible → utilise fallback local', async () => {
    mockMasterclass.aiChatWithFallback.mockResolvedValue({
      text: '',
      provider: 'none',
    });
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: FAKE_PIPELINE, error: null })) // getPipeline
      .mockReturnValueOnce(buildChain({ data: null, error: null })) // update status
      .mockReturnValue(buildChain({ data: null, error: null })); // segment inserts

    const result = await service.autoSegment(TENANT_ID, 'pipe-0001');
    // service retourne { segments: number, aiProvider: string }
    expect(result).toHaveProperty('segments');
    expect(result).toHaveProperty('aiProvider');
  });

  it('7. listSegments → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [], error: null }),
    );
    const result = await service.listSegments(TENANT_ID, 'pipe-0001');
    expect(Array.isArray(result)).toBe(true);
  });

  it('8. approveSegment → succès', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: { id: 'seg-0001', status: 'approved' }, error: null }),
    );
    const result = await service.approveSegment(TENANT_ID, 'seg-0001');
    expect(result).toMatchObject({ status: 'approved' });
  });

  it('9. listPostProdVersions → retourne tableau', async () => {
    mockSupabase.client.from
      // getPipeline appelé en premier
      .mockReturnValueOnce(buildChain({ data: FAKE_PIPELINE, error: null }))
      // liste des versions (thenable)
      .mockReturnValueOnce(buildChain(undefined, { data: [], error: null }));
    const result = await service.listPostProdVersions(TENANT_ID, 'pipe-0001');
    expect(Array.isArray(result)).toBe(true);
  });
});
