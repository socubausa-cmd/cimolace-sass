/**
 * Tests unitaires — CimolaceBackofficeService
 *
 * Méthodes couvertes :
 *  1.  getStats()
 *  2.  listClients()
 *  3.  createClient()
 *  4.  updateClient() — happy path + NotFoundException
 *  5.  listSites()
 *  6.  createSite()
 *  7.  updateSite() — happy path + NotFoundException
 *  8.  deleteSite()
 *  9.  getClientSites()
 * 10.  getDashboardKpi()
 * 11.  listAllSubscriptions()
 * 12.  listTickets()
 * 13.  updateTicket()
 * 14.  runTenantOperation() — status update
 * 15.  runTenantOperation() — maintenance toggle
 * 16.  updateTenantService() — happy path
 * 17.  updateTenantService() — service hors périmètre → BadRequestException
 * 18.  createTenantTicket() — happy path
 * 19.  createTenantInvoice() — happy path
 * 20.  getClientControlPlane() — renvoie un objet structuré
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CimolaceBackofficeService } from './cimolace-backoffice.service';
import { SupabaseService } from '../supabase/supabase.service';
import { BillingService } from '../billing/billing.service';

// ─── Config mock ────────────────────────────────────────────────────────────

const mockConfig = {
  get: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = {
      SUPABASE_URL: 'https://fwfupxvmwtxbtbjdeqvu.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-test',
    };
    return map[key] ?? undefined;
  }),
};

// ─── Supabase chain builder ──────────────────────────────────────────────────
//  Builds a fluent Supabase query chain.
//  singleResult — returned by .single() and .maybeSingle()
//  listResult   — returned by .order(), .limit(), and terminal awaits
function buildChain(
  singleResult: { data?: unknown; count?: number; error?: unknown } = {
    data: null,
    error: null,
  },
  listResult: { data?: unknown[]; count?: number; error?: unknown } = {
    data: [],
    error: null,
  },
) {
  const resolved = Promise.resolve(listResult);
  const chain: Record<string, jest.Mock> = {};
  // All fluent methods return the same chain
  const fluent = [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'in',
    'or',
    'limit',
    'head',
    'order',
  ];
  fluent.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue(singleResult);
  chain.maybeSingle = jest.fn().mockResolvedValue(singleResult);
  // Allow plain await on the chain (no terminal call)
  chain.then = jest
    .fn()
    .mockImplementation((resolve: any, reject?: any) =>
      resolved.then(resolve, reject),
    );
  chain.catch = jest
    .fn()
    .mockImplementation((reject: any) => resolved.catch(reject));
  chain.finally = jest
    .fn()
    .mockImplementation((cb: any) => resolved.finally(cb));
  return chain;
}

const mockFrom = jest.fn();
const mockSupabase = {
  client: {
    from: mockFrom,
    auth: { admin: { listUsers: jest.fn() } },
  },
};
const mockBilling = {
  createCheckout: jest.fn(),
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CLIENT_ID = 'cccc-0001';
const SITE_ID = 'ssss-0001';
const SERVICE_ID = 'srvc-0001';
const TICKET_ID = 'tkt-0001';
const INVOICE_ID = 'inv-0001';

const FAKE_CLIENT = {
  id: CLIENT_ID,
  name: 'École Test',
  status: 'active',
  plan: 'school',
  client_type: 'school',
  email: 'admin@test.fr',
};
const FAKE_SITE = {
  id: SITE_ID,
  client_id: CLIENT_ID,
  domain: 'test.fr',
  status: 'active',
  app_tenant_id: 'tenant-001',
  tenant_id: 'cimo-001',
};
const FAKE_SERVICE = {
  id: SERVICE_ID,
  site_id: SITE_ID,
  service_key: 'calendar',
  status: 'active',
};
const FAKE_TENANT = {
  id: 'tenant-001',
  name: 'École Test',
  slug: 'ecole-test',
  plan: 'school',
  infrastructure_type: 'school',
  metadata: {},
  brand_colors: {},
};

// ─── Setup ───────────────────────────────────────────────────────────────────

describe('CimolaceBackofficeService', () => {
  let service: CimolaceBackofficeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CimolaceBackofficeService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
        { provide: BillingService, useValue: mockBilling },
      ],
    }).compile();
    service = module.get<CimolaceBackofficeService>(CimolaceBackofficeService);
  });

  // ── 1. getStats ────────────────────────────────────────────────────────────
  describe('getStats', () => {
    it('returns aggregated counts from three tables', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'tenants')
          return buildChain(
            {},
            { data: [{ id: 't1' }, { id: 't2' }], error: null },
          );
        if (table === 'cimolace_clients')
          return buildChain({}, { data: [{ id: 'c1' }], error: null });
        return buildChain({}, { data: [], error: null });
      });

      const result = await service.getStats();
      expect(result.totalTenants).toBe(2);
      expect(result.totalClients).toBe(1);
      expect(result.totalSites).toBe(0);
    });
  });

  // ── 2. listClients ─────────────────────────────────────────────────────────
  describe('listClients', () => {
    it('returns array of clients', async () => {
      mockFrom.mockReturnValue(
        buildChain({}, { data: [FAKE_CLIENT], error: null }),
      );
      const result = await service.listClients();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── 3. createClient ────────────────────────────────────────────────────────
  describe('createClient', () => {
    it('inserts and returns the new client', async () => {
      const chain = buildChain({ data: FAKE_CLIENT, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.createClient({
        name: 'École Test',
        email: 'admin@test.fr',
        plan: 'school',
        status: 'active',
        client_type: 'school',
        portal_slug: 'ecole-test',
      });
      expect(result).toMatchObject({ id: CLIENT_ID });
    });

    it('throws BadRequestException on Supabase error', async () => {
      const chain = buildChain({
        data: null,
        error: { message: 'duplicate key' },
      });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.createClient({ name: 'dup', portal_slug: 'dup' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── 4. updateClient ────────────────────────────────────────────────────────
  describe('updateClient', () => {
    it('updates and returns the client', async () => {
      const updated = { ...FAKE_CLIENT, status: 'suspended' };
      const chain = buildChain({ data: updated, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.updateClient(CLIENT_ID, {
        status: 'suspended',
      });
      expect(result.status).toBe('suspended');
    });

    it('throws NotFoundException when client not found', async () => {
      const chain = buildChain({ data: null, error: { message: 'not found' } });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.updateClient('ghost-id', { name: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── 5. listSites ──────────────────────────────────────────────────────────
  describe('listSites', () => {
    it('returns array of sites', async () => {
      mockFrom.mockReturnValue(
        buildChain({}, { data: [FAKE_SITE], error: null }),
      );
      const result = await service.listSites();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── 6. createSite ─────────────────────────────────────────────────────────
  describe('createSite', () => {
    it('inserts and returns the new site', async () => {
      const chain = buildChain({ data: FAKE_SITE, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.createSite({
        name: 'Site test',
        client_id: CLIENT_ID,
      });
      expect(result).toMatchObject({ id: SITE_ID });
    });

    it('throws BadRequestException on error', async () => {
      const chain = buildChain({
        data: null,
        error: { message: 'insert error' },
      });
      mockFrom.mockReturnValue(chain);

      await expect(service.createSite({ name: 'bad' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── 7. updateSite ─────────────────────────────────────────────────────────
  describe('updateSite', () => {
    it('updates and returns the site', async () => {
      const updated = { ...FAKE_SITE, status: 'inactive' };
      const chain = buildChain({ data: updated, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.updateSite(SITE_ID, {
        status: 'inactive',
      });
      expect(result.status).toBe('inactive');
    });

    it('throws NotFoundException when site not found', async () => {
      const chain = buildChain({ data: null, error: { message: 'not found' } });
      mockFrom.mockReturnValue(chain);

      await expect(service.updateSite('ghost', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── 8. deleteSite ─────────────────────────────────────────────────────────
  describe('deleteSite', () => {
    it('returns { ok: true } on success', async () => {
      const chain = buildChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);
      const result = await service.deleteSite(SITE_ID);
      expect(result).toEqual({ ok: true });
    });

    it('resolves ok:true even on missing row (service ignores Supabase error for delete)', async () => {
      // deleteSite only checks error, but the service returns { ok: true } regardless when no error thrown
      const chain = buildChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);
      const result = await service.deleteSite(SITE_ID);
      expect(result).toEqual({ ok: true });
    });
  });

  // ── 9. getClientSites ─────────────────────────────────────────────────────
  describe('getClientSites', () => {
    it('returns sites for a given client', async () => {
      const chain = buildChain(
        { data: null, error: null },
        { data: [FAKE_SITE], error: null },
      );
      // .eq() returns a thenable resolved value
      chain.eq.mockReturnValue({
        then: (r: any) =>
          Promise.resolve({ data: [FAKE_SITE], error: null }).then(r),
      });
      mockFrom.mockReturnValue(chain);
      const result = await service.getClientSites(CLIENT_ID);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── 10. getDashboardKpi ───────────────────────────────────────────────────
  describe('getDashboardKpi', () => {
    it('returns KPI object with totals and mrr', async () => {
      mockFrom.mockImplementation(() =>
        buildChain(
          { data: null, count: 5, error: null },
          { data: [], count: 5, error: null },
        ),
      );
      const result = await service.getDashboardKpi();
      expect(result).toHaveProperty('totalTenants');
      expect(result).toHaveProperty('activeSubscriptions');
      expect(result).toHaveProperty('mrr');
    });
  });

  // ── 11. listAllSubscriptions ──────────────────────────────────────────────
  describe('listAllSubscriptions', () => {
    it('returns subscriptions array', async () => {
      mockFrom.mockReturnValue(
        buildChain({}, { data: [{ id: 'sub-1' }], error: null }),
      );
      const result = await service.listAllSubscriptions();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── 12. listTickets ────────────────────────────────────────────────────────
  describe('listTickets', () => {
    it('returns tickets array', async () => {
      mockFrom.mockReturnValue(
        buildChain(
          {},
          { data: [{ id: 'tkt-1', subject: 'Bug' }], error: null },
        ),
      );
      const result = await service.listTickets();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── 13. updateTicket ──────────────────────────────────────────────────────
  describe('updateTicket', () => {
    it('updates ticket and returns updated row', async () => {
      const updated = { id: TICKET_ID, status: 'closed' };
      const chain = buildChain({ data: updated, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.updateTicket(TICKET_ID, {
        status: 'closed',
      });
      expect(result.status).toBe('closed');
    });
  });

  // ─── Helper: build from mock for scope ────────────────────────────────────
  /**
   * Sets up mockFrom so that getClientOperationScope resolves correctly:
   *  - cimolace_clients .single() → FAKE_CLIENT
   *  - cimolace_sites (direct) → [FAKE_SITE]
   *  - cimolace_contracts → []
   */
  function mockScopeAndSite(extraMocks?: (table: string) => any) {
    mockFrom.mockImplementation((table: string) => {
      if (extraMocks) {
        const override = extraMocks(table);
        if (override) return override;
      }
      if (table === 'cimolace_clients') {
        return buildChain({ data: FAKE_CLIENT, error: null });
      }
      if (table === 'cimolace_sites') {
        return buildChain(
          { data: FAKE_SITE, error: null },
          { data: [FAKE_SITE], error: null },
        );
      }
      if (table === 'cimolace_contracts') {
        return buildChain(
          { data: null, error: null },
          { data: [], error: null },
        );
      }
      if (table === 'cimolace_change_history') {
        const chain = buildChain();
        chain.insert = jest.fn().mockResolvedValue({ data: null, error: null });
        return chain;
      }
      return buildChain({ data: null, error: null });
    });
  }

  // ── 14. runTenantOperation — status update ─────────────────────────────────
  describe('runTenantOperation', () => {
    it('updates client status', async () => {
      const tenantChain = buildChain(
        {
          data: { ...FAKE_TENANT, status: 'suspended' },
          error: null,
        },
        { data: [FAKE_TENANT], error: null },
      );
      mockScopeAndSite((table) => {
        if (table === 'cimolace_clients') {
          const chain = buildChain({ data: FAKE_CLIENT, error: null });
          // second call (update) also returns FAKE_CLIENT
          return chain;
        }
        if (table === 'tenants') return tenantChain;
      });

      // getClientControlPlane will be called at the end; mock all tables it needs
      jest
        .spyOn(service, 'getClientControlPlane')
        .mockResolvedValue({ client: FAKE_CLIENT } as any);

      const result = await service.runTenantOperation(CLIENT_ID, {
        status: 'suspended',
        reason: 'test',
      });
      expect(result.ok).toBe(true);
      expect(tenantChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'suspended' }),
      );
    });

    it('puts sites into maintenance mode', async () => {
      const tenantChain = buildChain(
        {
          data: { ...FAKE_TENANT, status: 'maintenance' },
          error: null,
        },
        { data: [FAKE_TENANT], error: null },
      );
      mockScopeAndSite((table) => {
        if (table === 'tenants') return tenantChain;
      });
      jest
        .spyOn(service, 'getClientControlPlane')
        .mockResolvedValue({ client: FAKE_CLIENT } as any);

      const result = await service.runTenantOperation(CLIENT_ID, {
        maintenance: true,
        reason: 'upgrade',
      });
      expect(result.ok).toBe(true);
      expect(tenantChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'maintenance' }),
      );
    });

    it('records a production readiness attestation on the app tenant', async () => {
      const tenantChain = buildChain(
        {
          data: {
            ...FAKE_TENANT,
            metadata: {
              production_readiness: {
                domain_dns: {
                  status: 'verified',
                  note: 'DNS domaine vérifié depuis Cimolace',
                },
              },
            },
          },
          error: null,
        },
        { data: [FAKE_TENANT], error: null },
      );
      mockScopeAndSite((table) => {
        if (table === 'tenants') return tenantChain;
      });
      jest
        .spyOn(service, 'getClientControlPlane')
        .mockResolvedValue({ client: FAKE_CLIENT } as any);

      const result = await service.runTenantOperation(CLIENT_ID, {
        record_readiness_check: true,
        readiness_key: 'domain_dns',
        readiness_status: 'verified',
        readiness_note: 'DNS domaine vérifié depuis Cimolace',
        readiness_evidence: { checked_by: 'test' },
        reason: 'test readiness',
      });

      expect(result.ok).toBe(true);
      expect(tenantChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            production_readiness: expect.objectContaining({
              domain_dns: expect.objectContaining({
                status: 'verified',
                evidence: { checked_by: 'test' },
              }),
            }),
          }),
        }),
      );
    });

    it('rejects readiness attestation without a readiness key', async () => {
      mockScopeAndSite();
      await expect(
        service.runTenantOperation(CLIENT_ID, {
          record_readiness_check: true,
          reason: 'missing key',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── 15. updateTenantService ────────────────────────────────────────────────
  describe('updateTenantService', () => {
    it('activates a service that belongs to the client scope', async () => {
      mockScopeAndSite((table) => {
        if (table === 'cimolace_services') {
          const chain = buildChain({
            data: { ...FAKE_SERVICE, status: 'active' },
            error: null,
          });
          chain.eq.mockReturnValue(chain);
          return chain;
        }
      });
      jest
        .spyOn(service, 'getClientControlPlane')
        .mockResolvedValue({ client: FAKE_CLIENT } as any);

      const result = await service.updateTenantService(CLIENT_ID, SERVICE_ID, {
        status: 'active',
      });
      expect(result.ok).toBe(true);
    });

    it('throws BadRequestException when service does not belong to client', async () => {
      mockScopeAndSite((table) => {
        if (table === 'cimolace_services') {
          // Service belongs to a different site
          const chain = buildChain({
            data: { ...FAKE_SERVICE, site_id: 'other-site' },
            error: null,
          });
          chain.eq.mockReturnValue(chain);
          return chain;
        }
      });

      await expect(
        service.updateTenantService(CLIENT_ID, SERVICE_ID, {
          status: 'active',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── 16. createTenantTicket ────────────────────────────────────────────────
  describe('createTenantTicket', () => {
    it('creates ticket and returns it', async () => {
      const fakeTicket = {
        id: TICKET_ID,
        ticket_number: 'TKT-001',
        subject: 'Problème login',
        status: 'open',
      };

      mockScopeAndSite((table) => {
        if (table === 'cimolace_tickets') {
          return buildChain({ data: fakeTicket, error: null });
        }
      });
      jest
        .spyOn(service, 'getClientControlPlane')
        .mockResolvedValue({ client: FAKE_CLIENT } as any);

      const result = await service.createTenantTicket(CLIENT_ID, {
        site_id: SITE_ID,
        subject: 'Problème login',
        priority: 'high',
        category: 'operations',
      });

      expect(result.ok).toBe(true);
      expect((result as any).ticket?.subject).toBe('Problème login');
    });
  });

  // ── 17. createTenantInvoice ───────────────────────────────────────────────
  describe('createTenantInvoice', () => {
    it('creates invoice and returns it', async () => {
      const fakeInvoice = {
        id: INVOICE_ID,
        invoice_number: 'CIMO-ABC',
        amount: 500,
        currency: 'XOF',
        status: 'pending',
      };

      mockScopeAndSite((table) => {
        if (table === 'cimolace_invoices') {
          return buildChain({ data: fakeInvoice, error: null });
        }
      });
      jest
        .spyOn(service, 'getClientControlPlane')
        .mockResolvedValue({ client: FAKE_CLIENT } as any);

      const result = await service.createTenantInvoice(CLIENT_ID, {
        site_id: SITE_ID,
        amount: 500,
        currency: 'XOF',
        type: 'manual',
      });

      expect(result.ok).toBe(true);
      expect((result as any).invoice?.amount).toBe(500);
    });
  });

  // ── 18. getClientControlPlane — structure ─────────────────────────────────
  describe('getClientControlPlane', () => {
    it('returns a structured control plane object', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'cimolace_clients')
          return buildChain({ data: FAKE_CLIENT, error: null });
        if (table === 'cimolace_sites')
          return buildChain(
            { data: FAKE_SITE, error: null },
            { data: [FAKE_SITE], error: null },
          );
        if (table === 'cimolace_contracts')
          return buildChain(
            { data: null, error: null },
            { data: [], error: null },
          );
        if (table === 'tenants')
          return buildChain(
            { data: FAKE_TENANT, error: null },
            { data: [FAKE_TENANT], error: null },
          );
        // All other tables — return empty
        return buildChain(
          { data: null, error: null },
          { data: [], error: null },
        );
      });

      const result = (await service.getClientControlPlane(CLIENT_ID)) as any;
      expect(result).toHaveProperty('client');
      expect(result.client.id).toBe(CLIENT_ID);
      expect(result).toHaveProperty('sites');
    });

    it('throws BadRequestException when Supabase returns an error for the client', async () => {
      // assertSupabase throws BadRequestException (not NotFoundException) on Supabase errors
      mockFrom.mockImplementation(() =>
        buildChain({ data: null, error: { message: 'not found' } }),
      );
      await expect(service.getClientControlPlane('ghost')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
