import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Save, Plus, Trash2, Loader2, Check, ExternalLink, ArrowUp, ArrowDown,
  Sparkles, User, Compass, Tag, HelpCircle, Star,
} from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { tenantsApi } from '@/lib/api-v2';
import activeTenantConfig from '@/lib/tenant/activeTenantConfig';

/**
 * LiriContenuPage — ÉDITEUR du « contenu du site » du tenant, DANS le portail LIRI.
 *
 * Ce que le tenant édite ici EST la source que l'AGENT IMMERSIF Cimolace OS lit pour
 * RENDRE son site public (ex. prorascience.org). Le contenu ne vit plus en dur dans le
 * front : identité, fondateur, vision, offres et FAQ sont stockés dans
 * `tenants.metadata.os_knowledge` (backend `/tenants/current/os-knowledge`). Modifier un
 * champ ici → l'OS re-rend le site au prochain chargement, sans redéploiement.
 *
 * On charge l'OBJET COMPLET et on renvoie l'objet complet : les sections non éditées ici
 * (méthode, comparateur, glossaire, navigation) sont donc préservées à l'identique.
 * Style 100 % chaud LIRI (classes lp-*), aucune fuite violet/bleu.
 */

const clone = (o) => JSON.parse(JSON.stringify(o ?? null));

// Squelette minimal si le tenant n'a pas encore de knowledge en base.
const SKELETON = () => ({
  identity: { name: '', fullName: '', subtitle: '', website: '', stats: [] },
  founder: { name: '', title: '', bio: '' },
  vision: { whatIs: '', problem: '', promise: '', closing: '', pillars: [], values: [] },
  offers: [],
  faq: [],
});

const SECTIONS = [
  { key: 'identite', label: 'Identité', icon: Sparkles },
  { key: 'fondateur', label: 'Fondateur', icon: User },
  { key: 'vision', label: 'Vision', icon: Compass },
  { key: 'offres', label: 'Offres', icon: Tag },
  { key: 'faq', label: 'FAQ', icon: HelpCircle },
];

export default function LiriContenuPage() {
  const [k, setK] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState('identite');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const data = await tenantsApi.getOsKnowledge();
      const base = data && typeof data === 'object' ? data : SKELETON();
      // Garantit la présence des conteneurs édités (sans écraser l'existant).
      base.identity = { stats: [], ...(base.identity || {}) };
      base.founder = { ...(base.founder || {}) };
      base.vision = { pillars: [], values: [], ...(base.vision || {}) };
      base.offers = Array.isArray(base.offers) ? base.offers : [];
      base.faq = Array.isArray(base.faq) ? base.faq : [];
      setK(base);
    } catch (e) {
      setErr(e?.message || 'Impossible de charger le contenu.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Mutation immuable : clone → muter → set. `fn` reçoit le clone.
  const edit = useCallback((fn) => {
    setSaved(false);
    setK((prev) => { const n = clone(prev) || SKELETON(); fn(n); return n; });
  }, []);

  const save = useCallback(async () => {
    if (!k) return;
    setSaving(true); setErr(''); setSaved(false);
    // Nettoyage : retire les lignes de listes vides (points de piliers).
    const payload = clone(k);
    (payload.vision?.pillars || []).forEach((p) => {
      p.points = (p.points || []).map((x) => (x || '').trim()).filter(Boolean);
    });
    try {
      const updated = await tenantsApi.updateOsKnowledge(payload);
      if (updated && typeof updated === 'object') setK({ ...payload, ...updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 2600);
    } catch (e) {
      setErr(e?.message || 'Enregistrement impossible.');
    } finally { setSaving(false); }
  }, [k]);

  const publicUrl = useMemo(() => {
    const origin = activeTenantConfig?.branding?.publicSiteOrigin
      || (activeTenantConfig?.branding?.domain ? `https://${activeTenantConfig.branding.domain}` : null);
    return origin || null;
  }, []);

  return (
    <LiriPortalShell active="contenu" rail>
      <div className="lp-scroll relative min-h-0 overflow-y-auto" style={{ background: 'var(--base)', color: 'var(--ink)' }}>
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
          {/* En-tête */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold tracking-tight lp-ink">Contenu du site</h1>
              <p className="mt-1 max-w-xl text-[13.5px] lp-muted">
                Ce que ton assistant immersif raconte de ton organisation sur ton site public — identité, fondateur, vision, offres, FAQ. Tu modifies, le site se met à jour.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {publicUrl && (
                <a href={publicUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border lp-line px-3 py-2 text-[13px] font-medium lp-muted lp-railbtn lp-tr">
                  <ExternalLink size={14} /> Voir le site
                </a>
              )}
              <button onClick={save} disabled={saving || loading}
                className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
                {saved ? 'Enregistré' : 'Enregistrer'}
              </button>
            </div>
          </div>

          {err && <div className="mt-4 rounded-xl border px-3.5 py-2.5 text-[13px]" style={{ borderColor: 'rgba(226,85,63,.3)', background: 'rgba(226,85,63,.08)', color: '#e7a07f' }}>{err}</div>}

          {/* Onglets de section */}
          <div className="lp-scroll -mx-1 mt-5 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon; const on = section === s.key;
              return (
                <button key={s.key} onClick={() => setSection(s.key)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium lp-tr"
                  style={on
                    ? { background: 'rgba(217,119,87,.14)', color: 'var(--coral)' }
                    : { background: 'var(--panel)', color: 'var(--muted)' }}>
                  <Icon size={14} /> {s.label}
                </button>
              );
            })}
          </div>

          {/* Corps */}
          {loading || !k ? (
            <div className="mt-16 flex items-center justify-center lp-muted"><Loader2 className="animate-spin" size={22} /></div>
          ) : (
            <div className="mt-5">
              {section === 'identite' && <IdentiteForm k={k} edit={edit} />}
              {section === 'fondateur' && <FondateurForm k={k} edit={edit} />}
              {section === 'vision' && <VisionForm k={k} edit={edit} />}
              {section === 'offres' && <OffresForm k={k} edit={edit} />}
              {section === 'faq' && <FaqForm k={k} edit={edit} />}
            </div>
          )}
        </div>
      </div>
    </LiriPortalShell>
  );
}

/* ── Sections ─────────────────────────────────────────────────────────────── */

function IdentiteForm({ k, edit }) {
  const id = k.identity || {};
  const set = (key, v) => edit((n) => { n.identity = { ...(n.identity || {}) }; n.identity[key] = v; });
  const stats = id.stats || [];
  return (
    <Card title="Identité" hint="Le nom et le positionnement de ton organisation.">
      <Field label="Nom (affiché)"><input className={inputCls} value={id.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="ex. Prorascience" /></Field>
      <Field label="Nom complet"><input className={inputCls} value={id.fullName || ''} onChange={(e) => set('fullName', e.target.value)} placeholder="ex. ISNA — Initiation aux Sciences…" /></Field>
      <Field label="Sous-titre / accroche"><textarea rows={2} className={inputCls} style={{ resize: 'vertical' }} value={id.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} placeholder="La phrase qui résume ta mission." /></Field>
      <Field label="Site web"><input className={inputCls} value={id.website || ''} onChange={(e) => set('website', e.target.value)} placeholder="ex. prorascience.org" /></Field>

      <ListEditor
        label="Chiffres-clés"
        hint="Les statistiques mises en avant (élèves, pays, satisfaction…)."
        items={stats}
        onAdd={() => edit((n) => { n.identity = { ...(n.identity || {}) }; n.identity.stats = [...(n.identity.stats || []), { label: '', value: '' }]; })}
        onRemove={(i) => edit((n) => { n.identity.stats = (n.identity.stats || []).filter((_, j) => j !== i); })}
        onMove={(i, d) => edit((n) => { moveInPlace(n.identity.stats, i, d); })}
        addLabel="Ajouter un chiffre"
        render={(s, i) => (
          <div className="grid grid-cols-2 gap-2.5">
            <input className={inputCls} value={s.value || ''} onChange={(e) => edit((n) => { n.identity.stats[i].value = e.target.value; })} placeholder="ex. 2500+" />
            <input className={inputCls} value={s.label || ''} onChange={(e) => edit((n) => { n.identity.stats[i].label = e.target.value; })} placeholder="ex. Étudiants formés" />
          </div>
        )}
      />
    </Card>
  );
}

function FondateurForm({ k, edit }) {
  const f = k.founder || {};
  const set = (key, v) => edit((n) => { n.founder = { ...(n.founder || {}) }; n.founder[key] = v; });
  return (
    <Card title="Fondateur" hint="La personne derrière l'organisation.">
      <Field label="Nom"><input className={inputCls} value={f.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="ex. Badika Jel David" /></Field>
      <Field label="Titre / rôle"><input className={inputCls} value={f.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="ex. Recteur — Fondateur" /></Field>
      <Field label="Biographie"><textarea rows={5} className={inputCls} style={{ resize: 'vertical' }} value={f.bio || ''} onChange={(e) => set('bio', e.target.value)} placeholder="Son parcours, sa mission…" /></Field>
    </Card>
  );
}

function VisionForm({ k, edit }) {
  const v = k.vision || {};
  const set = (key, val) => edit((n) => { n.vision = { ...(n.vision || {}) }; n.vision[key] = val; });
  const pillars = v.pillars || [];
  const values = v.values || [];
  return (
    <div className="space-y-4">
      <Card title="Vision" hint="Le récit de fond que l'assistant peut développer.">
        <Field label="Ce que c'est"><textarea rows={3} className={inputCls} style={{ resize: 'vertical' }} value={v.whatIs || ''} onChange={(e) => set('whatIs', e.target.value)} placeholder="La définition de ta démarche." /></Field>
        <Field label="Le problème"><textarea rows={2} className={inputCls} style={{ resize: 'vertical' }} value={v.problem || ''} onChange={(e) => set('problem', e.target.value)} placeholder="Le manque auquel tu réponds." /></Field>
        <Field label="La promesse"><textarea rows={2} className={inputCls} style={{ resize: 'vertical' }} value={v.promise || ''} onChange={(e) => set('promise', e.target.value)} placeholder="Ce que tu apportes." /></Field>
        <Field label="Mot de la fin"><textarea rows={2} className={inputCls} style={{ resize: 'vertical' }} value={v.closing || ''} onChange={(e) => set('closing', e.target.value)} placeholder="La phrase qui conclut." /></Field>
      </Card>

      <Card title="Piliers" hint="Les fondements de ta démarche (titre + points).">
        <ListEditor
          items={pillars}
          onAdd={() => edit((n) => { n.vision = { ...(n.vision || {}) }; n.vision.pillars = [...(n.vision.pillars || []), { title: '', points: [''] }]; })}
          onRemove={(i) => edit((n) => { n.vision.pillars = (n.vision.pillars || []).filter((_, j) => j !== i); })}
          onMove={(i, d) => edit((n) => { moveInPlace(n.vision.pillars, i, d); })}
          addLabel="Ajouter un pilier"
          render={(p, i) => (
            <div className="space-y-2.5">
              <input className={inputCls} value={p.title || ''} onChange={(e) => edit((n) => { n.vision.pillars[i].title = e.target.value; })} placeholder="Titre du pilier" />
              <textarea rows={3} className={inputCls} style={{ resize: 'vertical' }}
                value={(p.points || []).join('\n')}
                onChange={(e) => edit((n) => { n.vision.pillars[i].points = e.target.value.split('\n'); })}
                placeholder={'Un point par ligne'} />
            </div>
          )}
        />
      </Card>

      <Card title="Valeurs" hint="Ce qui guide l'organisation (titre + description).">
        <ListEditor
          items={values}
          onAdd={() => edit((n) => { n.vision = { ...(n.vision || {}) }; n.vision.values = [...(n.vision.values || []), { title: '', desc: '' }]; })}
          onRemove={(i) => edit((n) => { n.vision.values = (n.vision.values || []).filter((_, j) => j !== i); })}
          onMove={(i, d) => edit((n) => { moveInPlace(n.vision.values, i, d); })}
          addLabel="Ajouter une valeur"
          render={(val, i) => (
            <div className="space-y-2.5">
              <input className={inputCls} value={val.title || ''} onChange={(e) => edit((n) => { n.vision.values[i].title = e.target.value; })} placeholder="Titre de la valeur" />
              <textarea rows={2} className={inputCls} style={{ resize: 'vertical' }} value={val.desc || ''} onChange={(e) => edit((n) => { n.vision.values[i].desc = e.target.value; })} placeholder="Description" />
            </div>
          )}
        />
      </Card>
    </div>
  );
}

function OffresForm({ k, edit }) {
  const offers = k.offers || [];
  return (
    <Card title="Offres" hint="Ce que l'assistant présente comme parcours et tarifs. Aligne les prix sur tes services facturables.">
      <ListEditor
        items={offers}
        onAdd={() => edit((n) => { n.offers = [...(n.offers || []), { name: '', price: '', suffix: '', desc: '', popular: false }]; })}
        onRemove={(i) => edit((n) => { n.offers = (n.offers || []).filter((_, j) => j !== i); })}
        onMove={(i, d) => edit((n) => { moveInPlace(n.offers, i, d); })}
        addLabel="Ajouter une offre"
        render={(o, i) => (
          <div className="space-y-2.5">
            <input className={inputCls} value={o.name || ''} onChange={(e) => edit((n) => { n.offers[i].name = e.target.value; })} placeholder="Nom de l'offre" />
            <div className="grid grid-cols-2 gap-2.5">
              <input className={inputCls} value={o.price || ''} onChange={(e) => edit((n) => { n.offers[i].price = e.target.value; })} placeholder="ex. 79 €" />
              <input className={inputCls} value={o.suffix || ''} onChange={(e) => edit((n) => { n.offers[i].suffix = e.target.value; })} placeholder="ex. /mois" />
            </div>
            <textarea rows={2} className={inputCls} style={{ resize: 'vertical' }} value={o.desc || ''} onChange={(e) => edit((n) => { n.offers[i].desc = e.target.value; })} placeholder="Ce que l'offre inclut" />
            <button type="button" onClick={() => edit((n) => { n.offers[i].popular = !n.offers[i].popular; })}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium lp-tr"
              style={o.popular ? { background: 'rgba(217,119,87,.16)', color: 'var(--coral)' } : { background: 'var(--panel)', color: 'var(--faint)' }}>
              <Star size={12} fill={o.popular ? 'currentColor' : 'none'} /> {o.popular ? 'Mise en avant' : 'Mettre en avant'}
            </button>
          </div>
        )}
      />
    </Card>
  );
}

function FaqForm({ k, edit }) {
  const faq = k.faq || [];
  return (
    <Card title="FAQ" hint="Les questions fréquentes que l'assistant sait répondre.">
      <ListEditor
        items={faq}
        onAdd={() => edit((n) => { n.faq = [...(n.faq || []), { q: '', a: '' }]; })}
        onRemove={(i) => edit((n) => { n.faq = (n.faq || []).filter((_, j) => j !== i); })}
        onMove={(i, d) => edit((n) => { moveInPlace(n.faq, i, d); })}
        addLabel="Ajouter une question"
        render={(item, i) => (
          <div className="space-y-2.5">
            <input className={inputCls} value={item.q || ''} onChange={(e) => edit((n) => { n.faq[i].q = e.target.value; })} placeholder="La question" />
            <textarea rows={2} className={inputCls} style={{ resize: 'vertical' }} value={item.a || ''} onChange={(e) => edit((n) => { n.faq[i].a = e.target.value; })} placeholder="La réponse" />
          </div>
        )}
      />
    </Card>
  );
}

/* ── Primitives ───────────────────────────────────────────────────────────── */

function moveInPlace(arr, i, dir) {
  const j = i + dir;
  if (!arr || j < 0 || j >= arr.length) return;
  const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
}

const inputCls = 'w-full rounded-xl border lp-line bg-transparent px-3 py-2.5 text-[14px] lp-ink outline-none placeholder:lp-faint focus:border-[var(--coral)]';

function Card({ title, hint, children }) {
  return (
    <section className="rounded-2xl border lp-line p-4 sm:p-5" style={{ background: 'var(--panel)' }}>
      {title && <h2 className="text-[15.5px] font-semibold lp-ink">{title}</h2>}
      {hint && <p className="mt-0.5 text-[12.5px] lp-muted">{hint}</p>}
      <div className="mt-4 space-y-3.5">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium lp-muted">{label}</span>
      {children}
    </label>
  );
}

/** Liste éditable générique : ajouter, supprimer, réordonner (↑/↓). */
function ListEditor({ label, hint, items, onAdd, onRemove, onMove, addLabel, render }) {
  return (
    <div>
      {label && <span className="mb-1.5 block text-[12px] font-medium lp-muted">{label}</span>}
      {hint && <p className="-mt-1 mb-2 text-[11.5px] lp-faint">{hint}</p>}
      <div className="space-y-2.5">
        {(items || []).map((it, i) => (
          <div key={i} className="rounded-xl border lp-line p-3" style={{ background: 'rgba(245,244,238,.02)' }}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">{render(it, i)}</div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label="Monter" className="grid h-7 w-7 place-items-center rounded-lg lp-muted lp-railbtn lp-tr disabled:opacity-30"><ArrowUp size={14} /></button>
                <button type="button" onClick={() => onMove(i, 1)} disabled={i === (items.length - 1)} aria-label="Descendre" className="grid h-7 w-7 place-items-center rounded-lg lp-muted lp-railbtn lp-tr disabled:opacity-30"><ArrowDown size={14} /></button>
                <button type="button" onClick={() => onRemove(i)} aria-label="Supprimer" className="grid h-7 w-7 place-items-center rounded-lg lp-muted lp-railbtn lp-tr"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={onAdd}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-dashed lp-line px-3 py-2 text-[13px] font-medium lp-muted lp-railbtn lp-tr">
        <Plus size={15} /> {addLabel || 'Ajouter'}
      </button>
    </div>
  );
}
