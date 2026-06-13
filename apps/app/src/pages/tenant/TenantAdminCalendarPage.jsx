import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export default function TenantAdminCalendarPage() {
  const { tenantSlug } = useParams();

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
    <TenantAdminShell>
      <Link to={`/t/${tenantSlug}/admin`} style={{ color: T.t3, textDecoration: 'none', fontSize: 13 }}>← Tableau de bord</Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 24px', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: T.goldDim, border: `1px solid ${T.goldMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CalendarIcon size={20} style={{ color: T.gold }} />
          </div>
          <h1 style={{ color: T.t1, fontSize: 22, fontWeight: 800, margin: 0 }}>Calendrier école</h1>
        </div>
        <Link
          to={`/t/${tenantSlug}/admin/lives`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', background: T.gold, color: '#000',
            borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13,
          }}
        >
          <Plus size={15} /> Nouveau live
        </Link>
      </div>

      <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {/* Nav mois */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: T.t2, cursor: 'pointer', padding: '4px 8px', display: 'inline-flex' }}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ color: T.t1, fontSize: 16, fontWeight: 700 }}>{MONTHS[month]} {year}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: T.t2, cursor: 'pointer', padding: '4px 8px', display: 'inline-flex' }}>
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Grille jours */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${T.border}` }}>
          {DAYS.map((d) => (
            <div key={d} style={{ padding: '10px 0', textAlign: 'center', color: T.t3, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((day, i) => (
            <div
              key={i}
              style={{
                minHeight: 72, padding: 8,
                borderRight: (i + 1) % 7 !== 0 ? `1px solid ${T.border}` : 'none',
                borderBottom: i < cells.length - 7 ? `1px solid ${T.border}` : 'none',
                position: 'relative',
              }}
            >
              {day && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: '50%',
                  background: isToday(day) ? T.gold : 'transparent',
                  color: isToday(day) ? '#000' : T.t2,
                  fontSize: 12, fontWeight: isToday(day) ? 800 : 400,
                }}>
                  {day}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <p style={{ color: T.t3, fontSize: 12, textAlign: 'center', marginTop: 16 }}>
        Les événements de cours et lives apparaissent automatiquement dans le calendrier.
      </p>
    </TenantAdminShell>
  );
}
