import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera, Video, HardDrive, Radio, Heart, ShieldCheck, Loader2,
  CreditCard, Smartphone, Check, ArrowRight, Users, Sparkles,
} from 'lucide-react';
import { cagnotteApi } from '@/lib/api-v2';
import { authStore } from '@/lib/auth-store';

const SLUG = 'smartforme-culte';

// Détecte une session PROPRIÉTAIRE (LIRI) — pour n'activer le lien vers le CRM QUE pour l'owner
// connecté (le mur reste une vitrine publique sans donnée perso pour les visiteurs anonymes).
const OWNER_ROLES = new Set(['owner', 'admin', 'secretariat']);
function ownerRoleFromToken() {
  try {
    const tok = authStore.getToken?.() || '';
    const part = tok.split('.')[1];
    if (!part) return '';
    const json = JSON.parse(decodeURIComponent(escape(atob(part.replace(/-/g, '+').replace(/_/g, '/')))));
    return String(json?.app_metadata?.tenant_role || json?.tenant_role || '').toLowerCase();
  } catch { return ''; }
}

// Pays de la zone franc CFA (Mobile Money via pawaPay ; XAF=CEMAC, XOF=UEMOA).
const CFA_COUNTRIES = [
  { code: 'CMR', name: 'Cameroun', cur: 'XAF', dial: '237' },
  { code: 'CIV', name: "Côte d'Ivoire", cur: 'XOF', dial: '225' },
  { code: 'SEN', name: 'Sénégal', cur: 'XOF', dial: '221' },
  { code: 'GAB', name: 'Gabon', cur: 'XAF', dial: '241' },
  { code: 'COG', name: 'Congo', cur: 'XAF', dial: '242' },
  { code: 'BEN', name: 'Bénin', cur: 'XOF', dial: '229' },
  { code: 'BFA', name: 'Burkina Faso', cur: 'XOF', dial: '226' },
  { code: 'TGO', name: 'Togo', cur: 'XOF', dial: '228' },
  { code: 'MLI', name: 'Mali', cur: 'XOF', dial: '223' },
  { code: 'NER', name: 'Niger', cur: 'XOF', dial: '227' },
  { code: 'TCD', name: 'Tchad', cur: 'XAF', dial: '235' },
];

// Extrait le VRAI message d'erreur de l'API (les erreurs de validation NestJS arrivent en tableau).
function pickApiError(e) {
  const d = e?.response?.data;
  const m = d?.error?.message ?? d?.message;
  return Array.isArray(m) ? m.join(' ') : (typeof m === 'string' ? m : null);
}
const CFA_PEG = 655.957;
const PRESETS_EU = [10, 25, 50, 100, 250];          // en euros
const PRESETS_CFA = [1000, 2500, 5000, 10000, 25000]; // en francs CFA

const eur = (cents) => `${(Math.round(cents) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;

// Extraction tolérante des opérateurs depuis la config active pawaPay.
function extractProviders(config, country) {
  if (!config) return [];
  const countries = Array.isArray(config.countries) ? config.countries : [];
  const match = countries.find((c) => (c.country || c.countryCode) === country) || countries[0];
  const provs = match?.providers || config.providers || [];
  return provs
    .map((p) => ({
      code: p.provider || p.correspondent || p.code,
      name: p.displayName || p.name || p.provider || 'Opérateur',
      logo: p.logo || p.logoUrl || null,
    }))
    .filter((p) => p.code);
}

// Illustration par défaut (dos de flagship type Galaxy Ultra) tant qu'aucune photo
// réelle n'est posée dans cagnotte_campaigns.image_url.
function PhoneArt() {
  return (
    <svg viewBox="0 0 240 380" className="mx-auto h-auto w-[140px]" role="img" aria-label="Illustration du téléphone">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2724" /><stop offset="1" stopColor="#161513" />
        </linearGradient>
      </defs>
      <rect x="22" y="10" width="196" height="360" rx="30" fill="url(#body)" stroke="#3a3835" strokeWidth="2" />
      <g stroke="#4a4744" strokeWidth="2" fill="#0a0908">
        <circle cx="58" cy="54" r="14" /><circle cx="58" cy="94" r="14" /><circle cx="58" cy="132" r="11" />
      </g>
      <circle cx="58" cy="54" r="5" fill="#e8a184" opacity="0.55" />
      <circle cx="58" cy="94" r="5" fill="#e8a184" opacity="0.35" />
      <rect x="94" y="48" width="11" height="11" rx="3" fill="#4a4744" />
      <text x="120" y="332" textAnchor="middle" fill="#6a655f" fontSize="13" fontWeight="700" letterSpacing="2" fontFamily="Inter, sans-serif">ULTRA</text>
      <rect x="205" y="132" width="7" height="168" rx="3.5" fill="#d97757" />
    </svg>
  );
}

export default function CagnottePage() {
  const [campaign, setCampaign] = useState(null);
  const [donors, setDonors] = useState(/** @type {Array<any>} */ ([]));
  const [region, setRegion] = useState(/** @type {'eu'|'afrique'} */ ('eu'));
  const [amountEur, setAmountEur] = useState(50);
  const [customEur, setCustomEur] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorMessage, setDonorMessage] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  // Propriétaire connecté ? → le mur des donateurs devient cliquable vers le CRM (owner only).
  const isOwner = useMemo(() => OWNER_ROLES.has(ownerRoleFromToken()), []);
  const [country, setCountry] = useState('CMR');
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState(/** @type {null|{kind:'merci'|'annule'|'attente',text:string}} */ (null));
  const pollRef = useRef(null);

  // Montant canonique en CENTIMES EUR (objectif + total en €). En Afrique, la saisie
  // est en CFA → on reconvertit en € via le peg pour l'API + le total.
  const amountCents = useMemo(() => {
    const raw = customEur !== '' ? Number(customEur) : amountEur;
    const n = Number(raw) || 0;
    return region === 'eu' ? Math.round(n * 100) : Math.round((n / CFA_PEG) * 100);
  }, [amountEur, customEur, region]);

  const load = useCallback(async () => {
    try { setCampaign(await cagnotteApi.campaign(SLUG)); } catch { /* garde le fallback */ }
    try { const list = await cagnotteApi.donors(SLUG); if (Array.isArray(list)) setDonors(list); } catch { /* pas de mur */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Retour de paiement (success_url / cancel_url Stripe).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const don = q.get('don');
    const sessionId = q.get('session_id');
    if (don === 'merci' && sessionId) {
      setBanner({ kind: 'attente', text: 'Confirmation de votre don…' });
      cagnotteApi.confirmStripe(SLUG, sessionId)
        .then((r) => setBanner(r?.status === 'completed'
          ? { kind: 'merci', text: 'Merci ! Votre don est confirmé. 🙏' }
          : { kind: 'attente', text: 'Don reçu — confirmation en cours.' }))
        .catch(() => setBanner({ kind: 'merci', text: 'Merci pour votre don ! 🙏' }))
        .finally(() => { load(); window.history.replaceState({}, '', '/cagnotte'); });
    } else if (don === 'annule') {
      setBanner({ kind: 'annule', text: 'Paiement annulé — vous pouvez réessayer quand vous voulez.' });
      window.history.replaceState({}, '', '/cagnotte');
    }
  }, [load]);

  // Opérateurs Mobile Money selon le pays.
  useEffect(() => {
    if (region !== 'afrique') return;
    let alive = true;
    cagnotteApi.providers(SLUG, country)
      .then((cfg) => { if (!alive) return; const list = extractProviders(cfg, country); setProviders(list); setProvider(list[0]?.code || ''); })
      .catch(() => { if (alive) { setProviders([]); setProvider(''); } });
    return () => { alive = false; };
  }, [region, country]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const selectedCountry = CFA_COUNTRIES.find((c) => c.code === country) || CFA_COUNTRIES[0];
  const cur = region === 'eu' ? 'EUR' : selectedCountry.cur; // devise affichée (XAF/XOF en Afrique)
  const presets = region === 'eu' ? PRESETS_EU : PRESETS_CFA;
  const fmtMoney = (v) => (region === 'eu' ? `${v} €` : `${Number(v).toLocaleString('fr-FR')} ${cur}`);
  // Montant Mobile Money EXACT : en Afrique le donateur choisit directement en CFA.
  const rawAmount = customEur !== '' ? Number(customEur) : amountEur;
  const mmAmount = region === 'afrique'
    ? Math.round(Number(rawAmount) || 0)
    : Math.round((amountCents / 100) * CFA_PEG);

  const goal = campaign?.goalCents ?? 170000;
  const raised = campaign?.raisedCents ?? 0;
  const pct = Math.min(100, Math.round((raised / goal) * 100));
  const device = campaign?.deviceName || 'Samsung Galaxy S26 Ultra — 1 To';

  const validAmount = amountCents >= 100 && amountCents <= 500000;

  const payStripe = async () => {
    setError(''); if (!validAmount) { setError('Choisissez un montant (1 € – 5 000 €).'); return; }
    setBusy(true);
    try {
      const r = await cagnotteApi.stripe(SLUG, { amountCents, donorName: donorName || undefined, donorMessage: donorMessage || undefined, donorEmail: donorEmail.trim() || undefined });
      if (r?.checkoutUrl) window.location.href = r.checkoutUrl;
      else setError('Impossible d’ouvrir le paiement. Réessayez.');
    } catch (e) { setError(pickApiError(e) || 'Paiement indisponible pour le moment.'); }
    finally { setBusy(false); }
  };

  const payPawapay = async () => {
    setError('');
    if (!validAmount) { setError('Choisissez un montant.'); return; }
    if (!provider) { setError('Choisissez votre opérateur Mobile Money.'); return; }
    // Indicatif géré ici : on garde SEULEMENT les chiffres du numéro local (retire lettres/espaces
    // et le 0 initial), puis on préfixe l'indicatif du pays → MSISDN international complet pour PawaPay.
    const localDigits = phone.replace(/\D/g, '').replace(/^0+/, '');
    if (localDigits.length < 6) { setError('Entrez votre numéro Mobile Money (sans l’indicatif).'); return; }
    const fullNumber = `${selectedCountry.dial}${localDigits}`;
    setBusy(true);
    try {
      const r = await cagnotteApi.pawapay(SLUG, {
        amountCents, mobileMoneyAmount: mmAmount, phoneNumber: fullNumber, provider, country,
        donorName: donorName || undefined, donorMessage: donorMessage || undefined,
        donorEmail: donorEmail.trim() || undefined,
      });
      setBanner({ kind: 'attente', text: `Validez le paiement de ${mmAmount.toLocaleString('fr-FR')} ${selectedCountry.cur} sur votre téléphone…` });
      // Poll de l'état (le donateur confirme sur son mobile).
      if (pollRef.current) clearInterval(pollRef.current);
      let tries = 0;
      pollRef.current = setInterval(async () => {
        tries += 1;
        try {
          const s = await cagnotteApi.pawapayStatus(SLUG, r.depositId);
          if (s?.status === 'completed') {
            clearInterval(pollRef.current);
            setBanner({ kind: 'merci', text: 'Merci ! Votre don Mobile Money est confirmé. 🙏' });
            setBusy(false); load();
          } else if (s?.status === 'failed') {
            clearInterval(pollRef.current);
            setBanner({ kind: 'annule', text: 'Le paiement n’a pas abouti. Vous pouvez réessayer.' });
            setBusy(false);
          }
        } catch { /* on continue de poller */ }
        if (tries > 40) { clearInterval(pollRef.current); setBusy(false); }
      }, 3000);
    } catch (e) {
      setError(pickApiError(e) || 'Paiement Mobile Money indisponible.');
      setBusy(false);
    }
  };

  // ── Écran de REMERCIEMENT plein page (don confirmé) ─────────────────────────
  //    Mobile Money : le donateur reste sur la page → sans ça, l'offre de prière
  //    restait invisible en bas. Ici elle prend tout l'écran, impossible à rater.
  if (banner?.kind === 'merci') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#262624] px-5 text-[#f5f4ee]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="w-full max-w-lg text-center">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#d97757]/20 text-[#e8a184]">
            <Check className="h-8 w-8" />
          </span>
          <h1 className="text-3xl font-extrabold sm:text-4xl">
            Merci{donorName.trim() ? ` ${donorName.trim()}` : ''} ! 🙏
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[#f5f4ee]/75">
            Votre don est confirmé — il rapproche la communauté de son objectif. En reconnaissance de votre
            offrande, réservez une <strong className="text-[#f5f4ee]">séance de prière gratuite</strong> pour
            déposer votre requête et être porté dans la prière.
          </p>
          {campaign?.bookingUrl ? (
            <a
              href={`${campaign.bookingUrl}${campaign.bookingUrl.includes('?') ? '&' : '?'}src=cagnotte`}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#d97757] px-6 py-3.5 text-[15px] font-bold text-[#1c1a18] shadow-[0_10px_30px_rgba(217,119,87,0.3)] transition-all hover:bg-[#e08b6d]"
            >
              <Sparkles className="h-5 w-5" />
              {campaign.bookingLabel || 'Réserver ma séance de prière gratuite'}
              <ArrowRight className="h-4 w-4" />
            </a>
          ) : null}
          <div className="mt-5">
            <a href="/cagnotte" className="text-[13px] font-semibold text-[#e8a184] hover:underline">
              ← Retour à la cagnotte
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#262624] text-[#f5f4ee]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ── Bannière retour paiement ── */}
      {banner && (
        <div className={`sticky top-0 z-30 px-4 py-3 text-center text-sm font-medium ${
          banner.kind === 'merci' ? 'bg-[#d97757] text-[#1c1a18]'
            : banner.kind === 'annule' ? 'bg-[#3a2f2a] text-[#f0c9b8]'
              : 'bg-[#2f2d2a] text-[#e8c9a0]'}`}>
          {banner.kind === 'attente' && <Loader2 className="inline h-4 w-4 animate-spin mr-2 align-[-2px]" />}
          {banner.text}
        </div>
      )}

      {/* ── HERO ── */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.18]"
          style={{ background: 'radial-gradient(1200px 500px at 70% -10%, #d97757 0%, transparent 60%), radial-gradient(900px 500px at 10% 10%, #b5642f 0%, transparent 55%)' }} />
        <div className="relative mx-auto max-w-5xl px-5 pt-16 pb-10 sm:pt-24">
          <div className="mb-4 flex items-center gap-3">
            <img src="/ngowazulu-logo.png" alt="Ngowazulu" className="h-14 w-14 shrink-0 object-contain" draggable={false} />
            <span className="text-2xl font-bold tracking-tight text-[#f5f4ee]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>Ngowazulu</span>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d97757]/40 bg-[#d97757]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#e8a184]">
            <Heart className="h-3.5 w-3.5" /> Cagnotte solidaire · Les métiers Ngowazulu
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl" style={{ textWrap: 'balance' }}>
            Aidez-nous à <span className="text-[#e8a184]">filmer et enregistrer</span> chaque culte, en haute qualité.
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[#f5f4ee]/72 sm:text-lg">
            Nous réunissons de quoi acheter <strong className="text-[#f5f4ee]">un {device}</strong> — un seul
            outil pour filmer les cultes, enregistrer les enseignements, et les stocker sans jamais rien effacer.
            Que vous soyez en Europe ou en Afrique, votre don compte.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24">
        {/* Offre POST-DON : séance de prière gratuite (RDV) en remerciement de l'offrande.
            Apparaît une fois le paiement confirmé (retour Stripe / pawaPay complété). */}
        {banner?.kind === 'merci' && campaign?.bookingUrl && (
          <div className="mb-8 rounded-2xl border border-[#d97757]/45 bg-[#d97757]/[0.10] p-6 text-center sm:p-8">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#d97757]/20 text-[#e8a184]">
              <Sparkles className="h-6 w-6" />
            </span>
            <h2 className="text-xl font-bold sm:text-2xl">Merci pour votre offrande 🙏</h2>
            <p className="mx-auto mt-2 max-w-xl text-[14px] leading-relaxed text-[#f5f4ee]/75">
              En reconnaissance de votre don, nous vous offrons une{' '}
              <strong className="text-[#f5f4ee]">séance de prière gratuite</strong> — un moment pour
              déposer votre requête et être porté dans la prière.
            </p>
            <a
              href={`${campaign.bookingUrl}${campaign.bookingUrl.includes('?') ? '&' : '?'}src=cagnotte`}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#d97757] px-6 py-3.5 text-[15px] font-bold text-[#1c1a18] shadow-[0_10px_30px_rgba(217,119,87,0.3)] transition-all hover:bg-[#e08b6d]"
            >
              {campaign.bookingLabel || 'Réserver une séance de prière gratuite'}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          {/* ── Colonne gauche : le POURQUOI ── */}
          <section className="space-y-8">
            {/* Visuel produit — photo réelle si campaign.imageUrl, sinon illustration. */}
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-5">
              <div className="shrink-0">
                {campaign?.imageUrl ? (
                  <img
                    src={campaign.imageUrl}
                    alt={device}
                    className="h-32 w-auto max-w-[140px] rounded-xl object-contain"
                    loading="lazy"
                  />
                ) : (
                  <PhoneArt />
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#e8a184]">L’appareil de la cagnotte</p>
                <p className="mt-1 text-lg font-bold leading-tight text-[#f5f4ee]">{device}</p>
                <p className="mt-1 text-[13px] text-[#f5f4ee]/60">Vidéo pro · 1 To de stockage · un seul outil pour tout filmer.</p>
              </div>
            </div>

            {/* Progression */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-extrabold text-[#f5f4ee]">{eur(raised)}</p>
                  <p className="text-[13px] text-[#f5f4ee]/60">collectés sur un objectif de <strong className="text-[#f5f4ee]/85">{eur(goal)}</strong></p>
                </div>
                <div className="flex items-center gap-1.5 text-[13px] text-[#f5f4ee]/60">
                  <Users className="h-4 w-4" /> {campaign?.donorCount ?? 0} don{(campaign?.donorCount ?? 0) > 1 ? 's' : ''}
                </div>
              </div>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#d97757] to-[#e8a184] transition-[width] duration-700"
                  style={{ width: `${Math.max(pct, 2)}%` }} />
              </div>
              <p className="mt-2 text-right text-[12px] font-semibold text-[#e8a184]">{pct}%</p>
            </div>

            {/* Pourquoi */}
            <div>
              <h2 className="text-xl font-bold">Pourquoi cette cagnotte ?</h2>
              <div className="mt-4 space-y-4">
                {[
                  { icon: Video, t: 'Chaque culte mérite d’être vu', d: 'Beaucoup ne peuvent pas être physiquement présents — la diaspora, les malades, ceux qui sont loin. Une belle captation porte le message jusqu’à eux.' },
                  { icon: Camera, t: 'La qualité change tout', d: 'Un téléphone de pointe filme en vidéo professionnelle, stabilisée, avec un son clair. La Parole mérite une image nette, pas une vidéo tremblante.' },
                  { icon: HardDrive, t: '1 To : rien à effacer', d: 'Un téraoctet de stockage, c’est des dizaines d’heures de cultes et d’enseignements conservés — un patrimoine qui reste.' },
                  { icon: Radio, t: 'Un seul outil, de bout en bout', d: 'Filmer, enregistrer, monter, diffuser en direct : tout tient dans l’appareil. Simple pour l’équipe, fiable pour la communauté.' },
                ].map(({ icon: Icon, t, d }) => (
                  <div key={t} className="flex gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d97757]/12 text-[#e8a184]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-[#f5f4ee]">{t}</p>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-[#f5f4ee]/65">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transparence */}
            <div className="rounded-2xl border border-[#d97757]/25 bg-[#d97757]/[0.06] p-5">
              <div className="flex items-center gap-2 text-[#e8a184]">
                <ShieldCheck className="h-5 w-5" />
                <p className="font-semibold">Transparence</p>
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#f5f4ee]/72">
                L’objectif couvre le <strong className="text-[#f5f4ee]">pack de captation complet</strong> —
                chaque euro va à ce matériel, rien d’autre :
              </p>
              <ul className="mt-3 space-y-1.5 text-[13px] text-[#f5f4ee]/72">
                {[
                  ['Samsung Galaxy S26 Ultra — 1 To', 'filmer en qualité pro, tout stocker'],
                  ['Coque renforcée magnétique', 'protéger l’appareil pendant les cultes'],
                  ['Chargeur 60W USB-C', 'filmer longtemps, sans coupure'],
                  ['Galaxy Buds4 Pro', 'son clair et suivi audio à l’enregistrement'],
                ].map(([t, d]) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e8a184]" />
                    <span><strong className="text-[#f5f4ee]/90">{t}</strong> — {d}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mur des donateurs (dons confirmés) */}
            <div>
              <h2 className="text-xl font-bold">Ils soutiennent le projet</h2>
              {isOwner && (
                <a href="/liri/crm?view=contacts" className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#e8a184] hover:underline">
                  Gérer les donateurs dans le CRM <ArrowRight className="h-3.5 w-3.5" />
                </a>
              )}
              {donors.length === 0 ? (
                <p className="mt-3 text-[13.5px] leading-relaxed text-[#f5f4ee]/60">
                  Soyez le premier à donner — votre nom apparaîtra ici (sauf si vous le laissez vide).
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {donors.map((d, i) => {
                    const inner = (
                      <>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d97757]/15 text-[13px] font-bold uppercase text-[#e8a184]">
                          {String(d.name || '?').trim().charAt(0) || '?'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate font-semibold text-[#f5f4ee]">{d.name || 'Anonyme'}</p>
                            <p className="shrink-0 text-[13px] font-bold text-[#e8a184]">{eur(d.amountCents)}</p>
                          </div>
                          {d.message ? (
                            <p className="mt-0.5 text-[12.5px] leading-snug text-[#f5f4ee]/60">« {d.message} »</p>
                          ) : null}
                        </div>
                      </>
                    );
                    // Owner connecté → carte cliquable vers le CRM (recherche par nom) ; public → carte simple.
                    return (
                      <li key={i}>
                        {isOwner ? (
                          <a
                            href={`/liri/crm?view=contacts&q=${encodeURIComponent(d.name || '')}`}
                            title="Ouvrir dans le CRM pour contacter ce donateur"
                            className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-[#d97757]/40 hover:bg-[#d97757]/[0.06]"
                          >
                            {inner}
                            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#e8a184] opacity-0 transition-opacity group-hover:opacity-100" />
                          </a>
                        ) : (
                          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                            {inner}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* ── Colonne droite : le DON ── (mobile : remontée en 1er, avant le « pourquoi ») */}
          <aside className="order-first lg:order-none lg:sticky lg:top-6">
            <div className="rounded-2xl border border-white/10 bg-[#2f2d2a] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <h2 className="text-lg font-bold">Faire un don</h2>

              {/* Région */}
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-black/20 p-1">
                {[
                  { id: 'eu', label: 'Europe', sub: 'Carte', icon: CreditCard },
                  { id: 'afrique', label: 'Afrique', sub: 'Mobile Money', icon: Smartphone },
                ].map(({ id, label, sub, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => { setRegion(id); setError(''); setAmountEur(id === 'eu' ? 50 : 2500); setCustomEur(''); }}
                    className={`flex flex-col items-center gap-0.5 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                      region === id ? 'bg-[#d97757] text-[#1c1a18]' : 'text-[#f5f4ee]/70 hover:bg-white/5'}`}>
                    <span className="flex items-center gap-1.5"><Icon className="h-4 w-4" /> {label}</span>
                    <span className={`text-[10px] font-medium ${region === id ? 'text-[#1c1a18]/70' : 'text-[#f5f4ee]/45'}`}>{sub}</span>
                  </button>
                ))}
              </div>

              {/* Montants */}
              <div className="mt-4">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">Montant</p>
                <div className="grid grid-cols-3 gap-2">
                  {presets.map((v) => (
                    <button key={v} type="button" onClick={() => { setAmountEur(v); setCustomEur(''); }}
                      className={`rounded-lg border py-2 text-[12.5px] font-bold transition-colors ${
                        customEur === '' && amountEur === v
                          ? 'border-[#d97757] bg-[#d97757]/15 text-[#e8a184]'
                          : 'border-white/10 text-[#f5f4ee]/75 hover:border-white/25'}`}>
                      {fmtMoney(v)}
                    </button>
                  ))}
                  <div className={`col-span-1 flex items-center rounded-lg border px-2 ${customEur !== '' ? 'border-[#d97757] bg-[#d97757]/10' : 'border-white/10'}`}>
                    <input type="number" min="1" inputMode="numeric" placeholder="Autre" value={customEur}
                      onChange={(e) => setCustomEur(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full min-w-0 bg-transparent py-2 text-[12.5px] font-bold text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/35" />
                    <span className="shrink-0 text-[12.5px] font-bold text-[#f5f4ee]/50">{region === 'eu' ? '€' : cur}</span>
                  </div>
                </div>
                {region === 'afrique' && validAmount && (
                  <p className="mt-2 text-[12px] text-[#f5f4ee]/55">soit ≈ <strong className="text-[#e8a184]">{eur(amountCents)}</strong> vers l’objectif</p>
                )}
              </div>

              {/* Afrique : pays + opérateur + numéro */}
              {region === 'afrique' && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">Pays</span>
                      <select value={country} onChange={(e) => setCountry(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-[#262624] px-2 py-2 text-sm text-[#f5f4ee] outline-none focus:border-[#d97757]">
                        {CFA_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">Opérateur</span>
                      <select value={provider} onChange={(e) => setProvider(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-[#262624] px-2 py-2 text-sm text-[#f5f4ee] outline-none focus:border-[#d97757]">
                        {providers.length === 0 && <option value="">—</option>}
                        {providers.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">Numéro Mobile Money</span>
                    <div className="flex items-stretch overflow-hidden rounded-lg border border-white/10 bg-[#262624] focus-within:border-[#d97757]">
                      <span className="flex shrink-0 select-none items-center border-r border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-[#f5f4ee]/75">+{selectedCountry.dial}</span>
                      <input type="tel" inputMode="numeric" placeholder="Ex : 6 12 34 56 78" value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9\s]/g, ''))}
                        className="w-full bg-transparent px-3 py-2 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/35" />
                    </div>
                    <span className="mt-1 block text-[11px] text-[#f5f4ee]/40">Entrez votre numéro local, sans l’indicatif (+{selectedCountry.dial} ajouté automatiquement).</span>
                  </label>
                </div>
              )}

              {/* Nom + message (optionnels) */}
              <div className="mt-3 space-y-2">
                <input type="text" placeholder="Votre nom (optionnel)" value={donorName} maxLength={80}
                  onChange={(e) => setDonorName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#262624] px-3 py-2 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/35 focus:border-[#d97757]" />
                <input type="email" inputMode="email" autoComplete="email" maxLength={200}
                  placeholder="Votre email — reçu + invitation à la séance de prière" value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#262624] px-3 py-2 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/35 focus:border-[#d97757]" />
              </div>

              {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>}

              {/* CTA */}
              <button type="button" disabled={busy || !validAmount}
                onClick={region === 'eu' ? payStripe : payPawapay}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] py-3.5 text-[15px] font-bold text-[#1c1a18] shadow-[0_10px_30px_rgba(217,119,87,0.3)] transition-all hover:bg-[#e08b6d] disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className="h-5 w-5" />}
                {busy ? 'Traitement…'
                  : region === 'eu'
                    ? `Donner ${validAmount ? eur(amountCents) : ''} par carte`
                    : `Donner ${validAmount ? `${mmAmount.toLocaleString('fr-FR')} ${cur}` : ''} par Mobile Money`}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </button>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#f5f4ee]/45">
                <ShieldCheck className="h-3.5 w-3.5" />
                Paiement sécurisé · {region === 'eu' ? 'Stripe (carte)' : 'pawaPay (Mobile Money)'}
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[12px] text-[#f5f4ee]/60">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#e8a184]" />
              Chaque don, même modeste, nous rapproche de l’objectif. Merci de porter ce projet avec nous.
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
