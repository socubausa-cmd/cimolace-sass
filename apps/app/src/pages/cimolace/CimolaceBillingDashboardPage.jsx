import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard, CheckCircle, Clock, FileText, RefreshCw, AlertCircle,
  Zap, Loader2, Building2, Boxes, Power, LayoutGrid, ArrowRight, ExternalLink,
  KeyRound, ShoppingBag, LifeBuoy, Settings, Plus, Trash2, Copy, Check, Send,
  Package, Users, Activity, UserCircle, ShieldAlert, Mail, XCircle,
  Webhook, ShieldCheck, LogOut, Image as ImageIcon, Printer, Globe, Lock, Sparkles, Smartphone, X,
} from 'lucide-react';
import { billingApi, tenantMembersApi, catalogApi, tenantApiKeysApi, tenantPortalApi, tenantsApi, mboloApi, teamInvitesApi } from '@/lib/api';
import { authStore } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';

const eur = (cents, cur = 'EUR') => {
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur }).format((Number(cents) || 0) / 100); }
  catch { return `${((Number(cents) || 0) / 100).toFixed(2)} ${cur}`; }
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

// ─── Marketplace : humanisation des features (3 formes réelles en DB :
// objet de limites {max_courses:10,…}, tableau de strings, booléens {medos:true}) ───
const FEATURE_FMT = {
  max_courses: (v) => (v === -1 ? 'Cours illimités' : `${v} cours`),
  max_students: (v) => (v === -1 ? 'Élèves illimités' : `${v} élèves`),
  liri_credits: (v) => (v === -1 ? 'Crédits LIRI illimités' : `${Number(v).toLocaleString('fr-FR')} crédits LIRI`),
  max_storage_gb: (v) => (v === -1 ? 'Stockage illimité' : `${v} Go de stockage`),
  max_lives_per_month: (v) => (v === -1 ? 'Lives illimités' : `${v} lives / mois`),
  white_label: (v) => (v ? 'Marque blanche' : null),
  medos: (v) => (v ? 'MEDOS — dossiers patients, RDV, téléconsultation' : null),
  mbolo: (v) => (v ? 'Mbolo — boutique e-commerce' : null),
  forfait: () => null,
};
// "liri_live,liri_replay course_builder" → ["LIRI Live", "Replay des lives", "Constructeur de cours"]
// (les clés de services arrivent souvent collées par des virgules SANS espace → on éclate + on humanise,
//  sinon la chaîne brute déborde hors de la carte car le navigateur ne peut pas la couper.)
function splitServices(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.flatMap(splitServices);
  return String(v).split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean).map(serviceName);
}
function humanizeFeatures(features) {
  if (!features) return [];
  if (Array.isArray(features)) return features.filter(Boolean).flatMap((x) => (typeof x === 'string' && /[,\s]/.test(x) ? splitServices(x) : [String(x)]));
  if (typeof features === 'string') return splitServices(features);
  if (typeof features === 'object') {
    return Object.entries(features).flatMap(([k, v]) => {
      if (k === 'services' || k === 'engines' || k === 'moteurs') return splitServices(v);
      const f = FEATURE_FMT[k];
      if (f) { const r = f(v); return r ? [r] : []; }
      if (typeof v === 'boolean') return v ? [k.replace(/_/g, ' ')] : [];
      return [`${k.replace(/_/g, ' ')} : ${v === -1 ? 'illimité' : v}`];
    });
  }
  return [];
}
// Indices de présentation par plan (badge / mise en avant / accroche). Clés inconnues → rendu nu.
const PLAN_HINTS = {
  starter: { tagline: 'Démarrer une école en ligne' },
  pro: { badge: 'Populaire', highlight: true, tagline: "Pour les écoles qui passent à l'échelle" },
  business: { tagline: 'Marque blanche & gros volumes' },
  medos_standard: { tagline: 'Cabinet médical clé en main' },
  'zahir-forfait': { badge: 'Tout-en-un', tagline: 'MEDOS + boutique Mbolo réunis' },
  // Grille LIRI (forfaits Cimolace pour le produit live LIRI) — voir ?upgrade=liri.
  liri_start: { tagline: 'Lancez vos lives sans limite' },
  liri_business: { badge: 'Recommandé', highlight: true, tagline: 'Pour les organisations qui grandissent' },
  liri_entreprise: { tagline: 'Puissance maximale, accompagnement dédié' },
};

const STATUS = {
  active: { label: 'Actif', cls: 'bg-green-500/20 border-green-500/30 text-green-400' },
  pending: { label: 'À payer', cls: 'bg-amber-500/20 border-amber-500/30 text-amber-400' },
  past_due: { label: 'En retard', cls: 'bg-orange-500/20 border-orange-500/30 text-orange-400' },
  canceled: { label: 'Annulé', cls: 'bg-white/10 border-white/20 text-white/50' },
  expired: { label: 'Expiré', cls: 'bg-red-500/20 border-red-500/30 text-red-400' },
  paused: { label: 'En pause', cls: 'bg-white/10 border-white/20 text-white/50' },
  paid: { label: 'Payé', cls: 'bg-green-500/20 border-green-500/30 text-green-400' },
  processing: { label: 'En cours', cls: 'bg-amber-500/20 border-amber-500/30 text-amber-400' },
  failed: { label: 'Échoué', cls: 'bg-red-500/20 border-red-500/30 text-red-400' },
};
const badge = (s) => STATUS[String(s)] || { label: String(s || '—'), cls: 'bg-white/10 border-white/20 text-white/60' };
const tslug = (t) => t?.slug || t?.tenant?.slug || '';
const tname = (t) => t?.name || t?.tenant?.name || tslug(t);

const SERVICE_LABELS = {
  med_ehr: 'MEDOS — Dossiers patients', med_notes: 'MEDOS — Notes SOAP', med_health: 'MEDOS — Journal de santé',
  med_forms: 'MEDOS — Formulaires', med_programs: 'MEDOS — Programmes de soins', wellness_engine: 'Wellness Engine',
  mbolo: 'Mbolo — Boutique e-commerce', mbolo_storefront: 'Mbolo — Storefront', twin: 'Bio Digital Twin',
  liri_live: 'Lives illimités', liri_smartboard: 'SmartBoard IA', school_engine: 'Moteur École',
  liri_replay: 'Replay des lives', studio_creator: 'Studio créateur', liri_brain: 'LIRI Brain — copilote IA',
  liri_masterclass: 'Masterclass', liri_neuro_recall: 'Neuro-Recall', course_builder: 'Constructeur de cours',
  forum: 'Forum communautaire', chat: 'Messagerie', calendar: 'Calendrier', notif: 'Notifications',
};
const serviceName = (k) => SERVICE_LABELS[k] || String(k || '').replace(/_/g, ' ');

const TABS = [
  { id: 'apercu', label: "Vue d'ensemble", icon: LayoutGrid },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'abonnement', label: 'Abonnement', icon: CreditCard },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  { id: 'factures', label: 'Factures', icon: FileText },
  { id: 'moteurs', label: 'Moteurs', icon: Boxes },
  { id: 'produits', label: 'Produits', icon: Package },
  { id: 'equipe', label: 'Équipe', icon: Users },
  { id: 'cles', label: 'API & clés', icon: KeyRound },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'profil', label: 'Profil', icon: UserCircle },
  { id: 'parametres', label: 'Paramètres', icon: Settings },
  { id: 'compte', label: 'Compte', icon: ShieldAlert },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
];

// Regroupement des sections dans la sidebar (style SaaS).
const NAV_GROUPS = [
  { label: 'Tableau de bord', ids: ['apercu', 'monitoring'] },
  { label: 'Facturation', ids: ['abonnement', 'marketplace', 'factures'] },
  { label: 'Services', ids: ['moteurs', 'produits'] },
  { label: 'Organisation', ids: ['equipe', 'support'] },
  { label: 'Développeurs', ids: ['cles', 'webhooks'] },
  { label: 'Mon compte', ids: ['profil', 'parametres', 'compte'] },
];

// Familles de moteurs → produit Cimolace + lien d'accès.
const ENGINE_FAMILIES = [
  { key: 'med', label: 'MEDOS', desc: 'Dossiers patients, notes SOAP, prescriptions, téléconsultation.', match: (k) => k.startsWith('med_') || k === 'twin' || k === 'wellness_engine' },
  { key: 'mbolo', label: 'Mbolo', desc: 'Boutique e-commerce : catalogue, panier, commandes, paiements.', match: (k) => k.startsWith('mbolo') || k === 'pay_engine' || k === 'cinetpay' },
  { key: 'school', label: 'École / LIRI', desc: 'Cours, live, smartboard, replay, communauté.', match: (k) => k.startsWith('liri') || k.startsWith('school') || ['calendar', 'course_builder', 'marketing_creator', 'chat_engine', 'notif_engine'].includes(k) },
  { key: 'infra', label: 'Infrastructure', desc: 'SMS, RGPD, services transverses.', match: (k) => ['sms_engine', 'gdpr_engine'].includes(k) },
];
const familyOf = (k) => ENGINE_FAMILIES.find((f) => f.match(String(k || '')))?.label || 'Autre';

// Pays Mobile Money (PawaPay) — Afrique. Indicatif utilisé pour préfixer le numéro E.164.
const MM_COUNTRIES = [
  { code: 'CMR', name: 'Cameroun', dial: '+237' },
  { code: 'CIV', name: "Côte d'Ivoire", dial: '+225' },
  { code: 'SEN', name: 'Sénégal', dial: '+221' },
  { code: 'GAB', name: 'Gabon', dial: '+241' },
  { code: 'BEN', name: 'Bénin', dial: '+229' },
  { code: 'TGO', name: 'Togo', dial: '+228' },
  { code: 'BFA', name: 'Burkina Faso', dial: '+226' },
  { code: 'COD', name: 'RD Congo', dial: '+243' },
  { code: 'GHA', name: 'Ghana', dial: '+233' },
];
// Opérateurs de secours (codes PawaPay standard) si l'active-conf ne renvoie rien.
const MM_FALLBACK_PROVIDERS = {
  CMR: [{ provider: 'MTN_MOMO_CMR', displayName: 'MTN MoMo' }, { provider: 'ORANGE_CMR', displayName: 'Orange Money' }],
  CIV: [{ provider: 'MTN_MOMO_CIV', displayName: 'MTN MoMo' }, { provider: 'ORANGE_CIV', displayName: 'Orange Money' }, { provider: 'MOOV_CIV', displayName: 'Moov Money' }, { provider: 'WAVE_CIV', displayName: 'Wave' }],
  SEN: [{ provider: 'ORANGE_SEN', displayName: 'Orange Money' }, { provider: 'FREE_SEN', displayName: 'Free Money' }, { provider: 'WAVE_SEN', displayName: 'Wave' }],
  GAB: [{ provider: 'AIRTEL_GAB', displayName: 'Airtel Money' }, { provider: 'MOOV_GAB', displayName: 'Moov Money' }],
  BEN: [{ provider: 'MTN_MOMO_BEN', displayName: 'MTN MoMo' }, { provider: 'MOOV_BEN', displayName: 'Moov Money' }],
  TGO: [{ provider: 'TOGOCOM_TGO', displayName: 'Togocom T-Money' }, { provider: 'MOOV_TGO', displayName: 'Moov Money' }],
  BFA: [{ provider: 'ORANGE_BFA', displayName: 'Orange Money' }, { provider: 'MOOV_BFA', displayName: 'Moov Money' }],
  COD: [{ provider: 'ORANGE_COD', displayName: 'Orange Money' }, { provider: 'AIRTEL_COD', displayName: 'Airtel Money' }, { provider: 'VODACOM_MPESA_COD', displayName: 'M-Pesa (Vodacom)' }],
  GHA: [{ provider: 'MTN_MOMO_GHA', displayName: 'MTN MoMo' }, { provider: 'VODAFONE_GHA', displayName: 'Telecel Cash' }, { provider: 'AIRTELTIGO_GHA', displayName: 'AirtelTigo' }],
};
const mmProviderCode = (p) => (typeof p === 'string' ? p : (p?.provider || p?.code || p?.correspondent || p?.id || ''));
const mmProviderName = (p) => (typeof p === 'string' ? p : (p?.name || p?.displayName || p?.label || mmProviderCode(p)));

// Modal de paiement Mobile Money (PawaPay) pour un forfait LIRI : pays -> opérateur ->
// téléphone -> subscribe(provider='pawapay') (facture en XAF) -> collect -> push USSD.
function MobileMoneyModal({ plan, onClose, onPaid }) {
  const [country, setCountry] = useState('CMR');
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState('');
  const [dial, setDial] = useState('+237');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [payStatus, setPayStatus] = useState(null); // null | 'waiting' | 'activated' | 'failed'

  // Compte PawaPay partagé (pas de webhook cimolace) → on interroge nous-mêmes le
  // statut du dépôt après « Demande envoyée », jusqu'à activation (COMPLETED) ou échec.
  useEffect(() => {
    if (!result) return undefined;
    setPayStatus('waiting');
    let tries = 0;
    const id = setInterval(async () => {
      tries += 1;
      try {
        const s = await billingApi.syncMobileMoney();
        if (s?.activated) { setPayStatus('activated'); clearInterval(id); onPaid?.(); return; }
        if (s?.failed) { setPayStatus('failed'); clearInterval(id); return; }
      } catch { /* réseau : on retente au tick suivant */ }
      if (tries >= 45) clearInterval(id); // ~3 min max
    }, 4000);
    return () => clearInterval(id);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setProviders([]); setProvider('');
    setDial((MM_COUNTRIES.find((x) => x.code === country) || {}).dial || '+237');
    const applyList = (list) => {
      const arr = (Array.isArray(list) && list.length) ? list : (MM_FALLBACK_PROVIDERS[country] || []);
      setProviders(arr); setProvider(mmProviderCode(arr[0]) || '');
    };
    billingApi.pawapayProviders(country)
      .then((list) => { if (!cancelled) applyList(list); })
      .catch(() => { if (!cancelled) applyList([]); });
    return () => { cancelled = true; };
  }, [country]);

  const pay = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const digits = phone.replace(/[^0-9]/g, '');
      const phoneNumber = phone.trim().startsWith('+') ? phone.replace(/\s/g, '') : `${dial}${digits.replace(/^0+/, '')}`;
      if (!provider) throw new Error('Choisis un opérateur mobile money.');
      if (digits.length < 6) throw new Error('Numéro de téléphone invalide.');
      const sub = await billingApi.subscribe(plan.key, 'pawapay');
      const r = await billingApi.collect(sub.subscription_id, { phoneNumber, provider, country });
      setResult({ ...r, phoneNumber });
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Échec de la collecte mobile money.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#1b1712] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-[#e6b878]" /><h3 className="font-bold text-white">Payer en Mobile Money</h3></div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:bg-white/10 hover:text-white/70"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-white/50 mb-4">{plan?.label} — Orange Money · MTN MoMo · Moov… (Afrique).</p>
        {result ? (
          <div className="rounded-xl border border-[#e6b878]/30 bg-[#e6b878]/[0.08] p-4 text-sm text-white/80">
            {payStatus === 'activated' ? (
              <>
                <div className="flex items-center gap-2 font-semibold text-[#d97757] mb-1.5"><Check className="w-4 h-4" /> Paiement confirmé</div>
                <p>Ton abonnement <strong>{plan?.label}</strong> est désormais <strong>activé</strong>. Merci ! 🎉</p>
              </>
            ) : payStatus === 'failed' ? (
              <>
                <div className="flex items-center gap-2 font-semibold text-red-300 mb-1.5"><AlertCircle className="w-4 h-4" /> Paiement non abouti</div>
                <p>Le paiement a été refusé ou annulé sur le téléphone. Ferme cette fenêtre et réessaie.</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 font-semibold text-[#e6b878] mb-1.5"><Check className="w-4 h-4" /> Demande envoyée</div>
                <p>📲 Une demande de <strong>{result.currency} {result.amount}</strong> a été poussée sur <strong>{result.phoneNumber}</strong>. Compose ton code Mobile Money sur ton téléphone pour valider.</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-white/60"><Loader2 className="w-3.5 h-3.5 animate-spin" /> En attente de ta validation sur le téléphone…</div>
              </>
            )}
            <button onClick={onClose} className="mt-3 w-full px-4 py-2 rounded-lg border border-white/[0.12] text-white/70 text-sm hover:bg-white/[0.06]">Fermer</button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] text-white/50">Pays</span>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white">
                {MM_COUNTRIES.map((c) => <option key={c.code} value={c.code} className="bg-[#1b1712]">{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-white/50">Opérateur</span>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={!providers.length} className="mt-1 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white disabled:opacity-50">
                {!providers.length && <option value="" className="bg-[#1b1712]">— chargement… —</option>}
                {providers.map((p, i) => <option key={i} value={mmProviderCode(p)} className="bg-[#1b1712]">{mmProviderName(p)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-white/50">Numéro Mobile Money</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-2 text-sm text-white/60 shrink-0">{dial}</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6XX XX XX XX" inputMode="tel" className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/30" />
              </div>
            </label>
            {error && <p className="text-xs text-red-300 flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}</p>}
            <button onClick={pay} disabled={busy} className="w-full mt-1 px-4 py-2.5 rounded-xl bg-[#d97757] text-white font-bold text-sm hover:bg-[#c9673f] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />} Envoyer le paiement
            </button>
            <p className="text-[10px] text-white/35 text-center">Tu recevras une demande de validation sur ton téléphone.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CimolaceBillingDashboardPage() {
  const [tenants, setTenants] = useState([]);
  const [activeSlug, setActiveSlug] = useState('');
  const [tab, setTab] = useState('apercu');
  const [subs, setSubs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [params, setParams] = useSearchParams();
  // Onglets API & clés / Marketplace / Support / Paramètres
  const [keys, setKeys] = useState([]);
  const [market, setMarket] = useState([]);
  const [mktCycle, setMktCycle] = useState('monthly'); // 'monthly' | 'yearly' (annuel = ancrage + demande, pas de prix annuel en DB)
  const [showAllPlans, setShowAllPlans] = useState(false); // ?upgrade=liri → grille LIRI seule, ce flag révèle tous les forfaits
  const [tickets, setTickets] = useState([]);
  const [busy, setBusy] = useState(null);
  const [mmPlan, setMmPlan] = useState(null); // forfait pour lequel le modal Mobile Money (PawaPay) est ouvert
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [keyLabel, setKeyLabel] = useState('');
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '' });
  const [brandForm, setBrandForm] = useState({ name: '', logo_url: '', primary_domain: '', primary: '' });
  // Monitoring / Produits / Équipe / Profil / Compte
  const [usage, setUsage] = useState(null);
  const [profile, setProfile] = useState(null);
  const [members, setMembers] = useState([]);
  const [products, setProducts] = useState([]);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' });
  const [prodForm, setProdForm] = useState({ name: '', priceEur: '' });
  const [pwd, setPwd] = useState('');
  const [delConfirm, setDelConfirm] = useState('');
  // Webhooks / 2FA / images produit
  const [webhooks, setWebhooks] = useState([]);
  const [whForm, setWhForm] = useState({ label: '', url: '' });
  const [whSecret, setWhSecret] = useState(null);
  const [mfa, setMfa] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [imgForm, setImgForm] = useState({});

  const loadAll = useCallback(async (slug) => {
    setLoading(true); setError(null);
    try {
      if (slug && authStore.setTenantSlug) authStore.setTenantSlug(slug);
      const arr = (x) => (Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : []);
      const [plan, svc, ks, mk, tk, us, pr, mb, pd, wh] = await Promise.all([
        billingApi.getPlan().catch(() => ({ subscriptions: [], invoices: [] })),
        catalogApi.tenantServices().catch(() => []),
        tenantApiKeysApi.list().catch(() => []),
        tenantPortalApi.marketplace().catch(() => []),
        tenantPortalApi.tickets().catch(() => []),
        tenantPortalApi.usage().catch(() => null),
        tenantPortalApi.profile().catch(() => null),
        tenantMembersApi.listMembers().catch(() => []),
        mboloApi.listProducts().catch(() => []),
        tenantPortalApi.webhooks().catch(() => []),
      ]);
      setSubs(Array.isArray(plan?.subscriptions) ? plan.subscriptions : []);
      setInvoices(Array.isArray(plan?.invoices) ? plan.invoices : []);
      setServices(Array.isArray(svc) ? svc : []);
      setKeys(arr(ks));
      setMarket(arr(mk));
      setTickets(arr(tk));
      setUsage(us && us.data ? us.data : us);
      setProfile(pr && pr.data ? pr.data : pr);
      setMembers(arr(mb));
      setProducts(arr(pd));
      setWebhooks(arr(wh));
    } catch (e) {
      setError(e?.message || 'Chargement impossible');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      const mine = await tenantMembersApi.getMyTenants().catch(() => []);
      const list = (Array.isArray(mine) ? mine : []).map((t) => ({ slug: tslug(t), name: tname(t) })).filter((t) => t.slug);
      setTenants(list);
      const stored = authStore.getTenantSlug ? authStore.getTenantSlug() : '';
      const initial = list.find((t) => t.slug === stored)?.slug || list[0]?.slug || stored || '';
      setActiveSlug(initial);

      const card = params.get('card'); const subId = params.get('sub');
      // Deep-link : ouvrir directement la marketplace (CTA catalogue / gate ?upgrade=liri).
      const wantTab = params.get('tab'); const upgrade = params.get('upgrade');
      if (upgrade) setTab('marketplace');
      else if (wantTab && TABS.some((t) => t.id === wantTab)) setTab(wantTab);
      const clean = () => { ['card', 'sub', 'session_id'].forEach((k) => params.delete(k)); setParams(params, { replace: true }); };
      if (card === 'success' && subId) {
        try { if (initial && authStore.setTenantSlug) authStore.setTenantSlug(initial); const r = await billingApi.cardConfirm(subId); setNotice(r?.paid ? '✅ Paiement confirmé — votre forfait est actif.' : 'Paiement reçu, confirmation en cours…'); }
        catch { setNotice('Paiement reçu, confirmation en cours…'); }
        clean();
      } else if (card === 'cancel') { setNotice('Paiement annulé.'); clean(); }
      await loadAll(initial);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTenant = (slug) => { setActiveSlug(slug); setNotice(null); loadAll(slug); };

  const pay = async (sub) => {
    setPayingId(sub.id); setError(null);
    try {
      if (activeSlug && authStore.setTenantSlug) authStore.setTenantSlug(activeSlug);
      const { url } = await billingApi.cardCheckout(sub.id);
      if (url) window.location.href = url; else throw new Error('Lien de paiement indisponible');
    } catch (e) { setError(e?.message || 'Impossible de démarrer le paiement'); setPayingId(null); }
  };

  const withSlug = () => { if (activeSlug && authStore.setTenantSlug) authStore.setTenantSlug(activeSlug); };

  const createKey = async () => {
    if (!keyLabel.trim()) return;
    setBusy('new-key'); setError(null); setNewKey(null);
    try {
      withSlug();
      const r = await tenantApiKeysApi.create(keyLabel.trim());
      setNewKey(r?.key || r?.api_key || null);
      setKeyLabel('');
      setKeys(await tenantApiKeysApi.list().catch(() => keys));
    } catch (e) { setError(e?.message || 'Création de clé impossible (rôle owner requis ?)'); }
    finally { setBusy(null); }
  };
  const revokeKey = async (id) => {
    setBusy(`rev-${id}`); setError(null);
    try { withSlug(); await tenantApiKeysApi.revoke(id); setKeys((k) => k.filter((x) => x.id !== id)); }
    catch (e) { setError(e?.message || 'Révocation impossible'); }
    finally { setBusy(null); }
  };
  const subscribe = async (planKey) => {
    setBusy(`sub-${planKey}`); setError(null);
    try {
      withSlug();
      const sub = await tenantPortalApi.subscribe(planKey);
      const { url } = await billingApi.cardCheckout(sub.id);
      if (url) { window.location.href = url; return; }
      setNotice('Abonnement créé — payez-le dans l’onglet Abonnement.'); await loadAll(activeSlug); setTab('abonnement');
    } catch (e) { setError(e?.message || 'Souscription impossible'); }
    finally { setBusy(null); }
  };
  // Annuel non câblé en DB (plans monthly only) → on enregistre une demande via ticket plutôt qu'un checkout factice.
  const requestAnnual = async (plan) => {
    setBusy(`annual-${plan.key}`); setError(null);
    try {
      withSlug();
      await tenantPortalApi.createTicket({
        subject: `Facturation annuelle — ${plan.label || plan.key}`,
        description: `Le tenant souhaite la facturation annuelle du plan « ${plan.label || plan.key} » (2 mois offerts). Merci de générer le devis / lien de paiement annuel.`,
      });
      setNotice('Demande envoyée — l’équipe Cimolace vous contacte pour la facturation annuelle.');
    } catch (e) { setError(e?.message || 'Demande impossible'); }
    finally { setBusy(null); }
  };
  const submitTicket = async () => {
    if (!ticketForm.subject.trim()) return;
    setBusy('ticket'); setError(null);
    try { withSlug(); await tenantPortalApi.createTicket(ticketForm); setTicketForm({ subject: '', description: '' }); setTickets(await tenantPortalApi.tickets().catch(() => tickets)); setNotice('Ticket envoyé à l’équipe Cimolace.'); }
    catch (e) { setError(e?.message || 'Envoi du ticket impossible'); }
    finally { setBusy(null); }
  };
  const saveBranding = async () => {
    setBusy('brand'); setError(null);
    try {
      withSlug();
      await tenantsApi.updateBranding({
        name: brandForm.name || undefined,
        logo_url: brandForm.logo_url || undefined,
        primary_domain: brandForm.primary_domain || undefined,
        brand_colors: brandForm.primary ? { primary: brandForm.primary } : undefined,
      });
      setNotice('Paramètres enregistrés.');
    } catch (e) { setError(e?.message || 'Enregistrement impossible (rôle owner requis ?)'); }
    finally { setBusy(null); }
  };
  const copyKey = () => { if (newKey && navigator.clipboard) { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  const keyFamily = (p) => { const s = String(p || ''); return s.startsWith('mdk_') ? 'MEDOS' : s.startsWith('mbk_') ? 'Mbolo' : s.startsWith('cml_') ? 'Cimolace' : 'Tenant'; };
  const arr = (x) => (Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : []);

  const createProduct = async () => {
    if (!prodForm.name.trim()) return;
    setBusy('new-prod'); setError(null);
    try {
      withSlug();
      await mboloApi.createProduct({ name: prodForm.name.trim(), price_cents: Math.round((parseFloat(prodForm.priceEur) || 0) * 100), currency: 'EUR' });
      setProdForm({ name: '', priceEur: '' });
      setProducts(arr(await mboloApi.listProducts().catch(() => products)));
      setNotice('Produit ajouté à votre boutique Mbolo.');
    } catch (e) { setError(e?.message || "Création produit impossible (boutique Mbolo activée ?)"); }
    finally { setBusy(null); }
  };
  const invite = async () => {
    if (!inviteForm.email.trim()) return;
    setBusy('invite'); setError(null);
    try {
      withSlug();
      await tenantMembersApi.inviteMember(inviteForm.email.trim(), inviteForm.role);
      setInviteForm({ email: '', role: 'member' });
      setMembers(arr(await tenantMembersApi.listMembers().catch(() => members)));
      setNotice('Invitation envoyée.');
    } catch (e) { setError(e?.message || 'Invitation impossible (rôle owner/admin requis ?)'); }
    finally { setBusy(null); }
  };
  const kickMember = async (uid) => {
    setBusy(`rm-${uid}`); setError(null);
    try { withSlug(); await tenantMembersApi.removeMember(uid); setMembers((m) => m.filter((x) => (x.user_id || x.id) !== uid)); }
    catch (e) { setError(e?.message || 'Retrait impossible'); }
    finally { setBusy(null); }
  };
  const changePassword = async () => {
    if ((pwd || '').length < 8) { setError('Mot de passe : 8 caractères minimum.'); return; }
    setBusy('pwd'); setError(null);
    try { const { error: e } = await supabase.auth.updateUser({ password: pwd }); if (e) throw e; setPwd(''); setNotice('Mot de passe mis à jour.'); }
    catch (e) { setError(e?.message || 'Changement de mot de passe impossible'); }
    finally { setBusy(null); }
  };
  const deleteAccount = async () => {
    setBusy('del'); setError(null);
    try { withSlug(); await tenantPortalApi.requestDeletion('Demande depuis le portail tenant'); setDelConfirm(''); setNotice('Demande de suppression enregistrée — notre équipe vous recontacte sous 48 h.'); }
    catch (e) { setError(e?.message || 'Demande impossible (seul le owner peut supprimer le compte)'); }
    finally { setBusy(null); }
  };
  const cancelSub = async (id) => {
    setBusy(`cancel-${id}`); setError(null);
    try { withSlug(); await tenantPortalApi.cancelSubscription(id); await loadAll(activeSlug); setNotice('Abonnement annulé.'); }
    catch (e) { setError(e?.message || 'Annulation impossible'); }
    finally { setBusy(null); }
  };
  const openBillingPortal = async () => {
    setBusy('portal'); setError(null);
    try { withSlug(); const r = await tenantPortalApi.billingPortal(); if (r?.url) { window.location.href = r.url; return; } throw new Error('Portail indisponible'); }
    catch (e) { setError(e?.message || 'Portail de facturation indisponible (paiement carte réel requis).'); setBusy(null); }
  };
  const createWh = async () => {
    if (!whForm.url.trim()) return;
    setBusy('new-wh'); setError(null); setWhSecret(null);
    try { withSlug(); const r = await tenantPortalApi.createWebhook({ label: whForm.label || 'Webhook', url: whForm.url.trim() }); setWhSecret(r?.secret || null); setWhForm({ label: '', url: '' }); setWebhooks(arr(await tenantPortalApi.webhooks().catch(() => webhooks))); }
    catch (e) { setError(e?.message || 'Création webhook impossible (URL HTTPS + rôle owner/admin)'); }
    finally { setBusy(null); }
  };
  const delWh = async (id) => {
    setBusy(`wh-${id}`); setError(null);
    try { withSlug(); await tenantPortalApi.deleteWebhook(id); setWebhooks((w) => w.filter((x) => x.id !== id)); }
    catch (e) { setError(e?.message || 'Suppression impossible'); }
    finally { setBusy(null); }
  };
  const toggleWh = async (w) => {
    setBusy(`wht-${w.id}`); setError(null);
    try { withSlug(); await tenantPortalApi.toggleWebhook(w.id, !w.is_active); setWebhooks((list) => list.map((x) => (x.id === w.id ? { ...x, is_active: !w.is_active } : x))); }
    catch (e) { setError(e?.message || 'Mise à jour impossible'); }
    finally { setBusy(null); }
  };
  const enroll2FA = async () => {
    setBusy('mfa'); setError(null);
    try { const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: 'totp' }); if (e) throw e; setMfa({ id: data.id, qr: data.totp?.qr_code, secret: data.totp?.secret }); }
    catch (e) { setError(e?.message || '2FA indisponible sur ce compte'); }
    finally { setBusy(null); }
  };
  const verify2FA = async () => {
    if (!mfa?.id || (mfaCode || '').length < 6) return;
    setBusy('mfa-v'); setError(null);
    try {
      const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId: mfa.id }); if (e1) throw e1;
      const { error: e2 } = await supabase.auth.mfa.verify({ factorId: mfa.id, challengeId: ch.id, code: mfaCode }); if (e2) throw e2;
      setMfa(null); setMfaCode(''); setNotice('Authentification à deux facteurs activée.');
    } catch (e) { setError(e?.message || 'Code 2FA invalide'); }
    finally { setBusy(null); }
  };
  const signOutEverywhere = async () => {
    setBusy('signout'); setError(null);
    try { await supabase.auth.signOut({ scope: 'global' }); window.location.href = '/cimolace/login'; }
    catch (e) { setError(e?.message || 'Déconnexion impossible'); setBusy(null); }
  };
  const addImage = async (productId) => {
    const url = String(imgForm[productId] || '').trim(); if (!url) return;
    setBusy(`img-${productId}`); setError(null);
    try { withSlug(); await mboloApi.addImage(productId, { url, isPrimary: true }); setImgForm((f) => ({ ...f, [productId]: '' })); setProducts(arr(await mboloApi.listProducts().catch(() => products))); setNotice('Image ajoutée au produit.'); }
    catch (e) { setError(e?.message || 'Ajout image impossible'); }
    finally { setBusy(null); }
  };
  const emailInvite = async () => {
    if (!inviteForm.email.trim()) return;
    setBusy('invite'); setError(null);
    try { withSlug(); await teamInvitesApi.send(inviteForm.email.trim(), inviteForm.role); setInviteForm({ email: '', role: 'member' }); setMembers(arr(await tenantMembersApi.listMembers().catch(() => members))); setNotice('Invitation envoyée par email.'); }
    catch (e) { setError(e?.message || 'Invitation impossible (rôle/permission)'); }
    finally { setBusy(null); }
  };
  const printReceipt = (inv) => {
    const w = window.open('', '_blank', 'width=620,height=760');
    if (!w) { setError('Autorisez les pop-ups pour imprimer le reçu.'); return; }
    const rows = [
      ['Facture', inv.invoice_number || inv.id],
      ['Montant', eur(inv.amount_cents, inv.currency)],
      ['Statut', badge(inv.status).label],
      [inv.paid_at ? 'Payée le' : 'Échéance', fmtDate(inv.paid_at || inv.due_date)],
    ].map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right">${v}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reçu ${inv.invoice_number || inv.id}</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:44px;color:#111}h1{font-size:20px;margin:0}.muted{color:#888;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:22px;font-size:14px}td{padding:9px 0;border-bottom:1px solid #eee}</style></head><body><h1>CIMOLACE — Reçu</h1><div class="muted">${activeName} · ${activeSlug || ''}</div><table>${rows}</table><p class="muted" style="margin-top:28px">Merci pour votre confiance — Cimolace, infrastructure SaaS.</p></body></html>`);
    w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch { /* noop */ } }, 350);
  };

  const planName = (s) => s?.metadata?.label || s?.plan_id || 'Abonnement';
  const activeName = tenants.find((t) => t.slug === activeSlug)?.name || activeSlug || '—';
  // ?upgrade=liri → focaliser le marketplace sur la GRILLE LIRI (sinon 16 plans
  // mélangés école/medos/mentorat). showAllPlans révèle le catalogue complet.
  const isLiriUpgrade = params.get('upgrade') === 'liri';
  const liriPlans = market.filter((p) => String(p.key || '').startsWith('liri_'));
  const showLiriGrille = isLiriUpgrade && liriPlans.length > 0 && !showAllPlans;
  const displayMarket = showLiriGrille ? liriPlans : market;
  const activeSubs = subs.filter((s) => s.status === 'active');
  const primarySub = activeSubs[0] || subs.find((s) => s.status === 'pending') || subs[0] || null;
  const activeServices = services.filter((sv) => sv.active === true || sv.status === 'active');
  const nextInvoice = invoices.filter((i) => i.status !== 'paid')
    .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))[0] || null;
  const paidCount = invoices.filter((i) => i.status === 'paid').length;
  const familyCounts = ENGINE_FAMILIES
    .map((f) => ({ ...f, count: activeServices.filter((sv) => f.match(String(sv.service_key || ''))).length }))
    .filter((f) => f.count > 0);

  return (
    <>
      <Helmet><title>Espace {activeName} | CIMOLACE</title></Helmet>
      <div className="min-h-screen bg-[#08080c] text-white flex">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-white/[0.06] bg-[#0b0b11] sticky top-0 h-screen self-start flex flex-col">
          <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
            <Link to="/cimolace" className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#d97757] to-[#e6b878] flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-sm font-black tracking-tight">CIMOLACE</span>
            </Link>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#e0926a]/70 flex items-center gap-1"><Building2 className="w-3 h-3" /> Espace tenant</div>
            <div className="text-base font-bold truncate mt-0.5">{activeName}</div>
            {tenants.length > 1 && (
              <select value={activeSlug} onChange={(e) => switchTenant(e.target.value)} className="mt-2 w-full bg-black/30 border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs text-white/80">
                {tenants.map((t) => <option key={t.slug} value={t.slug} className="bg-[#0b0b11]">{t.name}</option>)}
              </select>
            )}
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {NAV_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="px-2 mb-1 text-[10px] uppercase tracking-wide text-white/30">{g.label}</div>
                {g.ids.map((id) => {
                  const t = TABS.find((x) => x.id === id); if (!t) return null;
                  const Icon = t.icon; const danger = id === 'compte';
                  return (
                    <button key={id} onClick={() => setTab(id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm mb-0.5 transition ${tab === id ? 'bg-[#d97757]/20 text-white' : danger ? 'text-red-300/70 hover:bg-red-500/10' : 'text-white/55 hover:bg-white/[0.05] hover:text-white'}`}>
                      <Icon className="w-4 h-4 shrink-0" /> <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="px-4 py-3 border-t border-white/[0.06] text-[11px] text-white/30 truncate">{profile?.email || 'Espace tenant'}</div>
        </aside>

        {/* Contenu */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-6 lg:px-8 py-4 border-b border-white/[0.06] bg-[#08080c]/90 backdrop-blur-xl">
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">{TABS.find((t) => t.id === tab)?.label || 'Espace'}</h1>
              <p className="text-xs text-white/40 truncate">{activeName} · {activeSlug || '—'}</p>
            </div>
            <button onClick={() => loadAll(activeSlug)} className="shrink-0 text-xs text-white/50 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] hover:bg-white/[0.04]"><RefreshCw className="w-3.5 h-3.5" /> Rafraîchir</button>
          </header>
          <main className="px-6 lg:px-8 py-6 w-full max-w-5xl">

            {notice && <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {notice}</div>}
            {error && <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

            {primarySub && (primarySub.status === 'past_due' || primarySub.status === 'pending') && tab !== 'abonnement' && (
              <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/[0.12] px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2 text-sm text-amber-100">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span><strong>Paiement en attente</strong> pour « {planName(primarySub)} ». Réactivez pour éviter la coupure de vos moteurs et de votre API.</span>
                </div>
                <button onClick={() => pay(primarySub)} disabled={payingId === primarySub.id} className="shrink-0 px-4 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 flex items-center gap-1.5 disabled:opacity-50">
                  {payingId === primarySub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Réactiver
                </button>
              </div>
            )}

            {!activeSubs.length && primarySub && ['expired', 'canceled', 'paused'].includes(primarySub.status) && tab !== 'marketplace' && (
              <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/[0.12] px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2 text-sm text-red-100">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span><strong>Forfait {badge(primarySub.status).label.toLowerCase()}</strong> — vos moteurs sont en pause et vos clés API renvoient <code className="text-red-200">402 subscription_inactive</code> aux intégrations.</span>
                </div>
                <button onClick={() => setTab('marketplace')} className="shrink-0 px-4 py-2 rounded-lg bg-[#d97757] text-white font-bold text-sm hover:shadow-lg flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4" /> Choisir un forfait
                </button>
              </div>
            )}

            {loading ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 flex items-center gap-2 text-white/60"><RefreshCw className="w-4 h-4 animate-spin" /> Chargement…</div>
            ) : (
              <>
                {/* VUE D'ENSEMBLE */}
                {tab === 'apercu' && (
                  <div className="space-y-6">
                    {primarySub ? (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#d97757]/10 to-[#e6b878]/[0.04] p-6">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-[#e0926a]/80 mb-1">Votre abonnement</div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-2xl font-black capitalize">{planName(primarySub)}</span>
                              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${badge(primarySub.status).cls}`}>{badge(primarySub.status).label}</span>
                            </div>
                            <div className="text-sm text-white/60">{eur(primarySub.amount_cents, primarySub.currency)} / mois{primarySub.current_period_end ? ` · échéance ${fmtDate(primarySub.current_period_end)}` : ''}</div>
                          </div>
                          {(primarySub.status === 'pending' || primarySub.status === 'past_due') ? (
                            <button onClick={() => pay(primarySub)} disabled={payingId === primarySub.id} className="px-5 py-3 bg-[#d97757] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#d97757]/25 flex items-center gap-2 disabled:opacity-60">
                              {payingId === primarySub.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />} Payer par carte
                            </button>
                          ) : primarySub.status === 'active' ? <span className="flex items-center gap-1 text-green-400 text-sm font-medium"><CheckCircle className="w-4 h-4" /> Forfait actif</span> : null}
                        </div>
                      </motion.div>
                    ) : <Empty>Aucun abonnement pour cet espace. Souscrivez un service Cimolace pour démarrer.</Empty>}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <StatCard label="Moteurs actifs" value={`${activeServices.length}`} sub={`${services.length} déclaré(s)`} />
                      <StatCard label="Statut" value={primarySub?.status === 'active' ? 'Actif' : (primarySub ? badge(primarySub.status).label : '—')} sub="abonnement" />
                      <StatCard label="Prochaine facture" value={nextInvoice ? eur(nextInvoice.amount_cents, nextInvoice.currency) : '—'} sub={nextInvoice ? `échéance ${fmtDate(nextInvoice.due_date)}` : 'à jour'} />
                      <StatCard label="Factures payées" value={`${paidCount}`} sub="historique" />
                    </div>

                    {familyCounts.length > 0 && (
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold mb-3">Vos produits Cimolace</div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {familyCounts.map((f) => (
                            <div key={f.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                              <div className="flex items-center justify-between gap-2"><span className="font-semibold">{f.label}</span><span className="text-[11px] text-green-400 whitespace-nowrap">{f.count} moteur(s)</span></div>
                              <p className="text-xs text-white/50 mt-1">{f.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setTab('moteurs')} className="px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm font-medium hover:bg-white/[0.06] flex items-center gap-2">Voir mes moteurs <ArrowRight className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setTab('factures')} className="px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm font-medium hover:bg-white/[0.06]">Mes factures</button>
                    </div>
                  </div>
                )}

                {/* ABONNEMENT */}
                {tab === 'abonnement' && (
                  subs.length === 0 ? <Empty>Aucun abonnement pour cet espace.</Empty> : (
                    <div className="space-y-4">
                      {subs.map((s) => {
                        const b = badge(s.status); const payable = s.status === 'pending' || s.status === 'past_due';
                        return (
                          <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div>
                                <div className="flex items-center gap-2 mb-1"><span className="text-xl font-black capitalize">{planName(s)}</span><span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${b.cls}`}>{b.label}</span></div>
                                <div className="text-sm text-white/60">{eur(s.amount_cents, s.currency)} / mois{s.current_period_end ? ` · échéance ${fmtDate(s.current_period_end)}` : ''}{s.provider ? ` · ${s.provider}` : ''}</div>
                              </div>
                              {payable ? (
                                <button onClick={() => pay(s)} disabled={payingId === s.id} className="px-5 py-3 bg-[#d97757] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#d97757]/25 flex items-center gap-2 disabled:opacity-60">
                                  {payingId === s.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />} Payer par carte
                                </button>
                              ) : s.status === 'active' ? <span className="flex items-center gap-1 text-green-400 text-sm font-medium"><CheckCircle className="w-4 h-4" /> Service actif</span> : null}
                            </div>
                          </motion.div>
                        );
                      })}
                      <div className="pt-2">
                        <button onClick={openBillingPortal} disabled={busy === 'portal'} className="text-sm px-4 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] flex items-center gap-2 disabled:opacity-40">{busy === 'portal' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Gérer ma facturation (moyen de paiement, reçus) — portail Stripe</button>
                      </div>
                      <p className="text-xs text-white/40 pt-1">Paiement sécurisé par Stripe. En mode test : carte <code className="text-white/60">4242 4242 4242 4242</code>, date future, CVC quelconque.</p>
                    </div>
                  )
                )}

                {/* MOTEURS */}
                {tab === 'moteurs' && (
                  <div className="space-y-4">
                    {!activeSubs.length && (
                      <div className="rounded-2xl border border-[#d97757]/30 bg-gradient-to-br from-[#d97757]/10 to-[#e6b878]/[0.04] p-5">
                        <div className="flex items-center gap-2 mb-1"><Lock className="w-4 h-4 text-[#e0926a]" /> <span className="font-bold">Vos moteurs sont en pause</span></div>
                        <p className="text-sm text-white/60 mb-3">Activez un forfait pour débloquer {services.length ? `vos ${services.length} moteur(s)` : 'vos moteurs'}{familyCounts.length ? ` : ${familyCounts.map((f) => f.label).join(', ')}` : ''}.</p>
                        <button onClick={() => setTab('marketplace')} className="px-4 py-2.5 rounded-xl bg-[#d97757] text-white font-bold text-sm hover:shadow-lg flex items-center gap-2 w-fit"><ShoppingBag className="w-4 h-4" /> Voir les forfaits <ArrowRight className="w-4 h-4" /></button>
                      </div>
                    )}
                    {services.length === 0 ? (activeSubs.length ? <Empty>Aucun moteur activé pour cet espace.</Empty> : null) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {services.map((sv) => {
                        const on = sv.active === true || sv.status === 'active';
                        return (
                          <div key={sv.id || sv.service_key} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.05] text-white/40'}`}><Power className="w-4 h-4" /></div>
                              <div><p className="font-semibold text-sm">{serviceName(sv.service_key)}</p><p className="text-xs text-white/40">{sv.service_key}</p></div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${on ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-white/10 border-white/20 text-white/50'}`}>{on ? 'Activé' : 'Inactif'}</span>
                          </div>
                        );
                      })}
                      {activeSubs.length > 0 && <p className="sm:col-span-2 text-xs text-white/40">Moteurs inclus dans votre forfait actif.</p>}
                    </div>
                    )}
                  </div>
                )}

                {/* FACTURES */}
                {tab === 'factures' && (
                  invoices.length === 0 ? <Empty>Aucune facture.</Empty> : (
                    <div className="space-y-3">
                      {invoices.map((inv) => {
                        const b = badge(inv.status);
                        return (
                          <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] gap-3 flex-wrap">
                            <div className="flex items-center gap-3">{inv.status === 'paid' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Clock className="w-5 h-5 text-amber-400" />}
                              <div><p className="font-medium">{inv.invoice_number || inv.description || 'Facture'}</p><p className="text-xs text-white/50">{inv.paid_at ? `Payée le ${fmtDate(inv.paid_at)}` : `Échéance ${fmtDate(inv.due_date)}`}</p></div>
                            </div>
                            <div className="flex items-center gap-3"><span className="font-medium">{eur(inv.amount_cents, inv.currency)}</span><span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${b.cls}`}>{b.label}</span><button onClick={() => printReceipt(inv)} title="Imprimer le reçu" className="p-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.06]"><Printer className="w-3.5 h-3.5 text-white/50" /></button></div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {/* MARKETPLACE */}
                {tab === 'marketplace' && (
                  displayMarket.length === 0 ? <Empty>Catalogue Cimolace indisponible pour le moment.</Empty> : (
                    <div className="space-y-4">
                      {showLiriGrille && (
                        <div className="text-center pb-1">
                          <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[#e0926a]/80 mb-1.5"><Sparkles className="w-3.5 h-3.5" /> Forfaits LIRI</div>
                          <h2 className="text-xl font-black">Débloquez tout LIRI</h2>
                          <p className="text-sm text-white/55 mt-1 max-w-lg mx-auto">Lives illimités, replay, smartboard IA et tous les moteurs LIRI. En gratuit : 3 min / 5 personnes. Choisissez votre forfait pour libérer la pleine puissance.</p>
                        </div>
                      )}
                      <div className="flex items-center justify-center">
                        <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-white/[0.08] bg-white/[0.03]">
                          {['monthly', 'yearly'].map((c) => (
                            <button key={c} onClick={() => setMktCycle(c)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${mktCycle === c ? 'bg-[#d97757]/80 text-white' : 'text-white/50 hover:text-white'}`}>
                              {c === 'monthly' ? 'Mensuel' : 'Annuel'}{c === 'yearly' && <span className="ml-1.5 text-[10px] font-bold text-[#e6b878]">2 mois offerts</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {displayMarket.map((p) => {
                          const hint = PLAN_HINTS[p.key] || {};
                          const feats = humanizeFeatures(p.features);
                          const oneTime = (p.billing_cycle || 'monthly') === 'one_time';
                          const yearly = mktCycle === 'yearly' && !oneTime;
                          const displayCents = yearly ? (p.price_cents || 0) * 10 : (p.price_cents || 0);
                          const anchorCents = yearly ? (p.price_cents || 0) * 12 : null;
                          const per = oneTime ? 'paiement unique' : yearly ? 'an' : 'mois';
                          return (
                            <div key={p.key} className={`relative rounded-2xl border p-6 flex flex-col transition-colors ${hint.highlight ? 'border-[#d97757]/50 bg-[#d97757]/[0.06] ring-1 ring-[#d97757]/25 shadow-[0_10px_44px_-16px_rgba(217,119,87,0.45)]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'}`}>
                              {hint.badge && <span className="absolute -top-2.5 left-6 px-2.5 py-0.5 rounded-full bg-[#d97757] text-white text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 shadow-sm"><Sparkles className="w-3 h-3" />{hint.badge}</span>}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-bold truncate">{p.label || p.key}</p>
                                  {hint.tagline && <p className="text-[11px] text-[#e0926a]/80 mt-0.5">{hint.tagline}</p>}
                                </div>
                                {p.subscribed && <span className="px-2 py-0.5 rounded-full border border-green-500/30 bg-green-500/15 text-green-400 text-[11px] whitespace-nowrap shrink-0">Souscrit</span>}
                              </div>
                              {p.description && <p className="text-xs text-white/50 mt-1.5">{p.description}</p>}
                              <div className="mt-3 flex items-end gap-2 flex-wrap">
                                <div className="text-[1.9rem] leading-none font-black tracking-tight">{eur(displayCents, p.currency)}</div>
                                <div className="text-xs text-white/40 mb-1">/ {per}</div>
                                {anchorCents && <div className="text-xs text-white/30 line-through mb-1">{eur(anchorCents, p.currency)}</div>}
                              </div>
                              {feats.length > 0 && (
                                <ul className="mt-4 space-y-2 flex-1 border-t border-white/[0.06] pt-4">
                                  {feats.slice(0, 8).map((f, i) => (
                                    <li key={i} className="flex items-start gap-2 text-[13px] text-white/70"><Check className="w-3.5 h-3.5 text-[#d97757] shrink-0 mt-0.5" /><span className="min-w-0 break-words">{f}</span></li>
                                  ))}
                                  {feats.length > 8 && <li className="pl-[22px] text-xs text-white/35">+ {feats.length - 8} autres moteurs</li>}
                                </ul>
                              )}
                              {yearly ? (
                                <button disabled={p.subscribed || busy === `annual-${p.key}`} onClick={() => requestAnnual(p)} className="mt-4 px-4 py-2.5 rounded-xl border border-[#d97757]/40 bg-[#d97757]/10 text-white font-bold text-sm hover:bg-[#d97757]/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                  {busy === `annual-${p.key}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} {p.subscribed ? 'Déjà actif' : "Demander l'annuel"}
                                </button>
                              ) : (
                                <>
                                  <button disabled={p.subscribed || busy === `sub-${p.key}`} onClick={() => subscribe(p.key)} className="mt-4 px-4 py-2.5 rounded-xl bg-[#d97757] text-white font-bold text-sm hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                    {busy === `sub-${p.key}` ? <Loader2 className="w-4 h-4 animate-spin" /> : p.subscribed ? <Check className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />} {p.subscribed ? 'Déjà actif' : (oneTime ? 'Commander' : 'Payer par carte')}
                                  </button>
                                  {!oneTime && !p.subscribed && (
                                    <button onClick={() => setMmPlan(p)} className="mt-2 px-4 py-2 rounded-xl border border-[#e6b878]/40 text-[#e6b878] font-semibold text-[13px] hover:bg-[#e6b878]/[0.08] flex items-center justify-center gap-2 transition-colors">
                                      <Smartphone className="w-4 h-4" /> Mobile Money (Afrique)
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {mmPlan && <MobileMoneyModal plan={mmPlan} onClose={() => setMmPlan(null)} onPaid={() => loadAll(activeSlug)} />}
                      <p className="text-xs text-white/40 flex items-center gap-1.5 flex-wrap"><ShieldCheck className="w-3.5 h-3.5 text-[#e6b878] shrink-0" /> Carte (Stripe) ou Mobile Money (PawaPay) · Conforme RGPD · Selon le service, des frais d'activation uniques peuvent s'appliquer (forfait boutique : 500 €), détaillés avant paiement.</p>
                      {isLiriUpgrade && (
                        <div className="text-center pt-1">
                          <button onClick={() => setShowAllPlans((v) => !v)} className="text-xs text-white/45 hover:text-white/75 underline underline-offset-2">
                            {showAllPlans ? '← Revenir aux forfaits LIRI' : 'Voir tous les forfaits Cimolace (école, MEDOS, boutique…)'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* API & CLÉS */}
                {tab === 'cles' && (
                  <div className="space-y-4">
                    {!activeSubs.length && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>Sans forfait actif, vos clés peuvent renvoyer <code className="text-red-100">402 subscription_inactive</code> aux intégrations (si le gating est armé sur votre espace).</span>
                      </div>
                    )}
                    {newKey && (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4">
                        <p className="text-sm text-amber-200 mb-2">⚠️ Copiez cette clé maintenant — elle ne sera plus jamais affichée.</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs bg-black/40 rounded px-2 py-1.5 break-all flex-1">{newKey}</code>
                          <button onClick={copyKey} className="px-3 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] text-xs flex items-center gap-1">{copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} {copied ? 'Copié' : 'Copier'}</button>
                        </div>
                      </div>
                    )}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <div className="flex items-end gap-2 flex-wrap">
                        <div className="flex-1 min-w-[180px]"><label className="text-xs text-white/40">Nouvelle clé — libellé</label><input value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} placeholder="ex. zahirwellness.com production" className="mt-1 w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-sm" /></div>
                        <button disabled={!keyLabel.trim() || busy === 'new-key'} onClick={createKey} className="px-4 py-2 rounded-lg bg-[#d97757]/80 hover:bg-[#d97757] text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'new-key' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Générer</button>
                      </div>
                    </div>
                    {keys.length === 0 ? <Empty>Aucune clé API. Générez-en une pour intégrer vos services (MEDOS, Mbolo) à votre site.</Empty> : (
                      <div className="space-y-2">
                        {keys.map((k) => (
                          <div key={k.id} className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] gap-3 flex-wrap">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center"><KeyRound className="w-4 h-4 text-[#e0926a]" /></div>
                              <div><p className="font-medium text-sm">{k.label || 'Clé API'} <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-white/50">{keyFamily(k.key_prefix)}</span></p><p className="text-xs text-white/40 font-mono">{k.key_prefix}… · créée {fmtDate(k.created_at)}{k.last_used_at ? ` · utilisée ${fmtDate(k.last_used_at)}` : ''}</p></div>
                            </div>
                            <button disabled={busy === `rev-${k.id}`} onClick={() => revokeKey(k.id)} className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-300/80 hover:bg-red-500/10 text-xs flex items-center gap-1 disabled:opacity-40">{busy === `rev-${k.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Révoquer</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUPPORT */}
                {tab === 'support' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
                      <div className="text-sm font-semibold">Nouveau ticket</div>
                      <input value={ticketForm.subject} onChange={(e) => setTicketForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Sujet" className="w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-sm" />
                      <textarea value={ticketForm.description} onChange={(e) => setTicketForm((f) => ({ ...f, description: e.target.value }))} placeholder="Décrivez votre demande à l'équipe Cimolace…" rows={3} className="w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-sm" />
                      <button disabled={!ticketForm.subject.trim() || busy === 'ticket'} onClick={submitTicket} className="px-4 py-2 rounded-lg bg-[#d97757]/80 hover:bg-[#d97757] text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'ticket' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Envoyer</button>
                    </div>
                    {tickets.length === 0 ? <Empty>Aucun ticket. Une question ? Ouvrez-en un ci-dessus.</Empty> : (
                      <div className="space-y-2">
                        {tickets.map((t) => { const b = badge(t.status); return (
                          <div key={t.id} className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] gap-3 flex-wrap">
                            <div><p className="font-medium text-sm">{t.subject}</p><p className="text-xs text-white/40">{t.ticket_number} · {fmtDate(t.created_at)}{t.priority ? ` · ${t.priority}` : ''}</p></div>
                            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${b.cls}`}>{b.label}</span>
                          </div>
                        ); })}
                      </div>
                    )}
                  </div>
                )}

                {/* PARAMÈTRES */}
                {tab === 'parametres' && (
                  <div className="space-y-4 max-w-xl">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-3">
                      <div className="text-sm font-semibold">Identité & branding</div>
                      <Field label="Nom affiché" value={brandForm.name} onChange={(v) => setBrandForm((f) => ({ ...f, name: v }))} placeholder={activeName} />
                      <Field label="Logo (URL)" value={brandForm.logo_url} onChange={(v) => setBrandForm((f) => ({ ...f, logo_url: v }))} placeholder="https://…/logo.png" />
                      <Field label="Domaine principal" value={brandForm.primary_domain} onChange={(v) => setBrandForm((f) => ({ ...f, primary_domain: v }))} placeholder="zahirwellness.com" />
                      <Field label="Couleur primaire" value={brandForm.primary} onChange={(v) => setBrandForm((f) => ({ ...f, primary: v }))} placeholder="#d97757" />
                      <button disabled={busy === 'brand'} onClick={saveBranding} className="px-4 py-2 rounded-lg bg-[#d97757]/80 hover:bg-[#d97757] text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'brand' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Enregistrer</button>
                    </div>
                    <p className="text-xs text-white/40">Espace : <code className="text-white/60">{activeSlug || '—'}</code>. Modifications réservées au rôle owner du tenant.</p>
                  </div>
                )}

                {/* MONITORING */}
                {tab === 'monitoring' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <StatCard label="Moteurs actifs" value={`${usage?.engines?.active ?? activeServices.length}/${usage?.engines?.total ?? services.length}`} sub="services" />
                      <StatCard label="Clés API" value={`${usage?.apiKeys ?? keys.length}`} sub="actives" />
                      <StatCard label="Membres" value={`${usage?.members ?? members.length}`} sub="équipe" />
                      <StatCard label="Abonnement" value={usage?.subscription ? badge(usage.subscription.status).label : (primarySub ? badge(primarySub.status).label : '—')} sub={usage?.subscription?.plan || ''} />
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <StatCard label="Factures" value={`${usage?.invoices?.total ?? invoices.length}`} sub="total" />
                      <StatCard label="Payées" value={`${usage?.invoices?.paid ?? paidCount}`} sub="historique" />
                      <StatCard label="En attente" value={`${usage?.invoices?.unpaid ?? 0}`} sub="à régler" />
                      <StatCard label="Renouvellement" value={usage?.subscription?.renews ? fmtDate(usage.subscription.renews) : '—'} sub="échéance" />
                    </div>
                    {familyCounts.length > 0 && (
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold mb-4">Répartition de vos moteurs</div>
                        <div className="space-y-3">
                          {(() => {
                            const maxCount = Math.max(...familyCounts.map((x) => x.count), 1);
                            const total = familyCounts.reduce((s, x) => s + x.count, 0) || 1;
                            const colors = ['#e0926a', '#06b6d4', '#10b981', '#f59e0b'];
                            return familyCounts.map((f, i) => (
                              <div key={f.key} className="flex items-center gap-3">
                                <div className="w-28 shrink-0 text-xs text-white/60 truncate" title={f.label}>{f.label}</div>
                                <div className="flex-1 h-7 rounded-lg bg-white/[0.04] overflow-hidden">
                                  <div className="h-full rounded-lg flex items-center justify-end pr-2 min-w-[30px] transition-all duration-700" style={{ width: `${Math.max((f.count / maxCount) * 100, 9)}%`, background: colors[i % 4] }}>
                                    <span className="text-[11px] font-bold text-white">{f.count}</span>
                                  </div>
                                </div>
                                <div className="w-12 shrink-0 text-right text-[11px] text-white/40">{Math.round((f.count / total) * 100)}%</div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-white/40">Synthèse d'usage de votre infrastructure Cimolace. Détail moteur par moteur dans l'onglet Moteurs.</p>
                  </div>
                )}

                {/* PRODUITS (Mbolo) */}
                {tab === 'produits' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <div className="text-sm font-semibold mb-2">Ajouter un produit (boutique Mbolo)</div>
                      <div className="flex items-end gap-2 flex-wrap">
                        <div className="flex-1 min-w-[160px]"><label className="text-xs text-white/40">Nom</label><input value={prodForm.name} onChange={(e) => setProdForm((f) => ({ ...f, name: e.target.value }))} placeholder="ex. Consultation bien-être" className="mt-1 w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-sm" /></div>
                        <div className="w-28"><label className="text-xs text-white/40">Prix (€)</label><input value={prodForm.priceEur} onChange={(e) => setProdForm((f) => ({ ...f, priceEur: e.target.value }))} placeholder="49" className="mt-1 w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-sm" /></div>
                        <button disabled={!prodForm.name.trim() || busy === 'new-prod'} onClick={createProduct} className="px-4 py-2 rounded-lg bg-[#d97757]/80 hover:bg-[#d97757] text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'new-prod' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Ajouter</button>
                      </div>
                    </div>
                    {products.length === 0 ? <Empty>Aucun produit. Si votre boutique Mbolo est activée, ajoutez-en un ci-dessus.</Empty> : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {products.map((p) => (
                          <div key={p.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center overflow-hidden shrink-0">{p.primary_image_url || p.image_url ? <img src={p.primary_image_url || p.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-[#e0926a]" />}</div><div className="min-w-0"><p className="font-medium text-sm truncate">{p.name}</p><p className="text-xs text-white/40 truncate">{p.slug || p.category || '—'}</p></div></div>
                              <span className="font-medium text-sm shrink-0">{eur(p.price_cents ?? p.priceCents, p.currency)}</span>
                            </div>
                            <div className="flex items-end gap-2">
                              <input value={imgForm[p.id] || ''} onChange={(e) => setImgForm((f) => ({ ...f, [p.id]: e.target.value }))} placeholder="URL d'image du produit…" className="flex-1 bg-black/30 border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs" />
                              <button disabled={!imgForm[p.id] || busy === `img-${p.id}`} onClick={() => addImage(p.id)} className="px-3 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-xs flex items-center gap-1 disabled:opacity-40">{busy === `img-${p.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />} Image</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ÉQUIPE */}
                {tab === 'equipe' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <div className="text-sm font-semibold mb-2">Inviter un membre</div>
                      <div className="flex items-end gap-2 flex-wrap">
                        <div className="flex-1 min-w-[180px]"><label className="text-xs text-white/40">Email</label><input value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} placeholder="collaborateur@exemple.com" className="mt-1 w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-sm" /></div>
                        <div className="w-32"><label className="text-xs text-white/40">Rôle</label><select value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))} className="mt-1 w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-sm"><option value="member">Membre</option><option value="admin">Admin</option><option value="owner">Owner</option></select></div>
                        <button disabled={!inviteForm.email.trim() || busy === 'invite'} onClick={emailInvite} className="px-4 py-2 rounded-lg bg-[#d97757]/80 hover:bg-[#d97757] text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'invite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Inviter par email</button>
                      </div>
                    </div>
                    {(() => { const team = members.filter((m) => !['patient', 'student', 'eleve'].includes(String(m.role || '').toLowerCase())); return team.length === 0 ? <Empty>Aucun membre d'équipe (les clients/patients ne sont pas comptés ici). Invitez un collaborateur ci-dessus.</Empty> : (
                      <div className="space-y-2">
                        {team.map((m) => { const uid = m.user_id || m.id; return (
                          <div key={uid} className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] gap-3 flex-wrap">
                            <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center"><UserCircle className="w-4 h-4 text-white/60" /></div><div><p className="font-medium text-sm">{m.email || m.full_name || uid}</p><p className="text-xs text-white/40">{m.role || 'member'}{m.status ? ` · ${m.status}` : ''}</p></div></div>
                            <button disabled={busy === `rm-${uid}`} onClick={() => kickMember(uid)} className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-300/80 hover:bg-red-500/10 text-xs flex items-center gap-1 disabled:opacity-40">{busy === `rm-${uid}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Retirer</button>
                          </div>
                        ); })}
                      </div>
                    ); })()}
                  </div>
                )}

                {/* PROFIL */}
                {tab === 'profil' && (
                  <div className="space-y-4 max-w-xl">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-2">
                      <div className="text-sm font-semibold mb-1">Mon profil</div>
                      <InfoRow label="Email" value={profile?.email || '—'} />
                      <InfoRow label="Rôle dans l'espace" value={profile?.role || '—'} />
                      <InfoRow label="Espace" value={profile?.tenant?.slug || activeSlug || '—'} />
                      <InfoRow label="ID utilisateur" value={profile?.id ? `${String(profile.id).slice(0, 8)}…` : '—'} />
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-3">
                      <div className="text-sm font-semibold">Changer mon mot de passe</div>
                      <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Nouveau mot de passe (8 car. min)" className="w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-sm" />
                      <button disabled={busy === 'pwd'} onClick={changePassword} className="px-4 py-2 rounded-lg bg-[#d97757]/80 hover:bg-[#d97757] text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'pwd' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Mettre à jour</button>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="w-4 h-4 text-green-400" /> Sécurité</div>
                      {mfa ? (
                        <div className="space-y-2">
                          <p className="text-xs text-white/50">Scannez ce QR avec votre app d'authentification (Google Authenticator, 1Password…), puis entrez le code à 6 chiffres.</p>
                          {mfa.qr && <img src={mfa.qr} alt="QR 2FA" className="w-40 h-40 rounded-lg bg-white p-1" />}
                          <div className="flex items-end gap-2">
                            <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="123456" maxLength={6} className="w-32 bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-sm" />
                            <button disabled={busy === 'mfa-v'} onClick={verify2FA} className="px-4 py-2 rounded-lg bg-green-500/80 hover:bg-green-500 text-white text-sm font-medium disabled:opacity-40">{busy === 'mfa-v' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activer'}</button>
                          </div>
                        </div>
                      ) : (
                        <button disabled={busy === 'mfa'} onClick={enroll2FA} className="px-4 py-2 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-sm flex items-center gap-2 disabled:opacity-40">{busy === 'mfa' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Activer la 2FA (TOTP)</button>
                      )}
                      <div className="pt-3 border-t border-white/[0.06]">
                        <button disabled={busy === 'signout'} onClick={signOutEverywhere} className="px-4 py-2 rounded-lg border border-red-500/20 text-red-300/80 hover:bg-red-500/10 text-sm flex items-center gap-2 disabled:opacity-40">{busy === 'signout' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} Déconnexion sur tous les appareils</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* COMPTE (danger zone) */}
                {tab === 'compte' && (
                  <div className="space-y-4 max-w-xl">
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-5 space-y-3">
                      <div className="flex items-center gap-2 text-red-300"><ShieldAlert className="w-5 h-5" /><span className="text-sm font-semibold">Zone sensible — Supprimer le compte</span></div>
                      <p className="text-sm text-white/60">La suppression désactive votre espace et planifie l'effacement de vos données. Action réservée au owner. Pour confirmer, tapez <code className="text-white/80">SUPPRIMER</code>.</p>
                      <input value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder="SUPPRIMER" className="w-full bg-black/30 border border-red-500/20 rounded-lg px-3 py-2 text-sm" />
                      <button disabled={delConfirm !== 'SUPPRIMER' || busy === 'del'} onClick={deleteAccount} className="px-4 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">{busy === 'del' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Demander la suppression</button>
                    </div>
                    <p className="text-xs text-white/40">Votre demande ouvre un ticket prioritaire ; l'équipe Cimolace traite la suppression définitive (réversible sous 48 h).</p>
                  </div>
                )}

                {/* WEBHOOKS */}
                {tab === 'webhooks' && (
                  <div className="space-y-4">
                    {whSecret && (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4">
                        <p className="text-sm text-amber-200 mb-2">⚠️ Secret de signature (HMAC) — copiez-le, il ne sera plus affiché :</p>
                        <code className="text-xs bg-black/40 rounded px-2 py-1.5 break-all block">{whSecret}</code>
                      </div>
                    )}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <div className="text-sm font-semibold mb-2">Ajouter un endpoint webhook</div>
                      <div className="flex items-end gap-2 flex-wrap">
                        <div className="w-40"><label className="text-xs text-white/40">Libellé</label><input value={whForm.label} onChange={(e) => setWhForm((f) => ({ ...f, label: e.target.value }))} placeholder="Mon serveur" className="mt-1 w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-sm" /></div>
                        <div className="flex-1 min-w-[200px]"><label className="text-xs text-white/40">URL HTTPS</label><input value={whForm.url} onChange={(e) => setWhForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://votre-site.com/webhooks/cimolace" className="mt-1 w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-sm" /></div>
                        <button disabled={!whForm.url.trim() || busy === 'new-wh'} onClick={createWh} className="px-4 py-2 rounded-lg bg-[#d97757]/80 hover:bg-[#d97757] text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'new-wh' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer</button>
                      </div>
                    </div>
                    {webhooks.length === 0 ? <Empty>Aucun webhook. Créez-en un pour recevoir les événements Cimolace (paiements, abonnements…) sur votre serveur.</Empty> : (
                      <div className="space-y-2">
                        {webhooks.map((w) => (
                          <div key={w.id} className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] gap-3 flex-wrap">
                            <div className="flex items-center gap-3 min-w-0"><div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0"><Globe className="w-4 h-4 text-[#e0926a]" /></div><div className="min-w-0"><p className="font-medium text-sm truncate">{w.label}</p><p className="text-xs text-white/40 font-mono truncate">{w.url}</p></div></div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => toggleWh(w)} disabled={busy === `wht-${w.id}`} className={`px-2 py-1 rounded-lg text-[11px] border ${w.is_active ? 'border-green-500/30 bg-green-500/15 text-green-400' : 'border-white/10 text-white/40'}`}>{w.is_active ? 'Actif' : 'Inactif'}</button>
                              <button disabled={busy === `wh-${w.id}`} onClick={() => delWh(w.id)} className="px-2.5 py-1.5 rounded-lg border border-red-500/20 text-red-300/80 hover:bg-red-500/10 text-xs"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-white/40 space-y-1.5">
                      <p>Chaque requête est signée (HMAC-SHA256, en-tête <code className="text-white/60">X-Cimolace-Signature</code>) avec le secret du webhook.</p>
                      <p>Événements émis : <code className="text-white/60">billing.subscription.activated</code> · <code className="text-white/60">billing.invoice.paid</code> · <code className="text-white/60">billing.subscription.past_due</code> · <code className="text-white/60">billing.subscription.canceled</code> · <code className="text-white/60">session.started</code> · <code className="text-white/60">session.ended</code></p>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

function Empty({ children }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-white/60">{children}</div>;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
      {sub ? <div className="text-[11px] text-white/40 mt-0.5">{sub}</div> : null}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-xs text-white/40">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-sm" />
    </label>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
