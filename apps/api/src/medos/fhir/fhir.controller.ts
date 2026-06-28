import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SkipResponseWrapper } from '../../common/decorators/skip-response-wrapper.decorator';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import { TenantGuard } from '../../tenant/tenant.guard';
import type { TenantContext } from '../../tenant/tenant.types';
import { MedosEnabledGuard } from '../medos-enabled.guard';
import { FhirService } from './fhir.service';

interface AuthRequest extends Request {
  user: { id: string; email?: string };
}

const PATIENT_REF = /^(?:Patient\/)?([0-9a-f-]{36})$/i;
const FHIR_JSON = 'application/fhir+json; charset=utf-8';

/**
 * MEDOS — Façade FHIR R4 (READ-ONLY).
 *
 * Expose les données MEDOS au standard HL7 FHIR R4 pour l'interopérabilité
 * hôpital / DMP / DSE. Aucune écriture.
 *
 * ── Gardes ──────────────────────────────────────────────────────────────
 *  - JwtAuthGuard      : Bearer JWT Supabase obligatoire.
 *  - TenantGuard       : résout le tenant via X-Tenant-Slug + le rôle.
 *  - MedosEnabledGuard : MEDOS doit être activé pour ce tenant.
 *  - RolesGuard        : owner | practitioner | clinic_admin uniquement.
 *
 * ── Réponse FHIR-pure ───────────────────────────────────────────────────
 *  @SkipResponseWrapper() exclut ces routes de l'enveloppe globale {data:…}
 *  (ResponseInterceptor) → le corps EST la ressource/Bundle FHIR.
 *  @Header pose Content-Type: application/fhir+json.
 *
 * ── Sécurité tenant (leçon C1) ──────────────────────────────────────────
 *  Le service tourne en service-role (RLS off) ; chaque requête filtre
 *  `.eq('tenant_id', tenant.id)` et revalide l'appartenance du patient
 *  (404 sinon). Audit de lecture écrit dans med_audit_log (best-effort).
 */
@ApiTags('MedOS — FHIR R4 (interopérabilité, lecture seule)')
@ApiBearerAuth()
@Controller('med/fhir')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard, RolesGuard)
@Roles('owner', 'practitioner', 'clinic_admin')
@SkipResponseWrapper()
export class FhirController {
  constructor(private readonly fhir: FhirService) {}

  /** CapabilityStatement — déclare les ressources READ-ONLY supportées. */
  @Get('metadata')
  @Header('Content-Type', FHIR_JSON)
  metadata(@CurrentTenant() tenant: TenantContext) {
    return this.fhir.buildCapabilityStatement(tenant);
  }

  /** Patient/:id — dossier patient FHIR. */
  @Get('Patient/:id')
  @Header('Content-Type', FHIR_JSON)
  async getPatient(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    const resource = await this.fhir.getPatientResource(tenant, id);
    await this.fhir.audit(tenant, req.user.id, 'patient', id, req);
    return resource;
  }

  /** Observation?patient=:id — Bundle searchset (biomarqueurs + vitals). */
  @Get('Observation')
  @Header('Content-Type', FHIR_JSON)
  async searchObservations(
    @Query('patient') patient: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    const patientId = this.parsePatientRef(patient);
    const bundle = await this.fhir.searchObservations(tenant, patientId);
    await this.fhir.audit(tenant, req.user.id, 'observation', patientId, req);
    return bundle;
  }

  /** MedicationRequest?patient=:id — Bundle searchset. */
  @Get('MedicationRequest')
  @Header('Content-Type', FHIR_JSON)
  async searchMedicationRequests(
    @Query('patient') patient: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    const patientId = this.parsePatientRef(patient);
    const bundle = await this.fhir.searchMedicationRequests(tenant, patientId);
    await this.fhir.audit(tenant, req.user.id, 'medication_request', patientId, req);
    return bundle;
  }

  /** Encounter?patient=:id — Bundle searchset. */
  @Get('Encounter')
  @Header('Content-Type', FHIR_JSON)
  async searchEncounters(
    @Query('patient') patient: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
  ) {
    const patientId = this.parsePatientRef(patient);
    const bundle = await this.fhir.searchEncounters(tenant, patientId);
    await this.fhir.audit(tenant, req.user.id, 'encounter', patientId, req);
    return bundle;
  }

  /**
   * Accepte `?patient=<uuid>` ou `?patient=Patient/<uuid>` (référence FHIR).
   * Param manquant/malformé ⇒ 404 (on ne révèle rien sans cible valide).
   */
  private parsePatientRef(patient: string | undefined): string {
    const m = patient ? PATIENT_REF.exec(patient.trim()) : null;
    if (!m) {
      throw new NotFoundException(
        'Paramètre "patient" requis (UUID ou référence Patient/<id>)',
      );
    }
    return m[1];
  }
}
