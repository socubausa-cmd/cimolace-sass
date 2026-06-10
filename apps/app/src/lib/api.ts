import axios from "axios";
import { getApiBaseUrl } from "./apiBase";
import { authStore } from "./auth-store";

export const api = axios.create({ baseURL: getApiBaseUrl() });

type ApiEnvelope<T> = { data: T };

interface RawLive {
  id: string;
  title: string;
  scheduled_at: string;
  price_cents: number;
  currency: string;
  capacity: number | null;
  status: string;
}

api.interceptors.request.use((config) => {
  const token = authStore.getToken();
  const slug = authStore.getTenantSlug();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (slug) config.headers["X-Tenant-Slug"] = slug;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: unknown) => {
    if (axios.isAxiosError(err) && err.response) {
      const data = err.response.data as
        | { error?: { code?: string; message?: string } }
        | undefined;
      const msg = data?.error?.message ?? err.message;
      return Promise.reject(new Error(msg));
    }
    return Promise.reject(err);
  },
);

// --- Typed helpers ---

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_domain?: string;
  infrastructure_type?: string | null;
}

export interface Live {
  id: string;
  title: string;
  scheduledAt: string;
  priceCents: number;
  currency: string;
  capacity: number;
  status: string;
}

function unwrap<T>(response: { data: ApiEnvelope<T> }): T {
  return response.data.data;
}

function mapLive(raw: RawLive): Live {
  return {
    id: raw.id,
    title: raw.title,
    scheduledAt: raw.scheduled_at,
    priceCents: raw.price_cents,
    currency: raw.currency,
    capacity: raw.capacity ?? 0,
    status: raw.status,
  };
}

export const tenantsApi = {
  create: (body: { name: string; slug: string }) =>
    api.post<ApiEnvelope<Tenant>>("/tenants", body).then(unwrap),
  current: () => api.get<ApiEnvelope<Tenant>>("/tenants/current").then(unwrap),
  updateBranding: (body: {
    name?: string;
    logo_url?: string;
    primary_domain?: string;
    brand_colors?: Record<string, string>;
    metadata_branding?: Record<string, unknown>;
  }) =>
    api
      .patch<ApiEnvelope<Tenant>>("/tenants/current/branding", body)
      .then(unwrap),
};

export type InfrastructureType =
  | "school"
  | "medos"
  | "mbolo"
  | "wellness"
  | "creator"
  | "temple"
  | "community";

export interface TenantService {
  id: string;
  tenant_id: string;
  service_key: string;
  active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}


export const tenantMembersApi = {
  // Servi par TenantPortalController (/tenant-portal/members) — l'ancien
  // /tenants/current/members n'était pas implémenté côté backend.
  listMembers: () =>
    api.get<ApiEnvelope<any>>("/tenant-portal/members").then(unwrap),
  inviteMember: (email: string, role: string) =>
    api.post<ApiEnvelope<any>>("/tenant-portal/members", { email, role }).then(unwrap),
  updateMemberRole: (userId: string, role: string) =>
    api.patch<ApiEnvelope<any>>(`/tenant-portal/members/${userId}`, { role }).then(unwrap),
  removeMember: (userId: string) =>
    api.delete<ApiEnvelope<any>>(`/tenant-portal/members/${userId}`).then(unwrap),
  getDashboard: () =>
    api.get<ApiEnvelope<any>>("/tenants/current/dashboard").then(unwrap),
  getMyTenants: () =>
    api.get<ApiEnvelope<any[]>>("/tenants/mine").then(unwrap),
};

// Certains contrôleurs renvoient déjà `{ data }`, re-emballé par l'intercepteur
// global → `unwrap` laisse une couche `{ data }`. `peel` la retire si présente.
const peel = (r: any): any =>
  r && !Array.isArray(r) && typeof r === "object" && "data" in r ? r.data : r;

// ── Back-office tenant : clés API (rôle owner/admin) ────────────────────────
export const tenantApiKeysApi = {
  list: () => api.get<ApiEnvelope<any>>("/tenants/api-keys").then(unwrap).then(peel),
  create: (label: string) =>
    api.post<ApiEnvelope<any>>("/tenants/api-keys", { label }).then(unwrap).then(peel),
  revoke: (keyId: string) =>
    api.delete<ApiEnvelope<any>>(`/tenants/api-keys/${keyId}`).then(unwrap).then(peel),
};

// ── Back-office tenant : marketplace + support ──────────────────────────────
export const tenantPortalApi = {
  marketplace: () => api.get<ApiEnvelope<any>>("/tenant-portal/marketplace").then(unwrap).then(peel),
  subscribe: (plan: string) =>
    api.post<ApiEnvelope<any>>("/tenant-portal/marketplace/subscribe", { plan }).then(unwrap).then(peel),
  tickets: () => api.get<ApiEnvelope<any>>("/tenant-portal/support/tickets").then(unwrap).then(peel),
  createTicket: (body: { subject: string; description?: string; category?: string; priority?: string }) =>
    api.post<ApiEnvelope<any>>("/tenant-portal/support/tickets", body).then(unwrap).then(peel),
  usage: () => api.get<ApiEnvelope<any>>("/tenant-portal/usage").then(unwrap).then(peel),
  profile: () => api.get<ApiEnvelope<any>>("/tenant-portal/profile").then(unwrap).then(peel),
  cancelSubscription: (id: string) =>
    api.post<ApiEnvelope<any>>(`/tenant-portal/subscriptions/${id}/cancel`).then(unwrap).then(peel),
  requestDeletion: (reason?: string) =>
    api.post<ApiEnvelope<any>>("/tenant-portal/account/request-deletion", { reason }).then(unwrap).then(peel),
  billingPortal: () =>
    api.post<ApiEnvelope<any>>("/tenant-portal/billing-portal").then(unwrap).then(peel),
  webhooks: () => api.get<ApiEnvelope<any>>("/tenant-portal/webhooks").then(unwrap).then(peel),
  createWebhook: (body: { label: string; url: string; events?: string[] }) =>
    api.post<ApiEnvelope<any>>("/tenant-portal/webhooks", body).then(unwrap).then(peel),
  toggleWebhook: (id: string, is_active: boolean) =>
    api.patch<ApiEnvelope<any>>(`/tenant-portal/webhooks/${id}`, { is_active }).then(unwrap).then(peel),
  deleteWebhook: (id: string) =>
    api.delete<ApiEnvelope<any>>(`/tenant-portal/webhooks/${id}`).then(unwrap).then(peel),
};

// Invitations d'équipe par email (envoie un vrai lien d'invitation Supabase).
export const teamInvitesApi = {
  send: (email: string, role: string) =>
    api.post<ApiEnvelope<any>>("/team-invites/send", { email, role }).then(unwrap).then(peel),
};

export const catalogApi = {
  applyTemplate: (infrastructure_type: InfrastructureType) =>
    api
      .post<
        ApiEnvelope<{
          infrastructure_type: InfrastructureType;
          services: TenantService[];
        }>
      >("/catalog/apply-template", { infrastructure_type })
      .then(unwrap),
  tenantServices: () =>
    api
      .get<ApiEnvelope<TenantService[]>>("/catalog/tenant-services")
      .then(unwrap),
};

export const livesApi = {
  list: () =>
    api
      .get<ApiEnvelope<RawLive[]>>("/lives")
      .then((r) => unwrap(r).map(mapLive)),
  get: (id: string) =>
    api
      .get<ApiEnvelope<RawLive>>(`/lives/${id}`)
      .then((r) => mapLive(unwrap(r))),
  create: (body: {
    title: string;
    scheduledAt: string;
    priceCents: number;
    currency: string;
    capacity?: number;
  }) =>
    api
      .post<ApiEnvelope<RawLive>>("/lives", body)
      .then((r) => mapLive(unwrap(r))),
  token: (id: string) =>
    api
      .get<
        ApiEnvelope<{ token: string; roomName: string }>
      >(`/lives/${id}/token`)
      .then(unwrap),
};

export const checkoutApi = {
  createSession: (liveSessionId: string) =>
    api
      .post<
        ApiEnvelope<{ checkoutUrl: string }>
      >("/checkout/sessions", { liveSessionId })
      .then(unwrap),
};

export interface PromoCode {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Popup {
  id: string;
  title: string;
  content: string;
  trigger_type: "exit_intent" | "scroll" | "time";
  is_active: boolean;
  created_at: string;
}

export interface Banner {
  id: string;
  text: string;
  cta_url: string;
  cta_label: string;
  is_active: boolean;
  created_at: string;
}

export interface CreatePromoCode {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxUses?: number;
  expiresAt?: string;
  isActive?: boolean;
}

export interface CreatePopup {
  title: string;
  content: string;
  triggerType: "exit_intent" | "scroll" | "time";
  isActive?: boolean;
}

export interface CreateBanner {
  text: string;
  ctaUrl: string;
  ctaLabel: string;
  isActive?: boolean;
}

export const marketingApi = {
  listPromoCodes: () =>
    api.get<ApiEnvelope<PromoCode[]>>("/marketing/promo-codes").then(unwrap),
  createPromoCode: (body: CreatePromoCode) =>
    api
      .post<ApiEnvelope<PromoCode>>("/marketing/promo-codes", body)
      .then(unwrap),
  updatePromoCode: (id: string, body: Partial<CreatePromoCode>) =>
    api
      .patch<ApiEnvelope<PromoCode>>(`/marketing/promo-codes/${id}`, body)
      .then(unwrap),
  removePromoCode: (id: string) =>
    api
      .delete<ApiEnvelope<{ id: string }>>(`/marketing/promo-codes/${id}`)
      .then(unwrap),

  listPopups: () =>
    api.get<ApiEnvelope<Popup[]>>("/marketing/popups").then(unwrap),
  createPopup: (body: CreatePopup) =>
    api.post<ApiEnvelope<Popup>>("/marketing/popups", body).then(unwrap),
  updatePopup: (id: string, body: Partial<CreatePopup>) =>
    api.patch<ApiEnvelope<Popup>>(`/marketing/popups/${id}`, body).then(unwrap),
  removePopup: (id: string) =>
    api
      .delete<ApiEnvelope<{ id: string }>>(`/marketing/popups/${id}`)
      .then(unwrap),

  listBanners: () =>
    api.get<ApiEnvelope<Banner[]>>("/marketing/banners").then(unwrap),
  createBanner: (body: CreateBanner) =>
    api.post<ApiEnvelope<Banner>>("/marketing/banners", body).then(unwrap),
  updateBanner: (id: string, body: Partial<CreateBanner>) =>
    api
      .patch<ApiEnvelope<Banner>>(`/marketing/banners/${id}`, body)
      .then(unwrap),
  removeBanner: (id: string) =>
    api
      .delete<ApiEnvelope<{ id: string }>>(`/marketing/banners/${id}`)
      .then(unwrap),
};

// --- MedOS Phase 1A ---

export interface MedPatient {
  id: string;
  tenant_id: string;
  patient_user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  blood_type: string | null;
  allergies: unknown[];
  chronic_conditions: unknown[];
  current_medications: unknown[];
  medical_history: unknown;
  family_history: unknown;
  emergency_contact: unknown;
  insurance_info: unknown;
  consent_given: boolean;
  consent_date: string | null;
  consent_purpose: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MedNote {
  id: string;
  tenant_id: string;
  patient_id: string;
  practitioner_id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  free_text: string | null;
  icd10_codes: unknown[];
  is_shared_with_patient: boolean;
  is_signed: boolean;
  signed_at: string | null;
  patient_read_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMedPatient {
  patient_user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  blood_type?: string;
  allergies?: Record<string, unknown>[];
  chronic_conditions?: Record<string, unknown>[];
  current_medications?: Record<string, unknown>[];
  consent_given?: boolean;
  consent_purpose?: string;
}

export interface CreateMedNote {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  free_text?: string;
  icd10_codes?: { code: string; description: string; is_primary?: boolean }[];
}

export interface MedForm {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  category: string;
  fields: Record<string, unknown>[];
  is_template: boolean;
  send_before_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface MedFormResponse {
  id: string;
  tenant_id: string;
  form_id: string;
  patient_id: string;
  submitted_by: string;
  responses: Record<string, unknown>;
  submitted_at: string;
}

export interface MedHealthEntry {
  id: string;
  tenant_id: string;
  patient_id: string;
  entry_date: string;
  entry_type: string;
  mood_score: number | null;
  energy_level: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  weight_kg: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  blood_glucose: number | null;
  temperature: number | null;
  symptoms: unknown[];
  notes: string | null;
  created_at: string;
}

export const medosApi = {
  // Patients
  listPatients: () =>
    api.get<ApiEnvelope<MedPatient[]>>("/med/patients").then(unwrap),
  getPatient: (id: string) =>
    api.get<ApiEnvelope<MedPatient>>(`/med/patients/${id}`).then(unwrap),
  createPatient: (body: CreateMedPatient) =>
    api.post<ApiEnvelope<MedPatient>>("/med/patients", body).then(unwrap),

  // Notes
  listNotes: (patientId: string) =>
    api
      .get<ApiEnvelope<MedNote[]>>(`/med/patients/${patientId}/notes`)
      .then(unwrap),
  createNote: (patientId: string, body: CreateMedNote) =>
    api
      .post<ApiEnvelope<MedNote>>(`/med/patients/${patientId}/notes`, body)
      .then(unwrap),
  updateNote: (noteId: string, body: Partial<CreateMedNote>) =>
    api.patch<ApiEnvelope<MedNote>>(`/med/notes/${noteId}`, body).then(unwrap),
  signNote: (noteId: string) =>
    api.post<ApiEnvelope<MedNote>>(`/med/notes/${noteId}/sign`).then(unwrap),
  shareNote: (noteId: string, shared: boolean) =>
    api
      .post<
        ApiEnvelope<MedNote>
      >(`/med/notes/${noteId}/share`, { is_shared: shared })
      .then(unwrap),

  // Patient self-service
  listMySharedNotes: () =>
    api.get<ApiEnvelope<MedNote[]>>("/med/me/notes").then(unwrap),
  markMySharedNoteRead: (noteId: string) =>
    api
      .post<ApiEnvelope<{ note_id: string; read_at: string }>>(
        `/med/me/notes/${noteId}/read`,
      )
      .then(unwrap),

  // Forms (Phase 1B)
  listForms: () =>
    api.get<ApiEnvelope<MedForm[]>>("/med/forms").then(unwrap),
  getForm: (id: string) =>
    api.get<ApiEnvelope<MedForm>>(`/med/forms/${id}`).then(unwrap),
  createForm: (body: Record<string, unknown>) =>
    api.post<ApiEnvelope<MedForm>>("/med/forms", body).then(unwrap),
  submitFormResponse: (formId: string, body: { patient_id: string; responses: Record<string, unknown> }) =>
    api
      .post<ApiEnvelope<MedFormResponse>>(`/med/forms/${formId}/responses`, body)
      .then(unwrap),
  getFormResponses: (formId: string) =>
    api
      .get<ApiEnvelope<MedFormResponse[]>>(`/med/forms/${formId}/responses`)
      .then(unwrap),

  // Health (Phase 1B)
  createHealthEntry: (body: Record<string, unknown>) =>
    api.post<ApiEnvelope<MedHealthEntry>>("/med/health", body).then(unwrap),
  getHealthEntries: (patientId: string) =>
    api
      .get<ApiEnvelope<MedHealthEntry[]>>(`/med/health/patient/${patientId}`)
      .then(unwrap),
};

// ─── Cimolace Admin — gestion clés API + domaines tenant ────────────────────

export interface TenantApiKey {
  id: string;
  tenant_id: string;
  label: string;
  key_prefix: string;
  created_by: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface GeneratedApiKey extends TenantApiKey {
  /** Valeur brute, retournée UNE SEULE FOIS à la création. À copier immédiatement. */
  raw_key: string;
}

export interface TenantDomain {
  id: string;
  tenant_id: string;
  domain: string;
  usage: "embed_origin" | "custom_host";
  status: "pending" | "active" | "revoked";
  verify_token: string | null;
  verified_at: string | null;
  ssl_status: string | null;
  created_at: string;
}

export const cimolaceAdminApi = {
  // API Keys
  listApiKeys: (tenantId: string) =>
    api
      .get<ApiEnvelope<TenantApiKey[]>>(
        `/admin/tenants/${tenantId}/api-keys`,
      )
      .then(unwrap),
  createApiKey: (tenantId: string, body: { label: string }) =>
    api
      .post<ApiEnvelope<GeneratedApiKey>>(
        `/admin/tenants/${tenantId}/api-keys`,
        body,
      )
      .then(unwrap),
  revokeApiKey: (tenantId: string, keyId: string) =>
    api
      .delete<ApiEnvelope<{ id: string }>>(
        `/admin/tenants/${tenantId}/api-keys/${keyId}`,
      )
      .then(unwrap),

  // Tenant Domains (CORS whitelist + futur Mode B)
  listDomains: (tenantId: string) =>
    api
      .get<ApiEnvelope<TenantDomain[]>>(`/admin/tenants/${tenantId}/domains`)
      .then(unwrap),
  addDomain: (
    tenantId: string,
    body: { domain: string; usage?: "embed_origin" | "custom_host" },
  ) =>
    api
      .post<ApiEnvelope<TenantDomain>>(
        `/admin/tenants/${tenantId}/domains`,
        body,
      )
      .then(unwrap),
  revokeDomain: (tenantId: string, domainId: string) =>
    api
      .delete<ApiEnvelope<{ id: string }>>(
        `/admin/tenants/${tenantId}/domains/${domainId}`,
      )
      .then(unwrap),
};

// ─── Prescriptions ──────────────────────────────────────────────────────────

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  position: number;
  drug_name: string;
  drug_code: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  route: string | null;
  quantity: string | null;
  notes: string | null;
  is_substitutable: boolean;
}

export interface Prescription {
  id: string;
  tenant_id: string;
  patient_id: string;
  practitioner_id: string;
  consultation_note_id: string | null;
  prescription_number: string | null;
  issued_at: string;
  validity_days: number;
  status: "draft" | "signed" | "dispensed" | "cancelled";
  patient_instructions: string | null;
  practitioner_notes: string | null;
  signed_at: string | null;
  signature_hash: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  pdf_url: string | null;
  items?: PrescriptionItem[];
}

export const prescriptionsApi = {
  list: (params: { patient_id?: string; status?: string } = {}) =>
    api
      .get<ApiEnvelope<Prescription[]>>("/med/prescriptions", { params })
      .then(unwrap),
  get: (id: string) =>
    api.get<ApiEnvelope<Prescription>>(`/med/prescriptions/${id}`).then(unwrap),
  create: (body: {
    patient_id: string;
    consultation_note_id?: string;
    validity_days?: number;
    patient_instructions?: string;
    practitioner_notes?: string;
    items?: Array<Omit<PrescriptionItem, "id" | "prescription_id" | "position">>;
  }) =>
    api.post<ApiEnvelope<Prescription>>("/med/prescriptions", body).then(unwrap),
  update: (id: string, body: Partial<{ validity_days: number; patient_instructions: string; practitioner_notes: string }>) =>
    api.patch<ApiEnvelope<Prescription>>(`/med/prescriptions/${id}`, body).then(unwrap),
  addItem: (id: string, item: Omit<PrescriptionItem, "id" | "prescription_id" | "position">) =>
    api.post<ApiEnvelope<PrescriptionItem>>(`/med/prescriptions/${id}/items`, item).then(unwrap),
  updateItem: (id: string, itemId: string, item: Partial<PrescriptionItem>) =>
    api.patch<ApiEnvelope<PrescriptionItem>>(`/med/prescriptions/${id}/items/${itemId}`, item).then(unwrap),
  removeItem: (id: string, itemId: string) =>
    api.delete<ApiEnvelope<{ id: string }>>(`/med/prescriptions/${id}/items/${itemId}`).then(unwrap),
  sign: (id: string) =>
    api.post<ApiEnvelope<Prescription>>(`/med/prescriptions/${id}/sign`).then(unwrap),
  cancel: (id: string, reason: string) =>
    api.post<ApiEnvelope<Prescription>>(`/med/prescriptions/${id}/cancel`, { reason }).then(unwrap),
  listMine: () =>
    api.get<ApiEnvelope<Prescription[]>>("/med/me/prescriptions").then(unwrap),
};

// ─── Appointments ───────────────────────────────────────────────────────────

export interface Availability {
  id: string;
  practitioner_id: string;
  weekday: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  is_active: boolean;
}

export interface Appointment {
  id: string;
  patient_id: string;
  practitioner_id: string;
  scheduled_at: string;
  duration_minutes: number;
  appointment_type: "in_person" | "teleconsult" | "phone" | "home_visit";
  reason: string | null;
  status: "requested" | "confirmed" | "rescheduled" | "cancelled" | "completed" | "no_show";
  internal_notes: string | null;
  consultation_note_id: string | null;
  teleconsult_session_id: string | null;
}

export const availabilityApi = {
  list: (practitionerId?: string) =>
    api
      .get<ApiEnvelope<Availability[]>>("/med/availability", {
        params: { practitioner_id: practitionerId },
      })
      .then(unwrap),
  create: (body: {
    practitioner_id: string;
    weekday?: number;
    specific_date?: string;
    start_time: string;
    end_time: string;
    slot_duration_minutes?: number;
    buffer_minutes?: number;
  }) => api.post<ApiEnvelope<Availability>>("/med/availability", body).then(unwrap),
  update: (id: string, body: Partial<Availability>) =>
    api.patch<ApiEnvelope<Availability>>(`/med/availability/${id}`, body).then(unwrap),
  remove: (id: string) =>
    api.delete<ApiEnvelope<{ id: string }>>(`/med/availability/${id}`).then(unwrap),
};

export const appointmentsApi = {
  list: (params: { patient_id?: string; practitioner_id?: string; status?: string; from?: string; to?: string } = {}) =>
    api.get<ApiEnvelope<Appointment[]>>("/med/appointments", { params }).then(unwrap),
  get: (id: string) =>
    api.get<ApiEnvelope<Appointment>>(`/med/appointments/${id}`).then(unwrap),
  create: (body: { patient_id: string; practitioner_id: string; scheduled_at: string; duration_minutes?: number; appointment_type?: Appointment["appointment_type"]; reason?: string }) =>
    api.post<ApiEnvelope<Appointment>>("/med/appointments", body).then(unwrap),
  update: (id: string, body: Partial<Appointment>) =>
    api.patch<ApiEnvelope<Appointment>>(`/med/appointments/${id}`, body).then(unwrap),
  findSlots: (practitionerId: string, from: string, to: string) =>
    api
      .get<ApiEnvelope<Array<{ start: string; end: string }>>>("/med/appointments/slots", {
        params: { practitioner_id: practitionerId, from, to },
      })
      .then(unwrap),
  confirm: (id: string) =>
    api.post<ApiEnvelope<Appointment>>(`/med/appointments/${id}/confirm`).then(unwrap),
  cancel: (id: string, reason: string) =>
    api.post<ApiEnvelope<Appointment>>(`/med/appointments/${id}/cancel`, { reason }).then(unwrap),
  complete: (id: string) =>
    api.post<ApiEnvelope<Appointment>>(`/med/appointments/${id}/complete`).then(unwrap),
  noShow: (id: string) =>
    api.post<ApiEnvelope<Appointment>>(`/med/appointments/${id}/no-show`).then(unwrap),
};

// ─── Messaging ──────────────────────────────────────────────────────────────

export interface MessageThread {
  id: string;
  patient_id: string;
  subject: string | null;
  status: "open" | "awaiting_patient" | "awaiting_staff" | "closed" | "archived";
  priority: "low" | "normal" | "high" | "urgent";
  last_message_at: string | null;
  assigned_practitioner_id: string | null;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  attachment_ids: string[];
  read_at: string | null;
  is_system: boolean;
  created_at: string;
}

export const messagingApi = {
  listThreads: (params: { status?: string; patient_id?: string } = {}) =>
    api.get<ApiEnvelope<MessageThread[]>>("/med/threads", { params }).then(unwrap),
  getThread: (id: string) =>
    api.get<ApiEnvelope<MessageThread>>(`/med/threads/${id}`).then(unwrap),
  createThread: (body: { patient_id: string; subject?: string; priority?: MessageThread["priority"]; initial_message?: string }) =>
    api.post<ApiEnvelope<{ thread: MessageThread; first_message: Message | null }>>("/med/threads", body).then(unwrap),
  closeThread: (id: string, reason?: string) =>
    api.post<ApiEnvelope<MessageThread>>(`/med/threads/${id}/close`, { reason }).then(unwrap),
  send: (threadId: string, body: { body: string; attachment_ids?: string[] }) =>
    api.post<ApiEnvelope<Message>>(`/med/threads/${threadId}/messages`, body).then(unwrap),
  listMessages: (threadId: string) =>
    api.get<ApiEnvelope<Message[]>>(`/med/threads/${threadId}/messages`).then(unwrap),
  markRead: (threadId: string, messageId: string) =>
    api.post<ApiEnvelope<Message>>(`/med/threads/${threadId}/messages/${messageId}/read`).then(unwrap),
};

// ─── Programs ───────────────────────────────────────────────────────────────

export interface CareProgram {
  id: string;
  title: string;
  description: string | null;
  category: string;
  duration_days: number | null;
  is_template: boolean;
  is_active: boolean;
}

export interface ProgramStep {
  id: string;
  program_id: string;
  position: number;
  title: string;
  description: string | null;
  step_type: "task" | "form" | "measurement" | "content" | "appointment" | "reminder";
  due_after_days: number;
  is_required: boolean;
}

export interface ProgramEnrollment {
  id: string;
  program_id: string;
  patient_id: string;
  enrolled_at: string;
  status: "active" | "paused" | "completed" | "abandoned";
  current_step_position: number;
  progress_percent: number;
}

export const programsApi = {
  list: (category?: string) =>
    api.get<ApiEnvelope<CareProgram[]>>("/med/programs", { params: { category } }).then(unwrap),
  get: (id: string) =>
    api.get<ApiEnvelope<CareProgram & { steps: ProgramStep[] }>>(`/med/programs/${id}`).then(unwrap),
  create: (body: Partial<CareProgram> & { title: string }) =>
    api.post<ApiEnvelope<CareProgram>>("/med/programs", body).then(unwrap),
  update: (id: string, body: Partial<CareProgram>) =>
    api.patch<ApiEnvelope<CareProgram>>(`/med/programs/${id}`, body).then(unwrap),
  listSteps: (programId: string) =>
    api.get<ApiEnvelope<ProgramStep[]>>(`/med/programs/${programId}/steps`).then(unwrap),
  addStep: (programId: string, body: Partial<ProgramStep> & { title: string }) =>
    api.post<ApiEnvelope<ProgramStep>>(`/med/programs/${programId}/steps`, body).then(unwrap),
  removeStep: (programId: string, stepId: string) =>
    api.delete<ApiEnvelope<{ id: string }>>(`/med/programs/${programId}/steps/${stepId}`).then(unwrap),
  enroll: (programId: string, body: { patient_id: string; notes?: string }) =>
    api.post<ApiEnvelope<ProgramEnrollment>>(`/med/programs/${programId}/enroll`, body).then(unwrap),
  listEnrollments: (params: { patient_id?: string; status?: string } = {}) =>
    api.get<ApiEnvelope<ProgramEnrollment[]>>("/med/enrollments", { params }).then(unwrap),
  updateEnrollment: (id: string, body: Partial<ProgramEnrollment>) =>
    api.patch<ApiEnvelope<ProgramEnrollment>>(`/med/enrollments/${id}`, body).then(unwrap),
};

// ─── Clinical Lists (factorisé pour les 5 ressources) ───────────────────────

type ClinicalResource = "allergies" | "medications" | "problems" | "immunizations" | "lab-results";

function makeClinicalApi<T = Record<string, unknown>>(resource: ClinicalResource) {
  const base = `/med/${resource}`;
  return {
    create: (body: T & { patient_id: string }) =>
      api.post<ApiEnvelope<T>>(base, body).then(unwrap),
    listForPatient: (patientId: string) =>
      api.get<ApiEnvelope<T[]>>(`${base}/patient/${patientId}`).then(unwrap),
    update: (id: string, body: Partial<T>) =>
      api.patch<ApiEnvelope<T>>(`${base}/${id}`, body).then(unwrap),
    remove: (id: string) =>
      api.delete<ApiEnvelope<{ id: string }>>(`${base}/${id}`).then(unwrap),
  };
}

export const clinicalApi = {
  allergies: makeClinicalApi("allergies"),
  medications: makeClinicalApi("medications"),
  problems: makeClinicalApi("problems"),
  immunizations: makeClinicalApi("immunizations"),
  labResults: makeClinicalApi("lab-results"),
};

// ─── Teleconsult ────────────────────────────────────────────────────────────

export interface TeleconsultSession {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  practitioner_id: string;
  livekit_room_name: string;
  status: "scheduled" | "active" | "ended" | "cancelled" | "failed";
  recording_consented: boolean;
  duration_seconds: number | null;
}

export const teleconsultApi = {
  list: (patientId?: string) =>
    api.get<ApiEnvelope<TeleconsultSession[]>>("/med/teleconsult", { params: { patient_id: patientId } }).then(unwrap),
  create: (body: { patient_id: string; appointment_id?: string; recording_consented?: boolean }) =>
    api.post<ApiEnvelope<TeleconsultSession>>("/med/teleconsult", body).then(unwrap),
  issueToken: (id: string) =>
    api.post<ApiEnvelope<{ room: string; token: string; ttl: string }>>(`/med/teleconsult/${id}/token`).then(unwrap),
  join: (id: string) =>
    api.post<ApiEnvelope<TeleconsultSession>>(`/med/teleconsult/${id}/join`).then(unwrap),
  end: (id: string, body: { ended_reason?: string; connection_quality?: string; quick_note?: string } = {}) =>
    api.post<ApiEnvelope<TeleconsultSession>>(`/med/teleconsult/${id}/end`, body).then(unwrap),
};

// ─── Attachments ────────────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  owner_type: string;
  owner_id: string;
  patient_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  category: string | null;
  description: string | null;
  visible_to_patient: boolean;
  uploaded_by: string;
  uploaded_by_role: string;
  taken_at: string | null;
  created_at: string;
}

export const attachmentsApi = {
  getUploadUrl: (bucket?: string) =>
    api.post<ApiEnvelope<{ upload_url: string; storage_path: string; bucket: string }>>("/med/attachments/upload-url", { bucket }).then(unwrap),
  register: (body: Partial<Attachment> & { owner_type: string; owner_id: string; patient_id: string; file_name: string; file_size_bytes: number; mime_type: string; storage_path: string }) =>
    api.post<ApiEnvelope<Attachment>>("/med/attachments", body).then(unwrap),
  listByOwner: (owner_type: string, owner_id: string) =>
    api.get<ApiEnvelope<Attachment[]>>("/med/attachments", { params: { owner_type, owner_id } }).then(unwrap),
  listForPatient: (patientId: string) =>
    api.get<ApiEnvelope<Attachment[]>>(`/med/attachments/patient/${patientId}`).then(unwrap),
  getDownloadUrl: (id: string) =>
    api.get<ApiEnvelope<{ download_url: string; expires_in: number }>>(`/med/attachments/${id}/download-url`).then(unwrap),
  update: (id: string, body: Partial<Attachment>) =>
    api.patch<ApiEnvelope<Attachment>>(`/med/attachments/${id}`, body).then(unwrap),
  remove: (id: string) =>
    api.delete<ApiEnvelope<{ id: string }>>(`/med/attachments/${id}`).then(unwrap),
};

// ─── GDPR ───────────────────────────────────────────────────────────────────

export interface ConsentRecord {
  id: string;
  patient_id: string;
  scope: string;
  granted: boolean;
  granted_at: string;
  revoked_at: string | null;
  consent_version: string;
}

export interface GdprExport {
  id: string;
  patient_id: string;
  status: "pending" | "processing" | "ready" | "downloaded" | "expired" | "failed";
  format: "json" | "pdf" | "zip";
  scope: string;
  file_url: string | null;
  expires_at: string | null;
}

export interface GdprAnonymization {
  id: string;
  original_patient_id: string;
  pseudonym: string;
  status: "pending" | "processing" | "completed" | "failed" | "reverted";
  method: string;
  legal_basis: string;
}

export const gdprApi = {
  recordConsent: (body: { patient_id: string; scope: string; granted: boolean; consent_text: string; consent_version: string }) =>
    api.post<ApiEnvelope<ConsentRecord>>("/med/gdpr/consents", body).then(unwrap),
  listConsents: (patientId: string) =>
    api.get<ApiEnvelope<ConsentRecord[]>>(`/med/gdpr/consents/patient/${patientId}`).then(unwrap),
  revokeConsent: (id: string) =>
    api.post<ApiEnvelope<ConsentRecord>>(`/med/gdpr/consents/${id}/revoke`).then(unwrap),
  requestExport: (body: { patient_id: string; format?: GdprExport["format"]; scope?: string }) =>
    api.post<ApiEnvelope<GdprExport>>("/med/gdpr/exports", body).then(unwrap),
  listExports: (patientId?: string) =>
    api.get<ApiEnvelope<GdprExport[]>>("/med/gdpr/exports", { params: { patient_id: patientId } }).then(unwrap),
  requestAnonymization: (body: { patient_id: string; legal_basis: string; method?: string; scope?: string }) =>
    api.post<ApiEnvelope<GdprAnonymization>>("/med/gdpr/anonymizations", body).then(unwrap),
  listAnonymizations: () =>
    api.get<ApiEnvelope<GdprAnonymization[]>>("/med/gdpr/anonymizations").then(unwrap),
};

// ─── Admin: MedOS audit log + AI runs ──────────────────────────────────────

export interface MedAuditLogRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  resource: string;
  resource_id: string;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface MedAiRunRow {
  id: string;
  analysis_id: string | null;
  patient_id: string;
  agent: string;
  prompt_version: string | null;
  model: string | null;
  tokens: number | null;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
}

export interface MedAuditPaged<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface MedAuditListParams {
  limit?: number;
  offset?: number;
  resource?: string;
  action?: string;
  actor_id?: string;
  from?: string;
  to?: string;
}

export interface MedAiRunsParams {
  limit?: number;
  offset?: number;
  agent?: string;
  patient_id?: string;
  from?: string;
  to?: string;
}

export const adminMedAudit = {
  list: (params: MedAuditListParams = {}) =>
    api
      .get<ApiEnvelope<MedAuditPaged<MedAuditLogRow>>>(
        "/med/admin/audit/log",
        { params },
      )
      .then(unwrap),
  aiRuns: (params: MedAiRunsParams = {}) =>
    api
      .get<ApiEnvelope<MedAuditPaged<MedAiRunRow>>>(
        "/med/admin/audit/ai-runs",
        { params },
      )
      .then(unwrap),
};

// ─── Invitations ────────────────────────────────────────────────────────────

export interface PatientInvitation {
  id: string;
  patient_id: string;
  invited_name: string;
  invited_email: string | null;
  invited_phone: string | null;
  status: "pending" | "sent" | "opened" | "accepted" | "expired" | "cancelled";
  expires_at: string;
  resent_count: number;
}

export const invitationsApi = {
  create: (body: { patient_id: string; invited_name: string; invited_email?: string; invited_phone?: string; expires_in_days?: number; sent_via?: string; custom_message?: string }) =>
    api.post<ApiEnvelope<{ invitation: PatientInvitation; raw_token: string; accept_url: string }>>("/med/invitations", body).then(unwrap),
  list: (status?: string) =>
    api.get<ApiEnvelope<PatientInvitation[]>>("/med/invitations", { params: { status } }).then(unwrap),
  resend: (id: string) =>
    api.post<ApiEnvelope<{ id: string; resent_count: number }>>(`/med/invitations/${id}/resend`).then(unwrap),
  cancel: (id: string) =>
    api.delete<ApiEnvelope<{ id: string }>>(`/med/invitations/${id}`).then(unwrap),
};

// ─── Mbolo (e-commerce back-office) ───────────────────────────────────────────

export interface MboloCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface MboloProductImage {
  url: string;
  alt: string | null;
  is_primary: boolean;
  sort_order: number;
}

export interface MboloVariant {
  id: string;
  label: string;
  sku_suffix: string | null;
  price_delta_cents: number;
  stock: number;
  sort_order: number;
}

export interface MboloProduct {
  id: string;
  name: string;
  slug: string | null;
  sku: string | null;
  description: string;
  tagline: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  currency: string;
  stock: number;
  is_featured: boolean;
  is_active: boolean;
  image_url: string | null;
  category_id: string | null;
  benefits: string[];
  ingredients: string[];
  images?: MboloProductImage[];
  variants?: MboloVariant[];
  created_at?: string;
}

export interface MboloOrder {
  id: string;
  order_number: string | null;
  status: string;
  total_cents: number;
  currency: string;
  channel: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  user_id: string | null;
  created_at: string;
  items?: Array<{
    id: string;
    product_id: string | null;
    product_name: string | null;
    quantity: number;
    price_cents: number;
    variant_id: string | null;
  }>;
}

export interface CreateMboloProduct {
  name: string;
  priceCents: number;
  slug?: string;
  sku?: string;
  categoryId?: string;
  description?: string;
  tagline?: string;
  compareAtPriceCents?: number;
  currency?: string;
  stock?: number;
  isFeatured?: boolean;
  imageUrl?: string;
  benefits?: string[];
  ingredients?: string[];
  seoTitle?: string;
  seoDescription?: string;
}

export interface MboloInstallResult {
  api_key: string;
  key_prefix: string;
  storefront: { base_url: string; endpoints: Record<string, string> };
  docs_url: string;
  back_office_url: string;
  category: MboloCategory | null;
  sample_product: { id: string; name: string; slug: string } | null;
}

export const mboloApi = {
  // Installation storefront (provisionne une clé API + catalogue de départ)
  install: (withSample = false) =>
    api.post<ApiEnvelope<MboloInstallResult>>("/mbolo/install", { withSample }).then(unwrap),
  // Catalogue
  listCategories: () =>
    api.get<ApiEnvelope<MboloCategory[]>>("/mbolo/categories").then(unwrap),
  createCategory: (body: { slug: string; name: string; description?: string; imageUrl?: string; sortOrder?: number }) =>
    api.post<ApiEnvelope<MboloCategory>>("/mbolo/categories", body).then(unwrap),
  listProducts: (category?: string) =>
    api.get<ApiEnvelope<MboloProduct[]>>("/mbolo/products", { params: category ? { category } : undefined }).then(unwrap),
  getProduct: (id: string) =>
    api.get<ApiEnvelope<MboloProduct>>(`/mbolo/products/${id}`).then(unwrap),
  createProduct: (body: CreateMboloProduct) =>
    api.post<ApiEnvelope<MboloProduct>>("/mbolo/products", body).then(unwrap),
  addImage: (productId: string, body: { url: string; alt?: string; isPrimary?: boolean; sortOrder?: number }) =>
    api.post<ApiEnvelope<MboloProductImage>>(`/mbolo/products/${productId}/images`, body).then(unwrap),
  addVariant: (productId: string, body: { label: string; skuSuffix?: string; priceDeltaCents?: number; stock?: number; sortOrder?: number }) =>
    api.post<ApiEnvelope<MboloVariant>>(`/mbolo/products/${productId}/variants`, body).then(unwrap),
  // Commandes
  listOrders: () =>
    api.get<ApiEnvelope<MboloOrder[]>>("/mbolo/orders").then(unwrap),
  getOrder: (id: string) =>
    api.get<ApiEnvelope<MboloOrder>>(`/mbolo/orders/${id}`).then(unwrap),
};

// ─── Billing plateforme (abonnement tenant → Cimolace, collecte PawaPay) ──────

export interface BillingSubscription {
  id: string;
  plan_id: string;
  provider: string;
  status: string;
  amount_cents: number;
  currency: string;
  current_period_end: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface BillingInvoice {
  id: string;
  subscription_id: string | null;
  provider: string;
  status: string;
  amount_cents: number;
  currency: string;
  invoice_number: string | null;
  description: string | null;
  due_date: string | null;
  paid_at: string | null;
}

export interface BillingCollectResult {
  deposit_id: string;
  status: string;
  invoice_number: string | null;
  amount: number;
  currency: string;
}

export const billingApi = {
  getPlan: () =>
    api.get<ApiEnvelope<{ subscriptions: BillingSubscription[]; invoices: BillingInvoice[] }>>("/billing/plan").then(unwrap),
  // Mobile money (PawaPay — Afrique)
  collect: (subscriptionId: string, body: { phoneNumber: string; provider: string; country?: string }) =>
    api.post<ApiEnvelope<BillingCollectResult>>(`/billing/subscriptions/${subscriptionId}/collect`, body).then(unwrap),
  // Carte bancaire (Stripe — Europe / international)
  cardCheckout: (subscriptionId: string) =>
    api.post<ApiEnvelope<{ url: string; session_id: string; amount_cents: number; currency: string }>>(`/billing/subscriptions/${subscriptionId}/card-checkout`).then(unwrap),
  cardConfirm: (subscriptionId: string) =>
    api.post<ApiEnvelope<{ paid: boolean; status: string }>>(`/billing/subscriptions/${subscriptionId}/card-confirm`).then(unwrap),
  // Retraits / versements mobile money (PawaPay payouts)
  listPayouts: () =>
    api.get<ApiEnvelope<BillingPayout[]>>("/billing/payouts").then(unwrap),
  createPayout: (body: { amountCents: number; currency?: string; phoneNumber: string; mno: string; recipientName?: string; reason?: string }) =>
    api.post<ApiEnvelope<{ payout_id: string; status: string; amount_cents: number; currency: string }>>("/billing/payouts", body).then(unwrap),
};

export interface BillingPayout {
  id: string;
  payout_id: string;
  status: string;
  amount_cents: number;
  currency: string;
  phone_number: string;
  mno: string;
  recipient_name: string | null;
  reason: string | null;
  provider_tx_id: string | null;
  failure_message: string | null;
  created_at: string;
}

// ─── Admin Twin — métering IA par tenant ────────────────────────────────────

export interface MedAiUsageByDay {
  date: string;
  tokens: number;
  cost_usd: number;
}

export interface MedAiUsageByAgent {
  agent: string;
  tokens: number;
  runs: number;
  cost_usd: number;
}

export interface MedAiUsageReport {
  period: { from: string; to: string };
  total_tokens: number;
  total_runs: number;
  total_cost_usd: number;
  by_day: MedAiUsageByDay[];
  by_agent: MedAiUsageByAgent[];
}

export const adminTwin = {
  usage: (from?: string, to?: string) => {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return api
      .get<ApiEnvelope<MedAiUsageReport>>("/med/twin/admin/usage", { params })
      .then(unwrap);
  },
};
