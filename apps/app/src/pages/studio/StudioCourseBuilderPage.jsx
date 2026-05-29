import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { safeDesignerReturnPathForState } from '@/lib/returnToNavigation';
import { useToast } from '@/components/ui/use-toast';
import CourseBuilderStudioBuilder from '@/components/studio/builders/CourseBuilderStudioBuilder';
import { useFormations } from '@/hooks/useFormations';
import { useFormationStructure } from '@/hooks/useFormationStructure';

function newUuid() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // ignore
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const initialDraft = {
  title: '',
  description: '',
  category: '',
  level: 'intermediaire',
  language: 'fr',
  video_url: '',
  video_storage_path: '',
  duration_seconds: 0,
  transcript: [],
  segments: [],
};

export default function StudioCourseBuilderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { createFormation } = useFormations();
  const { saveStructure } = useFormationStructure();

  const [draft, setDraft] = useState(initialDraft);
  const [creating, setCreating] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [initialNavigation, setInitialNavigation] = useState(/** @type {{ stepId: number } | null} */ (null));
  const [designerBackHref, setDesignerBackHref] = useState(/** @type {string | null} */ (null));
  const saveTimerRef = useRef(null);
  const courseBuilderPrefillAppliedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  /** Préremplissage et/ou lien retour designer depuis le dock SmartBoard (state de navigation). */
  useEffect(() => {
    const st = location.state;
    if (!st || typeof st !== 'object') return;
    if (Object.keys(st).length === 0) return;

    const rawBack = st.returnToDesigner;
    const safeBack =
      typeof rawBack === 'string' ? safeDesignerReturnPathForState(rawBack) : null;
    if (safeBack) setDesignerBackHref(safeBack);

    const prefill = st.courseBuilderPrefill;
    const hasPrefill = prefill && typeof prefill === 'object';
    if (hasPrefill && !courseBuilderPrefillAppliedRef.current) {
      courseBuilderPrefillAppliedRef.current = true;

      setDraft((prev) => ({
        ...prev,
        video_url: String(prefill.video_url ?? prev.video_url ?? ''),
        video_storage_path: String(prefill.video_storage_path ?? prev.video_storage_path ?? ''),
        title: String(prefill.title ?? prev.title ?? ''),
        description: String(prefill.description ?? prev.description ?? ''),
        duration_seconds:
          Number(prefill.duration_seconds) > 0 ? Number(prefill.duration_seconds) : prev.duration_seconds,
      }));

      if (String(prefill.video_url || '').trim()) {
        setInitialNavigation({ stepId: 2 });
      }

      toast({
        title: 'Vidéo reprise depuis le designer',
        description: 'URL et métadonnées ont été préremplies. Complétez transcription et segments puis créez la formation.',
      });
    }

    if (safeBack || hasPrefill) {
      navigate(
        { pathname: location.pathname, search: location.search, hash: location.hash },
        { replace: true, state: {} },
      );
    }
  }, [location.state, location.pathname, location.search, location.hash, navigate, toast]);

  /** Même chose que `returnToDesigner` en state, mais pour liens « nouvel onglet » (`?designerReturn=`). */
  useEffect(() => {
    const raw = searchParams.get('designerReturn');
    if (!raw) return;
    let decoded;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      return;
    }
    const safe = safeDesignerReturnPathForState(decoded);
    if (safe) setDesignerBackHref((prev) => prev ?? safe);
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete('designerReturn');
        return n;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const updateDraft = useCallback((patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setSaveStatus('saving');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
    }, 350);
  }, []);

  const onSubmit = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const { data: formation, error: formationErr } = await createFormation({
        title: draft.title,
        description: draft.description,
        category: draft.category,
        level: draft.level,
        status: 'draft',
      });
      if (formationErr || !formation?.id) {
        throw formationErr || new Error('Impossible de créer la formation');
      }

      const contentId = newUuid();
      const modules = [
        {
          id: newUuid(),
          title: 'Module IA',
          weeks: [
            {
              id: newUuid(),
              title: 'Semaine 1',
              days: [
                {
                  id: newUuid(),
                  title: 'Jour 1',
                  videos: [
                    {
                      id: contentId,
                      title: draft.title,
                      description: draft.description,
                      url: draft.video_url,
                      storagePath: draft.video_storage_path || null,
                      duration: Math.round(Number(draft.duration_seconds || 0)),
                      transcript: (draft.transcript || []).map((line) => ({
                        time: line.time || '0:00',
                        timeSeconds: line.timeSeconds ?? null,
                        text: line.text || '',
                      })),
                      chapters: (draft.segments || []).map((s) => ({
                        startText: s.startText || '',
                        endText: s.endText || '',
                        startSeconds: null,
                        endSeconds: null,
                        label: s.label || '',
                      })),
                      timestamps: (draft.segments || []).map((s) => ({
                        time: s.startText || '',
                        label: s.label || '',
                      })),
                      source: 'course_builder_ai',
                      language: draft.language || 'fr',
                    },
                  ],
                  powerpoint: null,
                  quiz: null,
                },
              ],
            },
          ],
        },
      ];

      const { error: structErr } = await saveStructure(formation.id, modules);
      if (structErr) throw structErr;

      toast({
        title: 'Cours IA créé',
        description:
          'Ouverture du SmartBoard Designer avec le panneau post-production sur ce contenu. La page dédiée reste accessible depuis le menu.',
      });
      navigate(
        `/studio/smartboard-designer?pp=${encodeURIComponent(contentId)}&returnTo=${encodeURIComponent('/studio/course-builder')}`,
      );
    } catch (e) {
      toast({ title: 'Erreur', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }, [createFormation, creating, draft, navigate, saveStructure, toast]);

  const extraStepProps = useMemo(() => ({}), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {designerBackHref ? (
        <div className="flex shrink-0 items-center justify-center border-b border-cyan-500/25 bg-cyan-950/35 px-4 py-2">
          <Link
            to={designerBackHref}
            className="text-[12px] font-semibold text-cyan-200/95 underline-offset-2 transition-colors hover:text-cyan-100 hover:underline"
          >
            ← Retour au SmartBoard Designer
          </Link>
        </div>
      ) : null}
      <CourseBuilderStudioBuilder
        draft={draft}
        updateDraft={updateDraft}
        onClose={() => navigate('/studio')}
        onSubmit={onSubmit}
        creating={creating}
        lastSavedAt={lastSavedAt}
        saveStatus={saveStatus}
        saveError={null}
        extraStepProps={extraStepProps}
        initialNavigation={initialNavigation ?? undefined}
      />
    </div>
  );
}
