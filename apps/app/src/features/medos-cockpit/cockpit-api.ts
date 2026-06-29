// ─────────────────────────────────────────────────────────────────────────────
// Cockpit clinique téléconsult — client + types
//
// Réutilise l'instance axios `api` (déjà câblée : Authorization Bearer +
// X-Tenant-Slug via intercepteur). AUCUN accès localStorage, AUCUN client
// dupliqué. Sert le COCKPIT partagé (jumeau 3D / SOAP / graphiques) côté
// studio (praticien) — le patient, lui, ne fetch RIEN : il reçoit les vues
// déjà résolues via le canal de partage Realtime (cf. useCockpitChannel).
// ─────────────────────────────────────────────────────────────────────────────
import { api, medosApi, prescriptionsApi, attachmentsApi, clinicalApi } from '@/lib/api';

// Certaines routes /med/* renvoient { data } (enveloppe globale), d'autres la
// donnée brute. `peelData` pèle au plus une couche, défensivement.
const peelData = (r: any): any => (r?.data?.data !== undefined ? r.data.data : r?.data);

export type OrganColor = 'green' | 'yellow' | 'orange' | 'red';

export type OrganNode = {
  code: string;
  name_fr: string;
  position: { x: number; y: number; z: number } | null;
  score: { score: number; color: OrganColor } | null;
};

export const COLOR_HEX: Record<OrganColor, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
};
export const COLOR_LABEL: Record<OrganColor, string> = {
  green: 'Optimal',
  yellow: 'À surveiller',
  orange: 'Sub-optimal',
  red: 'Critique',
};

export const WHEEL_LABELS: Record<string, string> = {
  digestion: 'Digestion', sleep: 'Sommeil', stress: 'Stress', energy: 'Énergie',
  inflammation: 'Inflammation', immunity: 'Immunité', metabolism: 'Métabolisme',
  hormones: 'Hormones', physical_activity: 'Activité physique', cognition: 'Cognition',
  environment: 'Environnement', emotions: 'Émotions',
};

export interface ClinicalContext {
  session_id: string;
  patient_id: string;
  patient_name: string;
  sex: 'female' | 'male';
  practitioner_id: string;
  appointment_id: string | null;
  role: 'host' | 'patient';
}

export interface WheelDomain {
  domain: string;
  score: number;
}

export interface SoapNote {
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  is_signed?: boolean;
  created_at?: string | null;
}

export interface LabResult {
  id?: string;
  test_name?: string; name?: string; label?: string; code?: string; lab_name?: string | null;
  value_numeric?: number | null; value_text?: string | null; value?: string | number | null; unit?: string | null;
  taken_at?: string | null; reported_at?: string | null;
  result_date?: string | null; date?: string | null; created_at?: string | null;
  reference_low?: number | null; reference_high?: number | null; reference_range?: string | null;
  flag?: string | null; interpretation?: string | null;
}
export interface RxItem {
  drug_name: string; dosage?: string | null; frequency?: string | null;
  duration?: string | null; route?: string | null; quantity?: string | null; notes?: string | null;
}
export interface RxDoc {
  id: string; prescription_number?: string | null; issued_at?: string | null;
  patient_instructions?: string | null; items?: RxItem[];
}
export interface AttachmentLite {
  id: string; file_name: string; mime_type?: string | null; created_at?: string | null;
}

// ── Descripteur de scène partagée (host → patient via Realtime) ──────────────
// Volontairement SELF-CONTAINED : le patient rend la scène sans aucun appel
// API (le jumeau est déjà résolu en OrganNode[], la SOAP porte son texte).
export type CockpitScene =
  | { kind: 'twin'; sex: 'female' | 'male'; organs: OrganNode[]; focus: string | null }
  | { kind: 'wheel'; domains: WheelDomain[]; organs: Array<{ code: string; name_fr: string; score: { score: number; color: OrganColor } | null }> }
  | { kind: 'soap'; soap: SoapNote }
  | { kind: 'labs'; items: LabResult[] }
  | { kind: 'prescription'; rx: RxDoc }
  | { kind: 'image'; url: string; name: string; mime?: string }
  | { kind: 'clear' };

// ── Appels API (host uniquement) ────────────────────────────────────────────

export function getClinicalContext(sessionId: string): Promise<ClinicalContext> {
  return api.get(`/med/teleconsult/${sessionId}/clinical-context`).then(peelData);
}

export function getReferential(): Promise<{ organs: any[]; biomarkers: any[] }> {
  return api.get('/med/twin/referential').then(peelData);
}

export function getTwinState(patientId: string): Promise<{
  organs: Array<{ code: string; score: { score: number; color: OrganColor } | null }>;
  biomarkers: any[];
  wheel: { domains: WheelDomain[] } | null;
}> {
  return api.get(`/med/twin/${patientId}/state`).then(peelData);
}

/** Dernière note de consultation du patient (SOAP), ou null s'il n'y en a pas. */
export async function getLatestSoap(patientId: string): Promise<SoapNote | null> {
  const notes = await medosApi.listNotes(patientId).catch(() => [] as any[]);
  if (!Array.isArray(notes) || notes.length === 0) return null;
  // listNotes est déjà trié du plus récent au plus ancien côté API ; on prend
  // la première note non vide (au moins une section renseignée).
  const latest =
    notes.find(
      (n: any) => n.subjective || n.objective || n.assessment || n.plan,
    ) || notes[0];
  return {
    subjective: latest.subjective ?? null,
    objective: latest.objective ?? null,
    assessment: latest.assessment ?? null,
    plan: latest.plan ?? null,
    is_signed: !!latest.is_signed,
    created_at: latest.created_at ?? null,
  };
}

/** Fusionne référentiel (name_fr, position) + état (scores) → OrganNode[]. */
export function buildOrganNodes(
  referential: { organs?: any[] } | null,
  state: { organs?: any[] } | null,
): OrganNode[] {
  const scoreByCode = new Map<string, OrganNode['score']>(
    (state?.organs || []).map((o: any) => [o.code, o.score || null]),
  );
  const source =
    referential?.organs && referential.organs.length
      ? referential.organs
      : state?.organs || [];
  return source.map((o: any) => ({
    code: o.code,
    name_fr: o.name_fr || o.code,
    position: o.position ?? null,
    score: scoreByCode.get(o.code) || o.score || null,
  }));
}

// ── Palette du composer de consultation (Phase 2b) ──────────────────────────
// Réutilise les clients déjà câblés de @/lib/api (auth + tenant via intercepteur).

/** Bilans / résultats de labo du patient (pour partage en consultation). */
export function getLabs(patientId: string): Promise<LabResult[]> {
  return clinicalApi.labResults
    .listForPatient(patientId)
    .then((r: any) => (Array.isArray(r) ? r : []))
    .catch(() => []);
}

/** Ordonnances SIGNÉES du patient (les plus récentes d'abord). */
export function getSignedPrescriptions(patientId: string): Promise<RxDoc[]> {
  return prescriptionsApi
    .list({ patient_id: patientId, status: 'signed' })
    .then((r: any) => (Array.isArray(r) ? r : []))
    .catch(() => []);
}

/** Pièces jointes du patient (imagerie / scan / PDF) à partager. */
export function getAttachments(patientId: string): Promise<AttachmentLite[]> {
  return attachmentsApi
    .listForPatient(patientId)
    .then((r: any) => (Array.isArray(r) ? r : []))
    .catch(() => []);
}

/** URL de téléchargement signée d'une pièce jointe (pour l'afficher en partage). */
export function getAttachmentUrl(id: string): Promise<string> {
  return attachmentsApi
    .getDownloadUrl(id)
    .then((r: any) => r?.download_url || r?.url || '')
    .catch(() => '');
}
