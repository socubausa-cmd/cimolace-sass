// Persistance serveur du Bilan de transformation, via l'API form-responses
// existante (POST/GET /med/forms/:id/responses) — aucun déploiement backend.
// Le bilan est stocké comme une réponse rattachée à un formulaire « marqueur »
// (find-or-create), et la roue est recalculée au chargement.
import { QUESTIONS, type Answers } from './transformation';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';
const BILAN_TITLE = 'Bilan de transformation';
const FORMID_CACHE = 'medos_bilan_form_id';

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {
    Authorization: 'Bearer ' + (localStorage.getItem('supabase_token') || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}
const unwrap = (d: any) => (d?.data !== undefined ? d.data : d);

// Représentation « formulaire » du questionnaire (pour la galerie + le marqueur).
// Les choix multiples sont rendus en select ici ; le vrai remplissage riche
// (multi) se fait dans le modal BilanModal — la réponse stocke les arrays.
const BILAN_FIELDS = QUESTIONS.map((q) => ({
  id: q.id, label: q.label, type: 'select' as const, required: false, options: q.options,
}));

let cached: string | null = null;
let inflight: Promise<string | null> | null = null;

/** Trouve (ou crée) le formulaire « Bilan de transformation » et renvoie son id. */
export async function ensureBilanForm(): Promise<string | null> {
  if (cached) return cached;
  try { const c = localStorage.getItem(FORMID_CACHE); if (c) { cached = c; return c; } } catch { /* noop */ }
  if (inflight) return inflight; // dédup des appels concurrents (évite un double-create)
  inflight = resolveBilanForm().finally(() => { inflight = null; });
  return inflight;
}

async function resolveBilanForm(): Promise<string | null> {
  try {
    const forms = unwrap(await (await fetch(API + '/med/forms', { headers: headers() })).json());
    let id = (Array.isArray(forms) ? forms : []).find((f: any) => f?.title === BILAN_TITLE)?.id as string | undefined;
    if (!id) {
      const r = await fetch(API + '/med/forms', {
        method: 'POST', headers: headers(true),
        body: JSON.stringify({
          title: BILAN_TITLE,
          description: 'Questionnaire Détox Zahir — alimente la roue de transformation.',
          category: 'assessment', is_template: true, fields: BILAN_FIELDS,
        }),
      });
      if (r.ok) id = unwrap(await r.json())?.id;
    }
    if (id) { cached = id; try { localStorage.setItem(FORMID_CACHE, id); } catch { /* noop */ } }
    return id || null;
  } catch { return null; }
}

/** Enregistre les réponses du bilan d'un patient (persistance serveur). */
export async function saveBilanResponse(formId: string, patientId: string, answers: Answers): Promise<boolean> {
  try {
    const r = await fetch(API + `/med/forms/${formId}/responses`, {
      method: 'POST', headers: headers(true),
      body: JSON.stringify({ patient_id: patientId, responses: answers }),
    });
    return r.ok;
  } catch { return false; }
}

/** Charge le dernier bilan enregistré d'un patient (ou null). */
export async function loadLatestBilan(formId: string, patientId: string): Promise<Answers | null> {
  try {
    const list = unwrap(await (await fetch(API + `/med/forms/${formId}/responses`, { headers: headers() })).json());
    const mine = (Array.isArray(list) ? list : [])
      .filter((r: any) => r?.patient_id === patientId)
      .sort((a: any, b: any) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')));
    const resp = mine[0]?.responses;
    return resp && typeof resp === 'object' ? (resp as Answers) : null;
  } catch { return null; }
}
