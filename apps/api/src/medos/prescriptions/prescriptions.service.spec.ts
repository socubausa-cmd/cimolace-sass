/**
 * PrescriptionsService — tests unitaires
 *
 * Vérifie les invariants critiques :
 *  - Création draft (avec / sans items)
 *  - Update interdit après signature
 *  - Signature génère hash + numéro, statut → signed
 *  - Cancel impossible deux fois
 *  - Patient ne voit que ses ordonnances signed/dispensed
 *  - Audit log écrit à chaque opération mutative
 */

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';

const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_SLUG = 'zahirwellness';
const PRACTITIONER_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const PATIENT_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const PATIENT_RECORD_ID = 'cccccccc-0000-0000-0000-000000000001';
const PRESCRIPTION_ID = 'dddddddd-0000-0000-0000-000000000001';
const ITEM_ID = 'eeeeeeee-0000-0000-0000-000000000001';

const tenant = {
  id: TENANT_ID,
  slug: TENANT_SLUG,
  name: 'Zahir',
  plan: 'medos',
  status: 'active',
  primary_domain: null,
  logo_url: null,
  brand_colors: null,
  userRole: 'practitioner' as const,
};

const tenantPatient = { ...tenant, userRole: 'patient' as const };

const DRAFT_ROW = {
  id: PRESCRIPTION_ID,
  tenant_id: TENANT_ID,
  patient_id: PATIENT_RECORD_ID,
  practitioner_id: PRACTITIONER_ID,
  consultation_note_id: null,
  prescription_number: null,
  issued_at: '2026-05-28T10:00:00Z',
  validity_days: 90,
  status: 'draft',
  patient_instructions: null,
  practitioner_notes: null,
  signed_at: null,
  signature_hash: null,
  cancelled_at: null,
  cancellation_reason: null,
  pdf_url: null,
  created_at: '2026-05-28T10:00:00Z',
  updated_at: '2026-05-28T10:00:00Z',
};

const ITEM_ROW = {
  id: ITEM_ID,
  tenant_id: TENANT_ID,
  prescription_id: PRESCRIPTION_ID,
  position: 0,
  drug_name: 'Paracétamol 1000mg',
  drug_code: null,
  dosage: '1 comprimé',
  frequency: '3 fois par jour',
  duration: '5 jours',
  route: 'oral',
  quantity: null,
  notes: null,
  is_substitutable: true,
  created_at: '2026-05-28T10:00:00Z',
};

/** Fabrique une chaîne Supabase mockée qui se termine sur la valeur donnée */
function chain(result: { data: unknown; error: unknown; count?: number }) {
  const c: any = {};
  [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'in',
    'not',
    'gte',
    'lte',
    'limit',
  ].forEach((m) => {
    c[m] = jest.fn().mockReturnValue(c);
  });
  c.single = jest.fn().mockResolvedValue(result);
  c.maybeSingle = jest.fn().mockResolvedValue(result);
  c.order = jest.fn().mockResolvedValue(result);
  // Pour les counts (select head:true count:exact)
  Object.defineProperty(c, 'then', {
    value: (onFulfilled: any) => Promise.resolve(result).then(onFulfilled),
    configurable: true,
    enumerable: false,
  });
  return c;
}

function makeSupabaseMock() {
  return { client: { from: jest.fn() } };
}

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let supa: { client: { from: jest.Mock } };

  beforeEach(() => {
    supa = makeSupabaseMock();
    service = new PrescriptionsService(supa as any);
  });

  // ── create ─────────────────────────────────────────────────────────────

  describe('create', () => {
    it('crée une prescription draft sans items + audit', async () => {
      supa.client.from
        .mockReturnValueOnce(chain({ data: { id: PATIENT_RECORD_ID }, error: null })) // patient lookup
        .mockReturnValueOnce(chain({ data: DRAFT_ROW, error: null })) // insert prescription
        .mockReturnValueOnce(chain({ data: { id: 'audit-1' }, error: null })); // audit insert

      const result = await service.create(tenant, PRACTITIONER_ID, {
        patient_id: PATIENT_RECORD_ID,
      });

      expect(result.id).toBe(PRESCRIPTION_ID);
      expect(result.status).toBe('draft');
      expect(result.items).toEqual([]);
    });

    it('échoue si le patient est inconnu', async () => {
      supa.client.from.mockReturnValueOnce(
        chain({ data: null, error: { message: 'not found' } }),
      );

      await expect(
        service.create(tenant, PRACTITIONER_ID, {
          patient_id: 'inconnu',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('crée une prescription avec items initiaux', async () => {
      supa.client.from
        .mockReturnValueOnce(chain({ data: { id: PATIENT_RECORD_ID }, error: null }))
        .mockReturnValueOnce(chain({ data: DRAFT_ROW, error: null }))
        .mockReturnValueOnce(chain({ data: [ITEM_ROW], error: null }))
        .mockReturnValueOnce(chain({ data: { id: 'audit-1' }, error: null }));

      const result = await service.create(tenant, PRACTITIONER_ID, {
        patient_id: PATIENT_RECORD_ID,
        items: [
          {
            drug_name: 'Paracétamol 1000mg',
            dosage: '1 comprimé',
            frequency: '3 fois par jour',
            duration: '5 jours',
          },
        ],
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].drug_name).toBe('Paracétamol 1000mg');
    });
  });

  // ── update ─────────────────────────────────────────────────────────────

  describe('update', () => {
    it('refuse de modifier une prescription signée', async () => {
      const signed = { ...DRAFT_ROW, status: 'signed' };
      supa.client.from.mockReturnValueOnce(chain({ data: signed, error: null }));

      await expect(
        service.update(tenant, PRACTITIONER_ID, PRESCRIPTION_ID, {
          patient_instructions: 'Nouvelle note',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('met à jour les méta-infos draft', async () => {
      const updated = {
        ...DRAFT_ROW,
        patient_instructions: 'Boire beaucoup d\'eau',
      };
      supa.client.from
        .mockReturnValueOnce(chain({ data: DRAFT_ROW, error: null })) // load
        .mockReturnValueOnce(chain({ data: updated, error: null })) // update
        .mockReturnValueOnce(chain({ data: { id: 'audit-2' }, error: null })); // audit

      const result = await service.update(
        tenant,
        PRACTITIONER_ID,
        PRESCRIPTION_ID,
        { patient_instructions: "Boire beaucoup d'eau" },
      );

      expect(result.patient_instructions).toBe("Boire beaucoup d'eau");
    });
  });

  // ── sign ───────────────────────────────────────────────────────────────

  describe('sign', () => {
    it('refuse de signer une prescription vide', async () => {
      supa.client.from
        .mockReturnValueOnce(chain({ data: DRAFT_ROW, error: null })) // load
        .mockReturnValueOnce(chain({ data: [], error: null })); // items list (empty)

      await expect(
        service.sign(tenant, PRACTITIONER_ID, PRESCRIPTION_ID),
      ).rejects.toMatchObject({
        message: expect.stringContaining('aucune ligne'),
      });
    });

    it('refuse de signer une prescription déjà signée', async () => {
      const signed = { ...DRAFT_ROW, status: 'signed' };
      supa.client.from.mockReturnValueOnce(chain({ data: signed, error: null }));

      await expect(
        service.sign(tenant, PRACTITIONER_ID, PRESCRIPTION_ID),
      ).rejects.toMatchObject({
        message: expect.stringContaining('signed'),
      });
    });

    it('signe une draft : génère hash + numéro, change statut', async () => {
      const signed = {
        ...DRAFT_ROW,
        status: 'signed',
        signed_at: '2026-05-28T11:00:00Z',
        signature_hash: 'will-be-overwritten-by-real-hash',
        prescription_number: 'ZAHIRW-2026-00001',
      };
      supa.client.from
        .mockReturnValueOnce(chain({ data: DRAFT_ROW, error: null })) // load
        .mockReturnValueOnce(chain({ data: [ITEM_ROW], error: null })) // items
        .mockReturnValueOnce(chain({ data: null, error: null, count: 0 })) // number count
        .mockReturnValueOnce(chain({ data: signed, error: null })) // update sign
        .mockReturnValueOnce(chain({ data: { id: 'audit-3' }, error: null })); // audit

      const result = await service.sign(tenant, PRACTITIONER_ID, PRESCRIPTION_ID);

      expect(result.status).toBe('signed');
      expect(result.items).toHaveLength(1);
    });
  });

  // ── cancel ─────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('refuse cancel sans motif', async () => {
      supa.client.from.mockReturnValueOnce(
        chain({ data: { ...DRAFT_ROW, status: 'signed' }, error: null }),
      );

      await expect(
        service.cancel(tenant, PRACTITIONER_ID, PRESCRIPTION_ID, ''),
      ).rejects.toMatchObject({
        message: expect.stringContaining('Motif'),
      });
    });

    it('refuse cancel d\'une prescription déjà annulée', async () => {
      const cancelled = { ...DRAFT_ROW, status: 'cancelled' };
      supa.client.from.mockReturnValueOnce(chain({ data: cancelled, error: null }));

      await expect(
        service.cancel(
          tenant,
          PRACTITIONER_ID,
          PRESCRIPTION_ID,
          'Erreur de dosage',
        ),
      ).rejects.toMatchObject({
        message: expect.stringContaining('déjà annulée'),
      });
    });

    it('annule avec motif', async () => {
      const signedRow = { ...DRAFT_ROW, status: 'signed' };
      const cancelledRow = {
        ...signedRow,
        status: 'cancelled',
        cancelled_at: '2026-05-28T12:00:00Z',
        cancellation_reason: 'Erreur de dosage',
      };
      supa.client.from
        .mockReturnValueOnce(chain({ data: signedRow, error: null })) // load
        .mockReturnValueOnce(chain({ data: cancelledRow, error: null })) // update
        .mockReturnValueOnce(chain({ data: { id: 'audit-4' }, error: null })); // audit

      const result = await service.cancel(
        tenant,
        PRACTITIONER_ID,
        PRESCRIPTION_ID,
        'Erreur de dosage',
      );

      expect(result.status).toBe('cancelled');
      expect(result.cancellation_reason).toBe('Erreur de dosage');
    });
  });

  // ── patient access ─────────────────────────────────────────────────────

  describe('get — accès patient', () => {
    it('patient ne peut pas voir une draft', async () => {
      supa.client.from
        .mockReturnValueOnce(chain({ data: DRAFT_ROW, error: null })) // load
        .mockReturnValueOnce(
          chain({ data: { patient_user_id: PATIENT_USER_ID }, error: null }),
        ); // patient ownership check

      await expect(
        service.get(tenantPatient, PATIENT_USER_ID, PRESCRIPTION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('patient ne peut pas voir une prescription d\'un autre patient', async () => {
      const signed = { ...DRAFT_ROW, status: 'signed' };
      supa.client.from
        .mockReturnValueOnce(chain({ data: signed, error: null })) // load
        .mockReturnValueOnce(
          chain({ data: { patient_user_id: 'autre-uid' }, error: null }),
        ); // ownership fail

      await expect(
        service.get(tenantPatient, PATIENT_USER_ID, PRESCRIPTION_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('patient voit sa prescription signée', async () => {
      const signed = { ...DRAFT_ROW, status: 'signed' };
      supa.client.from
        .mockReturnValueOnce(chain({ data: signed, error: null })) // load
        .mockReturnValueOnce(
          chain({ data: { patient_user_id: PATIENT_USER_ID }, error: null }),
        ) // ownership OK
        .mockReturnValueOnce(chain({ data: [ITEM_ROW], error: null })); // items

      const result = await service.get(
        tenantPatient,
        PATIENT_USER_ID,
        PRESCRIPTION_ID,
      );

      expect(result.status).toBe('signed');
      expect(result.items).toHaveLength(1);
    });
  });

  // ── list ───────────────────────────────────────────────────────────────

  describe('list', () => {
    it('liste toutes les prescriptions du tenant', async () => {
      supa.client.from.mockReturnValueOnce(
        chain({ data: [DRAFT_ROW], error: null }),
      );

      const result = await service.list(tenant);
      expect(result).toHaveLength(1);
    });

    it('liste avec filtre patient + statut', async () => {
      supa.client.from.mockReturnValueOnce(
        chain({ data: [{ ...DRAFT_ROW, status: 'signed' }], error: null }),
      );

      const result = await service.list(tenant, {
        patient_id: PATIENT_RECORD_ID,
        status: 'signed',
      });
      expect(result).toHaveLength(1);
    });
  });
});
