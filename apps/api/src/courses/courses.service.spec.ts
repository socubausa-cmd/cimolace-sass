/**
 * Tests unitaires — CoursesService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CoursesService } from './courses.service';
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
const TENANT = {
  id: 'tenant-0001',
  slug: 'ecole-test',
  name: 'École Test',
  plan: 'school' as const,
  status: 'active' as const,
  userRole: 'owner' as const,
};
const USER_ID = 'user-0001';
const FAKE_COURSE = {
  id: 'course-001',
  tenant_id: TENANT.id,
  title: 'Algèbre linéaire',
  status: 'draft',
};
const FAKE_MODULE = {
  id: 'module-001',
  course_id: 'course-001',
  title: 'Module 1',
};

describe('CoursesService', () => {
  let service: CoursesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();
    service = module.get<CoursesService>(CoursesService);
  });

  it('1. createCourse → retourne cours créé', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_COURSE, error: null }),
    );
    const result = await service.createCourse(TENANT as any, USER_ID, {
      title: 'Algèbre linéaire',
    });
    expect(result).toMatchObject({ id: 'course-001', status: 'draft' });
  });

  it('2. createCourse → erreur DB → BadRequestException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: { message: 'duplicate' } }),
    );
    await expect(
      service.createCourse(TENANT as any, USER_ID, { title: 'X' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. listCourses → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [FAKE_COURSE], error: null }),
    );
    const result = await service.listCourses(TENANT.id);
    expect(Array.isArray(result)).toBe(true);
  });

  it('4. getCourse → trouvé → retourne cours', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_COURSE, error: null }),
    );
    const result = await service.getCourse(TENANT.id, 'course-001');
    expect(result).toMatchObject({ id: 'course-001' });
  });

  it('5. getCourse → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    await expect(service.getCourse(TENANT.id, 'course-xxx')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('6. createModule → retourne module', async () => {
    // getCourse first, then insert
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: FAKE_COURSE, error: null }))
      .mockReturnValueOnce(buildChain({ data: FAKE_MODULE, error: null }));
    const result = await service.createModule(TENANT as any, 'course-001', {
      title: 'Module 1',
      orderIndex: 0,
    });
    expect(result).toMatchObject({ id: 'module-001' });
  });

  it('7. listModules → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [FAKE_MODULE], error: null }),
    );
    const result = await service.listModules(TENANT.id, 'course-001');
    expect(Array.isArray(result)).toBe(true);
  });

  it('8. updateProgress → résout course_id → upsert → retourne progress', async () => {
    const fakeProgress = {
      id: 'prog-001',
      status: 'completed',
      user_id: USER_ID,
      course_id: 'course-001',
    };
    // 3 from() calls: course_lessons, course_modules, student_progress
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: { module_id: 'module-001' }, error: null }))
      .mockReturnValueOnce(buildChain({ data: { course_id: 'course-001' }, error: null }))
      .mockReturnValueOnce(buildChain({ data: fakeProgress, error: null }));
    const result = await service.updateProgress(
      TENANT.id,
      USER_ID,
      'lesson-001',
      { status: 'completed' },
    );
    expect(result).toMatchObject({ status: 'completed', course_id: 'course-001' });
  });

  it('9. updateProgress → erreur DB → BadRequestException', async () => {
    // lesson lookup succeeds, module lookup succeeds, upsert fails
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: { module_id: 'module-001' }, error: null }))
      .mockReturnValueOnce(buildChain({ data: { course_id: 'course-001' }, error: null }))
      .mockReturnValueOnce(buildChain({ data: null, error: { message: 'FK violation' } }));
    await expect(
      service.updateProgress(TENANT.id, USER_ID, 'lesson-001', {
        status: 'completed',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
