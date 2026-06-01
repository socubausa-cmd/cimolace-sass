/**
 * Tests unitaires — StudioService
 *
 * Scénarios couverts :
 *  1.  listWorkspaces → retourne tableau
 *  2.  getWorkspace → trouvé → retourne workspace
 *  3.  getWorkspace → introuvable → NotFoundException
 *  4.  createWorkspace → succès → retourne workspace
 *  5.  createWorkspace → erreur DB → BadRequestException
 *  6.  deleteWorkspace → succès
 *  7.  createAsset → retourne asset
 *  8.  listFormations → retourne tableau
 *  9.  getFormation → introuvable → NotFoundException
 * 10.  createFormation → retourne formation
 * 11.  listRenderJobs → retourne tableau
 * 12.  enqueueRenderJob → retourne job
 * 13.  getHubStats → retourne compteurs agrégés
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudioService } from './studio.service';
import { SupabaseService } from '../supabase/supabase.service';

// ─── Helpers mock ─────────────────────────────────────────────────────────────

function buildChain(
  singleResult: { data: unknown; error: unknown; count?: number } = {
    data: null,
    error: null,
  },
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
    'contains',
    'head',
  ];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue(singleResult);
  chain.maybeSingle = jest.fn().mockResolvedValue(singleResult);
  chain.then = jest.fn().mockImplementation((cb: (v: unknown) => unknown) =>
    Promise.resolve(
      cb(
        listResult ?? {
          data: [],
          count: singleResult.count ?? 0,
          error: null,
        },
      ),
    ),
  );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };
const TENANT_ID = 'tenant-0001';
const OWNER_ID = 'user-0001';
const FAKE_WS = {
  id: 'ws-0001',
  tenant_id: TENANT_ID,
  title: 'Workspace test',
  status: 'draft',
};
const FAKE_FORM = {
  id: 'form-0001',
  tenant_id: TENANT_ID,
  title: 'Formation test',
  programme_type: 'complet',
};
const FAKE_JOB = {
  id: 'job-0001',
  tenant_id: TENANT_ID,
  job_type: 'video_export',
  status: 'pending',
};

// ─── Suite principale ─────────────────────────────────────────────────────────

describe('StudioService', () => {
  let service: StudioService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudioService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<StudioService>(StudioService);
  });

  // ── Workspaces ────────────────────────────────────────────────────────────

  it('1. listWorkspaces → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [FAKE_WS], error: null }),
    );
    const result = await service.listWorkspaces(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('2. getWorkspace → trouvé → retourne workspace', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_WS, error: null }),
    );
    const result = await service.getWorkspace(TENANT_ID, 'ws-0001');
    expect(result).toMatchObject({ id: 'ws-0001' });
  });

  it('3. getWorkspace → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    await expect(service.getWorkspace(TENANT_ID, 'ws-xxxx')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('4. createWorkspace → succès → retourne workspace', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_WS, error: null }),
    );
    const result = await service.createWorkspace(TENANT_ID, OWNER_ID, {
      title: 'Workspace test',
    });
    expect(result).toMatchObject({ id: 'ws-0001' });
  });

  it('5. createWorkspace → erreur DB → BadRequestException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: { message: 'insert failed' } }),
    );
    await expect(
      service.createWorkspace(TENANT_ID, OWNER_ID, { title: 'X' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. deleteWorkspace → succès → retourne id', async () => {
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: FAKE_WS, error: null })) // getWorkspace
      .mockReturnValueOnce(buildChain({ data: null, error: null })); // delete
    const result = await service.deleteWorkspace(TENANT_ID, 'ws-0001');
    expect(result).toMatchObject({ id: 'ws-0001' });
  });

  // ── Assets ────────────────────────────────────────────────────────────────

  it('7. createAsset → retourne asset', async () => {
    const fakeAsset = { id: 'asset-001', asset_type: 'image', title: 'Logo' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: fakeAsset, error: null }),
    );
    const result = await service.createAsset(TENANT_ID, OWNER_ID, {
      assetType: 'image',
      title: 'Logo',
      publicUrl: 'https://cdn.test/logo.png',
    });
    expect(result).toMatchObject({ id: 'asset-001' });
  });

  // ── Formations ────────────────────────────────────────────────────────────

  it('8. listFormations → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [FAKE_FORM], error: null }),
    );
    const result = await service.listFormations(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('9. getFormation → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    await expect(service.getFormation(TENANT_ID, 'form-xxxx')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('10. createFormation → retourne formation', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_FORM, error: null }),
    );
    const result = await service.createFormation(TENANT_ID, OWNER_ID, {
      title: 'Formation test',
    });
    expect(result).toMatchObject({ id: 'form-0001' });
  });

  // ── Render Jobs ───────────────────────────────────────────────────────────

  it('11. listRenderJobs → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [FAKE_JOB], error: null }),
    );
    const result = await service.listRenderJobs(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('12. enqueueRenderJob → retourne job', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_JOB, error: null }),
    );
    const result = await service.enqueueRenderJob(TENANT_ID, {
      jobType: 'video_export',
    });
    expect(result).toMatchObject({ id: 'job-0001' });
  });

  // ── Hub Stats ─────────────────────────────────────────────────────────────

  it('13. getHubStats → retourne compteurs agrégés', async () => {
    // 4 Promise.all calls, each returning a count
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: null, error: null, count: 5 })) // workspaces
      .mockReturnValueOnce(buildChain({ data: null, error: null, count: 3 })) // projects
      .mockReturnValueOnce(buildChain({ data: null, error: null, count: 2 })) // formations
      .mockReturnValueOnce(buildChain({ data: null, error: null, count: 10 })); // assets

    const result = await service.getHubStats(TENANT_ID);
    expect(result).toHaveProperty('workspaceCount');
    expect(result).toHaveProperty('projectCount');
    expect(result).toHaveProperty('formationCount');
    expect(result).toHaveProperty('assetCount');
  });
});
