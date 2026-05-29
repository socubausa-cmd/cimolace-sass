import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getEffectiveRole } from '@/lib/accountRoleMode';
import {
  formationForumUrlForRole,
  forumCommunityUrlForRole,
} from '@/lib/forumDashboardPaths';
import { ChevronLeft } from 'lucide-react';

export { studentFormationForumPath } from '@/lib/forumDashboardPaths';

/**
 * Contenu forum d'une formation — réutilisable en pleine page ou dans le shell
 * tableau de bord (sans quitter le layout).
 *
 * @param {{ formationId: string; embedded?: boolean; communityForumTo?: string }} props
 */
export function FormationForumContent({ formationId, embedded = false, communityForumTo = '/student-school-life/forum' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkQuestionId = String(searchParams.get('questionId') || '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formation, setFormation] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answersByQuestionId, setAnswersByQuestionId] = useState({});

  const [openClipQuestionId, setOpenClipQuestionId] = useState(null);
  const [clipUrl, setClipUrl] = useState('');
  const clipVideoRef = useRef(null);
  const clipStopAtRef = useRef(null);
  const deepLinkRef = useRef(null);

  const questionIds = useMemo(() => (questions || []).map((q) => q.id).filter(Boolean), [questions]);

  const visibleQuestions = useMemo(() => {
    if (!deepLinkQuestionId) return questions;
    const q = (questions || []).find((x) => x?.id === deepLinkQuestionId);
    return q ? [q] : questions;
  }, [deepLinkQuestionId, questions]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!formationId) return;
      setLoading(true);
      setError(null);

      try {
        const { data: formationRow, error: fErr } = await supabase
          .from('courses')
          .select('id,title,description')
          .eq('id', formationId)
          .maybeSingle();

        if (fErr) throw fErr;

        const { data: qRows, error: qErr } = await supabase
          .from('formation_student_questions')
          .select('id, formation_id, student_id, module_id, week_id, day_id, video_id, video_storage_path, video_url, question, is_public, clip_start_seconds, clip_end_seconds, created_at')
          .eq('formation_id', formationId)
          .eq('is_public', true)
          .order('created_at', { ascending: false });

        if (qErr) throw qErr;

        if (!alive) return;
        setFormation(formationRow || null);
        setQuestions(Array.isArray(qRows) ? qRows : []);
      } catch (err) {
        if (!alive) return;
        setError(String(err?.message || err || 'Erreur'));
        setFormation(null);
        setQuestions([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [formationId]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!formationId) return;
      if (questionIds.length === 0) {
        setAnswersByQuestionId({});
        return;
      }

      const { data: aRows, error: aErr } = await supabase
        .from('formation_question_answers')
        .select('id, question_id, responder_id, answer, is_public, created_at')
        .in('question_id', questionIds)
        .eq('is_public', true)
        .order('created_at', { ascending: true });

      if (!alive) return;
      if (aErr) {
        setAnswersByQuestionId({});
        return;
      }

      const grouped = {};
      (aRows || []).forEach((a) => {
        const qid = a.question_id;
        if (!qid) return;
        if (!grouped[qid]) grouped[qid] = [];
        grouped[qid].push(a);
      });

      setAnswersByQuestionId(grouped);
    };

    run();
    return () => {
      alive = false;
    };
  }, [formationId, questionIds]);

  useEffect(() => {
    if (!deepLinkQuestionId) return;
    const exists = (questions || []).some((q) => q?.id === deepLinkQuestionId);
    if (!exists) return;

    window.setTimeout(() => {
      try {
        deepLinkRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        // ignore
      }
    }, 50);
  }, [deepLinkQuestionId, questions]);

  const shell = embedded
    ? 'text-white'
    : 'min-h-screen bg-[#0F1419] text-white';

  if (loading) {
    return (
      <div className={embedded ? `${shell} py-8 text-center text-gray-400` : `${shell} p-10`}>
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className={embedded ? `${shell} space-y-4` : `${shell} p-10`}>
        {embedded ? (
          <Link
            to={communityForumTo}
            className="inline-flex items-center gap-1 text-sm text-[#D4AF37] hover:text-amber-400"
          >
            <ChevronLeft className="w-4 h-4" /> Forum communauté
          </Link>
        ) : null}
        <div className={embedded ? '' : 'max-w-2xl space-y-4'}>
          <div className="text-lg font-semibold">Forum indisponible</div>
          <div className="text-sm text-gray-300">{error}</div>
          <Button
            variant="outline"
            className="border-white/10 text-white"
            onClick={() => (embedded ? navigate(communityForumTo) : navigate(-1))}
          >
            Retour
          </Button>
        </div>
      </div>
    );
  }

  const innerMax = embedded ? 'max-w-4xl mx-auto w-full' : 'max-w-6xl mx-auto';

  return (
    <div className={embedded ? `${shell} space-y-6 animate-in fade-in duration-300` : shell}>
      {embedded ? (
        <Link
          to={communityForumTo}
          className="inline-flex items-center gap-1 text-sm text-[#D4AF37] hover:text-amber-400 mb-2"
        >
          <ChevronLeft className="w-4 h-4" /> Forum communauté
        </Link>
      ) : null}

      <div className={`${innerMax} ${embedded ? '' : 'px-4 md:px-6 pt-10 pb-6'} flex items-start justify-between gap-4`}>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-serif font-bold truncate">
            Forum — {formation?.title || 'Formation'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">Questions publiques et réponses.</p>
        </div>
        <div className="shrink-0">
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {!embedded ? (
              <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500">Forum</Button>
            ) : null}
            <Button
              variant="outline"
              className="border-white/10 text-white"
              onClick={() => navigate(`/formation/${formationId}/learn`)}
            >
              Voir le cours entier
            </Button>
          </div>
        </div>
      </div>

      <div className={`${innerMax} ${embedded ? '' : 'px-4 md:px-6 pb-16'} space-y-4`}>
        {questions.length === 0 ? (
          <Card className="bg-[#192734] border border-white/10 p-6 text-gray-300">
            Aucune question publique pour le moment.
          </Card>
        ) : (
          visibleQuestions.map((q) => {
            const answers = answersByQuestionId[q.id] || [];
            const hasClip = Number.isFinite(Number(q.clip_start_seconds)) || Number.isFinite(Number(q.clip_end_seconds));
            const fmt = (v) => {
              if (v == null || v === '') return '—';
              const n = Number(v);
              if (!Number.isFinite(n)) return '—';
              return (Math.round(n * 2) / 2).toFixed(1);
            };
            const canPlayClip = !!q.video_storage_path || !!q.video_url;
            const start = Number.isFinite(Number(q.clip_start_seconds)) ? Number(q.clip_start_seconds) : 0;
            const explicitEnd = Number.isFinite(Number(q.clip_end_seconds)) ? Number(q.clip_end_seconds) : null;
            const derivedEnd = explicitEnd != null ? explicitEnd : start + 10;
            const normalizedEnd = Math.max(start, derivedEnd);

            const isDeepLinked = deepLinkQuestionId && q.id === deepLinkQuestionId;

            return (
              <Card
                key={q.id}
                ref={isDeepLinked ? deepLinkRef : undefined}
                className={
                  isDeepLinked
                    ? 'bg-[#192734] border border-[#D4AF37]/60 p-5 space-y-3 shadow-[0_0_0_1px_rgba(212,175,55,0.25)]'
                    : 'bg-[#192734] border border-white/10 p-5 space-y-3'
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-400">
                      {new Date(q.created_at).toLocaleString()} • Vidéo: {String(q.video_id || '').slice(0, 28)}
                      {String(q.video_id || '').length > 28 ? '…' : ''}
                    </div>
                    {hasClip ? (
                      <div className="text-xs text-[#D4AF37] mt-1">
                        Séquence: {fmt(start)}s → {fmt(normalizedEnd)}s
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="text-white whitespace-pre-wrap">{q.question}</div>

                {hasClip ? (
                  <div className="border border-white/10 rounded-lg p-3 bg-black/20 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-400 uppercase tracking-wider">Clip</div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/10 text-white hover:bg-white/5"
                          disabled={!canPlayClip}
                          onClick={async () => {
                            if (!canPlayClip) return;
                            if (openClipQuestionId === q.id) {
                              setOpenClipQuestionId(null);
                              setClipUrl('');
                              clipStopAtRef.current = null;
                              return;
                            }

                            setOpenClipQuestionId(q.id);
                            setClipUrl('');
                            clipStopAtRef.current = null;

                            if (q.video_storage_path) {
                              const { data, error: err } = await supabase.storage
                                .from('videos')
                                .createSignedUrl(q.video_storage_path, 60 * 60);
                              if (!err) setClipUrl(data?.signedUrl || '');
                              return;
                            }
                            setClipUrl(String(q.video_url || ''));
                          }}
                        >
                          {openClipQuestionId === q.id ? 'Fermer' : 'Lire le clip'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/10 text-white hover:bg-white/5"
                          onClick={() => navigate(`/formation/${formationId}/learn`)}
                        >
                          Voir le cours entier
                        </Button>
                      </div>
                    </div>

                    {openClipQuestionId === q.id ? (
                      clipUrl ? (
                        <video
                          ref={clipVideoRef}
                          src={clipUrl}
                          className="w-full aspect-video rounded-lg border border-white/10 bg-black"
                          controls
                          onPlay={(e) => {
                            const s = Math.max(0, start);
                            const ee = Math.max(s, normalizedEnd);
                            try {
                              e.currentTarget.currentTime = s;
                            } catch {
                              // ignore
                            }
                            clipStopAtRef.current = ee;
                          }}
                          onTimeUpdate={(e) => {
                            const stopAt = clipStopAtRef.current;
                            if (stopAt == null) return;
                            const t = Number(e.currentTarget.currentTime);
                            if (Number.isFinite(t) && t >= stopAt - 0.05) {
                              e.currentTarget.pause();
                              clipStopAtRef.current = null;
                            }
                          }}
                        />
                      ) : (
                        <div className="text-sm text-gray-400">Chargement du clip…</div>
                      )
                    ) : null}
                  </div>
                ) : null}

                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="text-xs text-gray-400 uppercase tracking-wider">Réponses</div>
                  {answers.length === 0 ? (
                    <div className="text-sm text-gray-400">Aucune réponse pour le moment.</div>
                  ) : (
                    <div className="space-y-2">
                      {answers.map((a) => (
                        <div key={a.id} className="border border-white/10 rounded-lg p-3 bg-black/20">
                          <div className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</div>
                          <div className="text-sm text-gray-200 whitespace-pre-wrap mt-1">{a.answer}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

const FormationForumPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const role = String(getEffectiveRole(user) || '').toLowerCase();
  const questionId = String(searchParams.get('questionId') || '').trim();

  if (!id) {
    return (
      <div className="min-h-screen bg-[#0F1419] text-white p-10">
        Formation introuvable.
      </div>
    );
  }

  const dashboardShellRoles = new Set([
    'student',
    'visitor',
    'teacher',
    'secretariat',
    'owner',
    'admin',
    'creator',
  ]);
  if (dashboardShellRoles.has(role)) {
    const target = formationForumUrlForRole(role, id, questionId || null);
    return <Navigate to={target} replace />;
  }

  return (
    <FormationForumContent
      formationId={id}
      embedded={false}
      communityForumTo={forumCommunityUrlForRole(role)}
    />
  );
};

export default FormationForumPage;
