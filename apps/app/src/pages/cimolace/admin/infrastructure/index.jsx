import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Server, Database, Video, Cpu, CreditCard, Mail, Wrench,
  RefreshCw, Plus, Trash2, ExternalLink, AlertTriangle, Check, Loader2, Pencil, X,
} from 'lucide-react';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { apiV2 } from '@/lib/api-v2';
import { T, FS, R, NUM, useConsoleCss } from '../../theme';

/**
 * INFRASTRUCTURE ET CHARGE — ce que la plateforme coûte, et ce qui tourne.
 *
 * ⭐ L'écran sépare deux grandeurs que tout le monde confond :
 *   — l'ENGAGEMENT : ce qui tombe chaque mois, qu'il se passe quelque chose ou non ;
 *   — la DÉPENSE : ce qui a réellement été payé, mois par mois.
 * Un service facturé à l'usage a un engagement NUL et une facture bien réelle.
 * Les additionner effacerait l'écart entre le prévu et le payé — qui est
 * justement ce qu'on vient chercher ici.
 *
 * Ce que cet écran NE fait pas : deviner les montants. Presque aucun fournisseur
 * n'expose « ce que vous me devez » par API. Les chiffres sont donc saisis, avec
 * leur source affichée, plutôt qu'estimés et présentés comme des faits.
 */

const CATEGORIES = [
  { key: 'hebergement', label: 'Hébergement', Icon: Server },
  { key: 'base', label: 'Base & stockage', Icon: Database },
  { key: 'media', label: 'Média & live', Icon: Video },
  { key: 'ia', label: 'Intelligence artificielle', Icon: Cpu },
  { key: 'paiement', label: 'Paiement', Icon: CreditCard },
  { key: 'communication', label: 'Communication', Icon: Mail },
  { key: 'outil', label: 'Outils', Icon: Wrench },
];
const CYCLES = [
  { key: 'mensuel', label: 'Mensuel' },
  { key: 'annuel', label: 'Annuel' },
  { key: 'usage', label: 'À l’usage' },
  { key: 'gratuit', label: 'Gratuit' },
];
const STATUTS = [
  { key: 'actif', label: 'Actif' },
  { key: 'essai', label: 'Essai' },
  { key: 'suspendu', label: 'Suspendu' },
  { key: 'resilie', label: 'Résilié' },
];
const DEVISES = ['EUR', 'USD', 'XAF', 'XOF'];
const ZERO_DECIMAL = new Set(['XAF', 'XOF']);

const unwrap = (r) => { let d = r?.data; while (d && typeof d === 'object' && 'data' in d) d = d.data; return d; };
const eur = (n) => `${(Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const brut = (v, cur) => `${(ZERO_DECIMAL.has(cur) ? Number(v || 0) : Number(v || 0) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${cur}`;
const moisFr = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const erreurLisible = (e) =>
  e?.response?.data?.error?.message || e?.response?.data?.message
  || (e?.message === 'Network Error' || !e?.response ? "L'API est injoignable depuis ce navigateur." : e?.message)
  || 'Opération impossible.';

const SANTE = {
  ok: { label: 'Répond', c: T.ok },
  warn: { label: 'Dégradé', c: T.warn },
  down: { label: 'Ne répond pas', c: T.danger },
};

export default function CimolaceAdminInfrastructure() {
  useConsoleCss();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [edit, setEdit] = useState(null);      // service en cours d'édition, ou {} pour un nouveau
  const [depFor, setDepFor] = useState(null);  // service dont on saisit la dépense
  const [filtre, setFiltre] = useState('tous');

  const [railway, setRailway] = useState(null);

  const load = useCallback(() => {
    apiV2.get('/cimolace-backoffice/infra', { timeout: 20000 })
      .then((r) => { setData(unwrap(r)); setErr(null); })
      .catch((e) => setErr(erreurLisible(e)));
    apiV2.get('/cimolace-backoffice/infra/railway-usage', { timeout: 20000 })
      .then((r) => setRailway(unwrap(r))).catch(() => setRailway(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (ok, text) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 6000); };

  const sonder = async () => {
    setBusy('sonde'); setMsg(null);
    try {
      const r = unwrap(await apiV2.post('/cimolace-backoffice/infra/health', {}, { timeout: 60000 }));
      const ko = (r?.resultats || []).filter((x) => x.status !== 'ok');
      // Sonder et ENREGISTRER sont deux choses : une insertion refusée laissait
      // annoncer « tous répondent » alors que rien n'était écrit et que l'écran
      // continuerait d'afficher les résultats de la veille.
      const perdues = (r?.checked ?? 0) - (r?.enregistrees ?? 0);
      const texte = ko.length === 0
        ? `${r?.checked ?? 0} service(s) sondé(s), tous répondent.`
        : `${ko.length} anomalie(s) sur ${r?.checked ?? 0} : ${ko.map((x) => x.label).join(', ')}.`;
      flash(ko.length === 0 && perdues === 0,
        perdues > 0 ? `${texte} ⚠ ${perdues} résultat(s) NON enregistré(s) : ${(r?.erreursEcriture || []).join(' · ')}` : texte);
      load();
    } catch (e) { flash(false, erreurLisible(e)); }
    setBusy('');
  };

  const services = data?.services || [];
  const visibles = useMemo(
    () => (filtre === 'tous' ? services : services.filter((s) => s.category === filtre)),
    [services, filtre],
  );
  const parCategorie = useMemo(() => {
    const m = new Map();
    for (const s of visibles) {
      if (!m.has(s.category)) m.set(s.category, []);
      m.get(s.category).push(s);
    }
    return [...m.entries()];
  }, [visibles]);

  const t = data?.totaux;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <CimolaceHeader />
      <div style={{ display: 'flex' }}>
        <CimolaceSidebar />
        <main style={{ flex: 1, minWidth: 0, padding: '26px clamp(16px, 4vw, 34px) 64px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: FS.hero, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Infrastructure</h1>
              <p style={{ color: T.muted, margin: 0, fontSize: FS.md, lineHeight: 1.55 }}>
                Ce que la plateforme coûte, et ce qui tourne.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="cml-btn cml-btn-ghost" onClick={sonder} disabled={busy === 'sonde'}>
                {busy === 'sonde' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sonder les services
              </button>
              <button type="button" className="cml-btn cml-btn-primary" onClick={() => setEdit({})}>
                <Plus size={15} /> Ajouter un service
              </button>
            </div>
          </div>

          {msg && (
            <p role="status" aria-live="polite" style={{ margin: '14px 0 0', fontSize: FS.base, color: msg.ok ? T.ok : '#e0705f', display: 'flex', gap: 7, alignItems: 'center' }}>
              {msg.ok ? <Check size={15} /> : <AlertTriangle size={15} />} {msg.text}
            </p>
          )}

          {err ? (
            <div role="alert" style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '11px 14px', borderRadius: R.control, background: 'rgba(179,55,47,.14)', border: '1px solid rgba(179,55,47,.5)' }}>
              <AlertTriangle size={15} style={{ color: '#e0705f' }} />
              <span style={{ fontSize: FS.base, flex: 1, minWidth: 180 }}>{err}</span>
              <button type="button" className="cml-btn cml-btn-ghost cml-btn-sm" onClick={load}>Réessayer</button>
            </div>
          ) : !data ? (
            <div style={{ marginTop: 22, display: 'grid', gap: 10 }}>
              {[0, 1, 2].map((i) => <div key={i} className="cml-skeleton" style={{ height: 74 }} />)}
            </div>
          ) : (
            <>
              <Charge t={t} parMois={data.parMois} revenus={data.revenus} />
              <Railway r={railway} />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '26px 0 18px' }}>
                <Puce actif={filtre === 'tous'} onClick={() => setFiltre('tous')}>Tout ({services.length})</Puce>
                {CATEGORIES.map((c) => {
                  const n = services.filter((s) => s.category === c.key).length;
                  if (!n) return null;
                  return <Puce key={c.key} actif={filtre === c.key} onClick={() => setFiltre(c.key)}>{c.label} ({n})</Puce>;
                })}
              </div>

              {parCategorie.map(([cat, liste]) => {
                const meta = CATEGORIES.find((c) => c.key === cat) || CATEGORIES[6];
                return (
                  <section key={cat} style={{ marginBottom: 26 }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px', fontSize: FS.lg, fontWeight: 700 }}>
                      <meta.Icon size={16} style={{ color: T.coral }} /> {meta.label}
                    </h2>
                    <div style={{ border: `1px solid ${T.line}`, borderRadius: R.card, overflow: 'hidden' }}>
                      {liste.map((s, i) => (
                        <Ligne key={s.key} s={s} premier={i === 0}
                          onEdit={() => setEdit(s)} onDepense={() => setDepFor(s)} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </>
          )}

          {edit && (
            <FicheService service={edit} onClose={() => setEdit(null)}
              onSaved={(txt) => { setEdit(null); flash(true, txt); load(); }}
              onError={(txt) => flash(false, txt)} />
          )}
          {depFor && (
            <FicheDepense service={depFor} onClose={() => setDepFor(null)}
              onSaved={(txt) => { setDepFor(null); flash(true, txt); load(); }}
              onError={(txt) => flash(false, txt)} />
          )}
        </main>
      </div>
    </div>
  );
}

function Puce({ actif, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="cml-focus"
      style={{
        borderRadius: R.pill, padding: '5px 13px', fontSize: FS.sm, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit',
        background: actif ? T.coralSoft : 'transparent',
        color: actif ? T.coral : T.muted,
        border: `1px solid ${actif ? 'rgba(217,119,87,.4)' : T.line2}`,
      }}>
      {children}
    </button>
  );
}

/**
 * Le seul chiffre lu automatiquement. Quand le jeton manque, l'écran dit
 * comment l'obtenir au lieu d'afficher une case vide qu'on croirait cassée.
 */
function Railway({ r }) {
  if (!r) return null;
  return (
    <div style={{ marginTop: 14, padding: '12px 15px', borderRadius: R.card, border: `1px solid ${T.line}`, background: T.panel }}>
      <p style={{ margin: 0, fontSize: FS.sm, color: T.muted }}>Usage Railway lu automatiquement</p>
      {!r.configure ? (
        <p style={{ margin: '5px 0 0', fontSize: FS.base, color: T.muted, lineHeight: 1.55, maxWidth: 700 }}>{r.raison}</p>
      ) : r.erreur ? (
        <p style={{ margin: '5px 0 0', fontSize: FS.base, color: T.warn }}>{r.erreur}</p>
      ) : (
        <>
          <p style={{ margin: '3px 0 0', fontSize: FS.xl, fontWeight: 700, ...NUM }}>
            {r.estimationUsd != null ? `${Number(r.estimationUsd).toFixed(2)} $` : '—'}
            <span style={{ fontSize: FS.sm, fontWeight: 400, color: T.faint }}> estimés depuis le {r.depuis}</span>
          </p>
          <p style={{ margin: '5px 0 0', fontSize: FS.xs, color: T.faint, lineHeight: 1.5 }}>
            Estimation Railway en dollars — non convertie et non ajoutée aux totaux en euros, faute de parité fixe.
          </p>
        </>
      )}
    </div>
  );
}

/** La charge : engagement d'un côté, dépense réelle de l'autre. Jamais un seul chiffre. */
function Charge({ t, parMois, revenus }) {
  if (!t) return null;
  const max = Math.max(1, ...(parMois || []).map((m) => m.eur));
  return (
    <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
      <div style={{ background: T.panel, borderRadius: R.card, border: `1px solid ${T.line}`, padding: 18 }}>
        <p style={{ margin: 0, fontSize: FS.sm, color: T.muted }}>Engagement mensuel</p>
        <p style={{ margin: '3px 0 0', fontSize: 34, fontWeight: 700, lineHeight: 1.1, ...NUM }}>{eur(t.engagementEur)}</p>
        <p style={{ margin: '7px 0 0', fontSize: FS.sm, color: T.muted, lineHeight: 1.5 }}>
          Ce qui tombe chaque mois quoi qu&apos;il arrive — abonnements seuls. Les services facturés à l&apos;usage n&apos;y figurent pas.
        </p>
        {(t.engagementNonConvertible || []).map((n) => (
          <p key={n.currency} style={{ margin: '5px 0 0', fontSize: FS.xs, color: T.warn, ...NUM }}>
            + {brut(n.montant, n.currency)} — pas de parité fixe, non converti
          </p>
        ))}
      </div>

      <div style={{ background: T.panel, borderRadius: R.card, border: `1px solid ${T.line}`, padding: 18 }}>
        <p style={{ margin: 0, fontSize: FS.sm, color: T.muted }}>Dépense réelle · {moisFr(t.moisCourant)}</p>
        <p style={{ margin: '3px 0 0', fontSize: 34, fontWeight: 700, lineHeight: 1.1, ...NUM }}>{eur(t.depenseMoisEur)}</p>
        <p style={{ margin: '7px 0 0', fontSize: FS.sm, color: T.muted, lineHeight: 1.5 }}>
          Sur 12 mois : <b style={{ color: T.ink, ...NUM }}>{eur(t.depense12Eur)}</b>. Ce qui a été payé, usage compris.
        </p>
      </div>

      <div style={{ background: T.panel, borderRadius: R.card, border: `1px solid ${T.line}`, padding: 18 }}>
        <p style={{ margin: 0, fontSize: FS.sm, color: T.muted }}>Dépense mois par mois</p>
        {(parMois || []).length === 0 ? (
          <p style={{ margin: '10px 0 0', fontSize: FS.base, color: T.faint, lineHeight: 1.5 }}>
            Aucune dépense saisie. Utilise « Noter une dépense » sur chaque service — c&apos;est ce qui remplira cette courbe.
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 74, marginTop: 12 }}>
            {parMois.map((m) => (
              <div key={m.mois} title={`${moisFr(m.mois)} — ${eur(m.eur)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ width: '100%', height: `${Math.max(3, (m.eur / max) * 58)}px`, background: T.coral, borderRadius: 3, opacity: .85 }} />
                <span style={{ fontSize: 9.5, color: T.faint, whiteSpace: 'nowrap' }}>{moisFr(m.mois).slice(0, 3)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* La charge en face de ce qu'elle produit : un engagement de 200 € est
          confortable à 2 000 € encaissés et mortel à 150 €. */}
      <div style={{ background: T.panel, borderRadius: R.card, border: `1px solid ${revenus?.margeEur < 0 ? T.warn : T.line}`, padding: 18 }}>
        <p style={{ margin: 0, fontSize: FS.sm, color: T.muted }}>Face aux revenus</p>
        <p style={{ margin: '3px 0 0', fontSize: 34, fontWeight: 700, lineHeight: 1.1, ...NUM, color: revenus?.margeEur < 0 ? T.warn : T.ink }}>
          {revenus?.partInfraPct != null ? `${revenus.partInfraPct} %` : '—'}
        </p>
        <p style={{ margin: '7px 0 0', fontSize: FS.sm, color: T.muted, lineHeight: 1.5 }}>
          {revenus?.partInfraPct != null ? (
            <>
              des <b style={{ color: T.ink, ...NUM }}>{eur(revenus.encaisseEur)}</b> encaissés partent dans l&apos;infrastructure.
              Reste <b style={{ color: revenus.margeEur < 0 ? T.warn : T.ink, ...NUM }}>{eur(revenus.margeEur)}</b>.
            </>
          ) : (
            'Aucun revenu encaissé : le ratio n’a pas de sens tant que le dénominateur est nul.'
          )}
        </p>
      </div>

      <div style={{ background: T.panel, borderRadius: R.card, border: `1px solid ${T.line}`, padding: 18 }}>
        <p style={{ margin: 0, fontSize: FS.sm, color: T.muted }}>Parc</p>
        <p style={{ margin: '3px 0 0', fontSize: 34, fontWeight: 700, lineHeight: 1.1, ...NUM }}>{t.servicesActifs}</p>
        <p style={{ margin: '7px 0 0', fontSize: FS.sm, color: T.muted, lineHeight: 1.5 }}>
          services actifs, dont <b style={{ color: T.ink }}>{t.servicesCritiques} critiques</b> — ceux sans lesquels la plateforme s&apos;arrête.
        </p>
      </div>
    </div>
  );
}

function Ligne({ s, premier, onEdit, onDepense }) {
  const sante = s.sante ? (SANTE[s.sante.status] || SANTE.warn) : null;
  const inactif = s.statut !== 'actif';
  return (
    <div className="cml-row" style={{ padding: '13px 15px', borderTop: premier ? 'none' : `1px solid ${T.line}`, opacity: inactif ? .55 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: FS.md, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {s.label}
            {s.is_critical && (
              <span style={{ fontSize: FS.xs, fontWeight: 700, color: T.warn, border: `1px solid ${T.warn}`, borderRadius: R.pill, padding: '1px 7px' }}>critique</span>
            )}
            {inactif && (
              <span style={{ fontSize: FS.xs, color: T.faint, border: `1px solid ${T.line2}`, borderRadius: R.pill, padding: '1px 7px' }}>
                {STATUTS.find((x) => x.key === s.statut)?.label || s.statut}
              </span>
            )}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: FS.sm, color: T.muted }}>
            {s.plan ? `${s.plan} · ` : ''}{CYCLES.find((c) => c.key === s.cycle)?.label || s.cycle}
            {s.renews_on ? ` · renouvellement ${new Date(s.renews_on).toLocaleDateString('fr-FR')}` : ''}
            {sante ? <> · <span style={{ color: sante.c }}>{sante.label}{s.sante.latency_ms ? ` (${s.sante.latency_ms} ms)` : ''}</span></>
              : s.health_url ? '' : ' · non sondé'}
          </p>
          {s.notes && <p style={{ margin: '4px 0 0', fontSize: FS.xs, color: T.faint, lineHeight: 1.45, maxWidth: 620 }}>{s.notes}</p>}
        </div>

        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: FS.md, fontWeight: 700, ...NUM }}>
            {s.amount_cents ? brut(s.amount_cents, s.currency) : <span style={{ color: T.faint, fontWeight: 400 }}>à l’usage</span>}
          </p>
          {s.depense12Eur > 0 && (
            <p style={{ margin: '2px 0 0', fontSize: FS.xs, color: T.faint, ...NUM }}>{eur(s.depense12Eur)} payés sur 12 mois</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="cml-btn cml-btn-ghost cml-btn-sm" onClick={onDepense}>Noter une dépense</button>
          <button type="button" className="cml-btn cml-btn-ghost cml-btn-sm" onClick={onEdit} aria-label={`Modifier ${s.label}`}><Pencil size={13} /></button>
          {s.console_url && (
            <a href={s.console_url} target="_blank" rel="noreferrer" className="cml-btn cml-btn-ghost cml-btn-sm"
              style={{ textDecoration: 'none' }} aria-label={`Ouvrir la console ${s.label}`}><ExternalLink size={13} /></a>
          )}
        </div>
      </div>
    </div>
  );
}

/** Tiroir d'édition. Chaque champ du registre est modifiable ici : rien en dur. */
function FicheService({ service, onClose, onSaved, onError }) {
  const nouveau = !service.key;
  const [f, setF] = useState({
    key: service.key || '', label: service.label || '', category: service.category || 'outil',
    plan: service.plan || '', amount_cents: service.amount_cents ?? 0, currency: service.currency || 'EUR',
    cycle: service.cycle || 'mensuel', statut: service.statut || 'actif', renews_on: service.renews_on || '',
    health_url: service.health_url || '', console_url: service.console_url || '',
    account_email: service.account_email || '', is_critical: !!service.is_critical,
    notes: service.notes || '', sort: service.sort ?? 100,
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiV2.post('/cimolace-backoffice/infra/services', { ...f, renews_on: f.renews_on || null });
      onSaved(nouveau ? `${f.label} ajouté au registre.` : `${f.label} mis à jour.`);
    } catch (e) { onError(erreurLisible(e)); setBusy(false); }
  };
  const supprimer = async () => {
    if (busy || nouveau) return;
    setBusy(true);
    try {
      await apiV2.delete(`/cimolace-backoffice/infra/services/${service.key}`);
      onSaved(`${service.label} retiré du registre.`);
    } catch (e) { onError(erreurLisible(e)); setBusy(false); }
  };

  return (
    <Tiroir titre={nouveau ? 'Ajouter un service' : service.label} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 13 }}>
        <Champ label="Clé" aide="identifiant court, non modifiable ensuite">
          <input className="cml-input" value={f.key} disabled={!nouveau}
            onChange={(e) => set('key', e.target.value)} placeholder="vercel" />
        </Champ>
        <Champ label="Nom affiché">
          <input className="cml-input" value={f.label} onChange={(e) => set('label', e.target.value)} placeholder="Vercel — front" />
        </Champ>
        <Champ label="Catégorie">
          <select className="cml-input" value={f.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Champ>
        <Champ label="Formule">
          <input className="cml-input" value={f.plan} onChange={(e) => set('plan', e.target.value)} placeholder="Pro" />
        </Champ>
        <Champ label="Montant" aide="0 si facturé à l’usage">
          <input className="cml-input" type="number" value={f.amount_cents} style={NUM}
            onChange={(e) => set('amount_cents', Number(e.target.value))} onWheel={(e) => e.currentTarget.blur()} />
        </Champ>
        <Champ label="Devise">
          <select className="cml-input" value={f.currency} onChange={(e) => set('currency', e.target.value)}>
            {DEVISES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Champ>
        <Champ label="Rythme">
          <select className="cml-input" value={f.cycle} onChange={(e) => set('cycle', e.target.value)}>
            {CYCLES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Champ>
        <Champ label="Statut">
          <select className="cml-input" value={f.statut} onChange={(e) => set('statut', e.target.value)}>
            {STATUTS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Champ>
        <Champ label="Renouvellement">
          <input className="cml-input" type="date" value={f.renews_on || ''} onChange={(e) => set('renews_on', e.target.value)} />
        </Champ>
        <Champ label="URL de sonde" aide="ce qui répond à « est-ce que ça tourne ? »">
          <input className="cml-input" value={f.health_url} onChange={(e) => set('health_url', e.target.value)} placeholder="https://…/health" />
        </Champ>
        <Champ label="Console du fournisseur">
          <input className="cml-input" value={f.console_url} onChange={(e) => set('console_url', e.target.value)} placeholder="https://vercel.com" />
        </Champ>
        <Champ label="Compte facturé">
          <input className="cml-input" value={f.account_email} onChange={(e) => set('account_email', e.target.value)} placeholder="cimolace@gmail.com" />
        </Champ>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, fontSize: FS.base, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.is_critical} onChange={(e) => set('is_critical', e.target.checked)} />
        Critique — sans ce service, la plateforme s&apos;arrête
      </label>

      <Champ label="Notes" style={{ marginTop: 13 }}>
        <textarea className="cml-input" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)}
          style={{ resize: 'vertical', lineHeight: 1.5 }} />
      </Champ>

      <div style={{ display: 'flex', gap: 9, marginTop: 18, flexWrap: 'wrap' }}>
        <button type="button" className="cml-btn cml-btn-primary" onClick={save} disabled={busy || !f.key.trim() || !f.label.trim()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />} Enregistrer
        </button>
        <button type="button" className="cml-btn cml-btn-ghost" onClick={onClose}>Annuler</button>
        {!nouveau && (
          <button type="button" className="cml-btn cml-btn-ghost" onClick={supprimer} disabled={busy}
            style={{ marginLeft: 'auto', color: '#e0705f' }}>
            <Trash2 size={13} /> Retirer du registre
          </button>
        )}
      </div>
    </Tiroir>
  );
}

/** Une dépense appartient à un MOIS, pas à sa date de prélèvement. */
function FicheDepense({ service, onClose, onSaved, onError }) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(service.currency || 'EUR');
  const [invoice, setInvoice] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiV2.post('/cimolace-backoffice/infra/expenses', {
        service_key: service.key, period, amount_cents: Math.round(Number(amount) || 0),
        currency, invoice_url: invoice || null, source: 'manuel',
      });
      onSaved(`Dépense ${moisFr(period)} enregistrée pour ${service.label}.`);
    } catch (e) { onError(erreurLisible(e)); setBusy(false); }
  };

  return (
    <Tiroir titre={`Dépense — ${service.label}`} onClose={onClose}>
      <p style={{ margin: '0 0 14px', fontSize: FS.base, color: T.muted, lineHeight: 1.55 }}>
        Le montant réellement facturé pour ce mois. Ressaisir le même mois écrase la valeur au lieu de l&apos;ajouter — une facture ne compte qu&apos;une fois.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 13 }}>
        <Champ label="Mois concerné">
          <input className="cml-input" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </Champ>
        <Champ label="Montant" aide={ZERO_DECIMAL.has(currency) ? 'en francs entiers' : 'en centimes'}>
          <input className="cml-input" type="number" value={amount} style={NUM}
            onChange={(e) => setAmount(e.target.value)} onWheel={(e) => e.currentTarget.blur()} placeholder="2000" />
        </Champ>
        <Champ label="Devise">
          <select className="cml-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {DEVISES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Champ>
        <Champ label="Lien de la facture">
          <input className="cml-input" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="https://…" />
        </Champ>
      </div>
      <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
        <button type="button" className="cml-btn cml-btn-primary" onClick={save} disabled={busy || !Number(amount)}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />} Enregistrer
        </button>
        <button type="button" className="cml-btn cml-btn-ghost" onClick={onClose}>Annuler</button>
      </div>
    </Tiroir>
  );
}

function Champ({ label, aide, children, style }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: FS.sm, color: T.muted, marginBottom: 6 }}>
        {label}{aide && <span style={{ color: T.faint }}> — {aide}</span>}
      </label>
      {children}
    </div>
  );
}

/**
 * Panneau latéral plutôt que fenêtre modale : la liste reste visible derrière,
 * donc on garde le contexte de ce qu'on est en train de modifier.
 */
function Tiroir({ titre, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-label={titre} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <button type="button" aria-label="Fermer" onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(20,18,16,.62)', border: 'none', cursor: 'pointer' }} />
      <div style={{
        position: 'relative', width: 'min(560px, 100%)', height: '100%', overflowY: 'auto',
        background: T.panel, borderLeft: `1px solid ${T.line2}`, padding: '22px 24px 40px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: FS.lg, fontWeight: 700 }}>{titre}</h2>
          <button type="button" className="cml-btn cml-btn-ghost cml-btn-sm" onClick={onClose} aria-label="Fermer"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
