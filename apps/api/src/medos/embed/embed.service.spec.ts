/**
 * EmbedService — tests unitaires
 *
 * Vérifie l'émission de JWT embed-token avec Origin whitelisté.
 */

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EmbedService } from './embed.service';

const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_SLUG = 'zahirwellness';

function makeSupabaseMock({
  tenant,
  domains,
}: {
  tenant: { data: any; error: any };
  domains: { data: any; error: any };
}) {
  const tenantsChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(tenant),
  };
  const domainsChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  };
  // Last eq() resolves with the domains result (chain mock)
  const domainsTerminal = jest.fn().mockResolvedValue(domains);
  let eqCalls = 0;
  domainsChain.eq = jest.fn().mockImplementation(() => {
    eqCalls++;
    if (eqCalls >= 3) return domainsTerminal();
    return domainsChain;
  });

  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'tenants') return tenantsChain;
    if (table === 'tenant_domains') return domainsChain;
    return tenantsChain;
  });

  return { client: { from } };
}

function makeConfigMock(secret = 'test-secret') {
  return {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'MEDOS_EMBED_JWT_SECRET') return secret;
      if (key === 'MEDOS_API_BASE') return 'https://api.cimolace.com';
      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('EmbedService.issueEmbedToken', () => {
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = new JwtService({ secret: 'test-secret' });
  });

  it('refuse un mode invalide', async () => {
    const supa = makeSupabaseMock({
      tenant: { data: null, error: null },
      domains: { data: [], error: null },
    });
    const service = new EmbedService(supa as any, jwtService, makeConfigMock());

    await expect(
      service.issueEmbedToken({
        tenantSlug: TENANT_SLUG,
        mode: 'invalid-mode',
        origin: 'https://zahirwellness.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse l\'absence de header Origin', async () => {
    const supa = makeSupabaseMock({
      tenant: { data: null, error: null },
      domains: { data: [], error: null },
    });
    const service = new EmbedService(supa as any, jwtService, makeConfigMock());

    await expect(
      service.issueEmbedToken({
        tenantSlug: TENANT_SLUG,
        mode: 'patient-portal',
        origin: undefined,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse un tenant inexistant', async () => {
    const supa = makeSupabaseMock({
      tenant: { data: null, error: null },
      domains: { data: [], error: null },
    });
    const service = new EmbedService(supa as any, jwtService, makeConfigMock());

    await expect(
      service.issueEmbedToken({
        tenantSlug: 'inconnu',
        mode: 'patient-portal',
        origin: 'https://zahirwellness.com',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuse un tenant inactif', async () => {
    const supa = makeSupabaseMock({
      tenant: {
        data: { id: TENANT_ID, slug: TENANT_SLUG, status: 'paused' },
        error: null,
      },
      domains: { data: [], error: null },
    });
    const service = new EmbedService(supa as any, jwtService, makeConfigMock());

    await expect(
      service.issueEmbedToken({
        tenantSlug: TENANT_SLUG,
        mode: 'patient-portal',
        origin: 'https://zahirwellness.com',
      }),
    ).rejects.toMatchObject({ message: 'Tenant inactif' });
  });

  it('refuse un Origin non whitelisté pour le tenant', async () => {
    const supa = makeSupabaseMock({
      tenant: {
        data: { id: TENANT_ID, slug: TENANT_SLUG, status: 'active' },
        error: null,
      },
      domains: {
        data: [{ domain: 'autresite.com', usage: 'embed_origin', status: 'active' }],
        error: null,
      },
    });
    const service = new EmbedService(supa as any, jwtService, makeConfigMock());

    await expect(
      service.issueEmbedToken({
        tenantSlug: TENANT_SLUG,
        mode: 'patient-portal',
        origin: 'https://attacker.com',
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('non autorisé'),
    });
  });

  it('émet un JWT valide avec scope pour un Origin whitelisté', async () => {
    const supa = makeSupabaseMock({
      tenant: {
        data: { id: TENANT_ID, slug: TENANT_SLUG, status: 'active' },
        error: null,
      },
      domains: {
        data: [{ domain: 'zahirwellness.com', usage: 'embed_origin', status: 'active' }],
        error: null,
      },
    });
    const service = new EmbedService(supa as any, jwtService, makeConfigMock());

    const result = await service.issueEmbedToken({
      tenantSlug: TENANT_SLUG,
      mode: 'patient-portal',
      origin: 'https://zahirwellness.com',
    });

    expect(result.token).toBeTruthy();
    expect(result.expires_in).toBe(900);
    expect(result.mode).toBe('patient-portal');
    expect(result.scope).toContain('med:notes:read');
    expect(result.scope).toContain('med:health:write');

    // Décoder le JWT et vérifier le payload
    const decoded: any = jwtService.verify(result.token, { secret: 'test-secret' });
    expect(decoded.tenant_id).toBe(TENANT_ID);
    expect(decoded.mode).toBe('patient-portal');
    expect(decoded.iss).toBe('cimolace-medos-embed');
    expect(decoded.origin).toBe('https://zahirwellness.com');
  });

  it('échoue si MEDOS_EMBED_JWT_SECRET est absent', async () => {
    const supa = makeSupabaseMock({
      tenant: {
        data: { id: TENANT_ID, slug: TENANT_SLUG, status: 'active' },
        error: null,
      },
      domains: {
        data: [{ domain: 'zahirwellness.com', usage: 'embed_origin', status: 'active' }],
        error: null,
      },
    });

    const noSecretConfig = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    const service = new EmbedService(supa as any, jwtService, noSecretConfig);

    await expect(
      service.issueEmbedToken({
        tenantSlug: TENANT_SLUG,
        mode: 'patient-portal',
        origin: 'https://zahirwellness.com',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('matche un Origin avec port différent en comparant le host', async () => {
    const supa = makeSupabaseMock({
      tenant: {
        data: { id: TENANT_ID, slug: TENANT_SLUG, status: 'active' },
        error: null,
      },
      domains: {
        data: [
          { domain: 'localhost:3000', usage: 'embed_origin', status: 'active' },
        ],
        error: null,
      },
    });
    const service = new EmbedService(supa as any, jwtService, makeConfigMock());

    const result = await service.issueEmbedToken({
      tenantSlug: TENANT_SLUG,
      mode: 'consent-form',
      origin: 'http://localhost:3000',
    });

    expect(result.token).toBeTruthy();
    expect(result.scope).toContain('med:forms:submit');
  });
});
