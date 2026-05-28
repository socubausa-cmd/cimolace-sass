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
  listMembers: () =>
    api.get<ApiEnvelope<any[]>>("/tenants/current/members").then(unwrap),
  inviteMember: (email: string, role: string) =>
    api.post<ApiEnvelope<any>>("/tenants/current/members", { email, role }).then(unwrap),
  updateMemberRole: (userId: string, role: string) =>
    api.patch<ApiEnvelope<any>>(`/tenants/current/members/${userId}`, { role }).then(unwrap),
  removeMember: (userId: string) =>
    api.delete<ApiEnvelope<any>>(`/tenants/current/members/${userId}`).then(unwrap),
  getDashboard: () =>
    api.get<ApiEnvelope<any>>("/tenants/current/dashboard").then(unwrap),
  getMyTenants: () =>
    api.get<ApiEnvelope<any[]>>("/tenants/mine").then(unwrap),
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
