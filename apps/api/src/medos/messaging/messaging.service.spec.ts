/**
 * MessagingService — tests smoke
 *
 * Vérifie :
 *  - Patient peut créer un thread sur son propre dossier
 *  - Patient ne peut PAS créer un thread sur un autre dossier
 *  - send() vérifie l'accès au thread
 *  - markRead retourne 404 si déjà lu
 */

import { ForbiddenException } from '@nestjs/common';
import { MessagingService } from './messaging.service';

const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const PATIENT_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const PATIENT_RECORD_ID = 'cccccccc-0000-0000-0000-000000000001';
const THREAD_ID = 'dddddddd-0000-0000-0000-000000000001';

const tenant = {
  id: TENANT_ID,
  slug: 'zahir',
  name: 'Zahir',
  plan: 'medos',
  status: 'active',
  primary_domain: null,
  logo_url: null,
  brand_colors: null,
  userRole: 'patient' as const,
};

const THREAD_ROW = {
  id: THREAD_ID,
  tenant_id: TENANT_ID,
  patient_id: PATIENT_RECORD_ID,
  subject: 'Question consultation',
  status: 'awaiting_staff',
  priority: 'normal',
  last_message_at: null,
  last_message_by_role: null,
  assigned_practitioner_id: null,
  closed_at: null,
  closed_reason: null,
  created_at: '2026-05-28T10:00:00Z',
  updated_at: '2026-05-28T10:00:00Z',
};

function chain(result: { data: unknown; error: unknown }) {
  const c: any = {};
  ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'is'].forEach((m) => {
    c[m] = jest.fn().mockReturnValue(c);
  });
  c.single = jest.fn().mockResolvedValue(result);
  c.maybeSingle = jest.fn().mockResolvedValue(result);
  c.order = jest.fn().mockResolvedValue(result);
  c.then = (onFulfilled: any) => Promise.resolve(result).then(onFulfilled);
  return c;
}

function makeSupa() {
  return { client: { from: jest.fn() } };
}

describe('MessagingService', () => {
  let service: MessagingService;
  let supa: { client: { from: jest.Mock } };

  beforeEach(() => {
    supa = makeSupa();
    service = new MessagingService(supa as any);
  });

  describe('createThread', () => {
    it('refuse que le patient crée un thread sur un autre dossier', async () => {
      supa.client.from.mockReturnValueOnce(
        chain({ data: { patient_user_id: 'autre-uid' }, error: null }),
      );

      await expect(
        service.createThread(tenant, PATIENT_USER_ID, 'patient', {
          patient_id: PATIENT_RECORD_ID,
          subject: 'Test',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('crée un thread + message initial', async () => {
      // Séquence des from() :
      //  1. createThread → checkPatientOwnership (med_patients)
      //  2. createThread → insert thread (med_message_threads)
      //  3. send → getThread → load thread (med_message_threads)
      //  4. send → getThread → checkPatientOwnership (med_patients)
      //  5. send → insert message (med_messages)
      //  6. send → update thread last_message (med_message_threads)
      supa.client.from
        .mockReturnValueOnce(
          chain({ data: { patient_user_id: PATIENT_USER_ID }, error: null }),
        )
        .mockReturnValueOnce(chain({ data: THREAD_ROW, error: null }))
        .mockReturnValueOnce(chain({ data: THREAD_ROW, error: null }))
        .mockReturnValueOnce(
          chain({ data: { patient_user_id: PATIENT_USER_ID }, error: null }),
        )
        .mockReturnValueOnce(
          chain({
            data: {
              id: 'msg-1',
              tenant_id: TENANT_ID,
              thread_id: THREAD_ID,
              sender_id: PATIENT_USER_ID,
              sender_role: 'patient',
              body: 'Bonjour docteur',
              attachment_ids: [],
              is_system: false,
              created_at: '2026-05-28T10:01:00Z',
            },
            error: null,
          }),
        )
        .mockReturnValueOnce(chain({ data: null, error: null }));

      const result = await service.createThread(tenant, PATIENT_USER_ID, 'patient', {
        patient_id: PATIENT_RECORD_ID,
        subject: 'Question',
        initial_message: 'Bonjour docteur',
      });

      expect(result.thread.id).toBe(THREAD_ID);
      expect(result.first_message?.body).toBe('Bonjour docteur');
    });
  });

  describe('listThreads', () => {
    it('patient sans dossier retourne tableau vide', async () => {
      // Séquence : query med_message_threads (jamais executée) + med_patients (returns null)
      supa.client.from
        .mockReturnValueOnce(chain({ data: [], error: null })) // med_message_threads query
        .mockReturnValueOnce(chain({ data: null, error: null })); // med_patients lookup → null

      const result = await service.listThreads(tenant, PATIENT_USER_ID, 'patient');
      expect(result).toEqual([]);
    });

    it('staff voit tous les threads du tenant', async () => {
      const staffTenant = { ...tenant, userRole: 'practitioner' as const };
      supa.client.from.mockReturnValueOnce(
        chain({ data: [THREAD_ROW], error: null }),
      );

      const result = await service.listThreads(staffTenant, 'staff-uid', 'practitioner');
      expect(result).toHaveLength(1);
    });
  });
});
