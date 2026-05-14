import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import LessonVideoPlayer, { LessonVideoPlayerHandle } from '@/components/lesson-player/VideoPlayer';
import ChapterList from '@/components/lesson-player/ChapterList';
import TranscriptPanel from '@/components/lesson-player/TranscriptPanel';
import MindMapNavigation from '@/components/lesson-player/MindMapNavigation';
import NotesPanel from '@/components/lesson-player/NotesPanel';
import { LessonContentData, tsToSeconds } from '@/components/lesson-player/types';

type FormationDayContentRow = {
  id: string;
  day_id: string;
  type: string;
  data: LessonContentData;
};

const LessonPlayerPage: React.FC = () => {
  const { contentId } = useParams();
  const navigate = useNavigate();
  const playerRef = useRef<LessonVideoPlayerHandle | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<FormationDayContentRow | null>(null);

  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
  const [noteMarkers, setNoteMarkers] = useState<{ id: string; timeSeconds: number }[]>([]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!contentId) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('formation_day_contents')
          .select('id,day_id,type,data')
          .eq('id', contentId)
          .maybeSingle();
        if (!alive) return;
        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
        if (!data) {
          setError('Contenu introuvable');
          setLoading(false);
          return;
        }
        setContent(data as FormationDayContentRow);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(String(e?.message || e));
        setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [contentId]);

  const lessonData = (content?.data || {}) as LessonContentData;

  const chapters = useMemo(() => {
    const arr = Array.isArray(lessonData?.timestamps) ? lessonData.timestamps : [];
    return arr
      .map((t) => ({
        label: String(t.label || '').trim(),
        timeSeconds: tsToSeconds(t) ?? 0,
      }))
      .filter((t) => t.label)
      .sort((a, b) => a.timeSeconds - b.timeSeconds);
  }, [lessonData?.timestamps]);

  const onSeek = (t: number) => {
    playerRef.current?.seekTo(t);
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0F1419] text-white p-10">Chargement…</div>;
  }

  if (error || !content) {
    return (
      <div className="min-h-screen bg-[#0F1419] text-white p-10">
        <div className="max-w-xl space-y-4">
          <div className="text-lg font-semibold">Lecture indisponible</div>
          <div className="text-sm text-gray-300">{error || 'Erreur'}</div>
          <Button variant="outline" className="border-white/10 text-white" onClick={() => navigate(-1)}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1419] text-white">
      <div className="h-16 border-b border-white/10 flex items-center px-6 bg-[#15202B]">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-300">
          Retour
        </Button>
        <div className="flex-1 px-4 min-w-0">
          <h1 className="text-lg font-bold truncate">{lessonData?.title || 'Lesson'}</h1>
          <div className="text-xs text-gray-500 truncate">{content.id}</div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <LessonVideoPlayer
          ref={playerRef}
          video={{
            url: (lessonData.videoUrl || lessonData.url || '') as string,
            storagePath: lessonData.storagePath,
            type: lessonData.type,
            title: lessonData.title,
          }}
          chapters={chapters}
          notes={noteMarkers}
          onTimeUpdate={(t) => setCurrentTimeSeconds(t)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="bg-[#192734] border border-white/10 p-4">
            <ChapterList timestamps={lessonData.timestamps || []} currentTimeSeconds={currentTimeSeconds} onSeek={onSeek} />
          </Card>
          <Card className="bg-[#192734] border border-white/10 p-4">
            <TranscriptPanel transcript={lessonData.transcript || []} currentTimeSeconds={currentTimeSeconds} onSeek={onSeek} />
          </Card>
          <Card className="bg-[#192734] border border-white/10 p-4">
            <MindMapNavigation mindmap={lessonData.mindmap || null} onSeek={onSeek} />
          </Card>
        </div>

        <NotesPanel
          lessonId={content.id}
          currentTimeSeconds={currentTimeSeconds}
          onSeek={onSeek}
          onNotesChange={(m) => setNoteMarkers(m)}
        />
      </div>
    </div>
  );
};

export default LessonPlayerPage;
