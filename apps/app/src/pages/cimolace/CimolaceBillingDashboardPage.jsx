import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard, CheckCircle, Clock, FileText, RefreshCw, AlertCircle,
  Zap, Loader2, Building2, Boxes, Power, LayoutGrid, ArrowRight, ExternalLink,
  KeyRound, ShoppingBag, LifeBuoy, Settings, Plus, Trash2, Copy, Check, Send,
  Package, Users, Activity, UserCircle, ShieldAlert, Mail, XCircle,
} from 'lucide-react';
import { billingApi, tenantMembersApi, catalogApi, tenantApiKeysApi, tenantPortalApi, tenantsApi, mboloApi } from '@/lib/api';
import { authStore } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';

const eur = (cents, cur = 'EUR') => {
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur }).format((Number(cents) || 0) / 100); }
  catch { return `${((Number(cents) || 0) / 100).toFixed(2)} ${cur}`; }
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

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
  liri_live: 'LIRI Live', liri_smartboard: 'SmartBoard', school_engine: 'Moteur École',
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
];

// Regroupement des sections dans la sidebar (style SaaS).
const NAV_GROUPS = [
  { label: 'Tableau de bord', ids: ['apercu', 'monitoring'] },
  { label: 'Facturation', ids: ['abonnement', 'marketplace', 'factures'] },
  { label: 'Services', ids: ['moteurs', 'produits'] },
  { label: 'Organisation', ids: ['equipe', 'cles', 'support'] },
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
  const [tickets, setTickets] = useState([]);
  const [busy, setBusy] = useState(null);
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

  const loadAll = useCallback(async (slug) => {
    setLoading(true); setError(null);
    try {
      if (slug && authStore.setTenantSlug) authStore.setTenantSlug(slug);
      const arr = (x) => (Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : []);
      const [plan, svc, ks, mk, tk, us, pr, mb, pd] = await Promise.all([
        billingApi.getPlan().catch(() => ({ subscriptions: [], invoices: [] })),
        catalogApi.tenantServices().catch(() => []),
        tenantApiKeysApi.list().catch(() => []),
        tenantPortalApi.marketplace().catch(() => []),
        tenantPortalApi.tickets().catch(() => []),
        tenantPortalApi.usage().catch(() => null),
        tenantPortalApi.profile().catch(() => null),
        tenantMembersApi.listMembers().catch(() => []),
        mboloApi.listProducts().catch(() => []),
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

  const planName = (s) => s?.metadata?.label || s?.plan_id || 'Abonnement';
  const activeName = tenants.find((t) => t.slug === activeSlug)?.name || activeSlug || '—';
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
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-sm font-black tracking-tight">CIMOLACE</span>
            </Link>
            <div className="text-[10px] uppercase tracking-[0.2em] text-violet-300/70 flex items-center gap-1"><Building2 className="w-3 h-3" /> Espace tenant</div>
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
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm mb-0.5 transition ${tab === id ? 'bg-violet-500/20 text-white' : danger ? 'text-red-300/70 hover:bg-red-500/10' : 'text-white/55 hover:bg-white/[0.05] hover:text-white'}`}>
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

            {loading ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 flex items-center gap-2 text-white/60"><RefreshCw className="w-4 h-4 animate-spin" /> Chargement…</div>
            ) : (
              <>
                {/* VUE D'ENSEMBLE */}
                {tab === 'apercu' && (
                  <div className="space-y-6">
                    {primarySub ? (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-500/10 to-cyan-500/[0.04] p-6">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-violet-300/80 mb-1">Votre abonnement</div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-2xl font-black capitalize">{planName(primarySub)}</span>
                              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${badge(primarySub.status).cls}`}>{badge(primarySub.status).label}</span>
                            </div>
                            <div className="text-sm text-white/60">{eur(primarySub.amount_cents, primarySub.currency)} / mois{primarySub.current_period_end ? ` · échéance ${fmtDate(primarySub.current_period_end)}` : ''}</div>
                          </div>
                          {(primarySub.status === 'pending' || primarySub.status === 'past_due') ? (
                            <button onClick={() => pay(primarySub)} disabled={payingId === primarySub.id} className="px-5 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 flex items-center gap-2 disabled:opacity-60">
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
                                <button onClick={() => pay(s)} disabled={payingId === s.id} className="px-5 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 flex items-center gap-2 disabled:opacity-60">
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
                  services.length === 0 ? <Empty>Aucun moteur activé pour cet espace.</Empty> : (
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
                      <p className="sm:col-span-2 text-xs text-white/40">{activeSubs.length ? 'Moteurs inclus dans votre forfait actif.' : 'Activez un abonnement pour débloquer vos moteurs.'}</p>
                    </div>
                  )
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
                            <div className="flex items-center gap-3"><span className="font-medium">{eur(inv.amount_cents, inv.currency)}</span><span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${b.cls}`}>{b.label}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {/* MARKETPLACE */}
                {tab === 'marketplace' && (
                  market.length === 0 ? <Empty>Catalogue Cimolace indisponible pour le moment.</Empty> : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {market.map((p) => (
                        <div key={p.key} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <div><p className="font-bold">{p.label || p.key}</p><p className="text-xs text-white/50 mt-0.5">{p.description || '—'}</p></div>
                            {p.subscribed && <span className="px-2 py-0.5 rounded-full border border-green-500/30 bg-green-500/15 text-green-400 text-[11px] whitespace-nowrap">Souscrit</span>}
                          </div>
                          <div className="mt-3 text-lg font-black">{eur(p.price_cents, p.currency)}<span className="text-xs font-normal text-white/40"> / {p.billing_cycle || 'mois'}</span></div>
                          <button disabled={p.subscribed || busy === `sub-${p.key}`} onClick={() => subscribe(p.key)}
                            className="mt-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold text-sm hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            {busy === `sub-${p.key}` ? <Loader2 className="w-4 h-4 animate-spin" /> : p.subscribed ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />} {p.subscribed ? 'Déjà actif' : 'Souscrire'}
                          </button>
                        </div>
                      ))}
                      <p className="sm:col-span-2 text-xs text-white/40">« Souscrire » crée l'abonnement puis ouvre le paiement carte sécurisé (Stripe).</p>
                    </div>
                  )
                )}

                {/* API & CLÉS */}
                {tab === 'cles' && (
                  <div className="space-y-4">
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
                        <button disabled={!keyLabel.trim() || busy === 'new-key'} onClick={createKey} className="px-4 py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'new-key' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Générer</button>
                      </div>
                    </div>
                    {keys.length === 0 ? <Empty>Aucune clé API. Générez-en une pour intégrer vos services (MEDOS, Mbolo) à votre site.</Empty> : (
                      <div className="space-y-2">
                        {keys.map((k) => (
                          <div key={k.id} className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] gap-3 flex-wrap">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center"><KeyRound className="w-4 h-4 text-violet-300" /></div>
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
                      <button disabled={!ticketForm.subject.trim() || busy === 'ticket'} onClick={submitTicket} className="px-4 py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'ticket' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Envoyer</button>
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
                      <Field label="Couleur primaire" value={brandForm.primary} onChange={(v) => setBrandForm((f) => ({ ...f, primary: v }))} placeholder="#7c3aed" />
                      <button disabled={busy === 'brand'} onClick={saveBranding} className="px-4 py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'brand' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Enregistrer</button>
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
                        <button disabled={!prodForm.name.trim() || busy === 'new-prod'} onClick={createProduct} className="px-4 py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'new-prod' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Ajouter</button>
                      </div>
                    </div>
                    {products.length === 0 ? <Empty>Aucun produit. Si votre boutique Mbolo est activée, ajoutez-en un ci-dessus.</Empty> : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {products.map((p) => (
                          <div key={p.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center"><Package className="w-4 h-4 text-violet-300" /></div><div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-white/40">{p.slug || p.category || '—'}</p></div></div>
                            <span className="font-medium text-sm">{eur(p.price_cents ?? p.priceCents, p.currency)}</span>
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
                        <button disabled={!inviteForm.email.trim() || busy === 'invite'} onClick={invite} className="px-4 py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'invite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Inviter</button>
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
                      <button disabled={busy === 'pwd'} onClick={changePassword} className="px-4 py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-medium flex items-center gap-1 disabled:opacity-40">{busy === 'pwd' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Mettre à jour</button>
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
