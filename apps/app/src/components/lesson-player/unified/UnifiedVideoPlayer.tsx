import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import LessonVideoPlayer, {
  LessonVideoPlayerHandle,
} from '@/components/lesson-player/VideoPlayer';
import ChapterList from '@/components/lesson-player/ChapterList';
import TranscriptPanel from '@/components/lesson-player/TranscriptPanel';
import MindMapNavigation from '@/components/lesson-player/MindMapNavigation';
import NotesPanel from '@/components/lesson-player/NotesPanel';
import QuizPanel from '@/components/lesson-player/QuizPanel';
// @ts-ignore — composant JSX
import ClipQuestionComposer from './ClipQuestionComposer';
import type { UnifiedPlayerData } from './types';

/** Résout l'URL jouable pour un replay (endpoint presign → fetch Bearer → {url}). */
function useResolvedVideoUrl(data: UnifiedPlayerData): string | null {
  const [url, setUrl] = useState<string | null>(
    data.video.resolution === 'direct' ? data.video.url || '' : null,
  );
  useEffect(() => {
    if (data.video.resolution === 'direct') { setUrl(data.video.url || ''); return; }
    const apiUrl = data.video.url || '';
    const isEndpoint = /\/lives\/[^/]+\/replay\/file/.test(apiUrl);
    if (!isEndpoint) { setUrl(apiUrl); return; }
    let alive = true;
    (async () => {
      try {
        const token = (await supabase.auth.getSession())?.data?.session?.access_token;
        const res = await fetch(apiUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        const resolved = body?.data?.url || body?.url || '';
        if (alive) setUrl(resolved || null);
      } catch { if (alive) setUrl(null); }
    })();
    return () => { alive = false; };
  }, [data.video.resolution, data.video.url]);
  return url;
}

type PanelKey = 'chapters' | 'transcript' | 'mindmap' | 'notes' | 'quiz' | 'question';

export interface UnifiedVideoPlayerProps {
  data: UnifiedPlayerData;
  layout?: 'page' | 'embed';
  className?: string;
  /** Envoi d'une question + clip (le parent gère la persistance). */
  onAskQuestion?: (payload: { question: string; clipStart: number | null; clipEnd: number | null; isPublic: boolean }) => Promise<void> | void;
}

const COL = {
  base: '#262624', cream: '#f5f1e9', coral: '#d97757',
  t2: 'rgba(245,241,233,0.72)', t3: 'rgba(245,241,233,0.5)',
  card: 'rgba(255,247,240,0.022)', border: 'rgba(245,241,233,0.09)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

const UnifiedVideoPlayer: React.FC<UnifiedVideoPlayerProps> = ({ data, layout = 'embed', className = '', onAskQuestion }) => {
  const playerRef = useRef<LessonVideoPlayerHandle | null>(null);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
  const [noteMarkers, setNoteMarkers] = useState<{ id: string; timeSeconds: number }[]>([]);
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState(false);

  const resolvedUrl = useResolvedVideoUrl(data);
  const seek = (t: number) => playerRef.current?.seekTo(t);
  const seekAndClose = (t: number) => { seek(t); setOpenPanel(null); };

  const videoProp = useMemo(() => ({
    url: resolvedUrl || '',
    storagePath: data.video.resolution === 'direct' ? data.video.storagePath : undefined,
    type: data.video.resolution === 'presign' ? 'file' : data.video.type,
    title: data.title,
    posterUrl: data.video.posterUrl,
  }), [resolvedUrl, data]);

  const tools: { key: PanelKey; label: string; icon: string; on: boolean }[] = [
    { key: 'chapters', label: 'Chapitres', icon: '📖', on: true },
    { key: 'transcript', label: 'Transcription', icon: '📝', on: true },
    { key: 'mindmap', label: 'Carte mentale', icon: '🧠', on: true },
    { key: 'notes', label: data.notesScope === 'lesson' ? 'Notes' : '', icon: '✏️', on: data.notesScope === 'lesson' },
    { key: 'quiz', label: 'Quiz', icon: '🎯', on: data.enableQuiz },
    { key: 'question', label: 'Poser une question', icon: '❓', on: data.enableQuestion },
  ];

  const titles: Record<PanelKey, string> = {
    chapters: 'Chapitres', transcript: 'Transcription', mindmap: 'Carte mentale',
    notes: 'Mes notes', quiz: 'Quiz de révision', question: 'Poser une question (sur un extrait)',
  };

  const handleAsk = async (payload: { question: string; clipStart: number | null; clipEnd: number | null; isPublic: boolean }) => {
    setAsking(true); setSent(false);
    try { await onAskQuestion?.(payload); setSent(true); setTimeout(() => setOpenPanel(null), 900); }
    finally { setAsking(false); }
  };

  const body = (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {resolvedUrl === null ? (
        <div className="aspect-video w-full grid place-items-center bg-black/60 rounded-lg text-sm text-gray-300">Chargement du replay…</div>
      ) : (
        <LessonVideoPlayer ref={playerRef} video={videoProp} chapters={data.chapters} notes={noteMarkers} onTimeUpdate={(t) => setCurrentTimeSeconds(t)} />
      )}

      {/* Barre d'outils — chaque panneau s'ouvre en MODAL (pas de scroll long) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {tools.filter((t) => t.on).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setSent(false); setOpenPanel(t.key); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
              background: t.key === 'question' ? 'rgba(217,119,87,0.14)' : COL.card,
              border: `1px solid ${t.key === 'question' ? 'rgba(217,119,87,0.34)' : COL.border}`,
              color: t.key === 'question' ? COL.coral : COL.cream, fontSize: 13, fontWeight: 500,
            }}
          >
            <span aria-hidden>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Modal panneau */}
      {openPanel ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenPanel(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 980, maxHeight: '84vh', display: 'flex', flexDirection: 'column', background: COL.base, border: `1px solid ${COL.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.5)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${COL.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COL.cream }}>{titles[openPanel]}</div>
              <button type="button" onClick={() => setOpenPanel(null)} style={{ width: 30, height: 30, borderRadius: 8, cursor: 'pointer', background: COL.card, border: `1px solid ${COL.border}`, color: COL.t2, fontSize: 16, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: 18, overflowY: 'auto' }}>
              {openPanel === 'chapters' ? <ChapterList timestamps={data.timestamps} currentTimeSeconds={currentTimeSeconds} onSeek={seekAndClose} /> : null}
              {openPanel === 'transcript' ? <TranscriptPanel transcript={data.transcript} currentTimeSeconds={currentTimeSeconds} onSeek={seekAndClose} /> : null}
              {openPanel === 'mindmap' ? <MindMapNavigation mindmap={data.mindmap} onSeek={seekAndClose} /> : null}
              {openPanel === 'notes' ? <NotesPanel lessonId={data.lessonId} currentTimeSeconds={currentTimeSeconds} onSeek={seekAndClose} onNotesChange={(m: any) => setNoteMarkers(m)} /> : null}
              {openPanel === 'quiz' ? <QuizPanel nodes={data.mindmap ? [data.mindmap] : []} videoTitle={data.title} unlocked /> : null}
              {openPanel === 'question' ? (
                sent ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: COL.coral, fontWeight: 600 }}>✓ Question envoyée</div>
                ) : (
                  <ClipQuestionComposer videoUrl={resolvedUrl || ''} storagePath={data.video.storagePath || ''} onSubmit={handleAsk} submitting={asking} />
                )
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (layout === 'page') {
    return <div style={{ minHeight: '100vh', background: COL.base, color: COL.cream }}><div style={{ maxWidth: 1120, margin: '0 auto', padding: 24 }}>{body}</div></div>;
  }
  return body;
};

export default UnifiedVideoPlayer;
