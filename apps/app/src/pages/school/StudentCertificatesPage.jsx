import React, { useEffect, useState } from 'react';
import { Award, Download, RefreshCw, FileWarning } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import Header from '@/components/Header';

/* ─── Thème ISNA (navy + or) ─── */
const T = {
  surface:   '#12111a',
  surface2:  'rgba(25,39,52,0.5)',
  border:    'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.12)',
  gold:      '#D4AF37',
  goldDim:   'rgba(212,175,55,0.12)',
  goldMid:   'rgba(212,175,55,0.28)',
  t1: '#F5F5F7',
  t2: 'rgba(245,245,247,0.65)',
  t3: 'rgba(245,245,247,0.38)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

const safeFormat = (input, fmt) => {
  if (!input) return '—';
  const d = new Date(input);
  return isValid(d) ? format(d, fmt, { locale: fr }) : '—';
};

/* ─── Bouton ─── */
const Btn = ({ children, onClick, variant = 'ghost', disabled, title, style: extra }) => {
  const [hov, setHov] = useState(false);
  const gold = variant === 'gold';
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 10,
        padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 150ms ease', whiteSpace: 'nowrap',
        background: gold ? (hov && !disabled ? '#E5C66B' : T.gold) : (hov && !disabled ? T.surface2 : 'transparent'),
        color: gold ? '#000' : (hov && !disabled ? T.t1 : T.t2),
        border: gold ? '1px solid transparent' : `1px solid ${hov && !disabled ? T.borderMid : T.border}`,
        opacity: disabled ? 0.5 : 1, ...extra,
      }}
    >
      {children}
    </button>
  );
};

/* ─── Carte certificat ─── */
const CertCard = ({ cert, idx }) => {
  const [hov, setHov] = useState(false);
  const hasFile = !!cert.file_url;
  const dateLabel = safeFormat(cert.issued_at, 'd MMMM yyyy');

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
        background: hov ? 'rgba(25,39,52,0.6)' : 'rgba(25,39,52,0.34)',
        border: `1px solid ${hov ? T.goldMid : T.border}`,
        borderRadius: 14, transition: 'all 160ms ease',
        transform: hov ? 'translateY(-1px)' : 'none',
        animation: `certFade .4s ease ${idx * 50}ms both`,
      }}
    >
      {/* Icône */}
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: hasFile ? T.goldDim : 'rgba(0,0,0,0.28)',
        border: `1px solid ${hasFile ? T.goldMid : T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {hasFile
          ? <Award size={22} color={T.gold} />
          : <FileWarning size={22} color={T.t3} />}
      </div>

      {/* Infos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.t1, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cert.title || 'Certificat'}
        </div>
        <div style={{ fontSize: 12, color: T.t3 }}>
          {hasFile
            ? `Délivré le ${dateLabel}`
            : `Délivré le ${dateLabel} · fichier bientôt disponible`}
        </div>
      </div>

      {/* Action */}
      <Btn
        variant={hasFile ? 'gold' : 'ghost'}
        disabled={!hasFile}
        title={hasFile ? 'Télécharger le certificat' : 'Fichier non encore disponible'}
        onClick={() => hasFile && window.open(cert.file_url, '_blank', 'noopener')}
        style={{ flexShrink: 0 }}
      >
        <Download size={14} />
        {hasFile ? 'Télécharger' : 'Bientôt'}
      </Btn>
    </div>
  );
};

/* ─── Squelette chargement ─── */
const Skeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} style={{
        height: 82, borderRadius: 14,
        background: 'rgba(25,39,52,0.34)',
        border: `1px solid ${T.border}`,
        animation: 'certPulse 1.4s ease-in-out infinite',
        animationDelay: `${i * 100}ms`,
      }} />
    ))}
  </div>
);

/* ═════════════════════════ PAGE ════════════════════════════ */
const StudentCertificatesPage = () => {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const { data, error: err } = await supabase
        .from('certificates')
        .select('id,title,file_url,issued_at')
        .eq('student_id', user.id)
        .order('issued_at', { ascending: false });
      if (!alive) return;
      if (err) {
        setError(err.message);
      } else {
        setCertificates(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id, reloadKey]);

  return (
    <div style={{ minHeight: '100vh', background: T.surface, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes certFade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes certPulse { 0%,100% { opacity: .45 } 50% { opacity: .8 } }
        @keyframes certSpin { to { transform: rotate(360deg) } }
      `}</style>

      <Header />

      <main style={{ flex: 1, paddingTop: 96, padding: '96px 20px 40px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        {/* ── En-tête ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: T.goldDim, border: `1px solid ${T.goldMid}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Award size={24} color={T.gold} />
            </div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: T.t1, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
                Mes Certificats
              </h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 4, margin: '4px 0 0' }}>
                Diplômes et certifications obtenus sur votre parcours ISNA.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Btn onClick={() => setReloadKey((k) => k + 1)} disabled={loading} title="Actualiser">
              <RefreshCw size={14} style={loading ? { animation: 'certSpin 1s linear infinite' } : undefined} />
              Actualiser
            </Btn>
            {!loading && !error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 20, padding: '5px 12px',
                fontFamily: T.mono, fontSize: 11, color: T.t2, whiteSpace: 'nowrap',
              }}>
                <span style={{ color: T.gold }}>◎</span>
                {certificates.length} certificat{certificates.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* ── Contenu ── */}
        {loading ? (
          <Skeleton />
        ) : error ? (
          <div style={{
            textAlign: 'center', padding: '40px 24px', color: 'rgba(239,68,68,0.8)',
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 14, fontSize: 13,
          }}>
            Erreur lors du chargement des certificats. Veuillez réessayer.
          </div>
        ) : certificates.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '56px 24px',
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 14, color: T.t3, fontSize: 13, lineHeight: 1.6,
          }}>
            <Award size={36} color={T.t3} style={{ marginBottom: 14, opacity: 0.4 }} />
            <div style={{ fontWeight: 600, fontSize: 15, color: T.t2, marginBottom: 8 }}>
              Aucun certificat pour l'instant
            </div>
            <div>Continuez votre parcours — vos certificats apparaitront ici une fois obtenus.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {certificates.map((cert, i) => (
              <CertCard key={cert.id} cert={cert} idx={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentCertificatesPage;
