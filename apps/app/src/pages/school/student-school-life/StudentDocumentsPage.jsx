import React, { useEffect, useMemo, useState } from 'react';
import {
  FolderOpen, Search, X, ScrollText, Award, FileText,
  Download, ChevronDown, RefreshCw, FileWarning,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

/* ─── Thème ISNA (navy + or) ─── */
const T = {
  surface:   '#12111a',
  surface2:  'rgba(25,39,52,0.5)',
  border:    'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.12)',
  gold:      '#D4AF37',
  goldDim:   'rgba(212,175,55,0.12)',
  goldMid:   'rgba(212,175,55,0.28)',
  success:   '#22C55E',
  warning:   '#F59E0B',
  danger:    '#EF4444',
  t1: '#F5F5F7',
  t2: 'rgba(245,245,247,0.65)',
  t3: 'rgba(245,245,247,0.38)',
  t4: 'rgba(245,245,247,0.16)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

/* ─── Utilitaires ─── */
const norm = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const safeFormat = (input, fmt) => {
  if (!input) return '';
  const d = new Date(input);
  return isValid(d) ? format(d, fmt, { locale: fr }) : '';
};

const FILTERS = [
  { key: 'all',   label: 'Tous' },
  { key: 'admin', label: 'Administratifs' },
  { key: 'edu',   label: 'Pédagogiques' },
];

/* ─── Boutons ─── */
const Btn = ({ children, onClick, variant = 'ghost', disabled, title, style: extra }) => {
  const [hov, setHov] = useState(false);
  const gold = variant === 'gold';
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 10,
    padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
    cursor: disabled ? 'default' : 'pointer', textDecoration: 'none',
    transition: 'all 150ms ease', whiteSpace: 'nowrap',
    background: gold ? (hov && !disabled ? '#E5C66B' : T.gold) : (hov && !disabled ? T.surface2 : 'transparent'),
    color: gold ? '#000' : (hov && !disabled ? T.t1 : T.t2),
    border: gold ? '1px solid transparent' : `1px solid ${hov && !disabled ? T.borderMid : T.border}`,
    opacity: disabled ? 0.5 : 1, ...extra,
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={style}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </button>
  );
};

const FilterPill = ({ active, label, count, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: active ? T.gold : hov ? T.surface2 : 'transparent',
        border: `1px solid ${active ? 'transparent' : hov ? T.goldMid : T.border}`,
        borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
        color: active ? '#000' : hov ? T.gold : T.t2, cursor: 'pointer', transition: 'all 160ms ease', whiteSpace: 'nowrap',
      }}
    >
      {label}
      {count != null && count > 0 && (
        <span style={{
          fontFamily: T.mono, fontSize: 10, fontWeight: 700,
          color: active ? '#000' : T.gold, background: active ? 'rgba(0,0,0,0.14)' : T.goldDim,
          borderRadius: 999, padding: '0 6px', minWidth: 16, textAlign: 'center',
        }}>{count}</span>
      )}
    </button>
  );
};

const TypeBadge = ({ label, col }) => (
  <span style={{
    fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em',
    color: col, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
    borderRadius: 6, padding: '2px 8px', textTransform: 'uppercase', whiteSpace: 'nowrap',
  }}>{label}</span>
);

/* ─── Ligne document (certificat / administratif / démo) ─── */
const DocRow = ({ icon: Icon, iconCol, title, subtitle, badgeLabel, badgeCol, actionLabel, actionDisabled, actionTitle, onAction, delay }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        background: hov ? 'rgba(25,39,52,0.6)' : 'rgba(25,39,52,0.34)',
        border: `1px solid ${hov ? T.goldMid : T.border}`, borderRadius: 14,
        transition: 'all 160ms ease', transform: hov ? 'translateY(-1px)' : 'none',
        animation: `docFade .4s ease ${delay}ms both`,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: 'rgba(0,0,0,0.28)',
        border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} color={iconCol} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: T.t1 }}>{title}</span>
          {badgeLabel && <TypeBadge label={badgeLabel} col={badgeCol} />}
        </div>
        <div style={{ fontSize: 12, color: T.t3 }}>{subtitle}</div>
      </div>

      <Btn variant="gold" disabled={actionDisabled} title={actionTitle} onClick={onAction} style={{ flexShrink: 0 }}>
        <Download size={14} /> {actionLabel}
      </Btn>
    </div>
  );
};

/* ─── Ligne compte-rendu (pédagogique, expansible) ─── */
const ReportRow = ({ title, subtitle, text, delay }) => {
  const [hov, setHov] = useState(false);
  const [open, setOpen] = useState(false);
  const hasText = !!String(text || '').trim();
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '14px 16px',
        background: hov || open ? 'rgba(25,39,52,0.6)' : 'rgba(25,39,52,0.34)',
        border: `1px solid ${hov || open ? T.goldMid : T.border}`, borderRadius: 14,
        transition: 'all 160ms ease', animation: `docFade .4s ease ${delay}ms both`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: 'rgba(0,0,0,0.28)',
          border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FileText size={20} color="#8B9CFF" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: T.t1 }}>{title}</span>
            <TypeBadge label="Compte-rendu" col="#8B9CFF" />
          </div>
          <div style={{ fontSize: 12, color: T.t3 }}>{subtitle}</div>
        </div>

        <Btn
          onClick={() => setOpen((o) => !o)}
          disabled={!hasText}
          title={hasText ? undefined : 'Aucun contenu disponible'}
          style={{ flexShrink: 0 }}
        >
          {open ? 'Masquer' : 'Voir le compte-rendu'}
          <ChevronDown size={14} style={{ transition: 'transform 180ms ease', transform: open ? 'rotate(180deg)' : 'none' }} />
        </Btn>
      </div>

      {open && hasText && (
        <div style={{
          marginTop: 12, padding: '12px 14px', background: 'rgba(0,0,0,0.26)',
          border: `1px solid ${T.border}`, borderRadius: 11,
          fontSize: 13, lineHeight: 1.6, color: T.t2, whiteSpace: 'pre-wrap',
          animation: 'docFade .3s ease both',
        }}>
          {text}
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ children }) => (
  <div style={{
    textAlign: 'center', padding: '44px 24px', color: T.t3, fontSize: 13,
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
  }}>{children}</div>
);

/* ═══════════════════════ PAGE ═══════════════════════ */
const StudentDocumentsPage = () => {
  const { isDemoMode, demoData, restrictedAction } = useDemoMode();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);
  const [tab, setTab] = useState('all');

  const [certificates, setCertificates] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(!isDemoMode);
  const [reloadKey, setReloadKey] = useState(0);

  /* ─── Chargement (tables lisibles par l'élève) ─── */
  useEffect(() => {
    if (isDemoMode || !user?.id) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      const [certRes, repRes] = await Promise.all([
        supabase
          .from('certificates')
          .select('id,title,file_url,issued_at')
          .eq('student_id', user.id)
          .order('issued_at', { ascending: false }),
        supabase
          .from('student_live_reports')
          .select('id,report_text,created_at')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false }),
      ]);
      if (!alive) return;
      setCertificates(Array.isArray(certRes.data) ? certRes.data : []);
      setReports(Array.isArray(repRes.data) ? repRes.data : []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [isDemoMode, user?.id, reloadKey]);

  /* ─── Normalisation en items uniformes ─── */
  const adminItems = useMemo(() => {
    if (isDemoMode) {
      return (demoData?.documents?.admin || []).map((d, i) => ({
        id: `demo-admin-${d.id ?? i}`,
        kind: 'demo',
        cat: 'admin',
        title: d.name || 'Document',
        date: d.date || '',
        size: d.size || '',
        searchText: d.name || '',
      }));
    }
    return certificates.map((c) => ({
      id: `cert-${c.id}`,
      kind: 'certificate',
      cat: 'admin',
      title: c.title || 'Document administratif',
      issuedAt: c.issued_at,
      fileUrl: c.file_url || null,
      searchText: c.title || '',
    }));
  }, [isDemoMode, demoData, certificates]);

  const eduItems = useMemo(() => {
    if (isDemoMode) {
      return (demoData?.documents?.academic || []).map((d, i) => ({
        id: `demo-edu-${d.id ?? i}`,
        kind: 'demo',
        cat: 'edu',
        title: d.name || 'Document',
        date: d.date || '',
        size: d.size || '',
        searchText: d.name || '',
      }));
    }
    return reports.map((r) => ({
      id: `rep-${r.id}`,
      kind: 'report',
      cat: 'edu',
      title: 'Compte-rendu de session',
      createdAt: r.created_at,
      text: r.report_text || '',
      searchText: `compte-rendu session ${r.report_text || ''}`,
    }));
  }, [isDemoMode, demoData, reports]);

  const counts = {
    admin: adminItems.length,
    edu: eduItems.length,
    all: adminItems.length + eduItems.length,
  };

  const q = norm(search);
  const matches = (it) => !q || norm(it.searchText).includes(q);
  const visibleAdmin = adminItems.filter(matches);
  const visibleEdu = eduItems.filter(matches);

  const showAdmin = tab === 'all' || tab === 'admin';
  const showEdu = tab === 'all' || tab === 'edu';
  const totalVisible =
    (showAdmin ? visibleAdmin.length : 0) + (showEdu ? visibleEdu.length : 0);

  /* ─── Téléchargements ─── */
  const downloadCertificate = (it) => {
    if (it.fileUrl) {
      window.open(it.fileUrl, '_blank', 'noopener');
    } else {
      restrictedAction('Téléchargement');
    }
  };
  const downloadDemo = () => restrictedAction('Téléchargement du document');

  /* ─── Rendu d'un item administratif ─── */
  const renderAdmin = (it, idx) => {
    if (it.kind === 'demo') {
      return (
        <DocRow
          key={it.id}
          icon={ScrollText}
          iconCol={T.gold}
          title={it.title}
          subtitle={[it.date && `Ajouté le ${it.date}`, it.size].filter(Boolean).join(' • ') || 'Document administratif'}
          badgeLabel="PDF"
          badgeCol="#E0795F"
          actionLabel="Télécharger"
          onAction={downloadDemo}
          delay={idx * 40}
        />
      );
    }
    const dateLabel = safeFormat(it.issuedAt, 'd MMMM yyyy');
    const hasFile = !!it.fileUrl;
    return (
      <DocRow
        key={it.id}
        icon={hasFile ? Award : FileWarning}
        iconCol={hasFile ? T.gold : T.t3}
        title={it.title}
        subtitle={
          hasFile
            ? `Délivré le ${dateLabel || '—'}`
            : `Délivré le ${dateLabel || '—'} • fichier bientôt disponible`
        }
        badgeLabel="PDF"
        badgeCol="#E0795F"
        actionLabel={hasFile ? 'Télécharger' : 'Bientôt'}
        actionDisabled={!hasFile}
        actionTitle={hasFile ? undefined : 'Le fichier sera disponible prochainement'}
        onAction={() => downloadCertificate(it)}
        delay={idx * 40}
      />
    );
  };

  /* ─── Rendu d'un item pédagogique ─── */
  const renderEdu = (it, idx) => {
    if (it.kind === 'demo') {
      return (
        <DocRow
          key={it.id}
          icon={FileText}
          iconCol="#8B9CFF"
          title={it.title}
          subtitle={[it.date && `Ajouté le ${it.date}`, it.size].filter(Boolean).join(' • ') || 'Document pédagogique'}
          badgeLabel="PDF"
          badgeCol="#8B9CFF"
          actionLabel="Télécharger"
          onAction={downloadDemo}
          delay={idx * 40}
        />
      );
    }
    return (
      <ReportRow
        key={it.id}
        title={it.title}
        subtitle={`Disponible le ${safeFormat(it.createdAt, 'd MMMM yyyy') || '—'}`}
        text={it.text}
        delay={idx * 40}
      />
    );
  };

  return (
    <div style={{ paddingBottom: 16 }}>
      <style>{`
        @keyframes docFade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes docSpin { to { transform: rotate(360deg) } }
        @keyframes docPulse { 0%,100% { opacity: .45 } 50% { opacity: .8 } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: T.goldDim, border: `1px solid ${T.goldMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <FolderOpen size={22} color={T.gold} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>Documents</h1>
            <p style={{ fontSize: 13, color: T.t3, marginTop: 3 }}>Tes attestations, relevés et comptes-rendus.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!isDemoMode && (
            <Btn onClick={() => setReloadKey((k) => k + 1)} disabled={loading} title="Actualiser">
              <RefreshCw size={14} style={loading ? { animation: 'docSpin 1s linear infinite' } : undefined} /> Actualiser
            </Btn>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20,
            padding: '5px 12px', fontFamily: T.mono, fontSize: 11, color: T.t2,
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            <span style={{ color: T.gold }}>◎</span>
            {counts.all} document{counts.all !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Filtres + recherche */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <FilterPill key={f.key} active={tab === f.key} label={f.label} count={counts[f.key]} onClick={() => setTab(f.key)} />
          ))}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', minWidth: 220, flex: '1 1 240px', maxWidth: 360,
          background: T.surface, border: `1px solid ${focused ? T.goldMid : T.border}`, borderRadius: 11, padding: '8px 12px', transition: 'border-color 150ms ease',
        }}>
          <Search size={15} color={T.t3} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Rechercher un document…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: T.t1, fontSize: 13, fontFamily: 'inherit' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex', padding: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Chargement */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              height: 74, borderRadius: 14, background: 'rgba(25,39,52,0.34)',
              border: `1px solid ${T.border}`, animation: 'docPulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 90}ms`,
            }} />
          ))}
        </div>
      ) : totalVisible === 0 ? (
        <EmptyState>
          {search
            ? `Aucun document pour « ${search} ».`
            : tab === 'admin'
              ? 'Aucun document administratif pour le moment.'
              : tab === 'edu'
                ? 'Aucun compte-rendu pédagogique pour le moment.'
                : 'Aucun document disponible pour le moment.'}
        </EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {/* Section Administratifs */}
          {showAdmin && (
            <section>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 12px' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: T.t1, margin: 0 }}>Administratifs</h2>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.t3 }}>
                  {visibleAdmin.length} document{visibleAdmin.length !== 1 ? 's' : ''}
                </span>
              </div>
              {visibleAdmin.length === 0 ? (
                <EmptyState>
                  {search ? `Aucun document administratif pour « ${search} ».` : 'Aucun document administratif pour le moment.'}
                </EmptyState>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {visibleAdmin.map((it, i) => renderAdmin(it, i))}
                </div>
              )}
            </section>
          )}

          {/* Section Pédagogiques */}
          {showEdu && (
            <section>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 12px' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: T.t1, margin: 0 }}>Pédagogiques</h2>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.t3 }}>
                  {visibleEdu.length} document{visibleEdu.length !== 1 ? 's' : ''}
                </span>
              </div>
              {visibleEdu.length === 0 ? (
                <EmptyState>
                  {search ? `Aucun compte-rendu pour « ${search} ».` : 'Aucun compte-rendu pédagogique pour le moment.'}
                </EmptyState>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {visibleEdu.map((it, i) => renderEdu(it, i))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentDocumentsPage;
