/**
 * Édition replay / post-prod IA pour un pedagogical_block (replay_assets).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Film, Loader2, X, Save, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchReplayAssetForBlock, saveReplayAssetForBlock } from '@/lib/schoolPathsApi';

function safeJsonParse(text, fallback) {
  try {
    return text.trim() ? JSON.parse(text) : fallback;
  } catch {
    return null;
  }
}

function keyPointsToText(arr) {
  if (!Array.isArray(arr)) return '';
  return arr
    .map((k) => {
      if (k == null) return '';
      if (typeof k === 'string') return k;
      if (typeof k === 'object') return String(k.text ?? k.label ?? k.title ?? JSON.stringify(k));
      return String(k);
    })
    .filter(Boolean)
    .join('\n');
}

function textToKeyPoints(text) {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function chaptersToRows(chapters) {
  const raw = Array.isArray(chapters) ? chapters : [];
  const rows = raw.map((c) => {
    if (typeof c === 'string') return { title: c, startSec: '' };
    if (!c || typeof c !== 'object') return { title: '', startSec: '' };
    const sec = c.start_sec ?? c.start ?? c.t ?? '';
    return { title: String(c.title ?? c.label ?? ''), startSec: sec === '' || sec == null ? '' : String(sec) };
  });
  return rows.length ? rows : [{ title: '', startSec: '' }];
}

function rowsToChapters(rows) {
  return rows
    .filter((r) => r.title.trim())
    .map((r) => {
      const title = r.title.trim();
      const n = Number(String(r.startSec).replace(',', '.'));
      if (r.startSec !== '' && r.startSec != null && Number.isFinite(n)) return { title, start_sec: n };
      return { title };
    });
}

function quizToRows(quiz) {
  const raw = Array.isArray(quiz) ? quiz : [];
  const rows = raw.map((q) => {
    if (!q || typeof q !== 'object') return { question: '', answer: '' };
    return {
      question: String(q.question ?? q.q ?? q.prompt ?? ''),
      answer: String(q.answer ?? q.correct ?? q.solution ?? ''),
    };
  });
  return rows.length ? rows : [{ question: '', answer: '' }];
}

function rowsToQuiz(rows) {
  return rows
    .filter((r) => r.question.trim())
    .map((r) => ({ question: r.question.trim(), answer: r.answer.trim() || '' }));
}

export default function SchoolPathBlockReplayPanel({ blockId, blockLabel, inputCls, busy, setBusy, setError, onClose }) {
  const [loading, setLoading] = useState(true);
  const [replayTab, setReplayTab] = useState('simple');
  const [summary, setSummary] = useState('');
  const [transcriptPlain, setTranscriptPlain] = useState('');
  const [transcriptJson, setTranscriptJson] = useState('{}');
  const [chaptersJson, setChaptersJson] = useState('[]');
  const [keyPointsJson, setKeyPointsJson] = useState('[]');
  const [quizJson, setQuizJson] = useState('[]');
  const [mindmapJson, setMindmapJson] = useState('{}');
  const [studentJson, setStudentJson] = useState('{}');
  const [teacherJson, setTeacherJson] = useState('{}');
  const [keyPointsText, setKeyPointsText] = useState('');
  const [chapterRows, setChapterRows] = useState([{ title: '', startSec: '' }]);
  const [quizRows, setQuizRows] = useState([{ question: '', answer: '' }]);

  const load = useCallback(async () => {
    if (!blockId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchReplayAssetForBlock(supabase, blockId);
    setLoading(false);
    if (err) {
      setError(err.message || 'Replay lecture');
      return;
    }
    if (data) {
      setSummary(data.summary || '');
      const tr = data.transcript ?? {};
      const plain =
        tr && typeof tr === 'object' && !Array.isArray(tr) && tr.plain != null
          ? String(tr.plain)
          : typeof data.transcript === 'string'
            ? data.transcript
            : '';
      setTranscriptPlain(plain);
      setTranscriptJson(JSON.stringify(data.transcript ?? {}, null, 2));
      setChaptersJson(JSON.stringify(data.chapters ?? [], null, 2));
      setKeyPointsJson(JSON.stringify(data.key_points ?? [], null, 2));
      setQuizJson(JSON.stringify(data.quiz ?? [], null, 2));
      setMindmapJson(JSON.stringify(data.mindmap ?? {}, null, 2));
      setStudentJson(JSON.stringify(data.replay_version_student ?? {}, null, 2));
      setTeacherJson(JSON.stringify(data.replay_version_teacher ?? {}, null, 2));
      setKeyPointsText(keyPointsToText(data.key_points));
      setChapterRows(chaptersToRows(data.chapters));
      setQuizRows(quizToRows(data.quiz));
    } else {
      setSummary('');
      setTranscriptPlain('');
      setTranscriptJson('{}');
      setChaptersJson('[]');
      setKeyPointsJson('[]');
      setQuizJson('[]');
      setMindmapJson('{}');
      setStudentJson('{}');
      setTeacherJson('{}');
      setKeyPointsText('');
      setChapterRows([{ title: '', startSec: '' }]);
      setQuizRows([{ question: '', answer: '' }]);
    }
  }, [blockId, setError]);

  useEffect(() => {
    load();
  }, [load]);

  const switchToSimple = useCallback(() => {
    if (replayTab === 'simple') return;
    const t = safeJsonParse(transcriptJson, {});
    if (t && typeof t === 'object' && !Array.isArray(t) && t.plain != null) {
      setTranscriptPlain(String(t.plain));
    } else if (typeof t === 'string') {
      setTranscriptPlain(t);
    }
    const kp = safeJsonParse(keyPointsJson, []);
    if (Array.isArray(kp)) setKeyPointsText(keyPointsToText(kp));
    const ch = safeJsonParse(chaptersJson, []);
    if (Array.isArray(ch)) setChapterRows(chaptersToRows(ch));
    const qz = safeJsonParse(quizJson, []);
    if (Array.isArray(qz)) setQuizRows(quizToRows(qz));
    setReplayTab('simple');
  }, [replayTab, transcriptJson, keyPointsJson, chaptersJson, quizJson]);

  const switchToJson = useCallback(() => {
    if (replayTab === 'json') return;
    const baseT = safeJsonParse(transcriptJson, {});
    const mergedT =
      baseT && typeof baseT === 'object' && !Array.isArray(baseT)
        ? { ...baseT, plain: transcriptPlain }
        : { plain: transcriptPlain };
    setTranscriptJson(JSON.stringify(mergedT, null, 2));
    setKeyPointsJson(JSON.stringify(textToKeyPoints(keyPointsText), null, 2));
    setChaptersJson(JSON.stringify(rowsToChapters(chapterRows), null, 2));
    setQuizJson(JSON.stringify(rowsToQuiz(quizRows), null, 2));
    setReplayTab('json');
  }, [replayTab, transcriptJson, transcriptPlain, keyPointsText, chapterRows, quizRows]);

  const save = async () => {
    setBusy(true);
    setError(null);

    let transcript;
    let chapters;
    let key_points;
    let quiz;

    if (replayTab === 'simple') {
      const baseT = safeJsonParse(transcriptJson, {});
      transcript =
        baseT && typeof baseT === 'object' && !Array.isArray(baseT)
          ? { ...baseT, plain: transcriptPlain }
          : { plain: transcriptPlain };
      key_points = textToKeyPoints(keyPointsText);
      chapters = rowsToChapters(chapterRows);
      quiz = rowsToQuiz(quizRows);
    } else {
      transcript = safeJsonParse(transcriptJson, {});
      chapters = safeJsonParse(chaptersJson, []);
      key_points = safeJsonParse(keyPointsJson, []);
      quiz = safeJsonParse(quizJson, []);
    }

    const mindmap = safeJsonParse(mindmapJson, {});
    const replay_version_student = safeJsonParse(studentJson, {});
    const replay_version_teacher = safeJsonParse(teacherJson, {});
    const bad =
      transcript === null ||
      chapters === null ||
      key_points === null ||
      quiz === null ||
      mindmap === null ||
      replay_version_student === null ||
      replay_version_teacher === null;
    if (
      bad ||
      typeof transcript !== 'object' ||
      Array.isArray(transcript) ||
      !Array.isArray(chapters) ||
      !Array.isArray(key_points) ||
      !Array.isArray(quiz) ||
      typeof mindmap !== 'object' ||
      Array.isArray(mindmap) ||
      typeof replay_version_student !== 'object' ||
      Array.isArray(replay_version_student) ||
      typeof replay_version_teacher !== 'object' ||
      Array.isArray(replay_version_teacher)
    ) {
      setError('Un des champs JSON est invalide (objet vs tableau).');
      setBusy(false);
      return;
    }
    const { error: err } = await saveReplayAssetForBlock(supabase, blockId, {
      summary: summary.trim() || null,
      transcript,
      chapters,
      key_points,
      quiz,
      mindmap,
      replay_version_student,
      replay_version_teacher,
    });
    setBusy(false);
    if (err) setError(err.message || 'Sauvegarde replay impossible');
    else await load();
  };

  const ta = (val, setVal, rows = 3) => (
    <textarea
      className={cn(inputCls, 'resize-none font-mono text-[10px] leading-relaxed')}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      rows={rows}
    />
  );

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => (id === 'simple' ? switchToSimple() : switchToJson())}
      className={cn(
        'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
        replayTab === id ? 'bg-fuchsia-600/45 text-white' : 'text-white/45 hover:bg-white/[0.06] hover:text-white/70',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/25 via-[#0a0908] to-transparent p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-white/88">
          <Film className="h-4 w-4 text-fuchsia-400" />
          Replay & post-prod
          {blockLabel ? <span className="font-normal text-white/45">— {blockLabel}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {tabBtn('simple', 'Simple')}
            {tabBtn('json', 'JSON')}
          </div>
          <button
            type="button"
            onClick={() => save()}
            disabled={busy || loading}
            className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Enregistrer
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/12 p-1.5 text-white/45 hover:bg-white/[0.06]" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-white/20" />
      ) : replayTab === 'simple' ? (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Résumé</label>
            <textarea className={cn(inputCls, 'min-h-[72px] resize-none')} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Résumé textuel post-IA" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Transcription (texte)</label>
            <textarea
              className={cn(inputCls, 'min-h-[120px] resize-none text-[12px] leading-relaxed')}
              value={transcriptPlain}
              onChange={(e) => setTranscriptPlain(e.target.value)}
              placeholder="Coller ou corriger la transcription ; enregistré dans transcript.plain (JSON fusionné)."
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Points clés (une ligne = un point)</label>
            <textarea
              className={cn(inputCls, 'min-h-[88px] resize-none text-[12px]')}
              value={keyPointsText}
              onChange={(e) => setKeyPointsText(e.target.value)}
              placeholder="Idée 1&#10;Idée 2"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Chapitres</label>
              <button
                type="button"
                onClick={() => setChapterRows((r) => [...r, { title: '', startSec: '' }])}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-fuchsia-300/90 hover:text-fuchsia-200"
              >
                <Plus className="h-3 w-3" /> Ligne
              </button>
            </div>
            <div className="space-y-2">
              {chapterRows.map((row, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    className={cn(inputCls, 'min-w-[140px] flex-1')}
                    value={row.title}
                    onChange={(e) => setChapterRows((rows) => rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    placeholder="Titre"
                  />
                  <input
                    className={cn(inputCls, 'w-24')}
                    value={row.startSec}
                    onChange={(e) => setChapterRows((rows) => rows.map((x, j) => (j === i ? { ...x, startSec: e.target.value } : x)))}
                    placeholder="s (opt.)"
                    inputMode="decimal"
                  />
                  <button
                    type="button"
                    disabled={chapterRows.length <= 1}
                    onClick={() => setChapterRows((rows) => rows.filter((_, j) => j !== i))}
                    className="rounded border border-white/10 p-1.5 text-white/35 hover:bg-white/[0.06] disabled:opacity-25"
                    aria-label="Supprimer la ligne"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Quiz (question / réponse courte)</label>
              <button
                type="button"
                onClick={() => setQuizRows((r) => [...r, { question: '', answer: '' }])}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-fuchsia-300/90 hover:text-fuchsia-200"
              >
                <Plus className="h-3 w-3" /> Question
              </button>
            </div>
            <div className="space-y-2">
              {quizRows.map((row, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 sm:flex-row sm:items-start">
                  <textarea
                    className={cn(inputCls, 'min-h-[48px] flex-1 resize-none text-[12px]')}
                    value={row.question}
                    onChange={(e) => setQuizRows((rows) => rows.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
                    placeholder="Question"
                  />
                  <textarea
                    className={cn(inputCls, 'min-h-[48px] flex-1 resize-none text-[12px]')}
                    value={row.answer}
                    onChange={(e) => setQuizRows((rows) => rows.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                    placeholder="Réponse attendue"
                  />
                  <button
                    type="button"
                    disabled={quizRows.length <= 1}
                    onClick={() => setQuizRows((rows) => rows.filter((_, j) => j !== i))}
                    className="rounded border border-white/10 p-1.5 text-white/35 hover:bg-white/[0.06] sm:self-start disabled:opacity-25"
                    aria-label="Supprimer la question"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] leading-relaxed text-white/35">
            Mindmap et versions élève / enseignant : passez par l'onglet <strong className="font-semibold text-white/55">JSON</strong>.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Résumé</label>
            <textarea className={cn(inputCls, 'min-h-[72px] resize-none')} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Résumé textuel post-IA" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Transcription (JSON)</label>
            {ta(transcriptJson, setTranscriptJson, 5)}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Chapitres (JSON array)</label>
            {ta(chaptersJson, setChaptersJson, 4)}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Points clés (JSON array)</label>
            {ta(keyPointsJson, setKeyPointsJson, 4)}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Quiz (JSON array)</label>
            {ta(quizJson, setQuizJson, 4)}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Mindmap (JSON object)</label>
            {ta(mindmapJson, setMindmapJson, 4)}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Replay élève (JSON)</label>
            {ta(studentJson, setStudentJson, 3)}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">Replay enseignant (JSON)</label>
            {ta(teacherJson, setTeacherJson, 3)}
          </div>
        </div>
      )}
    </div>
  );
}
