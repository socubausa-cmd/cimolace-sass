import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  BookOpen,
  CheckCircle,
  Circle,
  Calendar,
  Sparkles,
  ChevronDown,
  Utensils,
  ShoppingCart,
  Info,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type Enrollment = {
  id: string;
  program_id: string;
  patient_id: string;
  current_step_position: number;
  progress_percent: number;
  status: string;
  enrolled_at: string;
  notes?: string | null;
};

type I18nMap = Record<string, string> | null;

type Program = {
  id: string;
  title: string;
  description?: string | null;
  category?: string;
  duration_days?: number | null;
  title_i18n?: I18nMap;
  description_i18n?: I18nMap;
};

type Step = {
  id: string;
  program_id: string;
  position: number;
  title: string;
  description?: string | null;
  step_type?: string;
  due_after_days?: number;
  content_md?: string | null;
  title_i18n?: I18nMap;
  description_i18n?: I18nMap;
  content_md_i18n?: I18nMap;
};

// Choisit la valeur localisée si présente, sinon la colonne de base (fallback).
function loc(base: string | null | undefined, i18n: I18nMap | undefined, l: string): string {
  return (i18n && i18n[l]) || base || '';
}

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

// Rendu markdown léger (gras + puces + sauts de ligne), sans dépendance ni HTML brut.
function Markdown({ md }: { md: string }) {
  const lines = (md || '').split('\n');
  const inline = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      /^\*\*[^*]+\*\*$/.test(p) ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>,
    );
  return (
    <div style={{ fontSize: 13, lineHeight: 1.6, color: '#3a3632' }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        const bullet = /^\s*[-*]\s+/.test(line);
        const heading = /^\s*#{1,4}\s+/.test(line);
        const text = line.replace(/^\s*[-*]\s+/, '').replace(/^\s*#{1,4}\s+/, '');
        if (bullet)
          return (
            <div key={i} style={{ display: 'flex', gap: 8, margin: '1px 0' }}>
              <span style={{ color: '#b0aaa2' }}>•</span>
              <span>{inline(text)}</span>
            </div>
          );
        if (heading)
          return (
            <div key={i} style={{ fontWeight: 700, marginTop: 6 }}>
              {inline(text)}
            </div>
          );
        return <div key={i}>{inline(line)}</div>;
      })}
    </div>
  );
}

function Collapsible({
  title,
  icon,
  defaultOpen = false,
  accent,
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  accent?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid #ece7e1', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 14px',
          background: open ? '#faf8f5' : '#fff',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: 14,
          fontWeight: 600,
          color: accent || '#1e1e1e',
        }}
      >
        {icon}
        <span style={{ flex: 1 }}>{title}</span>
        <ChevronDown size={17} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: '#b0aaa2' }} />
      </button>
      {open && <div style={{ padding: '4px 14px 14px' }}>{children}</div>}
    </div>
  );
}

export function MyPrograms() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [programs, setPrograms] = useState<Record<string, Program>>({});
  const [stepsByProgram, setStepsByProgram] = useState<Record<string, Step[]>>({});
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<string>(() => localStorage.getItem('portal_locale') || 'fr');
  const setLang = (l: string) => {
    localStorage.setItem('portal_locale', l);
    setLocale(l);
  };

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(API + '/med/enrollments', { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      const list: Enrollment[] = d.data || d || [];
      setEnrollments(list);

      const progIds = Array.from(new Set(list.map((e) => e.program_id)));
      const progMap: Record<string, Program> = {};
      const stepsMap: Record<string, Step[]> = {};
      await Promise.all(
        progIds.map(async (pid) => {
          try {
            const [pr, st] = await Promise.all([
              fetch(API + '/med/programs/' + pid, { headers: authHeaders() }).then((r) => r.json()),
              fetch(API + '/med/programs/' + pid + '/steps', { headers: authHeaders() }).then((r) => r.json()),
            ]);
            progMap[pid] = pr.data || pr;
            const steps = (st.data || st || []) as Step[];
            // Tri calendaire : jour puis position.
            stepsMap[pid] = [...steps].sort(
              (a, b) => (a.due_after_days ?? 0) - (b.due_after_days ?? 0) || a.position - b.position,
            );
          } catch {
            /* ignore one prog */
          }
        }),
      );
      setPrograms(progMap);
      setStepsByProgram(stepsMap);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function updateProgress(enrollment: Enrollment, newPosition: number, totalSteps: number) {
    if (updating) return;
    setUpdating(enrollment.id);
    setError(null);
    const clamped = Math.max(0, Math.min(newPosition, totalSteps));
    const progress = totalSteps > 0 ? Math.round((clamped / totalSteps) * 100) : 0;
    const isDone = clamped >= totalSteps && totalSteps > 0;
    const payload: Record<string, unknown> = { current_step_position: clamped, progress_percent: progress };
    if (isDone) payload.status = 'completed';
    try {
      const res = await fetch(API + '/med/enrollments/' + enrollment.id, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      setEnrollments((prev) =>
        prev.map((e) =>
          e.id === enrollment.id
            ? { ...e, current_step_position: clamped, progress_percent: progress, status: isDone ? 'completed' : e.status }
            : e,
        ),
      );
    } catch (err: any) {
      setError(err?.message || 'Echec de la mise a jour');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={22} /> {locale === 'en' ? 'My programs' : 'Mes programmes'}
        </h2>
        <div style={{ display: 'flex', border: '1px solid #ece7e1', borderRadius: 99, overflow: 'hidden', fontSize: 12, fontWeight: 600 }}>
          {['fr', 'en'].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                padding: '5px 12px',
                border: 'none',
                cursor: 'pointer',
                background: locale === l ? 'var(--brand-primary)' : '#fff',
                color: locale === l ? '#fff' : '#8a8580',
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      {enrollments.length === 0 && <p style={{ color: '#b0aaa2' }}>Aucun programme assigné.</p>}

      {enrollments.map((enr) => {
        const program = programs[enr.program_id];
        const steps = stepsByProgram[enr.program_id] || [];
        const total = steps.length;
        const pos = enr.current_step_position || 0;
        const isCompleted = enr.status === 'completed';
        const isPaused = enr.status === 'paused';

        // Décodage des conventions de l'agent générateur.
        const rituals = steps.filter((s) => /^rituels/i.test(s.title));
        const days = steps
          .filter((s) => /^jour\s/i.test(s.title))
          .sort((a, b) => (a.due_after_days ?? 0) - (b.due_after_days ?? 0));
        const recipes = steps.filter((s) => s.position >= 100 && s.position < 300);
        const shopping = steps.filter((s) => s.position === 300 || /course/i.test(s.title));
        const disclaimer = steps.filter((s) => s.position >= 400 || /avertiss/i.test(s.title));
        const isCalendar = days.length > 0;

        // Jour "aujourd'hui" = jours écoulés depuis l'inscription (borné à la durée).
        const dayLen = 86400000;
        const elapsed = Math.floor((Date.now() - new Date(enr.enrolled_at).getTime()) / dayLen);
        const maxDay = (program?.duration_days || days.length || 1) - 1;
        const todayIdx = Math.max(0, Math.min(elapsed, maxDay));

        return (
          <div
            key={enr.id}
            style={{
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #ece7e1',
              padding: 20,
              marginBottom: 16,
              opacity: enr.status === 'abandoned' ? 0.5 : 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontWeight: 600, fontSize: 17, margin: 0 }}>
                  {loc(program?.title, program?.title_i18n, locale) || 'Programme'}
                  {isCompleted && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--brand-accent)', fontWeight: 600 }}>✓ TERMINÉ</span>}
                  {isPaused && <span style={{ marginLeft: 8, fontSize: 11, color: '#ea580c', fontWeight: 600 }}>EN PAUSE</span>}
                </h3>
                {program?.description && <p style={{ fontSize: 13, color: '#8a8580', margin: '4px 0 0' }}>{loc(program.description, program.description_i18n, locale)}</p>}
                {enr.notes && (
                  <p style={{ fontSize: 12, color: '#475569', margin: '6px 0 0', padding: 8, background: '#fafaf8', borderRadius: 6, fontStyle: 'italic' }}>
                    Note du praticien : {enr.notes}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: '#8a8580', flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-primary)' }}>{enr.progress_percent || 0}%</div>
                <div>{pos}/{total} étapes</div>
              </div>
            </div>

            <div style={{ background: '#f4f0ea', borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ background: isCompleted ? 'var(--brand-accent)' : 'var(--brand-primary)', height: '100%', width: `${enr.progress_percent || 0}%`, transition: 'width 0.3s' }} />
            </div>

            {steps.length === 0 ? (
              <p style={{ fontSize: 13, color: '#b0aaa2', fontStyle: 'italic' }}>Aucune étape dans ce programme.</p>
            ) : isCalendar ? (
              // ─── VUE CALENDRIER (programme nutrition / parcours par jour) ───
              <div>
                {rituals.map((r) => (
                  <div key={r.id} style={{ background: '#fbf7ee', border: '1px solid #efe3c8', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: '#8a6d1a', marginBottom: 6 }}>
                      <Sparkles size={16} /> {loc(r.title, r.title_i18n, locale)}
                    </div>
                    {r.content_md && <Markdown md={loc(r.content_md, r.content_md_i18n, locale)} />}
                  </div>
                ))}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#8a8580', margin: '4px 0 8px' }}>
                  <Calendar size={16} /> {locale === 'en' ? 'CALENDAR' : 'CALENDRIER'}
                </div>
                {days.map((day) => {
                  const isToday = (day.due_after_days ?? 0) === todayIdx && !isCompleted;
                  return (
                    <Collapsible
                      key={day.id}
                      defaultOpen={isToday}
                      accent={isToday ? 'var(--brand-primary)' : undefined}
                      icon={isToday ? <Circle size={16} fill="var(--brand-primary)" color="var(--brand-primary)" /> : <Circle size={16} color="#cfc8bf" />}
                      title={
                        <span>
                          {loc(day.title, day.title_i18n, locale)}
                          {isToday && <span style={{ marginLeft: 8, fontSize: 11, background: 'var(--brand-primary)', color: '#fff', padding: '1px 7px', borderRadius: 99 }}>{locale === 'en' ? 'Today' : "Aujourd'hui"}</span>}
                        </span>
                      }
                    >
                      {day.content_md ? <Markdown md={loc(day.content_md, day.content_md_i18n, locale)} /> : <span style={{ color: '#b0aaa2', fontSize: 13 }}>—</span>}
                    </Collapsible>
                  );
                })}

                {recipes.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Collapsible title={`${locale === 'en' ? 'Recipe library' : 'Bibliothèque de recettes'} (${recipes.length})`} icon={<Utensils size={16} color="var(--brand-primary)" />}>
                      {recipes.map((rec) => (
                        <Collapsible key={rec.id} title={loc(rec.title, rec.title_i18n, locale).replace(/^📖\s*(Recette|Recipe)\s*—\s*/i, '')}>
                          {rec.content_md ? <Markdown md={loc(rec.content_md, rec.content_md_i18n, locale)} /> : null}
                        </Collapsible>
                      ))}
                    </Collapsible>
                  </div>
                )}

                {shopping.map((sh) => (
                  <Collapsible key={sh.id} title={loc(sh.title, sh.title_i18n, locale)} icon={<ShoppingCart size={16} color="var(--brand-primary)" />}>
                    {sh.content_md ? <Markdown md={loc(sh.content_md, sh.content_md_i18n, locale)} /> : null}
                  </Collapsible>
                ))}

                {disclaimer.map((dc) => (
                  <div key={dc.id} style={{ marginTop: 10, padding: '10px 12px', background: '#fafaf8', borderRadius: 8, fontSize: 11, color: '#8a8580', display: 'flex', gap: 8 }}>
                    <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>{dc.content_md ? <Markdown md={loc(dc.content_md, dc.content_md_i18n, locale)} /> : loc(dc.title, dc.title_i18n, locale)}</div>
                  </div>
                ))}
              </div>
            ) : (
              // ─── VUE CHECKLIST LINÉAIRE (programmes de soins génériques) ───
              <ol style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
                {steps.map((s, idx) => {
                  const isDone = idx < pos;
                  const isNext = idx === pos && !isCompleted;
                  const isLocked = idx > pos;
                  return (
                    <li
                      key={s.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                        background: isDone ? '#ecfdf5' : isNext ? '#f0fdfa' : 'transparent',
                        border: isNext ? '1px solid var(--brand-primary)' : '1px solid transparent',
                        cursor: isDone || isNext ? 'pointer' : 'default', opacity: isLocked ? 0.5 : 1,
                      }}
                      onClick={() => {
                        if (updating || isCompleted) return;
                        if (isDone) { if (idx === pos - 1) updateProgress(enr, pos - 1, total); }
                        else if (isNext) updateProgress(enr, pos + 1, total);
                      }}
                    >
                      {isDone ? <CheckCircle size={20} color="var(--brand-accent)" style={{ flexShrink: 0, marginTop: 1 }} /> : <Circle size={20} color={isNext ? 'var(--brand-primary)' : '#b0aaa2'} style={{ flexShrink: 0, marginTop: 1 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: isNext ? 600 : 500, color: isDone ? '#065f46' : '#1e1e1e', textDecoration: isDone ? 'line-through' : 'none' }}>
                          {idx + 1}. {loc(s.title, s.title_i18n, locale)}
                        </div>
                        {s.description && <div style={{ fontSize: 12, color: '#8a8580', marginTop: 2 }}>{loc(s.description, s.description_i18n, locale)}</div>}
                        {s.content_md && <div style={{ marginTop: 4 }}><Markdown md={loc(s.content_md, s.content_md_i18n, locale)} /></div>}
                        <div style={{ fontSize: 11, color: '#b0aaa2', marginTop: 2 }}>
                          {s.step_type}
                          {typeof s.due_after_days === 'number' && ` · J+${s.due_after_days}`}
                          {isNext && <span style={{ color: 'var(--brand-primary)', fontWeight: 600, marginLeft: 8 }}>← À faire maintenant</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}
