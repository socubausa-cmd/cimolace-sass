import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { MedosService } from './medos.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import type { TenantContext } from '../tenant/tenant.types';

// ---------------------------------------------------------------------------
// Mock helpers — follow the same pattern as catalog and checkout specs
// ---------------------------------------------------------------------------

type QueryResult = { data?: unknown; error?: { message: string; code?: string } | null };

function chain(result?: QueryResult) {
  const final = result ?? { data: null, error: null };
  const query: Record<string, jest.Mock> & { then: jest.Mock } = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(final),
    maybeSingle: jest.fn().mockResolvedValue(final),
    insert: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (v: unknown) => void) => resolve(final)),
  };
  return query;
}

function makeService(from: jest.Mock) {
  // Mock audit log as no-op success
  from.mockImplementation((table: string) => {
    if (table === 'med_audit_log') {
      return chain({ data: null, error: null });
    }
    return chain();
  });
  return new MedosService({
    client: { from },
  } as never);
}

// ---------------------------------------------------------------------------
// Tenant contexts for each role
// ---------------------------------------------------------------------------

const practitionerCtx: TenantContext = {
  id: 't1',
  name: 'Test Clinic',
  slug: 'test-clinic',
  plan: 'free',
  status: 'active',
  primary_domain: null,
  logo_url: null,
  brand_colors: null,
  userRole: 'practitioner',
};

const receptionistCtx: TenantContext = {
  ...practitionerCtx,
  userRole: 'receptionist',
};

const patientCtx: TenantContext = {
  ...practitionerCtx,
  userRole: 'patient',
};

const actorId = 'practitioner-uuid-1';
const patientUserId = 'patient-uuid-1';

// ---------------------------------------------------------------------------
// Helper to create a mock patient row
// ---------------------------------------------------------------------------

function mockPatientRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'pat-1',
    tenant_id: 't1',
    patient_user_id: patientUserId,
    first_name: 'John',
    last_name: 'Doe',
    date_of_birth: '1990-01-01',
    gender: 'male',
    blood_type: 'O+',
    allergies: [],
    chronic_conditions: [],
    current_medications: [],
    medical_history: {},
    family_history: {},
    emergency_contact: null,
    insurance_info: null,
    consent_given: false,
    consent_date: null,
    consent_purpose: null,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockNoteRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'note-1',
    tenant_id: 't1',
    patient_id: 'pat-1',
    practitioner_id: actorId,
    subjective: 'Headache for 3 days',
    objective: 'BP 120/80',
    assessment: 'Tension headache',
    plan: 'Rest and hydration',
    free_text: null,
    ai_transcript: null,
    ai_draft: null,
    ai_summary: null,
    icd10_codes: [],
    is_shared_with_patient: false,
    is_signed: false,
    signed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MedosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Patients ---

  describe('createPatient', () => {
    const dto: CreatePatientDto = {
      patient_user_id: patientUserId,
      first_name: 'John',
      last_name: 'Doe',
    };

    it('crée un patient et écrit un audit log', async () => {
      const row = mockPatientRow();
      const from = jest.fn();

      // Le service appelle from() plusieurs fois :
      // 1. med_patients.insert → pour la création
      // 2. med_audit_log.insert → pour l'audit
      const patientChain = chain({ data: row, error: null });
      const auditChain = chain({ data: null, error: null });

      from
        .mockReturnValueOnce(patientChain)
        .mockReturnValueOnce(auditChain);

      const svc = new MedosService({ client: { from } } as never);
      const result = await svc.createPatient(practitionerCtx, actorId, dto);

      expect(result.first_name).toBe('John');
      expect(from).toHaveBeenCalledWith('med_patients');
      expect(from).toHaveBeenCalledWith('med_audit_log');
    });

    it('rejette un patient en doublon (23505)', async () => {
      const from = jest.fn().mockReturnValue(
        chain({ data: null, error: { message: 'duplicate', code: '23505' } }),
      );

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.createPatient(practitionerCtx, actorId, dto),
      ).rejects.toThrow(ConflictException);
    });

    it('utilise tenant_id du contexte', async () => {
      const row = mockPatientRow();
      const from = jest.fn();
      const patientChain = chain({ data: row, error: null });
      const auditChain = chain({ data: null, error: null });
      from
        .mockReturnValueOnce(patientChain)
        .mockReturnValueOnce(auditChain);

      const svc = new MedosService({ client: { from } } as never);
      await svc.createPatient(practitionerCtx, actorId, dto);

      // Vérifier que le insert reçoit bien tenant_id
      const insertCall = (patientChain as any).insert.mock.calls[0][0];
      expect(insertCall.tenant_id).toBe('t1');
    });
  });

  describe('listPatients', () => {
    it('liste les patients du tenant', async () => {
      const rows = [mockPatientRow(), mockPatientRow({ id: 'pat-2' })];
      const from = jest.fn().mockReturnValue(chain({ data: rows, error: null }));

      const svc = new MedosService({ client: { from } } as never);
      const result = await svc.listPatients(practitionerCtx);
      expect(result.length).toBe(2);
    });

    it('filtre par tenant_id', async () => {
      const q = chain({ data: [], error: null });
      const from = jest.fn().mockReturnValue(q);

      const svc = new MedosService({ client: { from } } as never);
      await svc.listPatients(practitionerCtx);

      expect(from).toHaveBeenCalledWith('med_patients');
      expect((q as any).eq).toHaveBeenCalledWith('tenant_id', 't1');
    });
  });

  describe('getPatient', () => {
    it('retourne le patient demandé', async () => {
      const row = mockPatientRow();
      const from = jest.fn();
      const patientChain = chain({ data: row, error: null });
      const auditChain = chain({ data: null, error: null });
      from
        .mockReturnValueOnce(patientChain)
        .mockReturnValueOnce(auditChain);

      const svc = new MedosService({ client: { from } } as never);
      const result = await svc.getPatient(practitionerCtx, actorId, 'pat-1');
      expect(result.id).toBe('pat-1');
    });

    it("refuse un patient qui tente de voir le dossier d'un autre", async () => {
      const row = mockPatientRow({ patient_user_id: 'other-patient' });
      const from = jest.fn().mockReturnValue(chain({ data: row, error: null }));

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.getPatient(patientCtx, patientUserId, 'pat-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('jette NotFoundException si patient inexistant', async () => {
      const from = jest.fn().mockReturnValue(
        chain({ data: null, error: { message: 'not found' } }),
      );

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.getPatient(practitionerCtx, actorId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePatient', () => {
    it('met à jour et écrit un audit log', async () => {
      const row = mockPatientRow({ status: 'archived' });
      const from = jest.fn();
      const patientChain = chain({ data: row, error: null });
      const auditChain = chain({ data: null, error: null });
      from
        .mockReturnValueOnce(patientChain)
        .mockReturnValueOnce(auditChain);

      const svc = new MedosService({ client: { from } } as never);
      const dto: UpdatePatientDto = { status: 'archived' };
      const result = await svc.updatePatient(
        practitionerCtx,
        actorId,
        'pat-1',
        dto,
      );
      expect(result.status).toBe('archived');
      expect(from).toHaveBeenCalledWith('med_audit_log');
    });

    it('jette NotFoundException si patient inexistant', async () => {
      const from = jest.fn().mockReturnValue(
        chain({ data: null, error: { message: 'not found' } }),
      );

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.updatePatient(practitionerCtx, actorId, 'nonexistent', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- Notes ---

  describe('createNote', () => {
    const dto: CreateNoteDto = {
      subjective: 'Headache',
      objective: 'BP normal',
      assessment: 'Tension',
      plan: 'Rest',
    };

    it('crée une note et écrit un audit log', async () => {
      const from = jest.fn();
      // Call 0: med_patients.select (vérification patient existe)
      // Call 1: med_consultation_notes.insert
      // Call 2: med_audit_log.insert
      const noteData = mockNoteRow({
        subjective: 'Headache',
        objective: 'BP normal',
        assessment: 'Tension',
        plan: 'Rest',
      });
      from
        .mockReturnValueOnce(chain({ data: { id: 'pat-1' }, error: null }))
        .mockReturnValueOnce(chain({ data: noteData, error: null }))
        .mockReturnValueOnce(chain({ data: null, error: null }));

      const svc = new MedosService({ client: { from } } as never);
      const result = await svc.createNote(
        practitionerCtx,
        actorId,
        'pat-1',
        dto,
      );
      expect(result.subjective).toBe('Headache');
      expect(from).toHaveBeenCalledWith('med_audit_log');
    });

    it("rejette si le patient n'existe pas", async () => {
      const from = jest.fn().mockReturnValue(
        chain({ data: null, error: { message: 'not found' } }),
      );

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.createNote(practitionerCtx, actorId, 'nonexistent', dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listNotes', () => {
    it("liste les notes d'un patient", async () => {
      const rows = [mockNoteRow(), mockNoteRow({ id: 'note-2' })];
      const from = jest.fn().mockReturnValue(chain({ data: rows, error: null }));

      const svc = new MedosService({ client: { from } } as never);
      const result = await svc.listNotes(practitionerCtx, 'pat-1');
      expect(result.length).toBe(2);
    });
  });

  describe('updateNote', () => {
    it('modifie une note non signée', async () => {
      const from = jest.fn();
      // Call 0: select existing note (is_signed: false)
      // Call 1: update
      // Call 2: audit
      from
        .mockReturnValueOnce(
          chain({ data: { id: 'note-1', is_signed: false }, error: null }),
        )
        .mockReturnValueOnce(
          chain({
            data: mockNoteRow({ subjective: 'Updated' }),
            error: null,
          }),
        )
        .mockReturnValueOnce(chain({ data: null, error: null }));

      const svc = new MedosService({ client: { from } } as never);
      const dto: UpdateNoteDto = { subjective: 'Updated' };
      const result = await svc.updateNote(
        practitionerCtx,
        actorId,
        'note-1',
        dto,
      );
      expect(result.subjective).toBe('Updated');
    });

    it('refuse de modifier une note signée', async () => {
      const from = jest.fn().mockReturnValue(
        chain({ data: { id: 'note-1', is_signed: true }, error: null }),
      );

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.updateNote(practitionerCtx, actorId, 'note-1', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('signNote', () => {
    it('signe une note non signée et écrit un audit log', async () => {
      const from = jest.fn();
      // Call 0: select existing note (is_signed: false)
      // Call 1: update to sign
      // Call 2: audit insert
      from
        .mockReturnValueOnce(
          chain({ data: { id: 'note-1', is_signed: false }, error: null }),
        )
        .mockReturnValueOnce(
          chain({ data: mockNoteRow({ is_signed: true, signed_at: '2026-05-10T10:00:00Z' }), error: null }),
        )
        .mockReturnValueOnce(chain({ data: null, error: null }));

      const svc = new MedosService({ client: { from } } as never);
      const result = await svc.signNote(practitionerCtx, actorId, 'note-1');
      expect(result.is_signed).toBe(true);
      expect(result.signed_at).toBe('2026-05-10T10:00:00Z');
      expect(from).toHaveBeenCalledWith('med_audit_log');
    });

    it('retourne 404 si la note est introuvable', async () => {
      const from = jest.fn().mockReturnValue(
        chain({ data: null, error: { message: 'not found' } }),
      );

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.signNote(practitionerCtx, actorId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it("retourne 400 si la note est déjà signée et n'écrase pas signed_at", async () => {
      const from = jest.fn().mockReturnValue(
        chain({ data: { id: 'note-1', is_signed: true, signed_at: 'original-date' }, error: null }),
      );

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.signNote(practitionerCtx, actorId, 'note-1'),
      ).rejects.toThrow(BadRequestException);

      // update() ne doit jamais être appelé
      const updateCalls = from.mock.results
        .map((r: any) => r.value)
        .filter((v: any) => typeof v?.update === 'function');
      // Aucun appel à update n'a dû avoir lieu après le select
      expect(from).toHaveBeenCalledTimes(1); // only the select
    });
  });

  describe('shareNote', () => {
    it('partage une note et écrit un audit log', async () => {
      const from = jest.fn();
      from
        .mockReturnValueOnce(
          chain({
            data: mockNoteRow({ is_shared_with_patient: true }),
            error: null,
          }),
        )
        .mockReturnValueOnce(chain({ data: null, error: null }));

      const svc = new MedosService({ client: { from } } as never);
      const result = await svc.shareNote(
        practitionerCtx,
        actorId,
        'note-1',
        true,
      );
      expect(result.is_shared_with_patient).toBe(true);
      expect(from).toHaveBeenCalledWith('med_audit_log');
    });
  });

  // --- Cross-cutting ---

  describe('audit log obligatoire', () => {
    it('createPatient échoue si audit insert échoue', async () => {
      const row = mockPatientRow();
      const from = jest.fn();
      from
        .mockReturnValueOnce(chain({ data: row, error: null }))
        .mockReturnValueOnce(chain({ data: null, error: { message: 'audit down' } }));

      const svc = new MedosService({ client: { from } } as never);
      const dto: CreatePatientDto = {
        patient_user_id: patientUserId,
        first_name: 'Fail',
        last_name: 'Audit',
      };
      await expect(
        svc.createPatient(practitionerCtx, actorId, dto),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('createNote échoue si audit insert échoue', async () => {
      const from = jest.fn();
      from
        .mockReturnValueOnce(chain({ data: { id: 'pat-1' }, error: null }))
        .mockReturnValueOnce(chain({ data: mockNoteRow(), error: null }))
        .mockReturnValueOnce(chain({ data: null, error: { message: 'audit down' } }));

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.createNote(practitionerCtx, actorId, 'pat-1', { subjective: 'Test' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('updatePatient échoue si audit insert échoue', async () => {
      const row = mockPatientRow({ status: 'archived' });
      const from = jest.fn();
      from
        .mockReturnValueOnce(chain({ data: row, error: null }))
        .mockReturnValueOnce(chain({ data: null, error: { message: 'audit down' } }));

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.updatePatient(practitionerCtx, actorId, 'pat-1', { status: 'archived' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('signNote échoue si audit insert échoue', async () => {
      const from = jest.fn();
      from
        .mockReturnValueOnce(
          chain({ data: { id: 'note-1', is_signed: false }, error: null }),
        )
        .mockReturnValueOnce(
          chain({ data: mockNoteRow({ is_signed: true }), error: null }),
        )
        .mockReturnValueOnce(chain({ data: null, error: { message: 'audit down' } }));

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.signNote(practitionerCtx, actorId, 'note-1'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('shareNote échoue si audit insert échoue', async () => {
      const from = jest.fn();
      from
        .mockReturnValueOnce(
          chain({ data: mockNoteRow({ is_shared_with_patient: true }), error: null }),
        )
        .mockReturnValueOnce(chain({ data: null, error: { message: 'audit down' } }));

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.shareNote(practitionerCtx, actorId, 'note-1', true),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // --- Patient Shared Notes ---

  describe('listPatientSharedNotes', () => {
    it('retourne uniquement les notes partagées du patient connecté', async () => {
      const sharedNote = mockNoteRow({ id: 'note-shared', is_shared_with_patient: true });
      const from = jest.fn();
      // Call 0: med_patients.select (patient lookup)
      // Call 1: med_consultation_notes.select (shared notes)
      // Call 2: med_note_reads.select (read status)
      from
        .mockReturnValueOnce(
          chain({ data: { id: 'pat-1', patient_user_id: patientUserId }, error: null }),
        )
        .mockReturnValueOnce(
          chain({ data: [sharedNote], error: null }),
        )
        .mockReturnValueOnce(
          chain({ data: [{ note_id: 'note-shared', read_at: '2026-01-02T00:00:00Z' }], error: null }),
        );

      const svc = new MedosService({ client: { from } } as never);
      const result = await svc.listPatientSharedNotes(patientCtx, patientUserId);
      expect(result.length).toBe(1);
      expect(result[0].is_shared_with_patient).toBe(true);
      expect(result[0].patient_read_at).toBe('2026-01-02T00:00:00Z');
    });

    it('ne retourne pas les notes non partagées', async () => {
      const unsharedNote = mockNoteRow({ id: 'note-unshared', is_shared_with_patient: false });
      const from = jest.fn();
      from
        .mockReturnValueOnce(
          chain({ data: { id: 'pat-1', patient_user_id: patientUserId }, error: null }),
        )
        .mockReturnValueOnce(
          chain({ data: [], error: null }), // no shared notes
        );

      const svc = new MedosService({ client: { from } } as never);
      const result = await svc.listPatientSharedNotes(patientCtx, patientUserId);
      expect(result.length).toBe(0);
    });

    it("retourne 404 si aucun dossier patient n'est trouvé", async () => {
      const from = jest.fn().mockReturnValue(
        chain({ data: null, error: { message: 'not found' } }),
      );

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.listPatientSharedNotes(patientCtx, 'unknown-user'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markSharedNoteRead', () => {
    it('confirme la lecture uniquement pour une note partagée du patient connecté', async () => {
      const readAt = '2026-01-02T00:00:00Z';
      const from = jest.fn();
      from
        .mockReturnValueOnce(chain({ data: { id: 'pat-1' }, error: null }))
        .mockReturnValueOnce(chain({ data: { id: 'note-1' }, error: null }))
        .mockReturnValueOnce(chain({ data: { note_id: 'note-1', read_at: readAt }, error: null }))
        .mockReturnValueOnce(chain({ data: null, error: null }));

      const svc = new MedosService({ client: { from } } as never);
      const result = await svc.markSharedNoteRead(patientCtx, patientUserId, 'note-1');

      expect(result).toEqual({ note_id: 'note-1', read_at: readAt });
      expect(from).toHaveBeenNthCalledWith(1, 'med_patients');
      expect(from).toHaveBeenNthCalledWith(2, 'med_consultation_notes');
      expect(from).toHaveBeenNthCalledWith(3, 'med_note_reads');
      expect(from).toHaveBeenNthCalledWith(4, 'med_audit_log');
    });

    it("refuse si aucun dossier patient n'est lié à l'utilisateur", async () => {
      const from = jest.fn().mockReturnValue(
        chain({ data: null, error: { message: 'not found' } }),
      );

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.markSharedNoteRead(patientCtx, 'unknown-user', 'note-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it("refuse si la note n'appartient pas au patient ou n'est pas partagée", async () => {
      const from = jest.fn();
      from
        .mockReturnValueOnce(chain({ data: { id: 'pat-1' }, error: null }))
        .mockReturnValueOnce(chain({ data: null, error: { message: 'not found' } }));

      const svc = new MedosService({ client: { from } } as never);
      await expect(
        svc.markSharedNoteRead(patientCtx, patientUserId, 'note-other'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- tenant_id isolation ---

  describe('tenant_id isolation', () => {
    it('toutes les requêtes patients utilisent tenant_id du contexte', async () => {
      const row = mockPatientRow();
      const from = jest.fn();
      const patientChain = chain({ data: row, error: null });
      const auditChain = chain({ data: null, error: null });
      from
        .mockReturnValueOnce(patientChain)
        .mockReturnValueOnce(auditChain);

      const svc = new MedosService({ client: { from } } as never);
      const dto: CreatePatientDto = {
        patient_user_id: patientUserId,
        first_name: 'Test',
        last_name: 'User',
      };
      await svc.createPatient(practitionerCtx, actorId, dto);

      const inserted = (patientChain as any).insert.mock.calls[0][0];
      expect(inserted.tenant_id).toBe('t1');
    });

    it('toutes les requêtes notes utilisent tenant_id du contexte', async () => {
      const from = jest.fn();
      from
        .mockReturnValueOnce(chain({ data: { id: 'pat-1' }, error: null }))
        .mockReturnValueOnce(chain({ data: mockNoteRow(), error: null }))
        .mockReturnValueOnce(chain({ data: null, error: null }));

      const svc = new MedosService({ client: { from } } as never);
      await svc.createNote(practitionerCtx, actorId, 'pat-1', {
        subjective: 'Test',
      });

      const inserted = (
        (from.mock.results[1].value as any).insert as jest.Mock
      ).mock.calls[0][0];
      expect(inserted.tenant_id).toBe('t1');
    });
  });

  // --- DTO Validation ---

  describe('DTO validation', () => {
    it('accepte les tableaux pour allergies, chronic_conditions, current_medications', async () => {
      const dto = Object.assign(new CreatePatientDto(), {
        patient_user_id: '00000000-0000-0000-0000-000000000001',
        first_name: 'Valid',
        last_name: 'Array',
        allergies: [{ name: 'Peanuts', severity: 'high' }],
        chronic_conditions: [{ name: 'Asthma' }],
        current_medications: [{ name: 'Ventolin', dosage: '100mcg' }],
      });
      const errors = await validate(dto);
      // Aucun champ ne doit rapporter d'erreur de validation "isObject" / "isArray"
      const arrayFieldErrors = errors.filter((e) =>
        ['allergies', 'chronic_conditions', 'current_medications'].includes(e.property),
      );
      expect(arrayFieldErrors.length).toBe(0);
    });

    it('rejette un scalaire pour allergies', async () => {
      const dto = Object.assign(new CreatePatientDto(), {
        patient_user_id: '00000000-0000-0000-0000-000000000001',
        first_name: 'Bad',
        last_name: 'Scalar',
        allergies: 'peanuts', // string au lieu de tableau
      });
      const errors = await validate(dto);
      const allergyError = errors.find((e) => e.property === 'allergies');
      expect(allergyError).toBeDefined();
      expect(allergyError?.constraints?.isArray).toBeDefined();
    });

    it('accepte un tableau pour icd10_codes dans CreateNoteDto', async () => {
      const dto = Object.assign(new CreateNoteDto(), {
        subjective: 'Test',
        icd10_codes: [{ code: 'G44.1', description: 'Vascular headache' }],
      });
      const errors = await validate(dto);
      const icdErrors = errors.filter((e) => e.property === 'icd10_codes');
      expect(icdErrors.length).toBe(0);
    });

    it('rejette un scalaire pour icd10_codes', async () => {
      const dto = Object.assign(new CreateNoteDto(), {
        subjective: 'Test',
        icd10_codes: 'G44.1', // string au lieu de tableau
      });
      const errors = await validate(dto);
      const icdError = errors.find((e) => e.property === 'icd10_codes');
      expect(icdError).toBeDefined();
      expect(icdError?.constraints?.isArray).toBeDefined();
    });

    it('les champs objet (medical_history, emergency_contact) restent validés comme objets', async () => {
      const dto = Object.assign(new CreatePatientDto(), {
        patient_user_id: '00000000-0000-0000-0000-000000000001',
        first_name: 'Obj',
        last_name: 'Test',
        medical_history: { surgeries: ['appendectomy'] },
        emergency_contact: { name: 'Jane', phone: '555-0001' },
      });
      const errors = await validate(dto);
      // medical_history et emergency_contact sont @IsObject, pas @IsArray
      const objFieldErrors = errors.filter((e) =>
        ['medical_history', 'emergency_contact'].includes(e.property),
      );
      expect(objFieldErrors.length).toBe(0);
    });
  });
});
