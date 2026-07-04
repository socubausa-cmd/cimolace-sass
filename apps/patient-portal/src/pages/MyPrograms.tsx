import { useState, useEffect, useCallback } from 'react';
import { BookOpen, CheckCircle, Circle } from 'lucide-react';

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

type Program = {
  id: string;
  title: string;
  description?: string | null;
  category?: string;
  duration_days?: number | null;
};

type Step = {
  id: string;
  program_id: string;
  position: number;
  title: string;
  description?: string | null;
  step_type?: string;
  due_after_days?: number;
};

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

export function MyPrograms() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [programs, setPrograms] = useState<Record<string, Program>>({});
  const [stepsByProgram, setStepsByProgram] = useState<Record<string, Step[]>>({});
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(API + '/med/enrollments', { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      const list: Enrollment[] = d.data || d || [];
      setEnrollments(list);

      // Fetch each program + its steps
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
            const prog = pr.data || pr;
            progMap[pid] = prog;
            const steps = (st.data || st || []) as Step[];
            stepsMap[pid] = [...steps].sort((a, b) => a.position - b.position);
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
    const payload: Record<string, unknown> = {
      current_step_position: clamped,
      progress_percent: progress,
    };
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
      // Optimistic update
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
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOpen size={22} /> Mes programmes de soins
      </h2>

      {error && (
        <div style={{ marginBottom: 16, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      {enrollments.length === 0 && <p style={{ color: '#94a3b8' }}>Aucun programme assigne.</p>}

      {enrollments.map((enr) => {
        const program = programs[enr.program_id];
        const steps = stepsByProgram[enr.program_id] || [];
        const total = steps.length;
        const pos = enr.current_step_position || 0;
        const isCompleted = enr.status === 'completed';
        const isPaused = enr.status === 'paused';

        return (
          <div
            key={enr.id}
            style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: 20,
              marginBottom: 16,
              opacity: enr.status === 'abandoned' ? 0.5 : 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>
                  {program?.title || 'Programme'}
                  {isCompleted && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--brand-accent)', fontWeight: 600 }}>✓ TERMINE</span>}
                  {isPaused && <span style={{ marginLeft: 8, fontSize: 11, color: '#ea580c', fontWeight: 600 }}>EN PAUSE</span>}
                </h3>
                {program?.description && (
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{program.description}</p>
                )}
                {enr.notes && (
                  <p style={{ fontSize: 12, color: '#475569', margin: '6px 0 0', padding: 8, background: '#f8fafc', borderRadius: 6, fontStyle: 'italic' }}>
                    Note du praticien : {enr.notes}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b', flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-primary)' }}>
                  {enr.progress_percent || 0}%
                </div>
                <div>{pos}/{total} etapes</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ background: '#f1f5f9', borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 16 }}>
              <div
                style={{
                  background: isCompleted ? 'var(--brand-accent)' : 'var(--brand-primary)',
                  height: '100%',
                  width: `${enr.progress_percent || 0}%`,
                  transition: 'width 0.3s',
                }}
              />
            </div>

            {/* Steps */}
            {steps.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Aucune etape dans ce programme.</p>
            ) : (
              <ol style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
                {steps.map((s, idx) => {
                  const isDone = idx < pos;
                  const isNext = idx === pos && !isCompleted;
                  const isLocked = idx > pos;
                  return (
                    <li
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 8,
                        marginBottom: 4,
                        background: isDone ? '#ecfdf5' : isNext ? '#f0fdfa' : 'transparent',
                        border: isNext ? '1px solid var(--brand-primary)' : '1px solid transparent',
                        cursor: isDone || isNext ? 'pointer' : 'default',
                        opacity: isLocked ? 0.5 : 1,
                      }}
                      onClick={() => {
                        if (updating || isCompleted) return;
                        if (isDone) {
                          // Allow unchecking the LAST completed step only (idx === pos - 1)
                          if (idx === pos - 1) updateProgress(enr, pos - 1, total);
                        } else if (isNext) {
                          updateProgress(enr, pos + 1, total);
                        }
                      }}
                    >
                      {isDone ? (
                        <CheckCircle size={20} color="var(--brand-accent)" style={{ flexShrink: 0 }} />
                      ) : (
                        <Circle size={20} color={isNext ? 'var(--brand-primary)' : '#94a3b8'} style={{ flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: isNext ? 600 : 500,
                            color: isDone ? '#065f46' : '#0f172a',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {idx + 1}. {s.title}
                        </div>
                        {s.description && (
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.description}</div>
                        )}
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                          {s.step_type}
                          {typeof s.due_after_days === 'number' && ` · J+${s.due_after_days}`}
                          {isNext && <span style={{ color: 'var(--brand-primary)', fontWeight: 600, marginLeft: 8 }}>← A faire maintenant</span>}
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
