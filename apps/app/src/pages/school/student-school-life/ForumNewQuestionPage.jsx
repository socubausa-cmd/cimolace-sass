import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, PlayCircle, GraduationCap, Loader2, CheckCircle2, Clapperboard } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';
import UnifiedVideoPlayer from '@/components/lesson-player/unified/UnifiedVideoPlayer';
import { fromReplay } from '@/components/lesson-player/unified/fromReplay';

/**
 * Poser une question = TOUJOURS sur une vidéo DÉJÀ existante (aucun upload — trop de
 * stockage). L'élève : (1) cherche/choisit une vidéo — cours ou replay ; (2) la charge ;
 * (3) marque un extrait (IN/OUT) sur la timeline ; (4) pose sa question sur cet extrait ;
 * il peut en poser une autre (nouvel extrait) et ainsi de suite. On réutilise
 * UnifiedVideoPlayer (+ ClipQuestionComposer, clip obligatoire) et la RPC
 * post_topic_question (référence contexte + clip_start/end — pas de fichier stocké).
 */

const T = {
  coral: '#d97757', cream: '#f5f1e9',
  t2: 'rgba(245,241,233,0.72)', t3: 'rgba(245,241,233,0.5)',
  card: 'rgba(255,247,240,0.03)', cardHover: 'rgba(255,247,240,0.06)',
  line: 'rgba(245,241,233,0.10)', mono: "'JetBrains Mono','Fira Code',monospace",
};

const fmtDate = (v) => {
  if (!v) return '';
  try { return new Date(v).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

export default function ForumNewQuestionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const forumBase = (location.pathname.split('/forum')[0] || '') + '/forum';

  const [loading, setLoading] = useState(true);
  const [replays, setReplays] = useState([]);
  const [courseVideos, setCourseVideos] = useState([]);
  const [query, setQuery] = useState('');

  const [selected, setSelected] = useState(null); // { source, contextType, contextId, data, title }
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [asking, setAsking] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [justSent, setJustSent] = useState(false);

  // 1) Vidéos disponibles : replays (GET /lives terminés) + cours (formation_day_contents).
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const token = authStore.getToken();
      const slug = authStore.getTenantSlug?.() || '';
      try {
        const res = await fetch(`${getApiBaseUrl()}/lives`, { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } });
        const j = await res.json().catch(() => ({}));
        const arr = j?.data ?? j;
        const past = (Array.isArray(arr) ? arr : []).filter((s) => s.status === 'ended' || s.status === 'completed' || s.ended_at);
        if (alive) setReplays(past.map((s) => ({ id: s.id, title: s.title || 'Réunion', date: s.ended_at || s.started_at || s.scheduled_at })));
      } catch { /* noop */ }
      // Vidéos de cours : course_lessons(video_url) → module → cours. Le CONTEXTE forum
      // d'une question de cours est le COURS (post_topic_question résout le tenant via
      // `courses.id`), donc on remonte jusqu'à courses.id.
      try {
        const [lessonsRes, modulesRes, coursesRes] = await Promise.all([
          supabase.from('course_lessons').select('id, title, video_url, module_id').limit(400),
          supabase.from('course_modules').select('id, course_id').limit(400),
          supabase.from('courses').select('id, title').limit(400),
        ]);
        const modToCourse = new Map((modulesRes?.data || []).map((m) => [m.id, m.course_id]));
        const courseTitle = new Map((coursesRes?.data || []).map((c) => [c.id, c.title]));
        const vids = (lessonsRes?.data || [])
          .filter((l) => l.video_url)
          .map((l) => {
            const courseId = modToCourse.get(l.module_id);
            return { id: l.id, title: l.title || 'Leçon', videoUrl: l.video_url, courseId, courseTitle: courseTitle.get(courseId) };
          })
          .filter((v) => v.courseId);
        if (alive) setCourseVideos(vids);
      } catch { /* noop */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  // 2) Sélection → adaptateur → UnifiedPlayerData.
  const pickReplay = async (r) => {
    setLoadingVideo(true);
    try {
      const { data: room } = await supabase.rpc('get_replay_room', { p_session_id: r.id });
      const session = room?.session || { id: r.id, title: r.title };
      const data = fromReplay({ session, state: room?.state || null, posterUrl: room?.state?.replay_poster_url || session?.cover_image_url });
      setSelected({ source: 'replay', contextType: 'live', contextId: r.id, data, title: data.title });
      setSentCount(0);
    } catch { window.alert('Impossible de charger ce replay. Réessaie.'); }
    finally { setLoadingVideo(false); }
  };
  const pickCourse = (c) => {
    // video_url direct (bucket public / URL) → resolution 'direct'. Contexte = COURS.
    const data = {
      lessonId: c.id, title: c.title,
      video: { url: c.videoUrl, resolution: 'direct' },
      chapters: [], timestamps: [], transcript: [], mindmap: null,
      enableQuiz: false, enableQuestion: true, notesScope: 'lesson', source: 'course',
    };
    setSelected({ source: 'course', contextType: 'course', contextId: c.courseId, data, title: data.title });
    setSentCount(0);
  };

  // 3) Poser la question sur l'extrait → RPC (référence, pas d'upload).
  const handleAsk = async ({ question, clipStart, clipEnd, isPublic }) => {
    if (clipStart == null || clipEnd == null) return;
    setAsking(true);
    try {
      await supabase.rpc('post_topic_question', {
        p_context_type: selected.contextType,
        p_context_id: selected.contextId,
        p_question: question,
        p_clip_start: clipStart,
        p_clip_end: clipEnd,
        p_is_public: isPublic,
      });
      setSentCount((c) => c + 1);
      setJustSent(true);
      setTimeout(() => setJustSent(false), 1600);
    } catch { window.alert("La question n'a pas pu être envoyée. Réessaie."); }
    finally { setAsking(false); }
  };

  const q = query.trim().toLowerCase();
  const fReplays = useMemo(() => replays.filter((r) => !q || (r.title || '').toLowerCase().includes(q)), [replays, q]);
  const fCourses = useMemo(() => courseVideos.filter((c) => !q || (c.title || '').toLowerCase().includes(q)), [courseVideos, q]);
  const nothing = !loading && fReplays.length === 0 && fCourses.length === 0;

  // ————————————————————————————————————————————————————————————— rendu

  if (selected) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '4px 0 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button onClick={() => setSelected(null)} style={backBtn()}>← Changer de vidéo</button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: T.coral, textTransform: 'uppercase' }}>
              {selected.source === 'replay' ? 'Replay' : 'Cours'} · Poser une question sur un extrait
            </div>
            <h1 style={{ fontSize: 19, fontWeight: 700, color: T.cream, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.title}</h1>
          </div>
          {sentCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, fontFamily: T.mono, fontSize: 11.5, fontWeight: 700, color: justSent ? '#7bbf6a' : T.coral, background: 'rgba(217,119,87,0.10)', border: `1px solid rgba(217,119,87,0.28)`, borderRadius: 20, padding: '4px 11px' }}>
              <CheckCircle2 size={13} /> {sentCount} envoyée{sentCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <p style={{ fontSize: 13, color: T.t2, margin: '0 0 14px', lineHeight: 1.5 }}>
          Place-toi sur la vidéo, <strong style={{ color: T.cream }}>définis un extrait (IN → OUT)</strong>, écris ta question, envoie —
          puis recommence pour en poser une autre. Rien n'est réuploadé : ta question pointe simplement ce moment de la vidéo.
        </p>

        <UnifiedVideoPlayer data={selected.data} layout="embed" onAskQuestion={handleAsk} requireClip />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={() => navigate(forumBase)} style={{ ...backBtn(), color: T.t2 }}>
            {sentCount > 0 ? 'Terminer' : 'Retour au forum'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '4px 0 40px' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <button onClick={() => navigate(forumBase)} style={backBtn()}><ArrowLeft size={16} /></button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.cream, margin: 0 }}>Poser une question</h1>
      </div>
      <p style={{ fontSize: 13.5, color: T.t2, margin: '0 0 18px 44px' }}>
        Choisis une vidéo de ton cours ou un replay, puis pose ta question sur un extrait précis.
      </p>

      {/* Recherche */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: T.t3 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un cours, un replay…"
          style={{ width: '100%', padding: '11px 14px 11px 38px', borderRadius: 11, background: '#1a1714', border: `1px solid ${T.line}`, color: T.cream, fontSize: 14, outline: 'none' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.t3, fontFamily: T.mono, fontSize: 10, letterSpacing: '0.12em' }}>CHARGEMENT…</div>
      ) : loadingVideo ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '48px 0', color: T.t2 }}>
          <Loader2 size={16} className="animate-spin" /> Chargement de la vidéo…
        </div>
      ) : nothing ? (
        <div style={{ textAlign: 'center', padding: '44px 20px', color: T.t3, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14 }}>
          <p style={{ color: T.t2, fontSize: 14, margin: '0 0 4px' }}>Aucune vidéo disponible pour l'instant.</p>
          <p style={{ fontSize: 12.5, margin: 0 }}>Les replays de tes lives et les vidéos de cours apparaîtront ici.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {fReplays.length > 0 && (
            <Section icon={PlayCircle} label="Replays" count={fReplays.length}>
              {fReplays.map((r) => (
                <VideoRow key={r.id} icon={PlayCircle} title={r.title} sub={fmtDate(r.date)} onClick={() => pickReplay(r)} />
              ))}
            </Section>
          )}
          {fCourses.length > 0 && (
            <Section icon={GraduationCap} label="Vidéos de cours" count={fCourses.length}>
              {fCourses.map((c) => (
                <VideoRow key={c.id} icon={Clapperboard} title={c.title} sub={c.courseTitle || 'Leçon'} onClick={() => pickCourse(c)} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, label, count, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={15} style={{ color: T.coral }} />
        <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: T.cream, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.t3, background: T.card, border: `1px solid ${T.line}`, borderRadius: 20, padding: '1px 8px' }}>{count}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function VideoRow({ icon: Icon, title, sub, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '12px 15px', borderRadius: 12,
        background: hover ? T.cardHover : T.card, border: `1px solid ${hover ? 'rgba(217,119,87,0.32)' : T.line}`,
        transition: 'background .14s, border-color .14s',
      }}
    >
      <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'rgba(217,119,87,0.12)', color: T.coral }}>
        <Icon size={18} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {sub ? <span style={{ display: 'block', fontFamily: T.mono, fontSize: 11, color: T.t3, marginTop: 1 }}>{sub}</span> : null}
      </span>
      <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: hover ? T.coral : T.t3 }}>Choisir →</span>
    </button>
  );
}

function backBtn() {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '7px 13px', borderRadius: 9,
    cursor: 'pointer', background: 'rgba(217,119,87,0.10)', border: '1px solid rgba(217,119,87,0.28)',
    color: T.coral, fontSize: 12.5, fontWeight: 600,
  };
}
