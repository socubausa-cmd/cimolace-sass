// MEDOS v2 — Bio Digital Twin · client API (front med-app)
const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {
    Authorization: 'Bearer ' + (localStorage.getItem('supabase_token') || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function unwrap(d: any): any {
  return d?.data !== undefined ? d.data : d;
}

async function get(path: string): Promise<any> {
  const r = await fetch(API + path, { headers: headers() });
  if (!r.ok) throw new Error(`Erreur ${r.status}`);
  return unwrap(await r.json());
}

async function post(path: string, body?: unknown): Promise<any> {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: headers(true),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b?.message || `Erreur ${r.status}`);
  }
  return unwrap(await r.json());
}

async function patch(path: string, body: unknown): Promise<any> {
  const r = await fetch(API + path, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Erreur ${r.status}`);
  return unwrap(await r.json());
}

export type OrganColor = 'green' | 'yellow' | 'orange' | 'red';

export const twinApi = {
  referential: () => get('/med/twin/referential'),
  graph: () => get('/med/twin/graph'),
  state: (pid: string) => get(`/med/twin/${pid}/state`),
  addBiomarkers: (pid: string, biomarkers: Array<{ biomarker_code: string; value: number }>) =>
    post(`/med/twin/${pid}/biomarkers`, { biomarkers }),
  compute: (pid: string) => post(`/med/twin/${pid}/compute`),
  organAssistant: (pid: string, organ_code: string, question?: string) =>
    post(`/med/twin/${pid}/organ-assistant`, { organ_code, question }),
  analyze: (pid: string) => post(`/med/twin/${pid}/analyze`),
  setHypothesis: (id: string, status: 'validated' | 'rejected') =>
    patch(`/med/twin/hypotheses/${id}`, { status }),
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
