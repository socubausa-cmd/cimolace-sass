import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  Globe,
  CreditCard,
  Activity,
  AlertCircle,
  ArrowRight,
  School,
  Stethoscope,
  ShoppingBag,
  Users2,
  CheckCircle2,
  Wrench,
  Clock,
  TrendingUp,
  Building2,
} from 'lucide-react';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { cimolaceBackofficeApi } from '@/lib/api-v2';
import { clientEngine } from '@/modules/cimolace/clients/clientEngine.js';
import { siteEngine } from '@/modules/cimolace/sites/siteEngine.js';
import { ticketEngine } from '@/modules/cimolace/support/ticketEngine.js';

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:       '#0d1117',
  panel:    '#161b22',
  panel2:   '#1c2128',
  border:   '#21262d',
  border2:  '#30363d',
  violet:   '#7c3aed',
  violetLt: '#8b5cf6',
  green:    '#10b981',
  orange:   '#f59e0b',
  red:      '#ef4444',
  blue:     '#3b82f6',
  text:     '#f0f6fc',
  muted:    '#8b949e',
  muted2:   '#6e7681',
};

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = '20px', r = '6px' }) {
  return (
    <div
      style={{
        width: w, height: h, borderRadius: r,
        background: `linear-gradient(90deg, ${C.panel} 25%, ${C.panel2} 50%, ${C.panel} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  );
}

// ── Live clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const day = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ color: C.muted, fontSize: '12px', textTransform: 'capitalize' }}>{day}</div>
      <div style={{ color: C.text, fontSize: '20px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{time}</div>
    </div>
  );
}

// ── Quick action card ─────────────────────────────────────────────────────────
function ActionCard({ icon: Icon, title, subtitle, to, primary, onClick }) {
  const [hov, setHov] = useState(false);
  const el = (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '16px 20px',
        background: primary
          ? hov ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.10)'
          : hov ? C.panel2 : C.panel,
        border: `1px solid ${primary ? (hov ? C.violetLt : C.violet) : (hov ? C.border2 : C.border)}`,
        borderLeft: `3px solid ${primary ? C.violet : C.border2}`,
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        flex: 1, minWidth: '180px',
        boxShadow: primary && hov ? `0 0 18px rgba(124,58,237,0.15)` : 'none',
      }}
    >
      <div style={{
        width: '38px', height: '38px', borderRadius: '8px', flexShrink: 0,
        background: primary ? 'rgba(124,58,237,0.20)' : 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={primary ? C.violetLt : C.muted} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: '14px', fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ color: C.muted2, fontSize: '12px', marginTop: '2px' }}>{subtitle}</div>}
      </div>
      <ArrowRight size={15} color={hov ? C.violetLt : C.muted2} strokeWidth={2} />
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none', display: 'contents' }}>{el}</Link> : el;
}

// ── KPI stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, accent, icon: Icon, loading, suffix }) {
  return (
    <div style={{
      flex: 1, minWidth: '140px',
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: '10px',
      padding: '18px 20px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 12, right: 14,
        opacity: 0.12,
      }}>
        {Icon && <Icon size={32} color={accent} strokeWidth={1.5} />}
      </div>
      {loading ? (
        <>
          <Skeleton h="34px" w="60px" r="6px" />
          <Skeleton h="13px" w="80%" r="4px" />
        </>
      ) : (
        <>
          <div style={{ fontSize: '32px', fontWeight: 800, color: C.text, lineHeight: 1, marginBottom: '6px', fontVariantNumeric: 'tabular-nums' }}>
            {value}{suffix && <span style={{ fontSize: '16px', color: C.muted, marginLeft: '4px' }}>{suffix}</span>}
          </div>
          <div style={{ fontSize: '12px', color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        </>
      )}
    </div>
  );
}

// ── Infrastructure type card ──────────────────────────────────────────────────
const INFRA_TYPES = [
  {
    key: 'school',
    label: 'École',
    desc: 'Template ISNA Prorascience',
    detail: '11 moteurs actifs',
    status: 'operational',
    icon: School,
    accent: C.green,
    to: '/cimolace/create-school',
    cta: 'Lancer →',
  },
  {
    key: 'medos',
    label: 'MedOS',
    desc: 'Plateforme médicale',
    detail: 'Praticiens, patients, EHR',
    status: 'operational',
    icon: Stethoscope,
    accent: C.blue,
    to: '/cimolace/admin/clients',
    cta: 'Voir clients →',
  },
  {
    key: 'mbolo',
    label: 'Mbolo',
    desc: 'Commerce & boutique',
    detail: 'Catalogue, panier, commandes',
    status: 'wip',
    icon: ShoppingBag,
    accent: C.orange,
    to: null,
    cta: 'Bientôt',
  },
  {
    key: 'community',
    label: 'Community',
    desc: 'Espace communautaire',
    detail: 'Forum, messagerie, événements',
    status: 'planned',
    icon: Users2,
    accent: C.muted2,
    to: null,
    cta: 'Planifié',
  },
];

function InfraCard({ infra }) {
  const [hov, setHov] = useState(false);
  const { icon: Icon, label, desc, detail, status, accent, to, cta } = infra;
  const active = status === 'operational';
  const content = (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov && to ? C.panel2 : C.panel,
        border: `1px solid ${hov && to ? C.border2 : C.border}`,
        borderRadius: '10px',
        padding: '20px',
        transition: 'all 0.18s ease',
        cursor: to ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: '12px',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
          background: active ? `${accent}18` : 'rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={active ? accent : C.muted2} strokeWidth={1.7} />
        </div>
        <StatusBadge status={status} />
      </div>
      <div>
        <div style={{ color: C.text, fontSize: '15px', fontWeight: 700 }}>{label}</div>
        <div style={{ color: C.muted, fontSize: '12px', marginTop: '3px' }}>{desc}</div>
        <div style={{ color: C.muted2, fontSize: '11px', marginTop: '4px', letterSpacing: '0.02em' }}>{detail}</div>
      </div>
      <div style={{ marginTop: 'auto' }}>
        <span style={{
          display: 'inline-block',
          padding: '6px 14px',
          borderRadius: '6px',
          fontSize: '12px', fontWeight: 600,
          background: to ? (hov ? accent : `${accent}22`) : 'rgba(255,255,255,0.04)',
          color: to ? (hov ? '#fff' : accent) : C.muted2,
          border: `1px solid ${to ? `${accent}44` : C.border}`,
          transition: 'all 0.18s ease',
          cursor: to ? 'pointer' : 'default',
        }}>{cta}</span>
      </div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>{content}</Link> : content;
}

function StatusBadge({ status }) {
  const map = {
    operational: { label: 'Opérationnel', color: C.green, bg: `${C.green}18`, icon: CheckCircle2 },
    wip:         { label: 'En cours',     color: C.orange, bg: `${C.orange}18`, icon: Wrench },
    planned:     { label: 'Planifié',     color: C.muted,  bg: 'rgba(255,255,255,0.06)', icon: Clock },
  };
  const s = map[status] || map.planned;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '999px',
      background: s.bg, border: `1px solid ${s.color}33`,
      fontSize: '11px', fontWeight: 600, color: s.color, flexShrink: 0,
    }}>
      <s.icon size={10} strokeWidth={2.5} />
      {s.label}
    </div>
  );
}

// ── Recent schools table ───────────────────────────────────────────────────────
function formatDate(v) {
  if (!v) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v));
  } catch { return String(v); }
}

function RecentSchoolsTable({ rows, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' }}>
        {[1,2,3].map(i => <Skeleton key={i} h="36px" r="6px" />)}
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: C.muted, fontSize: '13px' }}>
        <GraduationCap size={28} color={C.muted2} style={{ marginBottom: '8px' }} />
        <div>Aucune école provisionnée</div>
        <Link to="/cimolace/create-school" style={{ color: C.violetLt, fontSize: '12px', marginTop: '6px', display: 'inline-block' }}>
          Créer la première →
        </Link>
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {['École', 'Slug', 'Owner', 'Moteurs', 'Date'].map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '10px 16px',
                color: C.muted, fontWeight: 600, fontSize: '11px',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                borderBottom: `1px solid ${C.border}`,
                background: C.panel,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 5).map((row, i) => (
            <tr
              key={row.id || i}
              style={{ borderBottom: `1px solid ${C.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = C.panel2}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <td style={{ padding: '12px 16px', color: C.text, fontWeight: 600 }}>
                {row.new_client_id ? (
                  <Link to={`/cimolace/admin/clients/${row.new_client_id}`} style={{ color: C.text, textDecoration: 'none' }}>
                    {row.school_name || row.name || '—'}
                  </Link>
                ) : (row.school_name || row.name || '—')}
              </td>
              <td style={{ padding: '12px 16px', color: C.muted, fontFamily: 'monospace', fontSize: '12px' }}>
                {row.new_tenant_slug || '—'}
              </td>
              <td style={{ padding: '12px 16px', color: C.muted2, fontSize: '12px' }}>
                {row.owner_email || '—'}
              </td>
              <td style={{ padding: '12px 16px' }}>
                {row.engine_count != null ? (
                  <span style={{
                    padding: '2px 8px', borderRadius: '999px',
                    background: `${C.green}18`, color: C.green,
                    fontSize: '11px', fontWeight: 700,
                  }}>{row.engine_count} moteurs</span>
                ) : '—'}
              </td>
              <td style={{ padding: '12px 16px', color: C.muted2, fontSize: '12px' }}>
                {formatDate(row.provisioned_at || row.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function CimolaceAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats]               = useState(null);
  const [schools, setSchools]           = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [extraStats, setExtraStats]     = useState({ clients: 0, sites: 0, ticketsOpen: 0 });

  useEffect(() => {
    cimolaceBackofficeApi.getStats()
      .then(s => setStats(s))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));

    cimolaceBackofficeApi.listSchoolProvisionings()
      .then(rows => setSchools(Array.isArray(rows) ? rows.filter(r => !r.__warning) : []))
      .catch(() => setSchools([]))
      .finally(() => setSchoolsLoading(false));

    Promise.all([
      clientEngine.getAllClients().catch(() => []),
      siteEngine.getAllSites().catch(() => []),
      ticketEngine.getAllTickets().catch(() => []),
    ]).then(([clients, sites, tickets]) => {
      const open = tickets.filter(t => ['open','in_progress'].includes(String(t.status||'').toLowerCase())).length;
      setExtraStats({ clients: clients.length, sites: sites.length, ticketsOpen: open });
    });
  }, []);

  const totalSchools = schools.filter(r => r.id || r.new_tenant_id || r.new_tenant_slug).length;
  const apiStats = stats || {};

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        * { box-sizing: border-box; }
      `}</style>

      <CimolaceHeader />
      <div style={{ display: 'flex', flex: 1 }}>
        <CimolaceSidebar />
        <main style={{ flex: 1, padding: '28px 32px', minWidth: 0, overflowX: 'hidden' }}>

          {/* ── Hero row ── */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: '20px', flexWrap: 'wrap', marginBottom: '28px',
            padding: '24px 28px',
            background: `radial-gradient(ellipse at 0% 0%, rgba(124,58,237,0.10) 0%, transparent 60%), ${C.panel}`,
            border: `1px solid ${C.border}`,
            borderRadius: '12px',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <Building2 size={20} color={C.violetLt} strokeWidth={1.8} />
                <span style={{ color: C.muted, fontSize: '13px', fontWeight: 500 }}>Cimolace Back-Office</span>
              </div>
              <h1 style={{ color: C.text, fontSize: '26px', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                Tableau de bord opérationnel
              </h1>
              <p style={{ color: C.muted, fontSize: '13px', margin: '6px 0 0', maxWidth: '480px' }}>
                Infrastructure intelligente pour l'Afrique — pilots, provisioning et monitoring centralisés.
              </p>
            </div>
            <LiveClock />
          </div>

          {/* ── Quick actions ── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
            <ActionCard
              icon={GraduationCap}
              title="Lancer une école"
              subtitle="Wizard 3 étapes · 11 moteurs"
              to="/cimolace/create-school"
              primary
            />
            <ActionCard icon={Users}    title="Clients"       subtitle={`${extraStats.clients || (apiStats.clientsCount ?? '…')} actifs`} to="/cimolace/admin/clients" />
            <ActionCard icon={Globe}    title="Sites"          subtitle={`${extraStats.sites || (apiStats.sitesCount ?? '…')} actifs`}    to="/cimolace/admin/sites" />
            <ActionCard icon={CreditCard} title="Billing"     subtitle="Factures & paiements"                                              to="/cimolace/admin/billing" />
          </div>

          {/* ── KPI stats ── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
            <StatCard label="Clients actifs"     value={statsLoading ? '…' : (extraStats.clients || apiStats.clientsCount || 0)}  accent={C.violet}  icon={Users}        loading={statsLoading} />
            <StatCard label="Sites actifs"       value={statsLoading ? '…' : (extraStats.sites  || apiStats.sitesCount  || 0)}    accent={C.blue}    icon={Globe}        loading={statsLoading} />
            <StatCard label="Tickets ouverts"    value={statsLoading ? '…' : extraStats.ticketsOpen}                               accent={extraStats.ticketsOpen > 0 ? C.orange : C.green} icon={AlertCircle}  loading={statsLoading} />
            <StatCard label="Écoles provisionnées" value={schoolsLoading ? '…' : totalSchools}                                    accent={C.green}   icon={GraduationCap} loading={schoolsLoading} />
          </div>

          {/* ── Bottom grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: '16px', alignItems: 'start' }}>

            {/* Recent schools */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={16} color={C.green} strokeWidth={2} />
                  <span style={{ color: C.text, fontSize: '14px', fontWeight: 700 }}>Écoles récentes</span>
                  {!schoolsLoading && totalSchools > 0 && (
                    <span style={{
                      padding: '1px 8px', borderRadius: '999px',
                      background: `${C.green}18`, color: C.green,
                      fontSize: '11px', fontWeight: 700,
                    }}>{totalSchools}</span>
                  )}
                </div>
                <Link to="/cimolace/admin/school-provisioning" style={{ color: C.violetLt, fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Voir tout <ArrowRight size={12} />
                </Link>
              </div>
              <RecentSchoolsTable rows={schools} loading={schoolsLoading} />
            </div>

            {/* Infrastructure types */}
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '12px', padding: '0 4px',
              }}>
                <TrendingUp size={16} color={C.violet} strokeWidth={2} />
                <span style={{ color: C.text, fontSize: '14px', fontWeight: 700 }}>Infrastructures disponibles</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {INFRA_TYPES.map(infra => (
                  <InfraCard key={infra.key} infra={infra} />
                ))}
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
