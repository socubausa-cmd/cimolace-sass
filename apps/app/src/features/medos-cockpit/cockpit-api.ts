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
import { supabase } from '@/lib/customSupabaseClient';
import { authStore } from '@/lib/auth-store';

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
  /** Heure du RDV (ISO) — salle d'attente : compte à rebours. */
  scheduled_at?: string | null;
  /** Motif du RDV — salle d'attente : « Au programme ». */
  agenda_reason?: string | null;
  /** Notes du RDV — détails de l'agenda. */
  agenda_notes?: string | null;
  /** Le praticien a démarré (practitioner_joined_at) → bascule auto. */
  host_present?: boolean;
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
export interface ShopProduct {
  id: string; name: string; price: number | null; compareAtPrice?: number | null; currency: string;
  payUrl: string; description?: string; badge?: string; cta?: string; image?: string; images?: string[];
}

/** Identité de la boutique du tenant (présentation « comme en ligne »). */
export interface ShopBrand { name?: string; domain?: string; logo?: string; }

export type CockpitScene =
  | { kind: 'twin'; sex: 'female' | 'male'; organs: OrganNode[]; focus: string | null }
  | { kind: 'wheel'; domains: WheelDomain[]; organs: Array<{ code: string; name_fr: string; score: { score: number; color: OrganColor } | null }> }
  | { kind: 'soap'; soap: SoapNote }
  | { kind: 'labs'; items: LabResult[] }
  | { kind: 'prescription'; rx: RxDoc }
  | { kind: 'image'; url: string; name: string; mime?: string }
  | { kind: 'shop'; products: ShopProduct[]; brand?: ShopBrand }
  | { kind: 'clear' };

// ── Appels API (host uniquement) ────────────────────────────────────────────

export function getClinicalContext(sessionId: string): Promise<ClinicalContext> {
  return api.get(`/med/teleconsult/${sessionId}/clinical-context`).then(peelData);
}

// ── Boutique DU TENANT (catalogue live + lien produit) ──────────────────────
// La boutique dépend du tenant : chaque tenant a SA boutique e-commerce, avec
// SES produits et SES moyens de paiement (ex. zahirwellness.com + Stripe). On NE
// renvoie donc JAMAIS vers le checkout d'abonnement LIRI. Le catalogue est lu en
// direct sur la boutique du tenant ; « Payer » ouvre la fiche produit de CETTE
// boutique (où le paiement du tenant est déjà branché).
//
// Config résolue par slug (tenant courant) via une ligne `billing_plans` dédiée
// `key = __storefront__<slug>` — lisible côté front, tenant-scopée. metadata :
//   { baseUrl, productPath, currency, catalog: { url, anonKey, table, select, activeFilter, orderBy } }
// (Design front-only : aucune dépendance à l'API/back — cf. boutique zahirwellness.)

interface StorefrontConfig {
  baseUrl?: string;
  productPath?: string;
  currency?: string; // 'eur' | 'usd' | 'xaf'
  brand?: ShopBrand;
  catalog?: {
    url?: string; anonKey?: string; table?: string;
    select?: string; activeFilter?: string; orderBy?: string;
    imageRel?: string; // relation PostgREST des images (ex: product_images(url,is_primary,sort_order))
  };
}

export interface Storefront { products: ShopProduct[]; brand: ShopBrand; }

async function getStorefrontConfig(): Promise<StorefrontConfig | null> {
  const slug = authStore.getTenantSlug?.();
  if (!slug) return null;
  const { data, error } = await supabase
    .from('billing_plans')
    .select('metadata')
    .eq('key', `__storefront__${slug}`)
    .limit(1);
  if (error || !Array.isArray(data) || !data[0]?.metadata) return null;
  return data[0].metadata as StorefrontConfig;
}

/** Catalogue LIVE de la boutique du tenant (produits + photos + branding) →
 *  scène Boutique. Chaque « Acheter » ouvre la fiche produit de la boutique du
 *  tenant (paiement du tenant). Les images viennent de la relation `imageRel`
 *  (ex. product_images) embarquée en un seul fetch PostgREST. */
export async function getStorefront(): Promise<Storefront> {
  const empty: Storefront = { products: [], brand: {} };
  const cfg = await getStorefrontConfig();
  const cat = cfg?.catalog;
  if (!cfg || !cat?.url || !cat?.anonKey) return empty;

  const baseUrl = (cfg.baseUrl || '').replace(/\/$/, '');
  const productPath = cfg.productPath || '/produit/';
  const currency = (cfg.currency || 'eur').toLowerCase();
  const priceField = currency === 'usd' ? 'price_usd' : currency === 'xaf' ? 'price_xaf' : 'price_eur';
  const cmpField = currency === 'usd' ? 'compare_at_price_usd' : 'compare_at_price_eur';
  const curLabel = currency === 'usd' ? 'USD' : currency === 'xaf' ? 'XAF' : 'EUR';

  const imageRel = cat.imageRel || 'product_images';
  const baseSelect = cat.select
    || 'id,slug,name_fr,name_en,tagline,short_description,badge,price_eur,price_usd,price_xaf,compare_at_price_eur,compare_at_price_usd,is_active,is_featured';
  const select = `${baseSelect},${imageRel}(url,is_primary,sort_order)`;
  let url = `${cat.url.replace(/\/$/, '')}/rest/v1/${cat.table || 'products'}?select=${encodeURIComponent(select)}`;
  if (cat.activeFilter) url += `&${cat.activeFilter}`;
  url += `&order=${encodeURIComponent(cat.orderBy || 'is_featured.desc')}&limit=60`;

  let rows: any[] = [];
  try {
    const res = await fetch(url, { headers: { apikey: cat.anonKey, Authorization: `Bearer ${cat.anonKey}` } });
    rows = res.ok ? await res.json() : [];
  } catch {
    return empty;
  }
  if (!Array.isArray(rows)) return empty;

  const products: ShopProduct[] = rows
    .filter((p) => p && p.slug)
    .map((p: any) => {
      const imgs = Array.isArray(p[imageRel]) ? [...p[imageRel]] : [];
      imgs.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const gallery = imgs.map((i) => i.url).filter(Boolean);
      return {
        id: String(p.id ?? p.slug),
        name: p.name_fr || p.name_en || p.name || String(p.slug),
        price: p[priceField] != null ? Number(p[priceField]) : null,
        compareAtPrice: p[cmpField] != null ? Number(p[cmpField]) : null,
        currency: curLabel,
        payUrl: baseUrl ? `${baseUrl}${productPath}${p.slug}` : `${productPath}${p.slug}`,
        description: p.short_description || p.tagline || undefined,
        image: gallery[0] || p.featured_image_url || undefined,
        images: gallery,
        badge: p.badge || undefined,
        cta: 'Acheter',
      };
    });

  const brand: ShopBrand = {
    name: cfg.brand?.name,
    domain: cfg.brand?.domain || (baseUrl ? baseUrl.replace(/^https?:\/\//, '') : undefined),
    logo: cfg.brand?.logo,
  };
  return { products, brand };
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

/**
 * Génère une note SOAP (S/O/A/P) à partir de la TRANSCRIPTION de la
 * téléconsultation (dictée live du praticien). Appelle l'edge `generate-soap`
 * (DeepSeek). Aide à la rédaction — le praticien revoit avant d'enregistrer.
 */
export async function generateSoapFromTranscript(
  transcript: string,
  opts?: { language?: string; patientContext?: Record<string, unknown> },
): Promise<SoapNote> {
  const { data, error } = await supabase.functions.invoke('generate-soap', {
    body: {
      transcript,
      language: opts?.language || 'fr',
      patientContext: opts?.patientContext,
    },
  });
  if (error) throw new Error(error.message || 'Échec de la génération du SOAP');
  if (data?.error) throw new Error(String(data.error));
  return {
    subjective: data?.subjective ?? null,
    objective: data?.objective ?? null,
    assessment: data?.assessment ?? null,
    plan: data?.plan ?? null,
    is_signed: false,
    created_at: null,
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

/** Ordonnances SIGNÉES du patient (les plus récentes d'abord). Le `list` n'embarque
 *  PAS les lignes → on enrichit la plus récente avec son détail (items) via `get`. */
export async function getSignedPrescriptions(patientId: string): Promise<RxDoc[]> {
  const list: any[] = await prescriptionsApi
    .list({ patient_id: patientId, status: 'signed' })
    .then((r: any) => (Array.isArray(r) ? r : []))
    .catch(() => []);
  if (!list.length) return [];
  const full = await prescriptionsApi.get(list[0].id).catch(() => list[0]);
  // Ne remplace la 1re par la version détaillée QUE si elle porte des lignes
  // (sinon on partagerait une ordonnance vide — items non chargés).
  const head = Array.isArray(full?.items) && full.items.length ? full : list[0];
  return [head, ...list.slice(1)];
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
