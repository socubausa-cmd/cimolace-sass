import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const C = { bg: '#0d1117', panel: '#161b22', border: '#21262d', text: '#f0f6fc', muted: '#8b949e', violet: '#7c3aed', green: '#10b981', orange: '#f59e0b' };

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export default function TenantAdminCalendarPage() {
  const { tenantSlug } = useParams();
  const { branding } = useTenantBranding();
  const accent = branding?.accentColor ?? C.violet;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay + 6) % 7;

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) => d === now.getDate() && month === now.getMonth() && year === now.getFullYear();

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 24px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <Link to={`/t/${tenantSlug}/admin`} style={{ color: C.muted, textDecoration: 'none', fontSize: '13px' }}>← Tableau de bord</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>📅</span>
            <h1 style={{ color: C.text, fontSize: '22px', fontWeight: 800, margin: 0 }}>Calendrier école</h1>
          </div>
          <Link
            to={`/t/${tenantSlug}/admin/lives`}
            style={{
              padding: '8px 16px', background: accent, color: '#fff',
              borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '13px',
            }}
          >
            + Nouveau live
          </Link>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          {/* Nav mois */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '18px', cursor: 'pointer', padding: '4px 8px' }}>‹</button>
            <span style={{ color: C.text, fontSize: '16px', fontWeight: 700 }}>{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '18px', cursor: 'pointer', padding: '4px 8px' }}>›</button>
          </div>

          {/* Grille jours */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${C.border}` }}>
            {DAYS.map((d) => (
              <div key={d} style={{ padding: '10px 0', textAlign: 'center', color: C.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {cells.map((day, i) => (
              <div
                key={i}
                style={{
                  minHeight: '72px', padding: '8px',
                  borderRight: (i + 1) % 7 !== 0 ? `1px solid ${C.border}` : 'none',
                  borderBottom: i < cells.length - 7 ? `1px solid ${C.border}` : 'none',
                  position: 'relative',
                }}
              >
                {day && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: isToday(day) ? accent : 'transparent',
                    color: isToday(day) ? '#fff' : C.muted,
                    fontSize: '12px', fontWeight: isToday(day) ? 800 : 400,
                  }}>
                    {day}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: C.muted, fontSize: '12px', textAlign: 'center', marginTop: '16px' }}>
          Les événements de cours et lives apparaissent automatiquement dans le calendrier.
        </p>
      </div>
    </div>
  );
}
