import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string | null;
  status: string;
  plan: string;
  billing_status: string | null;
  primary_domain: string | null;
  logo_url: string | null;
  brand_colors: Json;
  infrastructure_type: string | null;
  timezone: string;
  locale: string;
  created_at: string;
  updated_at: string;
};

type TenantMembershipRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
};

type AccessPassRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  resource_type: string;
  resource_id: string;
  payment_id: string | null;
  status: string;
  granted_at: string;
  expires_at: string | null;
  created_at: string;
};

type LiveSessionRow = {
  id: string;
  tenant_id: string;
  host_user_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  price_cents: number;
  currency: string;
  capacity: number | null;
  status: string;
  livekit_room_name: string;
  replay_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type PromoCodeRow = {
  id: string;
  tenant_id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

type PopupRow = {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  trigger_type: string;
  is_active: boolean;
  created_at: string;
};

type BannerRow = {
  id: string;
  tenant_id: string;
  text: string;
  cta_url: string;
  cta_label: string;
  is_active: boolean;
  created_at: string;
};

type TenantServiceRow = {
  id: string;
  tenant_id: string;
  service_key: string;
  active: boolean;
  settings: Json;
  created_at: string;
  updated_at: string;
};

type MedPatientRow = {
  id: string;
  tenant_id: string;
  patient_user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  blood_type: string | null;
  allergies: Json;
  chronic_conditions: Json;
  current_medications: Json;
  medical_history: Json;
  family_history: Json;
  emergency_contact: Json;
  insurance_info: Json;
  consent_given: boolean;
  consent_date: string | null;
  consent_purpose: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type MedConsultationNoteRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  practitioner_id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  free_text: string | null;
  ai_transcript: string | null;
  ai_draft: string | null;
  ai_summary: string | null;
  icd10_codes: Json;
  is_shared_with_patient: boolean;
  is_signed: boolean;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
};

type MedAuditLogRow = {
  id: string;
  tenant_id: string;
  actor_id: string;
  resource: string;
  resource_id: string;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Json;
  created_at: string;
};

type MedMedicalFormRow = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  category: string;
  fields: Json;
  is_template: boolean;
  send_before_days: number | null;
  created_at: string;
  updated_at: string;
};

type MedFormResponseRow = {
  id: string;
  tenant_id: string;
  form_id: string;
  patient_id: string;
  submitted_by: string;
  responses: Json;
  submitted_at: string;
};

type MedHealthEntryRow = {
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
  meal_photos: Json;
  food_notes: string | null;
  water_liters: number | null;
  steps: number | null;
  exercise_minutes: number | null;
  symptoms: Json;
  notes: string | null;
  created_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Database = {
  public: {
    Tables: {
      tenants: Table<TenantRow, Partial<TenantRow>, Partial<TenantRow>>;
      tenant_memberships: Table<
        TenantMembershipRow,
        Partial<TenantMembershipRow>,
        Partial<TenantMembershipRow>
      >;
      access_passes: Table<
        AccessPassRow,
        Partial<AccessPassRow>,
        Partial<AccessPassRow>
      >;
      live_sessions: Table<
        LiveSessionRow,
        Partial<LiveSessionRow>,
        Partial<LiveSessionRow>
      >;
      promo_codes: Table<
        PromoCodeRow,
        Partial<PromoCodeRow>,
        Partial<PromoCodeRow>
      >;
      popups: Table<PopupRow, Partial<PopupRow>, Partial<PopupRow>>;
      banners: Table<BannerRow, Partial<BannerRow>, Partial<BannerRow>>;
      tenant_services: Table<
        TenantServiceRow,
        Partial<TenantServiceRow>,
        Partial<TenantServiceRow>
      >;
      med_patients: Table<
        MedPatientRow,
        Partial<MedPatientRow>,
        Partial<MedPatientRow>
      >;
      med_consultation_notes: Table<
        MedConsultationNoteRow,
        Partial<MedConsultationNoteRow>,
        Partial<MedConsultationNoteRow>
      >;
      med_audit_log: Table<
        MedAuditLogRow,
        Partial<MedAuditLogRow>,
        Partial<MedAuditLogRow>
      >;
      med_medical_forms: Table<
        MedMedicalFormRow,
        Partial<MedMedicalFormRow>,
        Partial<MedMedicalFormRow>
      >;
      med_form_responses: Table<
        MedFormResponseRow,
        Partial<MedFormResponseRow>,
        Partial<MedFormResponseRow>
      >;
      med_health_entries: Table<
        MedHealthEntryRow,
        Partial<MedHealthEntryRow>,
        Partial<MedHealthEntryRow>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient<Database>;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    const key = config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.client = createClient<Database>(url, key, {
      auth: { persistSession: false },
    });
  }
}
