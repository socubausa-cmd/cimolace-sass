/**
 * Tests unitaires — SecretariatService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SecretariatService } from './secretariat.service';
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
  chain.then = jest
    .fn()
    .mockImplementation((cb: (v: unknown) => unknown) =>
      Promise.resolve(cb({ data: [], error: null })),
    );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };
const TENANT_ID = 'tenant-0001';
const USER_ID = 'user-0001';

describe('SecretariatService', () => {
  let service: SecretariatService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecretariatService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();
    service = module.get<SecretariatService>(SecretariatService);
  });

  it('1. listEnrollments → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.listEnrollments(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('2. processEnrollment → succès → retourne inscription', async () => {
    const fakeEnrollment = { id: 'enr-001', status: 'approved' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: fakeEnrollment, error: null }),
    );
    const result = await service.processEnrollment(
      TENANT_ID,
      'enr-001',
      USER_ID,
      { action: 'approved' } as any,
    );
    expect(result).toMatchObject({ status: 'approved' });
  });

  it('3. processEnrollment → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    await expect(
      service.processEnrollment(TENANT_ID, 'enr-xxxx', USER_ID, {
        action: 'approved',
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. createDocument → retourne document', async () => {
    const fakeDoc = { id: 'doc-001', title: 'Certificat', type: 'certificate' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: fakeDoc, error: null }),
    );
    const result = await service.createDocument(TENANT_ID, USER_ID, {
      title: 'Certificat',
      type: 'certificate',
    });
    expect(result).toMatchObject({ id: 'doc-001' });
  });

  it('5. createDocument → erreur DB → BadRequestException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: { message: 'insert failed' } }),
    );
    await expect(
      service.createDocument(TENANT_ID, USER_ID, {
        title: 'X',
        type: 'general',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. assignTeacher → retourne assignment', async () => {
    const fakeAssignment = { id: 'ass-001', teacher_id: 'teacher-001' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: fakeAssignment, error: null }),
    );
    const result = await service.assignTeacher(TENANT_ID, {
      teacherId: 'teacher-001',
      studentId: 'student-001',
    });
    expect(result).toMatchObject({ teacher_id: 'teacher-001' });
  });

  it('7. listDocuments → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.listDocuments(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });
});
