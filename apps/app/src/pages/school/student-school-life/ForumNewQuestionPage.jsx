import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, PlayCircle, GraduationCap, Loader2, CheckCircle2, Clapperboard, LayoutGrid, List, Sparkles } from 'lucide-react';
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
  const [cursusVideos, setCursusVideos] = useState([]);
  const [precepteurVideos, setPrecepteurVideos] = useState([]);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('recent'); // 'recent' | 'replay' | 'course' | 'cursus'
  const [view, setView] = useState('rail'); // 'rail' | 'list'

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
          supabase.from('course_lessons').select('id, title, video_url, module_id, created_at').limit(400),
          supabase.from('course_modules').select('id, course_id').limit(400),
          supabase.from('courses').select('id, title').limit(400),
        ]);
        const modToCourse = new Map((modulesRes?.data || []).map((m) => [m.id, m.course_id]));
        const courseTitle = new Map((coursesRes?.data || []).map((c) => [c.id, c.title]));
        const vids = (lessonsRes?.data || [])
          .filter((l) => l.video_url)
          .map((l) => {
            const courseId = modToCourse.get(l.module_id);
            return { id: l.id, title: l.title || 'Leçon', videoUrl: l.video_url, courseId, courseTitle: courseTitle.get(courseId), createdAt: l.created_at };
          })
          .filter((v) => v.courseId);
        if (alive) setCourseVideos(vids);
      } catch { /* noop */ }
      // Vidéos du cursus (école) : formation_day_contents type='video' (video_url direct).
      try {
        const { data } = await supabase.from('formation_day_contents').select('id, data, created_at').eq('type', 'video').limit(300);
        const fdc = (Array.isArray(data) ? data : [])
          .filter((r) => r?.data && (r.data.videoUrl || r.data.url))
          .map((r) => ({ id: r.id, title: r.data.title || 'Leçon vidéo', videoUrl: r.data.videoUrl || r.data.url, posterUrl: r.data.posterUrl || null, createdAt: r.created_at }));
        if (alive) setCursusVideos(fdc);
      } catch { /* noop */ }
      // Vidéos du Précepteur : course_render_jobs (agent → cours enseigné rendu en vidéo).
      try {
        const { data } = await supabase.from('course_render_jobs').select('id, content_id, status, payload, output_url, created_at').limit(200);
        const pre = (Array.isArray(data) ? data : [])
          .filter((r) => r.output_url && (r.status === 'done' || r.status === 'completed' || r.status === 'ready'))
          .map((r) => ({ id: r.id, contentId: r.content_id, title: (r.payload && (r.payload.title || r.payload.name)) || 'Cours Précepteur', videoUrl: r.output_url, createdAt: r.created_at }));
        if (alive) setPrecepteurVideos(pre);
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
  const pickCursus = (v) => {
    const data = {
      lessonId: v.id, title: v.title,
      video: { url: v.videoUrl, posterUrl: v.posterUrl || undefined, resolution: 'direct' },
      chapters: [], timestamps: [], transcript: [], mindmap: null,
      enableQuiz: false, enableQuestion: true, notesScope: 'lesson', source: 'course',
    };
    // Contexte 'cursus' : le back (post_topic_question) ne résout pas encore le cursus
    // école (formation_days ≠ courses) → post gaté dans handleAsk. Lecture/clip OK.
    setSelected({ source: 'cursus', contextType: 'cursus', contextId: v.id, data, title: data.title });
    setSentCount(0);
  };
  const pickPrecepteur = (v) => {
    const data = {
      lessonId: v.id, title: v.title,
      video: { url: v.videoUrl, resolution: 'direct' },
      chapters: [], timestamps: [], transcript: [], mindmap: null,
      enableQuiz: false, enableQuestion: true, notesScope: 'lesson', source: 'course',
    };
    // Même contexte non-résolu que le cursus (content_id ≠ courses.id) → post gaté.
    setSelected({ source: 'precepteur', contextType: 'cursus', contextId: v.id, data, title: data.title });
    setSentCount(0);
  };

  // 3) Poser la question sur l'extrait → RPC (référence, pas d'upload).
  const handleAsk = async ({ question, clipStart, clipEnd, isPublic }) => {
    if (clipStart == null || clipEnd == null) return;
    if (selected.contextType === 'cursus') {
      window.alert('Les questions sur les vidéos du cursus arrivent bientôt. Pour l’instant, choisis un replay ou une vidéo de cours.');
      return;
    }
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
  const fCursus = useMemo(() => cursusVideos.filter((c) => !q || (c.title || '').toLowerCase().includes(q)), [cursusVideos, q]);
  const fPrecepteur = useMemo(() => precepteurVideos.filter((c) => !q || (c.title || '').toLowerCase().includes(q)), [precepteurVideos, q]);

  // Normalise toutes les sources vidéo en cartes uniformes (filtre catégorie + tri récence + rendu rail|liste).
  const norm = useMemo(() => ({
    replay: fReplays.map((r) => ({ key: 'r-' + r.id, kind: 'replay', title: r.title, sub: fmtDate(r.date), date: r.date, poster: null, onClick: () => pickReplay(r) })),
    course: fCourses.map((c) => ({ key: 'c-' + c.id, kind: 'course', title: c.title, sub: c.courseTitle || 'Leçon', date: c.createdAt, poster: null, onClick: () => pickCourse(c) })),
    cursus: fCursus.map((v) => ({ key: 'u-' + v.id, kind: 'cursus', title: v.title, sub: 'Leçon', date: v.createdAt, poster: v.posterUrl, onClick: () => pickCursus(v) })),
    precepteur: fPrecepteur.map((v) => ({ key: 'p-' + v.id, kind: 'precepteur', title: v.title, sub: 'Précepteur', date: v.createdAt, poster: null, onClick: () => pickPrecepteur(v) })),
  }), [fReplays, fCourses, fCursus, fPrecepteur]);

  // TAXONOMIE COMPLÈTE des sources vidéo — chips TOUJOURS affichés (même à 0) pour montrer
  // que chaque source est filtrable. `video_assets` (store unifié) branchera les futures.
  const cats = useMemo(() => [
    { key: 'recent', label: 'Récents' },
    { key: 'replay', label: 'Replays' },
    { key: 'course', label: 'Cours numérique' },
    { key: 'masterclass', label: 'Masterclass' },
    { key: 'cursus', label: 'Cursus' },
    { key: 'precepteur', label: 'Précepteur' },
  ].map((c) => ({ ...c, count: c.key === 'recent' ? Object.values(norm).reduce((n, a) => n + a.length, 0) : (norm[c.key] || []).length })), [norm]);

  const shown = useMemo(() => {
    const ts = (d) => { const t = d ? Date.parse(d) : NaN; return Number.isFinite(t) ? t : 0; };
    const base = cat === 'recent' ? Object.values(norm).flat() : (norm[cat] || []);
    return base.slice().sort((a, b) => ts(b.date) - ts(a.date));
  }, [norm, cat]);

  const totalCount = cats.find((c) => c.key === 'recent')?.count || 0;
  const totalEmpty = !loading && totalCount === 0;

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
      ) : totalEmpty ? (
        <div style={{ textAlign: 'center', padding: '44px 20px', color: T.t3, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14 }}>
          <p style={{ color: T.t2, fontSize: 14, margin: '0 0 4px' }}>Aucune vidéo disponible pour l'instant.</p>
          <p style={{ fontSize: 12.5, margin: 0 }}>Tes replays, cours numériques, cursus et cours du Précepteur apparaîtront ici.</p>
        </div>
      ) : (
        <div>
          {/* Barre filtre : Récents + TAXONOMIE complète des sources  +  bascule rail | liste */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              {cats.map((c) => (
                <button key={c.key} onClick={() => setCat(c.key)} style={chip(cat === c.key, c.count === 0)}>
                  {c.label} <span style={{ opacity: 0.6 }}>{c.count}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'inline-flex', borderRadius: 9, overflow: 'hidden', border: `1px solid ${T.line}`, flexShrink: 0 }}>
              <button onClick={() => setView('rail')} title="Affichage rail" aria-label="Affichage rail" style={viewBtn(view === 'rail')}><LayoutGrid size={15} /></button>
              <button onClick={() => setView('list')} title="Affichage liste" aria-label="Affichage liste" style={viewBtn(view === 'list')}><List size={15} /></button>
            </div>
          </div>

          {shown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: T.t3, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14 }}>
              <p style={{ color: T.t2, fontSize: 13.5, margin: 0 }}>Aucune vidéo dans cette catégorie pour l'instant.</p>
            </div>
          ) : view === 'rail' ? (
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6, scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}>
              {shown.map((it) => (
                <VideoCard key={it.key} kind={it.kind} title={it.title} sub={it.sub} poster={it.poster} onClick={it.onClick} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shown.map((it) => (
                <VideoListRow key={it.key} kind={it.kind} title={it.title} sub={it.sub} poster={it.poster} onClick={it.onClick} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Chip de filtre catégorie + bouton de bascule d'affichage (rail | liste).
function chip(active, empty) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 999, cursor: 'pointer',
    fontFamily: T.mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.01em',
    background: active ? T.coral : (empty ? 'rgba(245,241,233,0.03)' : 'rgba(217,119,87,0.08)'),
    border: `1px solid ${active ? T.coral : (empty ? 'rgba(245,241,233,0.10)' : 'rgba(217,119,87,0.22)')}`,
    color: active ? '#1c1a17' : (empty ? T.t3 : T.coral),
    transition: 'background .14s, border-color .14s, color .14s',
  };
}
function viewBtn(active) {
  return {
    display: 'grid', placeItems: 'center', width: 34, height: 30, cursor: 'pointer', border: 'none',
    background: active ? 'rgba(217,119,87,0.18)' : 'transparent',
    color: active ? T.coral : T.t3, transition: 'background .14s, color .14s',
  };
}

// Rangée « liste » : vignette 16:9 + badge + titre + sous-titre.
function VideoListRow({ kind, title, sub, poster, onClick }) {
  const [hover, setHover] = useState(false);
  const meta = KIND_META[kind] || KIND_META.course;
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '9px 12px', borderRadius: 12,
        background: hover ? T.cardHover : T.card, border: `1px solid ${hover ? 'rgba(217,119,87,0.32)' : T.line}`,
        transition: 'background .14s, border-color .14s',
      }}
    >
      <span style={{ position: 'relative', flexShrink: 0, width: 78, aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden', display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${meta.g1}, ${meta.g2})` }}>
        <Icon size={16} style={{ color: 'rgba(245,241,233,0.5)' }} />
        {poster ? <img src={poster} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', color: T.coral, background: 'rgba(217,119,87,0.10)', border: '1px solid rgba(217,119,87,0.24)', borderRadius: 5, padding: '1px 6px', flexShrink: 0 }}>{meta.badge}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        </span>
        {sub ? <span style={{ display: 'block', fontFamily: T.mono, fontSize: 10.5, color: T.t3, marginTop: 3 }}>{sub}</span> : null}
      </span>
      <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: hover ? T.coral : T.t3 }}>Choisir →</span>
    </button>
  );
}

const KIND_META = {
  replay: { badge: 'REPLAY', icon: PlayCircle, g1: '#3a2118', g2: '#5c2f1e' },
  course: { badge: 'COURS', icon: Clapperboard, g1: '#33241d', g2: '#4a2f22' },
  cursus: { badge: 'CURSUS', icon: GraduationCap, g1: '#2e2620', g2: '#453528' },
  precepteur: { badge: 'PRÉCEPTEUR', icon: Sparkles, g1: '#33221c', g2: '#52301f' },
};

function VideoCard({ kind, title, sub, poster, onClick }) {
  const [hover, setHover] = useState(false);
  const meta = KIND_META[kind] || KIND_META.course;
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flexShrink: 0, width: 216, scrollSnapAlign: 'start', textAlign: 'left', cursor: 'pointer', padding: 0,
        borderRadius: 14, overflow: 'hidden', background: T.card,
        border: `1px solid ${hover ? 'rgba(217,119,87,0.42)' : T.line}`,
        transform: hover ? 'translateY(-2px)' : 'none', transition: 'border-color .14s, transform .14s',
      }}
    >
      {/* Poster 16:9 : dégradé chaud + icône TOUJOURS en base ; image par-dessus si elle
          charge (onError → on la masque, le dégradé reste). Jamais de carte vide. */}
      <div style={{ position: 'relative', aspectRatio: '16 / 9', display: 'grid', placeItems: 'center',
        background: `linear-gradient(135deg, ${meta.g1}, ${meta.g2})` }}>
        <Icon size={30} style={{ color: 'rgba(245,241,233,0.55)' }} />
        {poster ? <img src={poster} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
        <span style={{ position: 'absolute', top: 8, left: 8, fontFamily: T.mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: T.coral, background: 'rgba(28,26,23,0.82)', border: '1px solid rgba(217,119,87,0.3)', borderRadius: 5, padding: '2px 6px' }}>{meta.badge}</span>
        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: hover ? 1 : 0, transition: 'opacity .14s', background: 'rgba(28,26,23,0.35)' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: '50%', background: T.coral, color: '#1c1a17' }}><PlayCircle size={22} /></span>
        </span>
      </div>
      {/* Titre + sous-titre */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.cream, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 35 }}>{title}</div>
        {sub ? <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.t3, marginTop: 4 }}>{sub}</div> : null}
      </div>
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
