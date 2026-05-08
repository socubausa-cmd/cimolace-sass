// MedOS roles
export const MEDOS_ROLES = ["practitioner", "clinic_admin", "receptionist", "patient"] as const;
export type MedosRole = (typeof MEDOS_ROLES)[number];

export const ALL_ROLES = ["owner", "admin", "teacher", "student", "secretariat", "support", ...MEDOS_ROLES] as const;
export type TenantRole = (typeof ALL_ROLES)[number];

// Patient record
export interface PatientRecord {
  id: string;
  tenant_id: string;
  patient_user_id: string;
  date_of_birth?: string;
  gender?: string;
  blood_type?: string;
  allergies?: { substance: string; severity: string; reaction: string }[];
  chronic_conditions?: { name: string; diagnosed_at: string }[];
  current_medications?: { name: string; dosage: string; frequency: string }[];
  status: string;
  created_at: string;
  updated_at: string;
}

// Consultation note
export interface ConsultationNote {
  id: string;
  tenant_id: string;
  record_id: string;
  practitioner_id: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  ai_draft?: string;
  is_signed: boolean;
  signed_at?: string;
  created_at: string;
}

// API response wrapper
export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: { code: string; message: string };
}
