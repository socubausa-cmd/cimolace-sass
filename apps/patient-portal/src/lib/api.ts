// Lightweight typed API client for the patient portal.
// Keeps auth + tenant headers consistent across pages.

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('supabase_token') || '';
  const slug = localStorage.getItem('tenant_slug') || '';
  return {
    Authorization: 'Bearer ' + t,
    'X-Tenant-Slug': slug,
  };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(API + path, { headers: authHeaders() });
  if (!res.ok) {
    let msg = 'Erreur ' + res.status;
    try {
      const body = await res.json();
      msg = body?.message || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── Bio Digital Twin — vue patient ────────────────────────────────────
export type TwinOrganScore = {
  organ_code: string;
  label: string;
  score: number | null;
  color: string | null;
};

export type TwinWheelDomain = {
  domain: string;
  score: number | null;
};

export type TwinEvent = {
  id: string;
  event_type: string;
  title: string;
  occurred_at: string;
};

export type TwinAlert = {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  message: string;
  created_at: string;
};

export type MyTwinState = {
  organs_scores: TwinOrganScore[];
  wheel: TwinWheelDomain[];
  events: TwinEvent[];
  alerts: TwinAlert[];
  disclaimer: string;
};

export const patientApi = {
  getMyTwin(): Promise<MyTwinState> {
    return getJson<MyTwinState>('/med/twin-me/state');
  },
};
