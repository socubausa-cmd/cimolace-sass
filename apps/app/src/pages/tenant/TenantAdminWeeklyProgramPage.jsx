/**
 * TenantAdminWeeklyProgramPage — /t/:tenantSlug/admin/parcours-scolaires/:pathId/semaines
 * Gestion du programme hebdomadaire d'un parcours scolaire.
 * Navigation semaine en sidebar gauche, éditeur de jours à droite.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CalendarDays, BookOpen, Loader2, ChevronRight, Layers } from 'lucide-react';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';
import WeekDayEditorPanel from '@/components/liri/liri-ecosystem/WeekDayEditorPanel';
import WeekGrammarTemplateSelector from '@/components/liri/liri-ecosystem/WeekGrammarTemplateSelector';
import { supabase } from '@/lib/supabase';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function SidebarWeekItem({ week, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
        background: isSelected ? T.goldDim : 'transparent',
        borderLeft: isSelected ? `3px solid ${T.gold}` : '3px solid transparent',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'background 0.12s',
      }}
    >
      <div>
        <div style={{ color: isSelected ? T.gold : T.t1, fontSize: 13, fontWeight: isSelected ? 700 : 500 }}>
          {week.title || `Semaine ${week.week_number ?? week.order ?? '?'}`}
        </div>
        {week.subtitle && (
          <div style={{ color: T.t3, fontSize: 11, marginTop: 2 }}>{week.subtitle}</div>
        )}
      </div>
      <ChevronRight size={14} style={{ color: isSelected ? T.gold : T.t4, flexShrink: 0 }} />
    </button>
  );
}

/* ─── Page principale ─────────────────────────────────────────────────────── */
export default function TenantAdminWeeklyProgramPage() {
  const { tenantSlug, pathId } = useParams();

  const [path, setPath]               = useState(null);
  const [weeks, setWeeks]             = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  /* Chargement du parcours + semaines via la chaîne nested */
  useEffect(() => {
    if (!pathId) return;
    setLoading(true);

    Promise.all([
      // Titre du parcours
      supabase
        .from('school_paths')
        .select('id, title, tenant_slug')
        .eq('id', pathId)
        .single(),

      // Semaines via la chaîne school_paths -> path_courses -> course_modules -> module_weeks
      supabase
        .from('module_weeks')
        .select(`
          id,
          title,
          subtitle,
          week_number,
          order,
          course_module:module_id (
            id,
            title,
            path_course:path_courses (
              id,
              path_id
            )
          )
        `)
        .order('order', { ascending: true }),
    ])
      .then(([pathRes, weeksRes]) => {
        if (pathRes.error) throw pathRes.error;
        setPath(pathRes.data);

        // Filtrer uniquement les semaines appartenant à ce pathId
        const allWeeks = weeksRes.data ?? [];
        const filtered = allWeeks.filter((w) => {
          const pathCourse = w.course_module?.path_course;
          if (!pathCourse) return false;
          if (Array.isArray(pathCourse)) return pathCourse.some((pc) => pc.path_id === pathId);
          return pathCourse.path_id === pathId;
        });

        setWeeks(filtered);
        if (filtered.length > 0) setSelectedWeek(filtered[0]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [pathId]);

  /* Appliquer un template de grammaire hebdomadaire */
  function handleApplyTemplate(template) {
    setShowTemplateSelector(false);
    // Le template est passé à WeekDayEditorPanel si une semaine est sélectionnée
    // On transmet via un state dédié ; le panel s'occupe de l'écriture
    if (!selectedWeek) return;
    setSelectedWeek((prev) => ({ ...prev, _pendingTemplate: template }));
  }

  if (loading) return (
    <TenantAdminShell>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.t3, padding: 40 }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Chargement du programme…
      </div>
    </TenantAdminShell>
  );

  if (error) return (
    <TenantAdminShell>
      <p style={{ color: T.danger, padding: 16 }}>{error}</p>
    </TenantAdminShell>
  );

  return (
    <TenantAdminShell>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.t3, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link to={`/t/${tenantSlug}/admin`} style={{ color: T.t3, textDecoration: 'none' }}>Tableau de bord</Link>
        <ChevronRight size={12} />
        <Link to={`/t/${tenantSlug}/admin/parcours-scolaires`} style={{ color: T.t3, textDecoration: 'none' }}>Parcours scolaires</Link>
        <ChevronRight size={12} />
        <span style={{ color: T.t2 }}>{path?.title ?? 'Parcours'}</span>
      </div>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: T.goldDim, border: `1px solid ${T.goldMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CalendarDays size={20} style={{ color: T.gold }} />
          </div>
          <div>
            <h1 style={{ color: T.t1, fontSize: 20, fontWeight: 800, margin: 0 }}>
              Programme hebdomadaire
            </h1>
            {path?.title && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <BookOpen size={12} style={{ color: T.t3 }} />
                <span style={{ color: T.t3, fontSize: 12 }}>{path.title}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bouton "Appliquer template" */}
        <button
          onClick={() => setShowTemplateSelector(true)}
          disabled={!selectedWeek}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px',
            background: selectedWeek ? T.goldDim : T.surfaceSoft,
            border: `1px solid ${selectedWeek ? T.goldMid : T.border}`,
            borderRadius: 8, cursor: selectedWeek ? 'pointer' : 'not-allowed',
            color: selectedWeek ? T.gold : T.t3, fontSize: 13, fontWeight: 600,
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          <Layers size={14} />
          Appliquer template
        </button>
      </div>

      {/* Sélecteur de template (overlay inline) */}
      {showTemplateSelector && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 16, padding: 28, width: '100%', maxWidth: 640,
            maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: T.t1, fontSize: 16, fontWeight: 700, margin: 0 }}>Sélectionner un template</h2>
              <button
                onClick={() => setShowTemplateSelector(false)}
                style={{ background: 'none', border: 'none', color: T.t3, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <WeekGrammarTemplateSelector
              pathId={pathId}
              weekId={selectedWeek?.id}
              onApply={handleApplyTemplate}
              onCancel={() => setShowTemplateSelector(false)}
            />
          </div>
        </div>
      )}

      {/* Layout principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Sidebar semaines */}
        <div style={{
          background: T.surfaceCard, border: `1px solid ${T.border}`,
          borderRadius: 14, overflow: 'hidden', position: 'sticky', top: 16,
        }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: T.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Semaines</span>
            <span style={{ color: T.t3, fontSize: 11 }}>{weeks.length}</span>
          </div>

          {weeks.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <CalendarDays size={24} style={{ color: T.t4, marginBottom: 8 }} />
              <p style={{ color: T.t3, fontSize: 12, margin: 0 }}>Aucune semaine configurée pour ce parcours.</p>
            </div>
          ) : (
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              {weeks.map((week) => (
                <SidebarWeekItem
                  key={week.id}
                  week={week}
                  isSelected={selectedWeek?.id === week.id}
                  onClick={() => setSelectedWeek(week)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Panneau principal — éditeur de jours */}
        <div>
          {!selectedWeek ? (
            <div style={{
              background: T.surfaceCard, border: `1px solid ${T.border}`,
              borderRadius: 14, padding: 40, textAlign: 'center',
            }}>
              <CalendarDays size={36} style={{ color: T.t4, marginBottom: 12 }} />
              <p style={{ color: T.t3, fontSize: 14 }}>
                {weeks.length === 0
                  ? 'Ce parcours ne contient pas encore de semaines. Ajoutez des modules et des semaines depuis l\'éditeur de cours.'
                  : 'Sélectionnez une semaine dans la liste pour éditer son programme journalier.'}
              </p>
            </div>
          ) : (
            <WeekDayEditorPanel
              weekId={selectedWeek.id}
              weekTitle={selectedWeek.title || `Semaine ${selectedWeek.week_number ?? selectedWeek.order ?? ''}`}
              pathId={pathId}
              pendingTemplate={selectedWeek._pendingTemplate}
              onTemplateClear={() =>
                setSelectedWeek((prev) => {
                  const { _pendingTemplate, ...rest } = prev;
                  return rest;
                })
              }
            />
          )}
        </div>
      </div>
    </TenantAdminShell>
  );
}
