import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, PlayCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import styles from './StudentForumCommunityPage.module.css';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function StudentForumCommunityPage({
  forumBasePath = '/student-school-life/forum',
  formationForumHref,
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [answersCount, setAnswersCount] = useState({});
  const [formationTitles, setFormationTitles] = useState({});
  const [search, setSearch] = useState('');
  const [openClipQuestionId, setOpenClipQuestionId] = useState(null);
  const [clipUrl, setClipUrl] = useState('');
  const clipVideoRef = useRef(null);
  const clipStopAtRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data: qRows } = await supabase
          .from('formation_student_questions')
          .select('id,formation_id,question,video_storage_path,video_url,clip_start_seconds,clip_end_seconds,created_at')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(80);

        const questions = Array.isArray(qRows) ? qRows : [];
        if (!alive) return;
        setRows(questions);

        const qIds = questions.map((q) => q.id).filter(Boolean);
        if (qIds.length > 0) {
          const { data: answers } = await supabase
            .from('formation_question_answers')
            .select('question_id,id')
            .in('question_id', qIds)
            .eq('is_public', true);
          if (!alive) return;
          const grouped = {};
          (answers || []).forEach((a) => {
            const id = a.question_id;
            grouped[id] = (grouped[id] || 0) + 1;
          });
          setAnswersCount(grouped);
        }

        const formationIds = [...new Set(questions.map((q) => q.formation_id).filter(Boolean))];
        if (formationIds.length > 0) {
          const { data: formations } = await supabase
            .from('formations')
            .select('id,title')
            .in('id', formationIds);
          if (!alive) return;
          const map = {};
          (formations || []).forEach((f) => { map[f.id] = f.title || 'Formation'; });
          setFormationTitles(map);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, []);

  const entries = useMemo(() => {
    const list = rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) => String(row?.question || '').toLowerCase().includes(q));
  }, [rows, search]);

  const buildFormationHref = useMemo(() => {
    return (formationId, questionId) => {
      if (formationForumHref) return formationForumHref(formationId, questionId);
      const q = questionId ? `?questionId=${encodeURIComponent(questionId)}` : '';
      return `${forumBasePath}/formation/${formationId}${q}`;
    };
  }, [forumBasePath, formationForumHref]);

  return (
    <main className={styles.forum} aria-label="Forum communauté">
      <div className={styles.frame}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Forum Communauté</h1>
            <p className={styles.subtitle}>Questions publiques entre élèves, réponses et extraits vidéo liés.</p>
          </div>
          <div className={styles.countPill} aria-label={`${entries.length} sujets`}>
            <span aria-hidden="true">◎</span>
            <span>{entries.length} sujets</span>
          </div>
        </header>

        <div className={styles.grid}>
          <section className={styles.main} aria-label="Liste des sujets">

            {loading ? (
              <Card className="bg-[#192734] border-white/10">
                <CardContent className="p-8 flex items-center justify-center text-gray-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" /> Chargement du forum…
                </CardContent>
              </Card>
            ) : null}

            {!loading && entries.length === 0 ? (
              <Card className="bg-[#192734] border-white/10">
                <CardContent className="p-8 text-center text-gray-400">Aucune question publique pour le moment.</CardContent>
              </Card>
            ) : null}

            {!loading ? (
              <ol className={styles.list}>
                {entries.map((q, idx) => {
                  const hasClip = Number.isFinite(Number(q.clip_start_seconds)) || Number.isFinite(Number(q.clip_end_seconds));
                  const canPlayClip = Boolean(q.video_storage_path || q.video_url);
                  const start = Number.isFinite(Number(q.clip_start_seconds)) ? Number(q.clip_start_seconds) : 0;
                  const explicitEnd = Number.isFinite(Number(q.clip_end_seconds)) ? Number(q.clip_end_seconds) : null;
                  const end = explicitEnd != null ? Math.max(start, explicitEnd) : start + 10;

                  return (
                    <li key={q.id}>
                      <article
                        className={`${styles.card} ${styles.reveal}`}
                        style={{ animationDelay: `${Math.min(14, idx) * 35}ms` }}
                      >
                        <div className={styles.cardTop}>
                          <div className={styles.formation}>
                            <MessageCircle aria-hidden="true" size={16} />
                            <span>{formationTitles[q.formation_id] || 'Formation'}</span>
                          </div>
                          <time className={styles.date} dateTime={q.created_at || undefined}>
                            {formatDate(q.created_at)}
                          </time>
                        </div>

                        <p className={styles.question}>{q.question}</p>

                        <div className={styles.metaRow} aria-label="Métadonnées">
                          <span className={styles.chip}>{answersCount[q.id] || 0} réponse(s)</span>
                          {hasClip ? (
                            <span className={`${styles.chip} ${styles.chipAccent}`}>
                              Clip {start.toFixed(1)}s → {end.toFixed(1)}s
                            </span>
                          ) : null}
                        </div>

                        <div className={styles.actions} aria-label="Actions">
                          <Link to={buildFormationHref(q.formation_id, q.id)}>
                            <span className={`${styles.btn} ${styles.btnPrimary}`}>Ouvrir le sujet</span>
                          </Link>

                          {hasClip ? (
                            <button
                              type="button"
                              className={styles.btn}
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
                                  const { data } = await supabase.storage
                                    .from('videos')
                                    .createSignedUrl(q.video_storage_path, 60 * 60);
                                  setClipUrl(data?.signedUrl || '');
                                } else {
                                  setClipUrl(String(q.video_url || ''));
                                }
                              }}
                              aria-pressed={openClipQuestionId === q.id}
                              aria-label={openClipQuestionId === q.id ? 'Fermer le clip' : 'Lire le clip'}
                            >
                              <PlayCircle aria-hidden="true" size={16} />
                              <span>{openClipQuestionId === q.id ? 'Fermer le clip' : 'Lire le clip'}</span>
                            </button>
                          ) : null}
                        </div>

                        {openClipQuestionId === q.id && clipUrl ? (
                          <div className={styles.clipWrap}>
                            <video
                              ref={clipVideoRef}
                              src={clipUrl}
                              controls
                              className={styles.video}
                              onLoadedMetadata={(e) => {
                                try {
                                  e.currentTarget.currentTime = start;
                                } catch {
                                  // ignore
                                }
                                clipStopAtRef.current = end;
                              }}
                              onTimeUpdate={(e) => {
                                const stopAt = clipStopAtRef.current;
                                if (typeof stopAt === 'number' && e.currentTarget.currentTime >= stopAt) {
                                  e.currentTarget.pause();
                                }
                              }}
                            />
                          </div>
                        ) : null}
                      </article>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </section>

          <aside className={styles.aside} aria-label="Panneau latéral">
            <h2 className={styles.asideTitle}>Recherche & repères</h2>
            <p className={styles.asideText}>
              Ce forum sert à retrouver les questions utiles et leurs clips. Filtre par mot-clé, puis ouvre le sujet pour voir les réponses.
            </p>

            <div className={styles.searchRow}>
              <label className={styles.label} htmlFor="forum-search">
                Rechercher
              </label>
              <input
                id="forum-search"
                className={styles.input}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ex: mécanique, concept, chapitre…"
                autoComplete="off"
              />
            </div>

            <div className={styles.searchRow} aria-label="Accessibilité">
              <div className={styles.label}>Clavier</div>
              <p className={styles.asideText}>
                Tab pour naviguer. Entrée/Espace pour activer les boutons. Le focus est volontairement “doré” pour rester visible.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
