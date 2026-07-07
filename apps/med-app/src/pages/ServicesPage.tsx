import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Store,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  CalendarCheck,
  X,
  Loader2,
} from 'lucide-react';
import { useIsMobile } from '../lib/useIsMobile';

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace praticien — « Mes offres & services »
// Le praticien crée/publie ses services (consultation, coaching, masterclass…),
// payants ou gratuits. Un service ACTIF apparaît sur la page d'accueil du tenant
// (GET /tenants/public/:slug/offers). Un service « réservable » (payant) exige un
// paiement avant la prise de RDV (gate serveur access_passes). API = billing/catalog.
// ─────────────────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

/** Id du praticien connecté (= sub du JWT) — stocké sur le service réservable pour
 *  que la prise de RDV côté client sache avec quel praticien réserver. */
function currentUserId(): string | null {
  try {
    const t = localStorage.getItem('supabase_token') || '';
    return JSON.parse(atob(t.split('.')[1])).sub || null;
  } catch {
    return null;
  }
}

type AccessModel = 'paid' | 'free' | 'community';
type Category = 'consultation' | 'mentorat' | 'masterclass' | 'custom';

interface Service {
  key: string;
  category: Category | string;
  label: string;
  tagline?: string | null;
  description?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  billingCycle?: string | null;
  accessModel?: AccessModel | null;
  isActive?: boolean;
  sortOrder?: number | null;
  features?: string[] | null;
  metadata?: Record<string, any> | null;
}

const CATEGORIES: { key: Category; label: string; hint: string }[] = [
  { key: 'consultation', label: 'Consultation', hint: 'Un RDV en téléconsultation ou au cabinet' },
  { key: 'mentorat', label: 'Coaching / Accompagnement', hint: 'Suivi récurrent, séances de coaching' },
  { key: 'masterclass', label: 'Masterclass / Atelier', hint: 'Session collective ou événement' },
  { key: 'custom', label: 'Autre service', hint: 'Prestation libre' },
];

const CAT_COLOR: Record<string, string> = {
  consultation: '#0d9488',
  mentorat: '#7c3aed',
  masterclass: '#d97706',
  custom: '#64748b',
};

function fmtPrice(s: Service): string {
  const cents = Number(s.priceCents ?? 0);
  if (!(cents > 0) || s.accessModel === 'free' || s.accessModel === 'community') {
    return s.accessModel === 'community' ? 'Communauté' : 'Gratuit';
  }
  const cur = (s.currency || 'EUR').toUpperCase();
  const amount = cents / 100;
  if (cur === 'XAF' || cur === 'XOF') return `${Math.round(amount).toLocaleString('fr')} FCFA`;
  return `${amount.toLocaleString('fr', { minimumFractionDigits: 0 })} ${cur === 'EUR' ? '€' : cur}`;
}

const EMPTY_FORM = {
  key: '' as string | null,
  category: 'consultation' as Category,
  label: '',
  tagline: '',
  description: '',
  priceMajor: '' as string, // en €/FCFA (converti en centimes à l'envoi)
  currency: 'EUR',
  billingCycle: 'one_time',
  accessModel: 'paid' as AccessModel,
  bookable: true,
  appointmentType: 'teleconsult',
  durationMinutes: 30,
  eventDate: '', // masterclass/événement : date+heure (datetime-local)
};

export default function ServicesPage() {
  const isMobile = useIsMobile();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<null | 'new' | Service>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/billing/catalog`, { headers: authHeaders() });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message || body?.message || `Erreur ${res.status}`);
      // L'API renvoie {data:{services:[…]}} (ré-emballé par l'intercepteur global).
      const list = (body?.data?.services ?? body?.data ?? body ?? []) as Service[];
      setServices(Array.isArray(list) ? list : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setEditing('new');
  }
  function openEdit(s: Service) {
    const meta = s.metadata || {};
    setForm({
      key: s.key,
      category: (s.category as Category) || 'consultation',
      label: s.label || '',
      tagline: s.tagline || '',
      description: s.description || '',
      priceMajor: s.priceCents ? String((s.priceCents / 100)) : '',
      currency: (s.currency || 'EUR').toUpperCase(),
      billingCycle: s.billingCycle || 'one_time',
      accessModel: (s.accessModel as AccessModel) || 'paid',
      bookable: !!meta.bookable,
      appointmentType: meta.appointment_type || 'teleconsult',
      durationMinutes: Number(meta.duration_minutes || 30),
      eventDate: meta.scheduled_at ? String(meta.scheduled_at).slice(0, 16) : '',
    });
    setEditing(s);
  }

  async function save() {
    if (!form.label.trim()) {
      setError('Donne un nom à ton service.');
      return;
    }
    setSaving(true);
    setError(null);
    const priceCents =
      form.accessModel === 'paid' ? Math.round(Number(form.priceMajor || '0') * 100) : 0;
    const isEvent = form.category === 'masterclass';
    const pid = (editing !== 'new' && (editing as Service)?.metadata?.practitioner_id) || currentUserId();
    let metadata: Record<string, any>;
    if (isEvent) {
      // Masterclass / événement en direct : pas de RDV 1-à-1, mais une date fixe.
      metadata = { event: true, scheduled_at: form.eventDate || null };
      if (pid) metadata.practitioner_id = pid;
    } else {
      metadata = { bookable: form.bookable };
      if (form.bookable) {
        metadata.appointment_type = form.appointmentType;
        metadata.duration_minutes = Number(form.durationMinutes) || 30;
        if (pid) metadata.practitioner_id = pid;
      }
    }
    const payload = {
      category: form.category,
      label: form.label.trim(),
      tagline: form.tagline.trim() || undefined,
      description: form.description.trim() || undefined,
      priceCents,
      currency: form.currency,
      billingCycle: form.category === 'mentorat' ? form.billingCycle : 'one_time',
      accessModel: form.accessModel,
      metadata,
    };
    try {
      const isEdit = editing !== 'new' && form.key;
      const res = await fetch(
        isEdit ? `${API}/billing/catalog/${encodeURIComponent(form.key as string)}` : `${API}/billing/catalog`,
        { method: isEdit ? 'PATCH' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message || body?.message || `Erreur ${res.status}`);
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Service) {
    try {
      const res = await fetch(`${API}/billing/catalog/${encodeURIComponent(s.key)}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error?.message || b?.message || `Erreur ${res.status}`);
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(s: Service) {
    if (!confirm(`Supprimer « ${s.label} » ?`)) return;
    try {
      const res = await fetch(`${API}/billing/catalog/${encodeURIComponent(s.key)}?hard=true`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error?.message || b?.message || `Erreur ${res.status}`);
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const activeCount = useMemo(() => services.filter((s) => s.isActive).length, [services]);

  const card: CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid var(--zw-border)',
    padding: 16,
  };
  const btnPrimary: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px',
    background: 'var(--brand-primary, var(--zw-indigo))', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: 12, marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Store size={22} color="var(--brand-primary, var(--zw-indigo))" /> Mes offres &amp; services
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--zw-text-muted)' }}>
            Publie tes consultations, coachings et masterclass. Un service actif apparaît sur ta page d'accueil ; un service payant « réservable » exige le paiement avant la prise de RDV.
          </p>
        </div>
        <button onClick={openNew} style={btnPrimary}>
          <Plus size={16} /> Nouveau service
        </button>
      </div>

      {error && (
        <div style={{ margin: '12px 0', padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>{error}</div>
      )}

      <div style={{ fontSize: 12, color: 'var(--zw-text-faint)', margin: '14px 0 8px' }}>
        {loading ? 'Chargement…' : `${services.length} service(s) · ${activeCount} publié(s)`}
      </div>

      {!loading && services.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: 'var(--zw-text-muted)', padding: 32 }}>
          Aucun service pour l'instant. Crée ta première offre (ex. « Consultation 45 min »).
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {services.map((s) => {
          const bookable = !!s.metadata?.bookable;
          const cat = String(s.category);
          return (
            <div key={s.key} style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-start', opacity: s.isActive ? 1 : 0.6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--zw-text)' }}>{s.label}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: CAT_COLOR[cat] || '#64748b', background: (CAT_COLOR[cat] || '#64748b') + '18', padding: '2px 8px', borderRadius: 999 }}>
                    {CATEGORIES.find((c) => c.key === cat)?.label || cat}
                  </span>
                  {bookable && (
                    <span title="Prise de RDV" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 700, color: '#0d9488', background: '#0d948818', padding: '2px 8px', borderRadius: 999 }}>
                      <CalendarCheck size={11} /> Réservable
                    </span>
                  )}
                  {!s.isActive && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', background: '#64748b18', padding: '2px 8px', borderRadius: 999 }}>Brouillon</span>
                  )}
                </div>
                {s.tagline && <div style={{ fontSize: 13, color: 'var(--zw-text-muted)', marginTop: 3 }}>{s.tagline}</div>}
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-primary, var(--zw-indigo))', marginTop: 6 }}>
                  {fmtPrice(s)}
                  {s.accessModel === 'paid' && s.category === 'mentorat' && s.billingCycle === 'monthly' ? <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--zw-text-muted)' }}> / mois</span> : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => toggleActive(s)} title={s.isActive ? 'Dépublier' : 'Publier'} style={iconBtn}>
                  {s.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button onClick={() => openEdit(s)} title="Modifier" style={iconBtn}>
                  <Pencil size={16} />
                </button>
                <button onClick={() => remove(s)} title="Supprimer" style={{ ...iconBtn, color: '#dc2626' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <ServiceDialog
          isNew={editing === 'new'}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={save}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

const iconBtn: CSSProperties = {
  display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 8,
  border: '1px solid var(--zw-border)', background: '#fff', color: 'var(--zw-text-soft)', cursor: 'pointer',
};

function ServiceDialog({
  isNew, form, setForm, saving, onClose, onSave, isMobile,
}: {
  isNew: boolean;
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  isMobile: boolean;
}) {
  const set = (patch: Partial<typeof EMPTY_FORM>) => setForm({ ...form, ...patch });
  const label: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--zw-text-soft)', marginBottom: 4, display: 'block' };
  const input: CSSProperties = {
    width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--zw-border)',
    fontSize: 14, color: 'var(--zw-text)', background: '#fff', boxSizing: 'border-box',
  };
  const pill = (active: boolean): CSSProperties => ({
    padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: '1px solid ' + (active ? 'var(--brand-primary, var(--zw-indigo))' : 'var(--zw-border)'),
    background: active ? 'var(--brand-primary, var(--zw-indigo))' : '#fff',
    color: active ? '#fff' : 'var(--zw-text-soft)',
  });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: isMobile ? 'end stretch' : 'center', zIndex: 100, padding: isMobile ? 0 : 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: isMobile ? '16px 16px 0 0' : 14, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{isNew ? 'Nouveau service' : 'Modifier le service'}</h3>
          <button onClick={onClose} style={{ ...iconBtn, border: 'none' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <span style={label}>Type de service</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map((c) => (
                <button key={c.key} onClick={() => set({ category: c.key })} style={pill(form.category === c.key)}>{c.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--zw-text-faint)', marginTop: 5 }}>{CATEGORIES.find((c) => c.key === form.category)?.hint}</div>
          </div>

          <div>
            <span style={label}>Nom du service *</span>
            <input style={input} value={form.label} onChange={(e) => set({ label: e.target.value })} placeholder="Ex. Consultation naturopathie 45 min" />
          </div>
          <div>
            <span style={label}>Accroche (optionnel)</span>
            <input style={input} value={form.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="Un bilan complet + plan personnalisé" />
          </div>
          <div>
            <span style={label}>Description (optionnel)</span>
            <textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </div>

          <div>
            <span style={label}>Accès</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['paid', 'free', 'community'] as AccessModel[]).map((m) => (
                <button key={m} onClick={() => set({ accessModel: m })} style={pill(form.accessModel === m)}>
                  {m === 'paid' ? 'Payant' : m === 'free' ? 'Gratuit' : 'Communauté'}
                </button>
              ))}
            </div>
          </div>

          {form.accessModel === 'paid' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 10 }}>
              <div>
                <span style={label}>Prix</span>
                <input style={input} type="number" min={0} value={form.priceMajor} onChange={(e) => set({ priceMajor: e.target.value })} placeholder="50" />
              </div>
              <div>
                <span style={label}>Devise</span>
                <select style={input} value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
                  <option value="EUR">EUR (€)</option>
                  <option value="XAF">FCFA (XAF)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
          )}

          {form.accessModel === 'paid' && form.category === 'mentorat' && (
            <div>
              <span style={label}>Facturation</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ k: 'one_time', l: 'Paiement unique' }, { k: 'monthly', l: 'Abonnement mensuel' }].map((o) => (
                  <button key={o.k} onClick={() => set({ billingCycle: o.k })} style={pill(form.billingCycle === o.k)}>{o.l}</button>
                ))}
              </div>
            </div>
          )}

          {form.category === 'masterclass' ? (
            <div style={{ borderTop: '1px solid var(--zw-border)', paddingTop: 14 }}>
              <span style={label}>Date &amp; heure de l'événement</span>
              <input style={input} type="datetime-local" value={form.eventDate} onChange={(e) => set({ eventDate: e.target.value })} />
              <div style={{ fontSize: 11.5, color: 'var(--zw-text-faint)', marginTop: 4 }}>
                Le client paie sa place ; il rejoint le direct à cette date. Événement collectif (pas un RDV 1-à-1).
              </div>
            </div>
          ) : (
          <div style={{ borderTop: '1px solid var(--zw-border)', paddingTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.bookable} onChange={(e) => set({ bookable: e.target.checked })} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--zw-text)' }}>Réservable (prise de rendez-vous)</span>
            </label>
            <div style={{ fontSize: 11.5, color: 'var(--zw-text-faint)', marginTop: 4 }}>
              Le client réserve un créneau après l'achat. Un service payant non payé = pas de RDV.
            </div>
            {form.bookable && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 10, marginTop: 10 }}>
                <div>
                  <span style={label}>Format du RDV</span>
                  <select style={input} value={form.appointmentType} onChange={(e) => set({ appointmentType: e.target.value })}>
                    <option value="teleconsult">Téléconsultation</option>
                    <option value="in_person">Au cabinet</option>
                    <option value="phone">Téléphone</option>
                    <option value="home_visit">À domicile</option>
                  </select>
                </div>
                <div>
                  <span style={label}>Durée (min)</span>
                  <input style={input} type="number" min={5} max={240} value={form.durationMinutes} onChange={(e) => set({ durationMinutes: Number(e.target.value) })} />
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ ...iconBtn, width: 'auto', padding: '9px 16px', fontSize: 14, fontWeight: 600 }}>Annuler</button>
          <button
            onClick={onSave}
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'var(--brand-primary, var(--zw-indigo))', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving && <Loader2 size={15} className="spin" />} {isNew ? 'Créer & publier' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
