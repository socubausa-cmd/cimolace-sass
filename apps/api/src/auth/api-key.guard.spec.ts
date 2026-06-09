/**
 * ApiKeyGuard — tests unitaires
 *
 * Vérifie l'authentification server-to-server par clé API tenant.
 */

import {
  ExecutionContext,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { ApiKeyGuard } from './api-key.guard';

const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const KEY_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const RAW_KEY = 'mdk_zahirwellness_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6';
const KEY_HASH = createHash('sha256').update(RAW_KEY).digest('hex');

function buildCtx(authHeader?: string): { ctx: ExecutionContext; req: any } {
  const req: any = {
    headers: authHeader ? { authorization: authHeader } : {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

function makeSupabaseMock({
  apiKeyResult,
  tenantResult,
  subsResult,
}: {
  apiKeyResult: { data: any; error: any };
  tenantResult: { data: any; error: any };
  subsResult?: { data: any; error: any };
}) {
  const updateChain = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnValue(Promise.resolve({ data: null, error: null })),
    then: undefined as any,
  };
  // tenant_api_keys chain
  const apiKeysChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(apiKeyResult),
  };
  // tenants chain
  const tenantsChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(tenantResult),
  };
  // billing_subscriptions chain : .select().eq().order().limit() → Promise
  const subsChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(subsResult ?? { data: [], error: null }),
  };

  let call = 0;
  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'tenant_api_keys' && call === 0) {
      call++;
      return apiKeysChain;
    }
    if (table === 'tenants') return tenantsChain;
    if (table === 'billing_subscriptions') return subsChain;
    if (table === 'tenant_api_keys') return updateChain; // last_used_at update
    return apiKeysChain;
  });

  return { client: { from } };
}

const VALID_API_KEY = {
  id: KEY_ID,
  tenant_id: TENANT_ID,
  revoked_at: null,
  label: 'Zahir prod',
};

/** Tenant soumis au gating d'abonnement (opt-in via metadata.billing.api_gating). */
const GATED_TENANT = {
  id: TENANT_ID,
  slug: 'zahirwellness',
  name: 'Zahir Wellness',
  plan: 'start',
  status: 'active',
  metadata: { billing: { api_gating: true } },
};

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}
const DAY = 24 * 60 * 60 * 1000;

describe('ApiKeyGuard', () => {
  it('refuse une requête sans header Authorization', async () => {
    const guard = new ApiKeyGuard({} as any);
    const { ctx } = buildCtx();
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuse un header Authorization sans préfixe Bearer', async () => {
    const guard = new ApiKeyGuard({} as any);
    const { ctx } = buildCtx('mdk_x_y');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuse un préfixe de clé inconnu (ni cml_ ni mdk_)', async () => {
    const guard = new ApiKeyGuard({} as any);
    const { ctx } = buildCtx('Bearer xxx_zahir_abc');
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      message: expect.stringContaining('Format de clé API invalide'),
    });
  });

  it('refuse une clé inconnue (hash absent en DB)', async () => {
    const supa = makeSupabaseMock({
      apiKeyResult: { data: null, error: null },
      tenantResult: { data: null, error: null },
    });
    const guard = new ApiKeyGuard(supa as any);
    const { ctx } = buildCtx(`Bearer ${RAW_KEY}`);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      message: 'Clé API inconnue',
    });
  });

  it('refuse une clé révoquée', async () => {
    const supa = makeSupabaseMock({
      apiKeyResult: {
        data: {
          id: KEY_ID,
          tenant_id: TENANT_ID,
          revoked_at: '2026-01-01T00:00:00Z',
          label: 'Zahir prod',
        },
        error: null,
      },
      tenantResult: { data: null, error: null },
    });
    const guard = new ApiKeyGuard(supa as any);
    const { ctx } = buildCtx(`Bearer ${RAW_KEY}`);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      message: 'Clé API révoquée',
    });
  });

  it('autorise une clé valide et peuple req.tenant + req.apiKeyId', async () => {
    const tenantRow = {
      id: TENANT_ID,
      slug: 'zahirwellness',
      name: 'Zahir Wellness',
      plan: 'medos',
      status: 'active',
    };
    const supa = makeSupabaseMock({
      apiKeyResult: {
        data: {
          id: KEY_ID,
          tenant_id: TENANT_ID,
          revoked_at: null,
          label: 'Zahir prod',
        },
        error: null,
      },
      tenantResult: { data: tenantRow, error: null },
    });
    const guard = new ApiKeyGuard(supa as any);
    const { ctx, req } = buildCtx(`Bearer ${RAW_KEY}`);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.tenant).toMatchObject({
      id: TENANT_ID,
      slug: 'zahirwellness',
      userRole: 'clinic_admin',
    });
    expect(req.apiKeyId).toBe(KEY_ID);
    expect(req.authViaApiKey).toBe(true);
    // Vérifie que la query a bien utilisé le hash, pas la clé brute
    expect(supa.client.from).toHaveBeenCalledWith('tenant_api_keys');
  });

  it('refuse si le tenant lié à la clé est introuvable', async () => {
    const supa = makeSupabaseMock({
      apiKeyResult: {
        data: { id: KEY_ID, tenant_id: TENANT_ID, revoked_at: null, label: 'k' },
        error: null,
      },
      tenantResult: { data: null, error: { message: 'not found' } },
    });
    const guard = new ApiKeyGuard(supa as any);
    const { ctx } = buildCtx(`Bearer ${RAW_KEY}`);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      message: 'Tenant lié à la clé introuvable',
    });
  });

  // ─── Gating abonnement plateforme (opt-in metadata.billing.api_gating) ──────

  it('gating OFF (pas de flag) : ne consulte pas billing_subscriptions', async () => {
    const supa = makeSupabaseMock({
      apiKeyResult: { data: VALID_API_KEY, error: null },
      tenantResult: { data: { ...GATED_TENANT, metadata: {} }, error: null },
    });
    const guard = new ApiKeyGuard(supa as any);
    const { ctx } = buildCtx(`Bearer ${RAW_KEY}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(supa.client.from).not.toHaveBeenCalledWith('billing_subscriptions');
  });

  it('gating ON + abonnement actif (période future) : autorise', async () => {
    const supa = makeSupabaseMock({
      apiKeyResult: { data: VALID_API_KEY, error: null },
      tenantResult: { data: GATED_TENANT, error: null },
      subsResult: {
        data: [{ status: 'active', current_period_end: iso(20 * DAY) }],
        error: null,
      },
    });
    const guard = new ApiKeyGuard(supa as any);
    const { ctx } = buildCtx(`Bearer ${RAW_KEY}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(supa.client.from).toHaveBeenCalledWith('billing_subscriptions');
  });

  it('gating ON + aucun abonnement : rejette en 402', async () => {
    const supa = makeSupabaseMock({
      apiKeyResult: { data: VALID_API_KEY, error: null },
      tenantResult: { data: GATED_TENANT, error: null },
      subsResult: { data: [], error: null },
    });
    const guard = new ApiKeyGuard(supa as any);
    const { ctx } = buildCtx(`Bearer ${RAW_KEY}`);
    let thrown: any;
    try {
      await guard.canActivate(ctx);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(HttpException);
    expect(thrown.getStatus()).toBe(402);
    expect(thrown.getResponse()).toMatchObject({ code: 'subscription_inactive' });
  });

  it('gating ON + abonnement actif mais période expirée : rejette en 402', async () => {
    const supa = makeSupabaseMock({
      apiKeyResult: { data: VALID_API_KEY, error: null },
      tenantResult: { data: GATED_TENANT, error: null },
      subsResult: {
        data: [{ status: 'active', current_period_end: iso(-2 * DAY) }],
        error: null,
      },
    });
    const guard = new ApiKeyGuard(supa as any);
    const { ctx } = buildCtx(`Bearer ${RAW_KEY}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });

  it('gating ON + past_due dans la fenêtre de grâce (7j) : autorise', async () => {
    const supa = makeSupabaseMock({
      apiKeyResult: { data: VALID_API_KEY, error: null },
      tenantResult: { data: GATED_TENANT, error: null },
      subsResult: {
        data: [{ status: 'past_due', current_period_end: iso(-2 * DAY) }],
        error: null,
      },
    });
    const guard = new ApiKeyGuard(supa as any);
    const { ctx } = buildCtx(`Bearer ${RAW_KEY}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('gating ON + past_due hors grâce (>7j) : rejette en 402', async () => {
    const supa = makeSupabaseMock({
      apiKeyResult: { data: VALID_API_KEY, error: null },
      tenantResult: { data: GATED_TENANT, error: null },
      subsResult: {
        data: [{ status: 'past_due', current_period_end: iso(-10 * DAY) }],
        error: null,
      },
    });
    const guard = new ApiKeyGuard(supa as any);
    const { ctx } = buildCtx(`Bearer ${RAW_KEY}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });

  it('gating ON + erreur de lecture billing : fail-open (autorise)', async () => {
    const supa = makeSupabaseMock({
      apiKeyResult: { data: VALID_API_KEY, error: null },
      tenantResult: { data: GATED_TENANT, error: null },
      subsResult: { data: null, error: { message: 'db timeout' } },
    });
    const guard = new ApiKeyGuard(supa as any);
    const { ctx } = buildCtx(`Bearer ${RAW_KEY}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('confirme que le hash SHA-256 est calculé correctement', () => {
    expect(KEY_HASH).toHaveLength(64);
    expect(KEY_HASH).toMatch(/^[0-9a-f]+$/);
  });
});
