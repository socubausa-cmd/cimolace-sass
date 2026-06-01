/**
 * Tests unitaires — IriService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IriService } from './iri.service';
import { SupabaseService } from '../supabase/supabase.service';

function buildChain(
  singleResult = { data: null as unknown, error: null as unknown },
) {
  const chain: Record<string, jest.Mock> = {};
  [
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
  ].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue(singleResult);
  chain.maybeSingle = jest.fn().mockResolvedValue(singleResult);
  chain.then = jest.fn().mockImplementation((cb: (v: unknown) => unknown) =>
    Promise.resolve(
      cb({
        data: Array.isArray(singleResult.data) ? singleResult.data : [],
        error: null,
      }),
    ),
  );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };
const TENANT_ID = 'tenant-0001';
const USER_ID = 'user-0001';
const FAKE_PAGE = {
  id: 'page-001',
  slug: 'accueil',
  title: 'Accueil',
  status: 'draft',
  tenant_id: TENANT_ID,
};

describe('IriService', () => {
  let service: IriService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IriService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();
    service = module.get<IriService>(IriService);
  });

  it('1. createPage → retourne page', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_PAGE, error: null }),
    );
    const result = await service.createPage(TENANT_ID, USER_ID, {
      title: 'Accueil',
      slug: 'accueil',
    });
    expect(result).toMatchObject({ slug: 'accueil' });
  });

  it('2. getPage → trouvée → retourne page', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_PAGE, error: null }),
    );
    const result = await service.getPage(TENANT_ID, 'accueil');
    expect(result).toMatchObject({ id: 'page-001' });
  });

  it('3. getPage → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    await expect(service.getPage(TENANT_ID, 'inexistante')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('4. publishPage → retourne status published', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    const result = await service.publishPage(TENANT_ID, 'accueil');
    expect(result).toMatchObject({ status: 'published' });
  });

  it('5. submitReview → retourne review', async () => {
    const fakeReview = { id: 'rev-001', rating: 5, status: 'pending' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: fakeReview, error: null }),
    );
    const result = await service.submitReview(
      TENANT_ID,
      USER_ID,
      5,
      'Excellent !',
    );
    expect(result).toMatchObject({ rating: 5 });
  });

  it('6. approveReview → retourne status approved', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    const result = await service.approveReview(TENANT_ID, 'rev-001');
    expect(result).toMatchObject({ status: 'approved' });
  });

  it('7. createPrivilegedLink → retourne lien avec code', async () => {
    const fakeLink = { id: 'link-001', code: 'abc12345', status: 'active' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: fakeLink, error: null }),
    );
    const result = await service.createPrivilegedLink(
      TENANT_ID,
      USER_ID,
      'live',
      'live-001',
    );
    expect(result).toMatchObject({ code: 'abc12345' });
  });
});
