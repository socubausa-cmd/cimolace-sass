/**
 * Catalogue public de cours d'une école spécifique.
 * Route : /t/:tenantSlug/courses
 * Public (non protégé) — les visiteurs peuvent parcourir.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { coursesApi } from '@/lib/api-v2';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const C = {
  bg: '#0d1117', panel: '#161b22', border: '#21262d',
  text: '#f0f6fc', muted: '#8b949e',
};

function CourseCard({ course, tenantSlug, accent, user }) {
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);

  const isPaid = (course.price_cents ?? 0) > 0;
  const price = isPaid ? `${(course.price_cents / 100).toFixed(0)} ${course.currency?.toUpperCase() ?? 'EUR'}` : 'Gratuit';

  return (
    <div
      onClick={() => navigate(user ? `/t/${tenantSlug}/courses/${course.id}` : `/t/${tenantSlug}/login`)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.panel, border: `1px solid ${hover ? accent : C.border}`,
        borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.15s', transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? `0 8px 24px rgba(0,0,0,0.3)` : 'none',
      }}
    >
      {/* Thumbnail */}
      <div style={{
        height: '160px', background: `linear-gradient(135deg, ${accent}22, ${accent}08)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px',
      }}>
        {course.cover_image ? (
          <img src={course.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : '📚'}
      </div>

      {/* Body */}
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: 0, lineHeight: '1.4', flex: 1 }}>
            {course.title}
          </h3>
        </div>
        {course.description && (
          <p style={{ color: C.muted, fontSize: '12px', lineHeight: '1.5', margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {course.description}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700,
            background: isPaid ? `${accent}20` : 'rgba(16,185,129,0.15)',
            color: isPaid ? accent : '#10b981',
          }}>
            {price}
          </span>
          {course.lesson_count > 0 && (
            <span style={{ color: C.muted, fontSize: '11px' }}>{course.lesson_count} leçons</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ height: '160px', background: '#1c2128', animation: 'pulse 1.5s infinite' }} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ height: '14px', background: '#1c2128', borderRadius: '4px', width: '80%', animation: 'pulse 1.5s infinite' }} />
        <div style={{ height: '11px', background: '#1c2128', borderRadius: '4px', width: '60%', animation: 'pulse 1.5s infinite' }} />
      </div>
    </div>
  );
}

export default function SchoolCoursesPage() {
  const { tenantSlug } = useParams();
  const { branding } = useTenantBranding();
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const accent = branding?.accentColor ?? '#7c3aed';
  const schoolName = branding?.name ?? tenantSlug;

  useEffect(() => {
    coursesApi.list()
      .then((data) => setCourses(Array.isArray(data) ? data.filter((c) => c.status === 'published' || c.status === 'active') : []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  const filtered = courses.filter((c) =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '24px 32px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {branding?.logo && <img src={branding.logo} alt="" style={{ height: '32px', objectFit: 'contain' }} />}
            <div>
              <h1 style={{ color: C.text, fontSize: '18px', fontWeight: 800, margin: 0 }}>{schoolName}</h1>
              <p style={{ color: C.muted, fontSize: '12px', margin: 0 }}>Catalogue des formations</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {user ? (
              <Link to={`/t/${tenantSlug}/admin`} style={{ padding: '8px 16px', borderRadius: '8px', background: accent, color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>
                Mon espace
              </Link>
            ) : (
              <>
                <Link to={`/t/${tenantSlug}/login`} style={{ padding: '8px 14px', borderRadius: '8px', border: `1px solid ${C.border}`, color: C.muted, textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
                  Connexion
                </Link>
                <Link to={`/t/${tenantSlug}/signup`} style={{ padding: '8px 16px', borderRadius: '8px', background: accent, color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>
                  S'inscrire
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Search */}
        <div style={{ marginBottom: '24px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: '14px' }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une formation…"
            style={{
              width: '100%', padding: '11px 14px 11px 38px', borderRadius: '8px',
              border: `1px solid ${C.border}`, background: C.panel,
              color: C.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Count */}
        {!loading && (
          <p style={{ color: C.muted, fontSize: '13px', marginBottom: '16px' }}>
            {filtered.length} formation{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : filtered.length === 0
              ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: C.muted, fontSize: '14px' }}>
                  {search ? `Aucun résultat pour "${search}"` : 'Aucune formation disponible pour le moment.'}
                </div>
              )
              : filtered.map((course) => (
                <CourseCard key={course.id} course={course} tenantSlug={tenantSlug} accent={accent} user={user} />
              ))
          }
        </div>
      </div>
    </div>
  );
}
