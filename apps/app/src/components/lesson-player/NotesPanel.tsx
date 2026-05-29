import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { formatTime } from './types';

export type LessonNoteRow = {
  id: string;
  user_id: string;
  lesson_id: string;
  timestamp_seconds: number;
  note_text: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  lessonId: string;
  currentTimeSeconds: number;
  onSeek: (timeSeconds: number) => void;
  onNotesChange?: (notes: { id: string; timeSeconds: number }[]) => void;
};

const NotesPanel: React.FC<Props> = ({ lessonId, currentTimeSeconds, onSeek, onNotesChange }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LessonNoteRow[]>([]);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const markers = useMemo(() => rows.map((r) => ({ id: r.id, timeSeconds: Number(r.timestamp_seconds || 0) })), [rows]);

  useEffect(() => {
    onNotesChange?.(markers);
  }, [markers, onNotesChange]);

  const load = async () => {
    if (!lessonId || !user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lesson_notes')
        .select('id,user_id,lesson_id,timestamp_seconds,note_text,created_at,updated_at')
        .eq('lesson_id', lessonId)
        .order('timestamp_seconds', { ascending: true });
      if (error) return;
      setRows((data as LessonNoteRow[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, user?.id]);

  const addNote = async () => {
    if (!lessonId || !user?.id) return;
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        lesson_id: lessonId,
        timestamp_seconds: Math.round(Math.max(0, Number(currentTimeSeconds || 0)) * 2) / 2,
        note_text: trimmed,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('lesson_notes').insert(payload);
      if (error) return;
      setText('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id: string) => {
    if (!id) return;
    await supabase.from('lesson_notes').delete().eq('id', id);
    await load();
  };

  return (
    <div className="border border-white/10 rounded-xl bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="font-bold">Notes de l'élève</div>
          <div className="text-xs text-gray-400">Ajoute une note au temps courant ({formatTime(currentTimeSeconds)})</div>
        </div>
        <Button
          onClick={addNote}
          disabled={saving || !String(text || '').trim()}
          className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold"
        >
          {saving ? 'Ajout…' : 'Ajouter'}
        </Button>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="bg-[#0F1419] border-white/10 min-h-[90px] text-white"
        placeholder="Écris ta note ici..."
      />

      <div className="mt-4">
        {loading ? (
          <div className="text-sm text-gray-400">Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-400">Aucune note.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="border border-white/10 rounded-lg p-3 bg-black/20">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="text-left min-w-0"
                    onClick={() => onSeek(Number(r.timestamp_seconds || 0))}
                  >
                    <div className="text-xs text-[#D4AF37]">{formatTime(Number(r.timestamp_seconds || 0))}</div>
                    <div className="text-sm text-gray-200 whitespace-pre-wrap break-words">{r.note_text}</div>
                  </button>
                  <div className="shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 text-white hover:bg-white/5"
                      onClick={() => deleteNote(r.id)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesPanel;
