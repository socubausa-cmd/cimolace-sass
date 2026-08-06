import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, CreditCard, Smartphone, Loader2, Check, Download, Star, ShieldCheck,
  Quote, ChevronDown, ArrowRight, Mail, Lock, AlertTriangle, Sparkles,
} from 'lucide-react';
import { boutiqueApi } from '@/lib/api-v2';

const PRODUCT = 'femme-nouvelle';
const PROGRAM = 'devenir-femme-nouvelle';

/** Le verdict de l'affiche : ce qu'on lui a collé, puis ce qu'elle reprend. */
const ACCUSATIONS = [
  'COUPABLE', 'IMPURE', 'SORCIÈRE', 'FAIBLE', 'TENTATRICE', 'INFÉRIEURE', 'HONTE',
  'SILENCE', 'CONTRÔLÉE', 'SOUMISE', 'DOMINÉE', 'DÉVALORISÉE', 'EXCLUE',
  'INTERDITE', 'ILLÉGITIME', 'JUGÉE', 'RABAISSÉE', 'EFFACÉE', 'INVISIBLE',
];
const LIBERATIONS = ['LIBRE', 'LÉGITIME', 'PUISSANTE', 'SACRÉE', 'PLEINE', 'ÉVEILLÉE'];

/** Les six parties de l'ouvrage — la table des matières, resserrée. */
const PARTS = [
  { n: 'I', title: 'L’acte d’accusation démasqué', body: 'Le tribunal invisible, ses chefs d’accusation, et pourquoi ce n’est pas une morale mais une machine.' },
  { n: 'II', title: 'Nettoyer la mémoire', body: 'La voix qui te diminue n’est pas la tienne. Désarmer la honte. Et si j’ai vraiment fait du mal ?' },
  { n: 'III', title: 'L’arsenal — les preuves de la défense', body: 'Sept armes démontrées, du corps neuf à la flèche du temps, sources à l’appui.' },
  { n: 'IV', title: 'Le contre-procès', body: 'La mauvaise foi, la responsabilité cachée, la peur déguisée. L’Écriture, le Coran, les reines et les ancêtres appelés à la barre.' },
  { n: 'V', title: 'Le verdict inversé', body: 'L’acquittement chef par chef, et la condamnation de la doctrine.' },
  { n: 'VI', title: 'Tes armes au quotidien', body: 'Quand il dit… tu réponds. Repérer la manipulation. Rompre la chaîne, de ta mère à ta fille.' },
];

const CFA_COUNTRIES = [
  { code: 'GAB', name: 'Gabon' }, { code: 'CMR', name: 'Cameroun' },
  { code: 'CIV', name: "Côte d'Ivoire" }, { code: 'SEN', name: 'Sénégal' },
  { code: 'COG', name: 'Congo' }, { code: 'BEN', name: 'Bénin' },
  { code: 'BFA', name: 'Burkina Faso' }, { code: 'TGO', name: 'Togo' },
  { code: 'MLI', name: 'Mali' }, { code: 'NER', name: 'Niger' },
  { code: 'TCD', name: 'Tchad' }, { code: 'GNQ', name: 'Guinée équatoriale' },
];

const eur = (cents) =>
  `${(Number(cents || 0) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
const cfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

/** Le vrai message d'erreur de l'API (NestJS renvoie parfois un tableau). */
function pickApiError(e) {
  const d = e?.response?.data;
  const m = d?.error?.message ?? d?.message;
  return Array.isArray(m) ? m.join(' ') : (typeof m === 'string' ? m : null);
}

/** Opérateurs Mobile Money, extraits de la config pawaPay active. */
function extractProviders(config, country) {
  if (!config) return [];
  const countries = Array.isArray(config.countries) ? config.countries : [];
  const match = countries.find((c) => (c.country || c.countryCode) === country) || countries[0];
  const provs = match?.providers || config.providers || [];
  return provs
    .map((p) => ({ code: p.provider || p.correspondent || p.code, name: p.displayName || p.name || p.provider || 'Opérateur' }))
    .filter((p) => p.code);
}

/* ────────────────────────── Styles de la page ──────────────────────────
 * Charte LIRI : fond #262624, conteneurs TRANSPARENTS + filet fin (jamais de
 * bloc opaque plus sombre), accents coral pour les actions, ambre pour l'éditorial.
 * `#root .fn-serif` : `index.css` force Inter sur h1..h6 en `!important` — il faut
 * une spécificité supérieure pour qu'un serif survive sur un titre.
 */
const CSS = `
/* --fn-dim sert aussi aux notes et aux placeholders : #7d786f ne donnait que 3,45:1
   sur le fond, sous le seuil AA de 4,5:1. #9b958a monte à 5,1:1. */
.fn-root{--fn-base:#262624;--fn-rail:#1f1e1c;--fn-ink:#f5f1e9;--fn-muted:#a8a49c;
  --fn-dim:#9b958a;--fn-coral:#d97757;--fn-coral-soft:#e0926a;--fn-amber:#e6b878;
  --fn-line:rgba(245,241,233,.10);--fn-line-soft:rgba(245,241,233,.06);
  background:var(--fn-base);color:var(--fn-ink);min-height:100vh;
  font-family:Inter,system-ui,sans-serif;overflow-x:hidden;}
#root .fn-root .fn-serif,.fn-root .fn-serif{font-family:Fraunces,Georgia,'Times New Roman',serif !important;}
.fn-wrap{max-width:1120px;margin:0 auto;padding:0 20px;}
.fn-narrow{max-width:760px;margin:0 auto;padding:0 20px;}
.fn-section{padding:72px 0;border-top:1px solid var(--fn-line-soft);}
.fn-kicker{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--fn-amber);font-weight:600;}
.fn-h2{font-size:clamp(26px,4vw,40px);line-height:1.12;letter-spacing:-.02em;margin:10px 0 0;text-wrap:balance;}
.fn-lead{color:var(--fn-muted);font-size:16.5px;line-height:1.7;max-width:66ch;}
.fn-card{border:1px solid var(--fn-line);border-radius:14px;padding:22px;background:transparent;}
.fn-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:14px 26px;border-radius:11px;
  font-weight:700;font-size:15px;border:1px solid transparent;cursor:pointer;
  transition:background-color .18s ease,border-color .18s ease,color .18s ease;}
.fn-btn:disabled{opacity:.55;cursor:not-allowed;}
.fn-btn-primary{background:var(--fn-coral);color:#241610;}
.fn-btn-primary:hover:not(:disabled){background:var(--fn-coral-soft);}
.fn-btn-ghost{background:transparent;color:var(--fn-ink);border-color:var(--fn-line);}
.fn-btn-ghost:hover:not(:disabled){border-color:var(--fn-coral);color:var(--fn-coral-soft);}
.fn-root :is(input,textarea,select){width:100%;background:rgba(245,241,233,.04);border:1px solid var(--fn-line);
  border-radius:10px;padding:12px 14px;color:var(--fn-ink);font-size:15px;font-family:inherit;}
.fn-root :is(input,textarea,select):focus-visible{outline:2px solid var(--fn-coral);outline-offset:1px;border-color:transparent;}
.fn-root ::placeholder{color:var(--fn-dim);}
.fn-root :is(a,button,input,textarea,select,summary):focus-visible{outline:2px solid var(--fn-coral);outline-offset:2px;}
.fn-label{display:block;font-size:12.5px;color:var(--fn-muted);margin:0 0 6px;font-weight:500;}
.fn-seg{display:inline-flex;gap:4px;padding:4px;border:1px solid var(--fn-line);border-radius:12px;}
/* 12px de padding vertical → cible tactile ≥44px (à 9px on tombait à 39px). */
.fn-seg button{padding:12px 16px;border-radius:9px;background:transparent;border:0;color:var(--fn-muted);
  font-weight:600;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;min-height:44px;}
.fn-seg button[data-on="1"]{background:rgba(217,119,87,.16);color:var(--fn-coral-soft);}
/* Couverture — la colonne du verdict, reprise de l'affiche. */
.fn-cover{position:relative;border:1px solid var(--fn-line);border-radius:16px;overflow:hidden;
  background:linear-gradient(168deg,#2f2b26 0%,#1b1917 58%,#141312 100%);padding:30px 22px 26px;text-align:center;}
.fn-cover-img{display:block;width:100%;height:auto;border-radius:16px;border:1px solid var(--fn-line);}
.fn-verdict{display:flex;flex-direction:column;align-items:center;gap:1px;margin-bottom:20px;}
.fn-verdict span{font-family:Fraunces,Georgia,serif;font-size:11.5px;letter-spacing:.16em;line-height:1.55;
  color:#a2998c;text-shadow:0 1px 0 rgba(0,0,0,.5);}
.fn-verdict .fn-free{color:var(--fn-amber);text-shadow:0 0 14px rgba(230,184,120,.35);font-weight:600;}
.fn-verdict hr{width:46px;border:0;border-top:1px solid rgba(230,184,120,.45);margin:9px 0;}
.fn-cover-title{font-family:Fraunces,Georgia,serif;font-size:clamp(22px,4.4vw,30px);line-height:1.06;
  letter-spacing:-.015em;color:#f2e3c9;margin:0;}
.fn-cover-sub{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#a2957f;margin:11px 0 0;}
.fn-stars{display:inline-flex;gap:2px;}
.fn-quote{border-left:0;border-top:1px solid var(--fn-line-soft);padding:20px 0 0;}
.fn-axes summary{cursor:pointer;list-style:none;display:flex;align-items:flex-start;gap:14px;padding:18px 0;}
.fn-axes summary::-webkit-details-marker{display:none;}
.fn-axes details{border-bottom:1px solid var(--fn-line-soft);}
.fn-axes details[open] summary .fn-chev{transform:rotate(180deg);}
.fn-chev{transition:transform .2s ease;flex-shrink:0;margin-left:auto;color:var(--fn-dim);}
.fn-topics{margin:0 0 20px;padding:0 0 0 38px;display:grid;gap:9px;}
.fn-topics li{color:var(--fn-muted);font-size:14.5px;line-height:1.55;position:relative;list-style:none;}
.fn-topics li::before{content:'';position:absolute;left:-16px;top:9px;width:5px;height:5px;border-radius:50%;background:var(--fn-coral);opacity:.65;}
.fn-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));}
/* Les quatre formules doivent tenir sur UNE rangée à pleine largeur (1080 px utiles) :
   à 260 px le quatrième passait seul à la ligne. */
.fn-formulas{grid-template-columns:repeat(auto-fit,minmax(238px,1fr));}
.fn-formula{border:1px solid var(--fn-line);border-radius:14px;padding:22px;display:flex;flex-direction:column;background:transparent;}
.fn-formula[data-featured="1"]{border-color:rgba(217,119,87,.45);}
.fn-note{font-size:13px;line-height:1.6;color:var(--fn-dim);}
.fn-alert{border:1px solid rgba(230,184,120,.28);border-radius:12px;padding:16px 18px;display:flex;gap:12px;align-items:flex-start;}
@media (prefers-reduced-motion:reduce){.fn-root *{transition:none !important;animation:none !important;}}
@media (max-width:640px){.fn-section{padding:52px 0;}}
`;

function Stars({ value = 5, size = 14 }) {
  return (
    <span className="fn-stars" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} aria-hidden="true"
          style={{ color: i <= value ? 'var(--fn-amber)' : 'var(--fn-dim)' }}
          fill={i <= value ? 'currentColor' : 'none'} strokeWidth={1.6} />
      ))}
    </span>
  );
}

/**
 * Couverture : la photo officielle si elle est posée en base, sinon le verdict dessiné.
 * `broken` couvre le cas d'une URL renseignée mais introuvable — un carré d'image
 * cassée en haut d'une page de vente coûte plus cher que pas d'image du tout.
 */
function Cover({ product }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [product?.coverUrl]);

  if (product?.coverUrl && !broken) {
    return (
      <img src={product.coverUrl} alt={`Couverture — ${product.title}`}
        className="fn-cover-img" loading="eager" onError={() => setBroken(true)} />
    );
  }
  return (
    <div className="fn-cover" role="img"
      aria-label="Couverture : les mots de l'accusation, puis ceux que la femme reprend">
      <div className="fn-verdict" aria-hidden="true">
        {ACCUSATIONS.map((w) => <span key={w}>{w}</span>)}
        <hr />
        {LIBERATIONS.map((w) => <span key={w} className="fn-free">{w}</span>)}
      </div>
      <h2 className="fn-cover-title fn-serif">LA FEMME<br />NOUVELLE</h2>
      <p className="fn-cover-sub">Un livre qui réécrit la justice</p>
      <p className="fn-cover-sub" style={{ marginTop: 4, color: '#e6b878' }}>MK 5</p>
    </div>
  );
}

export default function FemmeNouvellePage() {
  const [product, setProduct] = useState(null);
  const [program, setProgram] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try { setProduct(await boutiqueApi.product(PRODUCT)); }
    catch { setLoadError('Impossible de charger l’ouvrage pour le moment.'); }
    try { setProgram(await boutiqueApi.program(PROGRAM)); } catch { /* section masquée */ }
    try { const r = await boutiqueApi.reviews(PRODUCT); if (Array.isArray(r)) setReviews(r); } catch { /* pas de mur */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { document.title = 'La Femme Nouvelle — On t’a jugée sans t’entendre'; }, []);

  return (
    <div className="fn-root">
      <style>{CSS}</style>
      <Hero product={product} loadError={loadError} />
      <LeLivre product={product} />
      <Sommaire />
      <Extraits product={product} />
      <Achat product={product} onPurchased={load} />
      <Temoignages product={product} reviews={reviews} onSubmitted={load} />
      <Accompagnement program={program} />
      <Pied />
    </div>
  );
}

/* ───────────────────────────────── HERO ───────────────────────────────── */

function Hero({ product, loadError }) {
  const priceKnown = !!product?.priceCents;
  return (
    <header style={{ borderBottom: '1px solid var(--fn-line-soft)' }}>
      <div className="fn-wrap" style={{ padding: '48px 20px 64px' }}>
        <div style={{
          display: 'grid', gap: 44, alignItems: 'center',
          gridTemplateColumns: 'minmax(0,1fr)',
        }} className="fn-hero-grid">
          <div>
            <p className="fn-kicker">Ngowazulu Nemayekou · 5ᵉ Manikongo · MK5</p>
            <h1 className="fn-serif" style={{
              fontSize: 'clamp(34px,6.4vw,62px)', lineHeight: 1.03, letterSpacing: '-.025em',
              margin: '14px 0 0', textWrap: 'balance',
            }}>
              {product?.title || 'On t’a jugée sans t’entendre'}
            </h1>
            <p style={{
              fontSize: 'clamp(16px,2.2vw,20px)', color: 'var(--fn-amber)', margin: '14px 0 0',
              fontStyle: 'italic',
            }} className="fn-serif">
              {product?.subtitle || 'Le procès qu’on n’a jamais fait aux femmes'}
            </p>
            <p className="fn-lead" style={{ margin: '22px 0 0' }}>
              {product?.description
                || 'Il existe un tribunal que tu n’as jamais vu siéger. Il rend depuis des siècles le même verdict contre les mêmes femmes, sans jamais les appeler à la barre. Ce livre est la révision de ce procès.'}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', margin: '30px 0 0' }}>
              <a href="#acheter" className="fn-btn fn-btn-primary">
                <BookOpen size={17} aria-hidden="true" />
                {priceKnown
                  ? `Obtenir le livre — ${eur(product.priceCents)}`
                  : 'Obtenir le livre'}
              </a>
              <a href="#accompagnement" className="fn-btn fn-btn-ghost">
                L’accompagnement <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>

            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '10px 22px', margin: '26px 0 0',
              fontSize: 13.5, color: 'var(--fn-dim)',
            }}>
              <span>{product?.pageCount || 144} pages · PDF</span>
              <span>Deuxième édition, revue et augmentée</span>
              {product?.priceXaf ? <span>{cfa(product.priceXaf)} en Mobile Money</span> : null}
              {product?.reviewCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Stars value={Math.round(product.reviewAverage || 5)} size={13} />
                  {product.reviewCount} avis
                </span>
              )}
            </div>

            {loadError && (
              <p style={{ color: 'var(--fn-coral-soft)', fontSize: 14, marginTop: 18 }}>{loadError}</p>
            )}
          </div>

          <div style={{ maxWidth: 380, width: '100%', justifySelf: 'center' }}>
            <Cover product={product} />
          </div>
        </div>
      </div>

      <style>{`@media (min-width:900px){.fn-hero-grid{grid-template-columns:1.25fr .75fr !important;}}`}</style>
    </header>
  );
}

/* ─────────────────────────────── LE LIVRE ─────────────────────────────── */

function LeLivre({ product }) {
  const items = product?.highlights?.length ? product.highlights : [];
  if (!items.length) return null;
  return (
    <section className="fn-section">
      <div className="fn-wrap">
        <p className="fn-kicker">Ce que ce livre fait</p>
        <h2 className="fn-h2 fn-serif">Ce n’est pas une supplique. C’est une révision.</h2>
        <div className="fn-grid" style={{ marginTop: 34 }}>
          {items.map((h, i) => (
            <article key={i} className="fn-card">
              <h3 className="fn-serif" style={{ fontSize: 18, margin: 0, lineHeight: 1.3 }}>{h.title}</h3>
              <p style={{ color: 'var(--fn-muted)', fontSize: 14.5, lineHeight: 1.65, margin: '10px 0 0' }}>{h.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── SOMMAIRE ─────────────────────────────── */

function Sommaire() {
  return (
    <section className="fn-section">
      <div className="fn-wrap">
        <p className="fn-kicker">Le dossier</p>
        <h2 className="fn-h2 fn-serif">Six parties, dans l’ordre d’un procès</h2>
        <p className="fn-lead" style={{ marginTop: 14 }}>
          À la fin de chaque partie, une page t’est réservée. On les appelle des pièces —
          elles portent ton écriture, parce que personne d’autre n’a qualité pour les écrire.
        </p>
        <div className="fn-grid" style={{ marginTop: 34 }}>
          {PARTS.map((p) => (
            <article key={p.n} className="fn-card">
              <span className="fn-serif" style={{ color: 'var(--fn-amber)', fontSize: 22 }}>{p.n}</span>
              <h3 className="fn-serif" style={{ fontSize: 17.5, margin: '6px 0 0', lineHeight: 1.3 }}>{p.title}</h3>
              <p style={{ color: 'var(--fn-muted)', fontSize: 14, lineHeight: 1.6, margin: '9px 0 0' }}>{p.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── EXTRAITS ─────────────────────────────── */

function Extraits({ product }) {
  const list = product?.excerpts?.length ? product.excerpts : [];
  if (!list.length) return null;
  return (
    <section className="fn-section">
      <div className="fn-wrap">
        <p className="fn-kicker">Extraits</p>
        <h2 className="fn-h2 fn-serif">Douze vérités à emporter — en voici six</h2>
        <div style={{ display: 'grid', gap: 26, marginTop: 34, gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
          {list.map((x, i) => (
            <figure key={i} className="fn-quote" style={{ margin: 0 }}>
              <Quote size={18} aria-hidden="true" style={{ color: 'var(--fn-coral)', opacity: .75 }} />
              <blockquote className="fn-serif" style={{
                margin: '10px 0 0', fontSize: 18.5, lineHeight: 1.5, fontStyle: 'italic', color: 'var(--fn-ink)',
              }}>
                « {x.quote} »
              </blockquote>
              <figcaption style={{ marginTop: 10, fontSize: 12.5, color: 'var(--fn-dim)' }}>{x.source}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────── ACHAT ──────────────────────────────── */

function Achat({ product, onPurchased }) {
  const [region, setRegion] = useState('afrique');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('GAB');
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState(null); // {kind:'attente'|'pret'|'echec', text, url}
  const [resendOpen, setResendOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const pollRef = useRef(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Retour de Stripe (success_url) → on confirme et on délivre le lien.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('achat') === 'annule') {
      setState({ kind: 'echec', text: 'Paiement annulé. Rien n’a été débité.' });
      window.history.replaceState({}, '', window.location.pathname + '#acheter');
      return;
    }
    const sid = q.get('session_id');
    if (q.get('achat') !== 'merci' || !sid) return;
    setState({ kind: 'attente', text: 'Confirmation de votre paiement…' });
    window.history.replaceState({}, '', window.location.pathname + '#acheter');
    let tries = 0;
    const tick = async () => {
      tries += 1;
      try {
        const r = await boutiqueApi.confirmStripe(PRODUCT, sid);
        if (r?.status === 'completed') {
          setState({
            kind: 'pret', url: r.downloadUrl,
            text: 'Merci. Votre exemplaire est prêt — le lien vous a aussi été envoyé par e-mail.',
          });
          onPurchased?.();
          return true;
        }
      } catch { /* on retente */ }
      if (tries >= 10) {
        setState({
          kind: 'attente',
          text: 'Paiement en cours de validation. Dès qu’il est confirmé, le lien part par e-mail.',
        });
        return true;
      }
      return false;
    };
    (async () => { if (await tick()) return; pollRef.current = setInterval(async () => {
      if (await tick()) clearInterval(pollRef.current);
    }, 3000); })();
  }, [onPurchased]);

  // Opérateurs Mobile Money du pays choisi.
  useEffect(() => {
    if (region !== 'afrique') return;
    let alive = true;
    (async () => {
      try {
        const cfg = await boutiqueApi.providers(PRODUCT, country);
        if (!alive) return;
        const list = extractProviders(cfg, country);
        setProviders(list);
        setProvider((p) => (list.some((x) => x.code === p) ? p : (list[0]?.code || '')));
      } catch { if (alive) setProviders([]); }
    })();
    return () => { alive = false; };
  }, [region, country]);

  const canBuy = useMemo(() => {
    if (!product?.active || !email.trim()) return false;
    if (region === 'afrique') return !!provider && phone.replace(/\D/g, '').length >= 8;
    return true;
  }, [product, email, region, provider, phone]);

  const buy = async () => {
    setError(''); setBusy(true);
    try {
      if (region === 'eu') {
        const r = await boutiqueApi.stripe(PRODUCT, { buyerEmail: email.trim(), buyerName: name.trim() || undefined });
        if (r?.checkoutUrl) { window.location.href = r.checkoutUrl; return; }
        throw new Error('Impossible d’ouvrir le paiement.');
      }
      const r = await boutiqueApi.pawapay(PRODUCT, {
        buyerEmail: email.trim(), buyerName: name.trim() || undefined,
        phoneNumber: phone, provider, country,
      });
      setState({
        kind: 'attente',
        text: `Validez le paiement de ${cfa(r.displayAmount)} sur votre téléphone (${phone}). Cette page se met à jour toute seule.`,
      });
      let tries = 0;
      pollRef.current = setInterval(async () => {
        tries += 1;
        try {
          const s = await boutiqueApi.pawapayStatus(PRODUCT, r.depositId);
          if (s?.status === 'completed') {
            clearInterval(pollRef.current);
            setState({
              kind: 'pret', url: s.downloadUrl,
              text: 'Paiement confirmé. Votre exemplaire est prêt — le lien vous a aussi été envoyé par e-mail.',
            });
            onPurchased?.();
          } else if (s?.status === 'failed') {
            clearInterval(pollRef.current);
            setState({ kind: 'echec', text: 'Le paiement n’a pas abouti. Vous pouvez réessayer.' });
          }
        } catch { /* on retente */ }
        if (tries >= 60) {
          clearInterval(pollRef.current);
          setState({
            kind: 'attente',
            text: 'Toujours pas de confirmation. Si le montant a été débité, le lien partira par e-mail dès validation.',
          });
        }
      }, 4000);
    } catch (e) {
      setError(pickApiError(e) || 'Le paiement n’a pas pu démarrer. Réessayez dans un instant.');
    } finally { setBusy(false); }
  };

  const resend = async () => {
    setResendMsg('');
    try {
      const r = await boutiqueApi.resendLink(PRODUCT, resendEmail.trim());
      setResendMsg(r?.message || 'Si cette adresse correspond à un achat, le lien vient d’y être renvoyé.');
    } catch (e) { setResendMsg(pickApiError(e) || 'Envoi impossible pour le moment.'); }
  };

  return (
    <section className="fn-section" id="acheter" style={{ scrollMarginTop: 20 }}>
      <div className="fn-wrap">
        <div style={{ display: 'grid', gap: 40, gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
          <div>
            <p className="fn-kicker">Le livre</p>
            <h2 className="fn-h2 fn-serif">Recevez-le maintenant</h2>
            <p className="fn-lead" style={{ marginTop: 14 }}>
              Le PDF vous parvient tout de suite après le paiement, par e-mail et sur cette page.
            </p>
            <ul style={{ margin: '24px 0 0', padding: 0, display: 'grid', gap: 12 }}>
              {[
                [BookOpen, `${product?.pageCount || 144} pages, lisible sur téléphone, tablette et ordinateur`],
                [Download, `Téléchargeable ${product?.maxDownloads || 5} fois pendant ${product?.downloadDays || 90} jours`],
                [Lock, 'Votre exemplaire porte votre nom — merci de ne pas le rediffuser'],
                [Smartphone, 'Mobile Money en zone franc CFA, carte bancaire ailleurs'],
              ].map(([Icon, text], i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', listStyle: 'none' }}>
                  <Icon size={17} aria-hidden="true" style={{ color: 'var(--fn-coral)', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: 'var(--fn-muted)', fontSize: 14.5, lineHeight: 1.55 }}>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="fn-card" style={{ padding: 26 }}>
            {state?.kind === 'pret' ? (
              <div>
                <Check size={30} aria-hidden="true" style={{ color: 'var(--fn-coral)' }} />
                <h3 className="fn-serif" style={{ fontSize: 21, margin: '12px 0 0' }}>C’est à vous.</h3>
                <p style={{ color: 'var(--fn-muted)', fontSize: 14.5, lineHeight: 1.6, margin: '10px 0 20px' }}>{state.text}</p>
                {state.url && (
                  <a href={state.url} className="fn-btn fn-btn-primary" style={{ width: '100%' }}>
                    <Download size={17} aria-hidden="true" /> Télécharger le PDF
                  </a>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span className="fn-serif" style={{ fontSize: 34, color: 'var(--fn-amber)' }}>
                    {region === 'afrique' && product?.priceXaf ? cfa(product.priceXaf) : eur(product?.priceCents)}
                  </span>
                  <span style={{ color: 'var(--fn-dim)', fontSize: 13.5 }}>
                    {region === 'afrique' && product?.priceXaf ? `soit ${eur(product?.priceCents)}` : 'paiement unique'}
                  </span>
                </div>

                <div className="fn-seg" style={{ margin: '20px 0 18px' }} role="group" aria-label="Moyen de paiement">
                  <button type="button" data-on={region === 'afrique' ? '1' : '0'}
                    onClick={() => setRegion('afrique')}>
                    <Smartphone size={15} aria-hidden="true" /> Mobile Money
                  </button>
                  <button type="button" data-on={region === 'eu' ? '1' : '0'}
                    onClick={() => setRegion('eu')}>
                    <CreditCard size={15} aria-hidden="true" /> Carte
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <label className="fn-label" htmlFor="fn-email">Votre e-mail — c’est là que part le livre</label>
                    <input id="fn-email" type="email" autoComplete="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
                  </div>
                  <div>
                    <label className="fn-label" htmlFor="fn-name">Votre nom (facultatif)</label>
                    <input id="fn-name" type="text" autoComplete="name" value={name}
                      onChange={(e) => setName(e.target.value)} placeholder="Prénom Nom" />
                  </div>

                  {region === 'afrique' && (
                    <>
                      <div>
                        <label className="fn-label" htmlFor="fn-country">Pays</label>
                        <select id="fn-country" value={country} onChange={(e) => setCountry(e.target.value)}>
                          {CFA_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="fn-label" htmlFor="fn-provider">Opérateur</label>
                        <select id="fn-provider" value={provider} onChange={(e) => setProvider(e.target.value)}
                          disabled={!providers.length}>
                          {providers.length
                            ? providers.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)
                            : <option value="">Aucun opérateur disponible</option>}
                        </select>
                      </div>
                      <div>
                        <label className="fn-label" htmlFor="fn-phone">Numéro Mobile Money</label>
                        <input id="fn-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone}
                          onChange={(e) => setPhone(e.target.value)} placeholder="077 51 40 15" />
                      </div>
                    </>
                  )}
                </div>

                {error && <p style={{ color: 'var(--fn-coral-soft)', fontSize: 13.5, margin: '14px 0 0' }}>{error}</p>}

                {state?.kind === 'attente' && (
                  <div className="fn-alert" style={{ margin: '16px 0 0' }}>
                    <Loader2 size={17} aria-hidden="true" className="animate-spin"
                      style={{ color: 'var(--fn-amber)', flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--fn-muted)', margin: 0 }}>{state.text}</p>
                  </div>
                )}
                {state?.kind === 'echec' && (
                  <p style={{ color: 'var(--fn-coral-soft)', fontSize: 13.5, margin: '14px 0 0' }}>{state.text}</p>
                )}

                <button type="button" className="fn-btn fn-btn-primary"
                  style={{ width: '100%', marginTop: 18 }}
                  disabled={!canBuy || busy || state?.kind === 'attente'} onClick={buy}>
                  {busy ? <Loader2 size={17} aria-hidden="true" className="animate-spin" /> : <BookOpen size={17} aria-hidden="true" />}
                  {region === 'eu' ? 'Payer par carte' : 'Payer par Mobile Money'}
                </button>

                <p className="fn-note" style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <ShieldCheck size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                  Paiement traité par Stripe ou pawaPay. Nous ne voyons jamais vos coordonnées bancaires.
                </p>
              </>
            )}

            <div style={{ borderTop: '1px solid var(--fn-line-soft)', marginTop: 20, paddingTop: 16 }}>
              {!resendOpen ? (
                <button type="button" onClick={() => setResendOpen(true)}
                  style={{ background: 'none', border: 0, color: 'var(--fn-dim)', fontSize: 13, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  Déjà acheté ? Renvoyez-moi le lien
                </button>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  <label className="fn-label" htmlFor="fn-resend">E-mail utilisé lors de l’achat</label>
                  <input id="fn-resend" type="email" value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)} placeholder="vous@exemple.com" />
                  <button type="button" className="fn-btn fn-btn-ghost" onClick={resend} disabled={!resendEmail.trim()}>
                    <Mail size={15} aria-hidden="true" /> Renvoyer le lien
                  </button>
                  {resendMsg && <p className="fn-note" style={{ margin: 0 }}>{resendMsg}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── TÉMOIGNAGES ───────────────────────────── */

/** Lien d'invitation à témoigner : `…/femme-nouvelle#temoignages` (ou `?avis=1`). */
function arriveePourTemoigner() {
  if (typeof window === 'undefined') return false;
  return window.location.hash === '#temoignages'
    || new URLSearchParams(window.location.search).has('avis');
}

function Temoignages({ product, reviews, onSubmitted }) {
  // Ouvert d'emblée quand on arrive par le lien d'invitation : la personne a été
  // sollicitée pour témoigner, lui faire chercher un bouton de plus la perd.
  const [open, setOpen] = useState(arriveePourTemoigner);
  const [form, setForm] = useState({ authorName: '', authorRole: '', rating: 5, reviewText: '', buyerEmail: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const r = await boutiqueApi.submitReview(PRODUCT, {
        ...form, rating: Number(form.rating),
        authorRole: form.authorRole || undefined,
        buyerEmail: form.buyerEmail || undefined,
      });
      setMsg(r?.message || 'Merci. Votre témoignage sera publié après relecture.');
      setForm({ authorName: '', authorRole: '', rating: 5, reviewText: '', buyerEmail: '', website: '' });
      setOpen(false);
      onSubmitted?.();
    } catch (err) {
      setError(pickApiError(err) || 'Envoi impossible pour le moment.');
    } finally { setBusy(false); }
  };

  return (
    <section className="fn-section" id="temoignages">
      <div className="fn-wrap">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p className="fn-kicker">Ce qu’elles en disent</p>
            <h2 className="fn-h2 fn-serif">Les lectrices ont la parole</h2>
            {product?.reviewCount > 0 && (
              <p style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 0', color: 'var(--fn-muted)', fontSize: 14 }}>
                <Stars value={Math.round(product.reviewAverage || 5)} />
                {product.reviewAverage} sur 5 — {product.reviewCount} témoignage{product.reviewCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button type="button" className="fn-btn fn-btn-ghost" onClick={() => setOpen((o) => !o)}
            aria-expanded={open} aria-controls="fn-form-avis">
            {open ? 'Fermer' : 'Laisser un témoignage'}
          </button>
        </div>

        {msg && (
          <div className="fn-alert" style={{ marginTop: 22 }}>
            <Check size={17} aria-hidden="true" style={{ color: 'var(--fn-amber)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fn-muted)' }}>{msg}</p>
          </div>
        )}

        {open && (
          <form id="fn-form-avis" onSubmit={submit} className="fn-card" style={{ marginTop: 24, display: 'grid', gap: 15 }}>
            <p className="fn-note" style={{ margin: 0 }}>
              Votre témoignage est relu avant publication. Vous pouvez signer d’un prénom seul.
            </p>
            <div style={{ display: 'grid', gap: 15, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
              <div>
                <label className="fn-label" htmlFor="av-nom">Votre nom ou prénom</label>
                <input id="av-nom" required minLength={2} maxLength={80} value={form.authorName} onChange={set('authorName')} />
              </div>
              <div>
                <label className="fn-label" htmlFor="av-role">Ville ou situation (facultatif)</label>
                <input id="av-role" maxLength={80} value={form.authorRole} onChange={set('authorRole')} placeholder="Libreville" />
              </div>
            </div>
            <div style={{ display: 'grid', gap: 15, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
              <div>
                <label className="fn-label" htmlFor="av-note">Votre note</label>
                <select id="av-note" value={form.rating} onChange={set('rating')}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{n} étoile{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="fn-label" htmlFor="av-mail">E-mail de votre achat (facultatif)</label>
                <input id="av-mail" type="email" value={form.buyerEmail} onChange={set('buyerEmail')}
                  placeholder="pour le badge « achat vérifié »" />
              </div>
            </div>
            <div>
              <label className="fn-label" htmlFor="av-texte">Votre témoignage</label>
              <textarea id="av-texte" required minLength={10} maxLength={2000} rows={5}
                value={form.reviewText} onChange={set('reviewText')}
                placeholder="Ce que ce livre a changé pour vous…" />
            </div>
            {/* Pot de miel : invisible pour une humaine, rempli par les robots. */}
            <input type="text" name="website" value={form.website} onChange={set('website')}
              tabIndex={-1} autoComplete="off" aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
            {error && <p style={{ color: 'var(--fn-coral-soft)', fontSize: 13.5, margin: 0 }}>{error}</p>}
            <button type="submit" className="fn-btn fn-btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>
              {busy ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : <Check size={16} aria-hidden="true" />}
              Envoyer mon témoignage
            </button>
          </form>
        )}

        {reviews.length > 0 ? (
          <div className="fn-grid" style={{ marginTop: 30 }}>
            {reviews.map((r) => (
              <article key={r.id} className="fn-card">
                <Stars value={r.rating} />
                <p style={{ color: 'var(--fn-ink)', fontSize: 15, lineHeight: 1.65, margin: '12px 0 14px' }}>{r.text}</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--fn-dim)' }}>
                  <strong style={{ color: 'var(--fn-muted)' }}>{r.authorName}</strong>
                  {r.authorRole ? ` · ${r.authorRole}` : ''}
                  {r.verified && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, color: 'var(--fn-amber)' }}>
                      <ShieldCheck size={12} aria-hidden="true" /> achat vérifié
                    </span>
                  )}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="fn-lead" style={{ marginTop: 26 }}>
            Aucun témoignage publié pour l’instant. Si vous avez lu le livre, le vôtre sera le premier.
          </p>
        )}
      </div>
    </section>
  );
}

/* ────────────────────────── ACCOMPAGNEMENT ────────────────────────── */

function Accompagnement({ program }) {
  // La formule choisie vit ICI, pas dans le <select> : écrire dans le DOM et
  // émettre un `change` natif ne met pas à jour l'état d'un champ contrôlé React.
  const [picked, setPicked] = useState('');
  if (!program?.active) return null;
  return (
    <section className="fn-section" id="accompagnement" style={{ scrollMarginTop: 20 }}>
      <div className="fn-wrap">
        <p className="fn-kicker">L’accompagnement</p>
        <h2 className="fn-h2 fn-serif">{program.title}</h2>
        <p className="fn-serif" style={{ fontSize: 'clamp(17px,2.4vw,22px)', color: 'var(--fn-amber)', fontStyle: 'italic', margin: '12px 0 0' }}>
          {program.tagline}
        </p>
        <p className="fn-lead" style={{ marginTop: 18 }}>{program.intro}</p>

        <div className="fn-axes" style={{ marginTop: 40 }}>
          {(program.axes || []).map((axe, i) => (
            <details key={axe.key} open={i === 0}>
              <summary>
                <span className="fn-serif" style={{ color: 'var(--fn-amber)', fontSize: 15, minWidth: 24 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ display: 'block' }}>
                  <span className="fn-serif" style={{ fontSize: 18.5, display: 'block', lineHeight: 1.3 }}>{axe.title}</span>
                  <span style={{ color: 'var(--fn-muted)', fontSize: 14, lineHeight: 1.55, display: 'block', marginTop: 5 }}>
                    {axe.summary}
                  </span>
                </span>
                <ChevronDown size={18} aria-hidden="true" className="fn-chev" />
              </summary>
              <ul className="fn-topics">
                {(axe.topics || []).map((t) => <li key={t}>{t}</li>)}
              </ul>
            </details>
          ))}
        </div>

        {program.formulas?.length > 0 && (
          <>
            <h3 className="fn-serif" style={{ fontSize: 24, margin: '52px 0 0' }}>Les formules</h3>
            <div className="fn-grid fn-formulas" style={{ marginTop: 22 }}>
              {program.formulas.map((f) => (
                <article key={f.key} className="fn-formula" data-featured={f.featured ? '1' : '0'}>
                  {f.featured && (
                    <span className="fn-kicker" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={12} aria-hidden="true" /> Le cœur du programme
                    </span>
                  )}
                  <h4 className="fn-serif" style={{ fontSize: 19, margin: f.featured ? '8px 0 0' : 0 }}>{f.title}</h4>
                  <p style={{ color: 'var(--fn-muted)', fontSize: 14, lineHeight: 1.6, margin: '9px 0 14px' }}>{f.summary}</p>
                  <p style={{ margin: '0 0 4px' }}>
                    <span className="fn-serif" style={{ fontSize: 26, color: 'var(--fn-amber)' }}>{cfa(f.priceXaf)}</span>
                  </p>
                  <p className="fn-note" style={{ margin: '0 0 16px' }}>
                    {eur(f.priceCents)} · {f.billingLabel}{f.durationLabel ? ` · ${f.durationLabel}` : ''}
                  </p>
                  <ul style={{ margin: '0 0 20px', padding: 0, display: 'grid', gap: 8 }}>
                    {(f.includes || []).map((inc) => (
                      <li key={inc} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', listStyle: 'none' }}>
                        <Check size={14} aria-hidden="true" style={{ color: 'var(--fn-coral)', flexShrink: 0, marginTop: 3 }} />
                        <span style={{ color: 'var(--fn-muted)', fontSize: 13.5, lineHeight: 1.5 }}>{inc}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="#demande" className="fn-btn fn-btn-ghost" style={{ marginTop: 'auto' }}
                    onClick={() => setPicked(f.key)}>
                    Demander ce rendez-vous
                  </a>
                </article>
              ))}
            </div>
          </>
        )}

        {program.disclaimer && (
          <div className="fn-alert" style={{ marginTop: 40 }}>
            <AlertTriangle size={18} aria-hidden="true" style={{ color: 'var(--fn-amber)', flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--fn-muted)' }}>{program.disclaimer}</p>
          </div>
        )}

        <DemandeRdv program={program} picked={picked} onPick={setPicked} />
      </div>
    </section>
  );
}

function DemandeRdv({ program, picked, onPick }) {
  const [form, setForm] = useState({
    formulaKey: '', fullName: '', email: '', phone: '', country: '',
    preferredAt: '', preferredNote: '', channel: 'visio', message: '', website: '',
  });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  // Formule pré-remplie : celle mise en avant au chargement, puis celle sur
  // laquelle la visiteuse a cliqué depuis une carte.
  useEffect(() => {
    const featured = program?.formulas?.find((f) => f.featured) || program?.formulas?.[0];
    if (featured) setForm((f) => (f.formulaKey ? f : { ...f, formulaKey: featured.key }));
  }, [program]);
  useEffect(() => {
    if (picked) setForm((f) => ({ ...f, formulaKey: picked }));
  }, [picked]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const r = await boutiqueApi.requestAccompaniment(program.slug, {
        ...form,
        preferredAt: form.preferredAt ? new Date(form.preferredAt).toISOString() : undefined,
        preferredNote: form.preferredNote || undefined,
        phone: form.phone || undefined,
        country: form.country || undefined,
        message: form.message || undefined,
        consent,
      });
      setDone(r?.message || 'Votre demande est enregistrée.');
    } catch (err) {
      setError(pickApiError(err) || 'Envoi impossible pour le moment. Réessayez dans un instant.');
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="fn-card" style={{ marginTop: 44, textAlign: 'center', padding: 40 }} id="demande">
        <Check size={30} aria-hidden="true" style={{ color: 'var(--fn-coral)' }} />
        <h3 className="fn-serif" style={{ fontSize: 22, margin: '14px 0 0' }}>Votre demande est partie.</h3>
        <p className="fn-lead" style={{ margin: '12px auto 0' }}>{done}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="fn-card" style={{ marginTop: 44, padding: 28 }} id="demande">
      <h3 className="fn-serif" style={{ fontSize: 23, margin: 0 }}>Prendre rendez-vous</h3>
      <p className="fn-lead" style={{ margin: '10px 0 24px' }}>
        Dites-nous quand vous êtes disponible : nous vous rappelons sous 48 heures ouvrées
        pour fixer le rendez-vous ensemble. Ce que vous écrivez ici reste entre nous.
      </p>

      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <div>
            <label className="fn-label" htmlFor="fn-formule">Formule souhaitée</label>
            <select id="fn-formule" value={form.formulaKey}
              onChange={(e) => { setForm((f) => ({ ...f, formulaKey: e.target.value })); onPick?.(e.target.value); }}>
              <option value="">Je ne sais pas encore</option>
              {(program.formulas || []).map((f) => <option key={f.key} value={f.key}>{f.title}</option>)}
            </select>
          </div>
          <div>
            <label className="fn-label" htmlFor="fn-canal">Comment vous joindre</label>
            <select id="fn-canal" value={form.channel} onChange={set('channel')}>
              <option value="visio">Visioconférence</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="telephone">Téléphone</option>
              <option value="presentiel">En présentiel</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <div>
            <label className="fn-label" htmlFor="fn-nom">Votre nom</label>
            <input id="fn-nom" required minLength={2} maxLength={120} autoComplete="name"
              value={form.fullName} onChange={set('fullName')} />
          </div>
          <div>
            <label className="fn-label" htmlFor="fn-mail">Votre e-mail</label>
            <input id="fn-mail" type="email" required autoComplete="email"
              value={form.email} onChange={set('email')} />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <div>
            <label className="fn-label" htmlFor="fn-tel">Téléphone ou WhatsApp</label>
            <input id="fn-tel" type="tel" inputMode="tel" autoComplete="tel"
              value={form.phone} onChange={set('phone')} placeholder="+241 77 51 40 15" />
          </div>
          <div>
            <label className="fn-label" htmlFor="fn-pays">Pays</label>
            <input id="fn-pays" maxLength={60} value={form.country} onChange={set('country')} placeholder="Gabon" />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <div>
            <label className="fn-label" htmlFor="fn-quand">Date et heure souhaitées</label>
            <input id="fn-quand" type="datetime-local" value={form.preferredAt} onChange={set('preferredAt')} />
          </div>
          <div>
            <label className="fn-label" htmlFor="fn-dispo">Ou, en un mot, vos disponibilités</label>
            <input id="fn-dispo" maxLength={120} value={form.preferredNote} onChange={set('preferredNote')}
              placeholder="Plutôt en soirée, ou le week-end" />
          </div>
        </div>

        <div>
          <label className="fn-label" htmlFor="fn-msg">Ce que vous voulez nous dire (facultatif)</label>
          <textarea id="fn-msg" rows={4} maxLength={2000} value={form.message} onChange={set('message')}
            placeholder="Vous n’êtes pas obligée de tout raconter ici. Une phrase suffit pour commencer." />
        </div>

        {/* Pot de miel anti-robot. */}
        <input type="text" name="website" value={form.website} onChange={set('website')}
          tabIndex={-1} autoComplete="off" aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />

        <label style={{ display: 'flex', gap: 11, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
            required style={{ width: 17, height: 17, marginTop: 2, flexShrink: 0, accentColor: '#d97757' }} />
          <span style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--fn-muted)' }}>
            J’accepte d’être recontactée à propos de cette demande. Mes informations ne sont ni revendues,
            ni transmises à un tiers.
          </span>
        </label>

        {error && <p style={{ color: 'var(--fn-coral-soft)', fontSize: 13.5, margin: 0 }}>{error}</p>}

        <button type="submit" className="fn-btn fn-btn-primary" disabled={busy || !consent} style={{ justifySelf: 'start' }}>
          {busy ? <Loader2 size={17} aria-hidden="true" className="animate-spin" /> : <ArrowRight size={17} aria-hidden="true" />}
          Envoyer ma demande
        </button>
      </div>
    </form>
  );
}

/* ───────────────────────────────── PIED ───────────────────────────────── */

function Pied() {
  return (
    <footer style={{ background: 'var(--fn-rail)', borderTop: '1px solid var(--fn-line-soft)', padding: '40px 0' }}>
      <div className="fn-wrap">
        <div className="fn-alert" style={{ marginBottom: 26 }}>
          <ShieldCheck size={18} aria-hidden="true" style={{ color: 'var(--fn-amber)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--fn-muted)' }}>
            <strong style={{ color: 'var(--fn-ink)' }}>Si vous n’êtes pas en sécurité</strong>, ne restez pas seule
            et n’attendez pas notre réponse : rapprochez-vous des secours ou d’une association de votre pays.
            Le livre y consacre son annexe D.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="fn-serif" style={{ margin: 0, fontSize: 15, letterSpacing: '.1em', color: 'var(--fn-amber)' }}>
            LA FEMME NOUVELLE
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fn-dim)' }}>
            © {new Date().getFullYear()} Ngowazulu Nemayekou — MK5 ·{' '}
            <a href="/" style={{ color: 'var(--fn-dim)' }}>prorascience.org</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
