import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, RefreshCw, Send, AlertTriangle, Check, Loader2,
  ChevronDown, ChevronRight, Tag, Plus, Download,
} from 'lucide-react';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { apiV2 } from '@/lib/api-v2';
import { T, FS, R, NUM, useConsoleCss } from '../../theme';

/**
 * FINANCES — console SaaS Cimolace.
 *
 * ⭐ LA RÈGLE QUI GOUVERNE L'ÉCRAN : un solde affiché est toujours un montant
 * retirable en UNE SEULE opération. XAF et XOF ne sont pas fongibles — un retrait
 * au Sénégal ne peut pas puiser dans le wallet du Gabon. On ne somme donc jamais
 * des caisses qu'aucune opération ne peut réunir.
 *
 * L'écran répond à trois questions, dans cet ordre de fréquence : « je sors
 * combien, vers qui ? » (Retraits), « qui m'a payé ? » (Encaissé), « sur ce tas,
 * qu'est-ce qui est à moi et pas à AfriTrack ? » (Répartition). Le compteur reste
 * hors des onglets : il est la prémisse des trois, et le plafond du formulaire.
 */

const ZERO_DECIMAL = new Set(['XAF', 'XOF', 'XPF', 'JPY', 'KMF', 'GNF', 'RWF', 'BIF', 'MGA', 'VND', 'KRW', 'CLP', 'PYG', 'UGX', 'DJF', 'VUV']);
const money = (v, cur = 'XAF') =>
  `${(ZERO_DECIMAL.has((cur || '').toUpperCase()) ? Number(v || 0) : Number(v || 0) / 100)
    .toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${cur}`;
const unwrap = (r) => { let d = r?.data; while (d && typeof d === 'object' && 'data' in d) d = d.data; return d; };
const eur = (n) => `${(Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Table de correspondance UNIQUE des statuts pawaPay. Elle sert à la fois à
 * l'affichage et à la condition de sondage : deux listes séparées finissaient
 * toujours par diverger, et « accepted » se retrouvait peint en vert « réussi »
 * alors que l'argent n'était pas encore parti.
 */
const STATUTS = {
  completed: { label: 'Versé', c: T.ok, terminal: true },
  failed: { label: 'Échoué', c: T.danger, terminal: true },
  rejected: { label: 'Refusé', c: T.danger, terminal: true },
  accepted: { label: 'En cours de règlement', c: T.warn, terminal: false },
  pending: { label: 'En cours de règlement', c: T.warn, terminal: false },
  // Le serveur n'a pas su si le virement était parti (timeout, 5xx). Ce n'est
  // PAS un échec : le dire serait affirmer que l'argent est resté. Non terminal,
  // donc le réconciliateur ira demander la vérité à pawaPay.
  unverified: { label: 'Sort à vérifier', c: T.warn, terminal: false },
};
const statut = (s) => STATUTS[String(s || '').toLowerCase()] || { label: s || '—', c: T.warn, terminal: false };

/** UUID v4 — `crypto.randomUUID` n'existe pas hors contexte sécurisé/vieux navigateurs. */
const nouvelleCle = () => (
  globalThis.crypto?.randomUUID?.()
  ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  })
);

/**
 * Traduit une erreur axios en phrase utile.
 *
 * ⛔ « Network Error » est le message d'axios quand la requête n'a JAMAIS abouti :
 * l'API n'a pas répondu. Le recracher tel quel au milieu d'une phrase désignait
 * pawaPay comme coupable alors que pawaPay n'avait même pas été contacté — le
 * même travers que celui qu'on corrige partout ailleurs sur cet écran.
 */
const erreurLisible = (e) => {
  const api = e?.response?.data?.error?.message || e?.response?.data?.message;
  if (api) return api;
  if (e?.code === 'ECONNABORTED') return "L'API n'a pas répondu dans les temps.";
  if (e?.message === 'Network Error' || !e?.response) return "L'API est injoignable depuis ce navigateur.";
  if (e?.response?.status) return `L'API a répondu ${e.response.status}.`;
  return 'Lecture impossible.';
};

const depuis = (iso) => {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

/* ─────────────────────────── briques partagées ─────────────────────────── */

function Squelette({ h = 14, w = '100%' }) {
  return <div className="cml-skeleton" style={{ height: h, width: w }} />;
}

/** Un état vide doit enseigner l'écran, pas constater l'absence. */
function EtatVide({ titre, aide, action }) {
  return (
    <div style={{ padding: '26px 18px', textAlign: 'center', border: `1px dashed ${T.line2}`, borderRadius: R.card }}>
      <p style={{ margin: 0, fontSize: FS.md, fontWeight: 600, color: T.ink }}>{titre}</p>
      {aide && <p style={{ margin: '6px auto 0', fontSize: FS.base, color: T.muted, maxWidth: 460, lineHeight: 1.55 }}>{aide}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

/** Une panne doit être bruyante sur un écran d'argent, jamais un tiret discret. */
function Panne({ texte, onRetry }) {
  return (
    <div role="alert" style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '11px 14px', borderRadius: R.control,
      background: 'rgba(179,55,47,.14)', border: `1px solid rgba(179,55,47,.5)`,
    }}>
      <AlertTriangle size={15} style={{ color: '#e0705f', flexShrink: 0 }} />
      <span style={{ fontSize: FS.base, color: T.ink, flex: 1, minWidth: 180 }}>{texte}</span>
      {onRetry && <button type="button" className="cml-btn cml-btn-ghost cml-btn-sm" onClick={onRetry}>Réessayer</button>}
    </div>
  );
}

function Pastille({ s }) {
  const st = statut(s);
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: R.pill,
      fontSize: FS.xs, fontWeight: 700, color: T.ink, background: `${st.c}44`,
      border: `1px solid ${st.c}`, whiteSpace: 'nowrap',
    }}>{st.label}</span>
  );
}

function Section({ titre, aide, children, action }) {
  return (
    <section style={{ marginBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: aide ? 4 : 12 }}>
        <h2 style={{ margin: 0, fontSize: FS.lg, fontWeight: 700, color: T.ink }}>{titre}</h2>
        {action}
      </div>
      {aide && <p style={{ margin: '0 0 14px', fontSize: FS.base, color: T.muted, lineHeight: 1.55, maxWidth: 680 }}>{aide}</p>}
      {children}
    </section>
  );
}

/* ──────────────────────────────── écran ──────────────────────────────── */

export default function CimolaceAdminFinances() {
  useConsoleCss();

  const [onglet, setOnglet] = useState('retraits');
  const [fin, setFin] = useState(null);
  const [finErr, setFinErr] = useState(null);
  const [payouts, setPayouts] = useState(null);
  const [payoutsErr, setPayoutsErr] = useState(null);
  const [cost, setCost] = useState(null);
  const [opts, setOpts] = useState(null);
  const [compact, setCompact] = useState(false);

  const load = useCallback(() => {
    // 15 s : au-delà, ce n'est plus de la latence, c'est une panne. Sans plafond,
    // une requête suspendue laisse l'écran en « Chargement… » indéfiniment.
    const opt = { timeout: 15000 };
    apiV2.get('/cimolace-backoffice/finances', opt)
      .then((r) => { setFin(unwrap(r)); setFinErr(null); })
      .catch((e) => setFinErr(erreurLisible(e)));
    apiV2.get('/cimolace-backoffice/finances/payouts', opt)
      .then((r) => { const d = unwrap(r); setPayouts(Array.isArray(d) ? d : []); setPayoutsErr(null); })
      .catch((e) => { setPayouts([]); setPayoutsErr(erreurLisible(e)); });
    apiV2.get('/admin/ai-billing/cost-overview', opt).then((r) => setCost(unwrap(r))).catch(() => setCost(null));
    apiV2.get('/cimolace-backoffice/finances/payout-options', opt).then((r) => setOpts(unwrap(r))).catch(() => setOpts(null));
  }, []);

  /**
   * Relit le statut des retraits CHEZ PAWAPAY avant d'afficher le journal.
   * Sans ça, un retrait dont le callback s'est perdu resterait « en cours »
   * indéfiniment alors que l'argent est parti : l'écran mentirait.
   */
  const syncThenLoad = useCallback(
    () => apiV2.post('/cimolace-backoffice/finances/payouts/sync').catch(() => {}).then(load),
    [load],
  );

  useEffect(() => { syncThenLoad(); }, [syncThenLoad]);

  // Un retrait se règle en quelques secondes : on relance tant qu'une ligne
  // n'est pas terminale, puis on s'arrête. Pas de sondage perpétuel.
  useEffect(() => {
    if (!payouts?.some((p) => !statut(p.status).terminal)) return undefined;
    const t = setTimeout(syncThenLoad, 8000);
    return () => clearTimeout(t);
  }, [payouts, syncThenLoad]);

  // Le compteur se réduit au défilement : le plafond reste sous les yeux
  // pendant la saisie du montant. Garde-fou obtenu par la mise en page.
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Zone active = la caisse la plus garnie. C'est elle qui plafonne un retrait.
  const zone = useMemo(() => {
    const zs = fin?.zones || [];
    return zs.find((z) => z.total > 0) || zs[0] || null;
  }, [fin]);
  const soldeLisible = !!fin && !fin.walletBalancesError && !finErr;
  const dispo = soldeLisible ? Number(zone?.total || 0) : null;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <CimolaceHeader />
      <div style={{ display: 'flex' }}>
        <CimolaceSidebar />
        <main style={{ flex: 1, minWidth: 0, padding: '26px clamp(16px, 4vw, 34px) 64px', maxWidth: 1000, margin: '0 auto' }}>
          <h1 style={{ fontSize: FS.hero, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Finances</h1>
          <p style={{ color: T.muted, margin: '0 0 20px', fontSize: FS.md, lineHeight: 1.55 }}>
            L&apos;argent réel de la plateforme : ce qui est encaissé, ce qui reste, ce qui sort.
          </p>

          <Compteur
            dispo={dispo}
            zone={zone}
            fin={fin}
            // Deux pannes distinctes, deux remèdes distincts : soit NOTRE API n'a
            // pas répondu, soit elle a répondu et c'est pawaPay qui n'a pas su
            // lire le wallet. Les confondre accusait pawaPay d'une panne réseau
            // locale — et envoyait l'utilisateur chercher au mauvais endroit.
            erreurTransport={finErr}
            erreurSolde={fin?.walletBalancesError}
            chargement={!fin && !finErr}
            compact={compact}
            onReload={syncThenLoad}
            onVoirRepartition={() => setOnglet('repartition')}
          />

          <div role="tablist" aria-label="Sections des finances" style={{ display: 'flex', gap: 22, borderBottom: `1px solid ${T.line}`, margin: '22px 0 26px' }}>
            {[
              ['retraits', 'Retraits'],
              ['encaisse', 'Encaissé'],
              ['repartition', 'Répartition'],
            ].map(([k, label]) => (
              <button key={k} type="button" role="tab" id={`tab-${k}`} aria-controls={`panneau-${k}`}
                aria-selected={onglet === k} className="cml-tab" onClick={() => setOnglet(k)}>
                {label}
              </button>
            ))}
          </div>

          {onglet === 'retraits' && (
            <div role="tabpanel" id="panneau-retraits" aria-labelledby="tab-retraits">
              <OngletRetraits
                dispo={dispo} zone={zone} soldeLisible={soldeLisible}
                opts={opts} wallets={fin?.wallets || []}
                payouts={payouts} payoutsErr={payoutsErr}
                onDone={syncThenLoad} onRetry={load}
              />
            </div>
          )}
          {onglet === 'encaisse' && (
            <div role="tabpanel" id="panneau-encaisse" aria-labelledby="tab-encaisse">
              <OngletEncaisse fin={fin} erreur={finErr} cost={cost} onRetry={load} />
            </div>
          )}
          {onglet === 'repartition' && (
            <div role="tabpanel" id="panneau-repartition" aria-labelledby="tab-repartition">
              <OngletRepartition fin={fin} erreur={finErr} onChanged={load} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ─────────────────────────────── compteur ─────────────────────────────── */

/**
 * Le chiffre n'est pas vert : ce n'est pas un succès, c'est un fait. Sa force
 * vient de sa taille. Trois états ne sont JAMAIS fusionnés — lu, vide vérifié,
 * illisible — parce qu'un zéro fabriqué à partir d'une panne se lit comme une
 * faillite et fait prendre de mauvaises décisions.
 */
function Compteur({ dispo, zone, fin, erreurTransport, erreurSolde, chargement, compact, onReload, onVoirRepartition }) {
  const erreur = erreurTransport
    ? `Chiffres indisponibles — ${erreurTransport} Rien n'a pu être lu, ni les soldes ni le journal.`
    : erreurSolde
      ? `Solde illisible — l'API a répondu, mais pawaPay n'a pas rendu le solde : ${erreurSolde}`
      : null;
  const nonRattache = fin?.unallocatedXaf;
  const pct = nonRattache != null && fin?.physicalXaf ? Math.round((nonRattache / fin.physicalXaf) * 100) : null;
  const autresPays = (zone?.countries || []).filter((c) => Number(c.balance) <= 0).length;

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20, background: T.panel,
      borderRadius: R.card, border: `1px solid ${T.line}`,
      padding: compact ? '10px 18px' : '18px 22px 16px',
      transition: 'padding .18s ease',
    }}>
      {erreur ? (
        <Panne texte={`${erreur} Aucun retrait possible tant que le solde n'est pas vérifié.`} onRetry={onReload} />
      ) : chargement ? (
        <div style={{ display: 'grid', gap: 8 }}><Squelette h={14} w={150} /><Squelette h={38} w={230} /></div>
      ) : compact ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: FS.sm, color: T.muted }}>Disponible</span>
          <b style={{ fontSize: FS.xl, fontWeight: 700, ...NUM }}>{money(dispo, zone?.currency || 'XAF')}</b>
          <span style={{ fontSize: FS.xs, color: T.faint }}>lu {depuis(fin?.readAt)}</span>
        </div>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: FS.sm, color: T.muted, letterSpacing: '.02em' }}>Disponible pour retrait</p>
          <p style={{ margin: '2px 0 0', fontSize: FS.mega, fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', ...NUM }}>
            {money(dispo, zone?.currency || 'XAF')}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: FS.base, color: T.muted }}>
            Zone {zone?.currency || '—'}
            {zone?.countries?.length ? ` · ${zone.countries.filter((c) => Number(c.balance) > 0).map((c) => c.country).join(', ')}` : ''}
            {autresPays > 0 ? ` · ${autresPays} pays à zéro` : ''}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: FS.base, color: T.muted, lineHeight: 1.55 }}>
            Compte pawaPay <b style={{ color: T.ink }}>partagé avec AfriTrack</b> — ce total contient l&apos;argent des deux activités.
            {nonRattache != null && (
              <>
                {' '}<button type="button" onClick={onVoirRepartition} className="cml-focus"
                  style={{ background: 'none', border: 'none', padding: 0, color: T.coral, fontSize: FS.base, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                  {money(nonRattache, 'XAF')}{pct != null ? ` (${pct} %)` : ''} non rattachés
                </button>
              </>
            )}
          </p>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: FS.xs, color: T.faint }}>Lu {depuis(fin?.readAt)}</span>
            <button type="button" className="cml-btn cml-btn-ghost cml-btn-sm" onClick={onReload}>
              <RefreshCw size={13} /> Actualiser
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────────────────────── onglet Retraits ───────────────────────────── */

function OngletRetraits({ dispo, zone, soldeLisible, opts, wallets, payouts, payoutsErr, onDone, onRetry }) {
  const [ouvert, setOuvert] = useState(false);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [mno, setMno] = useState('');
  const [reason, setReason] = useState('');
  const [walletKey, setWalletKey] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const confirmRef = useRef(null);
  /**
   * CLÉ D'IDEMPOTENCE, forgée à l'OUVERTURE de la confirmation et gardée jusqu'à
   * la réussite. La garde `sending` ne suffit pas : c'est une fermeture figée,
   * deux clics rapides la franchissent tous les deux. Avec cette clé, un double
   * envoi renvoie le MÊME retrait au lieu d'en faire un second.
   */
  const cleRef = useRef(null);

  const operateurs = opts?.operators || [];
  // Tant que la liste réelle n'est pas lue, on ne propose rien plutôt que de
  // proposer quatre opérateurs codés en dur dont trois ne versent pas.
  const op = operateurs.find((o) => o.provider === mno) || null;
  useEffect(() => {
    if (!mno && operateurs.length) {
      setMno((operateurs.find((o) => o.currency === zone?.currency) || operateurs[0]).provider);
    }
  }, [operateurs, mno, zone]);

  const montant = Math.round(parseFloat(amount) || 0);
  const trop = dispo != null && montant > dispo;
  const horsBornes = op && montant > 0 && (montant < op.min || (op.max && montant > op.max));
  const manque = !montant ? 'un montant' : !phone.trim() ? 'un numéro' : !mno ? 'un opérateur' : null;
  const bloque = !soldeLisible ? 'Solde non vérifié — impossible de retirer.' : manque ? `Renseignez ${manque}.` : trop ? 'Montant supérieur au disponible.' : horsBornes ? `Hors bornes de l'opérateur (${op.min} – ${op.max} ${op.currency}).` : null;

  useEffect(() => { if (confirm) confirmRef.current?.focus(); }, [confirm]);

  const submit = async () => {
    if (sending) return;
    setSending(true); setMsg(null);
    try {
      const r = await apiV2.post('/cimolace-backoffice/finances/payout', {
        amountCents: montant, currency: op?.currency || 'XAF',
        phoneNumber: phone.trim(), mno, wallet: walletKey || undefined, reason: reason.trim() || undefined,
        payoutId: cleRef.current,
      });
      const d = unwrap(r);
      setMsg({
        ok: true,
        text: d?.idempotent
          ? `Ce retrait avait déjà été envoyé — aucun second virement (${statut(d?.status).label}).`
          : `Retrait enregistré (${statut(d?.status).label}) — ${money(montant, op?.currency || 'XAF')}.`,
      });
      cleRef.current = null;
      setAmount(''); setPhone(''); setReason(''); setConfirm(false); setOuvert(false); onDone();
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || 'Retrait impossible.' });
      setConfirm(false);
    } finally { setSending(false); }
  };

  return (
    <>
      <Section
        titre="Sortir de l'argent"
        aide={soldeLisible
          ? `Retrait possible — ${money(dispo, zone?.currency || 'XAF')} disponibles${zone?.countries?.length ? ` (${zone.countries.filter((c) => Number(c.balance) > 0).map((c) => c.country).join(', ')})` : ''}. Le versement part vers un compte mobile money et n'est pas annulable.`
          : 'Retrait impossible tant que le solde pawaPay n\'a pas été lu — le plafond serait inconnu.'}
      >
        {!ouvert ? (
          <div>
            <button type="button" className="cml-btn cml-btn-primary" disabled={!soldeLisible}
              onClick={() => { setMsg(null); setOuvert(true); }}>
              <Send size={15} /> Nouveau retrait
            </button>
            {!soldeLisible && <p style={{ margin: '8px 0 0', fontSize: FS.sm, color: T.warn }}>Solde non vérifié — actualisez le compteur d&apos;abord.</p>}
            {msg && (
              <p role="status" aria-live="polite" style={{ marginTop: 12, fontSize: FS.base, color: msg.ok ? T.ok : '#e0705f', display: 'flex', gap: 7, alignItems: 'center' }}>
                {msg.ok ? <Check size={15} /> : <AlertTriangle size={15} />} {msg.text}
              </p>
            )}
          </div>
        ) : (
          <div style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: R.card, padding: 18 }}>
            {/* Ordre de saisie = ordre de la décision réelle. L'imputation
                comptable est repliée en pied : ce n'est pas une caisse d'où
                l'argent sortirait, seulement une étiquette. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
              <div>
                <label htmlFor="mnt" style={{ fontSize: FS.sm, color: T.muted, display: 'block', marginBottom: 6 }}>Montant</label>
                <input id="mnt" className="cml-input" type="number" inputMode="numeric" min={op?.min || 1} max={dispo ?? undefined}
                  value={amount} onChange={(e) => setAmount(e.target.value)} onWheel={(e) => e.currentTarget.blur()} placeholder="2000" style={NUM} />
                <p style={{ margin: '6px 0 0', fontSize: FS.xs, color: trop || horsBornes ? T.warn : T.faint, ...NUM }}>
                  disponible {money(dispo, zone?.currency || 'XAF')}
                  {op ? ` · min ${op.min} · max ${op.max}` : ''}
                </p>
              </div>
              <div>
                <label htmlFor="tel" style={{ fontSize: FS.sm, color: T.muted, display: 'block', marginBottom: 6 }}>Numéro mobile money</label>
                <input id="tel" className="cml-input" type="tel" inputMode="numeric" value={phone}
                  onChange={(e) => setPhone(e.target.value)} placeholder="24177000000" style={NUM} />
              </div>
              <div>
                <label htmlFor="op" style={{ fontSize: FS.sm, color: T.muted, display: 'block', marginBottom: 6 }}>Opérateur</label>
                <select id="op" className="cml-input" value={mno} onChange={(e) => setMno(e.target.value)}>
                  {!operateurs.length && <option value="">Lecture des opérateurs…</option>}
                  {operateurs.map((o) => <option key={`${o.provider}-${o.currency}`} value={o.provider}>{o.label} ({o.currency})</option>)}
                </select>
                <p style={{ margin: '6px 0 0', fontSize: FS.xs, color: T.faint }}>
                  {operateurs.length ? `${operateurs.length} ouverts au versement` : 'lus chez pawaPay'}
                </p>
              </div>
              <div>
                <label htmlFor="motif" style={{ fontSize: FS.sm, color: T.muted, display: 'block', marginBottom: 6 }}>Motif</label>
                <input id="motif" className="cml-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reversement" />
              </div>
            </div>

            <details style={{ marginTop: 14 }}>
              <summary className="cml-focus" style={{ cursor: 'pointer', fontSize: FS.base, color: T.muted, listStyle: 'none' }}>
                <ChevronRight size={13} style={{ verticalAlign: -2 }} /> Imputation comptable (facultatif)
              </summary>
              <div style={{ marginTop: 10 }}>
                <select className="cml-input" value={walletKey} onChange={(e) => setWalletKey(e.target.value)} style={{ maxWidth: 320 }}>
                  <option value="">— non rattaché</option>
                  {wallets.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
                </select>
                <p style={{ margin: '6px 0 0', fontSize: FS.xs, color: T.faint, maxWidth: 460, lineHeight: 1.5 }}>
                  Étiquette pour vos comptes. Elle ne limite pas le retrait et l&apos;argent sort du même wallet quoi qu&apos;il arrive.
                </p>
              </div>
            </details>

            {msg && (
              <p role="status" aria-live="polite" style={{ marginTop: 14, fontSize: FS.base, color: msg.ok ? T.ok : '#e0705f', display: 'flex', gap: 7, alignItems: 'center' }}>
                {msg.ok ? <Check size={15} /> : <AlertTriangle size={15} />} {msg.text}
              </p>
            )}

            {confirm ? (
              <div role="alertdialog" aria-label="Confirmer le retrait" onKeyDown={(e) => { if (e.key === 'Escape') setConfirm(false); }}
                style={{ marginTop: 16, padding: 14, borderRadius: R.control, border: `1px solid ${T.danger}`, background: 'rgba(179,55,47,.12)' }}>
                <p style={{ fontSize: FS.md, margin: 0, lineHeight: 1.55 }}>
                  Envoyer <b style={NUM}>{money(montant, op?.currency || 'XAF')}</b> vers <b style={NUM}>{phone}</b>
                  {op ? <> — {op.label}</> : null} ? <b>Mouvement d&apos;argent réel, non annulable.</b>
                </p>
                <div style={{ marginTop: 12, display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  <button ref={confirmRef} type="button" className="cml-btn cml-btn-danger" onClick={submit} disabled={sending}>
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {sending ? 'Envoi…' : 'Confirmer le retrait'}
                  </button>
                  <button type="button" className="cml-btn cml-btn-ghost" onClick={() => setConfirm(false)}>Annuler</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 16, display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="cml-btn cml-btn-primary" disabled={!!bloque}
                  onClick={() => {
                    setMsg(null);
                    // La clé naît ICI, avec l'intention. Elle survit à un échec
                    // réseau et à un second clic : c'est ce qui rend l'envoi rejouable
                    // sans risque de virement en double.
                    cleRef.current = cleRef.current || nouvelleCle();
                    setConfirm(true);
                  }}>
                  <Send size={15} /> Vérifier et envoyer
                </button>
                <button type="button" className="cml-btn cml-btn-ghost" onClick={() => { setOuvert(false); setMsg(null); }}>Annuler</button>
                {bloque && <span style={{ fontSize: FS.sm, color: T.warn }}>{bloque}</span>}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section titre="Journal des retraits"
        action={payouts?.length ? (
          <button type="button" className="cml-btn cml-btn-ghost cml-btn-sm" onClick={() => exportCsv(payouts)}>
            <Download size={13} /> Exporter (CSV)
          </button>
        ) : null}>
        {payoutsErr ? <Panne texte={payoutsErr} onRetry={onRetry} />
          : payouts === null ? <div style={{ display: 'grid', gap: 8 }}>{[0, 1, 2].map((i) => <Squelette key={i} h={52} />)}</div>
          : payouts.length === 0 ? (
            <EtatVide titre="Aucun retrait effectué depuis ce compte"
              aide="Dès qu'un versement partira, il apparaîtra ici avec son statut, réconcilié automatiquement chez pawaPay." />
          ) : (
            <div style={{ border: `1px solid ${T.line}`, borderRadius: R.card, overflow: 'hidden' }}>
              {payouts.map((p, i) => <LignePayout key={p.id || i} p={p} premier={i === 0} />)}
            </div>
          )}
      </Section>
    </>
  );
}

/** La raison de l'échec existe en base et n'était jamais rendue : 4 retraits sur 5 affichaient « failed » et rien d'autre. */
function LignePayout({ p, premier }) {
  const [ouvert, setOuvert] = useState(false);
  const st = statut(p.status);
  const echec = ['failed', 'rejected'].includes(String(p.status || '').toLowerCase());
  return (
    <div className="cml-row" style={{ borderTop: premier ? 'none' : `1px solid ${T.line}`, padding: '12px 15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: FS.md, fontWeight: 600, ...NUM }}>
            {p.recipient_name || p.phone_number}
            <span style={{ color: T.faint, fontWeight: 400, fontSize: FS.sm }}> · {p.mno}</span>
          </p>
          <p style={{ margin: '3px 0 0', fontSize: FS.sm, color: T.muted }}>
            {p.reason || 'sans motif'} · {new Date(p.created_at).toLocaleString('fr-FR')}
            {p.wallet ? <> · <Tag size={11} style={{ verticalAlign: -1 }} /> {p.wallet}</> : null}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: FS.md, fontWeight: 700, ...NUM }}>{money(p.amount_cents, p.currency)}</p>
          <div style={{ marginTop: 4 }}><Pastille s={p.status} /></div>
        </div>
      </div>
      {echec && p.failure_message && (
        <div style={{ marginTop: 9 }}>
          <button type="button" onClick={() => setOuvert((v) => !v)} className="cml-focus"
            style={{ background: 'none', border: 'none', padding: 0, color: T.warn, fontSize: FS.sm, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', gap: 5, alignItems: 'center' }}>
            {ouvert ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Pourquoi cet échec ?
          </button>
          {ouvert && (
            <p style={{ margin: '7px 0 0', fontSize: FS.sm, color: T.muted, lineHeight: 1.5, background: T.bg, padding: '9px 11px', borderRadius: 6, wordBreak: 'break-word' }}>
              {p.failure_message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function exportCsv(rows) {
  const head = ['date', 'destinataire', 'operateur', 'montant', 'devise', 'statut', 'motif', 'imputation', 'echec'];
  const body = rows.map((p) => [
    p.created_at, p.recipient_name || p.phone_number, p.mno, p.amount_cents, p.currency,
    statut(p.status).label, p.reason || '', p.wallet || '', (p.failure_message || '').replace(/[\n;]/g, ' '),
  ].join(';'));
  const blob = new Blob([[head.join(';'), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'retraits-cimolace.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ───────────────────────────── onglet Encaissé ───────────────────────────── */

function OngletEncaisse({ fin, erreur, cost, onRetry }) {
  if (erreur) return <Panne texte={erreur} onRetry={onRetry} />;
  if (!fin) return <div style={{ display: 'grid', gap: 10 }}>{[0, 1].map((i) => <Squelette key={i} h={70} />)}</div>;

  const rev = fin.revenue || {};
  const wit = fin.withdrawn || {};
  const anomalies = (cost?.totals?.overage_accruing_eur || 0) > 0 || (cost?.totals?.ai_at_risk || 0) > 0;

  return (
    <>
      <Section titre="Ce que les tenants ont payé"
        aide="Cumul depuis l'origine. Tout n'atterrit pas au même endroit : seuls les encaissements mobile money alimentent le wallet pawaPay dans lequel vous puisez.">
        <div style={{ border: `1px solid ${T.line}`, borderRadius: R.card, overflow: 'hidden' }}>
          {(rev.byCurrency || []).map((c, i) => {
            const cfa = ['XAF', 'XOF'].includes(c.currency);
            return (
              <div key={c.currency} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'baseline', flexWrap: 'wrap', padding: '13px 15px', borderTop: i ? `1px solid ${T.line}` : 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: FS.md, fontWeight: 600 }}>
                    {cfa ? 'Mobile money — retirable ici' : 'Carte bancaire — non retirable ici'}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: FS.sm, color: T.muted }}>
                    {c.count} facture{c.count > 1 ? 's' : ''} en {c.currency}
                    {!cfa && ' — cet argent n\'arrive jamais dans le wallet pawaPay'}
                  </p>
                </div>
                <p style={{ margin: 0, fontSize: FS.lg, fontWeight: 700, ...NUM }}>
                  {money(c.amountMinor, c.currency)}
                  {!cfa && c.xaf ? <span style={{ color: T.faint, fontSize: FS.sm, fontWeight: 400 }}> ≈ {money(c.xaf, 'XAF')}</span> : null}
                </p>
              </div>
            );
          })}
          {!(rev.byCurrency || []).length && <EtatVide titre="Aucun encaissement" aide="Les factures payées par les tenants apparaîtront ici, ventilées par moyen de paiement." />}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: FS.sm, color: T.muted, lineHeight: 1.55 }}>
          Total ramené en francs : <b style={{ color: T.ink, ...NUM }}>{money(rev.xaf, 'XAF')}</b> — conversion à la parité CFA fixe (1 € = 655,957), qui n&apos;est pas un taux de marché.
          {(rev.unconvertible || []).map((u) => (
            <span key={u.currency} style={{ color: T.warn }}> · {money(u.amountMinor, u.currency)} non convertis (pas de parité fixe).</span>
          ))}
        </p>
      </Section>

      <Section titre="Ce qui est déjà sorti">
        <p style={{ margin: 0, fontSize: FS.xl, fontWeight: 700, ...NUM }}>{money(wit.xaf, 'XAF')}</p>
        <p style={{ margin: '4px 0 0', fontSize: FS.sm, color: T.muted }}>
          Cumul des retraits non échoués depuis l&apos;origine.
        </p>
      </Section>

      <Section titre="Consommation des tenants">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '13px 15px', border: `1px solid ${anomalies ? T.warn : T.line}`, borderRadius: R.card }}>
          {anomalies ? <AlertTriangle size={16} style={{ color: T.warn }} /> : <Check size={16} style={{ color: T.ok }} />}
          <span style={{ fontSize: FS.md, flex: 1, minWidth: 200 }}>
            {cost
              ? anomalies
                ? `${cost.totals?.ai_at_risk || 0} tenant(s) à risque · ${eur(cost.totals?.overage_accruing_eur)} de dépassement en cours`
                : `${cost.totals?.tenants ?? 0} tenants suivis · aucun dépassement`
              : 'Consommation illisible'}
          </span>
          <Link to="/cimolace/admin/billing" className="cml-btn cml-btn-ghost cml-btn-sm" style={{ textDecoration: 'none' }}>
            Détail et facturation <ArrowUpRight size={13} />
          </Link>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: FS.sm, color: T.faint, lineHeight: 1.5, maxWidth: 640 }}>
          Le détail par tenant vit dans Facturation : c&apos;est là que les dépassements se facturent, et Finances ne sait pas émettre de facture.
        </p>
      </Section>
    </>
  );
}

/* ──────────────────────────── onglet Répartition ──────────────────────────── */

function OngletRepartition({ fin, erreur, onChanged }) {
  const [allocFor, setAllocFor] = useState(null);
  const [allocAmt, setAllocAmt] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [wMsg, setWMsg] = useState(null);

  if (erreur) return <Panne texte={erreur} onRetry={onChanged} />;
  if (!fin) return <div style={{ display: 'grid', gap: 10 }}>{[0, 1].map((i) => <Squelette key={i} h={64} />)}</div>;

  const total = fin.physicalXaf;
  const lignes = [
    { key: '__none__', label: 'Non rattaché', montant: fin.unallocatedXaf ?? 0, alerte: true },
    ...(fin.wallets || []).map((w) => ({ key: w.key, label: w.label, montant: w.balanceCents || 0 })),
  ];

  const allocate = async () => {
    const c = Math.round(parseFloat(allocAmt) || 0);
    if (!allocFor || !c || busy) return;
    setBusy(true); setWMsg(null);
    try {
      await apiV2.post(`/cimolace-backoffice/finances/wallets/${allocFor}/allocate`, { amountCents: c, note: 'Attribution manuelle' });
      setWMsg({ ok: true, text: `${c > 0 ? '+' : ''}${c.toLocaleString('fr-FR')} XAF attribués.` });
      setAllocFor(null); setAllocAmt(''); onChanged();
    } catch (e) { setWMsg({ ok: false, text: e?.response?.data?.error?.message || e?.message || 'Attribution impossible.' }); }
    finally { setBusy(false); }
  };
  const createWallet = async () => {
    if (busy || !newKey.trim() || !newLabel.trim()) return;
    setBusy(true); setWMsg(null);
    try { await apiV2.post('/cimolace-backoffice/finances/wallets', { key: newKey.trim(), label: newLabel.trim() }); setNewKey(''); setNewLabel(''); onChanged(); }
    catch (e) { setWMsg({ ok: false, text: e?.response?.data?.error?.message || e?.message || 'Création impossible.' }); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Section
        titre="Sur ce tas, qu'est-ce qui est à quoi ?"
        aide="Étiquettes comptables, pas des caisses : l'argent est un seul tas dans le solde affiché en haut. Elles ne se remplissent que par « Attribuer » — aucun encaissement ne s'y range tout seul."
      >
        <p style={{ margin: '0 0 12px', fontSize: FS.sm, color: T.muted, ...NUM }}>
          Total à découper : <b style={{ color: T.ink }}>{total != null ? money(total, 'XAF') : '—'}</b>
        </p>
        <div style={{ border: `1px solid ${T.line}`, borderRadius: R.card, overflow: 'hidden' }}>
          {lignes.map((l, i) => {
            const pct = total ? Math.round((l.montant / total) * 100) : 0;
            const alerte = l.alerte && pct > 50;
            return (
              <div key={l.key} className="cml-row" style={{ padding: '13px 15px', borderTop: i ? `1px solid ${T.line}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: FS.md, fontWeight: 600, color: alerte ? T.warn : T.ink, flex: 1, minWidth: 120 }}>{l.label}</span>
                  <span style={{ fontSize: FS.md, fontWeight: 700, ...NUM, color: alerte ? T.warn : T.ink }}>
                    {money(l.montant, 'XAF')} <span style={{ color: T.faint, fontWeight: 400, fontSize: FS.sm }}>{pct} %</span>
                  </span>
                  {l.key !== '__none__' && (
                    <button type="button" className="cml-btn cml-btn-ghost cml-btn-sm"
                      onClick={() => { setAllocFor(l.key); setAllocAmt(''); setWMsg(null); }}>Attribuer</button>
                  )}
                </div>
                <div aria-hidden style={{ marginTop: 8, height: 3, borderRadius: 2, background: T.line }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', borderRadius: 2, background: alerte ? T.warn : T.coral }} />
                </div>
                {allocFor === l.key && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label htmlFor={`alloc-${l.key}`} style={{ fontSize: FS.sm, color: T.muted }}>Montant (négatif pour retirer)</label>
                    <input id={`alloc-${l.key}`} className="cml-input" type="number" autoFocus value={allocAmt}
                      onChange={(e) => setAllocAmt(e.target.value)} style={{ ...NUM, width: 190 }} />
                    <button type="button" className="cml-btn cml-btn-primary cml-btn-sm" onClick={allocate} disabled={busy || !parseFloat(allocAmt)}>Valider</button>
                    <button type="button" className="cml-btn cml-btn-ghost cml-btn-sm" onClick={() => setAllocFor(null)}>Annuler</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {wMsg && (
          <p role="status" aria-live="polite" style={{ marginTop: 10, fontSize: FS.base, color: wMsg.ok ? T.ok : '#e0705f' }}>{wMsg.text}</p>
        )}
        <p style={{ margin: '12px 0 0', fontSize: FS.sm, color: T.warn, lineHeight: 1.55, maxWidth: 660 }}>
          Cette répartition est <b>déclarative</b> : elle vous sert à distinguer votre argent de celui d&apos;AfriTrack sur un compte partagé, mais elle n&apos;empêche aucun retrait. Un versement puise dans le tas commun, quelle que soit l&apos;étiquette choisie.
        </p>
      </Section>

      <Section titre="Ajouter une étiquette">
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="wk" style={{ fontSize: FS.sm, color: T.muted, display: 'block', marginBottom: 6 }}>Clé</label>
            <input id="wk" className="cml-input" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="ecole" style={{ width: 150 }} />
          </div>
          <div>
            <label htmlFor="wl" style={{ fontSize: FS.sm, color: T.muted, display: 'block', marginBottom: 6 }}>Nom affiché</label>
            <input id="wl" className="cml-input" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="École" style={{ width: 190 }} />
          </div>
          <button type="button" className="cml-btn cml-btn-ghost" onClick={createWallet} disabled={busy || !newKey.trim() || !newLabel.trim()}>
            <Plus size={14} /> Créer
          </button>
        </div>
      </Section>
    </>
  );
}
