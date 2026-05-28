/**
 * MedAuditInterceptor — tests unitaires
 *
 * Vérifie que l'intercepteur :
 *  - écrit dans med_audit_log quand @AuditResource() est présent
 *  - passe sans rien faire quand le décorateur est absent
 *  - extrait resource_id depuis params.id si idParam configuré
 *  - extrait resource_id depuis la réponse pour les POST de création
 *  - log NULL pour les list endpoints
 *  - ne bloque pas la requête si l'écriture en DB échoue
 */

import { Reflector } from '@nestjs/core';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { MedAuditInterceptor } from './med-audit.interceptor';
import {
  AUDIT_RESOURCE_KEY,
  AuditResourceConfig,
} from './decorators/audit-resource.decorator';

describe('MedAuditInterceptor', () => {
  let interceptor: MedAuditInterceptor;
  let reflector: Reflector;
  let supabaseInsertSpy: jest.Mock;
  let supabaseMock: { client: { from: jest.Mock } };

  const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
  const ACTOR_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
  const PATIENT_ID = 'cccccccc-0000-0000-0000-000000000001';

  function buildCtx({
    method,
    params,
    body,
    url,
    auditConfig,
    tenant = { id: TENANT_ID },
    user = { id: ACTOR_ID },
  }: {
    method: string;
    params?: Record<string, string>;
    body?: Record<string, unknown>;
    url?: string;
    auditConfig: AuditResourceConfig | null;
    tenant?: { id: string } | null;
    user?: { id: string } | null;
  }): { ctx: ExecutionContext; handle: jest.Mock } {
    const req = {
      method,
      url: url ?? '/med/patients',
      params: params ?? {},
      body: body ?? {},
      headers: { 'user-agent': 'jest-test', 'x-forwarded-for': '203.0.113.5' },
      socket: { remoteAddress: '127.0.0.1' },
      user,
      tenant,
    };

    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => () => null,
      getClass: () => class FakeController {},
    } as unknown as ExecutionContext;

    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) =>
        key === AUDIT_RESOURCE_KEY ? auditConfig : undefined,
      );

    const handle = jest.fn();
    return { ctx, handle };
  }

  function captureInsertedRow(): unknown {
    return supabaseInsertSpy.mock.calls[0]?.[0];
  }

  beforeEach(() => {
    reflector = new Reflector();

    supabaseInsertSpy = jest.fn().mockResolvedValue({ error: null });
    supabaseMock = {
      client: {
        from: jest.fn().mockReturnValue({ insert: supabaseInsertSpy }),
      },
    };

    interceptor = new MedAuditInterceptor(reflector, supabaseMock as any);
  });

  it('passe sans rien faire quand @AuditResource est absent', async () => {
    const { ctx, handle } = buildCtx({ method: 'GET', auditConfig: null });
    handle.mockReturnValue(of({ data: 'ok' }));
    const callHandler: CallHandler = { handle };

    const result = await firstValueFrom(interceptor.intercept(ctx, callHandler));

    expect(result).toEqual({ data: 'ok' });
    expect(supabaseMock.client.from).not.toHaveBeenCalled();
  });

  it('écrit dans med_audit_log pour un GET avec idParam', async () => {
    const { ctx, handle } = buildCtx({
      method: 'GET',
      params: { id: PATIENT_ID },
      url: `/med/patients/${PATIENT_ID}`,
      auditConfig: { resource: 'patient', action: 'read', idParam: 'id' },
    });
    handle.mockReturnValue(of({ id: PATIENT_ID, first_name: 'Alice' }));

    await firstValueFrom(interceptor.intercept(ctx, { handle }));
    // L'écriture est fire-and-forget — laisser un tick passer
    await new Promise((r) => setImmediate(r));

    expect(supabaseMock.client.from).toHaveBeenCalledWith('med_audit_log');
    const inserted = captureInsertedRow() as Record<string, unknown>;
    expect(inserted).toMatchObject({
      tenant_id: TENANT_ID,
      actor_id: ACTOR_ID,
      resource: 'patient',
      resource_id: PATIENT_ID,
      action: 'read',
      ip_address: '203.0.113.5',
      user_agent: 'jest-test',
    });
  });

  it('extrait resource_id depuis la réponse pour les POST', async () => {
    const { ctx, handle } = buildCtx({
      method: 'POST',
      auditConfig: { resource: 'patient', action: 'create' },
    });
    handle.mockReturnValue(of({ id: PATIENT_ID, first_name: 'Alice' }));

    await firstValueFrom(interceptor.intercept(ctx, { handle }));
    await new Promise((r) => setImmediate(r));

    const inserted = captureInsertedRow() as Record<string, unknown>;
    expect(inserted.resource_id).toBe(PATIENT_ID);
    expect(inserted.action).toBe('create');
  });

  it('extrait resource_id depuis la réponse wrappée { data }', async () => {
    const { ctx, handle } = buildCtx({
      method: 'POST',
      auditConfig: { resource: 'note', action: 'create' },
    });
    handle.mockReturnValue(
      of({ data: { id: 'dddddddd-0000-0000-0000-000000000001' } }),
    );

    await firstValueFrom(interceptor.intercept(ctx, { handle }));
    await new Promise((r) => setImmediate(r));

    const inserted = captureInsertedRow() as Record<string, unknown>;
    expect(inserted.resource_id).toBe('dddddddd-0000-0000-0000-000000000001');
  });

  it('log resource_id NULL pour list endpoint sans param', async () => {
    const { ctx, handle } = buildCtx({
      method: 'GET',
      auditConfig: { resource: 'patient', action: 'list' },
    });
    handle.mockReturnValue(of([{ id: 'a' }, { id: 'b' }]));

    await firstValueFrom(interceptor.intercept(ctx, { handle }));
    await new Promise((r) => setImmediate(r));

    const inserted = captureInsertedRow() as Record<string, unknown>;
    expect(inserted.resource_id).toBeNull();
    expect(inserted.action).toBe('list');
  });

  it('utilise le verbe HTTP pour déduire action quand non spécifié', async () => {
    const { ctx, handle } = buildCtx({
      method: 'PATCH',
      params: { id: PATIENT_ID },
      auditConfig: { resource: 'patient', idParam: 'id' },
    });
    handle.mockReturnValue(of({ id: PATIENT_ID }));

    await firstValueFrom(interceptor.intercept(ctx, { handle }));
    await new Promise((r) => setImmediate(r));

    const inserted = captureInsertedRow() as Record<string, unknown>;
    expect(inserted.action).toBe('update');
  });

  it('ne casse pas la requête si l’écriture med_audit_log échoue', async () => {
    supabaseInsertSpy.mockRejectedValueOnce(new Error('DB down'));

    const { ctx, handle } = buildCtx({
      method: 'GET',
      params: { id: PATIENT_ID },
      auditConfig: { resource: 'patient', action: 'read', idParam: 'id' },
    });
    handle.mockReturnValue(of({ id: PATIENT_ID }));

    const result = await firstValueFrom(interceptor.intercept(ctx, { handle }));
    await new Promise((r) => setImmediate(r));

    // La réponse métier doit être inchangée
    expect(result).toEqual({ id: PATIENT_ID });
  });

  it('rejette silencieusement quand tenant ou user manque (sécurité)', async () => {
    const { ctx, handle } = buildCtx({
      method: 'GET',
      params: { id: PATIENT_ID },
      auditConfig: { resource: 'patient', action: 'read', idParam: 'id' },
      tenant: null,
      user: null,
    });
    handle.mockReturnValue(of({ id: PATIENT_ID }));

    await firstValueFrom(interceptor.intercept(ctx, { handle }));
    await new Promise((r) => setImmediate(r));

    expect(supabaseMock.client.from).not.toHaveBeenCalled();
  });
});
