import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, UserRound, Building2, Users, CreditCard, Wallet, LogOut, Trash2,
  X, Loader2, Sparkles, Check, ArrowUpRight, SlidersHorizontal, Settings2,
  Eye, EyeOff, Copy, ShieldCheck, UserPlus, FileText, Globe, Palette, KeyRound, Image as ImageIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import LiriDomainSettings from '@/components/liri/LiriDomainSettings';
import LiriMobileMoneySettings from '@/components/liri/LiriMobileMoneySettings';
import '../LiriPortal.css';

interface Org { name: string; slug: string; role?: string | null; plan?: string | null; }
interface OrgRef { name: string; slug: string; role?: string | null }
interface Stats { totalMembers: number; totalLives: number; totalCourses: number; totalRevenueCents: number; }
interface Member { user_id: string; role: string; status: string; email: string | null; full_name: string | null; }
interface Sub { status?: string; plan_id?: string; provider?: string; current_period_end?: string | null; }

const DAY = 86_400_000;

export default function LiriAccountPage() {
  const nav = useNavigate();
  const { user, logout, tenantRole } = useAuth();
  const base = getApiBaseUrl();
  const token = authStore.getToken();
  const slug = authStore.getTenantSlug();
  const slugLabel = (slug || 'École').replace(/-/g, ' ');

  const [org, setOrg] = useState<Org | null>(null);
  const [orgs, setOrgs] = useState<OrgRef[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [section, setSection] = useState('general');
  const [delOpen, setDelOpen] = useState(false);
  const [delReason, setDelReason] = useState('');
  const [delLoading, setDelLoading] = useState(false);
  const [delDone, setDelDone] = useState(false);

  // Encaissements — config Stripe INLINE (on ne quitte JAMAIS le portail LIRI
  // pour le vieux shell « Academy »). POST/GET /billing/payment-methods, scopé
  // au tenant via X-Tenant-Slug (le SAVE va sur l'org courante, pas isna).
  const [payLoaded, setPayLoaded] = useState(false);
  const [stripeSet, setStripeSet] = useState(false);
  const [stripeLast4, setStripeLast4] = useState('');
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [reconfig, setReconfig] = useState(false);
  const [sk, setSk] = useState('');
  const [wh, setWh] = useState('');
  const [showSk, setShowSk] = useState(false);
  const [showWh, setShowWh] = useState(false);
  const [paySaving, setPaySaving] = useState(false);
  const [payTesting, setPayTesting] = useState(false);
  const [payMsg, setPayMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const webhookUrl = `${base}/checkout/webhook/stripe`;

  // Membres (tenant-scopé) + invitation, et renommage de l'org — INLINE (jamais
  // le vieux shell admin « Academy »).
  const [members, setMembers] = useState<Member[]>([]);
  const [memLoaded, setMemLoaded] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('student');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  // Marque & identité (logo, couleurs, slogan) — PATCH /tenants/current/branding, INLINE.
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [brandName, setBrandName] = useState('');
  const [accent, setAccent] = useState('#d97757');
  const [primary, setPrimary] = useState('');
  const [slogan, setSlogan] = useState('');
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandMsg, setBrandMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Sécurité — changement de mot de passe (Supabase auth, l'utilisateur saisit le sien).
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const orgName = org?.name || slugLabel;
  const orgSlug = org?.slug || slug;
  const role = (org?.role ?? '') as string;
  const isOwner = role === 'owner';
  // Rôle FIABLE : celui de /tenants/current OU celui du JWT (tenantRole) — évite que la
  // console d'org disparaisse quand /tenants/current fail-close (ex. résolution tenant en
  // cours) alors que l'utilisateur EST owner (cf. socuba owner d'isna côté DB).
  const manageRole = ['owner', 'admin', 'secretariat'];
  const canManageOrg = manageRole.includes(role) || manageRole.includes(String(tenantRole || '').toLowerCase());
  const email = user?.email || '';

  useEffect(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
    fetch(`${base}/tenants/current`, { headers: h }).then((r) => (r.ok ? r.json() : null))
      .then((d) => { let t: any = d; while (t && typeof t === 'object' && 'data' in t) t = t.data; if (t?.name || t?.slug) setOrg({ name: t.name ?? slugLabel, slug: t.slug ?? slug, role: t.userRole ?? t.role ?? null, plan: t.plan ?? null }); })
      .catch(() => {});
    fetch(`${base}/tenants/mine`, { headers: h }).then((r) => (r.ok ? r.json() : null))
      .then((d) => { const a = d?.data ?? d; if (Array.isArray(a)) setOrgs(a.map((m: any) => ({ name: m.name ?? m.tenants?.name ?? m.slug, slug: m.slug ?? m.tenants?.slug, role: m.role ?? null })).filter((o: OrgRef) => o.slug)); })
      .catch(() => {});
    fetch(`${base}/growth/stats`, { headers: h }).then((r) => (r.ok ? r.json() : null))
      .then((d) => { const s = d?.data ?? d; if (s && typeof s.totalLives === 'number' && typeof s.totalMembers === 'number') setStats(s as Stats); })
      .catch(() => {});
    fetch(`${base}/billing/plan`, { headers: h }).then((r) => (r.ok ? r.json() : null))
      .then((d) => { let t: any = d; while (t && typeof t === 'object' && 'data' in t && !('subscriptions' in t)) t = t.data; const arr = t?.subscriptions ?? []; setSubs(Array.isArray(arr) ? arr : []); const inv = t?.invoices ?? []; setInvoices(Array.isArray(inv) ? inv : []); })
      .catch(() => {});
  }, [base, token, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const billing = useMemo(() => {
    const active = subs.find((s) => s.status === 'active') ?? subs[0];
    const end = active?.current_period_end ? new Date(active.current_period_end) : null;
    const future = end ? end.getTime() - Date.now() : 0;
    const daysLeft = end ? Math.max(0, Math.ceil(future / DAY)) : null;
    const isPaid = !!active && !!active.provider && active.provider !== 'free' && active.status === 'active' && (!end || future > 0);
    const isTrial = !!active && !isPaid && (String(active.plan_id || '').includes('trial') || active.provider === 'free');
    const label = isPaid ? (active?.plan_id || 'Forfait actif') : isTrial ? `Essai${daysLeft != null ? ` · ${daysLeft} j restants` : ''}` : 'Gratuit';
    const endLabel = end ? end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    return { isPaid, isTrial, daysLeft, label, endLabel };
  }, [subs]);

  const euros = (cents?: number) => ((cents ?? 0) / 100).toLocaleString('fr-FR');
  const roleLabel = (r?: string) => (({ owner: 'Propriétaire', admin: 'Admin', teacher: 'Enseignant', secretariat: 'Secrétariat', student: 'Élève', practitioner: 'Praticien', clinic_admin: 'Admin clinique' } as Record<string, string>)[String(r || '').toLowerCase()] || r || '—');
  // Formate une facture défensivement (le schéma billing_invoices varie).
  const invFmt = (inv: any) => {
    const cents = inv?.amount_cents ?? inv?.amount ?? inv?.total_cents ?? null;
    const amount = cents != null ? `${euros(Number(cents))} ${String(inv?.currency || 'EUR').toUpperCase()}` : (inv?.description || 'Facture');
    const d = inv?.created_at || inv?.issued_at || inv?.period_start || null;
    const date = d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const url = inv?.hosted_invoice_url || inv?.invoice_url || inv?.pdf_url || inv?.url || '';
    return { amount, date, status: inv?.status || '', url };
  };

  const switchOrg = (s: string) => { if (!s || s === orgSlug) return; authStore.setTenantSlug(s); if (typeof window !== 'undefined') window.location.assign('/liri'); };

  const requestDeletion = async () => {
    if (delLoading) return;
    setDelLoading(true);
    try {
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
      const res = await fetch(`${base}/tenant-portal/account/request-deletion`, { method: 'POST', headers: h, body: JSON.stringify({ reason: delReason.trim() || undefined }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || e?.message || 'Échec de la demande.'); }
      setDelDone(true);
    } catch (err: any) {
      if (typeof window !== 'undefined') window.alert(err?.message || 'La demande de suppression a échoué.');
    } finally { setDelLoading(false); }
  };

  // Enregistre la clé Stripe DU TENANT (chiffrée en base par le service). Clés
  // NON préfixées (secret_key/webhook_secret) = forme attendue par SECRET_FIELDS.
  const saveStripe = async () => {
    if (paySaving || !sk.trim()) return;
    setPaySaving(true); setPayMsg(null);
    try {
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
      const credentials: Record<string, string> = { secret_key: sk.trim() };
      if (wh.trim()) credentials.webhook_secret = wh.trim();
      const mode = sk.trim().startsWith('sk_live') ? 'live' : 'test';
      const res = await fetch(`${base}/billing/payment-methods`, { method: 'POST', headers: h, body: JSON.stringify({ provider: 'stripe', mode, credentials }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || e?.message || 'Échec de l’enregistrement.'); }
      setStripeSet(true); setStripeEnabled(true); setStripeLast4(sk.trim().slice(-4));
      setSk(''); setWh(''); setReconfig(false);
      setPayMsg({ ok: true, text: 'Stripe connecté. Vos clés sont chiffrées en base — vous encaissez directement.' });
    } catch (err: any) {
      setPayMsg({ ok: false, text: err?.message || 'Échec de l’enregistrement.' });
    } finally { setPaySaving(false); }
  };

  // Test de connexion RÉEL côté serveur (valide que la clé fonctionne vraiment).
  const testStripe = async () => {
    if (payTesting) return;
    setPayTesting(true); setPayMsg(null);
    try {
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
      const res = await fetch(`${base}/billing/payment-methods/stripe/test`, { method: 'POST', headers: h });
      const d = await res.json().catch(() => ({}));
      const r = d?.data ?? d;
      setPayMsg({ ok: !!r?.ok, text: r?.message || (r?.ok ? 'Connexion Stripe vérifiée.' : 'Test échoué.') });
    } catch (err: any) {
      setPayMsg({ ok: false, text: err?.message || 'Test impossible.' });
    } finally { setPayTesting(false); }
  };

  const copyWebhook = async () => {
    try { await navigator.clipboard.writeText(webhookUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard indispo */ }
  };

  // Invite un membre/élève par email (VRAI magic-link via /team-invites/send).
  const sendInvite = async () => {
    const em = inviteEmail.trim().toLowerCase();
    if (inviteSending || !em) return;
    setInviteSending(true); setInviteMsg(null);
    try {
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
      const res = await fetch(`${base}/team-invites/send`, { method: 'POST', headers: h, body: JSON.stringify({ email: em, role: inviteRole }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || e?.message || 'Invitation impossible.'); }
      setInviteMsg({ ok: true, text: `Invitation envoyée à ${em}.` });
      setInviteEmail('');
    } catch (err: any) {
      setInviteMsg({ ok: false, text: err?.message || 'Invitation impossible.' });
    } finally { setInviteSending(false); }
  };

  // Renomme l'org (PATCH /tenants/current/branding, scopé au tenant courant).
  const saveName = async () => {
    const nm = nameDraft.trim();
    if (nameSaving || !nm || nm === orgName) { setNameEditing(false); return; }
    setNameSaving(true);
    try {
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
      const res = await fetch(`${base}/tenants/current/branding`, { method: 'PATCH', headers: h, body: JSON.stringify({ name: nm }) });
      if (!res.ok) throw new Error('Échec');
      setOrg((o) => (o ? { ...o, name: nm } : o));
      setNameEditing(false);
    } catch { if (typeof window !== 'undefined') window.alert('Le renommage a échoué.'); }
    finally { setNameSaving(false); }
  };

  type NavItem = { key: string; label: string; icon: LucideIcon; group: 'compte' | 'org' };
  const NAV: NavItem[] = [
    { key: 'profil', label: 'Profil', icon: UserRound, group: 'compte' },
    { key: 'securite', label: 'Sécurité', icon: KeyRound, group: 'compte' },
    { key: 'prefs', label: 'Préférences', icon: Settings2, group: 'compte' },
    { key: 'general', label: 'Général', icon: SlidersHorizontal, group: 'org' },
    { key: 'marque', label: 'Marque', icon: Palette, group: 'org' },
    { key: 'membres', label: 'Membres', icon: Users, group: 'org' },
    { key: 'facturation', label: 'Facturation', icon: CreditCard, group: 'org' },
    { key: 'encaissements', label: 'Encaissements', icon: Wallet, group: 'org' },
    { key: 'domaine', label: 'Domaine', icon: Globe, group: 'org' },
  ];
  const visibleNav = NAV.filter((n) => n.group === 'compte' || canManageOrg);
  const active = visibleNav.some((n) => n.key === section) ? section : (visibleNav[0]?.key || 'profil');

  // Charge (lazy) l'état des moyens de paiement quand la section Encaissements s'ouvre.
  // Placé APRÈS `active` (sinon TDZ dans le tableau de deps).
  useEffect(() => {
    if (active !== 'encaissements' || !token || payLoaded) return;
    const h = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
    fetch(`${base}/billing/payment-methods`, { headers: h }).then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // La réponse est { data: { providers: [...] } } (pas un tableau direct).
        const body = d?.data ?? d;
        const arr = (Array.isArray(body) ? body : body?.providers ?? []) as any[];
        const stripe = arr.find((p) => p?.provider === 'stripe');
        if (stripe) {
          setStripeSet(!!stripe.credentials?.secret_key?.set);
          setStripeLast4(stripe.credentials?.secret_key?.last4 || '');
          setStripeEnabled(!!stripe.enabled);
        }
        setPayLoaded(true);
      })
      .catch(() => setPayLoaded(true));
  }, [active, base, token, slug, payLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charge (lazy) les membres TENANT-SCOPÉS quand la section Membres s'ouvre.
  useEffect(() => {
    if (active !== 'membres' || !token || memLoaded) return;
    const h = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
    fetch(`${base}/tenant-portal/members`, { headers: h }).then((r) => (r.ok ? r.json() : null))
      .then((d) => { let a: any = d; while (a && typeof a === 'object' && !Array.isArray(a) && 'data' in a) a = a.data; if (Array.isArray(a)) setMembers(a as Member[]); setMemLoaded(true); })
      .catch(() => setMemLoaded(true));
  }, [active, base, token, slug, memLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charge (lazy) l'identité de marque quand la section Marque s'ouvre.
  useEffect(() => {
    if (active !== 'marque' || !token || brandLoaded) return;
    const h = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
    fetch(`${base}/tenants/current`, { headers: h }).then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        let t: any = d; while (t && typeof t === 'object' && 'data' in t) t = t.data;
        if (t) {
          setBrandName(t.name ?? '');
          setLogoUrl(t.logo_url ?? '');
          const c = (t.brand_colors && typeof t.brand_colors === 'object') ? t.brand_colors : {};
          setAccent(c.accent || '#d97757');
          setPrimary(c.primary || '');
          const site = (t.metadata?.site && typeof t.metadata.site === 'object') ? t.metadata.site : {};
          setSlogan(site.slogan || '');
        }
        setBrandLoaded(true);
      })
      .catch(() => setBrandLoaded(true));
  }, [active, base, token, slug, brandLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enregistre l'identité de marque (logo, couleurs, nom, slogan) — merge non destructif côté API.
  const saveBranding = async () => {
    if (brandSaving) return;
    setBrandSaving(true); setBrandMsg(null);
    try {
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
      const body: Record<string, unknown> = {
        logo_url: logoUrl.trim(),
        brand_colors: { accent, ...(primary.trim() ? { primary: primary.trim() } : {}) },
        site: { slogan: slogan.trim() },
      };
      if (brandName.trim()) body.name = brandName.trim();
      const res = await fetch(`${base}/tenants/current/branding`, { method: 'PATCH', headers: h, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || e?.message || 'Échec de l’enregistrement.'); }
      if (brandName.trim()) setOrg((o) => (o ? { ...o, name: brandName.trim() } : o));
      setBrandMsg({ ok: true, text: 'Identité enregistrée — elle s’applique à votre espace et votre vitrine.' });
    } catch (err: any) {
      setBrandMsg({ ok: false, text: err?.message || 'Échec de l’enregistrement.' });
    } finally { setBrandSaving(false); }
  };

  // Changement de mot de passe (l'utilisateur saisit le sien ; Supabase auth).
  const changePassword = async () => {
    if (pwSaving) return;
    if (pw1.length < 8) { setPwMsg({ ok: false, text: 'Mot de passe : 8 caractères minimum.' }); return; }
    if (pw1 !== pw2) { setPwMsg({ ok: false, text: 'Les deux mots de passe ne correspondent pas.' }); return; }
    setPwSaving(true); setPwMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw new Error(error.message || 'Échec.');
      setPw1(''); setPw2('');
      setPwMsg({ ok: true, text: 'Mot de passe mis à jour.' });
    } catch (err: any) {
      setPwMsg({ ok: false, text: err?.message || 'Échec de la mise à jour.' });
    } finally { setPwSaving(false); }
  };

  const initials = orgName.slice(0, 2).toUpperCase();

  const NavBtn = ({ it, horizontal }: { it: NavItem; horizontal?: boolean }) => {
    const Icon = it.icon;
    const on = active === it.key;
    return (
      <button onClick={() => setSection(it.key)}
        className={`flex items-center gap-2.5 rounded-lg lp-tr ${horizontal ? 'shrink-0 px-3 py-2 text-[13px]' : 'w-full px-2.5 py-2 text-[13px]'} ${on ? 'font-medium lp-ink' : 'lp-muted hover:bg-[rgba(255,255,255,.04)]'}`}
        style={on ? { background: 'rgba(217,119,87,.13)' } : undefined}>
        <Icon size={16} className={on ? 'lp-coral' : 'lp-faint'} />
        <span className="whitespace-nowrap">{it.label}</span>
      </button>
    );
  };

  // ── Lignes & blocs réutilisables ──
  const Row = ({ label, value, action }: { label: string; value?: ReactNode; action?: ReactNode }) => (
    <div className="flex items-center justify-between gap-4 border-b lp-line py-4">
      <div className="min-w-0">
        <p className="text-[13px] lp-faint">{label}</p>
        {value !== undefined && <div className="mt-0.5 text-[14px] lp-ink">{value}</div>}
      </div>
      {action}
    </div>
  );
  const GhostBtn = ({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) => (
    <button onClick={onClick} className="shrink-0 rounded-lg border px-3.5 py-2 text-[12.5px] font-medium lp-tr"
      style={danger ? { color: '#ef6a52', borderColor: 'rgba(226,85,63,.35)' } : { color: '#cfcac4', borderColor: 'rgba(245,244,238,.14)' }}>
      {children}
    </button>
  );
  const Linkish = ({ label, sub, btn, onClick }: { label: string; sub: string; btn: string; onClick: () => void }) => (
    <div className="rounded-2xl border lp-line lp-panel70 p-5">
      <p className="text-[14px] font-medium lp-ink">{label}</p>
      <p className="mt-1 text-[13px] lp-faint">{sub}</p>
      <GhostBtn onClick={onClick}>{btn}</GhostBtn>
    </div>
  );

  const Header = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div className="mb-2">
      <h2 className="lp-serif text-[20px] font-medium lp-ink">{title}</h2>
      <p className="mt-1 text-[12.5px] lp-faint">{subtitle}</p>
    </div>
  );

  const renderPane = () => {
    switch (active) {
      case 'profil':
        return (
          <div>
            <Header title="Profil" subtitle="Votre identité personnelle sur LIRI" />
            <div className="mt-5 flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl text-[18px] font-semibold text-white lp-ember">
                {user?.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : (user?.name || email || 'U').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium lp-ink">{user?.name || email.split('@')[0] || 'Vous'}</p>
                <p className="truncate text-[13px] lp-faint">{email}</p>
              </div>
            </div>
            <div className="mt-6"><GhostBtn onClick={() => nav('/profil/modifier')}>Modifier mon profil</GhostBtn></div>
          </div>
        );
      case 'prefs':
        return (
          <div>
            <Header title="Préférences" subtitle="Notifications, langue et options personnelles" />
            <div className="mt-5"><Linkish label="Préférences du compte" sub="Gérez vos notifications et vos options d’affichage." btn="Ouvrir les préférences" onClick={() => nav('/profil/parametres')} /></div>
          </div>
        );
      case 'securite':
        return (
          <div>
            <Header title="Sécurité" subtitle="Votre email de connexion et votre mot de passe" />
            <div className="mt-5 border-t lp-line">
              <Row label="Email de connexion" value={email || '—'} action={<GhostBtn onClick={() => nav('/profil/modifier')}>Modifier</GhostBtn>} />
            </div>
            <div className="mt-6 rounded-2xl border lp-line lp-panel70 p-5">
              <p className="text-[14px] font-medium lp-ink">Changer le mot de passe</p>
              <p className="mt-0.5 text-[12px] lp-faint">8 caractères minimum. Vous resterez connecté.</p>
              <label className="mt-4 block text-[12px] font-medium lp-faint">Nouveau mot de passe</label>
              <div className="relative mt-1.5">
                <input type={showPw ? 'text' : 'password'} value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" placeholder="••••••••" className="w-full rounded-xl border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2.5 pr-10 text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg lp-faint lp-tr hover:bg-[rgba(255,255,255,.06)]" aria-label="Afficher / masquer">{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
              <label className="mt-4 block text-[12px] font-medium lp-faint">Confirmer</label>
              <input type={showPw ? 'text' : 'password'} value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') changePassword(); }} autoComplete="new-password" placeholder="••••••••" className="mt-1.5 w-full rounded-xl border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
              {pwMsg && <p className="mt-3 text-[12.5px]" style={{ color: pwMsg.ok ? '#7bbf6a' : '#ef6a52' }}>{pwMsg.text}</p>}
              <div className="mt-5">
                <button onClick={changePassword} disabled={pwSaving || !pw1 || !pw2} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white lp-tr disabled:opacity-50" style={{ background: 'linear-gradient(90deg,#e2855f,#c2683f)' }}>{pwSaving ? <><Loader2 size={15} className="animate-spin" /> Mise à jour…</> : <><KeyRound size={15} /> Mettre à jour</>}</button>
              </div>
            </div>
          </div>
        );
      case 'marque':
        return (
          <div>
            <Header title="Marque & identité" subtitle="Votre logo, vos couleurs et votre nom — appliqués à votre espace, votre vitrine et vos emails." />
            {!brandLoaded ? (
              <div className="mt-6 flex items-center gap-2 text-[13px] lp-faint"><Loader2 size={15} className="animate-spin" /> Chargement…</div>
            ) : (
              <div className="mt-5 space-y-5">
                {/* Logo */}
                <div className="rounded-2xl border lp-line lp-panel70 p-5">
                  <p className="text-[13px] font-medium lp-ink">Logo</p>
                  <p className="mt-0.5 text-[12px] lp-faint">Collez l’URL de votre logo (PNG/SVG carré recommandé).</p>
                  <div className="mt-3 flex items-center gap-4">
                    <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border lp-line" style={{ background: 'rgba(255,255,255,.04)' }}>
                      {logoUrl.trim() ? <img src={logoUrl.trim()} alt="logo" className="h-full w-full object-contain" /> : <ImageIcon size={20} className="lp-faint" />}
                    </span>
                    <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" autoComplete="off" spellCheck={false} className="min-w-0 flex-1 rounded-xl border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
                  </div>
                </div>

                {/* Nom + slogan */}
                <div className="rounded-2xl border lp-line lp-panel70 p-5">
                  <label className="block text-[12px] font-medium lp-faint">Nom de la marque</label>
                  <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder={orgName} className="mt-1.5 w-full rounded-xl border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
                  <label className="mt-4 block text-[12px] font-medium lp-faint">Slogan <span className="lp-faint">(vitrine)</span></label>
                  <input value={slogan} onChange={(e) => setSlogan(e.target.value)} placeholder="Ex : L’école de la Prorascience" className="mt-1.5 w-full rounded-xl border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
                </div>

                {/* Couleurs */}
                <div className="rounded-2xl border lp-line lp-panel70 p-5">
                  <p className="text-[13px] font-medium lp-ink">Couleurs</p>
                  <p className="mt-0.5 text-[12px] lp-faint">L’accent pilote les boutons et éléments actifs de votre espace.</p>
                  <div className="mt-3 flex flex-wrap gap-5">
                    <div>
                      <label className="block text-[12px] font-medium lp-faint">Accent</label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#d97757'} onChange={(e) => setAccent(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border lp-line bg-transparent p-0.5" aria-label="Couleur d’accent" />
                        <input value={accent} onChange={(e) => setAccent(e.target.value)} className="w-28 rounded-lg border lp-line bg-[rgba(255,255,255,.04)] px-2.5 py-2 font-mono text-[12px] text-white focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium lp-faint">Primaire <span className="lp-faint">(optionnel)</span></label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(primary) ? primary : '#262624'} onChange={(e) => setPrimary(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border lp-line bg-transparent p-0.5" aria-label="Couleur primaire" />
                        <input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="—" className="w-28 rounded-lg border lp-line bg-[rgba(255,255,255,.04)] px-2.5 py-2 font-mono text-[12px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {brandMsg && <p className="text-[12.5px]" style={{ color: brandMsg.ok ? '#7bbf6a' : '#ef6a52' }}>{brandMsg.text}</p>}
                <button onClick={saveBranding} disabled={brandSaving} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white lp-tr disabled:opacity-50" style={{ background: 'linear-gradient(90deg,#e2855f,#c2683f)' }}>{brandSaving ? <><Loader2 size={15} className="animate-spin" /> Enregistrement…</> : <><Palette size={15} /> Enregistrer l’identité</>}</button>
              </div>
            )}
          </div>
        );
      case 'membres':
        return (
          <div>
            <Header title="Membres & équipe" subtitle="Invitez votre équipe et vos élèves — tout reste dans votre organisation." />

            <div className="mt-5 rounded-2xl border lp-line lp-panel70 p-4">
              <p className="text-[13px] font-medium lp-ink">Inviter quelqu’un</p>
              <p className="mt-0.5 text-[12px] lp-faint">Un email avec un lien d’accès lui est envoyé.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendInvite(); }} placeholder="email@exemple.com" autoComplete="off" className="min-w-0 flex-1 rounded-xl border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="rounded-xl border lp-line bg-[rgba(34,31,27,.95)] px-3 py-2.5 text-[13px] text-white focus:border-[rgba(217,119,87,.5)] focus:outline-none">
                  <option value="student">Élève</option>
                  <option value="teacher">Enseignant</option>
                  <option value="secretariat">Secrétariat</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={sendInvite} disabled={inviteSending || !inviteEmail.trim()} className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white lp-tr disabled:opacity-50" style={{ background: 'linear-gradient(90deg,#e2855f,#c2683f)' }}>{inviteSending ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Inviter</button>
              </div>
              {inviteMsg && <p className="mt-2.5 text-[12.5px]" style={{ color: inviteMsg.ok ? '#7bbf6a' : '#ef6a52' }}>{inviteMsg.text}</p>}
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] lp-faint">{memLoaded ? `${members.length} membre${members.length > 1 ? 's' : ''}` : 'Membres'}</p>
              {!memLoaded ? (
                <div className="mt-3 flex items-center gap-2 text-[13px] lp-faint"><Loader2 size={15} className="animate-spin" /> Chargement…</div>
              ) : members.length === 0 ? (
                <p className="mt-3 text-[13px] lp-faint">Personne pour l’instant — invitez votre première recrue ci-dessus.</p>
              ) : (
                <div className="mt-2.5 space-y-1.5">
                  {members.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: 'rgba(245,244,238,.08)' }}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-semibold text-white" style={{ background: 'linear-gradient(135deg,#5b7a52,#6d8f60)' }}>{(m.full_name || m.email || '?').slice(0, 2).toUpperCase()}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium lp-ink">{m.full_name || m.email || '—'}</span>{m.full_name && m.email && <span className="block truncate text-[11.5px] lp-faint">{m.email}</span>}</span>
                      <span className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: 'rgba(217,119,87,.13)', color: '#e2a07f' }}>{roleLabel(m.role)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case 'facturation':
        return (
          <div>
            <Header title="Facturation & abonnement" subtitle="Votre forfait LIRI, vos renouvellements et vos factures — sans quitter le portail." />
            <div className="mt-5 border-t lp-line">
              <Row label="Plan actuel" value={billing.label} />
              {billing.endLabel && <Row label={billing.isPaid ? 'Prochain renouvellement' : "Fin de l’essai"} value={billing.endLabel} />}
            </div>

            <div className="mt-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] lp-faint">Factures</p>
              {invoices.length === 0 ? (
                <p className="mt-3 text-[13px] lp-faint">Aucune facture pour l’instant. Elles apparaîtront ici après votre premier paiement.</p>
              ) : (
                <div className="mt-2.5 space-y-1.5">
                  {invoices.map((inv, i) => { const f = invFmt(inv); return (
                    <div key={inv?.id || i} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: 'rgba(245,244,238,.08)' }}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'rgba(217,119,87,.12)' }}><FileText size={15} className="lp-coral" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium lp-ink">{f.amount}</span><span className="block truncate text-[11.5px] lp-faint">{f.date}{f.status ? ` · ${f.status}` : ''}</span></span>
                      {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-md px-2.5 py-1 text-[11.5px] font-medium lp-muted lp-tr hover:bg-[rgba(255,255,255,.06)]" style={{ border: '1px solid rgba(245,244,238,.14)' }}>Voir</a>}
                    </div>
                  ); })}
                </div>
              )}
            </div>
          </div>
        );
      case 'encaissements':
        return (
          <div>
            <Header title="Encaissements" subtitle="Encaissez vos lives et vos cours — l’argent arrive directement sur VOTRE compte Stripe." />

            <button onClick={() => nav('/liri/finances')} className="mt-4 flex w-full items-center justify-between rounded-2xl border lp-line lp-panel70 p-4 text-left lp-tr hover:border-[rgba(217,119,87,.3)]">
              <span className="min-w-0"><span className="block text-[14px] font-medium lp-ink">Mes finances &amp; retraits</span><span className="block text-[12px] lp-faint">Voir l’argent encaissé (mobile money) et retirer sur Airtel / Moov.</span></span>
              <ArrowUpRight size={18} className="lp-coral shrink-0" />
            </button>

            {!payLoaded ? (
              <div className="mt-6 flex items-center gap-2 text-[13px] lp-faint"><Loader2 size={15} className="animate-spin" /> Chargement…</div>
            ) : stripeSet && !reconfig ? (
              <div className="mt-5 rounded-2xl border lp-line lp-panel70 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'rgba(91,122,82,.16)' }}><Check size={18} style={{ color: '#7bbf6a' }} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium lp-ink">Stripe connecté</p>
                    <p className="mt-0.5 text-[12.5px] lp-faint">Clé secrète •••• {stripeLast4 || '••••'} · chiffrée en base{stripeEnabled ? '' : ' · désactivé'}</p>
                  </div>
                </div>
                {payMsg && <p className="mt-3 text-[12.5px]" style={{ color: payMsg.ok ? '#7bbf6a' : '#ef6a52' }}>{payMsg.text}</p>}
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button onClick={testStripe} disabled={payTesting} className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[12.5px] font-medium lp-tr disabled:opacity-60" style={{ color: '#cfcac4', borderColor: 'rgba(245,244,238,.14)' }}>{payTesting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Tester la connexion</button>
                  <GhostBtn onClick={() => { setReconfig(true); setPayMsg(null); }}>Reconfigurer</GhostBtn>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border lp-line lp-panel70 p-5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg,#635bff,#4b45d6)' }}><CreditCard size={17} /></span>
                    <div><p className="text-[14px] font-medium lp-ink">Stripe — carte bancaire</p><p className="text-[12px] lp-faint">Visa, Mastercard, CB. Idéal à l’international.</p></div>
                  </div>

                  <label className="mt-5 block text-[12px] font-medium lp-faint">Clé secrète <span style={{ color: '#ef6a52' }}>*</span></label>
                  <div className="relative mt-1.5">
                    <input type={showSk ? 'text' : 'password'} value={sk} onChange={(e) => setSk(e.target.value)} placeholder="sk_live_…  ou  sk_test_…" autoComplete="off" spellCheck={false} className="w-full rounded-xl border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2.5 pr-10 font-mono text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
                    <button type="button" onClick={() => setShowSk((v) => !v)} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg lp-faint lp-tr hover:bg-[rgba(255,255,255,.06)]" aria-label="Afficher / masquer">{showSk ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>

                  <label className="mt-4 block text-[12px] font-medium lp-faint">Secret du webhook <span className="lp-faint">(signing secret)</span></label>
                  <div className="relative mt-1.5">
                    <input type={showWh ? 'text' : 'password'} value={wh} onChange={(e) => setWh(e.target.value)} placeholder="whsec_…" autoComplete="off" spellCheck={false} className="w-full rounded-xl border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2.5 pr-10 font-mono text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
                    <button type="button" onClick={() => setShowWh((v) => !v)} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg lp-faint lp-tr hover:bg-[rgba(255,255,255,.06)]" aria-label="Afficher / masquer">{showWh ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>

                  {payMsg && <p className="mt-3 text-[12.5px]" style={{ color: payMsg.ok ? '#7bbf6a' : '#ef6a52' }}>{payMsg.text}</p>}

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <button onClick={saveStripe} disabled={paySaving || !sk.trim()} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white lp-tr disabled:opacity-50" style={{ background: 'linear-gradient(90deg,#e2855f,#c2683f)' }}>{paySaving ? <><Loader2 size={15} className="animate-spin" /> Enregistrement…</> : 'Enregistrer Stripe'}</button>
                    {stripeSet && <button onClick={() => { setReconfig(false); setSk(''); setWh(''); setPayMsg(null); }} className="rounded-xl border px-4 py-2.5 text-[13px] font-medium lp-muted lp-tr" style={{ borderColor: 'rgba(245,244,238,.14)' }}>Annuler</button>}
                  </div>
                </div>

                <div className="rounded-2xl border lp-line p-4" style={{ background: 'rgba(217,119,87,.05)' }}>
                  <p className="text-[12.5px] font-medium lp-ink">Pour obtenir le secret du webhook</p>
                  <p className="mt-1 text-[12px] lp-faint">Dans Stripe → Développeurs → Webhooks → « Ajouter un endpoint », collez cette URL et choisissez l’événement <span className="font-mono lp-muted">checkout.session.completed</span> :</p>
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg border lp-line bg-[rgba(0,0,0,.25)] px-3 py-2">
                    <code className="min-w-0 flex-1 truncate font-mono text-[12px] lp-ink">{webhookUrl}</code>
                    <button onClick={copyWebhook} className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium lp-muted lp-tr hover:bg-[rgba(255,255,255,.06)]">{copied ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier</>}</button>
                  </div>
                  <p className="mt-2 text-[11.5px] lp-faint">Stripe vous donnera alors un <span className="font-mono">whsec_…</span> à coller ci-dessus. Optionnel pour démarrer, requis pour créditer l’accès automatiquement après paiement.</p>
                </div>
              </div>
            )}

            {/* Encaissement Mobile Money (PawaPay) — Orange Money / MTN MoMo / Moov… (Afrique) */}
            <LiriMobileMoneySettings />
          </div>
        );
      case 'domaine':
        return (
          <div>
            <Header title="Domaine personnalisé" subtitle="Reliez votre propre domaine — vos élèves arrivent directement sur votre espace, à vos couleurs." />
            <div className="mt-4"><LiriDomainSettings /></div>
          </div>
        );
      case 'general':
      default:
        return (
          <div>
            <Header title="Général" subtitle="Informations de votre organisation" />
            <div className="mt-5 border-t lp-line">
              {nameEditing ? (
                <div className="flex items-center gap-2 border-b lp-line py-3.5">
                  <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setNameEditing(false); }} className="min-w-0 flex-1 rounded-lg border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2 text-[14px] text-white focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
                  <button onClick={saveName} disabled={nameSaving} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white lp-tr disabled:opacity-50" style={{ background: 'linear-gradient(90deg,#e2855f,#c2683f)' }}>{nameSaving ? <Loader2 size={14} className="animate-spin" /> : 'Enregistrer'}</button>
                  <button onClick={() => setNameEditing(false)} className="shrink-0 rounded-lg border px-3 py-2 text-[12.5px] font-medium lp-muted lp-tr" style={{ borderColor: 'rgba(245,244,238,.14)' }}>Annuler</button>
                </div>
              ) : (
                <Row label="Nom de l’organisation" value={<span className="capitalize">{orgName}</span>} action={<GhostBtn onClick={() => { setNameDraft(orgName); setNameEditing(true); }}>Modifier</GhostBtn>} />
              )}
              <Row label="Identifiant" value={<span className="font-mono text-[13px]">/t/{orgSlug}</span>} />
              <Row label="Plan" value={billing.label} action={!billing.isPaid ? (
                <button onClick={() => setSection('facturation')} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-medium text-white lp-tr" style={{ background: 'linear-gradient(90deg,#e2855f,#c2683f)' }}><Sparkles size={14} /> Passer à un forfait</button>
              ) : undefined} />
            </div>

            {orgs.length > 1 && (
              <div className="mt-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] lp-faint">Vos organisations</p>
                <div className="mt-2.5 space-y-1.5">
                  {orgs.map((o) => {
                    const current = o.slug === orgSlug;
                    return (
                      <button key={o.slug} onClick={() => switchOrg(o.slug)} disabled={current} className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left lp-tr" style={current ? { borderColor: 'rgba(217,119,87,.3)', background: 'rgba(217,119,87,.06)' } : { borderColor: 'rgba(245,244,238,.08)' }}>
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-semibold text-white" style={{ background: current ? 'linear-gradient(135deg,#e2855f,#c2683f)' : 'linear-gradient(135deg,#5b7a52,#6d8f60)' }}>{(o.name || o.slug).slice(0, 2).toUpperCase()}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium capitalize lp-ink">{o.name || o.slug}</span><span className="block truncate text-[11.5px] lp-faint">/t/{o.slug}{o.role ? ` · ${o.role}` : ''}</span></span>
                        {current ? <Check size={16} className="lp-coral" /> : <span className="shrink-0 text-[11.5px] lp-faint">Basculer</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isOwner && (
              <div className="mt-8 flex items-center justify-between gap-4 border-t pt-5" style={{ borderColor: 'rgba(226,85,63,.18)' }}>
                <div className="min-w-0"><p className="text-[14px] font-medium" style={{ color: '#ef6a52' }}>Supprimer l’organisation</p><p className="mt-0.5 text-[12.5px] lp-faint">Ouvre une demande de fermeture, réversible avant traitement.</p></div>
                <GhostBtn danger onClick={() => setDelOpen(true)}>Supprimer</GhostBtn>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="lp-root relative min-h-[100dvh] w-full overflow-y-auto">
      <div className="lp-glow"><span style={{ width: 480, height: 380, left: '24%', top: -150, background: 'rgba(217,119,87,.08)' }} /></div>

      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        {/* topbar — console de réglages dédiée */}
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => nav('/liri')} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl lp-muted lp-railbtn lp-tr" aria-label="Retour au portail"><ChevronLeft size={18} /></button>
          <div className="min-w-0">
            <h1 className="lp-serif text-[22px] font-medium leading-tight">Réglages &amp; personnalisation</h1>
            <p className="text-[12.5px] lp-faint">Profil, sécurité, marque, paiements, domaine — tout votre espace au même endroit.</p>
          </div>
        </div>

        <div className="overflow-hidden" style={{ background: 'rgba(34,31,27,.55)' }}>
          <div className="md:grid md:grid-cols-[212px_1fr]">
            {/* ── SIDEBAR (desktop) ── */}
            <aside className="hidden md:flex md:flex-col gap-1 border-r lp-line p-3.5" style={{ background: 'rgba(22,19,16,.6)' }}>
              <div className="flex items-center gap-2.5 px-1.5 pb-3 pt-1">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[12px] font-semibold text-white lp-ember">{initials}</span>
                <div className="min-w-0"><p className="truncate text-[12.5px] font-medium lp-ink">{orgName}</p><p className="truncate text-[10.5px] lp-faint">{billing.label}</p></div>
              </div>
              <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.13em] lp-faint">Compte</p>
              {visibleNav.filter((n) => n.group === 'compte').map((it) => <NavBtn key={it.key} it={it} />)}
              {canManageOrg && <>
                <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.13em] lp-faint">Organisation</p>
                {visibleNav.filter((n) => n.group === 'org').map((it) => <NavBtn key={it.key} it={it} />)}
              </>}
              <button onClick={() => logout()} className="mt-3 flex items-center gap-2.5 rounded-lg border-t lp-line px-2.5 py-2 pt-3 text-[13px] lp-muted lp-tr hover:bg-[rgba(255,255,255,.04)]"><LogOut size={16} className="lp-faint" /> Déconnexion</button>
            </aside>

            {/* ── TABS (mobile) ── */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b lp-line p-2.5 md:hidden">
              {visibleNav.map((it) => <NavBtn key={it.key} it={it} horizontal />)}
              <button onClick={() => logout()} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] lp-muted lp-tr"><LogOut size={15} /></button>
            </div>

            {/* ── CONTENU ── */}
            <section className="p-5 sm:p-7">{renderPane()}</section>
          </div>
        </div>
      </div>

      {/* modale suppression */}
      {delOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4" style={{ background: 'rgba(0,0,0,.6)' }} onMouseDown={(e) => { if (e.target === e.currentTarget && !delLoading) { setDelOpen(false); setDelDone(false); setDelReason(''); } }}>
          <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border lp-line" style={{ background: '#221f1b', boxShadow: '0 40px 90px -20px rgba(0,0,0,.8)' }}>
            <div className="flex items-center justify-between border-b lp-line px-5 py-4">
              <span className="flex items-center gap-2 text-[15px] font-semibold lp-ink"><Trash2 size={17} style={{ color: '#ef6a52' }} /> Supprimer l’organisation</span>
              <button onClick={() => { if (!delLoading) { setDelOpen(false); setDelDone(false); setDelReason(''); } }} className="grid h-7 w-7 place-items-center rounded-lg lp-faint lp-railbtn lp-tr" aria-label="Fermer"><X size={16} /></button>
            </div>
            {delDone ? (
              <div className="px-5 py-6">
                <p className="text-[14px] lp-ink">Votre demande de suppression a bien été enregistrée.</p>
                <p className="mt-2 text-[12.5px] lp-faint">L’équipe Cimolace va traiter la fermeture de <span className="capitalize lp-muted">{orgName}</span>. Vous pouvez continuer à utiliser votre espace d’ici là.</p>
                <button onClick={() => { setDelOpen(false); setDelDone(false); setDelReason(''); }} className="mt-5 h-10 w-full rounded-xl text-[13.5px] font-semibold text-white lp-ember lp-tr">Fermer</button>
              </div>
            ) : (
              <div className="px-5 py-5">
                <p className="text-[13.5px] lp-muted">Cette action ouvre une <span className="lp-ink font-medium">demande de fermeture</span> de l’organisation <span className="capitalize lp-ink font-medium">{orgName}</span> auprès de l’équipe Cimolace. Vos données ne sont pas supprimées immédiatement.</p>
                <label className="mt-4 block text-[12px] font-medium lp-faint">Motif (facultatif)</label>
                <textarea value={delReason} onChange={(e) => setDelReason(e.target.value)} rows={3} placeholder="Pourquoi souhaitez-vous fermer cet espace ?" className="mt-1.5 w-full resize-none rounded-xl border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
                <div className="mt-5 flex gap-2.5">
                  <button onClick={() => { setDelOpen(false); setDelReason(''); }} disabled={delLoading} className="h-10 flex-1 rounded-xl border lp-line text-[13.5px] font-medium lp-muted lp-railbtn lp-tr disabled:opacity-50">Annuler</button>
                  <button onClick={requestDeletion} disabled={delLoading} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold text-white lp-tr disabled:opacity-60" style={{ background: 'linear-gradient(90deg,#e2553f,#c2402f)' }}>
                    {delLoading ? <><Loader2 size={15} className="animate-spin" /> Envoi…</> : 'Demander la suppression'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
