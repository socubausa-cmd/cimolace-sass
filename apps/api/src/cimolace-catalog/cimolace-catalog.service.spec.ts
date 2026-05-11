import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  CimolaceCatalogService,
  ENGINE_CATALOG,
  INFRA_TEMPLATES,
} from './cimolace-catalog.service';
import type { UpdateTenantServiceDto } from './dto/update-tenant-service.dto';
import type { TenantContext } from '../tenant/tenant.types';

// ---------------------------------------------------------------------------
// Mock helpers — same pattern as checkout.service.spec.ts
// ---------------------------------------------------------------------------

type QueryResult = { data?: unknown; error?: { message: string } | null };

function chain(result?: QueryResult) {
  const final = result ?? { data: null, error: null };
  // The Supabase query builder is thenable — you can await it directly
  const query: Record<string, jest.Mock> & { then: jest.Mock } = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(final),
    maybeSingle: jest.fn().mockResolvedValue(final),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (v: unknown) => void) => resolve(final)),
  };
  return query;
}

function makeService(from: jest.Mock) {
  return new CimolaceCatalogService({
    client: { from },
  } as never);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ownerCtx: TenantContext = {
  id: 't1',
  name: 'Test',
  slug: 'test',
  plan: 'free',
  status: 'active',
  primary_domain: null,
  logo_url: null,
  brand_colors: null,
  userRole: 'owner',
};

const studentCtx: TenantContext = {
  ...ownerCtx,
  userRole: 'student',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CimolaceCatalogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Catalogue statique ---

  describe('getEngines', () => {
    it('retourne tous les moteurs du catalogue', () => {
      const engines = makeService(jest.fn()).getEngines();
      expect(engines).toBe(ENGINE_CATALOG);
      expect(engines.length).toBeGreaterThan(30);
      const keys = engines.map((e) => e.key);
      expect(keys).toContain('liri_brain');
      expect(keys).toContain('med_ehr');
      expect(keys).toContain('mbolo_catalog');
      expect(keys).toContain('pay_engine');
      expect(keys).toContain('calendar');
      expect(keys).toContain('notif_engine');
    });

    it('chaque moteur a key, label, description, category', () => {
      for (const e of makeService(jest.fn()).getEngines()) {
        expect(e.key).toBeTruthy();
        expect(e.label).toBeTruthy();
        expect(e.description).toBeTruthy();
        expect(e.category).toBeTruthy();
      }
    });
  });

  describe('getTemplates', () => {
    it('retourne tous les templates', () => {
      const templates = makeService(jest.fn()).getTemplates();
      expect(templates).toBe(INFRA_TEMPLATES);
      expect(templates.length).toBe(7);
      const types = templates.map((t) => t.type);
      expect(types).toContain('school');
      expect(types).toContain('medos');
      expect(types).toContain('mbolo');
      expect(types).toContain('wellness');
      expect(types).toContain('creator');
      expect(types).toContain('temple');
      expect(types).toContain('community');
    });

    it('chaque template a au moins un moteur', () => {
      for (const t of makeService(jest.fn()).getTemplates()) {
        expect(t.engines.length).toBeGreaterThan(0);
      }
    });
  });

  // --- Services tenant ---

  describe('getTenantServices', () => {
    it('retourne les services du tenant', async () => {
      const rows = [
        {
          id: 's1',
          tenant_id: 't1',
          service_key: 'calendar',
          active: true,
          settings: {},
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ];
      const svcQuery = chain({ data: rows, error: null });
      const from = jest.fn().mockReturnValue(svcQuery);

      const result = await makeService(from).getTenantServices('t1');
      expect(result).toEqual(rows);
      expect(from).toHaveBeenCalledWith('tenant_services');
    });
  });

  // --- Upsert service ---

  describe('upsertTenantService', () => {
    const dto: UpdateTenantServiceDto = {
      service_key: 'calendar',
      active: true,
    };

    it('owner peut activer un service', async () => {
      const row = {
        id: 's1',
        tenant_id: 't1',
        service_key: 'calendar',
        active: true,
        settings: {},
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };
      const svcQuery = chain({ data: row, error: null });
      const from = jest.fn().mockReturnValue(svcQuery);

      const result = await makeService(from).upsertTenantService(ownerCtx, dto);
      expect(result.service_key).toBe('calendar');
      expect(result.active).toBe(true);
      expect(from).toHaveBeenCalledWith('tenant_services');
    });

    it('student ne peut pas activer un service', async () => {
      await expect(
        makeService(jest.fn()).upsertTenantService(studentCtx, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejette un service_key inconnu', async () => {
      await expect(
        makeService(jest.fn()).upsertTenantService(ownerCtx, {
          service_key: 'nope_unknown',
          active: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- Apply template ---

  describe('applyTemplate', () => {
    it('apply-template school active tous les moteurs et retourne le bon compte', async () => {
      const tpl = INFRA_TEMPLATES.find((t) => t.type === 'school')!;

      // Services upsert (6 moteurs, tous OK)
      const svcChains = tpl.engines.map((key) =>
        chain({
          data: {
            id: `s-${key}`,
            tenant_id: 't1',
            service_key: key,
            active: true,
            settings: {},
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          error: null,
        }),
      );
      // Tenant update (après tous les services)
      const tenantChain = chain({ data: null, error: null });

      const from = jest.fn();
      for (const q of svcChains) from.mockReturnValueOnce(q);
      from.mockReturnValueOnce(tenantChain);

      const result = await makeService(from).applyTemplate(ownerCtx, 'school');
      expect(result.infrastructure_type).toBe('school');
      expect(result.services.length).toBe(tpl.engines.length);
      const keys = result.services.map((s) => s.service_key);
      for (const k of tpl.engines) {
        expect(keys).toContain(k);
      }
      // Vérifier que tenant update a bien été appelé (dernier appel from('tenants'))
      expect(from).toHaveBeenCalledWith('tenants');
    });

    it('apply-template medos active tous les moteurs', async () => {
      const tpl = INFRA_TEMPLATES.find((t) => t.type === 'medos')!;

      const svcChains = tpl.engines.map((key) =>
        chain({
          data: {
            id: `s-${key}`,
            tenant_id: 't1',
            service_key: key,
            active: true,
            settings: {},
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          error: null,
        }),
      );
      const tenantChain = chain({ data: null, error: null });

      const from = jest.fn();
      for (const q of svcChains) from.mockReturnValueOnce(q);
      from.mockReturnValueOnce(tenantChain);

      const result = await makeService(from).applyTemplate(ownerCtx, 'medos');
      expect(result.infrastructure_type).toBe('medos');
      expect(result.services.length).toBe(tpl.engines.length);
      const keys = result.services.map((s) => s.service_key);
      expect(keys).toContain('med_ehr');
      expect(keys).toContain('gdpr_engine');
    });

    it('apply-template mbolo active tous les moteurs', async () => {
      const tpl = INFRA_TEMPLATES.find((t) => t.type === 'mbolo')!;

      const svcChains = tpl.engines.map((key) =>
        chain({
          data: {
            id: `s-${key}`,
            tenant_id: 't1',
            service_key: key,
            active: true,
            settings: {},
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          error: null,
        }),
      );
      const tenantChain = chain({ data: null, error: null });

      const from = jest.fn();
      for (const q of svcChains) from.mockReturnValueOnce(q);
      from.mockReturnValueOnce(tenantChain);

      const result = await makeService(from).applyTemplate(ownerCtx, 'mbolo');
      expect(result.infrastructure_type).toBe('mbolo');
      expect(result.services.length).toBe(tpl.engines.length);
      const keys = result.services.map((s) => s.service_key);
      expect(keys).toContain('mbolo_catalog');
      expect(keys).toContain('cinetpay');
    });

    // --- Nouveaux tests Codex P1 ---

    it('ne met pas à jour infrastructure_type si un upsert service échoue', async () => {
      const tpl = INFRA_TEMPLATES.find((t) => t.type === 'school')!;

      const from = jest.fn();
      // Premier service OK
      from.mockReturnValueOnce(
        chain({
          data: {
            id: 's-ok',
            tenant_id: 't1',
            service_key: tpl.engines[0],
            active: true,
            settings: {},
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          error: null,
        }),
      );
      // Deuxième service ÉCHEC
      from.mockReturnValueOnce(
        chain({ data: null, error: { message: 'DB error' } }),
      );

      await expect(
        makeService(from).applyTemplate(ownerCtx, 'school'),
      ).rejects.toThrow(InternalServerErrorException);

      // tenants.update NE doit PAS avoir été appelé
      const tenantCalls = from.mock.calls.filter(
        (call: string[]) => call[0] === 'tenants',
      );
      expect(tenantCalls.length).toBe(0);
    });

    it('throw InternalServerErrorException si un upsert service échoue', async () => {
      const from = jest.fn().mockReturnValue(
        chain({ data: null, error: { message: 'DB error' } }),
      );

      await expect(
        makeService(from).applyTemplate(ownerCtx, 'school'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('retourne succès seulement quand tous les services sont upsertés (school = 6)', async () => {
      const tpl = INFRA_TEMPLATES.find((t) => t.type === 'school')!;

      const svcChains = tpl.engines.map((key) =>
        chain({
          data: {
            id: `s-${key}`,
            tenant_id: 't1',
            service_key: key,
            active: true,
            settings: {},
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          error: null,
        }),
      );
      const tenantChain = chain({ data: null, error: null });

      const from = jest.fn();
      for (const q of svcChains) from.mockReturnValueOnce(q);
      from.mockReturnValueOnce(tenantChain);

      const result = await makeService(from).applyTemplate(ownerCtx, 'school');
      expect(result.services.length).toBe(6);
      expect(result.infrastructure_type).toBe('school');
    });

    it('le nombre de services retournés correspond exactement au nombre de moteurs du template (mbolo = 11)', async () => {
      const tpl = INFRA_TEMPLATES.find((t) => t.type === 'mbolo')!;

      const svcChains = tpl.engines.map((key) =>
        chain({
          data: {
            id: `s-${key}`,
            tenant_id: 't1',
            service_key: key,
            active: true,
            settings: {},
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          error: null,
        }),
      );
      const tenantChain = chain({ data: null, error: null });

      const from = jest.fn();
      for (const q of svcChains) from.mockReturnValueOnce(q);
      from.mockReturnValueOnce(tenantChain);

      const result = await makeService(from).applyTemplate(ownerCtx, 'mbolo');
      expect(result.services.length).toBe(11);
      expect(result.infrastructure_type).toBe('mbolo');
    });

    it('student ne peut pas appliquer un template', async () => {
      await expect(
        makeService(jest.fn()).applyTemplate(studentCtx, 'school'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejette un template inconnu', async () => {
      await expect(
        makeService(jest.fn()).applyTemplate(ownerCtx, 'nonexistent' as never),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
