'use strict';
/**
 * Tests unitaires — FhirService (façade MEDOS → HL7 FHIR R4, READ-ONLY).
 *
 * Garde-fous couverts :
 *  - SÉCURITÉ TENANT (leçon C1) : chaque lecture filtre tenant_id ; un patient
 *    d'un autre tenant ⇒ 404 (assertPatientInTenant) — pas de fuite cross-tenant ;
 *  - ressources FHIR R4 VALIDES : resourceType, references "Patient/<id>",
 *    Bundle searchset (type/total/entry) ;
 *  - mappings : Patient (gender/identifier), Observation biomarqueur (CodeSystem
 *    local) + vitals LOINC + tension (panel 85354-9), MedicationRequest (status),
 *    Encounter (class/status) ;
 *  - CapabilityStatement (/metadata) liste les 4 ressources.
 *
 * Runner node:test (zéro dépendance), cible le code compilé `dist/`.
 *   npm run build && npm run test:unit      (depuis apps/api)
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const { NotFoundException } = require('@nestjs/common');
const { FhirService } = require('../dist/medos/fhir/fhir.service.js');

const TENANT = { id: 'T1', slug: 'demo', name: 'Demo', plan: 'pro', status: 'active', primary_domain: null, logo_url: null, brand_colors: null, userRole: 'practitioner' };
const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

const PATIENT_ROW = {
  id: PATIENT_ID,
  tenant_id: 'T1',
  patient_user_id: '22222222-2222-2222-2222-222222222222',
  first_name: 'Awa',
  last_name: 'Diop',
  date_of_birth: '1990-05-14',
  gender: 'female',
  blood_type: 'O+',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
};

/**
 * Faux client Supabase chainable. On route la réponse selon la table.
 * `terminal()` est renvoyé par .maybeSingle() ET par .order() (qui termine
 * les listes) — pour med_patients on renvoie la ligne unique, sinon la liste.
 */
function makeDb(opts = {}) {
  const {
    patient = PATIENT_ROW,
    biomarkers = [],
    refs = [],
    health = [],
    prescriptions = [],
    items = [],
    appointments = [],
    auditSink = [],
  } = opts;

  return {
    from(table) {
      const b = {};
      const chain = () => b;
      b._table = table;
      b.select = chain;
      b.eq = chain;
      b.in = chain;
      b.insert = (row) => {
        auditSink.push({ table, row });
        return Promise.resolve({ data: null, error: null });
      };
      b.maybeSingle = () =>
        Promise.resolve({ data: table === 'med_patients' ? patient : null, error: null });
      b.order = () => {
        switch (table) {
          case 'med_patient_biomarkers':
            return Promise.resolve({ data: biomarkers, error: null });
          case 'med_health_entries':
            return Promise.resolve({ data: health, error: null });
          case 'med_prescriptions':
            return Promise.resolve({ data: prescriptions, error: null });
          case 'med_prescription_items':
            return Promise.resolve({ data: items, error: null });
          case 'med_appointments':
            return Promise.resolve({ data: appointments, error: null });
          default:
            return Promise.resolve({ data: [], error: null });
        }
      };
      // med_biomarker_refs : .select() est terminal (pas de .eq/.order) →
      // on rend `b` thenable pour qu'`await query` résolve la liste.
      if (table === 'med_biomarker_refs') {
        b.then = (resolve) => resolve({ data: refs, error: null });
      }
      return b;
    },
  };
}

function makeService(dbOpts) {
  const supabase = { client: makeDb(dbOpts) };
  return new FhirService(supabase);
}

// ── Patient ────────────────────────────────────────────────────────────────

test('Patient — ressource FHIR valide (resourceType, name, gender, birthDate, identifier)', async () => {
  const svc = makeService();
  const p = await svc.getPatientResource(TENANT, PATIENT_ID);
  assert.equal(p.resourceType, 'Patient');
  assert.equal(p.id, PATIENT_ID);
  assert.equal(p.gender, 'female');
  assert.equal(p.birthDate, '1990-05-14');
  assert.equal(p.name[0].family, 'Diop');
  assert.deepEqual(p.name[0].given, ['Awa']);
  assert.equal(p.active, true);
  assert.ok(Array.isArray(p.identifier) && p.identifier.length >= 1);
  assert.equal(p.identifier[0].value, PATIENT_ID);
});

test('Patient — gender prefer_not_to_say → unknown', async () => {
  const svc = makeService({ patient: { ...PATIENT_ROW, gender: 'prefer_not_to_say' } });
  const p = await svc.getPatientResource(TENANT, PATIENT_ID);
  assert.equal(p.gender, 'unknown');
});

// ── SÉCURITÉ TENANT (leçon C1) ───────────────────────────────────────────────

test('Patient — 404 quand le patient n’appartient pas au tenant (pas de fuite cross-tenant)', async () => {
  const svc = makeService({ patient: null }); // simule un .eq(tenant_id) qui ne matche pas
  await assert.rejects(
    () => svc.getPatientResource(TENANT, PATIENT_ID),
    (e) => e instanceof NotFoundException,
  );
});

test('Observation — 404 (ownership) AVANT toute lecture des biomarqueurs', async () => {
  const svc = makeService({ patient: null, biomarkers: [{ id: 'leak' }] });
  await assert.rejects(
    () => svc.searchObservations(TENANT, PATIENT_ID),
    (e) => e instanceof NotFoundException,
  );
});

test('MedicationRequest & Encounter — 404 (ownership) si patient hors tenant', async () => {
  const svc = makeService({ patient: null, prescriptions: [{ id: 'x' }], appointments: [{ id: 'y' }] });
  await assert.rejects(() => svc.searchMedicationRequests(TENANT, PATIENT_ID), (e) => e instanceof NotFoundException);
  await assert.rejects(() => svc.searchEncounters(TENANT, PATIENT_ID), (e) => e instanceof NotFoundException);
});

// ── Observation : biomarqueurs ──────────────────────────────────────────────

test('Observation — biomarqueur sans LOINC connu → CodeSystem local + valueQuantity + subject ref', async () => {
  const svc = makeService({
    biomarkers: [
      { id: 'B1', biomarker_code: 'CRP_HS', value: 3.2, unit_raw: 'mg/L', value_canonical: 3.2, flag: 'high', measured_at: '2026-03-10', created_at: '2026-03-10T00:00:00Z' },
    ],
    refs: [{ code: 'CRP_HS', name_fr: 'CRP ultrasensible', unit: 'mg/L', category: 'inflammation' }],
  });
  const bundle = await svc.searchObservations(TENANT, PATIENT_ID);
  assert.equal(bundle.resourceType, 'Bundle');
  assert.equal(bundle.type, 'searchset');
  assert.equal(bundle.total, 1);
  const obs = bundle.entry[0].resource;
  assert.equal(obs.resourceType, 'Observation');
  assert.equal(obs.status, 'final');
  assert.equal(obs.subject.reference, `Patient/${PATIENT_ID}`);
  assert.equal(obs.code.coding[0].system, 'https://cimolace.space/fhir/biomarker');
  assert.equal(obs.code.coding[0].code, 'CRP_HS');
  assert.equal(obs.code.coding[0].display, 'CRP ultrasensible');
  assert.equal(obs.valueQuantity.value, 3.2);
  assert.equal(obs.valueQuantity.unit, 'mg/L');
  assert.equal(obs.effectiveDateTime, '2026-03-10');
  assert.equal(obs.interpretation[0].coding[0].code, 'H');
});

// ── Observation : vitals (med_health_entries) ───────────────────────────────

test('Observation — vitals mappés sur codes LOINC standard (poids, FC, glycémie, température)', async () => {
  const svc = makeService({
    health: [
      {
        id: 'H1', entry_date: '2026-03-12',
        weight_kg: 72.5, blood_pressure_systolic: null, blood_pressure_diastolic: null,
        heart_rate: 64, blood_glucose: 95, temperature: 37.1, created_at: '2026-03-12T00:00:00Z',
      },
    ],
  });
  const bundle = await svc.searchObservations(TENANT, PATIENT_ID);
  const byLoinc = {};
  for (const e of bundle.entry) {
    const c = e.resource.code.coding[0];
    if (c.system === 'http://loinc.org') byLoinc[c.code] = e.resource;
  }
  assert.ok(byLoinc['29463-7'], 'body weight 29463-7');
  assert.equal(byLoinc['29463-7'].valueQuantity.value, 72.5);
  assert.equal(byLoinc['29463-7'].valueQuantity.code, 'kg');
  assert.ok(byLoinc['8867-4'], 'heart rate 8867-4');
  assert.ok(byLoinc['2339-0'], 'glucose 2339-0');
  assert.ok(byLoinc['8310-5'], 'temperature 8310-5');
  // vital-signs category
  assert.equal(byLoinc['29463-7'].category[0].coding[0].code, 'vital-signs');
});

test('Observation — tension artérielle = panel LOINC 85354-9 avec 2 components (8480-6 / 8462-4)', async () => {
  const svc = makeService({
    health: [
      {
        id: 'H2', entry_date: '2026-03-12',
        weight_kg: null, blood_pressure_systolic: 128, blood_pressure_diastolic: 82,
        heart_rate: null, blood_glucose: null, temperature: null, created_at: '2026-03-12T00:00:00Z',
      },
    ],
  });
  const bundle = await svc.searchObservations(TENANT, PATIENT_ID);
  assert.equal(bundle.total, 1);
  const bp = bundle.entry[0].resource;
  assert.equal(bp.code.coding[0].code, '85354-9');
  const codes = bp.component.map((c) => c.code.coding[0].code).sort();
  assert.deepEqual(codes, ['8462-4', '8480-6']);
  const sys = bp.component.find((c) => c.code.coding[0].code === '8480-6');
  assert.equal(sys.valueQuantity.value, 128);
  assert.equal(sys.valueQuantity.code, 'mm[Hg]');
});

// ── MedicationRequest ───────────────────────────────────────────────────────

test('MedicationRequest — une requête par ligne, status mappé, dosageInstruction, subject ref', async () => {
  const svc = makeService({
    prescriptions: [
      { id: 'RX1', patient_id: PATIENT_ID, status: 'signed', issued_at: '2026-03-01T10:00:00Z', validity_days: 90, patient_instructions: 'cure 7j', created_at: '2026-03-01T10:00:00Z' },
    ],
    items: [
      { id: 'IT1', prescription_id: 'RX1', position: 0, drug_name: 'Paracétamol 1000mg', drug_code: 'N02BE01', dosage: '1 comprimé', frequency: '3 fois/jour', duration: '5 jours', route: 'oral', quantity: '1 boîte de 16', notes: 'pendant les repas', is_substitutable: true },
    ],
  });
  const bundle = await svc.searchMedicationRequests(TENANT, PATIENT_ID);
  assert.equal(bundle.resourceType, 'Bundle');
  assert.equal(bundle.total, 1);
  const mr = bundle.entry[0].resource;
  assert.equal(mr.resourceType, 'MedicationRequest');
  assert.equal(mr.status, 'active'); // signed → active
  assert.equal(mr.intent, 'order');
  assert.equal(mr.subject.reference, `Patient/${PATIENT_ID}`);
  assert.equal(mr.medicationCodeableConcept.text, 'Paracétamol 1000mg');
  assert.equal(mr.medicationCodeableConcept.coding[0].system, 'http://www.whocc.no/atc');
  assert.equal(mr.medicationCodeableConcept.coding[0].code, 'N02BE01');
  assert.ok(mr.dosageInstruction[0].text.includes('1 comprimé'));
  assert.equal(mr.dosageInstruction[0].route.text, 'oral');
  assert.equal(mr.authoredOn, '2026-03-01T10:00:00Z');
  assert.equal(mr.groupIdentifier.value, 'RX1');
});

test('MedicationRequest — prescription cancelled → status cancelled ; draft → draft', async () => {
  const mk = (status, presId) => makeService({
    prescriptions: [{ id: presId, patient_id: PATIENT_ID, status, issued_at: null, validity_days: 90, patient_instructions: null, created_at: 'x' }],
    items: [{ id: `${presId}-i`, prescription_id: presId, position: 0, drug_name: 'X', drug_code: null, dosage: 'a', frequency: 'b', duration: 'c', route: null, quantity: null, notes: null, is_substitutable: true }],
  });
  const cancelled = await mk('cancelled', 'RXC').searchMedicationRequests(TENANT, PATIENT_ID);
  assert.equal(cancelled.entry[0].resource.status, 'cancelled');
  const draft = await mk('draft', 'RXD').searchMedicationRequests(TENANT, PATIENT_ID);
  assert.equal(draft.entry[0].resource.status, 'draft');
});

test('MedicationRequest — aucune prescription → Bundle vide (total 0)', async () => {
  const svc = makeService({ prescriptions: [] });
  const bundle = await svc.searchMedicationRequests(TENANT, PATIENT_ID);
  assert.equal(bundle.total, 0);
  assert.deepEqual(bundle.entry, []);
});

// ── Encounter ───────────────────────────────────────────────────────────────

test('Encounter — class/status mappés, period.start/end, subject ref', async () => {
  const svc = makeService({
    appointments: [
      { id: 'AP1', patient_id: PATIENT_ID, scheduled_at: '2026-03-20T09:00:00.000Z', duration_minutes: 30, appointment_type: 'teleconsult', reason: 'suivi', status: 'completed', consultation_note_id: '33333333-3333-3333-3333-333333333333' },
    ],
  });
  const bundle = await svc.searchEncounters(TENANT, PATIENT_ID);
  assert.equal(bundle.total, 1);
  const enc = bundle.entry[0].resource;
  assert.equal(enc.resourceType, 'Encounter');
  assert.equal(enc.status, 'finished'); // completed → finished
  assert.equal(enc.class.code, 'VR'); // teleconsult → virtual
  assert.equal(enc.subject.reference, `Patient/${PATIENT_ID}`);
  assert.equal(enc.period.start, '2026-03-20T09:00:00.000Z');
  assert.equal(enc.period.end, '2026-03-20T09:30:00.000Z'); // +30min
  assert.equal(enc.reasonCode[0].text, 'suivi');
});

test('Encounter — in_person → AMB ; requested → planned', async () => {
  const svc = makeService({
    appointments: [
      { id: 'AP2', patient_id: PATIENT_ID, scheduled_at: '2026-03-21T09:00:00.000Z', duration_minutes: null, appointment_type: 'in_person', reason: null, status: 'requested', consultation_note_id: null },
    ],
  });
  const bundle = await svc.searchEncounters(TENANT, PATIENT_ID);
  const enc = bundle.entry[0].resource;
  assert.equal(enc.class.code, 'AMB');
  assert.equal(enc.status, 'planned');
  assert.equal(enc.period.end, undefined); // pas de durée → pas de end
});

// ── CapabilityStatement ─────────────────────────────────────────────────────

test('metadata — CapabilityStatement R4 listant Patient/Observation/MedicationRequest/Encounter', () => {
  const svc = makeService();
  const cap = svc.buildCapabilityStatement(TENANT);
  assert.equal(cap.resourceType, 'CapabilityStatement');
  assert.equal(cap.status, 'active');
  assert.equal(cap.fhirVersion, '4.0.1');
  const types = cap.rest[0].resource.map((r) => r.type).sort();
  assert.deepEqual(types, ['Encounter', 'MedicationRequest', 'Observation', 'Patient']);
});

// ── Audit best-effort ───────────────────────────────────────────────────────

test('audit — écrit une entrée fhir_* action=read dans med_audit_log', async () => {
  const sink = [];
  const supabase = { client: makeDb({ auditSink: sink }) };
  const svc = new FhirService(supabase);
  await svc.audit(TENANT, 'U1', 'observation', PATIENT_ID, undefined);
  assert.equal(sink.length, 1);
  assert.equal(sink[0].table, 'med_audit_log');
  assert.equal(sink[0].row.resource, 'fhir_observation');
  assert.equal(sink[0].row.action, 'read');
  assert.equal(sink[0].row.tenant_id, 'T1');
});
