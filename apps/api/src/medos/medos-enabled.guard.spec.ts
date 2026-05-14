import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { MedosEnabledGuard } from './medos-enabled.guard';
import type { TenantContext } from '../tenant/tenant.types';

function makeCtx(tenant?: Partial<TenantContext>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ tenant }),
    }),
  } as unknown as ExecutionContext;
}

function chain(result: { data?: unknown; error?: { message: string } | null }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (v: unknown) => void) => resolve(result)),
  };
}

const baseTenant: TenantContext = {
  id: 'tenant-1',
  name: 'Clinic',
  slug: 'clinic',
  plan: 'free',
  status: 'active',
  primary_domain: null,
  logo_url: null,
  brand_colors: null,
  infrastructure_type: null,
  userRole: 'practitioner',
};

describe('MedosEnabledGuard', () => {
  it('autorise un tenant dont infrastructure_type est medos sans requête services', async () => {
    const from = jest.fn();
    const guard = new MedosEnabledGuard({
      client: { from },
    } as never);

    await expect(
      guard.canActivate(
        makeCtx({ ...baseTenant, infrastructure_type: 'medos' }),
      ),
    ).resolves.toBe(true);
    expect(from).not.toHaveBeenCalled();
  });

  it('autorise un tenant avec un moteur MedOS actif', async () => {
    const tenantServices = chain({
      data: [{ service_key: 'med_ehr', active: true }],
      error: null,
    });
    const from = jest.fn().mockReturnValue(tenantServices);
    const guard = new MedosEnabledGuard({
      client: { from },
    } as never);

    await expect(guard.canActivate(makeCtx(baseTenant))).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith('tenant_services');
    expect(tenantServices.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(tenantServices.eq).toHaveBeenCalledWith('active', true);
  });

  it('refuse un tenant sans infrastructure ni moteur MedOS actif', async () => {
    const from = jest.fn().mockReturnValue(
      chain({
        data: [{ service_key: 'liri_live', active: true }],
        error: null,
      }),
    );
    const guard = new MedosEnabledGuard({
      client: { from },
    } as never);

    await expect(guard.canActivate(makeCtx(baseTenant))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('refuse si le tenant est absent du contexte', async () => {
    const guard = new MedosEnabledGuard({
      client: { from: jest.fn() },
    } as never);

    await expect(guard.canActivate(makeCtx())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('remonte une erreur interne si la vérification des services échoue', async () => {
    const from = jest.fn().mockReturnValue(
      chain({
        data: null,
        error: { message: 'db down' },
      }),
    );
    const guard = new MedosEnabledGuard({
      client: { from },
    } as never);

    await expect(guard.canActivate(makeCtx(baseTenant))).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
