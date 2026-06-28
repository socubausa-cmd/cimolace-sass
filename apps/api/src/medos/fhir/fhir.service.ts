import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';

/**
 * MEDOS → HL7 FHIR R4 — façade d'interopérabilité READ-ONLY.
 *
 * Expose les données MEDOS au standard FHIR R4 (sésame hôpital / DMP / DSE).
 * Aucune écriture clinique : ce service ne fait que LIRE et MAPPER.
 *
 * ── Sécurité tenant (leçon C1) ──────────────────────────────────────────
 * Le client Supabase tourne en SERVICE-ROLE → la RLS est contournée.
 * Donc CHAQUE requête filtre `.eq('tenant_id', tenant.id)`, et l'identité
 * du patient demandé est TOUJOURS revalidée contre le tenant via
 * `assertPatientInTenant()` avant de servir la moindre ressource liée.
 * Un patient d'un autre tenant ⇒ 404 (jamais de fuite cross-tenant).
 *
 * Toutes les valeurs renvoyées sont des ressources FHIR R4 valides
 * (resourceType, id, references "Patient/<uuid>", Bundle searchset, …).
 */

// ── Systèmes de codage ────────────────────────────────────────────────────
const LOINC_SYSTEM = 'http://loinc.org';
const SNOMED_SYSTEM = 'http://snomed.info/sct';
const ICD10_SYSTEM = 'http://hl7.org/fhir/sid/icd-10';
/** CodeSystem local pour les biomarqueurs MEDOS sans correspondance LOINC connue. */
const MEDOS_BIOMARKER_SYSTEM = 'https://cimolace.space/fhir/biomarker';

/** Base canonique pour les références d'identité MEDOS (identifiers). */
const MEDOS_IDENTIFIER_SYSTEM = 'https://cimolace.space/fhir/identifier';

// ── Types minimaux des lignes lues (sous-ensemble des colonnes utilisées) ──
type PatientRow = {
  id: string;
  tenant_id: string;
  patient_user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  blood_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type BiomarkerRow = {
  id: string;
  biomarker_code: string;
  value: number;
  unit_raw: string | null;
  value_canonical: number | null;
  flag: string | null;
  measured_at: string;
  created_at: string;
};

type BiomarkerRefRow = {
  code: string;
  name_fr: string;
  unit: string;
  category: string | null;
  loinc_code?: string | null;
};

type HealthEntryRow = {
  id: string;
  entry_date: string;
  weight_kg: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  blood_glucose: number | null;
  temperature: number | null;
  created_at: string;
};

type PrescriptionRow = {
  id: string;
  patient_id: string;
  status: string;
  issued_at: string | null;
  validity_days: number | null;
  patient_instructions: string | null;
  created_at: string;
};

type PrescriptionItemRow = {
  id: string;
  prescription_id: string;
  position: number;
  drug_name: string;
  drug_code: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  quantity: string | null;
  notes: string | null;
};

type AppointmentRow = {
  id: string;
  patient_id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  appointment_type: string;
  reason: string | null;
  status: string;
  consultation_note_id: string | null;
};

// FHIR resources are intentionally loosely typed (open content model).
type FhirResource = Record<string, unknown>;
type FhirBundle = {
  resourceType: 'Bundle';
  type: 'searchset';
  total: number;
  entry: { fullUrl?: string; resource: FhirResource }[];
};

/**
 * Mapping vitals (med_health_entries) → codes LOINC standard.
 * Chaque entrée décrit comment extraire la valeur d'une ligne et la coder.
 */
const VITAL_MAPPINGS: {
  field: keyof HealthEntryRow;
  loinc: string;
  display: string;
  unit: string;
  ucum: string;
}[] = [
  { field: 'weight_kg', loinc: '29463-7', display: 'Body weight', unit: 'kg', ucum: 'kg' },
  { field: 'heart_rate', loinc: '8867-4', display: 'Heart rate', unit: 'beats/minute', ucum: '/min' },
  { field: 'blood_glucose', loinc: '2339-0', display: 'Glucose [Mass/volume] in Blood', unit: 'mg/dL', ucum: 'mg/dL' },
  { field: 'temperature', loinc: '8310-5', display: 'Body temperature', unit: 'Cel', ucum: 'Cel' },
];

@Injectable()
export class FhirService {
  private readonly logger = new Logger(FhirService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // =========================================================================
  // CapabilityStatement (FHIR R4) — /metadata
  // =========================================================================

  /** Décrit la conformité du serveur : ressources READ-ONLY supportées. */
  buildCapabilityStatement(tenant: TenantContext): FhirResource {
    const now = new Date().toISOString();
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: now,
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['application/fhir+json', 'json'],
      publisher: 'Cimolace MEDOS',
      implementation: {
        description: `MEDOS FHIR R4 read-only facade — tenant ${tenant.slug}`,
      },
      software: {
        name: 'Cimolace MEDOS FHIR Facade',
        version: '1.0.0',
      },
      rest: [
        {
          mode: 'server',
          documentation:
            'Façade lecture seule. Authentification par Bearer JWT + header X-Tenant-Slug. Périmètre limité au tenant courant.',
          security: {
            description: 'Bearer JWT (Supabase) + scoping tenant + RBAC (owner/practitioner/clinic_admin).',
          },
          resource: [
            {
              type: 'Patient',
              interaction: [{ code: 'read' }],
              documentation: 'Lecture d’un dossier patient MEDOS (Patient/:id).',
            },
            {
              type: 'Observation',
              interaction: [{ code: 'search-type' }],
              searchParam: [{ name: 'patient', type: 'reference' }],
              documentation:
                'Biomarqueurs (med_patient_biomarkers) + constantes (med_health_entries). ?patient=:id',
            },
            {
              type: 'MedicationRequest',
              interaction: [{ code: 'search-type' }],
              searchParam: [{ name: 'patient', type: 'reference' }],
              documentation: 'Lignes de prescription MEDOS. ?patient=:id',
            },
            {
              type: 'Encounter',
              interaction: [{ code: 'search-type' }],
              searchParam: [{ name: 'patient', type: 'reference' }],
              documentation: 'Rendez-vous MEDOS. ?patient=:id',
            },
          ],
        },
      ],
    };
  }

  // =========================================================================
  // Audit de lecture — med_audit_log (append-only, best-effort)
  // =========================================================================

  /**
   * Trace une LECTURE FHIR dans med_audit_log. Best-effort : une façade de
   * lecture ne doit jamais renvoyer 500 parce que la table d'audit a hoqueté.
   * (Les mutations critiques MEDOS, elles, écrivent l'audit en bloquant.)
   */
  async audit(
    tenant: TenantContext,
    actorId: string,
    resource: 'patient' | 'observation' | 'medication_request' | 'encounter',
    resourceId: string,
    req?: Request,
  ): Promise<void> {
    try {
      const ip =
        (req?.headers['x-forwarded-for'] as string | undefined)
          ?.split(',')[0]
          ?.trim() ??
        req?.socket?.remoteAddress ??
        null;
      const userAgent =
        (req?.headers['user-agent'] as string | undefined) ?? null;

      const { error } = await (this.supabase.client as any)
        .from('med_audit_log')
        .insert({
          tenant_id: tenant.id,
          actor_id: actorId,
          resource: `fhir_${resource}`,
          resource_id: resourceId,
          action: 'read',
          ip_address: ip,
          user_agent: userAgent,
          metadata: { fhir: true, path: req?.url ?? null },
        });
      if (error) {
        this.logger.error(`FHIR audit insert failed: ${error.message}`);
      }
    } catch (err) {
      this.logger.error(
        `FHIR audit threw: ${(err as Error)?.message ?? 'unknown'}`,
      );
    }
  }

  // =========================================================================
  // Sécurité — ownership tenant garanti (service-role ⇒ RLS off ⇒ filtre obligatoire)
  // =========================================================================

  /**
   * Charge un patient en garantissant qu'il appartient au tenant courant.
   * Renvoie la ligne brute (réutilisée par getPatient) ou lève 404.
   *
   * C'EST LE POINT DE CONTRÔLE ANTI-FUITE : tout endpoint lié à un patient
   * (Observation, MedicationRequest, Encounter) passe par ici AVANT de
   * requêter les tables filles, donc un patient d'un autre tenant est
   * indistinguable d'un patient inexistant (404).
   */
  private async assertPatientInTenant(
    tenant: TenantContext,
    patientId: string,
  ): Promise<PatientRow> {
    const { data, error } = await this.supabase.client
      .from('med_patients')
      .select(
        'id, tenant_id, patient_user_id, first_name, last_name, date_of_birth, gender, blood_type, status, created_at, updated_at',
      )
      .eq('tenant_id', tenant.id)
      .eq('id', patientId)
      .maybeSingle();

    if (error) {
      this.logger.error(`assertPatientInTenant query failed: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundException('Patient introuvable');
    }
    return data as unknown as PatientRow;
  }

  // =========================================================================
  // Patient — GET /Patient/:id
  // =========================================================================

  async getPatientResource(
    tenant: TenantContext,
    patientId: string,
  ): Promise<FhirResource> {
    const row = await this.assertPatientInTenant(tenant, patientId);
    return this.mapPatient(row);
  }

  private mapPatient(row: PatientRow): FhirResource {
    const resource: FhirResource = {
      resourceType: 'Patient',
      id: row.id,
      meta: { lastUpdated: row.updated_at, source: 'medos' },
      identifier: [
        {
          use: 'usual',
          system: `${MEDOS_IDENTIFIER_SYSTEM}/patient`,
          value: row.id,
        },
        {
          use: 'secondary',
          system: `${MEDOS_IDENTIFIER_SYSTEM}/patient-user`,
          value: row.patient_user_id,
        },
      ],
      active: row.status === 'active',
      name: [
        {
          use: 'official',
          family: row.last_name,
          given: [row.first_name],
        },
      ],
      gender: this.mapGender(row.gender),
    };
    if (row.date_of_birth) {
      resource.birthDate = row.date_of_birth;
    }
    if (row.status === 'deceased') {
      resource.deceasedBoolean = true;
    }
    return resource;
  }

  /** MEDOS gender → FHIR AdministrativeGender (male|female|other|unknown). */
  private mapGender(gender: string | null): string {
    switch (gender) {
      case 'male':
      case 'female':
      case 'other':
        return gender;
      case 'prefer_not_to_say':
        return 'unknown';
      default:
        return 'unknown';
    }
  }

  // =========================================================================
  // Observation — GET /Observation?patient=:id  (Bundle searchset)
  // =========================================================================

  async searchObservations(
    tenant: TenantContext,
    patientId: string,
  ): Promise<FhirBundle> {
    // Ownership tenant (404 si hors tenant) AVANT toute lecture fille.
    await this.assertPatientInTenant(tenant, patientId);

    const [biomarkers, refs, healthEntries] = await Promise.all([
      this.fetchBiomarkers(tenant, patientId),
      this.fetchBiomarkerRefs(),
      this.fetchHealthEntries(tenant, patientId),
    ]);

    const refByCode = new Map(refs.map((r) => [r.code, r]));

    const observations: FhirResource[] = [];

    // 1) Biomarqueurs labo
    for (const bm of biomarkers) {
      observations.push(
        this.mapBiomarkerObservation(patientId, bm, refByCode.get(bm.biomarker_code)),
      );
    }

    // 2) Constantes (vitals) — une Observation par champ rempli
    for (const entry of healthEntries) {
      // Tension artérielle = 1 Observation composée (systolique + diastolique)
      if (
        entry.blood_pressure_systolic != null ||
        entry.blood_pressure_diastolic != null
      ) {
        observations.push(this.mapBloodPressureObservation(patientId, entry));
      }
      for (const vital of VITAL_MAPPINGS) {
        const value = entry[vital.field] as number | null;
        if (value != null) {
          observations.push(this.mapVitalObservation(patientId, entry, vital, value));
        }
      }
    }

    return this.bundle(observations, 'Observation');
  }

  private async fetchBiomarkers(
    tenant: TenantContext,
    patientId: string,
  ): Promise<BiomarkerRow[]> {
    const { data, error } = await this.supabase.client
      .from('med_patient_biomarkers')
      .select(
        'id, biomarker_code, value, unit_raw, value_canonical, flag, measured_at, created_at',
      )
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('measured_at', { ascending: false });

    if (error) {
      this.logger.error(`fetchBiomarkers failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as unknown as BiomarkerRow[];
  }

  /** Référentiel global des biomarqueurs (tenant_id NULL, lecture seule). */
  private async fetchBiomarkerRefs(): Promise<BiomarkerRefRow[]> {
    const { data, error } = await this.supabase.client
      .from('med_biomarker_refs')
      .select('code, name_fr, unit, category');

    if (error) {
      this.logger.error(`fetchBiomarkerRefs failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as unknown as BiomarkerRefRow[];
  }

  private async fetchHealthEntries(
    tenant: TenantContext,
    patientId: string,
  ): Promise<HealthEntryRow[]> {
    const { data, error } = await this.supabase.client
      .from('med_health_entries')
      .select(
        'id, entry_date, weight_kg, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, blood_glucose, temperature, created_at',
      )
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('entry_date', { ascending: false });

    if (error) {
      this.logger.error(`fetchHealthEntries failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as unknown as HealthEntryRow[];
  }

  private mapBiomarkerObservation(
    patientId: string,
    bm: BiomarkerRow,
    ref: BiomarkerRefRow | undefined,
  ): FhirResource {
    // Si le référentiel porte un code LOINC connu → LOINC ; sinon CodeSystem local.
    const loinc = ref?.loinc_code ?? null;
    const coding = loinc
      ? { system: LOINC_SYSTEM, code: loinc, display: ref?.name_fr ?? bm.biomarker_code }
      : {
          system: MEDOS_BIOMARKER_SYSTEM,
          code: bm.biomarker_code,
          display: ref?.name_fr ?? bm.biomarker_code,
        };

    const unit = bm.unit_raw ?? ref?.unit ?? undefined;

    const resource: FhirResource = {
      resourceType: 'Observation',
      id: bm.id,
      meta: { source: 'medos' },
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
              display: 'Laboratory',
            },
          ],
        },
      ],
      code: { coding: [coding], text: ref?.name_fr ?? bm.biomarker_code },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: this.toDateTime(bm.measured_at),
      valueQuantity: {
        value: bm.value,
        ...(unit ? { unit } : {}),
        system: 'http://unitsofmeasure.org',
        ...(unit ? { code: unit } : {}),
      },
    };

    const interpretation = this.mapFlagInterpretation(bm.flag);
    if (interpretation) {
      resource.interpretation = [interpretation];
    }
    return resource;
  }

  private mapVitalObservation(
    patientId: string,
    entry: HealthEntryRow,
    vital: (typeof VITAL_MAPPINGS)[number],
    value: number,
  ): FhirResource {
    return {
      resourceType: 'Observation',
      id: `${entry.id}-${vital.loinc}`,
      meta: { source: 'medos' },
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [{ system: LOINC_SYSTEM, code: vital.loinc, display: vital.display }],
        text: vital.display,
      },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: this.toDateTime(entry.entry_date),
      valueQuantity: {
        value,
        unit: vital.unit,
        system: 'http://unitsofmeasure.org',
        code: vital.ucum,
      },
    };
  }

  /** Tension artérielle = Observation panel LOINC 85354-9 avec 2 components. */
  private mapBloodPressureObservation(
    patientId: string,
    entry: HealthEntryRow,
  ): FhirResource {
    const components: FhirResource[] = [];
    if (entry.blood_pressure_systolic != null) {
      components.push({
        code: {
          coding: [{ system: LOINC_SYSTEM, code: '8480-6', display: 'Systolic blood pressure' }],
        },
        valueQuantity: {
          value: entry.blood_pressure_systolic,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]',
        },
      });
    }
    if (entry.blood_pressure_diastolic != null) {
      components.push({
        code: {
          coding: [{ system: LOINC_SYSTEM, code: '8462-4', display: 'Diastolic blood pressure' }],
        },
        valueQuantity: {
          value: entry.blood_pressure_diastolic,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]',
        },
      });
    }
    return {
      resourceType: 'Observation',
      id: `${entry.id}-bp`,
      meta: { source: 'medos' },
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [{ system: LOINC_SYSTEM, code: '85354-9', display: 'Blood pressure panel' }],
        text: 'Blood pressure',
      },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: this.toDateTime(entry.entry_date),
      component: components,
    };
  }

  /** Flag MEDOS (low|normal|high|critical) → FHIR observation-interpretation. */
  private mapFlagInterpretation(flag: string | null): FhirResource | null {
    const SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';
    switch (flag) {
      case 'low':
        return { coding: [{ system: SYSTEM, code: 'L', display: 'Low' }] };
      case 'high':
        return { coding: [{ system: SYSTEM, code: 'H', display: 'High' }] };
      case 'critical':
        return { coding: [{ system: SYSTEM, code: 'HH', display: 'Critical high' }] };
      case 'normal':
        return { coding: [{ system: SYSTEM, code: 'N', display: 'Normal' }] };
      default:
        return null;
    }
  }

  // =========================================================================
  // MedicationRequest — GET /MedicationRequest?patient=:id  (Bundle searchset)
  // =========================================================================

  async searchMedicationRequests(
    tenant: TenantContext,
    patientId: string,
  ): Promise<FhirBundle> {
    await this.assertPatientInTenant(tenant, patientId);

    const prescriptions = await this.fetchPrescriptions(tenant, patientId);
    if (prescriptions.length === 0) {
      return this.bundle([], 'MedicationRequest');
    }

    const prescriptionIds = prescriptions.map((p) => p.id);
    const items = await this.fetchPrescriptionItems(tenant, prescriptionIds);
    const presById = new Map(prescriptions.map((p) => [p.id, p]));

    // Une MedicationRequest FHIR par LIGNE de prescription (un médicament).
    const resources = items.map((item) =>
      this.mapMedicationRequest(patientId, item, presById.get(item.prescription_id)),
    );
    return this.bundle(resources, 'MedicationRequest');
  }

  private async fetchPrescriptions(
    tenant: TenantContext,
    patientId: string,
  ): Promise<PrescriptionRow[]> {
    const { data, error } = await (this.supabase.client as any)
      .from('med_prescriptions')
      .select('id, patient_id, status, issued_at, validity_days, patient_instructions, created_at')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('issued_at', { ascending: false });

    if (error) {
      this.logger.error(`fetchPrescriptions failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as PrescriptionRow[];
  }

  private async fetchPrescriptionItems(
    tenant: TenantContext,
    prescriptionIds: string[],
  ): Promise<PrescriptionItemRow[]> {
    const { data, error } = await (this.supabase.client as any)
      .from('med_prescription_items')
      .select(
        'id, prescription_id, position, drug_name, drug_code, dosage, frequency, duration, route, quantity, notes',
      )
      .eq('tenant_id', tenant.id)
      .in('prescription_id', prescriptionIds)
      .order('position', { ascending: true });

    if (error) {
      this.logger.error(`fetchPrescriptionItems failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as PrescriptionItemRow[];
  }

  private mapMedicationRequest(
    patientId: string,
    item: PrescriptionItemRow,
    prescription: PrescriptionRow | undefined,
  ): FhirResource {
    const dosageText = [item.dosage, item.frequency, item.duration]
      .filter(Boolean)
      .join(' — ');

    const medicationCoding: FhirResource[] = [];
    if (item.drug_code) {
      // drug_code = ATC ou code interne ; on l'expose en ATC WHO.
      medicationCoding.push({
        system: 'http://www.whocc.no/atc',
        code: item.drug_code,
        display: item.drug_name,
      });
    }

    const dosageInstruction: FhirResource = {
      text: dosageText || item.drug_name,
    };
    if (item.route) {
      dosageInstruction.route = { text: item.route };
    }
    if (item.notes) {
      dosageInstruction.patientInstruction = item.notes;
    }

    const resource: FhirResource = {
      resourceType: 'MedicationRequest',
      id: item.id,
      meta: { source: 'medos' },
      status: this.mapPrescriptionStatus(prescription?.status),
      intent: 'order',
      medicationCodeableConcept: {
        ...(medicationCoding.length ? { coding: medicationCoding } : {}),
        text: item.drug_name,
      },
      subject: { reference: `Patient/${patientId}` },
      dosageInstruction: [dosageInstruction],
    };

    if (prescription?.issued_at) {
      resource.authoredOn = prescription.issued_at;
    }
    if (prescription?.id) {
      // Traçabilité : toutes les lignes d'une même ordonnance partagent ce groupe.
      resource.groupIdentifier = {
        system: `${MEDOS_IDENTIFIER_SYSTEM}/prescription`,
        value: prescription.id,
      };
    }
    if (item.quantity) {
      resource.dispenseRequest = { quantity: { value: 1, unit: item.quantity } };
    }
    return resource;
  }

  /** Statut prescription MEDOS → FHIR MedicationRequest.status. */
  private mapPrescriptionStatus(status: string | undefined): string {
    switch (status) {
      case 'signed':
      case 'dispensed':
        return 'active';
      case 'cancelled':
        return 'cancelled';
      case 'draft':
        return 'draft';
      default:
        return 'unknown';
    }
  }

  // =========================================================================
  // Encounter — GET /Encounter?patient=:id  (Bundle searchset)
  // =========================================================================

  async searchEncounters(
    tenant: TenantContext,
    patientId: string,
  ): Promise<FhirBundle> {
    await this.assertPatientInTenant(tenant, patientId);

    const appointments = await this.fetchAppointments(tenant, patientId);
    const resources = appointments.map((appt) => this.mapEncounter(patientId, appt));
    return this.bundle(resources, 'Encounter');
  }

  private async fetchAppointments(
    tenant: TenantContext,
    patientId: string,
  ): Promise<AppointmentRow[]> {
    const { data, error } = await (this.supabase.client as any)
      .from('med_appointments')
      .select(
        'id, patient_id, scheduled_at, duration_minutes, appointment_type, reason, status, consultation_note_id',
      )
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('scheduled_at', { ascending: false });

    if (error) {
      this.logger.error(`fetchAppointments failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as AppointmentRow[];
  }

  private mapEncounter(patientId: string, appt: AppointmentRow): FhirResource {
    const start = appt.scheduled_at;
    const end =
      appt.duration_minutes && start
        ? new Date(
            new Date(start).getTime() + appt.duration_minutes * 60_000,
          ).toISOString()
        : undefined;

    const resource: FhirResource = {
      resourceType: 'Encounter',
      id: appt.id,
      meta: { source: 'medos' },
      status: this.mapEncounterStatus(appt.status),
      class: this.mapEncounterClass(appt.appointment_type),
      subject: { reference: `Patient/${patientId}` },
      period: { start, ...(end ? { end } : {}) },
    };

    if (appt.reason) {
      resource.reasonCode = [{ text: appt.reason }];
    }
    if (appt.consultation_note_id) {
      // Lien souple vers la note de consultation (DocumentReference logique).
      resource.identifier = [
        {
          system: `${MEDOS_IDENTIFIER_SYSTEM}/consultation-note`,
          value: appt.consultation_note_id,
        },
      ];
    }
    return resource;
  }

  /** Statut RDV MEDOS → FHIR Encounter.status. */
  private mapEncounterStatus(status: string): string {
    switch (status) {
      case 'requested':
        return 'planned';
      case 'confirmed':
      case 'rescheduled':
        return 'planned';
      case 'completed':
        return 'finished';
      case 'cancelled':
        return 'cancelled';
      case 'no_show':
        return 'cancelled';
      default:
        return 'unknown';
    }
  }

  /** Type RDV MEDOS → FHIR v3 ActEncounterCode (class). */
  private mapEncounterClass(type: string): FhirResource {
    const SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ActCode';
    switch (type) {
      case 'in_person':
        return { system: SYSTEM, code: 'AMB', display: 'ambulatory' };
      case 'home_visit':
        return { system: SYSTEM, code: 'HH', display: 'home health' };
      case 'teleconsult':
      case 'phone':
        return { system: SYSTEM, code: 'VR', display: 'virtual' };
      default:
        return { system: SYSTEM, code: 'AMB', display: 'ambulatory' };
    }
  }

  // =========================================================================
  // Helpers communs
  // =========================================================================

  /** Construit un Bundle FHIR R4 searchset avec fullUrl par entrée. */
  private bundle(resources: FhirResource[], resourceType: string): FhirBundle {
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: resources.length,
      entry: resources.map((resource) => ({
        fullUrl: `${resourceType}/${(resource as { id?: string }).id ?? ''}`,
        resource,
      })),
    };
  }

  /**
   * Normalise une DATE (YYYY-MM-DD) ou un timestamptz en dateTime FHIR.
   * Les colonnes `measured_at` / `entry_date` sont des DATE → on garde le
   * format date pur (valide en FHIR pour effectiveDateTime).
   */
  private toDateTime(value: string): string {
    return value;
  }

  // Systèmes exposés pour les tests / la documentation.
  static readonly SYSTEMS = {
    LOINC: LOINC_SYSTEM,
    SNOMED: SNOMED_SYSTEM,
    ICD10: ICD10_SYSTEM,
    MEDOS_BIOMARKER: MEDOS_BIOMARKER_SYSTEM,
    MEDOS_IDENTIFIER: MEDOS_IDENTIFIER_SYSTEM,
  };
}
