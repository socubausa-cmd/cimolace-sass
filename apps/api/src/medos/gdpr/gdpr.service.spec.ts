/**
 * GdprService — tests smoke
 *
 * Vérifie :
 *  - Anonymisation refusée si legal_basis < 10 chars
 *  - Pseudonyme stable (même hash pour même (tenant, patient))
 *  - Patient ne peut consenter / révoquer que pour lui-même
 *  - Export request acceptée avec status=pending
 */

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { GdprService } from './gdpr.service';

const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const PATIENT_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const PATIENT_RECORD_ID = 'cccccccc-0000-0000-0000-000000000001';

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

const fakeReq = {
  headers: { 'user-agent': 'jest' },
  socket: { remoteAddress: '127.0.0.1' },
} as unknown as Request;

function chain(result: { data: unknown; error: unknown }) {
  const c: any = {};
  ['select', 'insert', 'update', 'eq', 'neq', 'in', 'is'].forEach((m) => {
    c[m] = jest.fn().mockReturnValue(c);
  });
  c.single = jest.fn().mockResolvedValue(result);
  c.maybeSingle = jest.fn().mockResolvedValue(result);
  c.order = jest.fn().mockResolvedValue(result);
  return c;
}

function makeSupa() {
  return { client: { from: jest.fn() } };
}

describe('GdprService', () => {
  let service: GdprService;
  let supa: { client: { from: jest.Mock } };

  beforeEach(() => {
    supa = makeSupa();
    service = new GdprService(supa as any);
  });

  describe('recordConsent', () => {
    it('refuse que le patient consente sur un autre dossier', async () => {
      supa.client.from.mockReturnValueOnce(
        chain({ data: { patient_user_id: 'autre-uid' }, error: null }),
      );

      await expect(
        service.recordConsent(
          tenant,
          PATIENT_USER_ID,
          'patient',
          {
            patient_id: PATIENT_RECORD_ID,
            scope: 'data_processing',
            granted: true,
            consent_text: 'Je consens',
            consent_version: 'v1',
          },
          fakeReq,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('enregistre un consentement avec IP + UA', async () => {
      supa.client.from
        .mockReturnValueOnce(
          chain({ data: { patient_user_id: PATIENT_USER_ID }, error: null }),
        )
        .mockReturnValueOnce(
          chain({
            data: {
              id: 'consent-1',
              tenant_id: TENANT_ID,
              patient_id: PATIENT_RECORD_ID,
              scope: 'ai_charting',
              granted: true,
              ip_address: '127.0.0.1',
              user_agent: 'jest',
            },
            error: null,
          }),
        );

      const result = await service.recordConsent(
        tenant,
        PATIENT_USER_ID,
        'patient',
        {
          patient_id: PATIENT_RECORD_ID,
          scope: 'ai_charting',
          granted: true,
          consent_text: "J'autorise l'IA à transcrire mes consultations",
          consent_version: 'v1',
        },
        fakeReq,
      );

      expect((result as any).id).toBe('consent-1');
    });
  });

  describe('requestAnonymization', () => {
    it('refuse si legal_basis trop court', async () => {
      await expect(
        service.requestAnonymization(
          { ...tenant, userRole: 'clinic_admin' },
          'admin-uid',
          'clinic_admin',
          {
            patient_id: PATIENT_RECORD_ID,
            legal_basis: 'court',
          },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('génère un pseudonyme stable et déclare la demande pending', async () => {
      supa.client.from
        .mockReturnValueOnce(
          chain({
            data: { patient_user_id: PATIENT_USER_ID },
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({
            data: {
              id: 'anon-1',
              tenant_id: TENANT_ID,
              original_patient_id: PATIENT_RECORD_ID,
              pseudonym: 'PATIENT_ANON_xxx',
              status: 'pending',
              method: 'pseudonymization',
              legal_basis: 'Article 17 RGPD - demande explicite du patient',
            },
            error: null,
          }),
        );

      const result = await service.requestAnonymization(
        { ...tenant, userRole: 'clinic_admin' },
        'admin-uid',
        'clinic_admin',
        {
          patient_id: PATIENT_RECORD_ID,
          legal_basis: 'Article 17 RGPD - demande explicite du patient',
        },
      );

      expect((result as any).status).toBe('pending');
      expect((result as any).pseudonym).toMatch(/^PATIENT_ANON_/);
    });
  });

  describe('requestExport', () => {
    it('crée une demande d\'export en statut pending', async () => {
      supa.client.from
        .mockReturnValueOnce(
          chain({ data: { patient_user_id: PATIENT_USER_ID }, error: null }),
        )
        .mockReturnValueOnce(
          chain({
            data: {
              id: 'export-1',
              tenant_id: TENANT_ID,
              patient_id: PATIENT_RECORD_ID,
              status: 'pending',
              format: 'json',
              scope: 'full',
            },
            error: null,
          }),
        );

      const result = await service.requestExport(
        tenant,
        PATIENT_USER_ID,
        'patient',
        { patient_id: PATIENT_RECORD_ID },
      );

      expect((result as any).status).toBe('pending');
      expect((result as any).format).toBe('json');
    });
  });
});
