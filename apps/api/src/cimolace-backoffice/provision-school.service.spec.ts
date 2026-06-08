/**
 * Tests unitaires — provisionSchoolFromTemplate & previewProvisionSchool
 *
 * Scénarios couverts :
 *  1. previewProvisionSchool → plan complet, slug dispo, owner connu
 *  2. previewProvisionSchool → warnings si slug pris + owner inconnu
 *  3. provisionSchoolFromTemplate → happy path (owner existant)
 *  4. provisionSchoolFromTemplate → happy path (invitation email)
 *  5. provisionSchoolFromTemplate → ConflictException si slug déjà pris
 *  6. provisionSchoolFromTemplate → InternalServerErrorException si tenant insert échoue
 *  7. provisionSchoolFromTemplate → InternalServerErrorException si client insert échoue
 *  8. provisionSchoolFromTemplate → InternalServerErrorException si site insert échoue
 *  9. provisionSchoolFromTemplate → InternalServerErrorException si moteur échoue
 * 10. previewProvisionSchool → 11 moteurs recommandés dans le plan
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CimolaceBackofficeService } from './cimolace-backoffice.service';
import { SupabaseService } from '../supabase/supabase.service';

// ─── Mocks globaux ─────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockConfig = {
  get: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = {
      SUPABASE_URL: 'https://fwfupxvmwtxbtbjdeqvu.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-test',
    };
    return map[key] ?? undefined;
  }),
};

/**
 * Fabrique une chaîne Supabase fluide.
 * singleResult : valeur retournée par .single() et .maybeSingle()
 * listResult   : valeur retournée par .order() et la requête en mode liste
 */
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
    'or',
    'limit',
  ];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue(singleResult);
  chain.maybeSingle = jest.fn().mockResolvedValue(singleResult);
  chain.order = jest
    .fn()
    .mockResolvedValue(listResult ?? { data: [], error: null });
  return chain;
}

const mockSupabase = {
  client: { from: jest.fn(), auth: { admin: { listUsers: jest.fn() } } },
};

// ─── Fixtures ──────────────────────────────────────────────────────────────

const OWNER_EMAIL = 'admin@ecole-fatima.org';
const OWNER_USER_ID = 'aaaaaaaa-1111-1111-1111-000000000001';

const NEW_TENANT = {
  id: 'tttttttt-0000-0000-0000-000000000001',
  name: 'École Fatima',
  slug: 'ecole-fatima',
  plan: 'school',
  status: 'active',
  infrastructure_type: 'school',
  primary_domain: 'ecolefatima.org',
  logo_url: '/logos/isna-logo.png',
  brand_colors: { primary: '#0b1115', secondary: '#162331', accent: '#d4af37' },
};

const NEW_CLIENT = {
  id: 'cccccccc-0000-0000-0000-000000000001',
  name: 'École Fatima',
  email: OWNER_EMAIL,
  plan: 'school',
  status: 'active',
  client_type: 'school',
};

const NEW_SITE = {
  id: 'ssssssss-0000-0000-0000-000000000001',
  client_id: NEW_CLIENT.id,
  app_tenant_id: NEW_TENANT.id,
  name: 'École Fatima',
  domain: 'ecolefatima.org',
  plan: 'school',
  status: 'active',
};

const NEW_BILLING_PROFILE = {
  id: 'billing-profile-1',
  site_id: NEW_SITE.id,
  client_id: NEW_CLIENT.id,
  plan_key: 'school',
  amount: 0,
  currency: 'XOF',
};

const NEW_SUBSCRIPTION = {
  id: 'subscription-1',
  site_id: NEW_SITE.id,
  client_id: NEW_CLIENT.id,
  plan: 'school',
  status: 'active',
  amount: 0,
  currency: 'XOF',
};

const NEW_INVOICE = {
  id: 'invoice-1',
  site_id: NEW_SITE.id,
  billing_profile_id: NEW_BILLING_PROFILE.id,
  status: 'paid',
  amount: 0,
  currency: 'XOF',
};

const PROVISION_DTO = {
  name: 'École Fatima',
  slug: 'ecole-fatima',
  owner_email: OWNER_EMAIL,
  domain: 'ecolefatima.org',
  plan: 'school' as const,
  reason: 'Test provisioning',
};

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('CimolaceBackofficeService — provisionSchoolFromTemplate', () => {
  let service: CimolaceBackofficeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CimolaceBackofficeService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<CimolaceBackofficeService>(CimolaceBackofficeService);
  });

  // ── previewProvisionSchool ────────────────────────────────────────────────

  describe('previewProvisionSchool', () => {
    it('1. retourne un plan complet quand slug dispo et owner connu', async () => {
      // slug check → pas de doublon
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: null, error: null }),
      );
      // fetch Supabase Auth → owner connu
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: OWNER_USER_ID, email: OWNER_EMAIL }],
      });

      const result = await service.previewProvisionSchool(PROVISION_DTO);

      expect(result.preview).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.plan.tenant).toMatchObject({
        slug: 'ecole-fatima',
        slugAvailable: true,
        infrastructure_type: 'school',
      });
      expect(result.plan.owner).toMatchObject({
        accountExists: true,
        method: 'direct_link',
      });
      expect((result.plan.engines as any).totalToActivate).toBe(11);
    });

    it('2. retourne des warnings si slug pris et owner inconnu', async () => {
      // slug check → doublon
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: { id: 'existing-tenant' }, error: null }),
      );
      // fetch Supabase Auth → owner inconnu
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await service.previewProvisionSchool(PROVISION_DTO);

      expect(result.plan.tenant).toMatchObject({ slugAvailable: false });
      expect(result.warnings.some((w) => w.includes('déjà pris'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('invitation'))).toBe(true);
      expect(result.plan.owner).toMatchObject({
        accountExists: false,
        method: 'email_invitation',
      });
    });

    it('10. le plan contient exactement 11 moteurs recommandés', async () => {
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: null, error: null }),
      );
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

      const result = await service.previewProvisionSchool(PROVISION_DTO);
      const engines = result.plan.engines as any;
      expect(engines.recommended).toHaveLength(11);
      expect(engines.base).toHaveLength(6);
    });
  });

  // ── provisionSchoolFromTemplate ───────────────────────────────────────────

  describe('provisionSchoolFromTemplate', () => {
    /**
     * Configure les mocks pour un provisioning complet.
     * @param ownerFound - si true, Supabase Auth retourne le user owner
     */
    function setupHappyPath(ownerFound = true) {
      // 1. Slug check → slug libre
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: null, error: null }),
      );
      // 2. Tenant insert
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: NEW_TENANT, error: null }),
      );
      // 3a. Membership upsert (si owner trouvé) ou invitation insert
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: { id: 'membership-1' }, error: null }),
      );
      // 3b. Email queue insert si owner inconnu
      if (!ownerFound) {
        mockSupabase.client.from.mockReturnValueOnce(
          buildChain({ data: { id: 'email-1' }, error: null }),
        );
      }
      // 4. Client insert
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: NEW_CLIENT, error: null }),
      );
      // 5. Site insert
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: NEW_SITE, error: null }),
      );
      // 6-16. 11 moteurs (cimolace_services upsert × 11)
      for (let i = 0; i < 11; i++) {
        mockSupabase.client.from.mockReturnValueOnce(
          buildChain({
            data: { id: `svc-${i}`, service_key: `engine-${i}` },
            error: null,
          }),
        );
      }
      // 17-27. 11 tenant_services upsert (pas de single — ne retourne rien de critique)
      for (let i = 0; i < 11; i++) {
        mockSupabase.client.from.mockReturnValueOnce(
          buildChain({ data: null, error: null }),
        );
      }
      // 28. cimolace_billing_profiles insert
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: NEW_BILLING_PROFILE, error: null }),
      );
      // 29. cimolace_subscriptions insert
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: NEW_SUBSCRIPTION, error: null }),
      );
      // 30. cimolace_invoices insert
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: NEW_INVOICE, error: null }),
      );
      // 31. cimolace_school_provisionings insert
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: { id: 'prov-1' }, error: null }),
      );
      // 32. cimolace_change_history insert (logChange)
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: null, error: null }),
      );

      // Fetch Auth (résolution owner)
      if (ownerFound) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: OWNER_USER_ID, email: OWNER_EMAIL }],
        });
      } else {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });
      }
    }

    /** Spy getClientControlPlane pour éviter de mocker toutes ses requêtes DB */
    function spyControlPlane() {
      jest
        .spyOn(service as any, 'getClientControlPlane')
        .mockResolvedValueOnce({
          client: NEW_CLIENT,
          sites: [NEW_SITE],
          tenants: { app: [NEW_TENANT], cimolace: [] },
          services: [],
          contracts: [],
          usageLogs: [],
          credentials: [],
          configurationSteps: [],
          billingProfiles: [],
          subscriptions: [],
          payments: [],
          invoices: [],
          appBilling: { subscriptions: [], invoices: [] },
          tickets: [],
          deployments: [],
          changeHistory: [],
          warnings: [],
          summary: {
            siteCount: 1,
            activeSiteCount: 1,
            engineCount: 11,
            activeEngineCount: 11,
            credentialCount: 0,
            activeSubscriptionCount: 0,
            unpaidInvoiceCount: 0,
            openTicketCount: 0,
            lastDeployment: null,
            maintenance: false,
          },
          schoolModel: null,
        });
    }

    it('3. happy path owner existant → ok: true, tenant + client + site + 11 moteurs', async () => {
      setupHappyPath(true);
      spyControlPlane();
      const result = await service.provisionSchoolFromTemplate(PROVISION_DTO);

      expect(result.ok).toBe(true);
      expect(result.tenant.slug).toBe('ecole-fatima');
      expect(result.tenant.infrastructure_type).toBe('school');
      expect(result.client.client_type).toBe('school');
      expect(result.site.domain).toBe('ecolefatima.org');
      expect(result.services).toHaveLength(11);
      expect(result.owner.method).toBe('direct_link');
      expect(result.owner.email).toBe(OWNER_EMAIL);
      expect(result.provisioning).toMatchObject({ id: 'prov-1' });
    });

    it('4. happy path owner inconnu → invitation email créée', async () => {
      setupHappyPath(false);
      spyControlPlane();
      const result = await service.provisionSchoolFromTemplate(PROVISION_DTO);

      expect(result.ok).toBe(true);
      expect(result.owner.method).toBe('email_invitation');
      expect(result.owner.userId).toBeUndefined();
    });

    it('5. ConflictException si slug déjà pris', async () => {
      // Slug check → doublon trouvé
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: { id: 'existing-tenant' }, error: null }),
      );

      await expect(
        service.provisionSchoolFromTemplate(PROVISION_DTO),
      ).rejects.toThrow(ConflictException);
    });

    it('6. InternalServerErrorException si tenant insert échoue', async () => {
      // Slug dispo
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: null, error: null }),
      );
      // Fetch Auth (résolution owner avant insert)
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
      // Tenant insert → erreur
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({
          data: null,
          error: {
            message: 'duplicate key value violates unique constraint',
            code: '23505',
          },
        }),
      );

      await expect(
        service.provisionSchoolFromTemplate(PROVISION_DTO),
      ).rejects.toThrow(ConflictException);
    });

    it('7. InternalServerErrorException si client insert échoue', async () => {
      // Slug dispo
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: null, error: null }),
      );
      // Tenant insert → OK
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: NEW_TENANT, error: null }),
      );
      // Membership OK
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: null, error: null }),
      );
      // Email queue OK (owner inconnu)
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: { id: 'email-1' }, error: null }),
      );
      // Client insert → erreur
      mockSupabase.client.from.mockReturnValueOnce(
        buildChain({ data: null, error: { message: 'client insert failed' } }),
      );
      // Fetch Auth
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

      await expect(
        service.provisionSchoolFromTemplate(PROVISION_DTO),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('8. InternalServerErrorException si site insert échoue', async () => {
      mockSupabase.client.from
        .mockReturnValueOnce(buildChain({ data: null, error: null })) // slug
        .mockReturnValueOnce(buildChain({ data: NEW_TENANT, error: null })) // tenant
        .mockReturnValueOnce(buildChain({ data: null, error: null })) // membership
        .mockReturnValueOnce(buildChain({ data: { id: 'email-1' }, error: null })) // email queue
        .mockReturnValueOnce(buildChain({ data: NEW_CLIENT, error: null })) // client
        .mockReturnValueOnce(
          buildChain({ data: null, error: { message: 'site insert failed' } }),
        ); // site
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

      await expect(
        service.provisionSchoolFromTemplate(PROVISION_DTO),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('9. InternalServerErrorException si un moteur échoue', async () => {
      mockSupabase.client.from
        .mockReturnValueOnce(buildChain({ data: null, error: null })) // slug
        .mockReturnValueOnce(buildChain({ data: NEW_TENANT, error: null })) // tenant
        .mockReturnValueOnce(buildChain({ data: null, error: null })) // membership
        .mockReturnValueOnce(buildChain({ data: { id: 'email-1' }, error: null })) // email queue
        .mockReturnValueOnce(buildChain({ data: NEW_CLIENT, error: null })) // client
        .mockReturnValueOnce(buildChain({ data: NEW_SITE, error: null })); // site

      // Premier moteur OK, deuxième échoue
      mockSupabase.client.from
        .mockReturnValueOnce(buildChain({ data: { id: 'svc-0' }, error: null }))
        .mockReturnValueOnce(
          buildChain({
            data: null,
            error: { message: 'engine upsert failed' },
          }),
        );

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

      await expect(
        service.provisionSchoolFromTemplate(PROVISION_DTO),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
