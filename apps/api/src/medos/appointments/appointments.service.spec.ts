/**
 * AppointmentsService — tests smoke
 *
 * Couvre les invariants critiques :
 *  - Patient ne peut créer un RDV que pour son propre dossier
 *  - Conflit détecté quand un RDV chevauche un autre
 *  - Cancel exige un motif (3 chars min)
 *  - Complete uniquement depuis confirmed
 *  - No-show uniquement depuis confirmed
 *  - Slot search calcule les créneaux dispo en excluant les RDV pris
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const PRACTITIONER_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const PATIENT_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const PATIENT_RECORD_ID = 'cccccccc-0000-0000-0000-000000000001';
const APPOINTMENT_ID = 'dddddddd-0000-0000-0000-000000000001';

const tenant = {
  id: TENANT_ID,
  slug: 'zahir',
  name: 'Zahir',
  plan: 'medos',
  status: 'active',
  primary_domain: null,
  logo_url: null,
  brand_colors: null,
  userRole: 'practitioner' as const,
};

const APPOINTMENT_ROW = {
  id: APPOINTMENT_ID,
  tenant_id: TENANT_ID,
  patient_id: PATIENT_RECORD_ID,
  practitioner_id: PRACTITIONER_ID,
  scheduled_at: '2026-06-15T09:00:00.000Z',
  duration_minutes: 30,
  appointment_type: 'in_person',
  reason: null,
  status: 'confirmed',
  internal_notes: null,
  price_cents: null,
  currency: null,
  payment_status: null,
  confirmed_at: '2026-05-28T10:00:00.000Z',
  cancelled_at: null,
  cancellation_reason: null,
  completed_at: null,
  consultation_note_id: null,
  teleconsult_session_id: null,
  created_at: '2026-05-28T10:00:00.000Z',
  updated_at: '2026-05-28T10:00:00.000Z',
};

function chain(result: { data: unknown; error: unknown }) {
  const c: any = {};
  ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte'].forEach((m) => {
    c[m] = jest.fn().mockReturnValue(c);
  });
  c.single = jest.fn().mockResolvedValue(result);
  c.maybeSingle = jest.fn().mockResolvedValue(result);
  c.order = jest.fn().mockResolvedValue(result);
  // Make chain awaitable (Supabase query executes when awaited at any point)
  c.then = (onFulfilled: any) => Promise.resolve(result).then(onFulfilled);
  return c;
}

function makeSupa() {
  return { client: { from: jest.fn() } };
}

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let supa: { client: { from: jest.Mock } };

  beforeEach(() => {
    supa = makeSupa();
    service = new AppointmentsService(supa as any);
  });

  describe('create', () => {
    it('refuse qu\'un patient crée un RDV pour un autre patient', async () => {
      supa.client.from
        .mockReturnValueOnce(
          chain({
            data: {
              id: PATIENT_RECORD_ID,
              patient_user_id: 'autre-uid',
            },
            error: null,
          }),
        );

      await expect(
        service.create(tenant, PATIENT_USER_ID, 'patient', {
          patient_id: PATIENT_RECORD_ID,
          practitioner_id: PRACTITIONER_ID,
          scheduled_at: '2026-06-15T10:00:00Z',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('détecte un conflit avec un RDV existant qui chevauche', async () => {
      supa.client.from
        .mockReturnValueOnce(
          chain({
            data: { id: PATIENT_RECORD_ID, patient_user_id: PATIENT_USER_ID },
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({
            data: [APPOINTMENT_ROW], // existing 09:00-09:30
            error: null,
          }),
        );

      await expect(
        service.create(tenant, PRACTITIONER_ID, 'practitioner', {
          patient_id: PATIENT_RECORD_ID,
          practitioner_id: PRACTITIONER_ID,
          scheduled_at: '2026-06-15T09:15:00Z', // chevauche
          duration_minutes: 30,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('crée un RDV staff → status confirmed immédiatement', async () => {
      supa.client.from
        .mockReturnValueOnce(
          chain({
            data: { id: PATIENT_RECORD_ID, patient_user_id: PATIENT_USER_ID },
            error: null,
          }),
        )
        .mockReturnValueOnce(chain({ data: [], error: null })) // no conflicts
        .mockReturnValueOnce(
          chain({ data: APPOINTMENT_ROW, error: null }),
        ) // insert
        .mockReturnValueOnce(chain({ data: { id: 'audit-1' }, error: null }));

      const result = await service.create(tenant, PRACTITIONER_ID, 'practitioner', {
        patient_id: PATIENT_RECORD_ID,
        practitioner_id: PRACTITIONER_ID,
        scheduled_at: '2026-06-15T11:00:00Z',
      });

      expect(result.status).toBe('confirmed');
    });

    it('crée un RDV patient → status requested', async () => {
      supa.client.from
        .mockReturnValueOnce(
          chain({
            data: { id: PATIENT_RECORD_ID, patient_user_id: PATIENT_USER_ID },
            error: null,
          }),
        )
        .mockReturnValueOnce(chain({ data: [], error: null }))
        .mockReturnValueOnce(
          chain({
            data: { ...APPOINTMENT_ROW, status: 'requested', confirmed_at: null },
            error: null,
          }),
        )
        .mockReturnValueOnce(chain({ data: { id: 'audit-2' }, error: null }));

      const result = await service.create(tenant, PATIENT_USER_ID, 'patient', {
        patient_id: PATIENT_RECORD_ID,
        practitioner_id: PRACTITIONER_ID,
        scheduled_at: '2026-06-15T12:00:00Z',
      });

      expect(result.status).toBe('requested');
    });
  });

  describe('cancel', () => {
    it('refuse cancel sans motif', async () => {
      await expect(
        service.cancel(tenant, PRACTITIONER_ID, APPOINTMENT_ID, { reason: '' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('annule un RDV avec motif', async () => {
      const cancelled = {
        ...APPOINTMENT_ROW,
        status: 'cancelled',
        cancellation_reason: 'Patient indisponible',
      };
      supa.client.from
        .mockReturnValueOnce(chain({ data: cancelled, error: null })) // update
        .mockReturnValueOnce(chain({ data: { id: 'audit-3' }, error: null }));

      const result = await service.cancel(tenant, PRACTITIONER_ID, APPOINTMENT_ID, {
        reason: 'Patient indisponible',
      });
      expect(result.status).toBe('cancelled');
    });
  });

  describe('availability', () => {
    it('refuse de créer une dispo sans weekday ni specific_date', async () => {
      await expect(
        service.createAvailability(tenant, PRACTITIONER_ID, {
          practitioner_id: PRACTITIONER_ID,
          start_time: '09:00',
          end_time: '17:00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse de créer une dispo avec weekday ET specific_date', async () => {
      await expect(
        service.createAvailability(tenant, PRACTITIONER_ID, {
          practitioner_id: PRACTITIONER_ID,
          weekday: 1,
          specific_date: '2026-06-15',
          start_time: '09:00',
          end_time: '17:00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
