import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Award, TrendingUp, Trophy, Target, Search, X, CalendarDays, BookOpen,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useStudentNotesParityData } from '@/hooks/useStudentNotesParityData';
import { supabase } from '@/lib/customSupabaseClient';
// Thème host-aware : `T` = tokens vivants (clair sous l'espace élève, sombre sous le portail prof).
import { themeProxy as T, useSslThemeMode } from '@/pages/school/student-school-life/sslTheme';

/* ─── Utilitaires ─── */
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Mappe un libellé de type libre vers un bucket canonique.
const canonType = (raw) => {
  const n = norm(raw);
  if (/(controle|contr|quiz|test|partiel|interro)/.test(n)) return 'controle';
  if (/(devoir|dm|maison|projet|rendu|dissert)/.test(n)) return 'devoir';
  if (/(examen|exam|oral|epreuve|final)/.test(n)) return 'examen';
  if (/(recit|memoris|tajwid|coran|sourate)/.test(n)) return 'recitation';
  return 'autre';
};

const TYPE_META = {
  controle:   { label: 'Contrôle',   col: '#8B9CFF', bg: 'rgba(139,156,255,0.13)', bd: 'rgba(139,156,255,0.32)' },
  devoir:     { label: 'Devoir',     col: '#7FD1C0', bg: 'rgba(127,209,192,0.13)', bd: 'rgba(127,209,192,0.32)' },
  examen:     { label: 'Examen',     col: '#F0936B', bg: 'rgba(240,147,107,0.13)', bd: 'rgba(240,147,107,0.32)' },
  recitation: { label: 'Récitation', col: '#D4AF37', bg: 'rgba(212,175,55,0.14)',  bd: 'rgba(212,175,55,0.30)' },
  autre:      { label: 'Autre',      col: '#9AA4B2', bg: 'rgba(154,164,178,0.12)', bd: 'rgba(154,164,178,0.30)' },
};

// Ordre des pastilles de filtre (jeu canonique demandé).
const PILLS = [
  { key: 'all',        label: 'Tous' },
  { key: 'controle',   label: 'Contrôle' },
  { key: 'devoir',     label: 'Devoir' },
  { key: 'examen',     label: 'Examen' },
  { key: 'recitation', label: 'Récitation' },
];

// note /20 -> couleur (≥16 vert ≥10 or sinon rouge)
const noteColor = (on20) => (on20 >= 16 ? T.success : on20 >= 10 ? T.gold : T.danger);
// 16.5 -> "16,5" (virgule décimale FR, sans .0 superflu)
const frNum = (n) => {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ',');
};

/* ─── Pastille de filtre (avec badge mono) ─── */
const FilterPill = ({ active, label, count, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: active ? T.gold : hov ? T.surface2 : 'transparent',
        border: `1px solid ${active ? 'transparent' : hov ? T.goldMid : T.border}`,
        borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
        color: active ? '#000' : hov ? T.gold : T.t2, cursor: 'pointer', transition: 'all 160ms ease', whiteSpace: 'nowrap',
      }}>
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

/* ─── Badge de type ─── */
const TypeBadge = ({ bucket }) => {
  const tm = TYPE_META[bucket] || TYPE_META.autre;
  return (
    <span style={{
      fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
      color: tm.col, background: tm.bg, border: `1px solid ${tm.bd}`,
      borderRadius: 20, padding: '2px 9px', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{tm.label}</span>
  );
};

/* ─── Carte statistique ─── */
const StatCard = ({ Icon, label, children, delay }) => (
  <div style={{
    background: 'rgba(25,39,52,0.36)', border: `1px solid ${T.border}`, borderRadius: 16,
    padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 116,
    animation: `noFade .4s ease ${delay}ms both`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: T.goldDim, border: `1px solid ${T.goldMid}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={17} color={T.gold} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
    {children}
  </div>
);

/* ─── Ligne de note ─── */
const GradeRow = ({ g, delay }) => {
  const [hov, setHov] = useState(false);
  const col = noteColor(g.on20);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        background: hov ? 'rgba(25,39,52,0.6)' : 'rgba(25,39,52,0.34)',
        border: `1px solid ${hov ? T.goldMid : T.border}`, borderRadius: 14,
        transition: 'all 160ms ease', transform: hov ? 'translateY(-2px)' : 'none',
        animation: `noFade .4s ease ${delay}ms both`,
      }}>
      {/* Pastille date mois/jour */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minWidth: 58, height: 58, borderRadius: 12, background: 'rgba(0,0,0,0.28)', border: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{g.month || '—'}</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: T.t1, lineHeight: 1 }}>{g.day || '--'}</span>
      </div>

      {/* Sujet + type + appréciation */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <TypeBadge bucket={g.bucket} />
          <span style={{ fontSize: 14.5, fontWeight: 600, color: T.t1 }}>{g.subject}</span>
        </div>
        {g.feedback ? (
          <p style={{
            fontSize: 12.5, color: T.t3, lineHeight: 1.45, margin: 0, fontStyle: 'italic',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>« {g.feedback} »</p>
        ) : (
          <p style={{ fontSize: 12, color: T.t4, margin: 0 }}>Pas d&apos;appréciation</p>
        )}
      </div>

      {/* Pastille note color-codée */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 1, flexShrink: 0,
        background: 'rgba(0,0,0,0.28)', border: `1px solid ${T.border}`,
        borderRadius: 11, padding: '8px 13px', minWidth: 86, justifyContent: 'center',
      }}>
        <span style={{ fontFamily: T.mono, fontSize: 19, fontWeight: 700, color: col, lineHeight: 1 }}>{frNum(g.scoreShown)}</span>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.t3 }}>/{g.maxShown}</span>
      </div>
    </div>
  );
};

/* ═══════════════════════ PAGE ═══════════════════════ */
const StudentNotesPage = () => {
  useSslThemeMode(); // publie le mode (clair/sombre) pour `T` AVANT le rendu des sous-composants
  const { isDemoMode, demoData } = useDemoMode();
  const { user } = useAuth();
  // Classement (et secours notes) via le hook partagé — non modifié.
  const { gradesRows, rankingValue } = useStudentNotesParityData(isDemoMode ? null : user?.id);

  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);
  const [rows, setRows] = useState([]); // lignes brutes student_evaluations (avec comment + type)

  // Requête directe pour récupérer les colonnes supplémentaires (comment, type).
  const loadRows = useCallback(async () => {
    if (isDemoMode || !user?.id) { setRows([]); return; }
    const { data, error } = await supabase
      .from('student_evaluations')
      .select('id,title,score,max_score,evaluated_at,comment,type')
      .eq('student_id', user.id)
      .order('evaluated_at', { ascending: false })
      .limit(200);
    setRows(error ? [] : (data || []));
  }, [isDemoMode, user?.id]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  // Source de notes normalisée (démo OU réel). Secours : hook si la requête directe est vide.
  const grades = useMemo(() => {
    const raw = isDemoMode
      ? (demoData?.grades || []).map((g) => ({
          id: g.id,
          title: g.subject || 'Évaluation',
          rawType: g.type || '',
          score: Number(g.score ?? 0),
          max: Number(g.max ?? 20),
          when: g.date,
          comment: g.feedback || '',
        }))
      : (rows.length ? rows : (gradesRows || [])).map((g) => ({
          id: g.id,
          title: g.title || 'Évaluation',
          rawType: g.type || '',
          score: Number(g.score ?? 0),
          max: Number(g.max_score ?? 20),
          when: g.evaluated_at,
          comment: g.comment || '',
        }));

    return raw
      .map((g) => {
        const d = g.when ? new Date(g.when) : null;
        const ok = d && isValid(d);
        const max = g.max > 0 ? g.max : 20;
        const on20 = max > 0 ? (g.score / max) * 20 : 0;
        return {
          id: g.id,
          subject: g.title,
          feedback: g.comment,
          bucket: canonType(g.rawType || g.title),
          scoreShown: g.score,
          maxShown: max,
          on20,
          _t: ok ? d.getTime() : 0,
          month: ok ? format(d, 'MMM', { locale: fr }) : '',
          day: ok ? format(d, 'dd', { locale: fr }) : '',
        };
      })
      .sort((a, b) => b._t - a._t);
  }, [isDemoMode, demoData?.grades, rows, gradesRows]);

  // Moyenne générale /20 (null si aucune note).
  const avg = useMemo(() => {
    if (!grades.length) return null;
    const s = grades.reduce((acc, g) => acc + g.on20, 0) / grades.length;
    return Number.isFinite(s) ? s : null;
  }, [grades]);

  // Classement : valeur démo, sinon valeur du hook (format "Nᵉ / total").
  const ranking = useMemo(() => {
    const v = isDemoMode ? demoData?.stats?.ranking : rankingValue;
    if (!v || v === 'N/A') return { pos: null, total: null };
    const m = String(v).match(/(\d+)\s*\/\s*(\d+)/);
    if (m) return { pos: Number(m[1]), total: Number(m[2]) };
    const single = String(v).match(/(\d+)/);
    return { pos: single ? Number(single[1]) : null, total: null };
  }, [isDemoMode, demoData?.stats?.ranking, rankingValue]);

  // Comptes par pastille (toujours calculés sur l'ensemble des notes).
  const counts = useMemo(() => {
    const m = { all: grades.length };
    grades.forEach((g) => { m[g.bucket] = (m[g.bucket] || 0) + 1; });
    return m;
  }, [grades]);

  // Filtre actif (type + recherche, insensible aux accents).
  const q = norm(search);
  const filtered = grades.filter((g) =>
    (filterType === 'all' || g.bucket === filterType) &&
    (!q || norm(`${g.subject} ${g.feedback}`).includes(q))
  );

  const validation = avg != null ? Math.min(100, Math.max(0, (avg / 20) * 100)) : 0;
  const avgCol = avg != null ? noteColor(avg) : T.t3;

  return (
    <div style={{ paddingBottom: 32 }}>
      <style>{`
        @keyframes noFade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes noBar  { from { width: 0 } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: T.goldDim, border: `1px solid ${T.goldMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Award size={22} color={T.gold} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>Notes &amp; Résultats</h1>
            <p style={{ fontSize: 13, color: T.t3, marginTop: 3 }}>Tes résultats, ta moyenne et ton classement.</p>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20,
          padding: '5px 12px', fontFamily: T.mono, fontSize: 11, color: T.t2,
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          <span style={{ color: T.gold }}>◎</span>
          {grades.length} note{grades.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* 3 cartes statistiques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 22 }}>
        {/* Moyenne générale */}
        <StatCard Icon={TrendingUp} label="Moyenne générale" delay={0}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: T.mono, fontSize: 38, fontWeight: 700, color: avgCol, lineHeight: 1 }}>
              {avg != null ? frNum(avg) : '—'}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 16, color: T.t3 }}>/20</span>
          </div>
          <span style={{ fontSize: 12, color: T.t3 }}>
            {avg == null ? 'Aucune note pour le moment' : avg >= 16 ? 'Excellent travail' : avg >= 10 ? 'Année en bonne voie' : 'À renforcer'}
          </span>
        </StatCard>

        {/* Classement */}
        <StatCard Icon={Trophy} label="Classement" delay={60}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: T.mono, fontSize: 38, fontWeight: 700, color: ranking.pos != null ? T.gold : T.t3, lineHeight: 1 }}>
              {ranking.pos != null ? `${ranking.pos}ᵉ` : '—'}
            </span>
            {ranking.total != null && (
              <span style={{ fontFamily: T.mono, fontSize: 16, color: T.t3 }}>/ {ranking.total}</span>
            )}
          </div>
          <span style={{ fontSize: 12, color: T.t3 }}>
            {ranking.pos == null ? 'Non classé' : ranking.total != null ? `Sur ${ranking.total} élève${ranking.total !== 1 ? 's' : ''}` : 'Position dans la promotion'}
          </span>
        </StatCard>

        {/* Validation de l'année */}
        <StatCard Icon={Target} label="Validation de l'année" delay={120}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: T.mono, fontSize: 30, fontWeight: 700, color: avgCol, lineHeight: 1 }}>
              {avg != null ? Math.round(validation) : '—'}<span style={{ fontSize: 15, color: T.t3 }}>%</span>
            </span>
            <span style={{ fontSize: 11.5, color: T.t3 }}>seuil 50 %</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.border}`, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${validation}%`, borderRadius: 999,
              background: `linear-gradient(90deg, ${avgCol}, ${avgCol})`,
              animation: 'noBar .6s ease both',
            }} />
          </div>
        </StatCard>
      </div>

      {/* Filtres + recherche */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PILLS.map((p) => (
            <FilterPill key={p.key} active={filterType === p.key} label={p.label} count={counts[p.key]} onClick={() => setFilterType(p.key)} />
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
            placeholder="Rechercher une note…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: T.t1, fontSize: 13, fontFamily: 'inherit' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex', padding: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* En-tête liste */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 0 14px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: T.t1, margin: 0 }}>Relevé de notes</h2>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.t3 }}>
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Liste / état vide */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', color: T.t3, fontSize: 13,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          {grades.length === 0 ? <BookOpen size={26} color={T.t4} /> : <CalendarDays size={26} color={T.t4} />}
          {grades.length === 0
            ? 'Aucune note disponible pour le moment.'
            : (search || filterType !== 'all')
              ? 'Aucune note ne correspond à ta recherche.'
              : 'Aucune note à afficher.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((g, i) => <GradeRow key={g.id ?? i} g={g} delay={i * 40} />)}
        </div>
      )}
    </div>
  );
};

export default StudentNotesPage;
