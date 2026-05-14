import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { TenantService } from './tenant.service';

const createMockChain = (resolveData: any = null, resolveError: any = null) => {
  // Create a thenable function so `await chain` works
  const chain: any = function() { return chain; };
  chain.then = (resolve: any) => resolve({ data: resolveData, error: resolveError });
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.upsert = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.neq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.range = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(() => chain);
  chain.or = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  return chain;
};

const mockSupabase = { client: { from: jest.fn() } };
const mockConfig = { get: jest.fn(() => 'http://test') };

describe('TenantService', () => {
  let svc: TenantService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    svc = mod.get(TenantService);
  });

  it('lists members', async () => {
    const chain = createMockChain([{ id: '1', role: 'teacher' }]);
    (mockSupabase.client.from as jest.Mock).mockReturnValue(chain);
    const res = await svc.listMembers('t1');
    expect(res).toEqual([{ id: '1', role: 'teacher' }]);
  });

  it('updates member role', async () => {
    const chain = createMockChain({ role: 'admin' });
    (mockSupabase.client.from as jest.Mock).mockReturnValue(chain);
    const res = await svc.updateMemberRole('t1', 'u1', 'admin');
    expect(res.role).toBe('admin');
  });

  it('removes member', async () => {
    const chain = createMockChain(null);
    (mockSupabase.client.from as jest.Mock).mockReturnValue(chain);
    await expect(svc.removeMember('t1', 'u1')).resolves.toBeUndefined();
  });

  it('returns my tenants', async () => {
    const chain = createMockChain([{ tenant_id: 't1', role: 'owner' }]);
    (mockSupabase.client.from as jest.Mock).mockReturnValue(chain);
    const res = await svc.getMyTenants('u1');
    expect(res).toEqual([{ tenant_id: 't1', role: 'owner' }]);
  });

  it('returns dashboard stats', async () => {
    const chain = createMockChain(null);
    (mockSupabase.client.from as jest.Mock).mockReturnValue(chain);
    const res = await svc.getDashboard('t1');
    expect(res).toHaveProperty('totalMembers');
    expect(res).toHaveProperty('totalLives');
    expect(res).toHaveProperty('totalCourses');
  });
});
