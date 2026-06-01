/**
 * Tests unitaires — BookingService
 *
 * Scénarios couverts :
 *  1.  createSlot → succès → retourne slot
 *  2.  createSlot → erreur DB → BadRequestException
 *  3.  listSlots → retourne tableau
 *  4.  getSlot → trouvé → retourne slot
 *  5.  getSlot → introuvable → NotFoundException
 *  6.  deleteSlot → succès
 *  7.  requestAppointment → créneau disponible → crée RDV
 *  8.  requestAppointment → créneau non disponible → ConflictException
 *  9.  updateAppointment → succès → retourne RDV modifié
 * 10.  listAppointments → retourne tableau
 * 11.  cancelAppointment → succès
 * 12.  confirmAppointment → succès
 * 13.  submitFeedback → succès → retourne feedback
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { SupabaseService } from '../supabase/supabase.service';

// ─── Helpers mock ─────────────────────────────────────────────────────────────

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
    'gte',
    'lte',
    'in',
    'limit',
    'order',
    'or',
  ];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue(singleResult);
  chain.maybeSingle = jest.fn().mockResolvedValue(singleResult);
  // allow query chains that end with `await query` (thenable)
  chain.then = jest
    .fn()
    .mockImplementation((cb: (v: unknown) => unknown) =>
      Promise.resolve(cb(listResult ?? { data: [], error: null })),
    );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = {
  id: 'tenant-0001',
  slug: 'ecole-test',
  name: 'École Test',
  plan: 'school' as const,
  status: 'active' as const,
  userRole: 'owner' as const,
};

const USER_ID = 'user-0001';

const FAKE_SLOT = {
  id: 'slot-0001',
  tenant_id: TENANT.id,
  start_at: new Date(Date.now() + 86400000).toISOString(),
  end_at: new Date(Date.now() + 90000000).toISOString(),
  status: 'available',
  type: 'consultation',
  title: 'Créneau disponible',
};

const FAKE_APPOINTMENT = {
  id: 'appt-0001',
  tenant_id: TENANT.id,
  slot_id: 'slot-0001',
  user_id: USER_ID,
  status: 'pending',
};

// ─── Suite principale ─────────────────────────────────────────────────────────

describe('BookingService', () => {
  let service: BookingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
  });

  // ── createSlot ────────────────────────────────────────────────────────────

  it('1. createSlot → succès → retourne slot', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_SLOT, error: null }),
    );

    const result = await service.createSlot(TENANT as any, USER_ID, {
      startAt: FAKE_SLOT.start_at,
      endAt: FAKE_SLOT.end_at,
    });

    expect(result).toMatchObject({ id: 'slot-0001', status: 'available' });
  });

  it('2. createSlot → erreur DB → BadRequestException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: { message: 'overlap detected' } }),
    );

    await expect(
      service.createSlot(TENANT as any, USER_ID, {} as any),
    ).rejects.toThrow(BadRequestException);
  });

  // ── listSlots ─────────────────────────────────────────────────────────────

  it('3. listSlots → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [FAKE_SLOT], error: null }),
    );

    const result = await service.listSlots(TENANT.id);
    expect(Array.isArray(result)).toBe(true);
  });

  // ── getSlot ───────────────────────────────────────────────────────────────

  it('4. getSlot → trouvé → retourne slot', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_SLOT, error: null }),
    );

    const result = await service.getSlot('slot-0001', TENANT.id);
    expect(result).toMatchObject({ id: 'slot-0001' });
  });

  it('5. getSlot → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );

    await expect(service.getSlot('slot-xxxx', TENANT.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── deleteSlot ────────────────────────────────────────────────────────────

  it('6. deleteSlot → succès', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );

    await expect(
      service.deleteSlot('slot-0001', TENANT.id),
    ).resolves.toBeUndefined();
  });

  // ── requestAppointment ────────────────────────────────────────────────────

  it('7. requestAppointment → créneau disponible → crée RDV', async () => {
    mockSupabase.client.from
      // getSlot → booking_slots.select().eq().eq().single()
      .mockReturnValueOnce(buildChain({ data: FAKE_SLOT, error: null }))
      // insert appointment → appointments.insert().select().single()
      .mockReturnValueOnce(buildChain({ data: FAKE_APPOINTMENT, error: null }))
      // update slot status → booking_slots.update().eq() (thenable)
      .mockReturnValueOnce(buildChain({ data: null, error: null }));

    const result = await service.requestAppointment(TENANT as any, USER_ID, {
      slotId: 'slot-0001',
    });

    expect(result).toMatchObject({ id: 'appt-0001' });
  });

  it('8. requestAppointment → créneau non disponible → ConflictException', async () => {
    const bookedSlot = { ...FAKE_SLOT, status: 'booked' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: bookedSlot, error: null }),
    );

    await expect(
      service.requestAppointment(TENANT as any, USER_ID, {
        slotId: 'slot-0001',
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  // ── updateAppointment ─────────────────────────────────────────────────────

  it('9. updateAppointment → succès → retourne RDV modifié', async () => {
    const updated = { ...FAKE_APPOINTMENT, status: 'confirmed' };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: updated, error: null }),
    );

    const result = await service.updateAppointment('appt-0001', TENANT.id, {
      status: 'confirmed',
    });
    expect(result).toMatchObject({ status: 'confirmed' });
  });

  // ── listAppointments ──────────────────────────────────────────────────────

  it('10. listAppointments → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain(undefined, { data: [FAKE_APPOINTMENT], error: null }),
    );

    const result = await service.listAppointments(TENANT.id);
    expect(Array.isArray(result)).toBe(true);
  });

  // ── cancelAppointment ─────────────────────────────────────────────────────

  it('11. cancelAppointment → succès', async () => {
    mockSupabase.client.from
      // updateAppointment → appointments.update().eq().eq().select().single()
      .mockReturnValueOnce(
        buildChain({
          data: { ...FAKE_APPOINTMENT, status: 'canceled' },
          error: null,
        }),
      )
      // from('appointments').select('slot_id').eq().single()
      .mockReturnValueOnce(
        buildChain({ data: { slot_id: 'slot-0001' }, error: null }),
      )
      // from('booking_slots').update().eq() (thenable)
      .mockReturnValueOnce(buildChain({ data: null, error: null }));

    const result = await service.cancelAppointment('appt-0001', TENANT.id);
    expect(result).toMatchObject({
      appointmentId: 'appt-0001',
      status: 'canceled',
    });
  });

  // ── confirmAppointment ────────────────────────────────────────────────────

  it('12. confirmAppointment → succès', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({
        data: { ...FAKE_APPOINTMENT, status: 'confirmed' },
        error: null,
      }),
    );

    const result = await service.confirmAppointment('appt-0001', TENANT.id);
    expect(result).toBeDefined();
  });

  // ── submitFeedback ────────────────────────────────────────────────────────

  it('13. submitFeedback → succès → retourne feedback', async () => {
    const feedback = { id: 'fb-001', appointment_id: 'appt-0001', rating: 5 };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: feedback, error: null }),
    );

    const result = await service.submitFeedback(TENANT.id, USER_ID, {
      appointmentId: 'appt-0001',
      rating: 5,
    });

    expect(result).toMatchObject({ rating: 5 });
  });
});
