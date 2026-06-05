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
  // Vague 2
  getWheel: (pid: string) => get(`/med/twin/${pid}/wheel`),
  saveWheel: (pid: string, scores: Array<{ domain: string; score: number }>) =>
    post(`/med/twin/${pid}/wheel`, { scores }),
  listEvents: (pid: string) => get(`/med/twin/${pid}/events`),
  createEvent: (pid: string, e: { event_type: string; title: string; occurred_at: string }) =>
    post(`/med/twin/${pid}/events`, e),
  history: (pid: string) => get(`/med/twin/${pid}/history`),
  correlations: (pid: string) => get(`/med/twin/${pid}/correlations`),
  simulate: (pid: string, interventions: string[]) =>
    post(`/med/twin/${pid}/simulate`, { interventions }),
  rootCause: (pid: string) => post(`/med/twin/${pid}/root-cause`),
  council: (pid: string) => post(`/med/twin/${pid}/council`),
  scientific: (query: string) => post('/med/twin/scientific', { query }),
  createDocument: (pid: string, raw_text: string, lab_name?: string) =>
    post(`/med/twin/${pid}/documents`, { raw_text, lab_name, source_type: 'blood' }),
  extractDocument: (pid: string, docId: string) =>
    post(`/med/twin/${pid}/documents/${docId}/extract`),
};

export const WHEEL_LABELS: Record<string, string> = {
  digestion: 'Digestion', sleep: 'Sommeil', stress: 'Stress', energy: 'Énergie',
  inflammation: 'Inflammation', immunity: 'Immunité', metabolism: 'Métabolisme',
  hormones: 'Hormones', physical_activity: 'Activité physique', cognition: 'Cognition',
  environment: 'Environnement', emotions: 'Émotions',
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
